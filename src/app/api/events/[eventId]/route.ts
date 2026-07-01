import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/utils/audit'
import { z } from 'zod'

const updateEventSchema = z.object({
  name: z.string().min(2).optional(),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().optional().nullable(),
  details: z.string().optional().nullable(),
  location_name: z.string().optional().nullable(),
  location_address: z.string().optional().nullable(),
  google_maps_url: z.string().url().optional().nullable(),
  start_date: z.string().optional(),
  end_date: z.string().optional().nullable(),
  cutoff_at: z.string().optional().nullable(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  banner_url: z.string().url().optional().nullable(),
  links: z.array(z.object({
    id: z.string().optional(),
    type: z.enum(['zoom', 'maps', 'website', 'other']),
    label: z.string(),
    url: z.string().url(),
    sort_order: z.number().default(0),
  })).optional(),
})

type Params = { params: Promise<{ eventId: string }> }

// ─── GET /api/events/[eventId] ────────────────────────────────────────────────
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { eventId } = await params
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

    const { data, error } = await supabase
      .from('events')
      .select('*, links:event_links(*)')
      .eq('id', eventId)
      .single()

    if (error || !data) {
      return NextResponse.json({ data: null, error: 'Event not found' }, { status: 404 })
    }

    // Non-admins can only see published events
    if (!isAdmin && data.status !== 'published') {
      return NextResponse.json({ data: null, error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ data, error: null })
  } catch (e) {
    return NextResponse.json({ data: null, error: 'Server error' }, { status: 500 })
  }
}

// ─── PATCH /api/events/[eventId] ─────────────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { eventId } = await params
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

    // Fetch current state for audit diff
    const { data: existing } = await adminSupa
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single()

    if (!existing) {
      return NextResponse.json({ data: null, error: 'Event not found' }, { status: 404 })
    }

    const body = await req.json()
    const parsed = updateEventSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: parsed.error.errors[0]?.message ?? 'Validation error' },
        { status: 422 }
      )
    }

    const { links, ...eventUpdates } = parsed.data

    // Update event record
    const { data: updated, error: updateError } = await adminSupa
      .from('events')
      .update({ ...eventUpdates, updated_at: new Date().toISOString() })
      .eq('id', eventId)
      .select()
      .single()

    if (updateError) throw updateError

    // Replace links if provided
    if (links !== undefined) {
      // Delete existing links
      await adminSupa.from('event_links').delete().eq('event_id', eventId)

      if (links.length > 0) {
        await adminSupa.from('event_links').insert(
          links.map((link, i) => ({
            event_id: eventId,
            type: link.type,
            label: link.label,
            url: link.url,
            sort_order: link.sort_order ?? i,
          }))
        )
      }
    }

    await logAudit({
      actorId: user.id,
      actorEmail: profile.email,
      action: 'event.update',
      entityType: 'event',
      entityId: eventId,
      oldValue: { name: existing.name, status: existing.status },
      newValue: { name: updated.name, status: updated.status },
    })

    return NextResponse.json({ data: updated, error: null })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ data: null, error: msg }, { status: 500 })
  }
}

// ─── DELETE /api/events/[eventId] ────────────────────────────────────────────
// Soft delete: sets status to 'archived'
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { eventId } = await params
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

    const { data: existing } = await adminSupa
      .from('events')
      .select('name, status')
      .eq('id', eventId)
      .single()

    if (!existing) {
      return NextResponse.json({ data: null, error: 'Event not found' }, { status: 404 })
    }

    // Soft delete — archive
    const { error } = await adminSupa
      .from('events')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', eventId)

    if (error) throw error

    await logAudit({
      actorId: user.id,
      actorEmail: profile.email,
      action: 'event.delete',
      entityType: 'event',
      entityId: eventId,
      oldValue: { status: existing.status },
      newValue: { status: 'archived' },
    })

    return NextResponse.json({ data: { archived: true }, error: null })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ data: null, error: msg }, { status: 500 })
  }
}
