import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// ─── GET /api/check-in/stats ──────────────────────────────────────────────────
// Query params:
//   event_id  (required) — UUID of the event
//
// Returns:
//   total_tickets   — all tickets for the event
//   checked_in      — tickets with status = 'checked_in'
//   remaining       — total - checked_in
//   recent_checkins — last 10 tickets checked in, with name + time
export async function GET(req: NextRequest) {
  try {
    const supabase  = await createClient()
    const adminSupa = createAdminClient()

    // ── Auth ─────────────────────────────────────────────────────────────
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('app_users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin' && profile?.role !== 'event_assistant') {
      return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 })
    }

    // ── Params ───────────────────────────────────────────────────────────
    const url     = new URL(req.url)
    const eventId = url.searchParams.get('event_id')?.trim()

    if (!eventId) {
      return NextResponse.json(
        { data: null, error: 'event_id query parameter is required' },
        { status: 400 },
      )
    }

    // ── Fetch all tickets for this event ─────────────────────────────────
    // Tickets live inside packs; we join up to events to ensure we only
    // touch tickets belonging to the requested event.
    const { data: tickets, error: ticketError } = await adminSupa
      .from('tickets')
      .select(`
        id,
        status,
        recipient_name,
        recipient_email,
        checked_in_at,
        pack:ticket_packs!inner (
          event_id
        )
      `)
      .eq('ticket_packs.event_id', eventId)

    if (ticketError) throw ticketError

    const allTickets = tickets ?? []

    // ── Compute counts ───────────────────────────────────────────────────
    const total      = allTickets.length
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const checkedIn  = allTickets.filter((t: any) => t.status === 'checked_in').length
    const remaining  = total - checkedIn

    // ── Recent check-ins (last 10 ordered by checked_in_at desc) ─────────
    const recentCheckins = allTickets
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((t: any) => t.status === 'checked_in' && t.checked_in_at)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .sort((a: any, b: any) =>
        new Date(b.checked_in_at).getTime() - new Date(a.checked_in_at).getTime()
      )
      .slice(0, 10)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((t: any) => ({
        ticket_id:      t.id               as string,
        recipient_name: t.recipient_name   as string | null,
        recipient_email: t.recipient_email as string | null,
        checked_in_at:  t.checked_in_at   as string,
      }))

    return NextResponse.json({
      data: {
        total_tickets:    total,
        checked_in:       checkedIn,
        remaining,
        recent_checkins:  recentCheckins,
      },
      error: null,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error'
    console.error('[check-in/stats] error:', msg)
    return NextResponse.json({ data: null, error: msg }, { status: 500 })
  }
}
