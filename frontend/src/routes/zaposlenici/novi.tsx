import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { ChevronLeft } from 'lucide-react'
import { useCreateEmployee } from '../../lib/queries/employees'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'

export const Route = createFileRoute('/zaposlenici/novi')({
  component: NoviZaposlenikPage,
})

function NoviZaposlenikPage() {
  const navigate = useNavigate()
  const createEmployee = useCreateEmployee()
  const [form, setForm] = useState({ ime_prezime: '', username: '', password: '', rfid_uid: '', role: 'employee' as 'admin' | 'employee' })
  const [error, setError] = useState<string | null>(null)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await createEmployee.mutateAsync({ ...form, rfid_uid: form.rfid_uid || undefined })
      toast.success('Zaposlenik dodan')
      navigate({ to: '/zaposlenici' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Greška')
    }
  }

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
        <h1 className="font-heading font-bold text-3xl text-foreground">Dodaj zaposlenika</h1>
        <p className="text-muted-foreground text-sm mt-1">Novi korisnički račun i pristupna kartica</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="ime">Ime i prezime <span className="text-primary">*</span></Label>
          <Input id="ime" value={form.ime_prezime} onChange={set('ime_prezime')} placeholder="Ivan Horvat" required />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="uname">Korisničko ime <span className="text-primary">*</span></Label>
          <Input id="uname" value={form.username} onChange={set('username')} placeholder="ihorvat" required />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pw">Lozinka <span className="text-primary">*</span></Label>
          <Input id="pw" type="password" value={form.password} onChange={set('password')} placeholder="••••••••" required />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rfid">
            RFID UID
            <span className="text-muted-foreground font-normal ml-1.5 text-xs">(opcionalno za admin)</span>
          </Label>
          <Input id="rfid" value={form.rfid_uid} onChange={set('rfid_uid')} placeholder="npr. A1B2C3D4" className="font-mono" />
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

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={createEmployee.isPending}>
            {createEmployee.isPending ? 'Dodavanje...' : 'Dodaj zaposlenika'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate({ to: '/zaposlenici' })}>
            Odustani
          </Button>
        </div>
      </form>
    </div>
  )
}
