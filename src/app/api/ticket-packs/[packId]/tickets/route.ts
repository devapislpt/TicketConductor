import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ─── GET /api/ticket-packs/[packId]/tickets ───────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ packId: string }> }
) {
  const { packId } = await params
  const supabase = await createClient()

  // Auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch profile to check role
  const { data: profile } = await supabase
    .from('app_users')
    .select('role')
    .eq('id', user.id)
    .single()

  const isPrivileged =
    profile?.role === 'admin' || profile?.role === 'event_assistant'

  // Fetch pack to verify ownership
  const { data: pack, error: packError } = await supabase
    .from('ticket_packs')
    .select('id, owner_id')
    .eq('id', packId)
    .single()

  if (packError || !pack) {
    return NextResponse.json({ error: 'Pack not found' }, { status: 404 })
  }

  const isOwner = pack.owner_id === user.id
  if (!isOwner && !isPrivileged) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch tickets sorted by sort_order
  const { data: tickets, error: ticketsError } = await supabase
    .from('tickets')
    .select(
      'id, pack_id, recipient_name, recipient_email, qr_code, status, checked_in_at, checked_in_by, confirmation_sent_at, sort_order, created_at, updated_at'
    )
    .eq('pack_id', packId)
    .order('sort_order', { ascending: true })

  if (ticketsError) {
    console.error('[ticket-packs tickets GET] error:', ticketsError)
    return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 })
  }

  return NextResponse.json({ tickets: tickets ?? [] }, { status: 200 })
}
