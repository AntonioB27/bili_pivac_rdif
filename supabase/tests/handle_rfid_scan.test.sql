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
