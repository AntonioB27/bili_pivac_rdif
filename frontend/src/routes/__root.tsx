import { createRootRouteWithContext, Link, Outlet, redirect, useNavigate, useLocation } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { LayoutDashboard, Users, Clock, BarChart2, LogOut } from 'lucide-react'
import { supabase } from '../lib/supabase'

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

const NAV = [
  { to: '/dashboard',   label: 'Dashboard',    icon: LayoutDashboard },
  { to: '/zaposlenici', label: 'Zaposlenici',   icon: Users           },
  { to: '/sesije',      label: 'Sesije',        icon: Clock           },
  { to: '/izvjestaji',  label: 'Izvještaji',    icon: BarChart2       },
] as const

function RootLayout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  async function handleSignOut() {
    await supabase.auth.signOut()
    await navigate({ to: '/login' })
  }

  if (pathname === '/login') return <Outlet />

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-56 flex-none flex flex-col bg-sidebar border-r border-sidebar-border">
        {/* Brand */}
        <div className="px-5 pt-7 pb-6 border-b border-sidebar-border">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl leading-none">🐓</span>
            <span className="font-heading font-bold text-lg tracking-wide text-sidebar-foreground">BILI PIVAC</span>
          </div>
          <p className="text-xs text-muted-foreground pl-9">Evidencija radnog vremena</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors [&.active]:bg-sidebar-accent [&.active]:text-primary [&.active]:font-semibold"
            >
              <Icon size={16} strokeWidth={1.75} />
              {label}
            </Link>
          ))}
        </nav>

        {/* Sign out */}
        <div className="px-3 pb-5 border-t border-sidebar-border pt-4">
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 px-3 py-2 rounded-md text-sm text-sidebar-foreground/60 hover:text-destructive hover:bg-sidebar-accent transition-colors"
          >
            <LogOut size={16} strokeWidth={1.75} />
            Odjava
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8 max-w-6xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
