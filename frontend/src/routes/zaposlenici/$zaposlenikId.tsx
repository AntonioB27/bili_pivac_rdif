import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useEmployee, useUpdateEmployee } from '../../lib/queries/employees'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Card, CardContent } from '../../components/ui/card'
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

  if (isLoading) return <Skeleton className="h-64 w-full max-w-md" />

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-bold mb-6">Uredi zaposlenika</h1>
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><Label htmlFor="ime">Ime i prezime *</Label><Input id="ime" value={form.ime_prezime} onChange={set('ime_prezime')} required /></div>
            <div>
              <Label htmlFor="rfid">RFID UID <span className="text-gray-400">(opcionalno za admin)</span></Label>
              <Input id="rfid" value={form.rfid_uid} onChange={set('rfid_uid')} />
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
            <div>
              <Label htmlFor="pw">Nova lozinka <span className="text-gray-400">(prazno = bez promjene)</span></Label>
              <Input id="pw" type="password" value={form.password} onChange={set('password')} />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={updateEmployee.isPending}>{updateEmployee.isPending ? 'Spremanje...' : 'Spremi'}</Button>
              <Button type="button" variant="outline" onClick={() => navigate({ to: '/zaposlenici' })}>Odustani</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
