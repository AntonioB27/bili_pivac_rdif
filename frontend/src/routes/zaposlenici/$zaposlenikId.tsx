import { createFileRoute, useNavigate, redirect } from '@tanstack/react-router'
import { supabase } from '../../lib/supabase'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ChevronLeft } from 'lucide-react'
import { useEmployee, useUpdateEmployee } from '../../lib/queries/employees'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { Skeleton } from '../../components/ui/skeleton'

export const Route = createFileRoute('/zaposlenici/$zaposlenikId')({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw redirect({ to: '/login' })
    const { data } = await supabase.from('employees').select('role').eq('id', user.id).single()
    if (data?.role !== 'admin') throw redirect({ to: '/dashboard' })
  },
  component: EditZaposlenikPage,
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

function EditZaposlenikPage() {
  const { zaposlenikId } = Route.useParams()
  const navigate = useNavigate()
  const { data: emp, isLoading } = useEmployee(zaposlenikId)
  const updateEmployee = useUpdateEmployee()
  const [form, setForm] = useState({ ime_prezime: '', rfid_uid: '', role: 'employee' as 'admin' | 'employee', password: '' })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (emp) setForm({ ime_prezime: emp.ime_prezime, rfid_uid: emp.rfid_uid ?? '', role: emp.role, password: '' })
  }, [emp])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await updateEmployee.mutateAsync({ id: zaposlenikId, ime_prezime: form.ime_prezime, rfid_uid: form.rfid_uid || undefined, role: form.role, password: form.password || undefined })
      toast.success('Zaposlenik ažuriran')
      navigate({ to: '/zaposlenici' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Greška')
    }
  }

  if (isLoading) return (
    <div className="max-w-lg space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
  if (!emp) return <p className="font-mono text-xs text-muted-foreground">Zaposlenik nije pronađen.</p>

  return (
    <div className="max-w-lg">
      <button onClick={() => navigate({ to: '/zaposlenici' })}
        className="flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors mb-6 uppercase tracking-wider">
        <ChevronLeft size={13} /> Zaposlenici
      </button>

      <div className="mb-8">
        <h1 className="font-heading font-bold text-3xl text-foreground tracking-wide uppercase">Uredi zaposlenika</h1>
        <p className="font-mono text-xs text-muted-foreground tracking-wider mt-1">{emp.ime_prezime}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="Ime i prezime" hint="*">
          <Input value={form.ime_prezime} onChange={set('ime_prezime')} required
            className="font-sans bg-input border-border focus-visible:border-primary rounded-sm h-10" />
        </Field>

        <Field label="RFID UID" hint="opcionalno">
          <Input value={form.rfid_uid} onChange={set('rfid_uid')} placeholder="npr. A1B2C3D4"
            className="font-mono bg-input border-border focus-visible:border-primary rounded-sm h-10 uppercase" />
        </Field>

        <Field label="Uloga" hint="*">
          <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v as 'admin' | 'employee' }))}>
            <SelectTrigger className="font-mono bg-input border-border focus:border-primary rounded-sm h-10 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="font-mono rounded-sm">
              <SelectItem value="employee">Zaposlenik</SelectItem>
              <SelectItem value="admin">Administrator</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="Nova lozinka" hint="prazno = bez promjene">
          <Input type="password" value={form.password} onChange={set('password')} placeholder="••••••••"
            className="font-mono bg-input border-border focus-visible:border-primary rounded-sm h-10" />
        </Field>

        {error && (
          <div className="border border-destructive/40 bg-destructive/10 px-3 py-2.5">
            <p className="font-mono text-xs text-destructive">{error}</p>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={updateEmployee.isPending}
            className="font-heading tracking-wide uppercase text-xs rounded-sm">
            {updateEmployee.isPending ? 'Spremanje...' : 'Spremi promjene'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate({ to: '/zaposlenici' })}
            className="font-mono text-xs rounded-sm">
            Odustani
          </Button>
        </div>
      </form>
    </div>
  )
}
