# RFID BP — Full Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 3 data bugs, add manual session management, role-based route guards, self-service password change, employee search, device authentication, and ESP32 NTP drift fix across all three system layers.

**Architecture:** Changes are grouped into four areas — DB migrations (new index, RLS INSERT policy, device secret), React frontend (bug fixes + new screens), and ESP32 firmware (device secret header + daily NTP re-sync). Each area is independently testable. Frontend changes require `npm run dev` after adding new route files to regenerate `routeTree.gen.ts`.

**Tech Stack:** Supabase Postgres (pgTAP, `supabase db push`), React 19 + TanStack Router v1, TanStack Query v5, Vitest, ESP32 Arduino/PlatformIO.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `supabase/migrations/20260507100000_work_date_index_and_admin_insert.sql` | Create | `work_date` composite index + admin INSERT RLS |
| `supabase/migrations/20260507100001_device_secret.sql` | Create | Adds optional `p_secret` param to `handle_rfid_scan` |
| `supabase/tests/session_insert.test.sql` | Create | pgTAP: admin can insert, employee cannot |
| `supabase/tests/device_secret.test.sql` | Create | pgTAP: wrong secret returns `unauthorized` |
| `frontend/src/lib/queries/sessions.ts` | Modify | Fix `useAutoClosedAlerts`; add `useCreateSession`, `useDeleteSession`, `useSessionsRange` |
| `frontend/src/routes/__root.tsx` | Modify | Role-split nav (admin vs employee); `UserCircle` import |
| `frontend/src/routes/dashboard.tsx` | Modify | Fix week/month boundary for `weekMins`; fix recent sessions cross-month |
| `frontend/src/routes/sesije/$sessionId.tsx` | Modify | Add delete button + confirmation dialog |
| `frontend/src/routes/sesije/index.tsx` | Modify | Auto-filter sessions for employees; admin-only filter + "Nova sesija" button |
| `frontend/src/routes/sesije/nova.tsx` | Create | Manual session creation form (admin only) |
| `frontend/src/routes/izvjestaji.tsx` | Modify | Parallelize year export; full names in employee chart |
| `frontend/src/routes/zaposlenici/index.tsx` | Modify | Add name/username/RFID live search |
| `frontend/src/routes/zaposlenici/$zaposlenikId.tsx` | Modify | Add `beforeLoad` admin guard |
| `frontend/src/routes/zaposlenici/novi.tsx` | Modify | Add `beforeLoad` admin guard |
| `frontend/src/routes/profil.tsx` | Create | Self-service password change for all users |
| `esp32/src/storage.h` | Modify | Add `device_secret[64]` to `Config` struct |
| `esp32/src/storage.cpp` | Modify | Load/save `device_secret` |
| `esp32/src/wifi_mgr.cpp` | Modify | Add device_secret portal field |
| `esp32/src/http_client.h` | Modify | Add `deviceSecret` param to `httpSendScan` |
| `esp32/src/http_client.cpp` | Modify | Include `p_secret` in RPC body |
| `esp32/src/main.cpp` | Modify | Pass `device_secret`; daily NTP re-sync |

---

## Task 1: DB — work_date composite index + admin INSERT policy

**Files:**
- Create: `supabase/migrations/20260507100000_work_date_index_and_admin_insert.sql`
- Create: `supabase/tests/session_insert.test.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260507100000_work_date_index_and_admin_insert.sql

-- Speeds up month-range queries used by useSessions and useMonthlyReport
CREATE INDEX work_sessions_work_date_idx
  ON work_sessions (employee_id, work_date DESC);

-- Allow admins to manually insert sessions.
-- handle_rfid_scan uses SECURITY DEFINER and bypasses RLS — this policy is for the manual creation screen only.
CREATE POLICY "sessions_insert" ON work_sessions
  FOR INSERT TO authenticated WITH CHECK (is_admin());
```

- [ ] **Step 2: Write the pgTAP test**

```sql
-- supabase/tests/session_insert.test.sql
BEGIN;
SELECT plan(3);

INSERT INTO auth.users (id, email, aud, role, encrypted_password,
                        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin@rfid-bp.local',
   'authenticated', 'authenticated', '', now(), '{}', '{}', now(), now()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'emp@rfid-bp.local',
   'authenticated', 'authenticated', '', now(), '{}', '{}', now(), now());

INSERT INTO employees (id, ime_prezime, rfid_uid, username, role)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Admin Admin', 'CARD-ADMIN', 'admin', 'admin'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Emp Empić',   'CARD-EMP',   'emp',   'employee');

-- Test 1: Admin can insert a session
SET LOCAL role TO authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

SELECT lives_ok(
  $$INSERT INTO work_sessions (employee_id, clock_in, work_date)
    VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            '2026-05-01 08:00:00+00', '2026-05-01')$$,
  'Admin može insertati sesiju'
);

-- Test 2: Employee cannot insert a session
SET LOCAL "request.jwt.claims" TO '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"}';

SELECT throws_ok(
  $$INSERT INTO work_sessions (employee_id, clock_in, work_date)
    VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            '2026-05-01 09:00:00+00', '2026-05-01')$$,
  'new row violates row-level security policy for table "work_sessions"',
  'Zaposlenik ne može insertati sesiju'
);

-- Test 3: Index exists
SELECT has_index(
  'public', 'work_sessions', 'work_sessions_work_date_idx',
  'Index work_sessions_work_date_idx postoji'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 3: Apply migration and run tests**

```bash
cd /home/antonio/repo/rfid_bp
supabase db push
supabase test db --db-url "$(cat supabase/.temp/pooler-url)"
```

Expected: all tests pass including the 3 new ones in `session_insert.test.sql`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260507100000_work_date_index_and_admin_insert.sql \
        supabase/tests/session_insert.test.sql
git commit -m "feat(db): work_date index and admin INSERT policy for sessions"
```

---

## Task 2: DB — device secret parameter on handle_rfid_scan

**Files:**
- Create: `supabase/migrations/20260507100001_device_secret.sql`
- Create: `supabase/tests/device_secret.test.sql`

- [ ] **Step 1: Write the migration**

The secret is stored as a database-level config parameter (`app.device_secret`). Empty value disables the check so existing firmware keeps working until updated.

```sql
-- supabase/migrations/20260507100001_device_secret.sql

-- Set a real value in production via:
--   ALTER DATABASE postgres SET app.device_secret TO 'your-secret-here';
ALTER DATABASE postgres SET app.device_secret TO '';

CREATE OR REPLACE FUNCTION handle_rfid_scan(
  p_uid        text,
  p_scanned_at timestamptz DEFAULT now(),
  p_secret     text        DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_expected text;
  v_employee employees%ROWTYPE;
  v_session  work_sessions%ROWTYPE;
  v_duration integer;
BEGIN
  v_expected := current_setting('app.device_secret', true);
  IF v_expected IS NOT NULL AND v_expected <> '' THEN
    IF p_secret IS DISTINCT FROM v_expected THEN
      RETURN jsonb_build_object('status', 'unauthorized');
    END IF;
  END IF;

  SELECT * INTO v_employee FROM employees WHERE rfid_uid = p_uid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  SELECT * INTO v_session
  FROM work_sessions
  WHERE employee_id = v_employee.id AND clock_out IS NULL
  ORDER BY clock_in DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO work_sessions (employee_id, clock_in, work_date)
    VALUES (v_employee.id, p_scanned_at, (p_scanned_at AT TIME ZONE 'Europe/Zagreb')::date);
    RETURN jsonb_build_object('status', 'clock_in', 'ime', v_employee.ime_prezime);
  END IF;

  IF p_scanned_at - v_session.clock_in < interval '60 minutes' THEN
    RETURN jsonb_build_object('status', 'too_soon');
  END IF;

  v_duration := ROUND(
    EXTRACT(EPOCH FROM (p_scanned_at - v_session.clock_in)) / 60.0 / 15.0
  ) * 15;

  UPDATE work_sessions
  SET clock_out    = p_scanned_at,
      duration_min = v_duration,
      work_date    = (v_session.clock_in AT TIME ZONE 'Europe/Zagreb')::date
  WHERE id = v_session.id;

  RETURN jsonb_build_object(
    'status',       'clock_out',
    'ime',          v_employee.ime_prezime,
    'duration_min', v_duration
  );
END;
$$;

-- Grant both the old 2-arg and new 3-arg signatures so old firmware still works
GRANT EXECUTE ON FUNCTION handle_rfid_scan(text, timestamptz)       TO anon;
GRANT EXECUTE ON FUNCTION handle_rfid_scan(text, timestamptz, text) TO anon;
```

- [ ] **Step 2: Write the pgTAP test**

```sql
-- supabase/tests/device_secret.test.sql
BEGIN;
SELECT plan(3);

INSERT INTO auth.users (id, email, aud, role, encrypted_password,
                        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at)
VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'dev@rfid-bp.local',
        'authenticated', 'authenticated', '', now(), '{}', '{}', now(), now());

INSERT INTO employees (id, ime_prezime, rfid_uid, username, role)
VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Device Test', 'CARD-DEV', 'dev.test', 'employee');

-- Test 1: When secret is empty (default), scan works without secret
SELECT is(
  (handle_rfid_scan('CARD-DEV', now(), NULL))->>'status',
  'clock_in',
  'Prazan secret → scan radi bez tajnog ključa'
);

DELETE FROM work_sessions WHERE employee_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

-- Test 2: When secret is set, wrong secret → unauthorized
SET LOCAL app.device_secret = 'correct-secret';
SELECT is(
  (handle_rfid_scan('CARD-DEV', now(), 'wrong-secret'))->>'status',
  'unauthorized',
  'Krivi tajni ključ → unauthorized'
);

-- Test 3: Correct secret → clock_in
SELECT is(
  (handle_rfid_scan('CARD-DEV', now(), 'correct-secret'))->>'status',
  'clock_in',
  'Ispravan tajni ključ → clock_in'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 3: Apply and test**

```bash
supabase db push
supabase test db --db-url "$(cat supabase/.temp/pooler-url)"
```

Expected: all 3 device_secret tests pass.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260507100001_device_secret.sql \
        supabase/tests/device_secret.test.sql
git commit -m "feat(db): optional device secret on handle_rfid_scan"
```

---

## Task 3: Fix useAutoClosedAlerts — filter to current week

**Files:**
- Modify: `frontend/src/lib/queries/sessions.ts`
- Modify: `frontend/src/routes/dashboard.tsx`

`useAutoClosedAlerts` fetches all-time auto-closed sessions but the stat box labels the count "ovaj tjedan". Fix: accept an optional `since: Date` filter and pass Monday 00:00 of the current week.

- [ ] **Step 1: Update useAutoClosedAlerts in sessions.ts**

Replace lines 32–47 (the existing `useAutoClosedAlerts` function):

```ts
export function useAutoClosedAlerts(since?: Date) {
  return useQuery({
    queryKey: ['sessions', 'auto-closed', since?.toISOString() ?? 'all'],
    queryFn: async () => {
      let q = supabase
        .from('work_sessions')
        .select('*, employees(ime_prezime, username)')
        .eq('is_auto_closed', true)
        .order('clock_out', { ascending: false })
        .limit(20)
      if (since) q = q.gte('clock_out', since.toISOString())
      const { data, error } = await q
      if (error) throw error
      return data as WorkSession[]
    },
    refetchInterval: 10_000,
  })
}
```

- [ ] **Step 2: Pass week start from AdminDashboard**

In `frontend/src/routes/dashboard.tsx`, replace lines 59–66 (the first 8 lines of `AdminDashboard`):

```tsx
function AdminDashboard() {
  const { data: activeSessions, isLoading: loadingActive } = useActiveSessions()
  const clockOut = useClockOutSession()
  const today = new Date()
  const weekDay = today.getDay() === 0 ? 6 : today.getDay() - 1
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - weekDay)
  weekStart.setHours(0, 0, 0, 0)
  const { data: alerts, isLoading: loadingAlerts } = useAutoClosedAlerts(weekStart)
  const todayStr = `${toMonthString(today)}-${String(today.getDate()).padStart(2, '0')}`
  const { data: todaySessions } = useSessions(toMonthString(today))
  const todayCount = todaySessions?.filter(s => s.work_date === todayStr).length
```

- [ ] **Step 3: Verify in browser**

```bash
cd frontend && npm run dev
```

Open http://localhost:5173/dashboard as admin. The "Auto-zatvorene sesije" count should now show 0 if no auto-closes happened this calendar week.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/queries/sessions.ts frontend/src/routes/dashboard.tsx
git commit -m "fix: auto-closed alerts stat now filtered to current week"
```

---

## Task 4: Fix employee dashboard week/month boundary bug

**Files:**
- Modify: `frontend/src/lib/queries/sessions.ts`
- Modify: `frontend/src/routes/dashboard.tsx`

`EmployeeDashboard` calls `useSessions(toMonthString(today))` — current month only. If today is May 3 and the week started April 28, those Monday–Tuesday hours are invisible. Fix: add `useSessionsRange` that merges two months when the week spans a boundary.

- [ ] **Step 1: Add useSessionsRange to sessions.ts**

Add these at the bottom of `frontend/src/lib/queries/sessions.ts` (before the final blank line):

```ts
function monthStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function useSessionsRange(from: Date, to: Date, employeeId?: string) {
  const fromMonth = monthStr(from)
  const toMonth   = monthStr(to)
  const q1 = useSessions(fromMonth, employeeId)
  const q2 = useSessions(toMonth,   employeeId)

  const combined = React.useMemo(() => {
    if (fromMonth === toMonth) return q1.data
    const merged = [...(q1.data ?? []), ...(q2.data ?? [])]
    const seen = new Set<string>()
    return merged.filter(s => { if (seen.has(s.id)) return false; seen.add(s.id); return true })
  }, [q1.data, q2.data, fromMonth, toMonth])

  return { data: combined, isLoading: q1.isLoading || q2.isLoading }
}
```

Also add `import React from 'react'` at the top of `sessions.ts` if not already present.

- [ ] **Step 2: Update the import in dashboard.tsx**

In `frontend/src/routes/dashboard.tsx`, update the sessions import line:

```ts
import { useActiveSessions, useAutoClosedAlerts, useSessions, useClockOutSession, useSessionsRange } from '../lib/queries/sessions'
```

- [ ] **Step 3: Replace EmployeeDashboard opening (lines 167–182)**

```tsx
function EmployeeDashboard({ employeeId }: { employeeId: string }) {
  const { data: me } = useCurrentEmployee()
  const today = new Date()
  const todayStr = today.toLocaleDateString('sv-SE') // YYYY-MM-DD

  const weekDay = today.getDay() === 0 ? 6 : today.getDay() - 1
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - weekDay)
  weekStart.setHours(0, 0, 0, 0)
  const weekStartStr = weekStart.toLocaleDateString('sv-SE')

  // Fetch back to the start of the month that contains Monday,
  // so week hours are correct even when the week spans two months.
  const rangeFrom = new Date(weekStart.getFullYear(), weekStart.getMonth(), 1)
  const { data: sessions, isLoading } = useSessionsRange(rangeFrom, today, employeeId)

  const currentMonthPrefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const activeSession = sessions?.find(s => s.clock_out === null)
  const todayMins  = sessions?.filter(s => s.work_date === todayStr).reduce((a, s) => a + (s.duration_min ?? 0), 0) ?? 0
  const weekMins   = sessions?.filter(s => s.work_date >= weekStartStr).reduce((a, s) => a + (s.duration_min ?? 0), 0) ?? 0
  const monthMins  = sessions?.filter(s => s.work_date.startsWith(currentMonthPrefix)).reduce((a, s) => a + (s.duration_min ?? 0), 0) ?? 0

  const recentSessions = sessions
    ?.filter(s => s.clock_out !== null)
    .sort((a, b) => b.work_date.localeCompare(a.work_date))
    .slice(0, 5) ?? []
```

Remove the old `weekStartStr` / `weekMins` / `monthMins` / `recentSessions` lines that follow (approximately lines 176–182 in the original file) since they are now replaced by the block above.

- [ ] **Step 4: Verify in browser**

Log in as an employee. Check the "Ovaj tjedan" hours card. If today is 1st–3rd of a month, prior-month sessions from this week should now appear.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/queries/sessions.ts frontend/src/routes/dashboard.tsx
git commit -m "fix: employee week hours correct when week spans month boundary"
```

---

## Task 5: Role-based route guards and nav filtering

**Files:**
- Modify: `frontend/src/routes/__root.tsx`
- Modify: `frontend/src/routes/zaposlenici/index.tsx`
- Modify: `frontend/src/routes/zaposlenici/$zaposlenikId.tsx`
- Modify: `frontend/src/routes/zaposlenici/novi.tsx`
- Modify: `frontend/src/routes/izvjestaji.tsx`

Admin-only routes redirect non-admin users to `/dashboard`. The nav shows different links per role.

- [ ] **Step 1: Replace __root.tsx**

```tsx
import { createRootRouteWithContext, Link, Outlet, redirect, useNavigate, useLocation } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { LayoutDashboard, Users, Clock, BarChart2, LogOut, UserCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useCurrentEmployee } from '../lib/queries/employees'

type RouterContext = { queryClient: QueryClient }

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async ({ location }) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user && location.pathname !== '/login') {
      throw redirect({ to: '/login' })
    }
    if (user && location.pathname === '/login') {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: RootLayout,
})

const ADMIN_NAV = [
  { to: '/dashboard',   label: 'Dashboard',    icon: LayoutDashboard },
  { to: '/zaposlenici', label: 'Zaposlenici',   icon: Users           },
  { to: '/sesije',      label: 'Sesije',        icon: Clock           },
  { to: '/izvjestaji',  label: 'Izvještaji',    icon: BarChart2       },
] as const

const EMPLOYEE_NAV = [
  { to: '/dashboard', label: 'Dashboard',   icon: LayoutDashboard },
  { to: '/sesije',    label: 'Moje smjene', icon: Clock           },
  { to: '/profil',    label: 'Profil',      icon: UserCircle      },
] as const

function RootLayout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { data: me } = useCurrentEmployee()

  async function handleSignOut() {
    await supabase.auth.signOut()
    await navigate({ to: '/login' })
  }

  if (pathname === '/login') return <Outlet />

  const isAdmin = me?.role === 'admin'
  const nav = isAdmin ? ADMIN_NAV : EMPLOYEE_NAV

  const initials = me?.ime_prezime
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() ?? ''

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-60 flex-none flex flex-col bg-sidebar border-r border-sidebar-border">
        <div className="px-4 pt-6 pb-5 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center flex-none text-2xl leading-none select-none">
              🐓
            </div>
            <div>
              <p className="font-bold text-sm tracking-wide text-sidebar-foreground leading-none">BILI PIVAC</p>
              <p className="text-[10px] text-sidebar-foreground/40 tracking-wider mt-0.5">Podstrana</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-3 px-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/30 px-3 py-2 mb-1">
            Izbornik
          </p>
          {nav.map(({ to, label, icon: Icon }) => {
            const isActive = pathname === to ||
              (to !== '/dashboard' && to !== '/profil' && pathname.startsWith(to))
            return (
              <Link key={to} to={to}
                className={`flex items-center gap-3 px-3 py-2.5 text-sm font-semibold transition-all rounded-xl mb-0.5 ${
                  isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent'
                }`}>
                <Icon size={16} strokeWidth={isActive ? 2.2 : 1.75} />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-sidebar-border">
          {me && (
            <div className="px-4 py-3 border-b border-sidebar-border flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/10 text-sidebar-foreground flex items-center justify-center text-xs font-black flex-none">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-sidebar-foreground truncate">{me.ime_prezime}</p>
                <p className="text-[10px] text-sidebar-foreground/40 mt-0.5 uppercase tracking-wider">
                  {me.role === 'admin' ? 'Administrator' : 'Zaposlenik'}
                </p>
              </div>
            </div>
          )}
          <button onClick={handleSignOut}
            className="flex w-full items-center gap-3 px-4 py-3 text-sm font-semibold text-sidebar-foreground/40 hover:text-red-400 hover:bg-sidebar-accent transition-colors">
            <LogOut size={15} strokeWidth={1.75} />
            Odjava
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-8 max-w-6xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Add beforeLoad guard to zaposlenici/index.tsx**

Add these imports to the existing import block at the top of the file:
```ts
import { redirect } from '@tanstack/react-router'
import { supabase } from '../../lib/supabase'
```

Replace the `export const Route = ...` block:
```tsx
export const Route = createFileRoute('/zaposlenici/')({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw redirect({ to: '/login' })
    const { data } = await supabase.from('employees').select('role').eq('id', user.id).single()
    if (data?.role !== 'admin') throw redirect({ to: '/dashboard' })
  },
  component: ZaposlednikListPage,
})
```

- [ ] **Step 3: Add beforeLoad guard to zaposlenici/$zaposlenikId.tsx**

Add the same two imports (redirect, supabase) to the existing imports. Replace the `export const Route`:

```tsx
export const Route = createFileRoute('/zaposlenici/$zaposlenikId')({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw redirect({ to: '/login' })
    const { data } = await supabase.from('employees').select('role').eq('id', user.id).single()
    if (data?.role !== 'admin') throw redirect({ to: '/dashboard' })
  },
  component: EditZaposlenikPage,
})
```

- [ ] **Step 4: Add beforeLoad guard to zaposlenici/novi.tsx**

Open `frontend/src/routes/zaposlenici/novi.tsx`. Add the same two imports. Replace the `export const Route`:

```tsx
export const Route = createFileRoute('/zaposlenici/novi')({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw redirect({ to: '/login' })
    const { data } = await supabase.from('employees').select('role').eq('id', user.id).single()
    if (data?.role !== 'admin') throw redirect({ to: '/dashboard' })
  },
  component: NoviZaposlenikPage,
})
```

- [ ] **Step 5: Add beforeLoad guard to izvjestaji.tsx**

Add the same two imports. Replace the `export const Route`:

```tsx
export const Route = createFileRoute('/izvjestaji')({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw redirect({ to: '/login' })
    const { data } = await supabase.from('employees').select('role').eq('id', user.id).single()
    if (data?.role !== 'admin') throw redirect({ to: '/dashboard' })
  },
  component: IzvjestajiPage,
})
```

- [ ] **Step 6: Verify in browser**

Log in as an employee. Confirm:
- Sidebar shows only: Dashboard, Moje smjene, Profil
- Navigating to `/zaposlenici` redirects to `/dashboard`
- Navigating to `/izvjestaji` redirects to `/dashboard`

Log in as admin. Confirm all four admin nav links still work.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/routes/__root.tsx \
        frontend/src/routes/zaposlenici/index.tsx \
        "frontend/src/routes/zaposlenici/\$zaposlenikId.tsx" \
        frontend/src/routes/zaposlenici/novi.tsx \
        frontend/src/routes/izvjestaji.tsx
git commit -m "feat: role-based route guards and nav — employees see limited menu"
```

---

## Task 6: Session delete

**Files:**
- Modify: `frontend/src/lib/queries/sessions.ts`
- Modify: `frontend/src/routes/sesije/$sessionId.tsx`

- [ ] **Step 1: Add useDeleteSession to sessions.ts**

Append to the end of `frontend/src/lib/queries/sessions.ts`:

```ts
export function useDeleteSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('work_sessions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  })
}
```

- [ ] **Step 2: Replace sesije/$sessionId.tsx**

```tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ChevronLeft, Trash2 } from 'lucide-react'
import { useSession, useUpdateSession, useDeleteSession } from '../../lib/queries/sessions'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Skeleton } from '../../components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog'

export const Route = createFileRoute('/sesije/$sessionId')({
  component: EditSesijaPage,
})

function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline gap-2">
        <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">{label}</label>
        {hint && <span className="font-mono text-[10px] text-muted-foreground/50">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function EditSesijaPage() {
  const { sessionId } = Route.useParams()
  const navigate = useNavigate()
  const { data: session, isLoading } = useSession(sessionId)
  const updateSession = useUpdateSession()
  const deleteSession = useDeleteSession()
  const [clockIn, setClockIn] = useState('')
  const [clockOut, setClockOut] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

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

  async function handleDelete() {
    try {
      await deleteSession.mutateAsync(sessionId)
      toast.success('Sesija obrisana')
      navigate({ to: '/sesije' })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Greška pri brisanju')
    }
  }

  if (isLoading) return (
    <div className="max-w-lg space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-52 w-full" />
    </div>
  )
  if (!session) return <p className="font-mono text-xs text-muted-foreground">Sesija nije pronađena.</p>

  return (
    <div className="max-w-lg">
      <button onClick={() => navigate({ to: '/sesije' })}
        className="flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors mb-6 uppercase tracking-wider">
        <ChevronLeft size={13} /> Sesije
      </button>

      <div className="mb-8">
        <div className="flex items-center gap-3 flex-wrap mb-1">
          <h1 className="font-heading font-bold text-3xl text-foreground tracking-wide uppercase">Uredi sesiju</h1>
          {session.is_auto_closed && (
            <span className="font-mono text-[10px] px-2 py-0.5 border border-amber-500/30 text-amber-400 bg-amber-500/5 uppercase tracking-widest">
              auto-zatvoreno
            </span>
          )}
        </div>
        <p className="font-mono text-xs text-muted-foreground tracking-wider">{session.employees?.ime_prezime}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="Dolazak" hint="*">
          <Input type="datetime-local" value={clockIn} onChange={e => setClockIn(e.target.value)} required
            className="font-mono bg-input border-border focus-visible:border-primary rounded-sm h-10" />
        </Field>

        <Field label="Odlazak" hint="prazno = još na poslu">
          <Input type="datetime-local" value={clockOut} onChange={e => setClockOut(e.target.value)}
            className="font-mono bg-input border-border focus-visible:border-primary rounded-sm h-10" />
        </Field>

        {error && (
          <div className="border border-destructive/40 bg-destructive/10 px-3 py-2.5">
            <p className="font-mono text-xs text-destructive">{error}</p>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={updateSession.isPending}
            className="font-heading tracking-wide uppercase text-xs rounded-sm">
            {updateSession.isPending ? 'Spremanje...' : 'Spremi promjene'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate({ to: '/sesije' })}
            className="font-mono text-xs rounded-sm">
            Odustani
          </Button>
          <Button type="button" variant="ghost" size="sm"
            className="ml-auto h-9 w-9 p-0 text-muted-foreground/40 hover:text-destructive hover:bg-red-50 rounded-sm"
            onClick={() => setConfirmDelete(true)}>
            <Trash2 size={14} />
          </Button>
        </div>
      </form>

      <Dialog open={confirmDelete} onOpenChange={open => !open && setConfirmDelete(false)}>
        <DialogContent className="rounded-sm">
          <DialogHeader>
            <DialogTitle className="font-heading tracking-wide uppercase">Brisanje sesije</DialogTitle>
            <DialogDescription className="font-mono text-xs leading-relaxed">
              Sigurno želiš obrisati ovu sesiju za{' '}
              <strong className="text-foreground">{session.employees?.ime_prezime}</strong>?
              Ova radnja se ne može poništiti.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(false)}
              className="rounded-sm font-mono text-xs">Odustani</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteSession.isPending}
              className="rounded-sm font-mono text-xs">
              {deleteSession.isPending ? 'Brisanje...' : 'Obriši sesiju'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 3: Verify in browser**

Open any session, click the trash icon, confirm the dialog. Verify redirect back to `/sesije` with success toast.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/queries/sessions.ts \
        "frontend/src/routes/sesije/\$sessionId.tsx"
git commit -m "feat: session delete with confirmation dialog"
```

---

## Task 7: Manual session creation screen

**Files:**
- Modify: `frontend/src/lib/queries/sessions.ts`
- Create: `frontend/src/routes/sesije/nova.tsx`
- Modify: `frontend/src/routes/sesije/index.tsx`

- [ ] **Step 1: Add useCreateSession to sessions.ts**

Append to `frontend/src/lib/queries/sessions.ts`:

```ts
export function useCreateSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      employee_id,
      clock_in,
      clock_out,
    }: { employee_id: string; clock_in: string; clock_out: string | null }) => {
      const work_date = new Date(clock_in).toLocaleDateString('sv-SE', { timeZone: 'Europe/Zagreb' })
      const duration_min = clock_out
        ? Math.round(
            (new Date(clock_out).getTime() - new Date(clock_in).getTime()) / 60_000 / 15
          ) * 15
        : null
      const { error } = await supabase
        .from('work_sessions')
        .insert({ employee_id, clock_in, clock_out, duration_min, work_date })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  })
}
```

- [ ] **Step 2: Create sesije/nova.tsx**

```tsx
import { createFileRoute, useNavigate, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { ChevronLeft } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useEmployees } from '../../lib/queries/employees'
import { useCreateSession } from '../../lib/queries/sessions'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'

export const Route = createFileRoute('/sesije/nova')({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw redirect({ to: '/login' })
    const { data } = await supabase.from('employees').select('role').eq('id', user.id).single()
    if (data?.role !== 'admin') throw redirect({ to: '/dashboard' })
  },
  component: NovaSesijaPage,
})

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline gap-2">
        <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">{label}</label>
        {hint && <span className="font-mono text-[10px] text-muted-foreground/50">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function NovaSesijaPage() {
  const navigate = useNavigate()
  const { data: employees } = useEmployees()
  const createSession = useCreateSession()
  const [employeeId, setEmployeeId] = useState('')
  const [clockIn, setClockIn] = useState('')
  const [clockOut, setClockOut] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (clockOut && new Date(clockOut) <= new Date(clockIn)) {
      setError('Odlazak mora biti nakon dolaska')
      return
    }
    try {
      await createSession.mutateAsync({
        employee_id: employeeId,
        clock_in: new Date(clockIn).toISOString(),
        clock_out: clockOut ? new Date(clockOut).toISOString() : null,
      })
      toast.success('Sesija dodana')
      navigate({ to: '/sesije' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Greška')
    }
  }

  return (
    <div className="max-w-lg">
      <button onClick={() => navigate({ to: '/sesije' })}
        className="flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors mb-6 uppercase tracking-wider">
        <ChevronLeft size={13} /> Sesije
      </button>

      <div className="mb-8">
        <h1 className="font-heading font-bold text-3xl text-foreground tracking-wide uppercase">Nova sesija</h1>
        <p className="font-mono text-xs text-muted-foreground tracking-wider mt-1">Ručno dodavanje evidencije</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="Zaposlenik" hint="*">
          <Select value={employeeId} onValueChange={setEmployeeId} required>
            <SelectTrigger className="font-mono bg-input border-border focus:border-primary rounded-sm h-10 text-sm">
              <SelectValue placeholder="Odaberi zaposlenika" />
            </SelectTrigger>
            <SelectContent className="font-mono rounded-sm">
              {employees?.map(e => (
                <SelectItem key={e.id} value={e.id}>{e.ime_prezime}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Dolazak" hint="*">
          <Input type="datetime-local" value={clockIn} onChange={e => setClockIn(e.target.value)} required
            className="font-mono bg-input border-border focus-visible:border-primary rounded-sm h-10" />
        </Field>

        <Field label="Odlazak" hint="prazno = aktivna sesija">
          <Input type="datetime-local" value={clockOut} onChange={e => setClockOut(e.target.value)}
            className="font-mono bg-input border-border focus-visible:border-primary rounded-sm h-10" />
        </Field>

        {error && (
          <div className="border border-destructive/40 bg-destructive/10 px-3 py-2.5">
            <p className="font-mono text-xs text-destructive">{error}</p>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={createSession.isPending || !employeeId || !clockIn}
            className="font-heading tracking-wide uppercase text-xs rounded-sm">
            {createSession.isPending ? 'Dodavanje...' : 'Dodaj sesiju'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate({ to: '/sesije' })}
            className="font-mono text-xs rounded-sm">
            Odustani
          </Button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Replace sesije/index.tsx**

```tsx
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Plus, Pencil } from 'lucide-react'
import { useCurrentEmployee, useEmployees } from '../../lib/queries/employees'
import { useSessions } from '../../lib/queries/sessions'
import { Button } from '../../components/ui/button'
import { Skeleton } from '../../components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { getLast12Months, formatMonthLabel, formatDate, formatDateTime, formatMinutes } from '../../lib/utils'

export const Route = createFileRoute('/sesije/')({
  component: SesijeListPage,
})

const MONTHS = getLast12Months()

function SesijeListPage() {
  const { data: me } = useCurrentEmployee()
  const isAdmin = me?.role === 'admin'
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[0])
  const [employeeFilter, setEmployeeFilter] = useState('all')
  const { data: employees } = useEmployees()
  const effectiveFilter = isAdmin
    ? (employeeFilter !== 'all' ? employeeFilter : undefined)
    : me?.id
  const { data: sessions, isLoading } = useSessions(selectedMonth, effectiveFilter)

  return (
    <>
      <div className="flex items-start justify-between flex-wrap gap-4 mb-8">
        <div>
          <h1 className="font-heading font-bold text-3xl text-foreground tracking-wide uppercase">Sesije</h1>
          <p className="font-mono text-xs text-muted-foreground tracking-wider mt-1">
            {isAdmin ? 'Pregled i uređivanje evidencije' : 'Pregled vaših smjena'}
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
              <SelectTrigger className="w-48 font-mono text-xs rounded-sm bg-input border-border h-9">
                <SelectValue placeholder="Svi zaposlenici" />
              </SelectTrigger>
              <SelectContent className="font-mono rounded-sm">
                <SelectItem value="all">Svi zaposlenici</SelectItem>
                {employees?.map(e => <SelectItem key={e.id} value={e.id}>{e.ime_prezime}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button asChild size="sm" className="gap-1.5 font-mono text-xs rounded-sm">
              <Link to="/sesije/nova">
                <Plus size={12} />
                Nova sesija
              </Link>
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1 mb-6">
        {MONTHS.map(m => (
          <button key={m} onClick={() => setSelectedMonth(m)}
            className={`font-mono text-[10px] px-3 py-1.5 uppercase tracking-wider transition-colors ${
              selectedMonth === m
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground border border-border'
            }`}>
            {formatMonthLabel(m)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-1">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : (sessions?.length ?? 0) === 0 ? (
        <div className="border border-dashed border-border text-center py-16">
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Nema sesija za ovaj period</p>
        </div>
      ) : (
        <div className="border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="text-left px-4 py-2.5 font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Datum</th>
                {isAdmin && <th className="text-left px-4 py-2.5 font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Zaposlenik</th>}
                <th className="text-left px-4 py-2.5 font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Dolazak</th>
                <th className="text-left px-4 py-2.5 font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Odlazak</th>
                <th className="text-left px-4 py-2.5 font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Trajanje</th>
                {isAdmin && <th className="w-10" />}
              </tr>
            </thead>
            <tbody>
              {sessions!.map(s => (
                <tr key={s.id} className="border-t border-border/40 hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{formatDate(s.work_date)}</td>
                  {isAdmin && (
                    <td className="px-4 py-3 font-medium text-sm">
                      <span>{s.employees?.ime_prezime}</span>
                      {s.is_auto_closed && (
                        <span className="ml-2 font-mono text-[9px] px-1.5 py-0.5 border border-amber-500/30 text-amber-400 bg-amber-500/5 uppercase tracking-wider">
                          auto
                        </span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{formatDateTime(s.clock_in)}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {s.clock_out
                      ? <span className="text-muted-foreground">{formatDateTime(s.clock_out)}</span>
                      : <span className="text-primary animate-pulse">● aktivan</span>
                    }
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-primary">
                    {s.duration_min != null ? formatMinutes(s.duration_min) : '—'}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" asChild className="h-7 w-7 p-0 hover:text-primary rounded-sm">
                        <Link to="/sesije/$sessionId" params={{ sessionId: s.id }}>
                          <Pencil size={13} />
                        </Link>
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 4: Regenerate route tree**

```bash
cd frontend && npm run dev
# Wait ~2 seconds for TanStack Router to detect nova.tsx and regenerate routeTree.gen.ts, then Ctrl+C
```

Confirm `frontend/src/routeTree.gen.ts` contains `/sesije/nova`.

- [ ] **Step 5: Verify in browser**

Log in as admin → Sesije → "Nova sesija". Fill in employee, clock-in time, optional clock-out. Submit. New session appears in list.

Employee view: no "Nova sesija" button, employee filter hidden, sessions auto-filtered to own.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/queries/sessions.ts \
        frontend/src/routes/sesije/nova.tsx \
        frontend/src/routes/sesije/index.tsx \
        frontend/src/routeTree.gen.ts
git commit -m "feat: manual session creation by admin; employee session list auto-filtered"
```

---

## Task 8: Parallelize year export + fix employee chart names

**Files:**
- Modify: `frontend/src/routes/izvjestaji.tsx`

- [ ] **Step 1: Replace exportYear with Promise.all version**

In `frontend/src/routes/izvjestaji.tsx`, replace the `exportYear` function (lines 68–98):

```ts
const exportYear = useCallback(async () => {
  setExportingYear(true)
  try {
    const wb = XLSX.utils.book_new()
    const results = await Promise.all(
      [...MONTHS].reverse().map(async (month) => {
        const [year, m] = month.split('-')
        const start = `${month}-01`
        const end = `${month}-${String(new Date(+year, +m, 0).getDate()).padStart(2, '0')}`
        const { data: sessions, error } = await supabase
          .from('work_sessions')
          .select('work_date, clock_in, clock_out, duration_min, employees(ime_prezime)')
          .gte('work_date', start)
          .lte('work_date', end)
          .not('clock_out', 'is', null)
        if (error) throw error
        return { month, sessions: sessions ?? [] }
      })
    )
    for (const { month, sessions } of results) {
      const rows = (sessions as any[]).map(s => ({
        Datum: formatDate(s.work_date),
        Zaposlenik: s.employees?.ime_prezime ?? '',
        Dolazak: formatDateTime(s.clock_in),
        Odlazak: s.clock_out ? formatDateTime(s.clock_out) : '',
        'Trajanje (min)': s.duration_min ?? '',
      }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), formatMonthLabel(month))
    }
    XLSX.writeFile(wb, `evidencija-${new Date().getFullYear()}.xlsx`)
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Greška pri izvozu')
  } finally {
    setExportingYear(false)
  }
}, [])
```

- [ ] **Step 2: Show full names in employee chart**

In `frontend/src/routes/izvjestaji.tsx`, replace the `empData` mapping (line 49):

```ts
const empData = data?.employees.map(e => ({
  ime: e.ime_prezime,
  sati: +(e.total_minutes / 60).toFixed(1),
})) ?? []
```

Update the `XAxis` inside the employee `BarChart` to handle longer names (around line 170):

```tsx
<XAxis
  dataKey="ime"
  tick={{ fontSize: 9, fill: C.axis, fontFamily: 'IBM Plex Mono' }}
  axisLine={false}
  tickLine={false}
  interval={0}
  angle={-20}
  textAnchor="end"
  height={48}
/>
```

- [ ] **Step 3: Verify in browser**

Click "Izvezi godinu" — watch the Network tab, all 12 requests fire simultaneously. The employee chart now shows full names at a slight angle.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/routes/izvjestaji.tsx
git commit -m "fix: parallelize year export; full names in employee chart"
```

---

## Task 9: Employee list search

**Files:**
- Modify: `frontend/src/routes/zaposlenici/index.tsx`

- [ ] **Step 1: Replace zaposlenici/index.tsx**

```tsx
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { UserPlus, Pencil, Trash2, CreditCard } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useEmployees, useDeleteEmployee } from '../../lib/queries/employees'
import { Button } from '../../components/ui/button'
import { Skeleton } from '../../components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog'

export const Route = createFileRoute('/zaposlenici/')({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw redirect({ to: '/login' })
    const { data } = await supabase.from('employees').select('role').eq('id', user.id).single()
    if (data?.role !== 'admin') throw redirect({ to: '/dashboard' })
  },
  component: ZaposlednikListPage,
})

function ZaposlednikListPage() {
  const { data: employees, isLoading } = useEmployees()
  const deleteEmployee = useDeleteEmployee()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const toDelete = employees?.find(e => e.id === deleteId)

  const filtered = employees?.filter(e => {
    const q = search.toLowerCase()
    return (
      e.ime_prezime.toLowerCase().includes(q) ||
      e.username.toLowerCase().includes(q) ||
      (e.rfid_uid ?? '').toLowerCase().includes(q)
    )
  }) ?? []

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
    <>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-heading font-bold text-3xl text-foreground tracking-wide uppercase">Zaposlenici</h1>
          <p className="font-mono text-xs text-muted-foreground tracking-wider mt-1">Upravljanje zaposlenicima i RFID karticama</p>
        </div>
        <Button asChild size="sm" className="gap-2 font-heading tracking-wide uppercase text-xs rounded-sm">
          <Link to="/zaposlenici/novi">
            <UserPlus size={13} strokeWidth={2} />
            Dodaj
          </Link>
        </Button>
      </div>

      <div className="mb-4">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Pretraži ime, username ili RFID..."
          className="w-full max-w-sm h-9 px-3 font-mono text-xs bg-input border border-border rounded-sm focus:outline-none focus:border-primary"
        />
      </div>

      {isLoading ? (
        <div className="space-y-1">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-border text-center py-16">
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
            {search ? 'Nema rezultata' : 'Nema zaposlenika'}
          </p>
          {!search && (
            <Link to="/zaposlenici/novi" className="font-mono text-xs text-primary hover:underline mt-2 inline-block">
              Dodaj prvog zaposlenika →
            </Link>
          )}
        </div>
      ) : (
        <div className="border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="text-left px-4 py-2.5 font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Ime i prezime</th>
                <th className="text-left px-4 py-2.5 font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Username</th>
                <th className="text-left px-4 py-2.5 font-mono text-[10px] text-muted-foreground uppercase tracking-widest">RFID UID</th>
                <th className="text-left px-4 py-2.5 font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Uloga</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(emp => (
                <tr key={emp.id} className="border-t border-border/40 hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-3 font-medium">{emp.ime_prezime}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{emp.username}</td>
                  <td className="px-4 py-3">
                    {emp.rfid_uid ? (
                      <span className="inline-flex items-center gap-1.5 font-mono text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-0.5">
                        <CreditCard size={10} />
                        {emp.rfid_uid}
                      </span>
                    ) : (
                      <span className="font-mono text-xs text-muted-foreground/40">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-mono text-[10px] px-2 py-0.5 uppercase tracking-wider border ${
                      emp.role === 'admin'
                        ? 'text-primary border-primary/30 bg-primary/10'
                        : 'text-muted-foreground border-border bg-muted/20'
                    }`}>
                      {emp.role === 'admin' ? 'Admin' : 'Zaposlenik'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" asChild className="h-7 w-7 p-0 hover:text-primary rounded-sm">
                        <Link to="/zaposlenici/$zaposlenikId" params={{ zaposlenikId: emp.id }}>
                          <Pencil size={13} />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="sm"
                        className="h-7 w-7 p-0 hover:text-destructive hover:bg-destructive/10 rounded-sm"
                        onClick={() => setDeleteId(emp.id)}>
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <DialogContent className="rounded-sm">
          <DialogHeader>
            <DialogTitle className="font-heading tracking-wide uppercase">Brisanje zaposlenika</DialogTitle>
            <DialogDescription className="font-mono text-xs leading-relaxed">
              Sigurno želiš obrisati <strong className="text-foreground">{toDelete?.ime_prezime}</strong>?
              Briše se i sva evidencija radnog vremena.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)} className="rounded-sm font-mono text-xs">Odustani</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteEmployee.isPending} className="rounded-sm font-mono text-xs">
              {deleteEmployee.isPending ? 'Brisanje...' : 'Obriši'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
```

- [ ] **Step 2: Verify in browser**

Type a partial name, username, or RFID UID in the search box. List filters in real-time.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/routes/zaposlenici/index.tsx
git commit -m "feat: live search on employee list (name, username, RFID)"
```

---

## Task 10: Employee self-service password change

**Files:**
- Create: `frontend/src/routes/profil.tsx`

`supabase.auth.updateUser({ password })` works for any authenticated user with an active session. No email or old-password required.

- [ ] **Step 1: Create profil.tsx**

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { useCurrentEmployee } from '../lib/queries/employees'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'

export const Route = createFileRoute('/profil')({
  component: ProfilPage,
})

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline gap-2">
        <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">{label}</label>
        {hint && <span className="font-mono text-[10px] text-muted-foreground/50">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function ProfilPage() {
  const { data: me } = useCurrentEmployee()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) { setError('Lozinka mora imati najmanje 6 znakova'); return }
    if (password !== confirm) { setError('Lozinke se ne podudaraju'); return }
    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (err) { setError(`Greška: ${err.message}`); return }
    toast.success('Lozinka uspješno promijenjena')
    setPassword('')
    setConfirm('')
  }

  return (
    <div className="max-w-sm">
      <div className="mb-8">
        <h1 className="font-heading font-bold text-3xl text-foreground tracking-wide uppercase">Profil</h1>
        <p className="font-mono text-xs text-muted-foreground tracking-wider mt-1">{me?.ime_prezime}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="Nova lozinka" hint="min. 6 znakova">
          <Input type="password" value={password} onChange={e => setPassword(e.target.value)}
            required placeholder="••••••••"
            className="font-mono bg-input border-border focus-visible:border-primary rounded-sm h-10" />
        </Field>

        <Field label="Potvrdi lozinku" hint="*">
          <Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
            required placeholder="••••••••"
            className="font-mono bg-input border-border focus-visible:border-primary rounded-sm h-10" />
        </Field>

        {error && (
          <div className="border border-destructive/40 bg-destructive/10 px-3 py-2.5">
            <p className="font-mono text-xs text-destructive">{error}</p>
          </div>
        )}

        <Button type="submit" disabled={loading}
          className="font-heading tracking-wide uppercase text-xs rounded-sm">
          {loading ? 'Spremanje...' : 'Promijeni lozinku'}
        </Button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Regenerate route tree**

```bash
cd frontend && npm run dev
# Wait ~2 seconds, then Ctrl+C
```

Confirm `frontend/src/routeTree.gen.ts` contains `/profil`.

- [ ] **Step 3: Verify in browser**

Log in as an employee. Go to **Profil** in the sidebar. Enter a new password, confirm it, submit. Sign out. Sign in with the new password — it works.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/routes/profil.tsx frontend/src/routeTree.gen.ts
git commit -m "feat: employee self-service password change"
```

---

## Task 11: ESP32 — send device secret with RFID scans

**Files:**
- Modify: `esp32/src/storage.h`
- Modify: `esp32/src/storage.cpp`
- Modify: `esp32/src/wifi_mgr.cpp`
- Modify: `esp32/src/http_client.h`
- Modify: `esp32/src/http_client.cpp`
- Modify: `esp32/src/main.cpp`

- [ ] **Step 1: Add device_secret to Config struct — storage.h**

```cpp
#pragma once
#include <Arduino.h>

struct Config {
    char supabase_url[128];
    char supabase_anon_key[512];
    char device_secret[64];
};

bool storageInit();
bool configLoad(Config& cfg);
void configSave(const Config& cfg);
```

- [ ] **Step 2: Load/save device_secret — storage.cpp**

```cpp
#include "storage.h"
#include <LittleFS.h>
#include <ArduinoJson.h>

bool storageInit() {
    return LittleFS.begin(true);
}

bool configLoad(Config& cfg) {
    File f = LittleFS.open("/config.json", "r");
    if (!f) return false;
    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, f);
    f.close();
    if (err) return false;
    strlcpy(cfg.supabase_url,      doc["supabase_url"]      | "", sizeof(cfg.supabase_url));
    strlcpy(cfg.supabase_anon_key, doc["supabase_anon_key"] | "", sizeof(cfg.supabase_anon_key));
    strlcpy(cfg.device_secret,     doc["device_secret"]     | "", sizeof(cfg.device_secret));
    return cfg.supabase_url[0] != '\0';
}

void configSave(const Config& cfg) {
    JsonDocument doc;
    doc["supabase_url"]      = cfg.supabase_url;
    doc["supabase_anon_key"] = cfg.supabase_anon_key;
    doc["device_secret"]     = cfg.device_secret;
    File f = LittleFS.open("/config.json", "w");
    if (!f) return;
    serializeJson(doc, f);
    f.close();
}
```

- [ ] **Step 3: Add device_secret portal field — wifi_mgr.cpp**

```cpp
#include "wifi_mgr.h"
#include "led.h"
#include <WiFi.h>
#include <WiFiManager.h>

void wifiInit(Config& cfg) {
    WiFiManager wm;
    wm.setConfigPortalBlocking(false);

    WiFiManagerParameter urlParam("supabase_url",      "Supabase URL",      cfg.supabase_url,      127);
    WiFiManagerParameter keyParam("supabase_anon_key", "Supabase Anon Key", cfg.supabase_anon_key, 511);
    WiFiManagerParameter secretParam("device_secret",  "Device Secret",     cfg.device_secret,      63);
    wm.addParameter(&urlParam);
    wm.addParameter(&keyParam);
    wm.addParameter(&secretParam);

    bool connected = wm.autoConnect("RFID-BP-Setup");

    if (!connected) {
        while (!WiFi.isConnected()) {
            wm.process();
            ledPulse(128, 0, 128);
            delay(20);
        }
        ledOff();
    }

    const char* url    = urlParam.getValue();
    const char* key    = keyParam.getValue();
    const char* secret = secretParam.getValue();

    bool changed = false;
    if (url[0] != '\0' && strcmp(url, cfg.supabase_url) != 0) {
        strlcpy(cfg.supabase_url,      url,    sizeof(cfg.supabase_url));
        strlcpy(cfg.supabase_anon_key, key,    sizeof(cfg.supabase_anon_key));
        strlcpy(cfg.device_secret,     secret, sizeof(cfg.device_secret));
        changed = true;
    } else if (secret[0] != '\0' && strcmp(secret, cfg.device_secret) != 0) {
        strlcpy(cfg.device_secret, secret, sizeof(cfg.device_secret));
        changed = true;
    }
    if (changed) configSave(cfg);
}

bool wifiConnected() {
    return WiFi.isConnected();
}
```

- [ ] **Step 4: Add deviceSecret param to httpSendScan — http_client.h**

```cpp
#pragma once

enum class ScanResult { ClockIn, ClockOut, TooSoon, NotFound, Error };

ScanResult httpSendScan(const char* supabaseUrl, const char* anonKey,
                        const char* uid, const char* scannedAt,
                        const char* deviceSecret = "");
```

- [ ] **Step 5: Send p_secret in body — http_client.cpp**

```cpp
#include "http_client.h"
#include "config.h"
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>

ScanResult httpSendScan(const char* supabaseUrl, const char* anonKey,
                        const char* uid, const char* scannedAt,
                        const char* deviceSecret) {
    WiFiClientSecure client;
    client.setInsecure();
    HTTPClient http;
    String url = String(supabaseUrl) + "/rest/v1/rpc/handle_rfid_scan";
    http.begin(client, url);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("apikey", anonKey);
    http.addHeader("Authorization", String("Bearer ") + anonKey);
    http.setTimeout(HTTP_TIMEOUT_MS);

    JsonDocument body;
    body["p_uid"]        = uid;
    body["p_scanned_at"] = scannedAt;
    if (deviceSecret && deviceSecret[0] != '\0') {
        body["p_secret"] = deviceSecret;
    }
    String bodyStr;
    serializeJson(body, bodyStr);

    int code = http.POST(bodyStr);
    Serial.printf("[HTTP] Status code: %d\n", code);
    if (code < 200 || code >= 300) {
        Serial.printf("[HTTP] Response: %s\n", http.getString().c_str());
        http.end();
        return ScanResult::Error;
    }

    String response = http.getString();
    Serial.printf("[HTTP] Response: %s\n", response.c_str());
    http.end();

    JsonDocument resp;
    if (deserializeJson(resp, response) != DeserializationError::Ok) {
        Serial.println("[HTTP] JSON parse failed");
        return ScanResult::Error;
    }

    const char* status = resp["status"] | "";
    if (strcmp(status, "clock_in")     == 0) return ScanResult::ClockIn;
    if (strcmp(status, "clock_out")    == 0) return ScanResult::ClockOut;
    if (strcmp(status, "too_soon")     == 0) return ScanResult::TooSoon;
    if (strcmp(status, "not_found")    == 0) return ScanResult::NotFound;
    if (strcmp(status, "unauthorized") == 0) {
        Serial.println("[HTTP] Unauthorized — check device_secret in config");
        return ScanResult::Error;
    }
    Serial.printf("[HTTP] Unknown status: '%s'\n", status);
    return ScanResult::Error;
}
```

- [ ] **Step 6: Pass device_secret in main.cpp — both httpSendScan calls**

In `esp32/src/main.cpp`, replace the two `httpSendScan` calls in `loop()` (queue replay block and live scan block):

```cpp
// Queue replay:
ScanResult result = httpSendScan(gCfg.supabase_url, gCfg.supabase_anon_key,
                                 entry.uid, entry.scanned_at,
                                 gCfg.device_secret);

// Live scan:
ScanResult result = httpSendScan(gCfg.supabase_url, gCfg.supabase_anon_key,
                                 uid, ts,
                                 gCfg.device_secret);
```

- [ ] **Step 7: Build**

```bash
cd /home/antonio/repo/rfid_bp/esp32
pio run
```

Expected: `SUCCESS` with no errors.

- [ ] **Step 8: Commit**

```bash
git add esp32/src/storage.h esp32/src/storage.cpp esp32/src/wifi_mgr.cpp \
        esp32/src/http_client.h esp32/src/http_client.cpp esp32/src/main.cpp
git commit -m "feat(esp32): send device secret with every RFID scan"
```

---

## Task 12: ESP32 — daily NTP re-sync

**Files:**
- Modify: `esp32/src/main.cpp`

- [ ] **Step 1: Replace main.cpp with daily NTP re-sync**

```cpp
#include <Arduino.h>
#include <time.h>
#include "config.h"
#include "led.h"
#include "storage.h"
#include "wifi_mgr.h"
#include "rfid.h"
#include "http_client.h"
#include "queue.h"

static Config   gCfg;
static uint32_t lastNtpSync = 0;

// 24-hour interval; unsigned subtraction handles millis() overflow at ~49 days
static const uint32_t NTP_RESYNC_MS = 24UL * 60UL * 60UL * 1000UL;

static void ntpSync() {
    configTime(0, 0, NTP_SERVER);
    struct tm ti;
    uint32_t start = millis();
    while (!getLocalTime(&ti, 1000) && (millis() - start) < 5000);
}

static void getTimestamp(char* buf, size_t len) {
    time_t now;
    time(&now);
    struct tm t;
    gmtime_r(&now, &t);
    strftime(buf, len, "%Y-%m-%dT%H:%M:%SZ", &t);
}

static void applyLedFeedback(ScanResult result) {
    switch (result) {
        case ScanResult::ClockIn:  ledSolid(0,   255, 0,   2000); break;
        case ScanResult::ClockOut: ledSolid(0,   0,   255, 2000); break;
        case ScanResult::TooSoon:  ledBlink(255, 255, 0,   3, 150, 100); break;
        case ScanResult::NotFound: ledSolid(255, 0,   0,   3000); break;
        case ScanResult::Error:    ledBlink(255, 0,   0,   5, 100, 100); break;
    }
}

void setup() {
    Serial.begin(115200);
    ledInit();
    ledSet(255, 255, 255);

    if (!storageInit()) {
        while (true) { ledBlink(255, 0, 0, 1, 300, 700); }
    }

    queueInit();
    configLoad(gCfg);
    wifiInit(gCfg);
    ntpSync();
    lastNtpSync = millis();
    rfidInit();
    ledOff();
}

void loop() {
    if ((uint32_t)(millis() - lastNtpSync) >= NTP_RESYNC_MS) {
        Serial.println("[NTP] Daily re-sync");
        ntpSync();
        lastNtpSync = millis();
    }

    if (wifiConnected() && !queueIsEmpty()) {
        QueueEntry entry;
        if (queuePeek(entry)) {
            Serial.printf("[QUEUE] Replaying UID: %s  Time: %s\n", entry.uid, entry.scanned_at);
            ledSet(255, 255, 255);
            ScanResult result = httpSendScan(gCfg.supabase_url, gCfg.supabase_anon_key,
                                             entry.uid, entry.scanned_at,
                                             gCfg.device_secret);
            if (result != ScanResult::Error) {
                Serial.println("[QUEUE] Dequeued");
                queueDequeue();
            } else {
                Serial.println("[QUEUE] Retry next loop");
            }
            ledOff();
        }
    }

    char uid[32];
    if (rfidRead(uid, sizeof(uid))) {
        char ts[32];
        getTimestamp(ts, sizeof(ts));
        Serial.printf("[SCAN] UID: %s  Time: %s\n", uid, ts);

        if (wifiConnected()) {
            Serial.println("[HTTP] Sending scan...");
            ScanResult result = httpSendScan(gCfg.supabase_url, gCfg.supabase_anon_key,
                                             uid, ts, gCfg.device_secret);
            switch (result) {
                case ScanResult::ClockIn:  Serial.println("[HTTP] clock_in");  break;
                case ScanResult::ClockOut: Serial.println("[HTTP] clock_out"); break;
                case ScanResult::TooSoon:  Serial.println("[HTTP] too_soon");  break;
                case ScanResult::NotFound: Serial.println("[HTTP] not_found"); break;
                case ScanResult::Error:
                    Serial.println("[HTTP] error — queuing");
                    queueEnqueue(uid, ts);
                    break;
            }
            applyLedFeedback(result);
        } else {
            Serial.println("[WIFI] Offline — scan queued");
            queueEnqueue(uid, ts);
            ledBlink(255, 0, 0, 5, 100, 100);
        }
    }

    delay(50);
}
```

- [ ] **Step 2: Build**

```bash
cd /home/antonio/repo/rfid_bp/esp32
pio run
```

Expected: `SUCCESS`.

- [ ] **Step 3: Commit**

```bash
git add esp32/src/main.cpp
git commit -m "feat(esp32): daily NTP re-sync to prevent timestamp drift"
```

---

## Post-implementation checklist

- [ ] Run all Supabase pgTAP tests: `supabase test db --db-url "$(cat supabase/.temp/pooler-url)"`
- [ ] Run frontend tests: `cd frontend && npm test`
- [ ] Build frontend: `cd frontend && npm run build`
- [ ] Set a real device secret in production: `ALTER DATABASE postgres SET app.device_secret TO 'your-secret';`
- [ ] Flash updated ESP32 firmware with `pio run --target upload`
- [ ] Enter the same device secret in the ESP32 WiFi portal
