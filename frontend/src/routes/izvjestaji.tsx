import { createFileRoute } from '@tanstack/react-router'
import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import * as XLSX from 'xlsx'
import { useMonthlyReport } from '../lib/queries/reports'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Skeleton } from '../components/ui/skeleton'
import { supabase } from '../lib/supabase'
import { getLast12Months, formatMonthLabel, formatDate, formatDateTime } from '../lib/utils'

export const Route = createFileRoute('/izvjestaji')({
  component: IzvjestajiPage,
})

const MONTHS = getLast12Months()

function IzvjestajiPage() {
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[0])
  const [exportingYear, setExportingYear] = useState(false)
  const { data, isLoading } = useMonthlyReport(selectedMonth)

  const dailyData = data?.daily.map(d => ({
    dan: d.work_date.split('-')[2],
    sati: +(d.total_minutes / 60).toFixed(1),
  })) ?? []

  const empData = data?.employees.map(e => ({
    ime: e.ime_prezime.split(' ')[0],
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
      for (const month of [...MONTHS].reverse()) {
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
        const rows = (sessions ?? []).map((s: any) => ({
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
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold">Izvještaji</h1>
        <div className="flex gap-2 flex-wrap items-center">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map(m => <SelectItem key={m} value={m}>{formatMonthLabel(m)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportMonth} disabled={!data || isLoading}>Izvezi mjesec</Button>
          <Button variant="outline" onClick={exportYear} disabled={exportingYear}>{exportingYear ? 'Izvoz...' : 'Izvezi godinu'}</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sati po danu — {formatMonthLabel(selectedMonth)}</CardTitle>
            </CardHeader>
            <CardContent>
              {dailyData.length === 0 ? (
                <p className="text-gray-500 text-sm">Nema podataka za ovaj mjesec.</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="dan" tick={{ fontSize: 12 }} />
                    <YAxis unit="h" tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v) => [`${v ?? 0}h`, 'Ukupno']} />
                    <Bar dataKey="sati" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sati po zaposleniku — {formatMonthLabel(selectedMonth)}</CardTitle>
            </CardHeader>
            <CardContent>
              {empData.length === 0 ? (
                <p className="text-gray-500 text-sm">Nema podataka za ovaj mjesec.</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={empData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="ime" tick={{ fontSize: 12 }} />
                    <YAxis unit="h" tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v) => [`${v ?? 0}h`, 'Ukupno']} />
                    <Bar dataKey="sati" fill="#10b981" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
