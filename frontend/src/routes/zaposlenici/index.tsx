import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { useEmployees, useDeleteEmployee } from '../../lib/queries/employees'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Skeleton } from '../../components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog'

export const Route = createFileRoute('/zaposlenici/')({
  component: ZaposlednikListPage,
})

function ZaposlednikListPage() {
  const { data: employees, isLoading } = useEmployees()
  const deleteEmployee = useDeleteEmployee()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const toDelete = employees?.find(e => e.id === deleteId)

  async function handleDelete() {
    if (!deleteId) return
    try {
      await deleteEmployee.mutateAsync(deleteId)
      toast.success('Zaposlenik obrisan')
      setDeleteId(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Greška pri brisanju')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Zaposlenici</h1>
        <Button asChild><Link to="/zaposlenici/novi">Dodaj zaposlenika</Link></Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : (employees?.length ?? 0) === 0 ? (
        <p className="text-gray-500 text-sm">Nema zaposlenika. <Link to="/zaposlenici/novi" className="underline">Dodaj prvog.</Link></p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 font-medium text-gray-500">Ime i prezime</th>
              <th className="text-left py-2 font-medium text-gray-500">Username</th>
              <th className="text-left py-2 font-medium text-gray-500">RFID UID</th>
              <th className="text-left py-2 font-medium text-gray-500">Uloga</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {employees!.map(emp => (
              <tr key={emp.id} className="border-b last:border-0">
                <td className="py-2">{emp.ime_prezime}</td>
                <td className="py-2 text-gray-500">{emp.username}</td>
                <td className="py-2 text-gray-500 font-mono text-xs">{emp.rfid_uid ?? '—'}</td>
                <td className="py-2">
                  <Badge variant={emp.role === 'admin' ? 'default' : 'secondary'}>
                    {emp.role === 'admin' ? 'Admin' : 'Zaposlenik'}
                  </Badge>
                </td>
                <td className="py-2 text-right space-x-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/zaposlenici/$zaposlenikId" params={{ zaposlenikId: emp.id }}>Uredi</Link>
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => setDeleteId(emp.id)}>Briši</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Dialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Brisanje zaposlenika</DialogTitle>
            <DialogDescription>
              Sigurno želiš obrisati <strong>{toDelete?.ime_prezime}</strong>? Briše se i sva evidencija radnog vremena. Ako zaposlenik ima otvorenu sesiju, bit će automatski zatvorena.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Odustani</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteEmployee.isPending}>
              {deleteEmployee.isPending ? 'Brisanje...' : 'Obriši'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
