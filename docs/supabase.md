# Supabase Backend

## Overview

The backend is built on [Supabase](https://supabase.com), a managed PostgreSQL platform that provides a relational database, authentication, row-level security (RLS), stored functions, serverless edge functions, and a cron scheduler — all in a single hosted service.

The backend is responsible for:
- Storing and enforcing access to employee and session data
- Processing RFID scan events from the ESP32 device
- Automatically closing sessions that exceed 12 hours
- Sending email alerts when sessions are auto-closed
- Providing a secure CRUD API for employee management

---

## Database Schema

### `employees`

Stores registered employees. Each row is linked to a Supabase Auth user via the `id` column.

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | `uuid` | No | Primary key; references `auth.users(id)` |
| `ime_prezime` | `text` | No | Full name |
| `rfid_uid` | `text` | Yes | RFID card UID as an uppercase hex string (e.g. `A1B2C3D4`); required for employees, optional for admins |
| `username` | `text` | No | Unique login username |
| `role` | `text` | No | `'admin'` or `'employee'` |
| `created_at` | `timestamptz` | No | Record creation timestamp |

**Constraints:**
- `rfid_uid` must be globally unique (one card per person).
- `role` is restricted to `'admin'` or `'employee'` via a `CHECK` constraint.
- `rfid_uid IS NOT NULL` is enforced for all employees (`role = 'employee'`); admins may omit it.

### `work_sessions`

Stores individual clock-in/clock-out records.

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | `uuid` | No | Primary key |
| `employee_id` | `uuid` | No | Foreign key to `employees(id)` |
| `clock_in` | `timestamptz` | No | Arrival timestamp (UTC) |
| `clock_out` | `timestamptz` | Yes | Departure timestamp (UTC); `NULL` if the session is still open |
| `duration_min` | `integer` | Yes | Session duration in minutes, rounded to the nearest 15 minutes |
| `is_auto_closed` | `boolean` | No | `true` if the session was closed automatically by the cron job |
| `work_date` | `date` | No | Calendar date of the session (Europe/Zagreb timezone) |
| `created_at` | `timestamptz` | No | Record creation timestamp |

**Constraints:**
- `clock_out > clock_in` is enforced via a `CHECK` constraint.
- A partial unique index on `(employee_id) WHERE clock_out IS NULL` guarantees that each employee can have at most one open session at a time.

---

## Authentication

Each employee and administrator is a Supabase Auth user. The email is synthesised as `username@rfid-bp.local` (not a real address — Supabase requires an email field). Authentication uses the email/password provider.

- **Admins** log in through the web application.
- **Employees** authenticate physically by tapping their RFID card; they never log in to the web app.

---

## Row Level Security

RLS is enabled on both tables. All policies require an authenticated session (`TO authenticated`).

### `employees` policies

| Operation | Permitted to | Condition |
|---|---|---|
| `SELECT` | Any authenticated user | — |
| `INSERT` | Admin only | `is_admin()` returns `true` |
| `UPDATE` | Admin only | `is_admin()` returns `true` |
| `DELETE` | Admin only | `is_admin()` returns `true` |

### `work_sessions` policies

| Operation | Permitted to | Condition |
|---|---|---|
| `SELECT` | Authenticated user | Own sessions (`employee_id = auth.uid()`) or admin |
| `INSERT` | Not allowed via RLS | Inserts go exclusively through `handle_rfid_scan` (SECURITY DEFINER) |
| `UPDATE` | Admin only | `is_admin()` returns `true` |
| `DELETE` | Admin only | `is_admin()` returns `true` |

### `is_admin()` helper function

```sql
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employees
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;
```

This function is declared `SECURITY DEFINER` so that it executes with the function owner's privileges rather than the calling user's privileges, avoiding an RLS recursion loop that would occur if a policy queried the `employees` table while RLS was evaluating a policy on that same table.

---

## Stored Functions

### `handle_rfid_scan(p_uid text, p_scanned_at timestamptz)`

The core business logic of the system. Called by the ESP32 device via the Supabase REST API (`POST /rest/v1/rpc/handle_rfid_scan`) using the anon key.

**Decision tree:**

```
Lookup employee by rfid_uid
        │
        ├─ Not found ──▶ return {"status": "not_found"}
        │
        ▼
Lookup open session (clock_out IS NULL)
        │
        ├─ No open session ──▶ INSERT new session
        │                      return {"status": "clock_in", "ime": "..."}
        │
        ├─ Open session < 60 min ago ──▶ return {"status": "too_soon"}
        │
        └─ Open session ≥ 60 min ago ──▶ UPDATE clock_out, duration_min
                                          return {"status": "clock_out", "ime": "...", "duration_min": N}
```

**Duration calculation:** `ROUND(epoch_seconds / 60.0 / 15.0) * 15` — rounds to the nearest 15-minute interval.

**Access:** `EXECUTE` is granted to the `anon` role so the ESP32 can call this function without an authenticated session (the anon key is sufficient).

**Security:** The function is declared `SECURITY DEFINER` with `SET search_path = public, pg_temp`, preventing search path injection attacks.

---

### `auto_close_sessions()`

Closes all sessions that have been open for more than 12 hours and notifies the administrator by email. Intended to be called only by `pg_cron`; `EXECUTE` is revoked from `PUBLIC`.

**Process for each affected session:**
1. `clock_out` is set to `clock_in + 12 hours`.
2. `duration_min` is set to `720` (12 hours × 60 minutes).
3. `is_auto_closed` is set to `true`.
4. A `pg_net` HTTP POST is sent to the `send_email` edge function.

The edge function URL and service role key are read from database-level settings (`app.edge_function_url` and `app.service_role_key`), which must be configured with `ALTER DATABASE` after deployment. If these settings are absent (e.g. in a local development environment), the email step is silently skipped.

---

## Edge Functions

Edge functions run on Deno and are deployed to Supabase's serverless infrastructure.

### `manage_employee`

Provides a single endpoint for creating, updating, and deleting employees. It requires both Supabase Auth actions (via the Admin API) and database writes, which is why it runs server-side with the service role key.

The caller must be an authenticated admin; the function verifies this by checking the `Authorization` header against the anon client before taking any action.

| Action | Behaviour |
|---|---|
| `create` | Creates a Supabase Auth user with email `username@rfid-bp.local` and the provided password, then inserts an `employees` row. If the DB insert fails, the Auth user is deleted to maintain consistency. |
| `update` | Updates specified fields in the `employees` row. If a new password is provided, updates the Auth user password as well. |
| `delete` | Force-closes any open sessions for the employee (setting `is_auto_closed = true`), then deletes the Auth user. The `employees` row is removed via `ON DELETE CASCADE`. |

**Called by:** Web frontend (`/zaposlenici` pages) with the user's access token in the `Authorization` header.

---

### `send_email`

Sends an HTML notification email via the [Resend](https://resend.com) API to the administrator whenever a session is auto-closed.

**Called by:** `auto_close_sessions()` PostgreSQL function via `pg_net.http_post`.

**Authentication:** The caller must supply the service role key as a Bearer token. This prevents the endpoint from being called by anyone other than the database.

**Required environment secrets:**

| Secret | Description |
|---|---|
| `RESEND_API_KEY` | Resend API key |
| `ADMIN_EMAIL` | Recipient email address for auto-close alerts |
| `FROM_EMAIL` | Sender email address (must be from a verified Resend domain in production) |

---

## Cron Job

`pg_cron` schedules `auto_close_sessions()` to run every 5 minutes:

```sql
SELECT cron.schedule(
  'auto-close-sessions',
  '*/5 * * * *',
  'SELECT auto_close_sessions()'
);
```

**Prerequisites:** The `pg_cron` and `pg_net` extensions must be enabled in the Supabase dashboard (**Database → Extensions**) before migrations are applied.

---

## Migrations

Migrations are applied in chronological order via `supabase db push`.

| File | Description |
|---|---|
| `20260425071654_create_tables.sql` | Creates `employees` and `work_sessions` tables |
| `20260425072033_rls_policies.sql` | Enables RLS; creates `is_admin()` and all RLS policies |
| `20260425072508_handle_rfid_scan.sql` | Creates `handle_rfid_scan` stored function; grants anon access |
| `20260425073135_prevent_duplicate_open_sessions.sql` | Partial unique index: one open session per employee |
| `20260425161232_auto_close_cron.sql` | Creates `auto_close_sessions`; schedules pg_cron job |
| `20260425173017_fix_is_admin_search_path.sql` | Adds `SET search_path` to `is_admin()` for security |
| `20260427073927_admin_no_rfid_required.sql` | Makes `rfid_uid` nullable for admin accounts |

---

## Post-Deployment Configuration

After running `supabase db push` and deploying the edge functions, two database-level settings must be configured for the auto-close email feature:

```sql
ALTER DATABASE postgres
  SET app.edge_function_url = 'https://<project-ref>.supabase.co/functions/v1';

ALTER DATABASE postgres
  SET app.service_role_key = '<service-role-key>';
```

These settings are read at runtime by `auto_close_sessions()` to construct the HTTP request to `send_email`.
