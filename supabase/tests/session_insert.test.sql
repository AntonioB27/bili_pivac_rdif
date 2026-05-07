BEGIN;
SET LOCAL search_path TO extensions, public, auth;
SELECT plan(3);

INSERT INTO auth.users (id, email, aud, role, encrypted_password,
                        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'si-test-admin@rfid-bp.local',
   'authenticated', 'authenticated', '', now(), '{}', '{}', now(), now()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'si-test-emp@rfid-bp.local',
   'authenticated', 'authenticated', '', now(), '{}', '{}', now(), now());

INSERT INTO employees (id, ime_prezime, rfid_uid, username, role)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Admin Admin', 'SI-CARD-ADMIN', 'si-admin', 'admin'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Emp Empić',   'SI-CARD-EMP',   'si-emp',   'employee');

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
