import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/utils/audit'
import { z } from 'zod'

const createPackSchema = z.object({
  event_id: z.string().uuid(),
  owner_id: z.string().uuid(),
  pack_name: z.string().min(1),
  total_tickets: z.number().int().min(1).max(500),
  notes: z.string().optional().nullable(),
})

// ─── GET /api/ticket-packs ────────────────────────────────────────────────────
// Admin: all packs. User: own packs only.
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('app_users')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = profile?.role === 'admin' || profile?.role === 'event_assistant'

    const url = new URL(req.url)
    const eventId = url.searchParams.get('event_id')
    const search = url.searchParams.get('search')

    let query = supabase
      .from('ticket_packs')
      .select(`
        *,
        event:events(id, name, start_date, status),
        owner:app_users(id, full_name, email),
        tickets(id, status, recipient_name, recipient_email)
      `)
      .order('created_at', { ascending: false })

    // Non-admins only see their own packs
    if (!isAdmin) {
      query = query.eq('owner_id', user.id)
    }

    if (eventId) query = query.eq('event_id', eventId)

    const { data, error } = await query
    if (error) throw error

    // Optionally filter by owner search (admin use)
    let result = data ?? []
    if (search && isAdmin) {
      const q = search.toLowerCase()
      result = result.filter((p: any) =>
        p.owner?.full_name?.toLowerCase().includes(q) ||
        p.owner?.email?.toLowerCase().includes(q) ||
        p.pack_name?.toLowerCase().includes(q)
      )
    }

    return NextResponse.json({ data: result, error: null })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ data: null, error: msg }, { status: 500 })
  }
}

// ─── POST /api/ticket-packs ───────────────────────────────────────────────────
// Admin only. DB trigger auto-generates individual ticket rows.
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const adminSupa = createAdminClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('app_users')
      .select('role, email')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = createPackSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: parsed.error.errors[0]?.message ?? 'Validation error' },
        { status: 422 }
      )
    }

    // Verify event exists
    const { data: event } = await adminSupa
      .from('events')
      .select('id, name')
      .eq('id', parsed.data.event_id)
      .single()

    if (!event) {
      return NextResponse.json({ data: null, error: 'Event not found' }, { status: 404 })
    }

    // Verify owner exists
    const { data: owner } = await adminSupa
      .from('app_users')
      .select('id, full_name, email')
      .eq('id', parsed.data.owner_id)
      .single()

    if (!owner) {
      return NextResponse.json({ data: null, error: 'User not found' }, { status: 404 })
    }

    // Insert pack — DB trigger handles ticket row generation
    const { data: pack, error: packError } = await adminSupa
      .from('ticket_packs')
      .insert({
        event_id: parsed.data.event_id,
        owner_id: parsed.data.owner_id,
        pack_name: parsed.data.pack_name,
        total_tickets: parsed.data.total_tickets,
        notes: parsed.data.notes ?? null,
      })
      .select()
      .single()

    if (packError) throw packError

    await logAudit({
      actorId: user.id,
      actorEmail: profile.email,
      action: 'pack.create',
      entityType: 'ticket_pack',
      entityId: pack.id,
      newValue: {
        pack_name: pack.pack_name,
        total_tickets: pack.total_tickets,
        event: event.name,
        owner: owner.email,
      },
    })

    return NextResponse.json({ data: pack, error: null }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ data: null, error: msg }, { status: 500 })
  }
}
