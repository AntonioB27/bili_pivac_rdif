import { createFileRoute } from '@tanstack/react-router'
import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Download } from 'lucide-react'
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

const CHART_STYLE = {
  cartesianGrid: 'oklch(0.25 0.040 152)',
  axis: 'oklch(0.58 0.055 152)',
  tooltip: { bg: 'oklch(0.17 0.030 152)', border: 'oklch(0.25 0.040 152)', text: 'oklch(0.93 0.016 152)' },
  bar1: 'oklch(0.72 0.190 143)',
  bar2: 'oklch(0.60 0.170 143)',
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-lg">
      <p className="text-muted-foreground text-xs mb-1">{label}</p>
      <p className="font-semibold text-foreground">{payload[0].value}h</p>
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
    <div className="space-y-8">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-heading font-bold text-3xl text-foreground">Izvještaji</h1>
          <p className="text-muted-foreground text-sm mt-1">Analitika i izvoz podataka</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map(m => <SelectItem key={m} value={m}>{formatMonthLabel(m)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportMonth} disabled={!data || isLoading} className="gap-2">
            <Download size={14} />
            Izvezi mjesec
          </Button>
          <Button variant="outline" size="sm" onClick={exportYear} disabled={exportingYear} className="gap-2">
            <Download size={14} />
            {exportingYear ? 'Izvoz...' : 'Izvezi godinu'}
          </Button>
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
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Sati po danu — {formatMonthLabel(selectedMonth)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dailyData.length === 0 ? (
                <div className="flex items-center justify-center h-52 text-muted-foreground text-sm">
                  Nema podataka za ovaj mjesec.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={dailyData} barSize={14}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_STYLE.cartesianGrid} />
                    <XAxis dataKey="dan" tick={{ fontSize: 11, fill: CHART_STYLE.axis }} axisLine={false} tickLine={false} />
                    <YAxis unit="h" tick={{ fontSize: 11, fill: CHART_STYLE.axis }} axisLine={false} tickLine={false} width={36} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'oklch(0.72 0.190 143 / 0.08)' }} />
                    <Bar dataKey="sati" fill={CHART_STYLE.bar1} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Sati po zaposleniku — {formatMonthLabel(selectedMonth)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {empData.length === 0 ? (
                <div className="flex items-center justify-center h-52 text-muted-foreground text-sm">
                  Nema podataka za ovaj mjesec.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={empData} barSize={24}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_STYLE.cartesianGrid} />
                    <XAxis dataKey="ime" tick={{ fontSize: 11, fill: CHART_STYLE.axis }} axisLine={false} tickLine={false} />
                    <YAxis unit="h" tick={{ fontSize: 11, fill: CHART_STYLE.axis }} axisLine={false} tickLine={false} width={36} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'oklch(0.72 0.190 143 / 0.08)' }} />
                    <Bar dataKey="sati" fill={CHART_STYLE.bar2} radius={[3, 3, 0, 0]} />
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
