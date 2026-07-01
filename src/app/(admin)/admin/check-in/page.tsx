import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CalendarDays, MapPin, Users, ArrowRight, ScanLine } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils/format'
import type { AppEvent } from '@/lib/types'

// ─── Types ────────────────────────────────────────────────────────────────────
interface EventWithStats extends AppEvent {
  ticket_packs: Array<{
    id: string
    tickets: Array<{ id: string; status: string }>
  }>
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-[var(--color-muted-foreground)]">
        <span>{value} checked in</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-[var(--color-muted)] overflow-hidden">
        <div
          className="h-full rounded-full bg-[var(--color-primary)] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-[var(--color-muted-foreground)]">
        {max - value} remaining of {max} total
      </p>
    </div>
  )
}

// ─── Event Check-In Card ──────────────────────────────────────────────────────
function EventCheckInCard({
  event,
  checkedIn,
  total,
}: {
  event: AppEvent
  checkedIn: number
  total: number
}) {
  return (
    <Card variant="elevated" hover className="group">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-lg font-semibold text-[var(--color-foreground)] leading-tight truncate">
              {event.name}
            </CardTitle>
            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-1.5 text-sm text-[var(--color-muted-foreground)]">
                <CalendarDays className="h-3.5 w-3.5 shrink-0 text-[var(--color-primary)]" />
                <span>{formatDate(event.start_date)}</span>
              </div>
              {event.location_name && (
                <div className="flex items-center gap-1.5 text-sm text-[var(--color-muted-foreground)]">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--color-primary)]" />
                  <span className="truncate">{event.location_name}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-sm text-[var(--color-muted-foreground)]">
                <Users className="h-3.5 w-3.5 shrink-0 text-[var(--color-primary)]" />
                <span>{total} ticket{total !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>

          {/* Live indicator */}
          <div className="flex items-center gap-1.5 shrink-0 rounded-full bg-[var(--color-success)]/10 px-2.5 py-1 text-xs font-medium text-[var(--color-success)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)] animate-pulse" />
            Live
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <ProgressBar value={checkedIn} max={total} />

        <Link href={`/admin/check-in/${event.id}`} className="block">
          <Button variant="default" size="md" className="w-full group-hover:brightness-110">
            <ScanLine className="h-4 w-4 mr-2" />
            Start Check-In
            <ArrowRight className="h-4 w-4 ml-auto opacity-60 group-hover:translate-x-0.5 transition-transform" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function CheckInHubPage() {
  const supabase = await createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('app_users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin' && profile?.role !== 'event_assistant') {
    redirect('/dashboard')
  }

  // Fetch all published events with ticket stats
  // For event_assistant — currently shows all published events
  // (future: filter by event assignments table)
  const { data: eventsRaw } = await supabase
    .from('events')
    .select(`
      *,
      ticket_packs (
        id,
        tickets (
          id,
          status
        )
      )
    `)
    .eq('status', 'published')
    .order('start_date', { ascending: true })

  const events = (eventsRaw ?? []) as EventWithStats[]

  // Compute stats per event
  const enriched = events.map((ev) => {
    const allTickets = ev.ticket_packs.flatMap((p) => p.tickets)
    return {
      event:     ev as AppEvent,
      total:     allTickets.length,
      checkedIn: allTickets.filter((t) => t.status === 'checked_in').length,
    }
  })

  return (
    <div className="space-y-8">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[var(--color-foreground)] tracking-tight">
            Check-In Hub
          </h1>
          <p className="mt-1 text-[var(--color-muted-foreground)]">
            Select a published event to begin scanning tickets.
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-2 rounded-full border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 px-4 py-2">
          <ScanLine className="h-4 w-4 text-[var(--color-primary)]" />
          <span className="text-sm font-medium text-[var(--color-primary)]">
            {enriched.length} event{enriched.length !== 1 ? 's' : ''} active
          </span>
        </div>
      </div>

      {/* ── Summary strip ───────────────────────────────────────────── */}
      {enriched.length > 0 && (
        <div className="grid grid-cols-3 gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          {[
            {
              label: 'Total Events',
              value: enriched.length,
            },
            {
              label: 'Total Tickets',
              value: enriched.reduce((s, e) => s + e.total, 0),
            },
            {
              label: 'Checked In',
              value: enriched.reduce((s, e) => s + e.checkedIn, 0),
            },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <p className="text-2xl font-bold text-[var(--color-primary)]">{value}</p>
              <p className="text-xs text-[var(--color-muted-foreground)] mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Event cards ─────────────────────────────────────────────── */}
      {enriched.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)]/50 py-20 text-center">
          <CalendarDays className="h-10 w-10 text-[var(--color-muted-foreground)] mb-4" />
          <h3 className="text-lg font-semibold text-[var(--color-foreground)]">No published events</h3>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)] max-w-xs">
            Publish an event first so attendees can be checked in here.
          </p>
          <Link href="/admin/events" className="mt-6">
            <Button variant="outline" size="md">Go to Events</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {enriched.map(({ event, total, checkedIn }) => (
            <EventCheckInCard
              key={event.id}
              event={event}
              total={total}
              checkedIn={checkedIn}
            />
          ))}
        </div>
      )}
    </div>
  )
}
