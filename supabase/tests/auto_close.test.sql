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
