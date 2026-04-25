CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Funkcija koja zatvara sesije starije od 12h i šalje email notifikacije
CREATE OR REPLACE FUNCTION auto_close_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_edge_url    text;
  v_service_key text;
  r             RECORD;
BEGIN
  v_edge_url    := current_setting('app.edge_function_url',  true);
  v_service_key := current_setting('app.service_role_key', true);

  FOR r IN
    UPDATE work_sessions ws
    SET
      clock_out      = ws.clock_in + interval '12 hours',
      duration_min   = 720,
      is_auto_closed = true
    FROM employees e
    WHERE e.id = ws.employee_id
      AND ws.clock_out IS NULL
      AND ws.clock_in < NOW() - interval '12 hours'
    RETURNING
      ws.id,
      ws.clock_in,
      (ws.clock_in + interval '12 hours') AS clock_out,
      e.ime_prezime
  LOOP
    -- HTTP poziv samo ako su konfigurirani parametri (ne u lokalnom dev okruženju)
    IF v_edge_url IS NOT NULL AND v_service_key IS NOT NULL THEN
      PERFORM net.http_post(
        url     := v_edge_url || '/send_email',
        headers := jsonb_build_object(
                     'Content-Type',  'application/json',
                     'Authorization', 'Bearer ' || v_service_key
                   ),
        body    := jsonb_build_object(
                     'session_id',  r.id,
                     'ime_prezime', r.ime_prezime,
                     'clock_in',    r.clock_in,
                     'clock_out',   r.clock_out
                   )
      );
    END IF;
  END LOOP;
END;
$$;

-- Samo postgres (pg_cron) treba pokretati ovu funkciju — blokiraj direktne pozive
REVOKE EXECUTE ON FUNCTION auto_close_sessions() FROM PUBLIC;

-- Pokreni svakih 5 minuta
SELECT cron.schedule(
  'auto-close-sessions',
  '*/5 * * * *',
  'SELECT auto_close_sessions()'
);
