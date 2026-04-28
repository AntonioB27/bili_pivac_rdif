import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useSession, useUpdateSession } from '../../lib/queries/sessions'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Card, CardContent } from '../../components/ui/card'
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

  if (isLoading) return <Skeleton className="h-64 w-full max-w-md" />
  if (!session) return <p className="text-gray-500">Sesija nije pronađena.</p>

  return (
    <div className="max-w-md">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">Uredi sesiju</h1>
        {session?.is_auto_closed && (
          <Badge variant="outline" className="text-orange-600 border-orange-300">auto-zatvoreno</Badge>
        )}
      </div>
      {session && <p className="text-gray-500 mb-4">{session.employees?.ime_prezime}</p>}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="ci">Dolazak *</Label>
              <Input id="ci" type="datetime-local" value={clockIn} onChange={e => setClockIn(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="co">Odlazak <span className="text-gray-400">(prazno = još na poslu)</span></Label>
              <Input id="co" type="datetime-local" value={clockOut} onChange={e => setClockOut(e.target.value)} />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={updateSession.isPending}>{updateSession.isPending ? 'Spremanje...' : 'Spremi'}</Button>
              <Button type="button" variant="outline" onClick={() => navigate({ to: '/sesije' })}>Odustani</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
