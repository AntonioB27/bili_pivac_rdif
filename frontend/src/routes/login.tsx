import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LiveClock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    <div className="text-center">
      <div className="font-mono text-6xl font-semibold tracking-widest text-primary leading-none tabular-nums">
        {pad(time.getHours())}:{pad(time.getMinutes())}:{pad(time.getSeconds())}
      </div>
      <div className="font-mono text-xs text-sidebar-foreground/50 tracking-widest mt-3 uppercase">
        {time.toLocaleDateString('hr-HR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
      </div>
    </div>
  )
}

function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: `${username}@rfid-bp.local`,
      password,
    })
    if (error) {
      setError('Pogrešno korisničko ime ili lozinka')
      setLoading(false)
      return
    }
    setLoading(false)
    await navigate({ to: '/dashboard' })
  }

  return (
    <div className="min-h-screen bg-background flex">

      {/* Left panel */}
      <div className="hidden lg:flex w-[45%] flex-col bg-sidebar border-r border-sidebar-border relative overflow-hidden">
        {/* Grid texture */}
        <div className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: 'linear-gradient(rgb(255 255 255) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="relative flex flex-col items-center justify-center flex-1 px-12 gap-12">
          {/* Brand */}
          <div className="text-center">
            <div className="text-7xl mb-6 leading-none select-none">🐓</div>
            <h1 className="font-heading font-bold text-5xl tracking-[0.25em] text-sidebar-foreground uppercase">
              Bili Pivac
            </h1>
            <p className="font-mono text-xs text-sidebar-foreground/50 tracking-[0.3em] uppercase mt-3">
              Evidencija radnog vremena
            </p>
          </div>

          {/* Live clock */}
          <LiveClock />

          {/* Decorative divider */}
          <div className="flex items-center gap-3 w-full max-w-xs">
            <div className="flex-1 h-px bg-white/15" />
            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
            <div className="flex-1 h-px bg-white/15" />
          </div>

          <p className="font-mono text-[10px] text-sidebar-foreground/30 tracking-widest uppercase text-center">
            RFID sustav • v1.0
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-8 bg-background">
        <div className="w-full max-w-sm bg-card rounded-2xl shadow-xl p-8">

          {/* Mobile brand */}
          <div className="lg:hidden text-center mb-10">
            <span className="text-5xl">🐓</span>
            <p className="font-heading font-bold text-3xl tracking-[0.2em] text-foreground mt-2 uppercase">Bili Pivac</p>
          </div>

          <div className="mb-8">
            <h2 className="font-heading font-bold text-2xl text-foreground tracking-wide">Prijava</h2>
            <p className="text-sm text-muted-foreground mt-1 font-mono">Unesite pristupne podatke</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-muted-foreground uppercase tracking-widest" htmlFor="username">
                Korisničko ime
              </label>
              <Input
                id="username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                required
                placeholder="korisnik"
                className="font-mono bg-input border-border focus-visible:border-primary h-10"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-muted-foreground uppercase tracking-widest" htmlFor="password">
                Lozinka
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                placeholder="••••••••"
                className="font-mono bg-input border-border focus-visible:border-primary h-10"
              />
            </div>

            {error && (
              <div className="border border-destructive/40 bg-destructive/10 px-3 py-2.5 rounded-sm">
                <p className="text-xs font-mono text-destructive">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-10 font-heading font-semibold tracking-widest uppercase text-sm mt-2"
              disabled={loading}
            >
              {loading ? '...' : 'Prijavi se'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
