import { createClient } from '@/lib/supabase/server'
import { PackageOpen, Plus, Download } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils/format'
import type { AppEvent } from '@/lib/types'
import { TicketPacksClientSection } from './_components/TicketPacksClientSection'

export default async function AdminTicketPacksPage({
  searchParams,
}: {
  searchParams: Promise<{ event_id?: string; owner_id?: string }>
}) {
  const { event_id, owner_id } = await searchParams
  const supabase = await createClient()

  // Fetch events for filter dropdown
  const { data: eventsData } = await supabase
    .from('events')
    .select('id, name, status')
    .order('start_date', { ascending: false })

  const events = (eventsData ?? []) as Pick<AppEvent, 'id' | 'name' | 'status'>[]

  // Fetch ticket packs with relations
  let packsQuery = supabase
    .from('ticket_packs')
    .select(`
      id,
      pack_name,
      total_tickets,
      created_at,
      notes,
      event:events(id, name, start_date),
      owner:app_users(id, full_name, email),
      tickets(id, status)
    `)
    .order('created_at', { ascending: false })

  if (event_id) packsQuery = packsQuery.eq('event_id', event_id)
  if (owner_id) packsQuery = packsQuery.eq('owner_id', owner_id)

  const { data: packsData, error } = await packsQuery

  const packs = (packsData ?? []).map((p: any) => {
    const tickets = p.tickets ?? []
    const assigned = tickets.filter((t: any) => t.status !== 'unassigned').length
    return {
      id: p.id as string,
      pack_name: p.pack_name as string,
      total_tickets: p.total_tickets as number,
      created_at: p.created_at as string,
      notes: p.notes as string | null,
      event: p.event as { id: string; name: string; start_date: string } | null,
      owner: p.owner as { id: string; full_name: string | null; email: string } | null,
      assigned,
      unassigned: tickets.length - assigned,
    }
  })

  return (
    <div className="space-y-6 p-6 md:p-8 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-[var(--letter-spacing-heading)] text-[var(--color-foreground)]">
            Ticket Packs
          </h1>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            Manage all ticket packs and allocations
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="ghost" size="sm">
            <a
              href={`/api/admin/export?format=csv${event_id ? `&event_id=${event_id}` : ''}`}
              download
            >
              <Download size={14} aria-hidden="true" />
              Export CSV
            </a>
          </Button>
          {/* Create Pack button — client island */}
          <TicketPacksClientSection events={events} eventIdFilter={event_id} />
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div
          role="alert"
          className="rounded-[var(--border-radius)] border border-[var(--color-destructive)]/40 bg-[var(--color-destructive)]/10 px-4 py-3 text-sm text-[var(--color-destructive)]"
        >
          Failed to load packs: {error.message}
        </div>
      )}

      {/* ── Filter by event ── */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-[var(--color-muted-foreground)] uppercase tracking-wide">
          Filter:
        </span>
        <Button asChild variant={!event_id ? 'default' : 'outline'} size="sm" silent>
          <a href="/admin/ticket-packs">All Events</a>
        </Button>
        {events.map((ev) => (
          <Button
            key={ev.id}
            asChild
            variant={event_id === ev.id ? 'default' : 'outline'}
            size="sm"
            silent
          >
            <a href={`/admin/ticket-packs?event_id=${ev.id}`}>{ev.name}</a>
          </Button>
        ))}
      </div>

      {/* ── Table ── */}
      <Card>
        <CardHeader divider>
          <CardTitle className="flex items-center gap-2">
            <PackageOpen size={18} className="text-[var(--color-primary)]" aria-hidden="true" />
            Packs
            <span className="ml-auto text-sm font-normal text-[var(--color-muted-foreground)]">
              {packs.length} total
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {packs.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-[var(--color-muted-foreground)]">
              <PackageOpen size={36} strokeWidth={1} aria-hidden="true" />
              <p className="text-sm">No ticket packs found.</p>
            </div>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm" role="grid">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
                      {['Event', 'Owner', 'Pack Name', 'Total', 'Assigned', 'Unassigned', 'Created'].map((h) => (
                        <th
                          key={h}
                          scope="col"
                          className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {packs.map((pack) => (
                      <tr
                        key={pack.id}
                        className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-muted)] transition-colors duration-150"
                      >
                        <td className="px-4 py-3 text-[var(--color-foreground)]">
                          <div>
                            <p className="font-medium">{pack.event?.name ?? '—'}</p>
                            {pack.event?.start_date && (
                              <p className="text-xs text-[var(--color-muted-foreground)]">
                                {formatDate(pack.event.start_date)}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-[var(--color-foreground)]">
                              {pack.owner?.full_name ?? '—'}
                            </p>
                            <p className="text-xs text-[var(--color-muted-foreground)]">
                              {pack.owner?.email}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[var(--color-foreground)]">
                          {pack.pack_name}
                        </td>
                        <td className="px-4 py-3 text-[var(--color-foreground)]">
                          {pack.total_tickets}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[var(--color-success)]">{pack.assigned}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={pack.unassigned > 0 ? 'text-[var(--color-warning,#D97706)]' : 'text-[var(--color-muted-foreground)]'}>
                            {pack.unassigned}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-[var(--color-muted-foreground)]">
                          {formatDate(pack.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-[var(--color-border)]">
                {packs.map((pack) => (
                  <div key={pack.id} className="p-4 space-y-1">
                    <p className="font-medium text-[var(--color-foreground)]">{pack.pack_name}</p>
                    <p className="text-xs text-[var(--color-muted-foreground)]">
                      {pack.owner?.full_name} · {pack.event?.name}
                    </p>
                    <div className="flex gap-4 text-xs mt-1">
                      <span className="text-[var(--color-foreground)]">{pack.total_tickets} total</span>
                      <span className="text-[var(--color-success)]">{pack.assigned} assigned</span>
                      <span className="text-[var(--color-warning,#D97706)]">{pack.unassigned} unassigned</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
