import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { useCurrentEmployee } from '../lib/queries/employees'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Field } from '../components/ui/field'

export const Route = createFileRoute('/profil')({
  component: ProfilPage,
})

function ProfilPage() {
  const { data: me } = useCurrentEmployee()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) { setError('Lozinka mora imati najmanje 6 znakova'); return }
    if (password !== confirm) { setError('Lozinke se ne podudaraju'); return }
    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (err) { setError(`Greška: ${err.message}`); return }
    toast.success('Lozinka uspješno promijenjena')
    setPassword('')
    setConfirm('')
  }

  return (
    <div className="max-w-sm">
      <div className="mb-8">
        <h1 className="font-heading font-bold text-3xl text-foreground tracking-wide uppercase">Profil</h1>
        <p className="font-mono text-xs text-muted-foreground tracking-wider mt-1">{me?.ime_prezime}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="Nova lozinka" hint="min. 6 znakova" htmlFor="new-password">
          <Input id="new-password" type="password" value={password} onChange={e => setPassword(e.target.value)}
            required placeholder="••••••••"
            className="font-mono bg-input border-border focus-visible:border-primary rounded-sm h-10" />
        </Field>

        <Field label="Potvrdi lozinku" hint="*" htmlFor="confirm-password">
          <Input id="confirm-password" type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
            required placeholder="••••••••"
            className="font-mono bg-input border-border focus-visible:border-primary rounded-sm h-10" />
        </Field>

        {error && (
          <div className="border border-destructive/40 bg-destructive/10 px-3 py-2.5">
            <p className="font-mono text-xs text-destructive">{error}</p>
          </div>
        )}

        <Button type="submit" disabled={loading}
          className="font-heading tracking-wide uppercase text-xs rounded-sm">
          {loading ? 'Spremanje...' : 'Promijeni lozinku'}
        </Button>
      </form>
    </div>
  )
}
