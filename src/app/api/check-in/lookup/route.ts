import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// ─── GET /api/check-in/lookup ─────────────────────────────────────────────────
// Query params (one required):
//   email    — partial match via ilike
//   qr_code  — exact match
//
// Returns array of tickets belonging to published events.
// Joins: ticket → pack → event
export async function GET(req: NextRequest) {
  try {
    const supabase     = await createClient()
    const adminSupa    = createAdminClient()

    // ── Auth: admin or event_assistant only ──────────────────────────────
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

    // ── Parse query params ───────────────────────────────────────────────
    const url     = new URL(req.url)
    const email   = url.searchParams.get('email')?.trim()
    const qrCode  = url.searchParams.get('qr_code')?.trim()

    if (!email && !qrCode) {
      return NextResponse.json(
        { data: null, error: 'Provide either email or qr_code query parameter' },
        { status: 400 },
      )
    }

    // ── Build query ──────────────────────────────────────────────────────
    // We query tickets, joining pack → event so we can filter by event status
    // and return event/pack context in one round-trip.
    let query = adminSupa
      .from('tickets')
      .select(`
        id,
        qr_code,
        recipient_name,
        recipient_email,
        status,
        checked_in_at,
        pack:ticket_packs (
          id,
          pack_name,
          event:events (
            id,
            name,
            status,
            start_date,
            location_name
          )
        )
      `)
      .order('sort_order', { ascending: true })

    if (qrCode) {
      // Exact match — most common scanner path
      query = query.eq('qr_code', qrCode)
    } else if (email) {
      // Partial match — email lookup mode
      query = query.ilike('recipient_email', `%${email}%`)
    }

    const { data: tickets, error } = await query

    if (error) throw error

    // ── Filter to published events only ──────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filtered = (tickets ?? []).filter((t: any) => {
      return t.pack?.event?.status === 'published'
    })

    // ── Shape the response ───────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results = filtered.map((t: any) => ({
      ticket_id:       t.id          as string,
      qr_code:         t.qr_code     as string | null,
      recipient_name:  t.recipient_name  as string | null,
      recipient_email: t.recipient_email as string | null,
      status:          t.status      as string,
      checked_in_at:   t.checked_in_at  as string | null,
      event_id:        t.pack?.event?.id        as string | null,
      event_name:      t.pack?.event?.name      as string | null,
      event_date:      t.pack?.event?.start_date as string | null,
      event_location:  t.pack?.event?.location_name as string | null,
      pack_name:       t.pack?.pack_name        as string | null,
    }))

    return NextResponse.json({ data: results, error: null })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error'
    console.error('[check-in/lookup] error:', msg)
    return NextResponse.json({ data: null, error: msg }, { status: 500 })
  }
}
