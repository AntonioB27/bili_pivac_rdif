-- Dodaj SET search_path na is_admin() SECURITY DEFINER funkciju
-- Sprječava search_path injection napad (konzistentno s handle_rfid_scan i auto_close_sessions)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employees
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;
