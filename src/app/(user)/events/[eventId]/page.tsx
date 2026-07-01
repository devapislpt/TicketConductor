import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatDate, isCutoffPassed } from '@/lib/utils/format'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge, TicketStatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  CalendarDays,
  MapPin,
  Video,
  Globe,
  ExternalLink,
  Ticket,
  Clock,
  ChevronRight,
  Map,
  AlertTriangle,
} from 'lucide-react'
import type { AppEvent, EventLink, TicketPack, Ticket as TicketType } from '@/lib/types'
import { cn } from '@/lib/utils/cn'

// ─── Link icon map ───────────────────────────────────────────────────────────
function LinkIcon({ type }: { type: EventLink['type'] }) {
  switch (type) {
    case 'zoom':    return <Video size={18} aria-hidden="true" />
    case 'maps':    return <Map size={18} aria-hidden="true" />
    case 'website': return <Globe size={18} aria-hidden="true" />
    default:        return <ExternalLink size={18} aria-hidden="true" />
  }
}

const LINK_COLOR: Record<EventLink['type'], string> = {
  zoom:    'text-[#2D8CFF] border-[#2D8CFF]/30 bg-[#2D8CFF]/10',
  maps:    'text-[var(--color-success)] border-[var(--color-success)]/30 bg-[var(--color-success)]/10',
  website: 'text-[var(--color-primary)] border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10',
  other:   'text-[var(--color-muted-foreground)] border-[var(--color-border)] bg-[var(--color-muted)]',
}

interface PackWithTickets extends TicketPack {
  tickets: TicketType[]
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  const { eventId } = await params
  const supabase = await createClient()

  // Auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch event with links
  const { data: event } = await supabase
    .from('events')
    .select('*, links:event_links(*)')
    .eq('id', eventId)
    .eq('status', 'published')
    .single()

  if (!event) notFound()

  const typedEvent = event as AppEvent & { links: EventLink[] }

  // Sort links by sort_order
  const sortedLinks = [...(typedEvent.links ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order
  )

  // Fetch user's packs for this event with tickets
  const { data: packs } = await supabase
    .from('ticket_packs')
    .select('*, tickets(*)')
    .eq('event_id', eventId)
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  const typedPacks = (packs ?? []) as PackWithTickets[]

  const cutoffPassed = isCutoffPassed(typedEvent.cutoff_at)

  // Maps link (from links array or google_maps_url field)
  const mapsLink =
    sortedLinks.find(l => l.type === 'maps')?.url ??
    typedEvent.google_maps_url ??
    null

  return (
    <div className="space-y-10">
      {/* ── Event Header ─────────────────────────────────────────────────── */}
      <header className="space-y-4">
        {typedEvent.banner_url && (
          <div className="relative w-full h-48 md:h-64 rounded-[var(--border-radius)] overflow-hidden border border-[var(--color-border)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={typedEvent.banner_url}
              alt={`${typedEvent.name} banner`}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-background)]/80 to-transparent" />
          </div>
        )}

        <div>
          <p className="text-sm font-body tracking-widest uppercase text-[var(--color-primary)] opacity-80 mb-1">
            Event Details
          </p>
          <h1
            className="font-heading text-4xl md:text-5xl font-semibold tracking-[var(--letter-spacing-heading)] text-[var(--color-foreground)]"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            {typedEvent.name}
          </h1>

          <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3">
            {/* Date */}
            <div className="flex items-center gap-1.5 text-sm text-[var(--color-muted-foreground)] font-body">
              <CalendarDays size={14} className="text-[var(--color-primary)]" aria-hidden="true" />
              <span>{formatDate(typedEvent.start_date, 'EEEE, MMMM d, yyyy')}</span>
              {typedEvent.end_date && typedEvent.end_date !== typedEvent.start_date && (
                <span>&ndash; {formatDate(typedEvent.end_date, 'MMMM d, yyyy')}</span>
              )}
            </div>

            {/* Location */}
            {typedEvent.location_name && (
              <div className="flex items-center gap-1.5 text-sm text-[var(--color-muted-foreground)] font-body">
                <MapPin size={14} className="text-[var(--color-primary)]" aria-hidden="true" />
                <span>{typedEvent.location_name}</span>
              </div>
            )}

            {/* Cutoff */}
            {typedEvent.cutoff_at && (
              <div className={cn(
                'flex items-center gap-1.5 text-sm font-body',
                cutoffPassed
                  ? 'text-[var(--color-destructive)]'
                  : 'text-[var(--color-muted-foreground)]'
              )}>
                <Clock size={14} aria-hidden="true" />
                <span>
                  {cutoffPassed
                    ? 'Ticket editing closed'
                    : `Editing closes ${formatDate(typedEvent.cutoff_at, 'MMM d, h:mm a')}`}
                </span>
              </div>
            )}
          </div>
        </div>

        {cutoffPassed && (
          <div
            className="flex items-start gap-3 p-4 rounded-[var(--border-radius)] border border-[var(--color-destructive)]/30 bg-[var(--color-destructive)]/10"
            role="alert"
          >
            <AlertTriangle size={18} className="text-[var(--color-destructive)] flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-body font-medium text-[var(--color-destructive)]">
                Ticket editing is closed
              </p>
              <p className="text-xs text-[var(--color-muted-foreground)] mt-0.5">
                The cutoff date has passed. Your current ticket assignments are final.
              </p>
            </div>
          </div>
        )}
      </header>

      {/* ── Description ──────────────────────────────────────────────────── */}
      {(typedEvent.description || typedEvent.details) && (
        <section aria-label="Event description">
          <h2 className="font-heading text-2xl font-semibold tracking-[var(--letter-spacing-heading)] mb-3">
            About this Event
          </h2>
          <Card>
            <CardContent className="prose prose-invert max-w-none">
              {typedEvent.description && (
                <p className="font-body text-[var(--color-foreground)] leading-relaxed">
                  {typedEvent.description}
                </p>
              )}
              {typedEvent.details && typedEvent.details !== typedEvent.description && (
                <p className="font-body text-[var(--color-muted-foreground)] leading-relaxed mt-3">
                  {typedEvent.details}
                </p>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {/* ── Links ────────────────────────────────────────────────────────── */}
      {sortedLinks.length > 0 && (
        <section aria-label="Event links and resources">
          <h2 className="font-heading text-2xl font-semibold tracking-[var(--letter-spacing-heading)] mb-3">
            Links &amp; Resources
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {sortedLinks.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'group flex items-center gap-3 p-4 rounded-[var(--border-radius)] border transition-all duration-200',
                  'hover:brightness-110 hover:shadow-[var(--shadow-md)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)]',
                  LINK_COLOR[link.type]
                )}
              >
                <span className="flex-shrink-0">
                  <LinkIcon type={link.type} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-body font-medium text-sm truncate">
                    {link.label}
                  </span>
                  <span className="block text-xs opacity-70 truncate font-mono mt-0.5">
                    {link.url}
                  </span>
                </span>
                <ExternalLink
                  size={14}
                  className="flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity"
                  aria-hidden="true"
                />
              </a>
            ))}
          </div>
        </section>
      )}

      {/* ── Map ──────────────────────────────────────────────────────────── */}
      {(typedEvent.location_address || mapsLink) && (
        <section aria-label="Event location">
          <h2 className="font-heading text-2xl font-semibold tracking-[var(--letter-spacing-heading)] mb-3">
            Location
          </h2>
          <Card>
            <CardContent className="space-y-3">
              {typedEvent.location_name && (
                <p className="font-heading text-lg font-semibold">{typedEvent.location_name}</p>
              )}
              {typedEvent.location_address && (
                <p className="font-body text-sm text-[var(--color-muted-foreground)]">
                  {typedEvent.location_address}
                </p>
              )}
              {mapsLink && (
                <a
                  href={mapsLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-body text-[var(--color-success)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded"
                >
                  <Map size={14} aria-hidden="true" />
                  View on Google Maps
                  <ExternalLink size={12} aria-hidden="true" />
                </a>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {/* ── Your Ticket Packs ────────────────────────────────────────────── */}
      <section aria-label="Your ticket packs for this event">
        <h2 className="font-heading text-2xl font-semibold tracking-[var(--letter-spacing-heading)] mb-3">
          Your Tickets
        </h2>

        {typedPacks.length === 0 ? (
          <Card className="p-8 text-center">
            <Ticket size={36} className="mx-auto mb-3 text-[var(--color-muted-foreground)]" aria-hidden="true" />
            <p className="font-body text-[var(--color-muted-foreground)]">
              You have no ticket packs for this event.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {typedPacks.map((pack) => {
              const assigned = pack.tickets?.filter(t => t.status !== 'unassigned').length ?? 0
              const total = pack.total_tickets
              const pct = total > 0 ? Math.round((assigned / total) * 100) : 0

              return (
                <Card key={pack.id} variant="default">
                  <CardHeader divider>
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="truncate">{pack.pack_name}</CardTitle>
                      <Badge variant={assigned === total ? 'success' : 'warning'}>
                        {assigned}/{total}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Progress */}
                    <div
                      role="progressbar"
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${assigned} of ${total} tickets assigned`}
                    >
                      <div className="flex justify-between text-xs text-[var(--color-muted-foreground)] font-body mb-1.5">
                        <span>{pct}% assigned</span>
                        <span>{total - assigned} unassigned</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[var(--color-muted)] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            backgroundColor:
                              assigned === total
                                ? 'var(--color-success)'
                                : 'var(--color-primary)',
                          }}
                        />
                      </div>
                    </div>

                    {/* Ticket status summary */}
                    <div className="flex flex-wrap gap-2">
                      {(pack.tickets ?? []).slice(0, 8).map((ticket) => (
                        <TicketStatusBadge key={ticket.id} status={ticket.status} />
                      ))}
                      {(pack.tickets ?? []).length > 8 && (
                        <Badge variant="outline">+{(pack.tickets ?? []).length - 8} more</Badge>
                      )}
                    </div>

                    {/* CTA */}
                    <Link href={`/orders/${pack.id}`}>
                      <Button
                        variant="default"
                        size="sm"
                        className="w-full sm:w-auto"
                      >
                        <Ticket size={14} aria-hidden="true" />
                        Manage Tickets
                        <ChevronRight size={14} aria-hidden="true" />
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
