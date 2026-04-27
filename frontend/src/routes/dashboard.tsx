import { createFileRoute, Link } from '@tanstack/react-router'
import { useActiveSessions, useAutoClosedAlerts } from '../lib/queries/sessions'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Skeleton } from '../components/ui/skeleton'
import { formatDateTime } from '../lib/utils'

export const Route = createFileRoute('/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  const { data: activeSessions, isLoading: loadingActive } = useActiveSessions()
  const { data: alerts, isLoading: loadingAlerts } = useAutoClosedAlerts()

  const today = new Date().toISOString().split('T')[0]
  const todayCount = activeSessions?.filter(s => s.work_date === today).length ?? 0

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Aktivni danas</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingActive ? <Skeleton className="h-8 w-12" /> : <p className="text-3xl font-bold">{todayCount}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Trenutno na poslu</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingActive ? <Skeleton className="h-8 w-12" /> : <p className="text-3xl font-bold">{activeSessions?.length ?? 0}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Auto-zatvorene sesije</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingAlerts ? <Skeleton className="h-8 w-12" /> : (
              <p className={`text-3xl font-bold ${(alerts?.length ?? 0) > 0 ? 'text-orange-500' : ''}`}>
                {alerts?.length ?? 0}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {(alerts?.length ?? 0) > 0 && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertDescription>
            <p className="font-medium text-orange-800 mb-2">
              {alerts!.length} {alerts!.length === 1 ? 'sesija automatski zatvorena' : 'sesija automatski zatvoreno'} — potrebna provjera
            </p>
            <div className="space-y-1">
              {alerts!.map(s => (
                <Link
                  key={s.id}
                  to="/sesije/$sessionId"
                  params={{ sessionId: s.id }}
                  className="block text-sm text-orange-700 hover:underline"
                >
                  {s.employees?.ime_prezime} — {formatDateTime(s.clock_in)} → {s.clock_out ? formatDateTime(s.clock_out) : '—'}
                </Link>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Trenutno na poslu</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingActive ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (activeSessions?.length ?? 0) === 0 ? (
            <p className="text-gray-500 text-sm">Nitko trenutno nije na poslu.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium text-gray-500">Zaposlenik</th>
                  <th className="text-left py-2 font-medium text-gray-500">Dolazak</th>
                </tr>
              </thead>
              <tbody>
                {activeSessions!.map(s => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="py-2">{s.employees?.ime_prezime}</td>
                    <td className="py-2">{formatDateTime(s.clock_in)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
