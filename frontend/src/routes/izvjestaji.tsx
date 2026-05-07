import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Download } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import * as XLSX from 'xlsx'
import { useMonthlyReport } from '../lib/queries/reports'
import { Button } from '../components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Skeleton } from '../components/ui/skeleton'
import { supabase } from '../lib/supabase'
import { getLast12Months, formatMonthLabel, formatDate, formatDateTime } from '../lib/utils'

export const Route = createFileRoute('/izvjestaji')({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw redirect({ to: '/login' })
    const { data, error } = await supabase.from('employees').select('role').eq('id', user.id).single()
    if (error || data?.role !== 'admin') throw redirect({ to: '/dashboard' })
  },
  component: IzvjestajiPage,
})

const MONTHS = getLast12Months()

const C = {
  grid:    'oklch(0.905 0.015 78)',
  axis:    'oklch(0.580 0.025 70)',
  bar1:    'oklch(0.520 0.195 27)',
  bar2:    'oklch(0.500 0.125 145)',
  cursor:  'oklch(0.520 0.195 27 / 0.08)',
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="border border-border bg-card px-3 py-2 shadow-xl">
      <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <p className="font-heading font-bold text-lg text-primary">{payload[0].value}h</p>
    </div>
  )
}

function IzvjestajiPage() {
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[0])
  const [exportingYear, setExportingYear] = useState(false)
  const { data, isLoading } = useMonthlyReport(selectedMonth)

  const dailyData = data?.daily.map(d => ({
    dan: d.work_date.split('-')[2],
    sati: +(d.total_minutes / 60).toFixed(1),
  })) ?? []

  const empData = data?.employees.map(e => ({
    ime: e.ime_prezime,
    sati: +(e.total_minutes / 60).toFixed(1),
  })) ?? []

  function exportMonth() {
    if (!data) return
    const rows = data.rawSessions.map((s: any) => ({
      Datum: formatDate(s.work_date),
      Zaposlenik: s.employees?.ime_prezime ?? '',
      Dolazak: formatDateTime(s.clock_in),
      Odlazak: s.clock_out ? formatDateTime(s.clock_out) : '',
      'Trajanje (min)': s.duration_min ?? '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, formatMonthLabel(selectedMonth))
    XLSX.writeFile(wb, `evidencija-${selectedMonth}.xlsx`)
  }

  const exportYear = useCallback(async () => {
    setExportingYear(true)
    try {
      const wb = XLSX.utils.book_new()
      const results = await Promise.all(
        [...MONTHS].reverse().map(async (month) => {
          const [year, m] = month.split('-')
          const start = `${month}-01`
          const end = `${month}-${String(new Date(+year, +m, 0).getDate()).padStart(2, '0')}`
          const { data: sessions, error } = await supabase
            .from('work_sessions')
            .select('work_date, clock_in, clock_out, duration_min, employees(ime_prezime)')
            .gte('work_date', start)
            .lte('work_date', end)
            .not('clock_out', 'is', null)
          if (error) throw error
          return { month, sessions: sessions ?? [] }
        })
      )
      for (const { month, sessions } of results) {
        const rows = (sessions as any[]).map(s => ({
          Datum: formatDate(s.work_date),
          Zaposlenik: s.employees?.ime_prezime ?? '',
          Dolazak: formatDateTime(s.clock_in),
          Odlazak: s.clock_out ? formatDateTime(s.clock_out) : '',
          'Trajanje (min)': s.duration_min ?? '',
        }))
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), formatMonthLabel(month))
      }
      XLSX.writeFile(wb, `evidencija-${new Date().getFullYear()}.xlsx`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Greška pri izvozu')
    } finally {
      setExportingYear(false)
    }
  }, [])

  return (
    <>
      <div className="flex items-start justify-between flex-wrap gap-4 mb-8">
        <div>
          <h1 className="font-heading font-bold text-3xl text-foreground tracking-wide uppercase">Izvještaji</h1>
          <p className="font-mono text-xs text-muted-foreground tracking-wider mt-1">Analitika i izvoz podataka</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-44 font-mono text-xs rounded-sm bg-input border-border h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="font-mono rounded-sm">
              {MONTHS.map(m => <SelectItem key={m} value={m}>{formatMonthLabel(m)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportMonth} disabled={!data || isLoading}
            className="gap-1.5 font-mono text-xs rounded-sm">
            <Download size={12} /> Izvezi mjesec
          </Button>
          <Button variant="outline" size="sm" onClick={exportYear} disabled={exportingYear}
            className="gap-1.5 font-mono text-xs rounded-sm">
            <Download size={12} /> {exportingYear ? 'Izvoz...' : 'Izvezi godinu'}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Daily chart */}
          <div className="bg-card rounded-2xl shadow-sm p-6">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-4">
              Sati po danu — {formatMonthLabel(selectedMonth)}
            </p>
            {dailyData.length === 0 ? (
              <div className="flex items-center justify-center h-52">
                <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Nema podataka</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={dailyData} barSize={10}>
                  <CartesianGrid strokeDasharray="2 4" vertical={false} stroke={C.grid} />
                  <XAxis dataKey="dan" tick={{ fontSize: 10, fill: C.axis, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} />
                  <YAxis unit="h" tick={{ fontSize: 10, fill: C.axis, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} width={32} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: C.cursor }} />
                  <Bar dataKey="sati" fill={C.bar1} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Employee chart */}
          <div className="bg-card rounded-2xl shadow-sm p-6">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-4">
              Sati po zaposleniku — {formatMonthLabel(selectedMonth)}
            </p>
            {empData.length === 0 ? (
              <div className="flex items-center justify-center h-52">
                <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Nema podataka</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={empData} barSize={20}>
                  <CartesianGrid strokeDasharray="2 4" vertical={false} stroke={C.grid} />
                  <XAxis
                    dataKey="ime"
                    tick={{ fontSize: 9, fill: C.axis, fontFamily: 'IBM Plex Mono' }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={48}
                  />
                  <YAxis unit="h" tick={{ fontSize: 10, fill: C.axis, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} width={32} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: C.cursor }} />
                  <Bar dataKey="sati" fill={C.bar2} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}
    </>
  )
}
