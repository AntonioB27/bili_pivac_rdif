import { createFileRoute, useNavigate, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { ChevronLeft } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useEmployees } from '../../lib/queries/employees'
import { useCreateSession } from '../../lib/queries/sessions'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'

export const Route = createFileRoute('/sesije/nova')({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw redirect({ to: '/login' })
    const { data } = await supabase.from('employees').select('role').eq('id', user.id).single()
    if (data?.role !== 'admin') throw redirect({ to: '/dashboard' })
  },
  component: NovaSesijaPage,
})

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline gap-2">
        <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">{label}</label>
        {hint && <span className="font-mono text-[10px] text-muted-foreground/50">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function NovaSesijaPage() {
  const navigate = useNavigate()
  const { data: employees } = useEmployees()
  const createSession = useCreateSession()
  const [employeeId, setEmployeeId] = useState('')
  const [clockIn, setClockIn] = useState('')
  const [clockOut, setClockOut] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (clockOut && new Date(clockOut) <= new Date(clockIn)) {
      setError('Odlazak mora biti nakon dolaska')
      return
    }
    try {
      await createSession.mutateAsync({
        employee_id: employeeId,
        clock_in: new Date(clockIn).toISOString(),
        clock_out: clockOut ? new Date(clockOut).toISOString() : null,
      })
      toast.success('Sesija dodana')
      navigate({ to: '/sesije' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Greška')
    }
  }

  return (
    <div className="max-w-lg">
      <button onClick={() => navigate({ to: '/sesije' })}
        className="flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors mb-6 uppercase tracking-wider">
        <ChevronLeft size={13} /> Sesije
      </button>

      <div className="mb-8">
        <h1 className="font-heading font-bold text-3xl text-foreground tracking-wide uppercase">Nova sesija</h1>
        <p className="font-mono text-xs text-muted-foreground tracking-wider mt-1">Ručno dodavanje evidencije</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="Zaposlenik" hint="*">
          <Select value={employeeId} onValueChange={setEmployeeId} required>
            <SelectTrigger className="font-mono bg-input border-border focus:border-primary rounded-sm h-10 text-sm">
              <SelectValue placeholder="Odaberi zaposlenika" />
            </SelectTrigger>
            <SelectContent className="font-mono rounded-sm">
              {employees?.map(e => (
                <SelectItem key={e.id} value={e.id}>{e.ime_prezime}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Dolazak" hint="*">
          <Input type="datetime-local" value={clockIn} onChange={e => setClockIn(e.target.value)} required
            className="font-mono bg-input border-border focus-visible:border-primary rounded-sm h-10" />
        </Field>

        <Field label="Odlazak" hint="prazno = aktivna sesija">
          <Input type="datetime-local" value={clockOut} onChange={e => setClockOut(e.target.value)}
            className="font-mono bg-input border-border focus-visible:border-primary rounded-sm h-10" />
        </Field>

        {error && (
          <div className="border border-destructive/40 bg-destructive/10 px-3 py-2.5">
            <p className="font-mono text-xs text-destructive">{error}</p>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={createSession.isPending || !employeeId || !clockIn}
            className="font-heading tracking-wide uppercase text-xs rounded-sm">
            {createSession.isPending ? 'Dodavanje...' : 'Dodaj sesiju'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate({ to: '/sesije' })}
            className="font-mono text-xs rounded-sm">
            Odustani
          </Button>
        </div>
      </form>
    </div>
  )
}
