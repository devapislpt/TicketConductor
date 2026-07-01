import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/utils/audit'
import { slugify } from '@/lib/utils/format'
import { z } from 'zod'

// ─── Validation ────────────────────────────────────────────────────────────────
const createEventSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  description: z.string().optional().nullable(),
  details: z.string().optional().nullable(),
  location_name: z.string().optional().nullable(),
  location_address: z.string().optional().nullable(),
  google_maps_url: z.string().url().optional().nullable(),
  start_date: z.string().min(1),
  end_date: z.string().optional().nullable(),
  cutoff_at: z.string().optional().nullable(),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  banner_url: z.string().url().optional().nullable(),
  links: z.array(z.object({
    type: z.enum(['zoom', 'maps', 'website', 'other']),
    label: z.string(),
    url: z.string().url(),
    sort_order: z.number().default(0),
  })).default([]),
})

// ─── GET /api/events ────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()

    // Check auth + role
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 })
    }

    // Determine role
    const { data: profile } = await supabase
      .from('app_users')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = profile?.role === 'admin' || profile?.role === 'event_assistant'

    let query = supabase
      .from('events')
      .select('*, links:event_links(*)')
      .order('start_date', { ascending: false })

    // Non-admins only see published events
    if (!isAdmin) {
      query = query.eq('status', 'published')
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ data, error: null })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ data: null, error: msg }, { status: 500 })
  }
}

// ─── POST /api/events ───────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const adminSupa = createAdminClient()

    // Auth check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 })
    }

    // Role check — admin only
    const { data: profile } = await supabase
      .from('app_users')
      .select('role, email')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = createEventSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: parsed.error.errors[0]?.message ?? 'Validation error' },
        { status: 422 }
      )
    }

    const { links, ...eventData } = parsed.data

    // Ensure slug uniqueness — append random suffix if needed
    let slug = eventData.slug || slugify(eventData.name)
    const { count } = await adminSupa
      .from('events')
      .select('*', { count: 'exact', head: true })
      .eq('slug', slug)

    if ((count ?? 0) > 0) {
      slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`
    }

    // Insert event
    const { data: event, error: insertError } = await adminSupa
      .from('events')
      .insert({ ...eventData, slug, created_by: user.id })
      .select()
      .single()

    if (insertError) throw insertError

    // Insert event links
    if (links.length > 0) {
      await adminSupa.from('event_links').insert(
        links.map((link, i) => ({
          event_id: event.id,
          type: link.type,
          label: link.label,
          url: link.url,
          sort_order: link.sort_order ?? i,
        }))
      )
    }

    // Audit log
    await logAudit({
      actorId: user.id,
      actorEmail: profile.email,
      action: 'event.create',
      entityType: 'event',
      entityId: event.id,
      newValue: { name: event.name, slug: event.slug, status: event.status },
    })

    return NextResponse.json({ data: event, error: null }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ data: null, error: msg }, { status: 500 })
  }
}
