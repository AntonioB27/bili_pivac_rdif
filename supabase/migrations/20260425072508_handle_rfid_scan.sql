CREATE OR REPLACE FUNCTION handle_rfid_scan(
  p_uid        text,
  p_scanned_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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
  LIMIT 1
  FOR UPDATE;

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
