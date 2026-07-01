import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/utils/audit'
import { z } from 'zod'

const createUserSchema = z.object({
  email: z.string().email(),
  full_name: z.string().optional().nullable(),
  role: z.enum(['admin', 'event_assistant', 'ticket_owner']).default('ticket_owner'),
  team_id: z.string().uuid().optional().nullable(),
})

const updateUserSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().optional().nullable(),
  role: z.enum(['admin', 'event_assistant', 'ticket_owner']).optional(),
  team_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean().optional(),
  action: z.enum(['magic_link', 'password_reset', 'impersonate']).optional(),
})

// ─── Helper: require admin ────────────────────────────────────────────────────
async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, profile: null, error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('app_users')
    .select('role, email')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') return { user, profile, error: 'Forbidden' }
  return { user, profile, error: null }
}

// ─── GET /api/admin/users ─────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { user, profile, error: authErr } = await requireAdmin(supabase)
    if (authErr) {
      return NextResponse.json({ data: null, error: authErr }, { status: authErr === 'Unauthorized' ? 401 : 403 })
    }

    const url = new URL(req.url)
    const search = url.searchParams.get('search')
    const role = url.searchParams.get('role')
    const teamId = url.searchParams.get('team_id')
    const active = url.searchParams.get('active')

    let query = supabase
      .from('app_users')
      .select(`
        *,
        team:teams(id, name),
        ticket_packs(id)
      `)
      .order('created_at', { ascending: false })

    if (role) query = query.eq('role', role)
    if (teamId) query = query.eq('team_id', teamId)
    if (active === 'true') query = query.eq('is_active', true)
    if (active === 'false') query = query.eq('is_active', false)

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ data, error: null })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ data: null, error: msg }, { status: 500 })
  }
}

// ─── POST /api/admin/users ────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const adminSupa = createAdminClient()
    const { user, profile, error: authErr } = await requireAdmin(supabase)
    if (authErr) {
      return NextResponse.json({ data: null, error: authErr }, { status: authErr === 'Unauthorized' ? 401 : 403 })
    }

    const body = await req.json()
    const parsed = createUserSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: parsed.error.errors[0]?.message ?? 'Validation error' },
        { status: 422 }
      )
    }

    const { email, full_name, role, team_id } = parsed.data

    // Create Supabase Auth user
    const { data: authUser, error: createError } = await adminSupa.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name },
    })

    if (createError) {
      // If user exists, just fetch them
      if (!createError.message.includes('already')) throw createError
    }

    const authUserId = authUser?.user?.id

    if (authUserId) {
      // Upsert profile
      await adminSupa.from('app_users').upsert({
        id: authUserId,
        email,
        full_name: full_name ?? null,
        role,
        team_id: team_id ?? null,
        is_active: true,
      }, { onConflict: 'id' })
    }

    // Send magic link
    await adminSupa.auth.admin.generateLink({
      type: 'magiclink',
      email,
    })

    await logAudit({
      actorId: user!.id,
      actorEmail: profile!.email,
      action: 'user.create',
      entityType: 'user',
      entityId: authUserId ?? null,
      newValue: { email, role },
    })

    return NextResponse.json({
      data: { id: authUserId, email, role },
      error: null,
    }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ data: null, error: msg }, { status: 500 })
  }
}

// ─── PATCH /api/admin/users ───────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const adminSupa = createAdminClient()
    const { user, profile, error: authErr } = await requireAdmin(supabase)
    if (authErr) {
      return NextResponse.json({ data: null, error: authErr }, { status: authErr === 'Unauthorized' ? 401 : 403 })
    }

    const body = await req.json()
    const parsed = updateUserSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: parsed.error.errors[0]?.message ?? 'Validation error' },
        { status: 422 }
      )
    }

    const { id: targetId, action, ...updates } = parsed.data

    // Fetch target user for audit
    const { data: targetUser } = await adminSupa
      .from('app_users')
      .select('role, email, is_active')
      .eq('id', targetId)
      .single()

    if (!targetUser) {
      return NextResponse.json({ data: null, error: 'User not found' }, { status: 404 })
    }

    // Handle special actions
    if (action === 'magic_link') {
      await adminSupa.auth.admin.generateLink({
        type: 'magiclink',
        email: targetUser.email,
      })

      await logAudit({
        actorId: user!.id,
        actorEmail: profile!.email,
        action: 'user.magic_link_sent',
        entityType: 'user',
        entityId: targetId,
        newValue: { email: targetUser.email },
      })

      return NextResponse.json({ data: { sent: true }, error: null })
    }

    if (action === 'password_reset') {
      await adminSupa.auth.admin.generateLink({
        type: 'recovery',
        email: targetUser.email,
      })

      await logAudit({
        actorId: user!.id,
        actorEmail: profile!.email,
        action: 'user.password_reset',
        entityType: 'user',
        entityId: targetId,
        newValue: { email: targetUser.email },
      })

      return NextResponse.json({ data: { sent: true }, error: null })
    }

    if (action === 'impersonate') {
      // Log impersonation — actual session switch handled client-side
      await logAudit({
        actorId: user!.id,
        actorEmail: profile!.email,
        action: 'user.impersonate',
        entityType: 'user',
        entityId: targetId,
        newValue: { target_email: targetUser.email },
      })

      return NextResponse.json({ data: { impersonate_target_id: targetId }, error: null })
    }

    // Standard field updates
    const profileUpdates: Record<string, unknown> = {}
    if (updates.full_name !== undefined) profileUpdates.full_name = updates.full_name
    if (updates.role !== undefined) profileUpdates.role = updates.role
    if (updates.team_id !== undefined) profileUpdates.team_id = updates.team_id
    if (updates.is_active !== undefined) profileUpdates.is_active = updates.is_active

    if (Object.keys(profileUpdates).length > 0) {
      const { data: updated, error: updateErr } = await adminSupa
        .from('app_users')
        .update({ ...profileUpdates, updated_at: new Date().toISOString() })
        .eq('id', targetId)
        .select()
        .single()

      if (updateErr) throw updateErr

      await logAudit({
        actorId: user!.id,
        actorEmail: profile!.email,
        action: 'user.update',
        entityType: 'user',
        entityId: targetId,
        oldValue: { role: targetUser.role, is_active: targetUser.is_active },
        newValue: profileUpdates,
      })

      return NextResponse.json({ data: updated, error: null })
    }

    return NextResponse.json({ data: targetUser, error: null })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ data: null, error: msg }, { status: 500 })
  }
}

// ─── DELETE /api/admin/users ──────────────────────────────────────────────────
// Deactivates user (is_active = false). Does not hard-delete.
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const adminSupa = createAdminClient()
    const { user, profile, error: authErr } = await requireAdmin(supabase)
    if (authErr) {
      return NextResponse.json({ data: null, error: authErr }, { status: authErr === 'Unauthorized' ? 401 : 403 })
    }

    const url = new URL(req.url)
    const targetId = url.searchParams.get('id')
    if (!targetId) {
      return NextResponse.json({ data: null, error: 'User ID required' }, { status: 400 })
    }

    const { data: target } = await adminSupa
      .from('app_users')
      .select('email, is_active')
      .eq('id', targetId)
      .single()

    if (!target) {
      return NextResponse.json({ data: null, error: 'User not found' }, { status: 404 })
    }

    await adminSupa
      .from('app_users')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', targetId)

    await logAudit({
      actorId: user!.id,
      actorEmail: profile!.email,
      action: 'user.delete',
      entityType: 'user',
      entityId: targetId,
      oldValue: { is_active: target.is_active },
      newValue: { is_active: false },
    })

    return NextResponse.json({ data: { deactivated: true }, error: null })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ data: null, error: msg }, { status: 500 })
  }
}
