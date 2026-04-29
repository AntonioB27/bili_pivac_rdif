import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { UserPlus, Pencil, Trash2 } from 'lucide-react'
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
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading font-bold text-3xl text-foreground">Zaposlenici</h1>
          <p className="text-muted-foreground text-sm mt-1">Upravljanje zaposlenicima i RFID karticama</p>
        </div>
        <Button asChild size="sm" className="gap-2">
          <Link to="/zaposlenici/novi">
            <UserPlus size={15} strokeWidth={2} />
            Dodaj zaposlenika
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : (employees?.length ?? 0) === 0 ? (
        <div className="text-center py-16 rounded-lg border border-dashed border-border">
          <p className="text-muted-foreground text-sm">Nema zaposlenika.</p>
          <Link to="/zaposlenici/novi" className="text-sm text-primary hover:underline mt-1 inline-block">
            Dodaj prvog zaposlenika
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Ime i prezime</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Username</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">RFID UID</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Uloga</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {employees!.map((emp, i) => (
                <tr key={emp.id} className={`border-t border-border/50 hover:bg-muted/20 transition-colors ${i === 0 ? 'border-t border-border' : ''}`}>
                  <td className="px-4 py-3 font-medium">{emp.ime_prezime}</td>
                  <td className="px-4 py-3 text-muted-foreground">{emp.username}</td>
                  <td className="px-4 py-3">
                    {emp.rfid_uid
                      ? <span className="font-mono text-xs text-foreground/80 bg-muted/50 px-2 py-0.5 rounded">{emp.rfid_uid}</span>
                      : <span className="text-muted-foreground text-xs">—</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={emp.role === 'admin' ? 'default' : 'secondary'}
                      className={emp.role === 'admin' ? 'bg-primary/15 text-primary border-primary/20 text-xs' : 'text-xs'}
                    >
                      {emp.role === 'admin' ? 'Admin' : 'Zaposlenik'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0 hover:text-primary">
                        <Link to="/zaposlenici/$zaposlenikId" params={{ zaposlenikId: emp.id }}>
                          <Pencil size={14} />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteId(emp.id)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
