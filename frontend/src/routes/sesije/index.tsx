import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Plus, Pencil } from 'lucide-react'
import { useCurrentEmployee, useEmployees } from '../../lib/queries/employees'
import { useSessions } from '../../lib/queries/sessions'
import { Button } from '../../components/ui/button'
import { Skeleton } from '../../components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { getLast12Months, formatMonthLabel, formatDate, formatDateTime, formatMinutes } from '../../lib/utils'

export const Route = createFileRoute('/sesije/')({
  component: SesijeListPage,
})

const MONTHS = getLast12Months()

function SesijeListPage() {
  const { data: me } = useCurrentEmployee()
  const isAdmin = me?.role === 'admin'
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[0])
  const [employeeFilter, setEmployeeFilter] = useState('all')
  const { data: employees } = useEmployees()
  const effectiveFilter = isAdmin
    ? (employeeFilter !== 'all' ? employeeFilter : undefined)
    : me?.id
  const { data: sessions, isLoading } = useSessions(selectedMonth, effectiveFilter)

  return (
    <>
      <div className="flex items-start justify-between flex-wrap gap-4 mb-8">
        <div>
          <h1 className="font-heading font-bold text-3xl text-foreground tracking-wide uppercase">Sesije</h1>
          <p className="font-mono text-xs text-muted-foreground tracking-wider mt-1">
            {isAdmin ? 'Pregled i uređivanje evidencije' : 'Pregled vaših smjena'}
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
              <SelectTrigger className="w-48 font-mono text-xs rounded-sm bg-input border-border h-9">
                <SelectValue placeholder="Svi zaposlenici" />
              </SelectTrigger>
              <SelectContent className="font-mono rounded-sm">
                <SelectItem value="all">Svi zaposlenici</SelectItem>
                {employees?.map(e => <SelectItem key={e.id} value={e.id}>{e.ime_prezime}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button asChild size="sm" className="gap-1.5 font-mono text-xs rounded-sm">
              <Link to="/sesije/nova">
                <Plus size={12} />
                Nova sesija
              </Link>
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1 mb-6">
        {MONTHS.map(m => (
          <button key={m} onClick={() => setSelectedMonth(m)}
            className={`font-mono text-[10px] px-3 py-1.5 uppercase tracking-wider transition-colors ${
              selectedMonth === m
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground border border-border'
            }`}>
            {formatMonthLabel(m)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-1">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : (sessions?.length ?? 0) === 0 ? (
        <div className="border border-dashed border-border text-center py-16">
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Nema sesija za ovaj period</p>
        </div>
      ) : (
        <div className="border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="text-left px-4 py-2.5 font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Datum</th>
                {isAdmin && <th className="text-left px-4 py-2.5 font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Zaposlenik</th>}
                <th className="text-left px-4 py-2.5 font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Dolazak</th>
                <th className="text-left px-4 py-2.5 font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Odlazak</th>
                <th className="text-left px-4 py-2.5 font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Trajanje</th>
                {isAdmin && <th className="w-10" />}
              </tr>
            </thead>
            <tbody>
              {sessions!.map(s => (
                <tr key={s.id} className="border-t border-border/40 hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{formatDate(s.work_date)}</td>
                  {isAdmin && (
                    <td className="px-4 py-3 font-medium text-sm">
                      <span>{s.employees?.ime_prezime}</span>
                      {s.is_auto_closed && (
                        <span className="ml-2 font-mono text-[9px] px-1.5 py-0.5 border border-amber-500/30 text-amber-400 bg-amber-500/5 uppercase tracking-wider">
                          auto
                        </span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{formatDateTime(s.clock_in)}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {s.clock_out
                      ? <span className="text-muted-foreground">{formatDateTime(s.clock_out)}</span>
                      : <span className="text-primary animate-pulse">● aktivan</span>
                    }
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-primary">
                    {s.duration_min != null ? formatMinutes(s.duration_min) : '—'}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" asChild className="h-7 w-7 p-0 hover:text-primary rounded-sm">
                        <Link to="/sesije/$sessionId" params={{ sessionId: s.id }}>
                          <Pencil size={13} />
                        </Link>
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
