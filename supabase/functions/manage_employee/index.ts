import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

interface CreatePayload { action: 'create'; ime_prezime: string; username: string; password: string; rfid_uid?: string; role: 'admin' | 'employee' }
interface UpdatePayload { action: 'update'; id: string; ime_prezime?: string; rfid_uid?: string; role?: 'admin' | 'employee'; password?: string }
interface DeletePayload { action: 'delete'; id: string }
type Payload = CreatePayload | UpdatePayload | DeletePayload

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401 })

  // Verify caller is authenticated admin
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: authError } = await callerClient.auth.getUser()
  if (authError || !user) return new Response('Unauthorized', { status: 401 })

  const { data: emp } = await callerClient.from('employees').select('role').eq('id', user.id).single()
  if (!emp || emp.role !== 'admin') return new Response('Forbidden', { status: 403 })

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  let payload: Payload
  try { payload = await req.json() } catch { return new Response('Invalid JSON', { status: 400 }) }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

  if (payload.action === 'create') {
    const { data, error } = await adminClient.auth.admin.createUser({
      email: `${payload.username}@rfid-bp.local`,
      password: payload.password,
      email_confirm: true,
    })
    if (error) return json({ error: error.message }, 400)

    const { error: empError } = await adminClient.from('employees').insert({
      id: data.user.id,
      ime_prezime: payload.ime_prezime,
      username: payload.username,
      rfid_uid: payload.rfid_uid ?? null,
      role: payload.role,
    })
    if (empError) {
      await adminClient.auth.admin.deleteUser(data.user.id)
      return json({ error: empError.message }, 400)
    }
    return json({ id: data.user.id }, 201)
  }

  if (payload.action === 'update') {
    const updates: Record<string, unknown> = {}
    if (payload.ime_prezime !== undefined) updates.ime_prezime = payload.ime_prezime
    if (payload.rfid_uid !== undefined) updates.rfid_uid = payload.rfid_uid || null
    if (payload.role !== undefined) updates.role = payload.role

    if (Object.keys(updates).length > 0) {
      const { error } = await adminClient.from('employees').update(updates).eq('id', payload.id)
      if (error) return json({ error: error.message }, 400)
    }
    if (payload.password) {
      const { error } = await adminClient.auth.admin.updateUserById(payload.id, { password: payload.password })
      if (error) return json({ error: error.message }, 400)
    }
    return new Response('OK', { status: 200 })
  }

  if (payload.action === 'delete') {
    // Force-close any open sessions before deleting
    await adminClient.from('work_sessions')
      .update({ clock_out: new Date().toISOString(), duration_min: 0, is_auto_closed: true })
      .eq('employee_id', payload.id)
      .is('clock_out', null)

    const { error } = await adminClient.auth.admin.deleteUser(payload.id)
    if (error) return json({ error: error.message }, 400)
    return new Response('OK', { status: 200 })
  }

  return new Response('Unknown action', { status: 400 })
})
