-- Set a real value in production via (requires superuser/pg_settings_non_superuser):
--   ALTER DATABASE postgres SET app.device_secret TO 'your-secret-here';
-- When the setting is absent or empty the check is skipped (backward-compatible).

-- Drop the old 2-arg overload to avoid ambiguity; the 3-arg version covers it
-- via DEFAULT NULL for p_secret.
DROP FUNCTION IF EXISTS handle_rfid_scan(text, timestamptz);

CREATE OR REPLACE FUNCTION handle_rfid_scan(
  p_uid        text,
  p_scanned_at timestamptz DEFAULT now(),
  p_secret     text        DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_expected text;
  v_employee employees%ROWTYPE;
  v_session  work_sessions%ROWTYPE;
  v_duration integer;
BEGIN
  v_expected := current_setting('app.device_secret', true);
  IF v_expected IS NOT NULL AND v_expected <> '' THEN
    IF p_secret IS DISTINCT FROM v_expected THEN
      RETURN jsonb_build_object('status', 'unauthorized');
    END IF;
  END IF;

  SELECT * INTO v_employee FROM employees WHERE rfid_uid = p_uid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  SELECT * INTO v_session
  FROM work_sessions
  WHERE employee_id = v_employee.id AND clock_out IS NULL
  ORDER BY clock_in DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO work_sessions (employee_id, clock_in, work_date)
    VALUES (v_employee.id, p_scanned_at, (p_scanned_at AT TIME ZONE 'Europe/Zagreb')::date);
    RETURN jsonb_build_object('status', 'clock_in', 'ime', v_employee.ime_prezime);
  END IF;

  IF p_scanned_at - v_session.clock_in < interval '60 minutes' THEN
    RETURN jsonb_build_object('status', 'too_soon');
  END IF;

  v_duration := ROUND(
    EXTRACT(EPOCH FROM (p_scanned_at - v_session.clock_in)) / 60.0 / 15.0
  ) * 15;

  UPDATE work_sessions
  SET clock_out    = p_scanned_at,
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

-- Old firmware sends 2 args (p_uid, p_scanned_at); DEFAULT NULL for p_secret means
-- it resolves to this single overload — no ambiguity.
GRANT EXECUTE ON FUNCTION handle_rfid_scan(text, timestamptz, text) TO anon;
