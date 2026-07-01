/**
 * GET  /api/admin/system-config
 *   Returns all system_config rows. Secrets shown as { is_set, value_hint }.
 *   Actual secret values are NEVER returned to the client.
 *
 * PATCH /api/admin/system-config
 *   Body: { updates: Array<{ key: string; value: string }> }
 *   Encrypts secrets, logs audit entry for each key changed.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { encrypt, decrypt, getSecret } from '@/lib/utils/crypto'
import { logAudit } from '@/lib/utils/audit'
import { z } from 'zod'

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function requireAdmin(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { user: null, profile: null, error: 'Unauthorized', status: 401 }

  const { data: profile } = await supabase
    .from('app_users')
    .select('role, email')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { user: null, profile: null, error: 'Forbidden', status: 403 }
  }

  return { user, profile, error: null, status: 200 }
}

// ─── Response shape ───────────────────────────────────────────────────────────

export interface SystemConfigItem {
  key: string
  label: string
  description: string
  category: string
  is_secret: boolean
  is_set: boolean
  value_hint: string | null   // last 4 chars for secrets, actual value for non-secrets
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { user, error, status } = await requireAdmin(req)
  if (!user) return NextResponse.json({ data: null, error }, { status })

  try {
    const adminSupa = createAdminClient()
    const { data: rows, error: dbError } = await adminSupa
      .from('system_config')
      .select('key, value, is_secret, label, description, category')
      .order('category')
      .order('key')

    if (dbError) throw dbError

    let systemSecret: string | null = null
    try {
      systemSecret = getSecret()
    } catch {
      // SYSTEM_SECRET not set — secrets will show as is_set=false
    }

    const items: SystemConfigItem[] = (rows ?? []).map((row) => {
      const hasValue = row.value !== null && row.value !== ''

      if (!hasValue) {
        return {
          key: row.key as string,
          label: row.label as string,
          description: row.description as string,
          category: row.category as string,
          is_secret: Boolean(row.is_secret),
          is_set: false,
          value_hint: null,
        }
      }

      if (row.is_secret) {
        let hint: string | null = null
        if (systemSecret) {
          try {
            const decrypted = decrypt(row.value as string, systemSecret)
            hint = decrypted.length >= 4 ? decrypted.slice(-4) : null
          } catch {
            hint = null
          }
        }
        return {
          key: row.key as string,
          label: row.label as string,
          description: row.description as string,
          category: row.category as string,
          is_secret: true,
          is_set: true,
          value_hint: hint,   // last 4 chars of decrypted value, or null
        }
      }

      // Non-secret: return actual value
      return {
        key: row.key as string,
        label: row.label as string,
        description: row.description as string,
        category: row.category as string,
        is_secret: false,
        is_set: true,
        value_hint: row.value as string,
      }
    })

    return NextResponse.json({ data: items, error: null })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error'
    console.error('[system-config GET]', msg)
    return NextResponse.json({ data: null, error: msg }, { status: 500 })
  }
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

const patchSchema = z.object({
  updates: z
    .array(
      z.object({
        key: z.string().min(1),
        value: z.string(),
      })
    )
    .min(1),
})

export async function PATCH(req: NextRequest) {
  const { user, profile, error, status } = await requireAdmin(req)
  if (!user) return NextResponse.json({ data: null, error }, { status })

  try {
    const body = await req.json()
    const parsed = patchSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: parsed.error.flatten().fieldErrors },
        { status: 422 }
      )
    }

    const { updates } = parsed.data
    const adminSupa = createAdminClient()

    // Fetch current rows to know is_secret status + old values for audit
    const keys = updates.map((u) => u.key)
    const { data: existingRows, error: fetchError } = await adminSupa
      .from('system_config')
      .select('key, value, is_secret')
      .in('key', keys)

    if (fetchError) throw fetchError

    const rowMeta = new Map<string, { is_secret: boolean; old_value: string | null }>(
      (existingRows ?? []).map((r) => [
        r.key as string,
        {
          is_secret: Boolean(r.is_secret),
          old_value: r.value as string | null,
        },
      ])
    )

    // Get encryption secret (required if any update targets a secret key)
    let systemSecret: string | null = null
    const hasSecrets = updates.some((u) => rowMeta.get(u.key)?.is_secret)
    if (hasSecrets) {
      systemSecret = getSecret()   // throws with clear message if not set
    }

    // Prepare upsert rows
    const upsertRows: { key: string; value: string }[] = []

    for (const update of updates) {
      const meta = rowMeta.get(update.key)
      const isSecret = meta?.is_secret ?? false
      let storedValue = update.value

      if (isSecret && update.value !== '' && systemSecret) {
        storedValue = encrypt(update.value, systemSecret)
      }

      upsertRows.push({ key: update.key, value: storedValue })
    }

    const { error: upsertError } = await adminSupa
      .from('system_config')
      .upsert(upsertRows, { onConflict: 'key' })

    if (upsertError) throw upsertError

    // Audit log — one entry per changed key
    const auditPromises = updates.map((update) => {
      const meta = rowMeta.get(update.key)
      const isSecret = meta?.is_secret ?? false

      return logAudit({
        actorId: user.id,
        actorEmail: profile?.email ?? null,
        action: 'settings.update',
        entityType: 'system_config',
        entityId: update.key,
        oldValue: { value: isSecret ? '[secret]' : (meta?.old_value ?? null) },
        newValue: { value: isSecret ? '[secret]' : update.value },
      })
    })

    await Promise.allSettled(auditPromises)

    return NextResponse.json({ data: { updated: keys }, error: null })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error'
    console.error('[system-config PATCH]', msg)
    return NextResponse.json({ data: null, error: msg }, { status: 500 })
  }
}
