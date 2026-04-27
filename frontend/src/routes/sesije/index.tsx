import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
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
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Sesije</h1>
        <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Svi zaposlenici" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Svi zaposlenici</SelectItem>
            {employees?.map(e => <SelectItem key={e.id} value={e.id}>{e.ime_prezime}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={selectedMonth} onValueChange={setSelectedMonth}>
        <TabsList className="flex flex-wrap h-auto gap-1 justify-start">
          {MONTHS.map(m => (
            <TabsTrigger key={m} value={m} className="text-xs">{formatMonthLabel(m)}</TabsTrigger>
          ))}
        </TabsList>

        {MONTHS.map(m => (
          <TabsContent key={m} value={m} className="mt-4">
            {isLoading ? (
              <div className="space-y-2">{[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : (sessions?.length ?? 0) === 0 ? (
              <p className="text-gray-500 text-sm py-4">Nema sesija za ovaj period.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium text-gray-500">Datum</th>
                    <th className="text-left py-2 font-medium text-gray-500">Zaposlenik</th>
                    <th className="text-left py-2 font-medium text-gray-500">Dolazak</th>
                    <th className="text-left py-2 font-medium text-gray-500">Odlazak</th>
                    <th className="text-left py-2 font-medium text-gray-500">Trajanje</th>
                    <th className="text-left py-2 font-medium text-gray-500">Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {sessions!.map(s => (
                    <tr key={s.id} className="border-b last:border-0">
                      <td className="py-2">{formatDate(s.work_date)}</td>
                      <td className="py-2">{s.employees?.ime_prezime}</td>
                      <td className="py-2">{formatDateTime(s.clock_in)}</td>
                      <td className="py-2">{s.clock_out ? formatDateTime(s.clock_out) : <span className="text-orange-500">—</span>}</td>
                      <td className="py-2">{s.duration_min != null ? formatMinutes(s.duration_min) : '—'}</td>
                      <td className="py-2">
                        {s.is_auto_closed && <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs">auto</Badge>}
                      </td>
                      <td className="py-2 text-right">
                        <Button variant="outline" size="sm" asChild>
                          <Link to="/sesije/$sessionId" params={{ sessionId: s.id }}>Uredi</Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
