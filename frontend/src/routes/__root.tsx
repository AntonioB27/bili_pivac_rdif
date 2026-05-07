import { createRootRouteWithContext, Link, Outlet, redirect, useNavigate, useLocation } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { LayoutDashboard, Users, Clock, BarChart2, LogOut, UserCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useCurrentEmployee } from '../lib/queries/employees'

type RouterContext = { queryClient: QueryClient }

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async ({ location }) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user && location.pathname !== '/login') {
      throw redirect({ to: '/login' })
    }
    if (user && location.pathname === '/login') {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: RootLayout,
})

const ADMIN_NAV = [
  { to: '/dashboard',   label: 'Dashboard',    icon: LayoutDashboard },
  { to: '/zaposlenici', label: 'Zaposlenici',   icon: Users           },
  { to: '/sesije',      label: 'Sesije',        icon: Clock           },
  { to: '/izvjestaji',  label: 'Izvještaji',    icon: BarChart2       },
] as const

const EMPLOYEE_NAV = [
  { to: '/dashboard' as const, label: 'Dashboard',   icon: LayoutDashboard },
  { to: '/sesije'    as const, label: 'Moje smjene', icon: Clock           },
  { to: '/profil',             label: 'Profil',      icon: UserCircle      },
]

function RootLayout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { data: me } = useCurrentEmployee()

  async function handleSignOut() {
    await supabase.auth.signOut()
    await navigate({ to: '/login' })
  }

  if (pathname === '/login') return <Outlet />

  const isAdmin = me?.role === 'admin'
  const nav = isAdmin ? ADMIN_NAV : EMPLOYEE_NAV

  const initials = me?.ime_prezime
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() ?? ''

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-60 flex-none flex flex-col bg-sidebar border-r border-sidebar-border">
        <div className="px-4 pt-6 pb-5 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center flex-none text-2xl leading-none select-none">
              🐓
            </div>
            <div>
              <p className="font-bold text-sm tracking-wide text-sidebar-foreground leading-none">BILI PIVAC</p>
              <p className="text-[10px] text-sidebar-foreground/40 tracking-wider mt-0.5">Podstrana</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-3 px-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/30 px-3 py-2 mb-1">
            Izbornik
          </p>
          {nav.map(({ to, label, icon: Icon }) => {
            const isActive = pathname === to ||
              (to !== '/dashboard' && to !== '/profil' && pathname.startsWith(to))
            return (
              <Link key={to} to={to as any}
                className={`flex items-center gap-3 px-3 py-2.5 text-sm font-semibold transition-all rounded-xl mb-0.5 ${
                  isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent'
                }`}>
                <Icon size={16} strokeWidth={isActive ? 2.2 : 1.75} />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-sidebar-border">
          {me && (
            <div className="px-4 py-3 border-b border-sidebar-border flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/10 text-sidebar-foreground flex items-center justify-center text-xs font-black flex-none">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-sidebar-foreground truncate">{me.ime_prezime}</p>
                <p className="text-[10px] text-sidebar-foreground/40 mt-0.5 uppercase tracking-wider">
                  {me.role === 'admin' ? 'Administrator' : 'Zaposlenik'}
                </p>
              </div>
            </div>
          )}
          <button onClick={handleSignOut}
            className="flex w-full items-center gap-3 px-4 py-3 text-sm font-semibold text-sidebar-foreground/40 hover:text-red-400 hover:bg-sidebar-accent transition-colors">
            <LogOut size={15} strokeWidth={1.75} />
            Odjava
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-8 max-w-6xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
