# React Admin Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a React admin dashboard for the RFID time-tracking system with employee management, session management, charts, and Excel export.

**Architecture:** Vite + React 19 + TypeScript in `frontend/` subfolder. TanStack Router (file-based routing) for navigation, TanStack Query for server state, Tailwind CSS v4 + shadcn/ui for UI. User management (create/update/delete auth users) routes through a `manage_employee` Supabase Edge Function so the service_role key never touches the browser.

**Tech Stack:** React 19, TypeScript, Vite 6, TanStack Router v1, TanStack Query v5, Tailwind CSS v4, shadcn/ui, Recharts, xlsx, @supabase/supabase-js, Vitest, Vercel

---

## File Structure

```
frontend/
├── src/
│   ├── routes/
│   │   ├── __root.tsx                   # root layout, beforeLoad auth guard, nav
│   │   ├── index.tsx                    # redirect → /dashboard
│   │   ├── login.tsx                    # login form
│   │   ├── dashboard.tsx                # stats, alerts, active sessions
│   │   ├── zaposlenici/
│   │   │   ├── index.tsx                # employee list + delete
│   │   │   ├── novi.tsx                 # add employee form
│   │   │   └── $zaposlenikId.tsx        # edit employee form
│   │   ├── sesije/
│   │   │   ├── index.tsx                # sessions list with month tabs + filters
│   │   │   └── $sessionId.tsx           # edit session form
│   │   └── izvjestaji.tsx               # charts + Excel export
│   ├── lib/
│   │   ├── supabase.ts                  # supabase client singleton
│   │   ├── queries/
│   │   │   ├── employees.ts             # useEmployees, useEmployee, useCreateEmployee, useUpdateEmployee, useDeleteEmployee
│   │   │   ├── sessions.ts              # useActiveSessions, useAutoClosedAlerts, useSessions, useSession, useUpdateSession
│   │   │   └── reports.ts               # useMonthlyReport
│   │   └── utils.ts                     # cn(), formatMinutes(), formatDateTime(), formatDate(), getLast12Months(), formatMonthLabel()
│   ├── components/ui/                   # shadcn/ui (auto-generated, do not edit manually)
│   └── main.tsx                         # QueryClientProvider, RouterProvider, Toaster
├── .env.local                           # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
├── vite.config.ts
└── package.json

supabase/functions/manage_employee/
└── index.ts                             # edge function: create/update/delete auth users
```

---

### Task 1: Scaffold frontend project

**Files:**
- Create: `frontend/` (entire directory)
- Create: `frontend/vite.config.ts`
- Create: `frontend/.env.local`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/index.css`

- [ ] **Step 1: Create Vite project and install dependencies**

```bash
cd /home/antonio/repo/rfid_bp
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install @tanstack/react-router @tanstack/router-plugin
npm install @tanstack/react-query
npm install @supabase/supabase-js
npm install recharts
npm install xlsx
npm install sonner
npm install -D vitest @types/node
```

- [ ] **Step 2: Install and init shadcn/ui**

```bash
cd /home/antonio/repo/rfid_bp/frontend
npx shadcn@latest init
```

Answer prompts:
- Style: **Default**
- Base color: **Slate**
- CSS variables: **Yes**

Then add required components:

```bash
npx shadcn@latest add button card input label badge tabs select dialog alert skeleton
```

- [ ] **Step 3: Write `vite.config.ts`**

```typescript
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [
    TanStackRouterVite({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'node',
  },
})
```

- [ ] **Step 4: Create `.env.local`**

```
VITE_SUPABASE_URL=https://uxobtkrzmxkaiekxkhik.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key-from-supabase-dashboard>
```

Get the anon key: Supabase dashboard → project `uxobtkrzmxkaiekxkhik` → Project Settings → API → **Publishable key**.

- [ ] **Step 5: Write `src/main.tsx`**

```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { routeTree } from './routeTree.gen'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 3, staleTime: 1000 * 60 },
  },
})

const router = createRouter({ routeTree, context: { queryClient } })

declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  </StrictMode>,
)
```

- [ ] **Step 6: Verify dev server starts**

```bash
cd /home/antonio/repo/rfid_bp/frontend
npm run dev
```

Expected: `VITE v6.x.x  ready in Xms` and browser opens at `http://localhost:5173`.

- [ ] **Step 7: Commit**

```bash
cd /home/antonio/repo/rfid_bp
git add frontend/
git commit -m "feat: scaffold frontend project"
```

---

### Task 2: Utility functions with tests

**Files:**
- Modify: `frontend/src/lib/utils.ts` (shadcn created this, we extend it)
- Create: `frontend/src/lib/utils.test.ts`

- [ ] **Step 1: Write failing tests**

Create `frontend/src/lib/utils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { formatMinutes, toMonthString, getLast12Months, formatMonthLabel } from './utils'

describe('formatMinutes', () => {
  it('formats whole hours', () => {
    expect(formatMinutes(480)).toBe('8h')
  })
  it('formats hours and minutes', () => {
    expect(formatMinutes(465)).toBe('7h 45min')
  })
  it('formats zero hours with minutes', () => {
    expect(formatMinutes(30)).toBe('0h 30min')
  })
})

describe('toMonthString', () => {
  it('formats date to YYYY-MM', () => {
    expect(toMonthString(new Date('2026-04-15'))).toBe('2026-04')
  })
})

describe('getLast12Months', () => {
  it('returns 12 months', () => {
    expect(getLast12Months()).toHaveLength(12)
  })
  it('returns YYYY-MM format', () => {
    expect(getLast12Months()[0]).toMatch(/^\d{4}-\d{2}$/)
  })
  it('most recent month is first', () => {
    const months = getLast12Months()
    expect(months[0] > months[1]).toBe(true)
  })
})

describe('formatMonthLabel', () => {
  it('returns Croatian month name', () => {
    expect(formatMonthLabel('2026-04')).toBe('Travanj 2026')
  })
  it('returns correct month for January', () => {
    expect(formatMonthLabel('2026-01')).toBe('Siječanj 2026')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /home/antonio/repo/rfid_bp/frontend
npx vitest run
```

Expected: FAIL — `formatMinutes is not a function` (or similar import errors).

- [ ] **Step 3: Write `src/lib/utils.ts`**

```typescript
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('hr-HR', {
    timeZone: 'Europe/Zagreb',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('hr-HR', {
    timeZone: 'Europe/Zagreb',
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

export function toMonthString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function getLast12Months(): string[] {
  const months: string[] = []
  const d = new Date()
  for (let i = 0; i < 12; i++) {
    months.push(toMonthString(new Date(d.getFullYear(), d.getMonth() - i, 1)))
  }
  return months
}

const MONTHS_HR = [
  'Siječanj', 'Veljača', 'Ožujak', 'Travanj', 'Svibanj', 'Lipanj',
  'Srpanj', 'Kolovoz', 'Rujan', 'Listopad', 'Studeni', 'Prosinac',
]

export function formatMonthLabel(month: string): string {
  const [year, m] = month.split('-')
  return `${MONTHS_HR[parseInt(m) - 1]} ${year}`
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /home/antonio/repo/rfid_bp/frontend
npx vitest run
```

Expected: `4 test files | 9 tests passed`.

- [ ] **Step 5: Commit**

```bash
cd /home/antonio/repo/rfid_bp
git add frontend/src/lib/utils.ts frontend/src/lib/utils.test.ts
git commit -m "feat: add utility functions with vitest tests"
```

---

### Task 3: Supabase client, auth, login page, root layout

**Files:**
- Create: `frontend/src/lib/supabase.ts`
- Create: `frontend/src/routes/__root.tsx`
- Create: `frontend/src/routes/index.tsx`
- Create: `frontend/src/routes/login.tsx`

- [ ] **Step 1: Write `src/lib/supabase.ts`**

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

- [ ] **Step 2: Write `src/routes/__root.tsx`**

```typescript
import { createRootRouteWithContext, Link, Outlet, redirect, useNavigate, useLocation } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

type RouterContext = { queryClient: QueryClient }

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async ({ location }) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session && location.pathname !== '/login') {
      throw redirect({ to: '/login' })
    }
    if (session && location.pathname === '/login') {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: RootLayout,
})

function RootLayout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate({ to: '/login' })
  }

  if (pathname === '/login') return <Outlet />

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex gap-6 items-center">
        <span className="font-semibold text-gray-800 mr-2">RFID BP</span>
        <Link to="/dashboard" className="text-sm text-gray-600 hover:text-gray-900 [&.active]:font-semibold [&.active]:text-gray-900">Dashboard</Link>
        <Link to="/zaposlenici" className="text-sm text-gray-600 hover:text-gray-900 [&.active]:font-semibold [&.active]:text-gray-900">Zaposlenici</Link>
        <Link to="/sesije" className="text-sm text-gray-600 hover:text-gray-900 [&.active]:font-semibold [&.active]:text-gray-900">Sesije</Link>
        <Link to="/izvjestaji" className="text-sm text-gray-600 hover:text-gray-900 [&.active]:font-semibold [&.active]:text-gray-900">Izvještaji</Link>
        <button className="ml-auto text-sm text-gray-600 hover:text-gray-900" onClick={handleSignOut}>
          Odjava
        </button>
      </nav>
      <main className="p-6 max-w-7xl mx-auto">
        <Outlet />
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Write `src/routes/index.tsx`**

```typescript
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  beforeLoad: () => { throw redirect({ to: '/dashboard' }) },
  component: () => null,
})
```

- [ ] **Step 4: Write `src/routes/login.tsx`**

```typescript
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: `${username}@rfid-bp.local`,
      password,
    })
    if (error) {
      setError('Pogrešno korisničko ime ili lozinka')
      setLoading(false)
      return
    }
    navigate({ to: '/dashboard' })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>RFID BP — Prijava</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="username">Korisničko ime</Label>
              <Input id="username" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" required />
            </div>
            <div>
              <Label htmlFor="password">Lozinka</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Prijava...' : 'Prijavi se'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 5: Manually test login**

```bash
cd /home/antonio/repo/rfid_bp/frontend && npm run dev
```

Open http://localhost:5173 → should redirect to `/login`. Log in with `admin` / `ChangeMe123!` → should redirect to `/dashboard` (blank page is fine at this stage). Sign out → should return to `/login`.

- [ ] **Step 6: Commit**

```bash
cd /home/antonio/repo/rfid_bp
git add frontend/src/lib/supabase.ts frontend/src/routes/__root.tsx frontend/src/routes/index.tsx frontend/src/routes/login.tsx
git commit -m "feat: add supabase client, login page, root layout"
```

---

### Task 4: manage_employee Edge Function

**Files:**
- Create: `supabase/functions/manage_employee/index.ts`

- [ ] **Step 1: Write `supabase/functions/manage_employee/index.ts`**

```typescript
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
```

- [ ] **Step 2: Deploy the edge function**

```bash
cd /home/antonio/repo/rfid_bp
npx supabase functions deploy manage_employee
```

Expected: `Deployed Functions on project uxobtkrzmxkaiekxkhik: manage_employee`

- [ ] **Step 3: Test with curl — create employee**

```bash
# Get your access token by logging in
TOKEN=$(curl -s -X POST https://uxobtkrzmxkaiekxkhik.supabase.co/auth/v1/token?grant_type=password \
  -H "apikey: $(grep VITE_SUPABASE_ANON_KEY /home/antonio/repo/rfid_bp/frontend/.env.local | cut -d= -f2)" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@rfid-bp.local","password":"ChangeMe123!"}' | jq -r '.access_token')

curl -i -X POST https://uxobtkrzmxkaiekxkhik.supabase.co/functions/v1/manage_employee \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"create","ime_prezime":"Test Korisnik","username":"test.korisnik","password":"Test1234!","rfid_uid":"TEST-001","role":"employee"}'
```

Expected: `HTTP/2 201` with a JSON body containing `{"id":"..."}`.

- [ ] **Step 4: Clean up test employee**

```bash
# Get the id from the previous response, then:
curl -i -X POST https://uxobtkrzmxkaiekxkhik.supabase.co/functions/v1/manage_employee \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"delete","id":"<id-from-previous-response>"}'
```

Expected: `HTTP/2 200`.

- [ ] **Step 5: Commit**

```bash
cd /home/antonio/repo/rfid_bp
git add supabase/functions/manage_employee/index.ts
git commit -m "feat: add manage_employee edge function"
```

---

### Task 5: Data query hooks

**Files:**
- Create: `frontend/src/lib/queries/employees.ts`
- Create: `frontend/src/lib/queries/sessions.ts`
- Create: `frontend/src/lib/queries/reports.ts`

- [ ] **Step 1: Write `src/lib/queries/employees.ts`**

```typescript
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
    queryFn: async () => {
      const { data, error } = await supabase.from('employees').select('*').eq('id', id).single()
      if (error) throw error
      return data as Employee
    },
  })
}

async function callManageEmployee(payload: unknown): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
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
```

- [ ] **Step 2: Write `src/lib/queries/sessions.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'

export type WorkSession = {
  id: string
  employee_id: string
  clock_in: string
  clock_out: string | null
  duration_min: number | null
  is_auto_closed: boolean
  work_date: string
  created_at: string
  employees?: { ime_prezime: string; username: string }
}

export function useActiveSessions() {
  return useQuery({
    queryKey: ['sessions', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_sessions')
        .select('*, employees(ime_prezime, username)')
        .is('clock_out', null)
        .order('clock_in', { ascending: false })
      if (error) throw error
      return data as WorkSession[]
    },
    refetchInterval: 30_000,
  })
}

export function useAutoClosedAlerts() {
  return useQuery({
    queryKey: ['sessions', 'auto-closed'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_sessions')
        .select('*, employees(ime_prezime, username)')
        .eq('is_auto_closed', true)
        .order('clock_out', { ascending: false })
        .limit(20)
      if (error) throw error
      return data as WorkSession[]
    },
  })
}

export function useSessions(month: string, employeeId?: string) {
  const [year, m] = month.split('-')
  const start = `${month}-01`
  const end = `${month}-${String(new Date(+year, +m, 0).getDate()).padStart(2, '0')}`

  return useQuery({
    queryKey: ['sessions', 'list', month, employeeId ?? 'all'],
    queryFn: async () => {
      let q = supabase
        .from('work_sessions')
        .select('*, employees(ime_prezime, username)')
        .gte('work_date', start)
        .lte('work_date', end)
        .order('work_date', { ascending: false })
      if (employeeId) q = q.eq('employee_id', employeeId)
      const { data, error } = await q
      if (error) throw error
      return data as WorkSession[]
    },
  })
}

export function useSession(id: string) {
  return useQuery({
    queryKey: ['sessions', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_sessions')
        .select('*, employees(ime_prezime, username)')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as WorkSession
    },
  })
}

export function useUpdateSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, clock_in, clock_out }: { id: string; clock_in: string; clock_out: string | null }) => {
      const duration_min = clock_out
        ? Math.round((new Date(clock_out).getTime() - new Date(clock_in).getTime()) / 60_000 / 15) * 15
        : null
      const { error } = await supabase
        .from('work_sessions')
        .update({ clock_in, clock_out, duration_min })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  })
}
```

- [ ] **Step 3: Write `src/lib/queries/reports.ts`**

```typescript
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../supabase'

export type DailyReport = { work_date: string; total_minutes: number }
export type EmployeeReport = { employee_id: string; ime_prezime: string; total_minutes: number }

export function useMonthlyReport(month: string) {
  const [year, m] = month.split('-')
  const start = `${month}-01`
  const end = `${month}-${String(new Date(+year, +m, 0).getDate()).padStart(2, '0')}`

  return useQuery({
    queryKey: ['reports', 'monthly', month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_sessions')
        .select('work_date, duration_min, employee_id, clock_in, clock_out, is_auto_closed, employees(ime_prezime)')
        .gte('work_date', start)
        .lte('work_date', end)
        .not('clock_out', 'is', null)
      if (error) throw error

      const byDay: Record<string, number> = {}
      const byEmp: Record<string, { ime_prezime: string; total_minutes: number }> = {}

      for (const s of data as any[]) {
        byDay[s.work_date] = (byDay[s.work_date] ?? 0) + (s.duration_min ?? 0)
        if (!byEmp[s.employee_id]) byEmp[s.employee_id] = { ime_prezime: s.employees.ime_prezime, total_minutes: 0 }
        byEmp[s.employee_id].total_minutes += s.duration_min ?? 0
      }

      const daily: DailyReport[] = Object.entries(byDay)
        .map(([work_date, total_minutes]) => ({ work_date, total_minutes }))
        .sort((a, b) => a.work_date.localeCompare(b.work_date))

      const employees: EmployeeReport[] = Object.entries(byEmp)
        .map(([employee_id, v]) => ({ employee_id, ...v }))
        .sort((a, b) => b.total_minutes - a.total_minutes)

      return { daily, employees, rawSessions: data as any[] }
    },
  })
}
```

- [ ] **Step 4: Commit**

```bash
cd /home/antonio/repo/rfid_bp
git add frontend/src/lib/queries/
git commit -m "feat: add query hooks for employees, sessions, reports"
```

---

### Task 6: Dashboard page

**Files:**
- Create: `frontend/src/routes/dashboard.tsx`

- [ ] **Step 1: Write `src/routes/dashboard.tsx`**

```typescript
import { createFileRoute, Link } from '@tanstack/react-router'
import { useActiveSessions, useAutoClosedAlerts } from '../lib/queries/sessions'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Skeleton } from '../components/ui/skeleton'
import { formatDateTime } from '../lib/utils'

export const Route = createFileRoute('/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  const { data: activeSessions, isLoading: loadingActive } = useActiveSessions()
  const { data: alerts, isLoading: loadingAlerts } = useAutoClosedAlerts()

  const today = new Date().toISOString().split('T')[0]
  const todayCount = activeSessions?.filter(s => s.work_date === today).length ?? 0

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Aktivni danas</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingActive ? <Skeleton className="h-8 w-12" /> : <p className="text-3xl font-bold">{todayCount}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Trenutno na poslu</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingActive ? <Skeleton className="h-8 w-12" /> : <p className="text-3xl font-bold">{activeSessions?.length ?? 0}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Auto-zatvorene sesije</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingAlerts ? <Skeleton className="h-8 w-12" /> : (
              <p className={`text-3xl font-bold ${(alerts?.length ?? 0) > 0 ? 'text-orange-500' : ''}`}>
                {alerts?.length ?? 0}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {(alerts?.length ?? 0) > 0 && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertDescription>
            <p className="font-medium text-orange-800 mb-2">
              {alerts!.length} {alerts!.length === 1 ? 'sesija automatski zatvorena' : 'sesija automatski zatvoreno'} — potrebna provjera
            </p>
            <div className="space-y-1">
              {alerts!.map(s => (
                <Link
                  key={s.id}
                  to="/sesije/$sessionId"
                  params={{ sessionId: s.id }}
                  className="block text-sm text-orange-700 hover:underline"
                >
                  {s.employees?.ime_prezime} — {formatDateTime(s.clock_in)} → {s.clock_out ? formatDateTime(s.clock_out) : '—'}
                </Link>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Trenutno na poslu</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingActive ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (activeSessions?.length ?? 0) === 0 ? (
            <p className="text-gray-500 text-sm">Nitko trenutno nije na poslu.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium text-gray-500">Zaposlenik</th>
                  <th className="text-left py-2 font-medium text-gray-500">Dolazak</th>
                </tr>
              </thead>
              <tbody>
                {activeSessions!.map(s => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="py-2">{s.employees?.ime_prezime}</td>
                    <td className="py-2">{formatDateTime(s.clock_in)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Manually test dashboard**

Open http://localhost:5173/dashboard. Expected:
- Three stat cards visible with numbers (may be 0)
- No orange alert banner if no auto-closed sessions
- "Nitko trenutno nije na poslu." if no active sessions

- [ ] **Step 3: Commit**

```bash
cd /home/antonio/repo/rfid_bp
git add frontend/src/routes/dashboard.tsx
git commit -m "feat: add dashboard page"
```

---

### Task 7: Employee management pages

**Files:**
- Create: `frontend/src/routes/zaposlenici/index.tsx`
- Create: `frontend/src/routes/zaposlenici/novi.tsx`
- Create: `frontend/src/routes/zaposlenici/$zaposlenikId.tsx`

- [ ] **Step 1: Write `src/routes/zaposlenici/index.tsx`**

```typescript
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { useEmployees, useDeleteEmployee } from '../../lib/queries/employees'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Skeleton } from '../../components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog'

export const Route = createFileRoute('/zaposlenici/')({
  component: ZaposlednikListPage,
})

function ZaposlednikListPage() {
  const { data: employees, isLoading } = useEmployees()
  const deleteEmployee = useDeleteEmployee()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const toDelete = employees?.find(e => e.id === deleteId)

  async function handleDelete() {
    if (!deleteId) return
    try {
      await deleteEmployee.mutateAsync(deleteId)
      toast.success('Zaposlenik obrisan')
      setDeleteId(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Greška pri brisanju')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Zaposlenici</h1>
        <Button asChild><Link to="/zaposlenici/novi">Dodaj zaposlenika</Link></Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : (employees?.length ?? 0) === 0 ? (
        <p className="text-gray-500 text-sm">Nema zaposlenika. <Link to="/zaposlenici/novi" className="underline">Dodaj prvog.</Link></p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 font-medium text-gray-500">Ime i prezime</th>
              <th className="text-left py-2 font-medium text-gray-500">Username</th>
              <th className="text-left py-2 font-medium text-gray-500">RFID UID</th>
              <th className="text-left py-2 font-medium text-gray-500">Uloga</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {employees!.map(emp => (
              <tr key={emp.id} className="border-b last:border-0">
                <td className="py-2">{emp.ime_prezime}</td>
                <td className="py-2 text-gray-500">{emp.username}</td>
                <td className="py-2 text-gray-500 font-mono text-xs">{emp.rfid_uid ?? '—'}</td>
                <td className="py-2">
                  <Badge variant={emp.role === 'admin' ? 'default' : 'secondary'}>
                    {emp.role === 'admin' ? 'Admin' : 'Zaposlenik'}
                  </Badge>
                </td>
                <td className="py-2 text-right space-x-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/zaposlenici/$zaposlenikId" params={{ zaposlenikId: emp.id }}>Uredi</Link>
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => setDeleteId(emp.id)}>Briši</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Dialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Brisanje zaposlenika</DialogTitle>
            <DialogDescription>
              Sigurno želiš obrisati <strong>{toDelete?.ime_prezime}</strong>? Briše se i sva evidencija radnog vremena. Ako zaposlenik ima otvorenu sesiju, bit će automatski zatvorena.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Odustani</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteEmployee.isPending}>
              {deleteEmployee.isPending ? 'Brisanje...' : 'Obriši'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 2: Write `src/routes/zaposlenici/novi.tsx`**

```typescript
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { useCreateEmployee } from '../../lib/queries/employees'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Card, CardContent } from '../../components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'

export const Route = createFileRoute('/zaposlenici/novi')({
  component: NoviZaposlenikPage,
})

function NoviZaposlenikPage() {
  const navigate = useNavigate()
  const createEmployee = useCreateEmployee()
  const [form, setForm] = useState({ ime_prezime: '', username: '', password: '', rfid_uid: '', role: 'employee' as 'admin' | 'employee' })
  const [error, setError] = useState<string | null>(null)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await createEmployee.mutateAsync({ ...form, rfid_uid: form.rfid_uid || undefined })
      toast.success('Zaposlenik dodan')
      navigate({ to: '/zaposlenici' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Greška')
    }
  }

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-bold mb-6">Dodaj zaposlenika</h1>
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><Label htmlFor="ime">Ime i prezime *</Label><Input id="ime" value={form.ime_prezime} onChange={set('ime_prezime')} required /></div>
            <div><Label htmlFor="uname">Korisničko ime *</Label><Input id="uname" value={form.username} onChange={set('username')} required /></div>
            <div><Label htmlFor="pw">Lozinka *</Label><Input id="pw" type="password" value={form.password} onChange={set('password')} required /></div>
            <div>
              <Label htmlFor="rfid">RFID UID <span className="text-gray-400">(opcionalno za admin)</span></Label>
              <Input id="rfid" value={form.rfid_uid} onChange={set('rfid_uid')} placeholder="npr. A1B2C3D4" />
            </div>
            <div>
              <Label>Uloga *</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v as 'admin' | 'employee' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Zaposlenik</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={createEmployee.isPending}>{createEmployee.isPending ? 'Dodavanje...' : 'Dodaj'}</Button>
              <Button type="button" variant="outline" onClick={() => navigate({ to: '/zaposlenici' })}>Odustani</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Write `src/routes/zaposlenici/$zaposlenikId.tsx`**

```typescript
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useEmployee, useUpdateEmployee } from '../../lib/queries/employees'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Card, CardContent } from '../../components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { Skeleton } from '../../components/ui/skeleton'

export const Route = createFileRoute('/zaposlenici/$zaposlenikId')({
  component: EditZaposlenikPage,
})

function EditZaposlenikPage() {
  const { zaposlenikId } = Route.useParams()
  const navigate = useNavigate()
  const { data: emp, isLoading } = useEmployee(zaposlenikId)
  const updateEmployee = useUpdateEmployee()
  const [form, setForm] = useState({ ime_prezime: '', rfid_uid: '', role: 'employee' as 'admin' | 'employee', password: '' })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (emp) setForm({ ime_prezime: emp.ime_prezime, rfid_uid: emp.rfid_uid ?? '', role: emp.role, password: '' })
  }, [emp])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await updateEmployee.mutateAsync({ id: zaposlenikId, ime_prezime: form.ime_prezime, rfid_uid: form.rfid_uid || undefined, role: form.role, password: form.password || undefined })
      toast.success('Zaposlenik ažuriran')
      navigate({ to: '/zaposlenici' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Greška')
    }
  }

  if (isLoading) return <Skeleton className="h-64 w-full max-w-md" />

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-bold mb-6">Uredi zaposlenika</h1>
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><Label htmlFor="ime">Ime i prezime *</Label><Input id="ime" value={form.ime_prezime} onChange={set('ime_prezime')} required /></div>
            <div>
              <Label htmlFor="rfid">RFID UID <span className="text-gray-400">(opcionalno za admin)</span></Label>
              <Input id="rfid" value={form.rfid_uid} onChange={set('rfid_uid')} />
            </div>
            <div>
              <Label>Uloga *</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v as 'admin' | 'employee' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Zaposlenik</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="pw">Nova lozinka <span className="text-gray-400">(prazno = bez promjene)</span></Label>
              <Input id="pw" type="password" value={form.password} onChange={set('password')} />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={updateEmployee.isPending}>{updateEmployee.isPending ? 'Spremanje...' : 'Spremi'}</Button>
              <Button type="button" variant="outline" onClick={() => navigate({ to: '/zaposlenici' })}>Odustani</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: Manually test employee management**

Navigate to http://localhost:5173/zaposlenici. Test:
- List shows the admin user
- "Dodaj zaposlenika" → fill form → submit → user appears in list
- "Uredi" → change ime_prezime → save → list updated
- "Briši" → confirm dialog → user removed from list

- [ ] **Step 5: Commit**

```bash
cd /home/antonio/repo/rfid_bp
git add frontend/src/routes/zaposlenici/
git commit -m "feat: add employee management pages"
```

---

### Task 8: Session management pages

**Files:**
- Create: `frontend/src/routes/sesije/index.tsx`
- Create: `frontend/src/routes/sesije/$sessionId.tsx`

- [ ] **Step 1: Write `src/routes/sesije/index.tsx`**

```typescript
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useEmployees } from '../../lib/queries/employees'
import { useSessions } from '../../lib/queries/sessions'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Skeleton } from '../../components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { getLast12Months, formatMonthLabel, formatDate, formatDateTime, formatMinutes } from '../../lib/utils'

export const Route = createFileRoute('/sesije/')({
  component: SesijeListPage,
})

const MONTHS = getLast12Months()

function SesijeListPage() {
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[0])
  const [employeeFilter, setEmployeeFilter] = useState('all')
  const { data: employees } = useEmployees()
  const { data: sessions, isLoading } = useSessions(selectedMonth, employeeFilter !== 'all' ? employeeFilter : undefined)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Sesije</h1>
        <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Svi zaposlenici" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Svi zaposlenici</SelectItem>
            {employees?.map(e => <SelectItem key={e.id} value={e.id}>{e.ime_prezime}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={selectedMonth} onValueChange={setSelectedMonth}>
        <TabsList className="flex flex-wrap h-auto gap-1 justify-start">
          {MONTHS.map(m => (
            <TabsTrigger key={m} value={m} className="text-xs">{formatMonthLabel(m)}</TabsTrigger>
          ))}
        </TabsList>

        {MONTHS.map(m => (
          <TabsContent key={m} value={m} className="mt-4">
            {isLoading ? (
              <div className="space-y-2">{[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : (sessions?.length ?? 0) === 0 ? (
              <p className="text-gray-500 text-sm py-4">Nema sesija za ovaj period.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium text-gray-500">Datum</th>
                    <th className="text-left py-2 font-medium text-gray-500">Zaposlenik</th>
                    <th className="text-left py-2 font-medium text-gray-500">Dolazak</th>
                    <th className="text-left py-2 font-medium text-gray-500">Odlazak</th>
                    <th className="text-left py-2 font-medium text-gray-500">Trajanje</th>
                    <th className="text-left py-2 font-medium text-gray-500">Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {sessions!.map(s => (
                    <tr key={s.id} className="border-b last:border-0">
                      <td className="py-2">{formatDate(s.work_date)}</td>
                      <td className="py-2">{s.employees?.ime_prezime}</td>
                      <td className="py-2">{formatDateTime(s.clock_in)}</td>
                      <td className="py-2">{s.clock_out ? formatDateTime(s.clock_out) : <span className="text-orange-500">—</span>}</td>
                      <td className="py-2">{s.duration_min != null ? formatMinutes(s.duration_min) : '—'}</td>
                      <td className="py-2">
                        {s.is_auto_closed && <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs">auto</Badge>}
                      </td>
                      <td className="py-2 text-right">
                        <Button variant="outline" size="sm" asChild>
                          <Link to="/sesije/$sessionId" params={{ sessionId: s.id }}>Uredi</Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 2: Write `src/routes/sesije/$sessionId.tsx`**

```typescript
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useSession, useUpdateSession } from '../../lib/queries/sessions'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Card, CardContent } from '../../components/ui/card'
import { Badge } from '../../components/ui/badge'
import { Skeleton } from '../../components/ui/skeleton'

export const Route = createFileRoute('/sesije/$sessionId')({
  component: EditSesijaPage,
})

function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function EditSesijaPage() {
  const { sessionId } = Route.useParams()
  const navigate = useNavigate()
  const { data: session, isLoading } = useSession(sessionId)
  const updateSession = useUpdateSession()
  const [clockIn, setClockIn] = useState('')
  const [clockOut, setClockOut] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (session) {
      setClockIn(toLocalInput(session.clock_in))
      setClockOut(session.clock_out ? toLocalInput(session.clock_out) : '')
    }
  }, [session])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (clockOut && new Date(clockOut) <= new Date(clockIn)) {
      setError('Odlazak mora biti nakon dolaska')
      return
    }
    try {
      await updateSession.mutateAsync({
        id: sessionId,
        clock_in: new Date(clockIn).toISOString(),
        clock_out: clockOut ? new Date(clockOut).toISOString() : null,
      })
      toast.success('Sesija ažurirana')
      navigate({ to: '/sesije' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Greška')
    }
  }

  if (isLoading) return <Skeleton className="h-64 w-full max-w-md" />

  return (
    <div className="max-w-md">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">Uredi sesiju</h1>
        {session?.is_auto_closed && (
          <Badge variant="outline" className="text-orange-600 border-orange-300">auto-zatvoreno</Badge>
        )}
      </div>
      {session && <p className="text-gray-500 mb-4">{session.employees?.ime_prezime}</p>}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="ci">Dolazak *</Label>
              <Input id="ci" type="datetime-local" value={clockIn} onChange={e => setClockIn(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="co">Odlazak <span className="text-gray-400">(prazno = još na poslu)</span></Label>
              <Input id="co" type="datetime-local" value={clockOut} onChange={e => setClockOut(e.target.value)} />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={updateSession.isPending}>{updateSession.isPending ? 'Spremanje...' : 'Spremi'}</Button>
              <Button type="button" variant="outline" onClick={() => navigate({ to: '/sesije' })}>Odustani</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Manually test sessions**

Navigate to http://localhost:5173/sesije. Test:
- Month tabs visible, current month selected
- Employee filter dropdown works
- If any sessions exist, rows show with correct data
- Click "Uredi" → form opens with pre-filled times → save → success toast

- [ ] **Step 4: Commit**

```bash
cd /home/antonio/repo/rfid_bp
git add frontend/src/routes/sesije/
git commit -m "feat: add session management pages"
```

---

### Task 9: Reports page

**Files:**
- Create: `frontend/src/routes/izvjestaji.tsx`

- [ ] **Step 1: Write `src/routes/izvjestaji.tsx`**

```typescript
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import * as XLSX from 'xlsx'
import { useMonthlyReport } from '../lib/queries/reports'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Skeleton } from '../components/ui/skeleton'
import { supabase } from '../lib/supabase'
import { getLast12Months, formatMonthLabel, formatDate, formatDateTime } from '../lib/utils'

export const Route = createFileRoute('/izvjestaji')({
  component: IzvjestajiPage,
})

const MONTHS = getLast12Months()

function IzvjestajiPage() {
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[0])
  const { data, isLoading } = useMonthlyReport(selectedMonth)

  const dailyData = data?.daily.map(d => ({
    dan: d.work_date.split('-')[2],
    sati: +(d.total_minutes / 60).toFixed(1),
  })) ?? []

  const empData = data?.employees.map(e => ({
    ime: e.ime_prezime.split(' ')[0],
    sati: +(e.total_minutes / 60).toFixed(1),
  })) ?? []

  function exportMonth() {
    if (!data) return
    const rows = data.rawSessions.map((s: any) => ({
      Datum: formatDate(s.work_date),
      Zaposlenik: s.employees?.ime_prezime ?? '',
      Dolazak: formatDateTime(s.clock_in),
      Odlazak: s.clock_out ? formatDateTime(s.clock_out) : '',
      'Trajanje (min)': s.duration_min ?? '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, formatMonthLabel(selectedMonth))
    XLSX.writeFile(wb, `evidencija-${selectedMonth}.xlsx`)
  }

  async function exportYear() {
    const wb = XLSX.utils.book_new()
    for (const month of [...MONTHS].reverse()) {
      const [year, m] = month.split('-')
      const start = `${month}-01`
      const end = `${month}-${String(new Date(+year, +m, 0).getDate()).padStart(2, '0')}`
      const { data: sessions } = await supabase
        .from('work_sessions')
        .select('work_date, clock_in, clock_out, duration_min, employees(ime_prezime)')
        .gte('work_date', start)
        .lte('work_date', end)
        .not('clock_out', 'is', null)

      const rows = (sessions ?? []).map((s: any) => ({
        Datum: formatDate(s.work_date),
        Zaposlenik: s.employees?.ime_prezime ?? '',
        Dolazak: formatDateTime(s.clock_in),
        Odlazak: s.clock_out ? formatDateTime(s.clock_out) : '',
        'Trajanje (min)': s.duration_min ?? '',
      }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), formatMonthLabel(month))
    }
    XLSX.writeFile(wb, `evidencija-${new Date().getFullYear()}.xlsx`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold">Izvještaji</h1>
        <div className="flex gap-2 flex-wrap items-center">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map(m => <SelectItem key={m} value={m}>{formatMonthLabel(m)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportMonth} disabled={!data || isLoading}>Izvezi mjesec</Button>
          <Button variant="outline" onClick={exportYear}>Izvezi godinu</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sati po danu — {formatMonthLabel(selectedMonth)}</CardTitle>
            </CardHeader>
            <CardContent>
              {dailyData.length === 0 ? (
                <p className="text-gray-500 text-sm">Nema podataka za ovaj mjesec.</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="dan" tick={{ fontSize: 12 }} />
                    <YAxis unit="h" tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: number) => [`${v}h`, 'Ukupno']} />
                    <Bar dataKey="sati" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sati po zaposleniku — {formatMonthLabel(selectedMonth)}</CardTitle>
            </CardHeader>
            <CardContent>
              {empData.length === 0 ? (
                <p className="text-gray-500 text-sm">Nema podataka za ovaj mjesec.</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={empData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="ime" tick={{ fontSize: 12 }} />
                    <YAxis unit="h" tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: number) => [`${v}h`, 'Ukupno']} />
                    <Bar dataKey="sati" fill="#10b981" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Manually test reports**

Navigate to http://localhost:5173/izvjestaji. Test:
- Month picker changes data
- Charts render (may be empty if no sessions yet)
- "Izvezi mjesec" downloads an `.xlsx` file — open in Excel/LibreOffice and verify columns
- "Izvezi godinu" downloads a yearly file with 12 sheets

- [ ] **Step 3: Commit**

```bash
cd /home/antonio/repo/rfid_bp
git add frontend/src/routes/izvjestaji.tsx
git commit -m "feat: add reports page with charts and Excel export"
```

---

### Task 10: Vercel deploy

**Files:**
- Create: `frontend/vercel.json`

- [ ] **Step 1: Create `frontend/vercel.json`**

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

This ensures client-side routing works on page refresh.

- [ ] **Step 2: Push to GitHub**

```bash
cd /home/antonio/repo/rfid_bp
git push origin master
```

If `origin` is not set, add it first:
```bash
git remote add origin https://github.com/AntonioB27/<repo-name>.git
git push -u origin master
```

- [ ] **Step 3: Deploy on Vercel**

1. Go to https://vercel.com → **Add New Project**
2. Import the GitHub repository
3. Set **Root Directory** to `frontend`
4. Add environment variables:
   - `VITE_SUPABASE_URL` = `https://uxobtkrzmxkaiekxkhik.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `<publishable-key-from-supabase-dashboard>`
5. Click **Deploy**

Expected: build succeeds, app available at `https://<project-name>.vercel.app`.

- [ ] **Step 4: Test production deploy**

Open the Vercel URL. Test:
- Login works with `admin` / `ChangeMe123!`
- All four nav links work
- Dashboard loads stat cards
- Employee management works (add, edit, delete)
- Sessions list works
- Reports page loads charts

- [ ] **Step 5: Commit**

```bash
cd /home/antonio/repo/rfid_bp
git add frontend/vercel.json
git commit -m "feat: add vercel.json for SPA routing"
```
