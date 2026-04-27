import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'

export type Employee = {
  id: string
  ime_prezime: string
  rfid_uid: string | null
  username: string
  role: 'admin' | 'employee'
  created_at: string
}

export function useEmployees() {
  return useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const { data, error } = await supabase.from('employees').select('*').order('ime_prezime')
      if (error) throw error
      return data as Employee[]
    },
  })
}

export function useEmployee(id: string) {
  return useQuery({
    queryKey: ['employees', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('employees').select('*').eq('id', id).single()
      if (error) throw error
      return data as Employee
    },
  })
}

async function callManageEmployee(payload: unknown): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage_employee`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify(payload),
    },
  )
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(body.error || 'Greška pri upravljanju zaposlenikom')
  }
}

export type CreateEmployeeInput = { ime_prezime: string; username: string; password: string; rfid_uid?: string; role: 'admin' | 'employee' }
export type UpdateEmployeeInput = { id: string; ime_prezime?: string; rfid_uid?: string; role?: 'admin' | 'employee'; password?: string }

export function useCreateEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateEmployeeInput) => callManageEmployee({ action: 'create', ...input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  })
}

export function useUpdateEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateEmployeeInput) => callManageEmployee({ action: 'update', ...input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  })
}

export function useDeleteEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => callManageEmployee({ action: 'delete', id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  })
}
