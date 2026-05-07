import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ChevronLeft, Trash2 } from 'lucide-react'
import { useSession, useUpdateSession, useDeleteSession } from '../../lib/queries/sessions'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Skeleton } from '../../components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog'
import { Field } from '../../components/ui/field'

export const Route = createFileRoute('/sesije/$sessionId')({
  component: EditSesijaPage,
})

function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}


function EditSesijaPage() {
  const { sessionId } = Route.useParams()
  const navigate = useNavigate()
  const { data: session, isLoading } = useSession(sessionId)
  const updateSession = useUpdateSession()
  const deleteSession = useDeleteSession()
  const [clockIn, setClockIn] = useState('')
  const [clockOut, setClockOut] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (session) {
      setClockIn(toLocalInput(session.clock_in))
      setClockOut(session.clock_out ? toLocalInput(session.clock_out) : '')
    }
  }, [session])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (clockOut && new Date(clockOut) <= new Date(clockIn)) {
      setError('Odlazak mora biti nakon dolaska')
      return
    }
    try {
      await updateSession.mutateAsync({
        id: sessionId,
        clock_in: new Date(clockIn).toISOString(),
        clock_out: clockOut ? new Date(clockOut).toISOString() : null,
      })
      toast.success('Sesija ažurirana')
      navigate({ to: '/sesije' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Greška')
    }
  }

  async function handleDelete() {
    try {
      await deleteSession.mutateAsync(sessionId)
      toast.success('Sesija obrisana')
      navigate({ to: '/sesije' })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Greška pri brisanju')
    }
  }

  if (isLoading) return (
    <div className="max-w-lg space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-52 w-full" />
    </div>
  )
  if (!session) return <p className="font-mono text-xs text-muted-foreground">Sesija nije pronađena.</p>

  return (
    <div className="max-w-lg">
      <button onClick={() => navigate({ to: '/sesije' })}
        className="flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors mb-6 uppercase tracking-wider">
        <ChevronLeft size={13} /> Sesije
      </button>

      <div className="mb-8">
        <div className="flex items-center gap-3 flex-wrap mb-1">
          <h1 className="font-heading font-bold text-3xl text-foreground tracking-wide uppercase">Uredi sesiju</h1>
          {session.is_auto_closed && (
            <span className="font-mono text-[10px] px-2 py-0.5 border border-amber-500/30 text-amber-400 bg-amber-500/5 uppercase tracking-widest">
              auto-zatvoreno
            </span>
          )}
        </div>
        <p className="font-mono text-xs text-muted-foreground tracking-wider">{session.employees?.ime_prezime}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="Dolazak" hint="*" htmlFor="clock-in">
          <Input id="clock-in" type="datetime-local" value={clockIn} onChange={e => setClockIn(e.target.value)} required
            className="font-mono bg-input border-border focus-visible:border-primary rounded-sm h-10" />
        </Field>

        <Field label="Odlazak" hint="prazno = još na poslu" htmlFor="clock-out">
          <Input id="clock-out" type="datetime-local" value={clockOut} onChange={e => setClockOut(e.target.value)}
            className="font-mono bg-input border-border focus-visible:border-primary rounded-sm h-10" />
        </Field>

        {error && (
          <div className="border border-destructive/40 bg-destructive/10 px-3 py-2.5">
            <p className="font-mono text-xs text-destructive">{error}</p>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={updateSession.isPending}
            className="font-heading tracking-wide uppercase text-xs rounded-sm">
            {updateSession.isPending ? 'Spremanje...' : 'Spremi promjene'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate({ to: '/sesije' })}
            className="font-mono text-xs rounded-sm">
            Odustani
          </Button>
          <Button type="button" variant="ghost" size="sm" aria-label="Obriši sesiju"
            className="ml-auto h-9 w-9 p-0 text-muted-foreground/40 hover:text-destructive hover:bg-red-50 rounded-sm"
            onClick={() => setConfirmDelete(true)}>
            <Trash2 size={14} />
          </Button>
        </div>
      </form>

      <Dialog open={confirmDelete} onOpenChange={open => !open && setConfirmDelete(false)}>
        <DialogContent className="rounded-sm">
          <DialogHeader>
            <DialogTitle className="font-heading tracking-wide uppercase">Brisanje sesije</DialogTitle>
            <DialogDescription className="font-mono text-xs leading-relaxed">
              Sigurno želiš obrisati ovu sesiju za{' '}
              <strong className="text-foreground">{session.employees?.ime_prezime}</strong>?
              Ova radnja se ne može poništiti.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(false)}
              className="rounded-sm font-mono text-xs">Odustani</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteSession.isPending}
              className="rounded-sm font-mono text-xs">
              {deleteSession.isPending ? 'Brisanje...' : 'Obriši sesiju'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
