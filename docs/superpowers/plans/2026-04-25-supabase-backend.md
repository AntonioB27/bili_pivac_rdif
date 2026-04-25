# Supabase Backend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Postaviti Supabase backend s bazom podataka, RLS politikama, RPC funkcijom za RFID scan, automatskim zatvaranjem sesija putem pg_cron i email notifikacijama putem Resend.

**Architecture:** PostgreSQL s dvije tablice (`employees`, `work_sessions`), SECURITY DEFINER `handle_rfid_scan()` za atomičan clock-in/out, `auto_close_sessions()` funkcija koja svakih 5 minuta zatvara sesije starije od 12h i poziva Deno Edge Function za email. Auth koristi Supabase GoTrue s internim email formatom `{username}@rfid-bp.local`.

**Tech Stack:** Supabase CLI v2, PostgreSQL 15, pgTAP, Deno (Edge Functions), Resend API

---

## File Structure

```
supabase/
  config.toml
  migrations/
    YYYYMMDDHHMMSS_create_tables.sql        employees + work_sessions
    YYYYMMDDHHMMSS_rls_policies.sql         RLS + is_admin() helper
    YYYYMMDDHHMMSS_handle_rfid_scan.sql     RPC funkcija za clock-in/out
    YYYYMMDDHHMMSS_auto_close_cron.sql      auto_close_sessions() + pg_cron
  functions/
    send_email/
      index.ts                              Deno Edge Function za Resend
  tests/
    schema.test.sql                         pgTAP: provjera sheme tablica
    rls.test.sql                            pgTAP: RLS politike
    handle_rfid_scan.test.sql               pgTAP: RPC funkcija
    auto_close.test.sql                     pgTAP: auto-close logika
  seed.sql                                  Lokalni admin seed
```

---

### Task 1: Supabase CLI setup i inicijalizacija projekta

**Files:**
- Create: `supabase/config.toml` (generira CLI)
- Create: `supabase/seed.sql`

- [ ] **Step 1: Provjeri preduvjete**

```bash
docker --version
node --version
```

Docker mora biti instaliran i pokrenut. Node v18+.

- [ ] **Step 2: Instaliraj Supabase CLI**

```bash
npm install -g supabase@latest
supabase --version
```

Očekivano: `2.x.x`

- [ ] **Step 3: Inicijaliziraj Supabase projekt**

```bash
cd /home/antonio/repo/rfid_bp
supabase init
```

Prihvati defaultne odgovore. Kreira `supabase/config.toml`.

- [ ] **Step 4: Kreiraj prazan seed file**

Kreiraj `supabase/seed.sql`:

```sql
-- Seed podaci za lokalni razvoj (popunjava se u Task 7)
```

- [ ] **Step 5: Pokreni lokalni Supabase**

```bash
supabase start
```

Pričekaj ~2 minute (prvi put preuzima Docker image-e).

Očekivani output na kraju:
```
         API URL: http://127.0.0.1:54321
          DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
      Studio URL: http://127.0.0.1:54323
        Anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  Service role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Spremi `Anon key` i `Service role key` — trebat će za ESP32 konfiguraciju i produkcijski deploy.

- [ ] **Step 6: Commit**

```bash
git add supabase/config.toml supabase/seed.sql
git commit -m "feat: initialize supabase project"
```

---

### Task 2: Tablice — TDD

**Files:**
- Create: `supabase/tests/schema.test.sql`
- Create: `supabase/migrations/YYYYMMDDHHMMSS_create_tables.sql`

- [ ] **Step 1: Napiši pgTAP test za shemu (failing)**

Kreiraj `supabase/tests/schema.test.sql`:

```sql
BEGIN;
SELECT plan(14);

-- employees
SELECT has_table('public', 'employees', 'Tablica employees postoji');
SELECT has_column('public', 'employees', 'id',          'employees.id');
SELECT has_column('public', 'employees', 'ime_prezime', 'employees.ime_prezime');
SELECT has_column('public', 'employees', 'rfid_uid',    'employees.rfid_uid');
SELECT has_column('public', 'employees', 'username',    'employees.username');
SELECT has_column('public', 'employees', 'role',        'employees.role');
SELECT col_not_null('public', 'employees', 'rfid_uid',    'rfid_uid NOT NULL');
SELECT col_not_null('public', 'employees', 'ime_prezime', 'ime_prezime NOT NULL');

-- work_sessions
SELECT has_table('public', 'work_sessions', 'Tablica work_sessions postoji');
SELECT has_column('public', 'work_sessions', 'employee_id',   'work_sessions.employee_id');
SELECT has_column('public', 'work_sessions', 'clock_in',      'work_sessions.clock_in');
SELECT has_column('public', 'work_sessions', 'clock_out',     'work_sessions.clock_out');
SELECT has_column('public', 'work_sessions', 'duration_min',  'work_sessions.duration_min');
SELECT has_column('public', 'work_sessions', 'is_auto_closed','work_sessions.is_auto_closed');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Pokreni test da verificiraš da pada**

```bash
supabase test db
```

Očekivano: greške `relation "public.employees" does not exist`

- [ ] **Step 3: Kreiraj migraciju**

```bash
supabase migration new create_tables
```

Otvori generiranu datoteku u `supabase/migrations/` i dodaj:

```sql
CREATE TABLE employees (
  id           uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ime_prezime  text        NOT NULL,
  rfid_uid     text        NOT NULL UNIQUE,
  username     text        NOT NULL UNIQUE,
  role         text        NOT NULL DEFAULT 'employee' CHECK (role IN ('admin', 'employee')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE work_sessions (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id    uuid        NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  clock_in       timestamptz NOT NULL,
  clock_out      timestamptz,
  duration_min   integer     CHECK (duration_min IS NULL OR duration_min > 0),
  is_auto_closed boolean     NOT NULL DEFAULT false,
  work_date      date        NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clock_out_after_clock_in CHECK (clock_out IS NULL OR clock_out > clock_in)
);
```

- [ ] **Step 4: Primijeni migraciju**

```bash
supabase db reset
```

- [ ] **Step 5: Pokreni test da verificiraš da prolazi**

```bash
supabase test db
```

Očekivano: `14 tests passed`

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/ supabase/tests/schema.test.sql
git commit -m "feat: create employees and work_sessions tables"
```

---

### Task 3: RLS politike i is_admin() helper — TDD

**Files:**
- Create: `supabase/tests/rls.test.sql`
- Create: `supabase/migrations/YYYYMMDDHHMMSS_rls_policies.sql`

- [ ] **Step 1: Napiši pgTAP RLS testove (failing)**

Kreiraj `supabase/tests/rls.test.sql`:

```sql
BEGIN;
SELECT plan(5);

-- Pripremi testne korisnike (direktni insert zaobilazi RLS, samo u testovima)
INSERT INTO auth.users (id, email, aud, role, encrypted_password,
                        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'admin@rfid-bp.local', 'authenticated', 'authenticated', '',
   now(), '{}', '{}', now(), now()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'emp@rfid-bp.local', 'authenticated', 'authenticated', '',
   now(), '{}', '{}', now(), now());

INSERT INTO employees (id, ime_prezime, rfid_uid, username, role)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Admin Adminić', 'ADMIN-001', 'admin', 'admin'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Zaposlenik Zaposlenić', 'EMP-001', 'emp', 'employee');

-- Direktni insert zaobilazi RLS — koristi se samo za testni setup
INSERT INTO work_sessions (id, employee_id, clock_in, work_date)
VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccccc',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', now() - interval '2 hours', CURRENT_DATE),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', now() - interval '3 hours', CURRENT_DATE);

-- Test 1: Zaposlenik vidi samo svoju sesiju
SET LOCAL "request.jwt.claims" TO
  '{"sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "authenticated"}';
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*)::integer FROM work_sessions),
  1,
  'Zaposlenik vidi samo svoju sesiju'
);

-- Test 2: Zaposlenik ne vidi tuđe sesije
SELECT is(
  (SELECT count(*)::integer FROM work_sessions
   WHERE employee_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  0,
  'Zaposlenik ne vidi sesije drugog zaposlenika'
);

-- Test 3: Zaposlenik može čitati tablicu employees (za prikaz imena)
SELECT is(
  (SELECT count(*)::integer FROM employees),
  2,
  'Zaposlenik može čitati tablicu employees'
);

-- Test 4: Admin vidi sve sesije
SET LOCAL "request.jwt.claims" TO
  '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

SELECT is(
  (SELECT count(*)::integer FROM work_sessions),
  2,
  'Admin vidi sve sesije'
);

-- Test 5: Anon ne može čitati sesije
RESET ROLE;
SET LOCAL ROLE anon;

SELECT is(
  (SELECT count(*)::integer FROM work_sessions),
  0,
  'Anon ne može čitati work_sessions'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Pokreni test da verificiraš da pada**

```bash
supabase test db
```

Očekivano: RLS testovi padaju jer RLS još nije omogućen.

- [ ] **Step 3: Kreiraj RLS migraciju**

```bash
supabase migration new rls_policies
```

Otvori generiranu datoteku i dodaj:

```sql
-- SECURITY DEFINER izbjegava RLS rekurziju pri provjeri admin role
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

ALTER TABLE employees    ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_sessions ENABLE ROW LEVEL SECURITY;

-- employees politike
CREATE POLICY "employees_select" ON employees
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "employees_insert" ON employees
  FOR INSERT TO authenticated WITH CHECK (is_admin());

CREATE POLICY "employees_update" ON employees
  FOR UPDATE TO authenticated USING (is_admin());

CREATE POLICY "employees_delete" ON employees
  FOR DELETE TO authenticated USING (is_admin());

-- work_sessions politike
-- Nema INSERT politike — inserti idu samo kroz handle_rfid_scan (SECURITY DEFINER)
CREATE POLICY "sessions_select" ON work_sessions
  FOR SELECT TO authenticated
  USING (employee_id = auth.uid() OR is_admin());

CREATE POLICY "sessions_update" ON work_sessions
  FOR UPDATE TO authenticated USING (is_admin());

CREATE POLICY "sessions_delete" ON work_sessions
  FOR DELETE TO authenticated USING (is_admin());
```

- [ ] **Step 4: Primijeni migraciju**

```bash
supabase db reset
```

- [ ] **Step 5: Pokreni testove da verificiraš da prolaze**

```bash
supabase test db
```

Očekivano: svih 19 testova prolaze (14 schema + 5 RLS).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/ supabase/tests/rls.test.sql
git commit -m "feat: add RLS policies and is_admin helper"
```

---

### Task 4: handle_rfid_scan RPC funkcija — TDD

**Files:**
- Create: `supabase/tests/handle_rfid_scan.test.sql`
- Create: `supabase/migrations/YYYYMMDDHHMMSS_handle_rfid_scan.sql`

- [ ] **Step 1: Napiši pgTAP testove (failing)**

Kreiraj `supabase/tests/handle_rfid_scan.test.sql`:

```sql
BEGIN;
SELECT plan(8);

INSERT INTO auth.users (id, email, aud, role, encrypted_password,
                        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at)
VALUES
  ('11111111-1111-1111-1111-111111111111',
   'ana@rfid-bp.local', 'authenticated', 'authenticated', '',
   now(), '{}', '{}', now(), now());

INSERT INTO employees (id, ime_prezime, rfid_uid, username, role)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Ana Anić', 'CARD-001', 'ana.anic', 'employee');

-- Test 1: Nepoznati UID → not_found
SELECT is(
  (handle_rfid_scan('NEPOZNATI', now()))->>'status',
  'not_found',
  'Nepoznati UID → not_found'
);

-- Test 2: Prvi scan → clock_in
SELECT is(
  (handle_rfid_scan('CARD-001', '2026-04-25 06:00:00+00'))->>'status',
  'clock_in',
  'Prvi scan → clock_in'
);

-- Test 3: Sesija kreirana u bazi
SELECT is(
  (SELECT count(*)::integer FROM work_sessions
   WHERE employee_id = '11111111-1111-1111-1111-111111111111'),
  1,
  'Sesija postoji u work_sessions nakon clock_in'
);

-- Test 4: clock_in odgovor sadrži ime zaposlenika
-- Nova kartica (CARD-999) za testiranje — neće biti pronađena
-- Koristimo direktni upit za provjeru odgovora clock_in-a koji smo već napravili
SELECT is(
  (SELECT clock_out FROM work_sessions
   WHERE employee_id = '11111111-1111-1111-1111-111111111111'),
  NULL,
  'Sesija je otvorena (clock_out IS NULL) nakon clock_in'
);

-- Test 5: Scan unutar 60 min → too_soon (31 min poslije)
SELECT is(
  (handle_rfid_scan('CARD-001', '2026-04-25 06:31:00+00'))->>'status',
  'too_soon',
  'Scan unutar 60 min od clock_in → too_soon'
);

-- Test 6: Scan 7h 52min poslije → clock_out
SELECT is(
  (handle_rfid_scan('CARD-001', '2026-04-25 13:52:00+00'))->>'status',
  'clock_out',
  'Scan 7h 52min poslije clock_in → clock_out'
);

-- Test 7: Duration zaokružen (7h 52min = 472 min → ROUND(472/15)*15 = 465 min = 7h 45min)
SELECT is(
  (SELECT duration_min FROM work_sessions
   WHERE employee_id = '11111111-1111-1111-1111-111111111111'
   AND clock_out IS NOT NULL),
  465,
  'Duration zaokružen: 472 min → 465 min (7h 45min)'
);

-- Test 8: work_date = datum clock_in u Europe/Zagreb timezone
-- clock_in = '2026-04-25 06:00:00+00' = '2026-04-25 08:00:00 Europe/Zagreb' → date = 2026-04-25
SELECT is(
  (SELECT work_date FROM work_sessions
   WHERE employee_id = '11111111-1111-1111-1111-111111111111'
   AND clock_out IS NOT NULL),
  '2026-04-25'::date,
  'work_date = datum clock_in u Zagreb timezone'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Pokreni test da verificiraš da pada**

```bash
supabase test db
```

Očekivano: greška `function handle_rfid_scan(unknown, timestamp...) does not exist`

- [ ] **Step 3: Kreiraj migraciju za handle_rfid_scan**

```bash
supabase migration new handle_rfid_scan
```

Otvori generiranu datoteku i dodaj:

```sql
CREATE OR REPLACE FUNCTION handle_rfid_scan(
  p_uid        text,
  p_scanned_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_employee  employees%ROWTYPE;
  v_session   work_sessions%ROWTYPE;
  v_duration  integer;
BEGIN
  -- Pronađi zaposlenika po rfid_uid
  SELECT * INTO v_employee FROM employees WHERE rfid_uid = p_uid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  -- Pronađi otvorenu sesiju
  SELECT * INTO v_session
  FROM work_sessions
  WHERE employee_id = v_employee.id AND clock_out IS NULL
  ORDER BY clock_in DESC
  LIMIT 1;

  IF NOT FOUND THEN
    -- CLOCK IN
    INSERT INTO work_sessions (employee_id, clock_in, work_date)
    VALUES (
      v_employee.id,
      p_scanned_at,
      (p_scanned_at AT TIME ZONE 'Europe/Zagreb')::date
    );

    RETURN jsonb_build_object(
      'status', 'clock_in',
      'ime',    v_employee.ime_prezime
    );
  END IF;

  -- Zaštita od brzog dvostrukog skeniranja (< 60 minuta)
  IF p_scanned_at - v_session.clock_in < interval '60 minutes' THEN
    RETURN jsonb_build_object('status', 'too_soon');
  END IF;

  -- CLOCK OUT
  v_duration := ROUND(
    EXTRACT(EPOCH FROM (p_scanned_at - v_session.clock_in)) / 60.0 / 15.0
  ) * 15;

  UPDATE work_sessions
  SET
    clock_out    = p_scanned_at,
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

-- ESP32 koristi anon ključ — treba mu EXECUTE permisija
GRANT EXECUTE ON FUNCTION handle_rfid_scan(text, timestamptz) TO anon;
```

- [ ] **Step 4: Primijeni migraciju**

```bash
supabase db reset
```

- [ ] **Step 5: Pokreni testove da verificiraš da prolaze**

```bash
supabase test db
```

Očekivano: svih 27 testova prolaze (14 + 5 + 8).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/ supabase/tests/handle_rfid_scan.test.sql
git commit -m "feat: add handle_rfid_scan RPC function"
```

---

### Task 5: Auto-close logika i pg_cron — TDD

**Files:**
- Create: `supabase/tests/auto_close.test.sql`
- Create: `supabase/migrations/YYYYMMDDHHMMSS_auto_close_cron.sql`

- [ ] **Step 1: Napiši pgTAP testove (failing)**

Kreiraj `supabase/tests/auto_close.test.sql`:

```sql
BEGIN;
SELECT plan(4);

INSERT INTO auth.users (id, email, aud, role, encrypted_password,
                        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at)
VALUES
  ('33333333-3333-3333-3333-333333333333',
   'marko@rfid-bp.local', 'authenticated', 'authenticated', '',
   now(), '{}', '{}', now(), now());

INSERT INTO employees (id, ime_prezime, rfid_uid, username, role)
VALUES
  ('33333333-3333-3333-3333-333333333333', 'Marko Marković', 'CARD-003', 'marko', 'employee');

-- Sesija stara 13 sati (treba biti automatski zatvorena)
INSERT INTO work_sessions (id, employee_id, clock_in, work_date)
VALUES (
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  '33333333-3333-3333-3333-333333333333',
  NOW() - interval '13 hours',
  CURRENT_DATE - 1
);

-- Pozovi funkciju direktno
SELECT auto_close_sessions();

-- Test 1: Sesija je zatvorena
SELECT is(
  (SELECT count(*)::integer FROM work_sessions WHERE is_auto_closed = true),
  1,
  'Sesija starija od 12h je automatski zatvorena'
);

-- Test 2: clock_out = clock_in + 12h
SELECT is(
  (SELECT (clock_out - clock_in) = interval '12 hours'
   FROM work_sessions WHERE id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  true,
  'clock_out = clock_in + 12 sati'
);

-- Test 3: duration_min = 720
SELECT is(
  (SELECT duration_min FROM work_sessions WHERE id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  720,
  'duration_min = 720 za auto-closed sesiju'
);

-- Test 4: Sesija mlađa od 12h nije zatvorena
INSERT INTO work_sessions (id, employee_id, clock_in, work_date)
VALUES (
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  '33333333-3333-3333-3333-333333333333',
  NOW() - interval '6 hours',
  CURRENT_DATE
);

SELECT auto_close_sessions();

SELECT is(
  (SELECT count(*)::integer FROM work_sessions
   WHERE id = 'ffffffff-ffff-ffff-ffff-ffffffffffff' AND clock_out IS NULL),
  1,
  'Sesija mlađa od 12h nije zatvorena'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Pokreni test da verificiraš da pada**

```bash
supabase test db
```

Očekivano: greška `function auto_close_sessions() does not exist`

- [ ] **Step 3: Kreiraj migraciju za auto-close**

```bash
supabase migration new auto_close_cron
```

Otvori generiranu datoteku i dodaj:

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Funkcija koja zatvara sesije starije od 12h i šalje email notifikacije
CREATE OR REPLACE FUNCTION auto_close_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_edge_url    text;
  v_service_key text;
  r             RECORD;
BEGIN
  v_edge_url    := current_setting('app.edge_function_url',  true);
  v_service_key := current_setting('app.service_role_key', true);

  FOR r IN
    UPDATE work_sessions ws
    SET
      clock_out      = ws.clock_in + interval '12 hours',
      duration_min   = 720,
      is_auto_closed = true
    FROM employees e
    WHERE e.id = ws.employee_id
      AND ws.clock_out IS NULL
      AND ws.clock_in < NOW() - interval '12 hours'
    RETURNING
      ws.id,
      ws.clock_in,
      (ws.clock_in + interval '12 hours') AS clock_out,
      e.ime_prezime
  LOOP
    -- HTTP poziv samo ako su konfigurirani parametri (ne u lokalnom dev okruženju)
    IF v_edge_url IS NOT NULL AND v_service_key IS NOT NULL THEN
      PERFORM net.http_post(
        url     := v_edge_url || '/send_email',
        headers := jsonb_build_object(
                     'Content-Type',  'application/json',
                     'Authorization', 'Bearer ' || v_service_key
                   ),
        body    := jsonb_build_object(
                     'session_id',  r.id,
                     'ime_prezime', r.ime_prezime,
                     'clock_in',    r.clock_in,
                     'clock_out',   r.clock_out
                   )
      );
    END IF;
  END LOOP;
END;
$$;

-- Pokreni svakih 5 minuta
SELECT cron.schedule(
  'auto-close-sessions',
  '*/5 * * * *',
  'SELECT auto_close_sessions()'
);
```

- [ ] **Step 4: Primijeni migraciju**

```bash
supabase db reset
```

- [ ] **Step 5: Pokreni testove da verificiraš da prolaze**

```bash
supabase test db
```

Očekivano: svih 31 testova prolaze (14 + 5 + 8 + 4).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/ supabase/tests/auto_close.test.sql
git commit -m "feat: add auto_close_sessions function and pg_cron job"
```

---

### Task 6: send_email Edge Function

**Files:**
- Create: `supabase/functions/send_email/index.ts`

- [ ] **Step 1: Kreiraj direktorij i Edge Function**

```bash
mkdir -p supabase/functions/send_email
```

Kreiraj `supabase/functions/send_email/index.ts`:

```typescript
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const ADMIN_EMAIL    = Deno.env.get("ADMIN_EMAIL");
const FROM_EMAIL     = Deno.env.get("FROM_EMAIL") ?? "onboarding@resend.dev";

interface Payload {
  session_id:  string;
  ime_prezime: string;
  clock_in:    string;
  clock_out:   string;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!RESEND_API_KEY || !ADMIN_EMAIL) {
    return new Response("Missing RESEND_API_KEY or ADMIN_EMAIL", { status: 500 });
  }

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleString("hr-HR", {
      timeZone:  "Europe/Zagreb",
      day:       "2-digit",
      month:     "2-digit",
      year:      "numeric",
      hour:      "2-digit",
      minute:    "2-digit",
    });

  const res = await fetch("https://api.resend.com/emails", {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from:    FROM_EMAIL,
      to:      [ADMIN_EMAIL],
      subject: `Sesija automatski zatvorena — ${payload.ime_prezime}`,
      html: `
        <p>Sesija zaposlenika <strong>${payload.ime_prezime}</strong>
           automatski je zatvorena nakon 12 sati bez odjave.</p>
        <table>
          <tr><td><strong>Dolazak:</strong></td><td>${formatTime(payload.clock_in)}</td></tr>
          <tr><td><strong>Odjava (auto):</strong></td><td>${formatTime(payload.clock_out)}</td></tr>
        </table>
        <p>Molimo provjerite sesiju u dashboardu i ispravite po potrebi.</p>
      `,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    return new Response(`Resend error: ${body}`, { status: 502 });
  }

  return new Response("OK", { status: 200 });
});
```

- [ ] **Step 2: Pokreni Edge Function lokalno**

```bash
supabase functions serve send_email --env-file supabase/.env.local
```

Kreiraj `supabase/.env.local` (gitignored):
```
RESEND_API_KEY=re_test_xxxxxxxxxxxx
ADMIN_EMAIL=tvojmail@gmail.com
FROM_EMAIL=onboarding@resend.dev
```

- [ ] **Step 3: Testiraj s curl-om**

```bash
curl -i --request POST \
  http://localhost:54321/functions/v1/send_email \
  --header "Authorization: Bearer $(supabase status | grep 'anon key' | awk '{print $NF}')" \
  --header "Content-Type: application/json" \
  --data '{
    "session_id":  "test-123",
    "ime_prezime": "Test Korisnik",
    "clock_in":    "2026-04-25T06:00:00+00:00",
    "clock_out":   "2026-04-25T18:00:00+00:00"
  }'
```

Očekivano: `HTTP/1.1 200 OK` i email u inboxu (Resend test mode šalje samo na registrirani email).

Napomena: `FROM_EMAIL=onboarding@resend.dev` radi samo u test modu Resenda. Za produkciju treba verificirana domena.

- [ ] **Step 4: Dodaj supabase/.env.local u .gitignore**

Kreiraj `/home/antonio/repo/rfid_bp/.gitignore`:
```
supabase/.env.local
.env
.env.local
```

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/ .gitignore
git commit -m "feat: add send_email edge function"
```

---

### Task 7: Admin seed za lokalni razvoj

**Files:**
- Modify: `supabase/seed.sql`

- [ ] **Step 1: Popuni seed.sql s admin korisnikom**

Zamijeni sadržaj `supabase/seed.sql` (`crypt()` i `gen_salt()` su dostupni jer Supabase ima pgcrypto ugrađen):

```sql
-- Admin korisnik za lokalni razvoj
-- username: admin | password: admin123
-- Lozinka se mijenja pri produkcijskom deployu

INSERT INTO auth.users (
  id, email, aud, role, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'admin@rfid-bp.local',
  'authenticated',
  'authenticated',
  crypt('admin123', gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{}',
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO employees (id, ime_prezime, rfid_uid, username, role)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Administrator',
  'ADMIN-RFID-0001',
  'admin',
  'admin'
)
ON CONFLICT (id) DO NOTHING;
```

- [ ] **Step 2: Primijeni seed**

```bash
supabase db reset
```

- [ ] **Step 3: Verificiraj login u Supabase Studio**

Otvori http://localhost:54323 → Authentication → Users. Treba se vidjeti `admin@rfid-bp.local`.

- [ ] **Step 4: Testiraj prijavu s Supabase JS (opcijski)**

```bash
curl -X POST http://localhost:54321/auth/v1/token?grant_type=password \
  --header "apikey: $(supabase status | grep 'anon key' | awk '{print $NF}')" \
  --header "Content-Type: application/json" \
  --data '{"email": "admin@rfid-bp.local", "password": "admin123"}'
```

Očekivano: JSON s `access_token`.

- [ ] **Step 5: Commit**

```bash
git add supabase/seed.sql
git commit -m "feat: add admin seed for local development"
```

---

### Task 8: Produkcijski deploy

**Files:**
- Nema novih datoteka — konfiguracija se radi u Supabase dashboardu i CLI-u

- [ ] **Step 1: Kreiraj Supabase projekt**

Idi na https://supabase.com/dashboard → New project. Spremi:
- Project URL (npr. `https://abcdefgh.supabase.co`)
- Anon key
- Service role key
- DB password

- [ ] **Step 2: Povežu lokalni projekt s produkcijskim**

```bash
supabase link --project-ref <project-ref-iz-URL-a>
```

`project-ref` je dio URL-a: `https://supabase.com/dashboard/project/<project-ref>`

- [ ] **Step 3: Pushaj migracije na produkciju**

```bash
supabase db push
```

Očekivano: sve 4 migracije se primjenjuju bez grešaka.

- [ ] **Step 4: Omogući pg_cron i pg_net ekstenzije**

U Supabase dashboardu: Database → Extensions → traži `pg_cron` → Enable. Ponovi za `pg_net`.

- [ ] **Step 5: Konfiguriraj database settings za auto-close email**

```bash
supabase db execute --command "
  ALTER DATABASE postgres
    SET app.edge_function_url = 'https://<project-ref>.supabase.co/functions/v1';
  ALTER DATABASE postgres
    SET app.service_role_key = '<service-role-key>';
"
```

Zamijeni `<project-ref>` i `<service-role-key>` s pravim vrijednostima.

- [ ] **Step 6: Postavi Edge Function secrets**

```bash
supabase secrets set \
  RESEND_API_KEY=re_xxxxxxxxxxxx \
  ADMIN_EMAIL=tvojmail@gmail.com \
  FROM_EMAIL=noreply@tvoja-domena.com
```

Napomena: `FROM_EMAIL` mora biti s verificirane domene u Resendu (https://resend.com/domains). Za testiranje koristi `onboarding@resend.dev` uz uvjet da `ADMIN_EMAIL` bude registrirani Resend email.

- [ ] **Step 7: Deploji Edge Function**

```bash
supabase functions deploy send_email
```

Očekivano: `Deployed Function send_email`

- [ ] **Step 8: Kreiraj admin korisnika na produkciji**

U Supabase dashboardu: Authentication → Users → Add user:
- Email: `admin@rfid-bp.local`
- Password: (sigurna lozinka, ne `admin123`)
- Email confirmed: ✓

Zatim u SQL Editoru:
```sql
INSERT INTO employees (id, ime_prezime, rfid_uid, username, role)
SELECT
  id,
  'Administrator',
  'ADMIN-RFID-0001',
  'admin',
  'admin'
FROM auth.users
WHERE email = 'admin@rfid-bp.local'
ON CONFLICT (id) DO NOTHING;
```

- [ ] **Step 9: Verificiraj cron job**

U SQL Editoru provjeri da je cron job registriran:
```sql
SELECT jobname, schedule, command FROM cron.job;
```

Očekivano: redak s `auto-close-sessions` i `*/5 * * * *`.

- [ ] **Step 10: Commit**

```bash
git add .
git commit -m "docs: add production deployment notes"
```

---

## Napomene o zaokruživanju trajanja

Formula: `ROUND(ukupne_minute / 15.0) * 15`

Primjeri:
- 7h 52min = 472 min → `ROUND(31.47) * 15 = 31 * 15 = 465 min` (7h 45min)
- 8h 00min = 480 min → `ROUND(32.00) * 15 = 32 * 15 = 480 min` (8h 00min, točno)
- 8h 08min = 488 min → `ROUND(32.53) * 15 = 33 * 15 = 495 min` (8h 15min)

Napomena: Spec navodi primjer "8h 07min → 8h 15min", ali standardni ROUND daje 8h 00min za 487 minuta (487/15 = 32.47, zaokružuje na 32). Primjer u specu za 8h 07min izgleda kao tipfeler — formula `ROUND(x/15)*15` je konzistentna s primjerom 7h 52min → 7h 45min i matematički ispravna.

## Auth: username login

Supabase Auth zahtijeva email format. Implementacija:
- Korisnički `username` → interni email `{username}@rfid-bp.local`
- Frontend poziva `supabase.auth.signInWithPassword({ email: `${username}@rfid-bp.local`, password })`
- Korisnik unosi samo `username` — frontend konstruira email programski
- Ovo se implementira u React planu (Plan 3)
