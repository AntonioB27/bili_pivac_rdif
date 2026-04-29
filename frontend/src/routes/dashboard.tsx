import { createFileRoute, Link } from '@tanstack/react-router'
import { Users, AlertTriangle, UserCheck } from 'lucide-react'
import { useActiveSessions, useAutoClosedAlerts, useSessions } from '../lib/queries/sessions'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Skeleton } from '../components/ui/skeleton'
import { Badge } from '../components/ui/badge'
import { formatDateTime, toMonthString } from '../lib/utils'

export const Route = createFileRoute('/dashboard')({
  component: DashboardPage,
})

function StatCard({ label, value, icon: Icon, accent }: {
  label: string
  value: number | undefined
  icon: React.ElementType
  accent?: boolean
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">{label}</p>
            {value === undefined
              ? <Skeleton className="h-9 w-14" />
              : <p className={`text-4xl font-bold font-heading ${accent && value > 0 ? 'text-amber-400' : 'text-foreground'}`}>{value}</p>
            }
          </div>
          <div className="p-2.5 rounded-lg bg-primary/10">
            <Icon size={18} className={accent && (value ?? 0) > 0 ? 'text-amber-400' : 'text-primary'} strokeWidth={1.75} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function DashboardPage() {
  const { data: activeSessions, isLoading: loadingActive } = useActiveSessions()
  const { data: alerts, isLoading: loadingAlerts } = useAutoClosedAlerts()
  const today = new Date()
  const todayStr = `${toMonthString(today)}-${String(today.getDate()).padStart(2, '0')}`
  const { data: todaySessions } = useSessions(toMonthString(today))
  const todayCount = todaySessions?.filter(s => s.work_date === todayStr).length

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading font-bold text-3xl text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Pregled trenutnog stanja</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Aktivni danas"
          value={loadingActive ? undefined : todayCount}
          icon={Users}
        />
        <StatCard
          label="Trenutno na poslu"
          value={loadingActive ? undefined : activeSessions?.length ?? 0}
          icon={UserCheck}
        />
        <StatCard
          label="Auto-zatvorene sesije"
          value={loadingAlerts ? undefined : alerts?.length ?? 0}
          icon={AlertTriangle}
          accent
        />
      </div>

      {/* Auto-close alert */}
      {(alerts?.length ?? 0) > 0 && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="text-amber-400" strokeWidth={2} />
            <p className="text-sm font-medium text-amber-300">
              {alerts!.length} {alerts!.length === 1 ? 'sesija automatski zatvorena' : 'sesije automatski zatvorene'} — potrebna provjera
            </p>
          </div>
          <div className="space-y-1.5 pl-5">
            {alerts!.map(s => (
              <Link
                key={s.id}
                to="/sesije/$sessionId"
                params={{ sessionId: s.id }}
                className="flex items-center gap-3 text-sm text-amber-200/70 hover:text-amber-200 transition-colors"
              >
                <span className="font-medium">{s.employees?.ime_prezime}</span>
                <span className="text-amber-400/40">·</span>
                <span>{formatDateTime(s.clock_in)} → {s.clock_out ? formatDateTime(s.clock_out) : '—'}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Live attendance table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Trenutno na poslu</CardTitle>
            {!loadingActive && (activeSessions?.length ?? 0) > 0 && (
              <Badge className="bg-primary/15 text-primary border-primary/20 text-xs">
                {activeSessions!.length} aktivno
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loadingActive ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (activeSessions?.length ?? 0) === 0 ? (
            <p className="text-muted-foreground text-sm py-6 text-center">Nitko trenutno nije na poslu.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wider">Zaposlenik</th>
                  <th className="text-left py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wider">Dolazak</th>
                  <th className="text-right py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wider">Na poslu</th>
                </tr>
              </thead>
              <tbody>
                {activeSessions!.map(s => {
                  const mins = Math.round((Date.now() - new Date(s.clock_in).getTime()) / 60000)
                  const h = Math.floor(mins / 60)
                  const m = mins % 60
                  return (
                    <tr key={s.id} className="border-b border-border/50 last:border-0">
                      <td className="py-3 font-medium">{s.employees?.ime_prezime}</td>
                      <td className="py-3 text-muted-foreground font-mono text-xs">{formatDateTime(s.clock_in)}</td>
                      <td className="py-3 text-right">
                        <span className="font-mono text-xs text-primary">{h}h {String(m).padStart(2, '0')}m</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
