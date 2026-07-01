import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CalendarDays, MapPin } from 'lucide-react'
import { CheckInScanner } from '@/components/check-in/CheckInScanner'
import { formatDate } from '@/lib/utils/format'
import type { AppEvent } from '@/lib/types'

// ─── Types ────────────────────────────────────────────────────────────────────
type Params = { params: Promise<{ eventId: string }> }

interface EventWithStats extends AppEvent {
  ticket_packs: Array<{
    id: string
    tickets: Array<{ id: string; status: string }>
  }>
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function CheckInEventPage({ params }: Params) {
  const { eventId } = await params

  const supabase = await createClient()

  // ── Auth ──────────────────────────────────────────────────────────────
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

  // ── Fetch event ───────────────────────────────────────────────────────
  const { data: eventRaw, error: eventError } = await supabase
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
    .eq('id', eventId)
    .eq('status', 'published')
    .single()

  if (eventError || !eventRaw) {
    notFound()
  }

  const eventData = eventRaw as EventWithStats

  // ── Compute initial stats ─────────────────────────────────────────────
  const allTickets = eventData.ticket_packs.flatMap((p) => p.tickets)
  const totalTickets = allTickets.length
  const checkedIn    = allTickets.filter((t) => t.status === 'checked_in').length
  const remaining    = totalTickets - checkedIn

  // Strip the nested pack data before passing to client
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { ticket_packs: _packs, ...event } = eventData

  return (
    <div className="space-y-6">
      {/* ── Breadcrumb + back nav ──────────────────────────────────── */}
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
        <Link
          href="/admin/check-in"
          className="flex items-center gap-1.5 hover:text-[var(--color-primary)] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Check-In Hub
        </Link>
        <span>/</span>
        <span className="text-[var(--color-foreground)] font-medium truncate max-w-[200px]">
          {event.name}
        </span>
      </div>

      {/* ── Event header ──────────────────────────────────────────── */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <h1 className="text-2xl font-bold text-[var(--color-foreground)] tracking-tight">
          {event.name}
        </h1>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          <div className="flex items-center gap-1.5 text-sm text-[var(--color-muted-foreground)]">
            <CalendarDays className="h-3.5 w-3.5 text-[var(--color-primary)]" />
            {formatDate(event.start_date)}
          </div>
          {event.location_name && (
            <div className="flex items-center gap-1.5 text-sm text-[var(--color-muted-foreground)]">
              <MapPin className="h-3.5 w-3.5 text-[var(--color-primary)]" />
              {event.location_name}
            </div>
          )}
        </div>

        {/* Quick stats strip */}
        <div className="mt-4 grid grid-cols-3 divide-x divide-[var(--color-border)] border-t border-[var(--color-border)] pt-4">
          {[
            { label: 'Total',      value: totalTickets, color: 'text-[var(--color-foreground)]' },
            { label: 'Checked In', value: checkedIn,    color: 'text-[var(--color-success)]'    },
            { label: 'Remaining',  value: remaining,    color: 'text-[var(--color-primary)]'    },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex flex-col items-center px-4">
              <span className={`text-2xl font-bold ${color}`}>{value}</span>
              <span className="text-xs text-[var(--color-muted-foreground)] mt-0.5">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Core scanner component ─────────────────────────────────── */}
      <CheckInScanner
        eventId={eventId}
        eventName={event.name}
        initialStats={{
          total:     totalTickets,
          checkedIn,
          remaining,
        }}
      />
    </div>
  )
}
