BEGIN;
SELECT plan(4);

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

-- Test 2: When secret is explicitly empty string, scan also works without secret
SET LOCAL app.device_secret = '';
SELECT is(
  (handle_rfid_scan('CARD-DEV', now(), NULL))->>'status',
  'clock_in',
  'Prazan string secret → scan radi bez tajnog ključa'
);

DELETE FROM work_sessions WHERE employee_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

-- Test 3: When secret is set, wrong secret → unauthorized
SET LOCAL app.device_secret = 'correct-secret';
SELECT is(
  (handle_rfid_scan('CARD-DEV', now(), 'wrong-secret'))->>'status',
  'unauthorized',
  'Krivi tajni ključ → unauthorized'
);

-- Test 4: Correct secret works
SELECT is(
  (handle_rfid_scan('CARD-DEV', now(), 'correct-secret'))->>'status',
  'clock_in',
  'Ispravan tajni ključ → clock_in'
);

SELECT * FROM finish();
ROLLBACK;
