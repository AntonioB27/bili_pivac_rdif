import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ChevronLeft } from 'lucide-react'
import { useSession, useUpdateSession } from '../../lib/queries/sessions'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Badge } from '../../components/ui/badge'
import { Skeleton } from '../../components/ui/skeleton'

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
  const [clockIn, setClockIn] = useState('')
  const [clockOut, setClockOut] = useState('')
  const [error, setError] = useState<string | null>(null)

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

  if (isLoading) return (
    <div className="max-w-lg space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-52 w-full" />
    </div>
  )
  if (!session) return <p className="text-muted-foreground">Sesija nije pronađena.</p>

  return (
    <div className="space-y-8 max-w-lg">
      <div>
        <button
          onClick={() => navigate({ to: '/sesije' })}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ChevronLeft size={15} />
          Sesije
        </button>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-heading font-bold text-3xl text-foreground">Uredi sesiju</h1>
          {session.is_auto_closed && (
            <Badge variant="outline" className="text-amber-400 border-amber-400/30 bg-amber-400/5">
              auto-zatvoreno
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground text-sm mt-1">{session.employees?.ime_prezime}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="ci">Dolazak <span className="text-primary">*</span></Label>
          <Input
            id="ci"
            type="datetime-local"
            value={clockIn}
            onChange={e => setClockIn(e.target.value)}
            required
            className="font-mono"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="co">
            Odlazak
            <span className="text-muted-foreground font-normal ml-1.5 text-xs">(prazno = još na poslu)</span>
          </Label>
          <Input
            id="co"
            type="datetime-local"
            value={clockOut}
            onChange={e => setClockOut(e.target.value)}
            className="font-mono"
          />
        </div>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={updateSession.isPending}>
            {updateSession.isPending ? 'Spremanje...' : 'Spremi promjene'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate({ to: '/sesije' })}>
            Odustani
          </Button>
        </div>
      </form>
    </div>
  )
}
