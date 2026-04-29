import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ChevronLeft } from 'lucide-react'
import { useEmployee, useUpdateEmployee } from '../../lib/queries/employees'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { Skeleton } from '../../components/ui/skeleton'

export const Route = createFileRoute('/zaposlenici/$zaposlenikId')({
  component: EditZaposlenikPage,
})

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
  if (!emp) return <p className="text-muted-foreground">Zaposlenik nije pronađen.</p>

  return (
    <div className="space-y-8 max-w-lg">
      <div>
        <button
          onClick={() => navigate({ to: '/zaposlenici' })}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ChevronLeft size={15} />
          Zaposlenici
        </button>
        <h1 className="font-heading font-bold text-3xl text-foreground">Uredi zaposlenika</h1>
        <p className="text-muted-foreground text-sm mt-1">{emp.ime_prezime}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="ime">Ime i prezime <span className="text-primary">*</span></Label>
          <Input id="ime" value={form.ime_prezime} onChange={set('ime_prezime')} required />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rfid">
            RFID UID
            <span className="text-muted-foreground font-normal ml-1.5 text-xs">(opcionalno za admin)</span>
          </Label>
          <Input id="rfid" value={form.rfid_uid} onChange={set('rfid_uid')} className="font-mono" placeholder="npr. A1B2C3D4" />
        </div>

        <div className="space-y-1.5">
          <Label>Uloga <span className="text-primary">*</span></Label>
          <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v as 'admin' | 'employee' }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="employee">Zaposlenik</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pw">
            Nova lozinka
            <span className="text-muted-foreground font-normal ml-1.5 text-xs">(prazno = bez promjene)</span>
          </Label>
          <Input id="pw" type="password" value={form.password} onChange={set('password')} placeholder="••••••••" />
        </div>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={updateEmployee.isPending}>
            {updateEmployee.isPending ? 'Spremanje...' : 'Spremi promjene'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate({ to: '/zaposlenici' })}>
            Odustani
          </Button>
        </div>
      </form>
    </div>
  )
}
