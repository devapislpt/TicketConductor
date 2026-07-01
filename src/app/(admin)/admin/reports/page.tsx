import { createClient } from '@/lib/supabase/server'
import { BarChart3, Download } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge, TicketStatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate, formatDateTime } from '@/lib/utils/format'
import type { AppEvent } from '@/lib/types'
import { ReportsClientSection } from './_components/ReportsClientSection'

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ event_id?: string }>
}) {
  const { event_id } = await searchParams
  const supabase = await createClient()

  // Fetch all events for selector
  const { data: eventsData } = await supabase
    .from('events')
    .select('id, name, status, start_date')
    .order('start_date', { ascending: false })

  const events = (eventsData ?? []) as Pick<AppEvent, 'id' | 'name' | 'status' | 'start_date'>[]
  const selectedEventId = event_id ?? events[0]?.id

  // If no event selected, show empty state
  if (!selectedEventId) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <h1 className="font-heading text-3xl font-bold tracking-[var(--letter-spacing-heading)] text-[var(--color-foreground)] mb-4">
          Reports
        </h1>
        <p className="text-[var(--color-muted-foreground)]">No events found. Create an event first.</p>
      </div>
    )
  }

  // Fetch full data for selected event
  const { data: eventData } = await supabase
    .from('events')
    .select('*')
    .eq('id', selectedEventId)
    .single()

  const selectedEvent = eventData as AppEvent | null

  // Fetch ticket packs with tickets
  const { data: packsData } = await supabase
    .from('ticket_packs')
    .select(`
      id,
      pack_name,
      total_tickets,
      owner:app_users(id, full_name, email),
      tickets(
        id, status, recipient_name, recipient_email, checked_in_at, sort_order,
        pack:ticket_packs(pack_name, owner:app_users(full_name, email, team:teams(name)))
      )
    `)
    .eq('event_id', selectedEventId)
    .order('created_at')

  const packs = (packsData ?? []) as Array<{
    id: string
    pack_name: string
    total_tickets: number
    owner: { id: string; full_name: string | null; email: string } | null
    tickets: Array<{
      id: string
      status: string
      recipient_name: string | null
      recipient_email: string | null
      checked_in_at: string | null
      sort_order: number
      pack: { pack_name: string; owner: { full_name: string | null; email: string; team: { name: string } | null } | null } | null
    }>
  }>

  // Compute summary
  const allTickets = packs.flatMap((p) => p.tickets)
  const totalTickets = allTickets.length
  const assignedTickets = allTickets.filter((t) => t.status === 'assigned')
  const unassignedTickets = allTickets.filter((t) => t.status === 'unassigned')
  const checkedInTickets = allTickets.filter((t) => t.status === 'checked_in')
  const assignedPct = totalTickets > 0 ? Math.round(((assignedTickets.length + checkedInTickets.length) / totalTickets) * 100) : 0
  const checkedInPct = totalTickets > 0 ? Math.round((checkedInTickets.length / totalTickets) * 100) : 0

  const eventStarted = selectedEvent?.start_date ? new Date(selectedEvent.start_date) <= new Date() : false

  return (
    <div className="space-y-6 p-6 md:p-8 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-[var(--letter-spacing-heading)] text-[var(--color-foreground)]">
            Reports
          </h1>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            Ticket rosters and check-in summaries
          </p>
        </div>
        <ReportsClientSection
          events={events}
          selectedEventId={selectedEventId}
        />
      </div>

      {/* ── Export Buttons ── */}
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <a href={`/api/admin/export?event_id=${selectedEventId}&format=csv`} download>
            <Download size={14} aria-hidden="true" />
            Full Roster CSV
          </a>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <a href={`/api/admin/export?event_id=${selectedEventId}&format=csv&by=pack`} download>
            <Download size={14} aria-hidden="true" />
            By Pack CSV
          </a>
        </Button>
        {eventStarted && (
          <Button asChild variant="ghost" size="sm">
            <a href={`/api/admin/export?event_id=${selectedEventId}&format=csv&by=checkin`} download>
              <Download size={14} aria-hidden="true" />
              Check-in Report CSV
            </a>
          </Button>
        )}
      </div>

      {selectedEvent && (
        <div className="rounded-[var(--border-radius)] border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 px-4 py-3 flex flex-wrap items-center gap-4 text-sm">
          <span className="font-heading font-semibold text-[var(--color-foreground)]">{selectedEvent.name}</span>
          <span className="text-[var(--color-muted-foreground)]">
            {formatDate(selectedEvent.start_date)}
          </span>
          <Badge variant={selectedEvent.status === 'published' ? 'success' : 'warning'} dot>
            {selectedEvent.status}
          </Badge>
        </div>
      )}

      {/* ── 1. Summary Stats ── */}
      <section aria-label="Summary statistics">
        <h2 className="font-heading text-lg font-semibold text-[var(--color-foreground)] mb-3">
          Summary
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Tickets', value: totalTickets },
            { label: 'Assigned', value: `${assignedTickets.length + checkedInTickets.length} (${assignedPct}%)` },
            { label: 'Unassigned', value: unassignedTickets.length },
            { label: 'Checked In', value: `${checkedInTickets.length} (${checkedInPct}%)` },
          ].map(({ label, value }) => (
            <Card key={label} className="p-4">
              <p className="text-xs uppercase tracking-widest text-[var(--color-muted-foreground)] mb-1">{label}</p>
              <p className="font-heading text-2xl font-bold text-[var(--color-foreground)]">{value}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ── 2. Ticket Pack Table ── */}
      <section aria-label="Ticket packs">
        <h2 className="font-heading text-lg font-semibold text-[var(--color-foreground)] mb-3">
          Ticket Packs ({packs.length})
        </h2>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" role="grid">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
                    {['Owner', 'Pack Name', 'Total', 'Assigned', 'Unassigned', 'Checked In'].map((h) => (
                      <th key={h} scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {packs.map((pack) => {
                    const packAssigned = pack.tickets.filter((t) => t.status === 'assigned').length
                    const packCheckedIn = pack.tickets.filter((t) => t.status === 'checked_in').length
                    const packUnassigned = pack.tickets.filter((t) => t.status === 'unassigned').length
                    return (
                      <tr key={pack.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-muted)] transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-[var(--color-foreground)]">{pack.owner?.full_name ?? '—'}</p>
                          <p className="text-xs text-[var(--color-muted-foreground)]">{pack.owner?.email}</p>
                        </td>
                        <td className="px-4 py-3 text-[var(--color-foreground)]">{pack.pack_name}</td>
                        <td className="px-4 py-3 text-[var(--color-foreground)]">{pack.total_tickets}</td>
                        <td className="px-4 py-3 text-[var(--color-success)]">{packAssigned}</td>
                        <td className="px-4 py-3 text-[var(--color-warning,#D97706)]">{packUnassigned}</td>
                        <td className="px-4 py-3 text-[var(--color-foreground)]">{packCheckedIn}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ── 3. Full Ticket Roster ── */}
      <section aria-label="Full ticket roster">
        <h2 className="font-heading text-lg font-semibold text-[var(--color-foreground)] mb-3">
          Assigned Tickets ({assignedTickets.length + checkedInTickets.length})
        </h2>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" role="grid">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
                    {['Name', 'Email', 'Pack', 'Owner', 'Status'].map((h) => (
                      <th key={h} scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...assignedTickets, ...checkedInTickets].map((ticket) => (
                    <tr key={ticket.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-muted)] transition-colors">
                      <td className="px-4 py-3 font-medium text-[var(--color-foreground)]">
                        {ticket.recipient_name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
                        {ticket.recipient_email ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-foreground)]">
                        {ticket.pack?.pack_name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
                        {ticket.pack?.owner?.full_name ?? ticket.pack?.owner?.email ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <TicketStatusBadge status={ticket.status as any} />
                      </td>
                    </tr>
                  ))}
                  {assignedTickets.length + checkedInTickets.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-[var(--color-muted-foreground)]">
                        No assigned tickets yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ── 4. Unassigned Tickets ── */}
      <section aria-label="Unassigned tickets">
        <h2 className="font-heading text-lg font-semibold text-[var(--color-foreground)] mb-3">
          Unassigned Tickets ({unassignedTickets.length})
        </h2>
        {unassignedTickets.length === 0 ? (
          <p className="text-sm text-[var(--color-success)]">All tickets are assigned!</p>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm" role="grid">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
                      {['Pack', 'Pack Owner', 'Slot #'].map((h) => (
                        <th key={h} scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {unassignedTickets.map((ticket) => (
                      <tr key={ticket.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-muted)] transition-colors">
                        <td className="px-4 py-3 text-[var(--color-foreground)]">
                          {ticket.pack?.pack_name ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
                          {ticket.pack?.owner?.full_name ?? ticket.pack?.owner?.email ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-[var(--color-foreground)]">
                          #{ticket.sort_order + 1}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      {/* ── 5. Check-in Summary ── */}
      {eventStarted && (
        <section aria-label="Check-in summary">
          <h2 className="font-heading text-lg font-semibold text-[var(--color-foreground)] mb-3">
            Check-in Summary
          </h2>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm" role="grid">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
                      {['Name', 'Email', 'Pack', 'Checked In At'].map((h) => (
                        <th key={h} scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {checkedInTickets.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-sm text-[var(--color-muted-foreground)]">
                          No check-ins recorded yet.
                        </td>
                      </tr>
                    ) : checkedInTickets.map((ticket) => (
                      <tr key={ticket.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-muted)] transition-colors">
                        <td className="px-4 py-3 font-medium text-[var(--color-foreground)]">
                          {ticket.recipient_name ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
                          {ticket.recipient_email ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-[var(--color-foreground)]">
                          {ticket.pack?.pack_name ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-[var(--color-muted-foreground)]">
                          {ticket.checked_in_at ? formatDateTime(ticket.checked_in_at) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  )
}
