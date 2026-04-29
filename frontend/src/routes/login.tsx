import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Button } from '../components/ui/button'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

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
      {/* Left brand panel */}
      <div className="hidden lg:flex w-2/5 flex-col items-center justify-center bg-sidebar border-r border-sidebar-border relative overflow-hidden">
        <div className="absolute inset-0 opacity-5 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle at 60% 40%, oklch(0.72 0.19 143) 0%, transparent 60%)' }}
        />
        <div className="relative text-center space-y-4">
          <div className="text-8xl leading-none">🐓</div>
          <div>
            <p className="font-heading font-bold text-4xl tracking-widest text-sidebar-foreground">BILI PIVAC</p>
            <p className="text-sm text-muted-foreground mt-2 tracking-wider uppercase">Evidencija radnog vremena</p>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile brand */}
          <div className="lg:hidden text-center">
            <span className="text-5xl">🐓</span>
            <p className="font-heading font-bold text-2xl tracking-widest text-foreground mt-2">BILI PIVAC</p>
          </div>

          <div className="space-y-2">
            <h1 className="font-heading font-semibold text-2xl text-foreground">Prijava</h1>
            <p className="text-sm text-muted-foreground">Unesite podatke za pristup sustavu</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="username">Korisničko ime</Label>
              <Input
                id="username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                required
                placeholder="korisnik"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Lozinka</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Prijava...' : 'Prijavi se'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
