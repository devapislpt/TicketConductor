import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { isCutoffPassed, formatDate } from '@/lib/utils/format'
import { Button } from '@/components/ui/button'
import { ChevronLeft } from 'lucide-react'
import { TicketPackManager } from '@/components/tickets/TicketPackManager'
import type { TicketPack, AppEvent, Ticket, AppUser } from '@/lib/types'

interface PackWithAll extends TicketPack {
  event: AppEvent
  tickets: Ticket[]
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ packId: string }>
}) {
  const { packId } = await params
  const supabase = await createClient()

  // Auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch profile
  const { data: profile } = await supabase
    .from('app_users')
    .select('*, team:teams(id, name)')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  // Fetch pack with event and tickets
  const { data: pack } = await supabase
    .from('ticket_packs')
    .select(`
      *,
      event:events(
        id, name, slug, description, details,
        location_name, location_address, google_maps_url,
        start_date, end_date, cutoff_at, status,
        banner_url, created_by, created_at, updated_at,
        links:event_links(*)
      ),
      tickets(
        id, pack_id, recipient_name, recipient_email,
        qr_code, status, checked_in_at, checked_in_by,
        confirmation_sent_at, sort_order, created_at, updated_at
      )
    `)
    .eq('id', packId)
    .eq('owner_id', user.id)
    .single()

  if (!pack) notFound()

  const typedPack = pack as PackWithAll

  // Sort tickets by sort_order
  typedPack.tickets = [...(typedPack.tickets ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order
  )

  const cutoffPassed = isCutoffPassed(typedPack.event?.cutoff_at ?? null)

  return (
    <div className="space-y-6">
      {/* ── Back navigation ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Link
          href={typedPack.event ? `/events/${typedPack.event.id}` : '/dashboard'}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded"
        >
          <Button variant="ghost" size="sm">
            <ChevronLeft size={16} aria-hidden="true" />
            {typedPack.event ? typedPack.event.name : 'Dashboard'}
          </Button>
        </Link>
      </div>

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <header className="space-y-1">
        <p className="text-sm font-body tracking-widest uppercase text-[var(--color-primary)] opacity-80">
          Ticket Pack
        </p>
        <h1
          className="font-heading text-3xl md:text-4xl font-semibold tracking-[var(--letter-spacing-heading)] text-[var(--color-foreground)]"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          {typedPack.pack_name}
        </h1>
        {typedPack.event && (
          <p className="text-sm text-[var(--color-muted-foreground)] font-body">
            {typedPack.event.name} &mdash; {formatDate(typedPack.event.start_date, 'EEEE, MMMM d, yyyy')}
          </p>
        )}
      </header>

      {/* ── Core interactive manager ──────────────────────────────────────── */}
      <TicketPackManager
        pack={typedPack}
        event={typedPack.event}
        isCutoffPassed={cutoffPassed}
        currentUser={profile as AppUser}
      />
    </div>
  )
}
