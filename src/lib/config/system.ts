/**
 * system.ts — Server-only module for reading/writing system_config values.
 *
 * system_config table schema:
 *   key         TEXT UNIQUE
 *   value       TEXT          (plaintext or encrypted ciphertext)
 *   is_secret   BOOLEAN       (if true, value is AES-256-GCM encrypted)
 *   label       TEXT
 *   description TEXT
 *   category    TEXT
 *
 * Usage:
 *   import { getConfig, setConfig, getResendApiKey } from '@/lib/config/system'
 *
 * NEVER import this in client components — it uses Node.js crypto and
 * accesses the service role Supabase client.
 */

import { createAdminClient } from '@/lib/supabase/server'
import { encrypt, decrypt, getSecret } from '@/lib/utils/crypto'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SystemConfigRow {
  key: string
  value: string | null
  is_secret: boolean
  label: string
  description: string
  category: string
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function getRow(key: string): Promise<SystemConfigRow | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('system_config')
    .select('key, value, is_secret, label, description, category')
    .eq('key', key)
    .maybeSingle()

  if (error) {
    console.error(`[SystemConfig] Failed to read key "${key}":`, error.message)
    return null
  }
  return data as SystemConfigRow | null
}

async function getAllRows(): Promise<SystemConfigRow[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('system_config')
    .select('key, value, is_secret, label, description, category')
    .order('category')
    .order('key')

  if (error) {
    console.error('[SystemConfig] Failed to read all rows:', error.message)
    return []
  }
  return (data ?? []) as SystemConfigRow[]
}

// ─── getConfig ────────────────────────────────────────────────────────────────
/**
 * Reads a single config value. Decrypts if is_secret=true.
 * Returns null if the key doesn't exist or has no value.
 */
export async function getConfig(key: string): Promise<string | null> {
  const row = await getRow(key)
  if (!row || row.value === null || row.value === '') return null

  if (row.is_secret) {
    try {
      const secret = getSecret()
      return decrypt(row.value, secret)
    } catch (err) {
      console.error(`[SystemConfig] Failed to decrypt key "${key}":`, err instanceof Error ? err.message : err)
      return null
    }
  }

  return row.value
}

// ─── getConfigRaw ─────────────────────────────────────────────────────────────
/**
 * Returns the actual decrypted value (same as getConfig).
 * Named explicitly to signal "this returns real secrets — never send to client."
 */
export async function getConfigRaw(key: string): Promise<string | null> {
  return getConfig(key)
}

// ─── setConfig ────────────────────────────────────────────────────────────────
/**
 * Upserts a config value. Encrypts if the row's is_secret=true.
 * If the key doesn't exist yet in the table, it inserts with is_secret=false
 * (the DB schema should pre-populate rows with correct metadata).
 */
export async function setConfig(
  key: string,
  value: string,
  _actorId?: string
): Promise<void> {
  const supabase = createAdminClient()

  // Check if the row exists and whether it should be encrypted
  const existing = await getRow(key)
  const isSecret = existing?.is_secret ?? false

  let storedValue = value
  if (isSecret && value !== '') {
    try {
      const secret = getSecret()
      storedValue = encrypt(value, secret)
    } catch (err) {
      throw new Error(
        `[SystemConfig] Cannot encrypt key "${key}": ${err instanceof Error ? err.message : 'Unknown error'}`
      )
    }
  }

  const { error } = await supabase
    .from('system_config')
    .upsert(
      { key, value: storedValue },
      { onConflict: 'key' }
    )

  if (error) {
    throw new Error(`[SystemConfig] Failed to save key "${key}": ${error.message}`)
  }
}

// ─── getAllConfig ─────────────────────────────────────────────────────────────
/**
 * Returns all config keys with masked values:
 *   - Non-secrets: actual value
 *   - Secrets that are set: '••••••••' + last 4 chars of the DECRYPTED value
 *   - Secrets that are not set: null
 *
 * Safe to use server-side for display. Never call from client routes.
 */
export async function getAllConfig(): Promise<Record<string, string | null>> {
  const rows = await getAllRows()
  const result: Record<string, string | null> = {}

  for (const row of rows) {
    if (row.value === null || row.value === '') {
      result[row.key] = null
      continue
    }

    if (row.is_secret) {
      try {
        const secret = getSecret()
        const decrypted = decrypt(row.value, secret)
        // Show last 4 chars so admin can recognise the key without exposing it
        const hint = decrypted.length >= 4
          ? '••••••••' + decrypted.slice(-4)
          : '••••••••'
        result[row.key] = hint
      } catch {
        result[row.key] = '••••••••'
      }
    } else {
      result[row.key] = row.value
    }
  }

  return result
}

// ─── isConfigured ─────────────────────────────────────────────────────────────
/**
 * Checks which of the supplied keys have a non-null, non-empty value in the DB.
 * Does NOT decrypt — just checks presence.
 */
export async function isConfigured(
  keys: string[]
): Promise<Record<string, boolean>> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('system_config')
    .select('key, value')
    .in('key', keys)

  if (error) {
    console.error('[SystemConfig] isConfigured query failed:', error.message)
    return Object.fromEntries(keys.map((k) => [k, false]))
  }

  const found = new Map<string, boolean>()
  for (const row of data ?? []) {
    found.set(row.key as string, row.value !== null && row.value !== '')
  }

  return Object.fromEntries(keys.map((k) => [k, found.get(k) ?? false]))
}

// ─── Named accessors ──────────────────────────────────────────────────────────
// These are the primary way application code should read config.
// Each falls back gracefully when a key isn't set.

/** Returns the Resend API key from DB (decrypted) or null. */
export async function getResendApiKey(): Promise<string | null> {
  return getConfig('resend_api_key')
}

/** Returns the From email address used for outgoing email. */
export async function getResendFromEmail(): Promise<string | null> {
  return getConfig('resend_from_email')
}

/** Returns the From display name used for outgoing email. */
export async function getResendFromName(): Promise<string | null> {
  return getConfig('resend_from_name')
}

/** Returns the canonical app URL (e.g. https://tickets.fallcon.com). */
export async function getAppUrl(): Promise<string | null> {
  return getConfig('app_url')
}

/** Returns the app display name. */
export async function getAppName(): Promise<string | null> {
  return getConfig('app_name')
}

/** Returns the support/contact email address. */
export async function getSupportEmail(): Promise<string | null> {
  return getConfig('support_email')
}
