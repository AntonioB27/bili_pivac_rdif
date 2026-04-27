import { useQuery } from '@tanstack/react-query'
import { supabase } from '../supabase'

export type DailyReport = { work_date: string; total_minutes: number }
export type EmployeeReport = { employee_id: string; ime_prezime: string; total_minutes: number }

export function useMonthlyReport(month: string) {
  const [year, m] = month.split('-')
  const start = `${month}-01`
  const end = `${month}-${String(new Date(+year, +m, 0).getDate()).padStart(2, '0')}`

  return useQuery({
    queryKey: ['reports', 'monthly', month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_sessions')
        .select('work_date, duration_min, employee_id, clock_in, clock_out, is_auto_closed, employees(ime_prezime)')
        .gte('work_date', start)
        .lte('work_date', end)
        .not('clock_out', 'is', null)
      if (error) throw error

      const byDay: Record<string, number> = {}
      const byEmp: Record<string, { ime_prezime: string; total_minutes: number }> = {}

      for (const s of data as any[]) {
        byDay[s.work_date] = (byDay[s.work_date] ?? 0) + (s.duration_min ?? 0)
        if (!byEmp[s.employee_id]) byEmp[s.employee_id] = { ime_prezime: s.employees.ime_prezime, total_minutes: 0 }
        byEmp[s.employee_id].total_minutes += s.duration_min ?? 0
      }

      const daily: DailyReport[] = Object.entries(byDay)
        .map(([work_date, total_minutes]) => ({ work_date, total_minutes }))
        .sort((a, b) => a.work_date.localeCompare(b.work_date))

      const employees: EmployeeReport[] = Object.entries(byEmp)
        .map(([employee_id, v]) => ({ employee_id, ...v }))
        .sort((a, b) => b.total_minutes - a.total_minutes)

      return { daily, employees, rawSessions: data as any[] }
    },
  })
}
