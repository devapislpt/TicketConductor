import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/utils/audit'
import { z } from 'zod'

// ─── Validation ────────────────────────────────────────────────────────────
const patchSettingsSchema = z.object({
  animations_enabled: z.boolean().optional(),
  sounds_enabled: z.boolean().optional(),
  soundtrack_enabled: z.boolean().optional(),
  soundtrack_autoplay: z.boolean().optional(),
  sound_volume: z.number().min(0).max(1).optional(),
  soundtrack_volume: z.number().min(0).max(1).optional(),
  animation_duration: z.number().min(100).max(1000).optional(),
  animation_easing: z.string().optional(),
})

export type AppSettings = {
  animations_enabled: boolean
  sounds_enabled: boolean
  soundtrack_enabled: boolean
  soundtrack_autoplay: boolean
  sound_volume: number
  soundtrack_volume: number
  animation_duration: number
  animation_easing: string
}

// ─── GET /api/admin/settings ───────────────────────────────────────────────
// Returns app-level settings as a typed object.
export async function GET(_req: NextRequest) {
  try {
    const adminSupa = createAdminClient()

    const SETTINGS_KEYS = [
      'animations_enabled',
      'sounds_enabled',
      'soundtrack_enabled',
      'soundtrack_autoplay',
      'sound_volume',
      'soundtrack_volume',
      'animation_duration',
      'animation_easing',
    ]

    const { data, error } = await adminSupa
      .from('theme_settings')
      .select('key, value')
      .in('key', SETTINGS_KEYS)

    if (error) throw error

    const raw = (data ?? []).reduce<Record<string, string>>((acc, row) => {
      acc[row.key as string] = row.value as string
      return acc
    }, {})

    const settings: AppSettings = {
      animations_enabled: raw.animations_enabled !== 'false',
      sounds_enabled: raw.sounds_enabled !== 'false',
      soundtrack_enabled: raw.soundtrack_enabled === 'true',
      soundtrack_autoplay: raw.soundtrack_autoplay === 'true',
      sound_volume: raw.sound_volume ? parseFloat(raw.sound_volume) : 0.5,
      soundtrack_volume: raw.soundtrack_volume ? parseFloat(raw.soundtrack_volume) : 0.2,
      animation_duration: raw.animation_duration ? parseInt(raw.animation_duration, 10) : 200,
      animation_easing: raw.animation_easing ?? 'cubic-bezier(0.4, 0, 0.2, 1)',
    }

    return NextResponse.json({ data: settings, error: null })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ data: null, error: msg }, { status: 500 })
  }
}

// ─── PATCH /api/admin/settings ─────────────────────────────────────────────
// Updates app-level settings. Admin only. Logs audit trail.
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const adminSupa = createAdminClient()

    // Auth
    const {
      data: { user },
    } = await supabase.auth.getUser()
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
    const parsed = patchSettingsSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: parsed.error.flatten().fieldErrors },
        { status: 422 }
      )
    }

    const updates = parsed.data
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { data: null, error: 'No settings provided' },
        { status: 422 }
      )
    }

    const now = new Date().toISOString()

    // Convert typed values back to string for theme_settings table
    const stringifiedUpdates: Record<string, string> = {}
    for (const [key, val] of Object.entries(updates)) {
      if (val !== undefined) {
        stringifiedUpdates[key] = String(val)
      }
    }

    const keys = Object.keys(stringifiedUpdates)

    // Fetch old values for audit
    const { data: oldRows } = await adminSupa
      .from('theme_settings')
      .select('key, value')
      .in('key', keys)

    const oldValues = (oldRows ?? []).reduce<Record<string, string>>((acc, r) => {
      acc[r.key as string] = r.value as string
      return acc
    }, {})

    // Upsert each setting
    const upsertRows = keys.map((key) => ({
      key,
      value: stringifiedUpdates[key],
      updated_by: user.id,
      updated_at: now,
    }))

    const { error: upsertError } = await adminSupa
      .from('theme_settings')
      .upsert(upsertRows, { onConflict: 'key' })

    if (upsertError) throw upsertError

    await logAudit({
      actorId: user.id,
      actorEmail: profile.email,
      action: 'settings.update',
      entityType: 'theme_settings',
      entityId: null,
      oldValue: oldValues as Record<string, unknown>,
      newValue: stringifiedUpdates as Record<string, unknown>,
    })

    return NextResponse.json({ data: updates, error: null })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ data: null, error: msg }, { status: 500 })
  }
}
