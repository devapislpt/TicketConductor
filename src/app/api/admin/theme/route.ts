import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/utils/audit'
import { z } from 'zod'
import type { ThemeConfig } from '@/lib/types'

const patchThemeSchema = z.record(z.string(), z.string())

export async function GET(_req: NextRequest) {
  try {
    const adminSupa = createAdminClient()
    const { data, error } = await adminSupa.from('theme_settings').select('key, value')
    if (error) throw error
    const config = (data ?? []).reduce<Record<string, string>>((acc, row) => {
      acc[row.key as string] = row.value as string
      return acc
    }, {})
    return NextResponse.json(
      { data: config as Partial<ThemeConfig>, error: null },
      { headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=300' } }
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ data: null, error: msg }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
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
    const parsed = patchThemeSchema.safeParse(body)

    if (!parsed.success || Object.keys(parsed.data).length === 0) {
      return NextResponse.json(
        { data: null, error: 'Body must be a non-empty key-value object of strings' },
        { status: 422 }
      )
    }

    const updates = parsed.data
    const now = new Date().toISOString()
    const keys = Object.keys(updates)

    const { data: oldRows } = await adminSupa
      .from('theme_settings')
      .select('key, value')
      .in('key', keys)

    const oldValues = (oldRows ?? []).reduce<Record<string, string>>((acc, r) => {
      acc[r.key as string] = r.value as string
      return acc
    }, {})

    const upsertRows = keys.map((key) => ({
      key,
      value: updates[key],
      updated_by: user.id,
      updated_at: now,
    }))

    const { data: updated, error: upsertError } = await adminSupa
      .from('theme_settings')
      .upsert(upsertRows, { onConflict: 'key' })
      .select('key, value')

    if (upsertError) throw upsertError

    await logAudit({
      actorId: user.id,
      actorEmail: profile.email,
      action: 'theme.update',
      entityType: 'theme_settings',
      entityId: null,
      oldValue: oldValues,
      newValue: updates,
    })

    const result = (updated ?? []).reduce<Record<string, string>>((acc, r) => {
      acc[r.key as string] = r.value as string
      return acc
    }, {})

    return NextResponse.json({ data: result, error: null })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ data: null, error: msg }, { status: 500 })
  }
}
