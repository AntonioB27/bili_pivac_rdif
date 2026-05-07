import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { supabase } from '../../lib/supabase'
import { useState } from 'react'
import { toast } from 'sonner'
import { UserPlus, Pencil, Trash2, CreditCard } from 'lucide-react'
import { useEmployees, useDeleteEmployee } from '../../lib/queries/employees'
import { Button } from '../../components/ui/button'
import { Skeleton } from '../../components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog'

export const Route = createFileRoute('/zaposlenici/')({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw redirect({ to: '/login' })
    const { data } = await supabase.from('employees').select('role').eq('id', user.id).single()
    if (data?.role !== 'admin') throw redirect({ to: '/dashboard' })
  },
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
    <>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-heading font-bold text-3xl text-foreground tracking-wide uppercase">Zaposlenici</h1>
          <p className="font-mono text-xs text-muted-foreground tracking-wider mt-1">Upravljanje zaposlenicima i RFID karticama</p>
        </div>
        <Button asChild size="sm" className="gap-2 font-heading tracking-wide uppercase text-xs rounded-sm">
          <Link to="/zaposlenici/novi">
            <UserPlus size={13} strokeWidth={2} />
            Dodaj
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-1">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : (employees?.length ?? 0) === 0 ? (
        <div className="border border-dashed border-border text-center py-16">
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Nema zaposlenika</p>
          <Link to="/zaposlenici/novi" className="font-mono text-xs text-primary hover:underline mt-2 inline-block">
            Dodaj prvog zaposlenika →
          </Link>
        </div>
      ) : (
        <div className="border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="text-left px-4 py-2.5 font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Ime i prezime</th>
                <th className="text-left px-4 py-2.5 font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Username</th>
                <th className="text-left px-4 py-2.5 font-mono text-[10px] text-muted-foreground uppercase tracking-widest">RFID UID</th>
                <th className="text-left px-4 py-2.5 font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Uloga</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {employees!.map(emp => (
                <tr key={emp.id} className="border-t border-border/40 hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-3 font-medium">{emp.ime_prezime}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{emp.username}</td>
                  <td className="px-4 py-3">
                    {emp.rfid_uid ? (
                      <span className="inline-flex items-center gap-1.5 font-mono text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-0.5">
                        <CreditCard size={10} />
                        {emp.rfid_uid}
                      </span>
                    ) : (
                      <span className="font-mono text-xs text-muted-foreground/40">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-mono text-[10px] px-2 py-0.5 uppercase tracking-wider border ${
                      emp.role === 'admin'
                        ? 'text-primary border-primary/30 bg-primary/10'
                        : 'text-muted-foreground border-border bg-muted/20'
                    }`}>
                      {emp.role === 'admin' ? 'Admin' : 'Zaposlenik'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" asChild className="h-7 w-7 p-0 hover:text-primary rounded-sm">
                        <Link to="/zaposlenici/$zaposlenikId" params={{ zaposlenikId: emp.id }}>
                          <Pencil size={13} />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="sm"
                        className="h-7 w-7 p-0 hover:text-destructive hover:bg-destructive/10 rounded-sm"
                        onClick={() => setDeleteId(emp.id)}>
                        <Trash2 size={13} />
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
        <DialogContent className="rounded-sm">
          <DialogHeader>
            <DialogTitle className="font-heading tracking-wide uppercase">Brisanje zaposlenika</DialogTitle>
            <DialogDescription className="font-mono text-xs leading-relaxed">
              Sigurno želiš obrisati <strong className="text-foreground">{toDelete?.ime_prezime}</strong>?
              Briše se i sva evidencija radnog vremena.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)} className="rounded-sm font-mono text-xs">Odustani</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteEmployee.isPending} className="rounded-sm font-mono text-xs">
              {deleteEmployee.isPending ? 'Brisanje...' : 'Obriši'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
