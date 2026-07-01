import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils/format'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge, TicketStatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Ticket, CalendarDays, Users, ChevronRight, PackageOpen, MapPin } from 'lucide-react'
import type { AppUser, TicketPack, AppEvent } from '@/lib/types'
import { AnimatedStatCard } from './AnimatedStatCard'

// ─── Greeting helper ────────────────────────────────────────────────────────
function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

// ─── Types for joined query ──────────────────────────────────────────────────
interface PackWithEvent extends TicketPack {
  event: AppEvent
  tickets: { id: string; status: string }[]
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default async function DashboardPage() {
  const supabase = await createClient()

  // Auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Profile
  const { data: profile } = await supabase
    .from('app_users')
    .select('*, team:teams(id, name)')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  // Ticket packs with event info and ticket counts
  const { data: packs } = await supabase
    .from('ticket_packs')
    .select(`
      *,
      event:events(
        id, name, slug, start_date, end_date, cutoff_at,
        location_name, location_address, status, banner_url
      ),
      tickets(id, status)
    `)
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  const typedPacks = (packs ?? []) as PackWithEvent[]

  // Compute stats
  const totalTickets = typedPacks.reduce((sum, p) => sum + p.total_tickets, 0)
  const assignedTickets = typedPacks.reduce(
    (sum, p) => sum + (p.tickets?.filter(t => t.status !== 'unassigned').length ?? 0),
    0
  )
  const unassignedTickets = totalTickets - assignedTickets

  // Unique upcoming events (published, future)
  const now = new Date()
  const upcomingPacks = typedPacks.filter(p => {
    if (!p.event) return false
    if (p.event.status !== 'published') return false
    const eventDate = new Date(p.event.start_date)
    return eventDate >= now
  })

  // Deduplicate events
  const seenEventIds = new Set<string>()
  const upcomingEvents: AppEvent[] = []
  for (const p of upcomingPacks) {
    if (p.event && !seenEventIds.has(p.event.id)) {
      seenEventIds.add(p.event.id)
      upcomingEvents.push(p.event)
    }
  }

  const firstName = profile.full_name?.split(' ')[0] ?? 'there'

  return (
    <div className="space-y-10">
      {/* ── Welcome Header ─────────────────────────────────────────────────── */}
      <header className="space-y-1">
        <p className="text-sm font-body tracking-widest uppercase text-[var(--color-primary)] opacity-80">
          {getGreeting()}
        </p>
        <h1
          className="font-heading text-4xl md:text-5xl font-semibold tracking-[var(--letter-spacing-heading)] text-[var(--color-foreground)]"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          {firstName}
        </h1>
        <p className="text-[var(--color-muted-foreground)] font-body text-sm">
          Here&apos;s a summary of your tickets and upcoming events.
        </p>
      </header>

      {/* ── Stats Row ──────────────────────────────────────────────────────── */}
      <section aria-label="Ticket statistics">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <AnimatedStatCard
            label="Total Tickets"
            value={totalTickets}
            icon="ticket"
            color="primary"
          />
          <AnimatedStatCard
            label="Assigned"
            value={assignedTickets}
            icon="users"
            color="success"
          />
          <AnimatedStatCard
            label="Unassigned"
            value={unassignedTickets}
            icon="alert"
            color={unassignedTickets > 0 ? 'warning' : 'muted'}
          />
        </div>
      </section>

      {/* ── Upcoming Events ────────────────────────────────────────────────── */}
      <section aria-label="Upcoming events">
        <h2 className="font-heading text-2xl font-semibold tracking-[var(--letter-spacing-heading)] mb-4">
          Upcoming Events
        </h2>
        {upcomingEvents.length === 0 ? (
          <Card className="p-8 text-center">
            <CalendarDays
              size={40}
              className="mx-auto mb-3 text-[var(--color-muted-foreground)]"
              aria-hidden="true"
            />
            <p className="font-body text-[var(--color-muted-foreground)]">
              No upcoming events found.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {upcomingEvents.map((event) => (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)] rounded-[var(--border-radius)]"
              >
                <Card
                  hover
                  className="group transition-all duration-200 cursor-pointer"
                >
                  <CardContent className="flex items-center gap-4 py-4">
                    {/* Date block */}
                    <div
                      className="flex-shrink-0 w-14 h-14 rounded-[var(--border-radius)] bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 flex flex-col items-center justify-center text-[var(--color-primary)]"
                      aria-hidden="true"
                    >
                      <span className="text-xs font-body font-medium uppercase tracking-wider">
                        {formatDate(event.start_date, 'MMM')}
                      </span>
                      <span className="text-xl font-heading font-semibold leading-none">
                        {formatDate(event.start_date, 'd')}
                      </span>
                    </div>

                    {/* Event info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-heading text-lg font-semibold text-[var(--color-foreground)] truncate group-hover:text-[var(--color-primary)] transition-colors">
                        {event.name}
                      </h3>
                      <div className="flex items-center gap-3 mt-0.5">
                        {event.location_name && (
                          <span className="flex items-center gap-1 text-xs text-[var(--color-muted-foreground)] font-body">
                            <MapPin size={11} aria-hidden="true" />
                            {event.location_name}
                          </span>
                        )}
                        <span className="text-xs text-[var(--color-muted-foreground)] font-body">
                          {formatDate(event.start_date, 'EEEE, MMMM d, yyyy')}
                        </span>
                      </div>
                    </div>

                    {/* Arrow */}
                    <ChevronRight
                      size={18}
                      className="flex-shrink-0 text-[var(--color-muted-foreground)] group-hover:text-[var(--color-primary)] transition-colors"
                      aria-hidden="true"
                    />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ── Your Orders ────────────────────────────────────────────────────── */}
      <section aria-label="Your ticket orders">
        <h2 className="font-heading text-2xl font-semibold tracking-[var(--letter-spacing-heading)] mb-4">
          Your Orders
        </h2>

        {typedPacks.length === 0 ? (
          <Card className="p-10 text-center">
            <PackageOpen
              size={48}
              className="mx-auto mb-4 text-[var(--color-muted-foreground)]"
              aria-hidden="true"
            />
            <h3 className="font-heading text-xl font-semibold mb-2">No orders yet</h3>
            <p className="font-body text-sm text-[var(--color-muted-foreground)]">
              Your ticket packs will appear here once assigned by an administrator.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {typedPacks.map((pack) => {
              const assigned = pack.tickets?.filter(t => t.status !== 'unassigned').length ?? 0
              const total = pack.total_tickets
              const pct = total > 0 ? Math.round((assigned / total) * 100) : 0
              const allDone = assigned === total

              return (
                <Card key={pack.id} variant="default">
                  <CardHeader divider>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle className="truncate">{pack.pack_name}</CardTitle>
                        {pack.event && (
                          <p className="text-sm text-[var(--color-muted-foreground)] font-body mt-0.5 flex items-center gap-1">
                            <CalendarDays size={12} aria-hidden="true" />
                            {pack.event.name} &mdash; {formatDate(pack.event.start_date)}
                          </p>
                        )}
                      </div>
                      <Badge variant={allDone ? 'success' : 'warning'}>
                        {assigned}/{total} assigned
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Progress bar */}
                    <div className="mb-4" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${assigned} of ${total} tickets assigned`}>
                      <div className="flex justify-between text-xs text-[var(--color-muted-foreground)] font-body mb-1.5">
                        <span>{pct}% complete</span>
                        <span>{total - assigned} remaining</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[var(--color-muted)] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500 ease-out"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: allDone
                              ? 'var(--color-success)'
                              : 'var(--color-primary)',
                          }}
                        />
                      </div>
                    </div>

                    {/* CTA */}
                    <Link href={`/orders/${pack.id}`}>
                      <Button variant="outline" size="sm" className="w-full sm:w-auto">
                        <Ticket size={14} aria-hidden="true" />
                        Manage Tickets
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
