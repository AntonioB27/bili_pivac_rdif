import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'

export type WorkSession = {
  id: string
  employee_id: string
  clock_in: string
  clock_out: string | null
  duration_min: number | null
  is_auto_closed: boolean
  work_date: string
  created_at: string
  employees?: { ime_prezime: string; username: string }
}

export function useActiveSessions() {
  return useQuery({
    queryKey: ['sessions', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_sessions')
        .select('*, employees(ime_prezime, username)')
        .is('clock_out', null)
        .order('clock_in', { ascending: false })
      if (error) throw error
      return data as WorkSession[]
    },
    refetchInterval: 30_000,
  })
}

export function useAutoClosedAlerts() {
  return useQuery({
    queryKey: ['sessions', 'auto-closed'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_sessions')
        .select('*, employees(ime_prezime, username)')
        .eq('is_auto_closed', true)
        .order('clock_out', { ascending: false })
        .limit(20)
      if (error) throw error
      return data as WorkSession[]
    },
    refetchInterval: 30_000,
  })
}

export function useSessions(month: string, employeeId?: string) {
  const [year, m] = month.split('-')
  const start = `${month}-01`
  const end = `${month}-${String(new Date(+year, +m, 0).getDate()).padStart(2, '0')}`

  return useQuery({
    queryKey: ['sessions', 'list', month, employeeId ?? 'all'],
    queryFn: async () => {
      let q = supabase
        .from('work_sessions')
        .select('*, employees(ime_prezime, username)')
        .gte('work_date', start)
        .lte('work_date', end)
        .order('work_date', { ascending: false })
      if (employeeId) q = q.eq('employee_id', employeeId)
      const { data, error } = await q
      if (error) throw error
      return data as WorkSession[]
    },
  })
}

export function useSession(id: string) {
  return useQuery({
    queryKey: ['sessions', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_sessions')
        .select('*, employees(ime_prezime, username)')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as WorkSession
    },
  })
}

export function useUpdateSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, clock_in, clock_out }: { id: string; clock_in: string; clock_out: string | null }) => {
      const duration_min = clock_out
        ? Math.round((new Date(clock_out).getTime() - new Date(clock_in).getTime()) / 60_000 / 15) * 15
        : null
      const { error } = await supabase
        .from('work_sessions')
        .update({ clock_in, clock_out, duration_min })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  })
}
