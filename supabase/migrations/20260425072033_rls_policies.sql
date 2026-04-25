-- SECURITY DEFINER izbjegava RLS rekurziju pri provjeri admin role
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employees
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

ALTER TABLE employees    ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_sessions ENABLE ROW LEVEL SECURITY;

-- employees politike
CREATE POLICY "employees_select" ON employees
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "employees_insert" ON employees
  FOR INSERT TO authenticated WITH CHECK (is_admin());

CREATE POLICY "employees_update" ON employees
  FOR UPDATE TO authenticated USING (is_admin());

CREATE POLICY "employees_delete" ON employees
  FOR DELETE TO authenticated USING (is_admin());

-- work_sessions politike
-- Nema INSERT politike — inserti idu samo kroz handle_rfid_scan (SECURITY DEFINER)
CREATE POLICY "sessions_select" ON work_sessions
  FOR SELECT TO authenticated
  USING (employee_id = auth.uid() OR is_admin());

CREATE POLICY "sessions_update" ON work_sessions
  FOR UPDATE TO authenticated USING (is_admin());

CREATE POLICY "sessions_delete" ON work_sessions
  FOR DELETE TO authenticated USING (is_admin());