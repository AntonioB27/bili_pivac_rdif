BEGIN;
SELECT plan(14);

-- employees
SELECT has_table('public', 'employees', 'Tablica employees postoji');
SELECT has_column('public', 'employees', 'id',          'employees.id');
SELECT has_column('public', 'employees', 'ime_prezime', 'employees.ime_prezime');
SELECT has_column('public', 'employees', 'rfid_uid',    'employees.rfid_uid');
SELECT has_column('public', 'employees', 'username',    'employees.username');
SELECT has_column('public', 'employees', 'role',        'employees.role');
SELECT col_is_null('public', 'employees', 'rfid_uid',     'rfid_uid nullable for admins');
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
