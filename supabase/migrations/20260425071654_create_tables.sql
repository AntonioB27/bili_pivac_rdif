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
