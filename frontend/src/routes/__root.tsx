import { createRootRouteWithContext, Link, Outlet, redirect, useNavigate, useLocation } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

type RouterContext = { queryClient: QueryClient }

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async ({ location }) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session && location.pathname !== '/login') {
      throw redirect({ to: '/login' })
    }
    if (session && location.pathname === '/login') {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: RootLayout,
})

function RootLayout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate({ to: '/login' })
  }

  if (pathname === '/login') return <Outlet />

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex gap-6 items-center">
        <span className="font-semibold text-gray-800 mr-2">RFID BP</span>
        <Link to="/dashboard" className="text-sm text-gray-600 hover:text-gray-900 [&.active]:font-semibold [&.active]:text-gray-900">Dashboard</Link>
        <Link to="/zaposlenici" className="text-sm text-gray-600 hover:text-gray-900 [&.active]:font-semibold [&.active]:text-gray-900">Zaposlenici</Link>
        <Link to="/sesije" className="text-sm text-gray-600 hover:text-gray-900 [&.active]:font-semibold [&.active]:text-gray-900">Sesije</Link>
        <Link to="/izvjestaji" className="text-sm text-gray-600 hover:text-gray-900 [&.active]:font-semibold [&.active]:text-gray-900">Izvještaji</Link>
        <button className="ml-auto text-sm text-gray-600 hover:text-gray-900" onClick={handleSignOut}>
          Odjava
        </button>
      </nav>
      <main className="p-6 max-w-7xl mx-auto">
        <Outlet />
      </main>
    </div>
  )
}
