import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Pencil, Eye, Trash2, CalendarDays } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EventStatusBadge } from '@/components/ui/badge'
import { formatDate, formatDateTime } from '@/lib/utils/format'
import type { AppEvent, EventStatus } from '@/lib/types'
import { EventsClientActions } from './_components/EventsClientActions'

// ─── Helpers ─────────────────────────────────────────────────────────────────
function statusFromParam(raw: string | undefined): EventStatus | undefined {
  if (raw === 'draft' || raw === 'published' || raw === 'archived') return raw
  return undefined
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status: statusParam } = await searchParams
  const filterStatus = statusFromParam(statusParam)

  const supabase = await createClient()
  let query = supabase
    .from('events')
    .select(`
      *,
      ticket_packs(
        id,
        tickets(id, status)
      )
    `)
    .order('start_date', { ascending: false })

  if (filterStatus) {
    query = query.eq('status', filterStatus)
  }

  const { data, error } = await query

  const events = (data ?? []) as Array<
    AppEvent & {
      ticket_packs: Array<{
        id: string
        tickets: Array<{ id: string; status: string }>
      }>
    }
  >

  // ── Compute per-event stats ──────────────────────────────────────────────
  const enriched = events.map((ev) => {
    const allTickets = ev.ticket_packs.flatMap((p) => p.tickets)
    const total = allTickets.length
    const assigned = allTickets.filter((t) => t.status !== 'unassigned').length
    const pct = total > 0 ? Math.round((assigned / total) * 100) : 0
    return {
      ...ev,
      totalTickets: total,
      assignedTickets: assigned,
      assignedPct: pct,
    }
  })

  const statuses: Array<EventStatus | 'all'> = ['all', 'published', 'draft', 'archived']

  return (
    <div className="space-y-6 p-6 md:p-8 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-[var(--letter-spacing-heading)] text-[var(--color-foreground)]">
            Events
          </h1>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            Manage all FallCon events
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/events/new">
            <Plus size={16} aria-hidden="true" />
            New Event
          </Link>
        </Button>
      </div>

      {/* ── Status Filter ── */}
      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        {statuses.map((s) => {
          const isActive = s === 'all' ? !filterStatus : filterStatus === s
          return (
            <Button
              key={s}
              asChild
              variant={isActive ? 'default' : 'outline'}
              size="sm"
              silent
            >
              <Link href={s === 'all' ? '/admin/events' : `/admin/events?status=${s}`}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Link>
            </Button>
          )
        })}
      </nav>

      {/* ── Table ── */}
      {error && (
        <div
          role="alert"
          className="rounded-[var(--border-radius)] border border-[var(--color-destructive)]/40 bg-[var(--color-destructive)]/10 px-4 py-3 text-sm text-[var(--color-destructive)]"
        >
          Failed to load events: {error.message}
        </div>
      )}

      <Card>
        <CardHeader divider>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays size={18} className="text-[var(--color-primary)]" aria-hidden="true" />
            {filterStatus
              ? `${filterStatus.charAt(0).toUpperCase()}${filterStatus.slice(1)} Events`
              : 'All Events'}
            <span className="ml-auto text-sm font-normal text-[var(--color-muted-foreground)]">
              {enriched.length} total
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {enriched.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-[var(--color-muted-foreground)]">
              <CalendarDays size={36} strokeWidth={1} aria-hidden="true" />
              <p className="text-sm">No events found.</p>
              <Button asChild size="sm" variant="outline">
                <Link href="/admin/events/new">Create one</Link>
              </Button>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm" role="grid">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
                      {[
                        'Name',
                        'Date',
                        'Status',
                        'Tickets',
                        'Assigned %',
                        'Cutoff',
                        'Actions',
                      ].map((h) => (
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
                    {enriched.map((ev) => (
                      <tr
                        key={ev.id}
                        className="group relative border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-muted)] transition-colors duration-150"
                      >
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-[var(--color-foreground)]">
                              {ev.name}
                            </p>
                            <p className="text-xs text-[var(--color-muted-foreground)] font-mono">
                              {ev.slug}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[var(--color-foreground)]">
                          {formatDate(ev.start_date)}
                        </td>
                        <td className="px-4 py-3">
                          <EventStatusBadge status={ev.status} />
                        </td>
                        <td className="px-4 py-3 text-[var(--color-foreground)]">
                          {ev.totalTickets}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-[var(--color-muted)] overflow-hidden">
                              <div
                                className="h-full bg-[var(--color-primary)] rounded-full"
                                style={{ width: `${ev.assignedPct}%` }}
                              />
                            </div>
                            <span className="text-xs text-[var(--color-foreground)]">
                              {ev.assignedPct}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[var(--color-foreground)] text-xs">
                          {ev.cutoff_at
                            ? formatDateTime(ev.cutoff_at)
                            : <span className="text-[var(--color-muted-foreground)]">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <EventsClientActions eventId={ev.id} eventName={ev.name} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-[var(--color-border)]">
                {enriched.map((ev) => (
                  <div key={ev.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-[var(--color-foreground)]">
                          {ev.name}
                        </p>
                        <p className="text-xs text-[var(--color-muted-foreground)]">
                          {formatDate(ev.start_date)}
                        </p>
                      </div>
                      <EventStatusBadge status={ev.status} />
                    </div>
                    <div className="flex items-center gap-4 text-xs text-[var(--color-muted-foreground)]">
                      <span>{ev.totalTickets} tickets</span>
                      <span>{ev.assignedPct}% assigned</span>
                    </div>
                    <EventsClientActions eventId={ev.id} eventName={ev.name} />
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
