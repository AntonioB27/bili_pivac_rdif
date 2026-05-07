import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'
import { toMonthString } from '../utils'

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
    refetchInterval: 10_000,
  })
}

export function useAutoClosedAlerts(since?: Date) {
  return useQuery({
    queryKey: ['sessions', 'auto-closed', since?.toISOString() ?? 'all'],
    queryFn: async () => {
      let q = supabase
        .from('work_sessions')
        .select('*, employees(ime_prezime, username)')
        .eq('is_auto_closed', true)
        .order('clock_out', { ascending: false })
        .limit(20)
      if (since) q = q.gte('clock_out', since.toISOString())
      const { data, error } = await q
      if (error) throw error
      return data as WorkSession[]
    },
    refetchInterval: 10_000,
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

export function useClockOutSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, clock_in }: { id: string; clock_in: string }) => {
      const clock_out = new Date().toISOString()
      const duration_min = Math.max(
        Math.round((new Date(clock_out).getTime() - new Date(clock_in).getTime()) / 60_000 / 15) * 15,
        0
      )
      const { data, error } = await supabase
        .from('work_sessions')
        .update({ clock_out, duration_min })
        .eq('id', id)
        .select()
      if (error) throw error
      if (!data || data.length === 0) throw new Error('Nema dozvole za ažuriranje sesije (RLS)')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
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

export function useSessionsRange(from: Date, to: Date, employeeId?: string) {
  const fromMonth = toMonthString(from)
  const toMonth   = toMonthString(to)
  const q1 = useSessions(fromMonth, employeeId)
  const q2 = useSessions(toMonth,   employeeId)

  const combined = React.useMemo(() => {
    if (fromMonth === toMonth) return q1.data
    const merged = [...(q1.data ?? []), ...(q2.data ?? [])]
    const seen = new Set<string>()
    return merged.filter(s => { if (seen.has(s.id)) return false; seen.add(s.id); return true })
  }, [q1.data, q2.data, fromMonth, toMonth])

  return { data: combined, isLoading: q1.isLoading || q2.isLoading }
}
