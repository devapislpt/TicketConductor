import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/utils/audit'
import { isCutoffPassed } from '@/lib/utils/format'
import { sendEmail } from '@/lib/resend/client'
import { TicketConfirmation } from '@/lib/resend/emails/TicketConfirmation'
import { z } from 'zod'
import type { Ticket, AppEvent, TicketPack } from '@/lib/types'

// ─── Validation ───────────────────────────────────────────────────────────────
const updateSchema = z.object({
  recipient_name: z.string().min(1).max(120).nullable().optional(),
  recipient_email: z.string().email().max(255).nullable().optional(),
})

// ─── Helper: get ticket with ownership check ───────────────────────────────
async function getTicketWithAuth(ticketId: string, userId: string) {
  const supabase = await createClient()

  // Fetch ticket with its pack to verify ownership
  const { data: ticket, error } = await supabase
    .from('tickets')
    .select(`
      *,
      pack:ticket_packs(
        id, owner_id, pack_name, total_tickets, event_id,
        event:events(
          id, name, slug, start_date, end_date, cutoff_at,
          location_name, location_address, status
        )
      )
    `)
    .eq('id', ticketId)
    .single()

  if (error || !ticket) return { ticket: null, error: 'Ticket not found' }

  const pack = ticket.pack as (TicketPack & { event: AppEvent }) | null

  // Authorization: user must own the pack, or be admin/event_assistant
  const { data: profile } = await supabase
    .from('app_users')
    .select('role')
    .eq('id', userId)
    .single()

  const isOwner = pack?.owner_id === userId
  const isPrivileged = profile?.role === 'admin' || profile?.role === 'event_assistant'

  if (!isOwner && !isPrivileged) {
    return { ticket: null, error: 'Forbidden' }
  }

  return { ticket: ticket as Ticket & { pack: TicketPack & { event: AppEvent } }, error: null }
}

// ─── GET /api/tickets/[ticketId] ──────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  const { ticketId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { ticket, error } = await getTicketWithAuth(ticketId, user.id)
  if (!ticket) {
    return NextResponse.json(
      { error: error ?? 'Not found' },
      { status: error === 'Forbidden' ? 403 : 404 }
    )
  }

  return NextResponse.json({ ticket })
}

// ─── PUT /api/tickets/[ticketId] ──────────────────────────────────────────────
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  const { ticketId } = await params
  const supabase = await createClient()

  // Auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse body
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Validate
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const { recipient_name, recipient_email } = parsed.data

  // Fetch ticket + ownership check
  const { ticket, error: authError } = await getTicketWithAuth(ticketId, user.id)
  if (!ticket) {
    return NextResponse.json(
      { error: authError ?? 'Not found' },
      { status: authError === 'Forbidden' ? 403 : 404 }
    )
  }

  // Cutoff check
  const event = ticket.pack?.event
  if (event && isCutoffPassed(event.cutoff_at ?? null)) {
    return NextResponse.json(
      { error: 'The ticket editing deadline has passed.' },
      { status: 409 }
    )
  }

  // Derive new status
  const newName = recipient_name ?? null
  const newEmail = recipient_email ?? null
  let newStatus: 'unassigned' | 'assigned' = ticket.status === 'checked_in'
    ? 'assigned'
    : 'unassigned'

  if (newName && newEmail) {
    newStatus = 'assigned'
  } else if (!newName && !newEmail) {
    newStatus = 'unassigned'
  }

  // If was checked_in, don't downgrade to unassigned
  if (ticket.status === 'checked_in' && newStatus === 'unassigned') {
    newStatus = 'assigned'
  }

  const wasUnassigned = ticket.status === 'unassigned'
  const isNewAssignment = wasUnassigned && newStatus === 'assigned'
  const emailChanged = ticket.recipient_email !== newEmail && !!newEmail

  // Update via admin client to bypass RLS for the update itself
  // (RLS already checked via ownership above)
  const adminClient = createAdminClient()
  const { data: updated, error: updateError } = await adminClient
    .from('tickets')
    .update({
      recipient_name: newName,
      recipient_email: newEmail,
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ticketId)
    .select()
    .single()

  if (updateError || !updated) {
    console.error('[tickets PUT] update error:', updateError)
    return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 })
  }

  // ── Audit log ──────────────────────────────────────────────────────────────
  const auditAction = newStatus === 'unassigned' ? 'ticket.unassign' :
    isNewAssignment ? 'ticket.assign' : 'ticket.update'

  await logAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: auditAction,
    entityType: 'ticket',
    entityId: ticketId,
    oldValue: {
      recipient_name: ticket.recipient_name,
      recipient_email: ticket.recipient_email,
      status: ticket.status,
    },
    newValue: {
      recipient_name: newName,
      recipient_email: newEmail,
      status: newStatus,
    },
    ipAddress: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip'),
    userAgent: req.headers.get('user-agent'),
  })

  // ── Send confirmation email if newly assigned ──────────────────────────────
  if ((isNewAssignment || emailChanged) && newEmail && newName && event) {
    try {
      await sendEmail({
        to: newEmail,
        subject: `Your ticket to ${event.name} is confirmed`,
        react: TicketConfirmation({
          recipientName: newName,
          eventName: event.name,
          eventDate: event.start_date,
          locationName: event.location_name ?? undefined,
          locationAddress: event.location_address ?? undefined,
          qrCode: updated.qr_code ?? undefined,
          ticketNumber: updated.sort_order,
        }),
      })

      // Mark confirmation sent
      await adminClient
        .from('tickets')
        .update({ confirmation_sent_at: new Date().toISOString() })
        .eq('id', ticketId)
    } catch (emailErr) {
      console.error('[tickets PUT] email send failed:', emailErr)
      // Non-fatal — ticket is still updated
    }
  }

  return NextResponse.json({ ticket: updated }, { status: 200 })
}
