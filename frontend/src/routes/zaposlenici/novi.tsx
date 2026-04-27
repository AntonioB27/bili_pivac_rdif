import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { useCreateEmployee } from '../../lib/queries/employees'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Card, CardContent } from '../../components/ui/card'
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
    <div className="max-w-md">
      <h1 className="text-2xl font-bold mb-6">Dodaj zaposlenika</h1>
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><Label htmlFor="ime">Ime i prezime *</Label><Input id="ime" value={form.ime_prezime} onChange={set('ime_prezime')} required /></div>
            <div><Label htmlFor="uname">Korisničko ime *</Label><Input id="uname" value={form.username} onChange={set('username')} required /></div>
            <div><Label htmlFor="pw">Lozinka *</Label><Input id="pw" type="password" value={form.password} onChange={set('password')} required /></div>
            <div>
              <Label htmlFor="rfid">RFID UID <span className="text-gray-400">(opcionalno za admin)</span></Label>
              <Input id="rfid" value={form.rfid_uid} onChange={set('rfid_uid')} placeholder="npr. A1B2C3D4" />
            </div>
            <div>
              <Label>Uloga *</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v as 'admin' | 'employee' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Zaposlenik</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={createEmployee.isPending}>{createEmployee.isPending ? 'Dodavanje...' : 'Dodaj'}</Button>
              <Button type="button" variant="outline" onClick={() => navigate({ to: '/zaposlenici' })}>Odustani</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
