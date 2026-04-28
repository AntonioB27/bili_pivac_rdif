# Web Client

## Overview

The web client is a single-page application (SPA) built with React and TypeScript. It serves as the administrative dashboard for the RFID attendance system, allowing administrators to monitor real-time attendance, manage employees, review and correct session records, and export reports.

The application is deployed on [Vercel](https://vercel.com) and communicates exclusively with the Supabase backend — it never connects to the ESP32 device directly.

---

## Tech Stack

| Technology | Version | Role |
|---|---|---|
| [React](https://react.dev) | 19 | UI framework |
| [TypeScript](https://www.typescriptlang.org) | ~6.0 | Static type checking |
| [Vite](https://vite.dev) | 8 | Development server and build tool |
| [TanStack Router](https://tanstack.com/router) | ^1.168 | Type-safe, file-based client-side routing |
| [TanStack React Query](https://tanstack.com/query) | ^5.100 | Server-state management, caching, and background refetching |
| [Tailwind CSS](https://tailwindcss.com) | ^4.2 | Utility-first CSS framework |
| [shadcn/ui](https://ui.shadcn.com) | ^4.5 | Accessible component library (built on Radix UI) |
| [Recharts](https://recharts.org) | ^3.8 | Composable chart components |
| [xlsx](https://sheetjs.com) | ^0.18 | Excel file generation for report exports |
| [Sonner](https://sonner.emilkowal.ski) | ^2.0 | Toast notification system |
| [Supabase JS](https://supabase.com/docs/reference/javascript) | ^2.104 | Supabase database client and authentication |

---

## Project Structure

```
frontend/src/
├── lib/
│   ├── supabase.ts          # Supabase client singleton
│   ├── utils.ts             # Date formatting, helper functions
│   └── queries/
│       ├── employees.ts     # React Query hooks for employee data
│       ├── sessions.ts      # React Query hooks for session data
│       └── reports.ts       # React Query hooks for report aggregates
├── routes/
│   ├── __root.tsx           # Root layout: navigation bar, auth guard
│   ├── index.tsx            # Redirects / → /dashboard
│   ├── login.tsx            # Login page
│   ├── dashboard.tsx        # Dashboard page
│   ├── zaposlenici/
│   │   ├── index.tsx        # Employee list
│   │   ├── novi.tsx         # Create employee form
│   │   └── $zaposlenikId.tsx # Edit employee form
│   ├── sesije/
│   │   ├── index.tsx        # Session list (monthly, filterable)
│   │   └── $sessionId.tsx   # Edit session timestamps
│   └── izvjestaji.tsx       # Reports with charts and Excel export
└── components/
    └── ui/                  # shadcn/ui component wrappers
```

---

## Authentication

Authentication is handled by Supabase Auth (email/password). The root route (`__root.tsx`) uses TanStack Router's `beforeLoad` hook to enforce authentication on every navigation:

- If the user is **not authenticated** and the target is not `/login` → redirect to `/login`.
- If the user is **authenticated** and the target is `/login` → redirect to `/dashboard`.

Login credentials use a synthesised email format: the username entered in the form is appended with `@rfid-bp.local` before being passed to `supabase.auth.signInWithPassword()`. This is transparent to the user.

The navigation bar is hidden on the `/login` route and shown on all other routes.

---

## Routes and Pages

### `/login`

A login form that accepts a **username** and **password**. On submission, the username is converted to `username@rfid-bp.local` and passed to Supabase Auth. On success, the user is redirected to `/dashboard`.

---

### `/dashboard`

The main overview page. Displays three summary cards and a live attendance table.

**Summary cards:**

| Card | Data source | Description |
|---|---|---|
| Aktivni danas | `work_sessions` | Count of sessions where `work_date = today` |
| Trenutno na poslu | `work_sessions` | Count of sessions where `clock_out IS NULL` |
| Auto-zatvorene sesije | `work_sessions` | Count of sessions where `is_auto_closed = true`; displayed in orange if > 0 |

**Auto-close alert:** When auto-closed sessions exist, an orange alert panel lists each one with the employee name, clock-in and clock-out timestamps, and a link to the session edit page.

**Live attendance table:** Shows all employees currently clocked in with their clock-in time. This query refetches automatically every 30 seconds.

---

### `/zaposlenici` — Employee Management

**List (`/zaposlenici`):** Displays all employees in a table with their full name, username, RFID UID, and role badge. Provides **Edit** and **Delete** buttons per row.

- **Delete** opens a confirmation dialog warning that all session history will also be deleted. If the employee has an open session, it is force-closed before deletion.

**Create (`/zaposlenici/novi`):** A form with fields for full name, username, password, RFID UID (optional for admins), and role. On submission, calls the `manage_employee` edge function with `action: "create"`.

**Edit (`/zaposlenici/:zaposlenikId`):** Pre-fills the form with existing values. Submits with `action: "update"`. The password field is optional — leaving it blank does not change the existing password.

All mutations call the `manage_employee` Supabase edge function via a `fetch` request authenticated with the user's current access token. This is required because employee creation and deletion involve Supabase Auth Admin API calls that cannot be made from the client directly.

---

### `/sesije` — Session Browser

Provides a filterable, month-by-month view of all work sessions.

**Controls:**
- **Month tabs** — last 12 months; one tab per month.
- **Employee filter** — dropdown to narrow results to a specific employee.

**Session table columns:**

| Column | Description |
|---|---|
| Datum | `work_date` formatted as `DD.MM.YYYY` |
| Zaposlenik | Employee full name |
| Dolazak | `clock_in` formatted as date and time |
| Odlazak | `clock_out` formatted as date and time; shown as `—` in orange if still open |
| Trajanje | `duration_min` formatted as hours and minutes; `—` if session is open |
| Status | `auto` badge (orange) if `is_auto_closed = true` |

**Edit (`/sesije/:sessionId`):** Allows an administrator to correct the `clock_in` and `clock_out` timestamps of any session. The `duration_min` is recalculated automatically on save: `ROUND(duration_seconds / 60 / 15) * 15`.

---

### `/izvjestaji` — Reports

A reporting page with two bar charts and two Excel export options.

**Month selector:** Dropdown of the last 12 months.

**Charts:**

| Chart | X axis | Y axis |
|---|---|---|
| Hours per day | Day of month | Total hours worked across all employees |
| Hours per employee | Employee first name | Total hours worked in the selected month |

**Export options:**

| Button | Output |
|---|---|
| Export month | `evidencija-YYYY-MM.xlsx` — one sheet with all sessions for the selected month |
| Export year | `evidencija-YYYY.xlsx` — one sheet per month for the past 12 months |

Each exported row contains: date, employee name, clock-in, clock-out, and duration in minutes.

---

## Data Layer

All data fetching is handled by TanStack React Query hooks defined in `src/lib/queries/`. Components never call the Supabase client directly — they consume these hooks.

### Employee hooks (`queries/employees.ts`)

| Hook | Purpose |
|---|---|
| `useEmployees()` | Fetch all employees, ordered by name |
| `useEmployee(id)` | Fetch a single employee by ID |
| `useCreateEmployee()` | Mutation: create employee via `manage_employee` edge function |
| `useUpdateEmployee()` | Mutation: update employee via `manage_employee` edge function |
| `useDeleteEmployee()` | Mutation: delete employee via `manage_employee` edge function |

### Session hooks (`queries/sessions.ts`)

| Hook | Purpose |
|---|---|
| `useActiveSessions()` | Fetch all open sessions with employee name; auto-refetches every 30 s |
| `useAutoClosedAlerts()` | Fetch the 20 most recent auto-closed sessions; auto-refetches every 30 s |
| `useSessions(month, employeeId?)` | Fetch all sessions in a given month, optionally filtered by employee |
| `useSession(id)` | Fetch a single session by ID |
| `useUpdateSession()` | Mutation: update `clock_in` and `clock_out` for a session |

### Report hooks (`queries/reports.ts`)

| Hook | Purpose |
|---|---|
| `useMonthlyReport(month)` | Fetch aggregated daily totals, per-employee totals, and raw sessions for a month |

All successful mutations call `queryClient.invalidateQueries()` on the relevant query keys to ensure the UI reflects the latest data without a manual page refresh.

---

## Environment Variables

The following environment variables must be set before building or deploying:

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL (e.g. `https://<ref>.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon (publishable) key |

These variables are embedded into the JavaScript bundle at build time by Vite. They are safe to expose in the client because all sensitive operations are protected by RLS and edge function authentication.

---

## Deployment

The application is deployed to Vercel via the Vite build output (`dist/`).

Because TanStack Router handles routing entirely on the client, all server requests must return `index.html` regardless of the requested path. This is configured in `vercel.json`:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

**Local development:**

```bash
cd frontend
npm install
npm run dev      # starts Vite dev server at http://localhost:5173
npm run build    # production build → dist/
npm test         # run Vitest unit tests
```
