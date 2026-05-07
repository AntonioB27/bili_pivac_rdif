-- Speeds up month-range queries used by useSessions and useMonthlyReport
CREATE INDEX work_sessions_work_date_idx
  ON work_sessions (employee_id, work_date DESC);

-- Allow admins to manually insert sessions.
-- handle_rfid_scan uses SECURITY DEFINER and bypasses RLS — this policy is for the manual creation screen only.
CREATE POLICY "sessions_insert" ON work_sessions
  FOR INSERT TO authenticated WITH CHECK (is_admin());
