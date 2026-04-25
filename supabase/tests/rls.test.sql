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
