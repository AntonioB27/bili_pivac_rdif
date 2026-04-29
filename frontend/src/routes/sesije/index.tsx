import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { useEmployees } from '../../lib/queries/employees'
import { useSessions } from '../../lib/queries/sessions'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Skeleton } from '../../components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { getLast12Months, formatMonthLabel, formatDate, formatDateTime, formatMinutes } from '../../lib/utils'

export const Route = createFileRoute('/sesije/')({
  component: SesijeListPage,
})

const MONTHS = getLast12Months()

function SesijeListPage() {
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[0])
  const [employeeFilter, setEmployeeFilter] = useState('all')
  const { data: employees } = useEmployees()
  const { data: sessions, isLoading } = useSessions(selectedMonth, employeeFilter !== 'all' ? employeeFilter : undefined)

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-heading font-bold text-3xl text-foreground">Sesije</h1>
          <p className="text-muted-foreground text-sm mt-1">Pregled i uređivanje evidencije</p>
        </div>
        <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Svi zaposlenici" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Svi zaposlenici</SelectItem>
            {employees?.map(e => <SelectItem key={e.id} value={e.id}>{e.ime_prezime}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={selectedMonth} onValueChange={setSelectedMonth}>
        <TabsList className="flex flex-wrap h-auto gap-1 justify-start bg-transparent p-0 mb-2">
          {MONTHS.map(m => (
            <TabsTrigger
              key={m}
              value={m}
              className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              {formatMonthLabel(m)}
            </TabsTrigger>
          ))}
        </TabsList>

        {MONTHS.map(m => (
          <TabsContent key={m} value={m} className="mt-4">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-13 w-full" />)}
              </div>
            ) : (sessions?.length ?? 0) === 0 ? (
              <div className="text-center py-16 rounded-lg border border-dashed border-border">
                <p className="text-muted-foreground text-sm">Nema sesija za ovaj period.</p>
              </div>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Datum</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Zaposlenik</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Dolazak</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Odlazak</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Trajanje</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {sessions!.map(s => (
                      <tr key={s.id} className="border-t border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{formatDate(s.work_date)}</td>
                        <td className="px-4 py-3 font-medium">{s.employees?.ime_prezime}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{formatDateTime(s.clock_in)}</td>
                        <td className="px-4 py-3 font-mono text-xs">
                          {s.clock_out
                            ? <span className="text-muted-foreground">{formatDateTime(s.clock_out)}</span>
                            : <span className="text-amber-400">još aktivan</span>
                          }
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {s.duration_min != null ? formatMinutes(s.duration_min) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {s.is_auto_closed && (
                            <Badge variant="outline" className="text-amber-400 border-amber-400/30 bg-amber-400/5 text-xs">
                              auto
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0 hover:text-primary">
                            <Link to="/sesije/$sessionId" params={{ sessionId: s.id }}>
                              <Pencil size={14} />
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
