CREATE UNIQUE INDEX work_sessions_one_open_per_employee
  ON work_sessions (employee_id)
  WHERE clock_out IS NULL;
