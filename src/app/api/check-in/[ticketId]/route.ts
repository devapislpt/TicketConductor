import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/utils/audit'

type Params = { params: Promise<{ ticketId: string }> }

// ─── POST /api/check-in/[ticketId] ───────────────────────────────────────────
// Checks in a single ticket.
//
// Validations:
//   1. Ticket exists
//   2. Ticket belongs to a published event
//   3. Ticket is not already checked in
//
// On success:
//   • Sets status = 'checked_in', checked_in_at = NOW(), checked_in_by = user.id
//   • Logs audit entry (ticket.check_in)
//
// Returns:
//   { success, already_checked_in, ticket_id, recipient_name, recipient_email,
//     event_name, pack_name, checked_in_at }
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { ticketId } = await params
    if (!ticketId) {
      return NextResponse.json({ data: null, error: 'Missing ticketId' }, { status: 400 })
    }

    const supabase  = await createClient()
    const adminSupa = createAdminClient()

    // ── Auth: admin or event_assistant ────────────────────────────────────
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('app_users')
      .select('role, email, full_name')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin' && profile?.role !== 'event_assistant') {
      return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 })
    }

    // ── Fetch ticket with pack + event ────────────────────────────────────
    const { data: ticket, error: fetchError } = await adminSupa
      .from('tickets')
      .select(`
        id,
        status,
        recipient_name,
        recipient_email,
        checked_in_at,
        checked_in_by,
        qr_code,
        pack:ticket_packs (
          id,
          pack_name,
          event:events (
            id,
            name,
            status
          )
        )
      `)
      .eq('id', ticketId)
      .single()

    if (fetchError || !ticket) {
      return NextResponse.json(
        { data: null, error: 'Ticket not found' },
        { status: 404 },
      )
    }

    // ── Validate: published event ─────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eventStatus = (ticket as any).pack?.event?.status
    if (eventStatus !== 'published') {
      return NextResponse.json(
        { data: null, error: 'Event is not published — check-in is not available' },
        { status: 422 },
      )
    }

    // ── Validate: not already checked in ─────────────────────────────────
    if (ticket.status === 'checked_in') {
      return NextResponse.json({
        data: {
          success:           false,
          already_checked_in: true,
          ticket_id:         ticket.id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          recipient_name:    ticket.recipient_name,
          recipient_email:   ticket.recipient_email,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          event_name:        (ticket as any).pack?.event?.name ?? null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          pack_name:         (ticket as any).pack?.pack_name ?? null,
          checked_in_at:     ticket.checked_in_at,
        },
        error: null,
      })
    }

    // ── Perform check-in ──────────────────────────────────────────────────
    const now = new Date().toISOString()

    const { data: updated, error: updateError } = await adminSupa
      .from('tickets')
      .update({
        status:        'checked_in',
        checked_in_at: now,
        checked_in_by: user.id,
        updated_at:    now,
      })
      .eq('id', ticketId)
      .select()
      .single()

    if (updateError || !updated) {
      throw updateError ?? new Error('Update failed')
    }

    // ── Audit log ─────────────────────────────────────────────────────────
    await logAudit({
      actorId:    user.id,
      actorEmail: profile?.email ?? user.email ?? null,
      action:     'ticket.check_in',
      entityType: 'ticket',
      entityId:   ticketId,
      oldValue:   { status: ticket.status },
      newValue:   { status: 'checked_in', checked_in_at: now },
      ipAddress:  req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? null,
      userAgent:  req.headers.get('user-agent') ?? null,
    })

    // ── Response ──────────────────────────────────────────────────────────
    return NextResponse.json({
      data: {
        success:            true,
        already_checked_in: false,
        ticket_id:          ticketId,
        recipient_name:     ticket.recipient_name,
        recipient_email:    ticket.recipient_email,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        event_name:         (ticket as any).pack?.event?.name ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pack_name:          (ticket as any).pack?.pack_name ?? null,
        checked_in_at:      now,
        checked_in_by_name: profile?.full_name ?? profile?.email ?? null,
      },
      error: null,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error'
    console.error('[check-in/[ticketId]] error:', msg)
    return NextResponse.json({ data: null, error: msg }, { status: 500 })
  }
}
