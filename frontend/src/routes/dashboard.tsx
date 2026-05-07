import { createFileRoute, Link } from '@tanstack/react-router'
import { AlertTriangle, UserCheck, LogOut, TrendingUp } from 'lucide-react'
import { useActiveSessions, useAutoClosedAlerts, useSessions, useClockOutSession } from '../lib/queries/sessions'
import { useCurrentEmployee } from '../lib/queries/employees'
import { Skeleton } from '../components/ui/skeleton'
import { Button } from '../components/ui/button'
import { formatDateTime, toMonthString } from '../lib/utils'
import { toast } from 'sonner'

export const Route = createFileRoute('/dashboard')({
  component: DashboardPage,
})

const STAT_VARIANTS = {
  green: 'bg-green-50 text-green-600',
  red:   'bg-red-50 text-red-500',
  amber: 'bg-amber-50 text-amber-600',
  blue:  'bg-blue-50 text-blue-600',
} as const

function StatBox({ label, value, sub, icon: Icon, variant = 'green' as keyof typeof STAT_VARIANTS }: {
  label: string; value: number | undefined; sub?: string; icon: React.ElementType; variant?: keyof typeof STAT_VARIANTS
}) {
  return (
    <div className="bg-card rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">{label}</p>
        {value === undefined
          ? <Skeleton className="h-9 w-14" />
          : <p className="text-4xl font-black text-foreground leading-none tabular-nums">{value}</p>
        }
        {sub && <p className="text-xs text-muted-foreground font-semibold mt-1.5">{sub}</p>}
      </div>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${STAT_VARIANTS[variant]}`}>
        <Icon size={20} />
      </div>
    </div>
  )
}

function HoursCard({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min((value / max) * 100, 100)
  const h = Math.floor(value)
  const m = Math.round((value - h) * 60)
  return (
    <div className="bg-card rounded-2xl p-6 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-3">{label}</p>
      <p className="text-3xl font-black text-foreground leading-none">
        {h}<span className="text-sm text-muted-foreground font-semibold ml-1">h{m > 0 ? ` ${m}m` : ''}</span>
      </p>
      <div className="mt-3 h-1.5 bg-border rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[11px] text-muted-foreground font-semibold mt-1.5">Cilj: {max}h</p>
    </div>
  )
}

function AdminDashboard() {
  const { data: activeSessions, isLoading: loadingActive } = useActiveSessions()
  const clockOut = useClockOutSession()
  const today = new Date()
  const weekDay = today.getDay() === 0 ? 6 : today.getDay() - 1
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - weekDay)
  weekStart.setHours(0, 0, 0, 0)
  const { data: alerts, isLoading: loadingAlerts } = useAutoClosedAlerts(weekStart)
  const todayStr = `${toMonthString(today)}-${String(today.getDate()).padStart(2, '0')}`
  const { data: todaySessions } = useSessions(toMonthString(today))
  const todayCount = todaySessions?.filter(s => s.work_date === todayStr).length

  return (
    <>
      <div className="mb-8">
        <h1 className="font-black text-3xl text-foreground">Upravljačka ploča</h1>
        <p className="text-sm text-muted-foreground mt-1 font-medium">Pregled trenutnog stanja</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatBox label="Aktivni danas"         value={loadingActive  ? undefined : todayCount}                  icon={TrendingUp}  variant="blue"  sub="zaposlenika prijavilo" />
        <StatBox label="Trenutno na poslu"     value={loadingActive  ? undefined : activeSessions?.length ?? 0} icon={UserCheck}   variant="green" sub="aktivne sesije" />
        <StatBox label="Auto-zatvorene sesije" value={loadingAlerts  ? undefined : alerts?.length ?? 0}         icon={AlertTriangle} variant="amber" sub="ovaj tjedan" />
      </div>

      {/* Alert strip */}
      {(alerts?.length ?? 0) > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 mb-8">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} className="text-amber-600" strokeWidth={2} />
            <p className="text-sm font-bold text-amber-800">
              {alerts!.length} {alerts!.length === 1 ? 'sesija automatski zatvorena' : 'sesije automatski zatvorene'}
            </p>
          </div>
          <div className="space-y-1 pl-5">
            {alerts!.map(s => (
              <Link key={s.id} to="/sesije/$sessionId" params={{ sessionId: s.id }}
                className="flex items-center gap-3 text-sm font-semibold text-amber-700/60 hover:text-amber-700 transition-colors">
                <span>{s.employees?.ime_prezime}</span>
                <span className="text-amber-400">—</span>
                <span>{formatDateTime(s.clock_in)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Live table */}
      <div className="bg-card rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <p className="font-bold text-base text-foreground">Trenutno na poslu</p>
          {!loadingActive && (activeSessions?.length ?? 0) > 0 && (
            <span className="text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-3 py-1 rounded-full">
              {activeSessions!.length} aktivno
            </span>
          )}
        </div>
        {loadingActive ? (
          <div className="p-6 space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : (activeSessions?.length ?? 0) === 0 ? (
          <div className="py-16 text-center">
            <p className="text-4xl mb-3">😴</p>
            <p className="text-sm font-bold text-muted-foreground">Nitko trenutno nije na poslu</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/60 border-b border-border">
                <th className="text-left px-6 py-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Zaposlenik</th>
                <th className="text-left px-6 py-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Dolazak</th>
                <th className="text-right px-6 py-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Na poslu</th>
                <th className="w-14" />
              </tr>
            </thead>
            <tbody>
              {activeSessions!.map(s => {
                const mins = Math.round((Date.now() - new Date(s.clock_in).getTime()) / 60000)
                const h = Math.floor(mins / 60), m = mins % 60
                return (
                  <tr key={s.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 font-bold text-foreground">{s.employees?.ime_prezime}</td>
                    <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{formatDateTime(s.clock_in)}</td>
                    <td className="px-6 py-4 text-right font-bold text-primary">
                      {h}h {String(m).padStart(2, '0')}m
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button size="sm" variant="ghost"
                        className="h-7 w-7 p-0 text-muted-foreground/40 hover:text-destructive hover:bg-red-50 rounded-lg"
                        disabled={clockOut.isPending}
                        onClick={() => clockOut.mutate(
                          { id: s.id, clock_in: s.clock_in },
                          {
                            onSuccess: () => toast.success(`${s.employees?.ime_prezime} odjavljeni`),
                            onError: (e) => toast.error(`Greška: ${e.message}`),
                          }
                        )}>
                        <LogOut size={13} />
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

function EmployeeDashboard({ employeeId }: { employeeId: string }) {
  const { data: me } = useCurrentEmployee()
  const today = new Date()
  const todayStr = `${toMonthString(today)}-${String(today.getDate()).padStart(2, '0')}`
  const { data: sessions, isLoading } = useSessions(toMonthString(today), employeeId)
  const activeSession = sessions?.find(s => s.clock_out === null)

  const todayMins = sessions?.filter(s => s.work_date === todayStr).reduce((a, s) => a + (s.duration_min ?? 0), 0) ?? 0
  const monthMins = sessions?.reduce((a, s) => a + (s.duration_min ?? 0), 0) ?? 0
  const weekDay = today.getDay() === 0 ? 6 : today.getDay() - 1
  const weekStartDate = new Date(today)
  weekStartDate.setDate(today.getDate() - weekDay)
  const weekStartStr = `${toMonthString(weekStartDate)}-${String(weekStartDate.getDate()).padStart(2, '0')}`
  const weekMins = sessions?.filter(s => s.work_date >= weekStartStr).reduce((a, s) => a + (s.duration_min ?? 0), 0) ?? 0

  const recentSessions = sessions?.filter(s => s.clock_out !== null).slice(-5).reverse() ?? []

  return (
    <>
      <div className="mb-8">
        <h1 className="font-black text-3xl text-foreground">Moja ploča</h1>
        <p className="text-sm text-muted-foreground mt-1 font-medium">Vaš pregled radnog vremena</p>
      </div>

      {/* Clock status card */}
      <div className="rounded-2xl p-8 flex items-center justify-between gap-6 flex-wrap mb-8"
        style={{ background: 'linear-gradient(135deg, oklch(0.235 0.050 145) 0%, oklch(0.320 0.065 145) 100%)' }}>
        <div>
          <p className="text-sm font-semibold text-white/55 mb-1">Dobar dan,</p>
          <p className="text-2xl font-black text-white mb-2">{me?.ime_prezime}</p>
          <div className="flex items-center gap-2 text-sm font-semibold text-white/65">
            <span className={`w-2 h-2 rounded-full flex-none ${activeSession ? 'bg-green-400 animate-pulse' : 'bg-white/30'}`} />
            {activeSession
              ? `Na poslu od ${formatDateTime(activeSession.clock_in)}`
              : 'Trenutno niste na poslu'}
          </div>
        </div>
        <div className={`px-5 py-3 rounded-2xl font-bold text-sm flex items-center gap-2.5 ${
          activeSession
            ? 'bg-green-900/40 border border-green-500/30 text-green-300'
            : 'bg-white/10 border border-white/20 text-white/50'
        }`}>
          <span className={`w-2 h-2 rounded-full flex-none ${activeSession ? 'bg-green-400' : 'bg-white/30'}`} />
          {activeSession ? 'Na poslu' : 'Odsutan/a'}
        </div>
      </div>

      {/* Hours summary */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[1,2,3].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <HoursCard label="Danas"        value={todayMins / 60} max={8}   />
          <HoursCard label="Ovaj tjedan"  value={weekMins  / 60} max={40}  />
          <HoursCard label="Ovaj mjesec"  value={monthMins / 60} max={160} />
        </div>
      )}

      {/* Recent sessions */}
      <div className="bg-card rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <p className="font-bold text-base text-foreground">Moje nedavne smjene</p>
        </div>
        {isLoading ? (
          <div className="p-6 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : recentSessions.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-3xl mb-3">📋</p>
            <p className="text-sm font-bold text-muted-foreground">Nema nedavnih smjena</p>
          </div>
        ) : (
          recentSessions.map(s => (
            <div key={s.id} className="flex items-center gap-4 px-6 py-4 border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground">{s.work_date}</p>
                <p className="text-xs text-muted-foreground font-semibold mt-0.5 font-mono">
                  {formatDateTime(s.clock_in)} – {s.clock_out ? formatDateTime(s.clock_out) : '—'}
                </p>
              </div>
              {s.duration_min != null && (
                <p className="text-sm font-black text-foreground whitespace-nowrap">
                  {Math.floor(s.duration_min / 60)}h {String(s.duration_min % 60).padStart(2, '0')}m
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </>
  )
}

function DashboardPage() {
  const { data: me, isLoading } = useCurrentEmployee()

  if (isLoading) return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-48" />
      <div className="grid grid-cols-3 gap-4">{[1,2,3].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div>
    </div>
  )

  if (me?.role === 'admin') return <AdminDashboard />
  if (me) return <EmployeeDashboard employeeId={me.id} />
  return null
}
