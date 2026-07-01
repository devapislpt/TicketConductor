import { createAdminClient } from '@/lib/supabase/server'
import type { AuditAction } from '@/lib/types'

interface LogAuditParams {
  actorId?: string | null
  actorEmail?: string | null
  action: AuditAction
  entityType: string
  entityId?: string | null
  oldValue?: Record<string, unknown> | null
  newValue?: Record<string, unknown> | null
  ipAddress?: string | null
  userAgent?: string | null
}

export async function logAudit(params: LogAuditParams) {
  try {
    const supabase = createAdminClient()
    await supabase.from('audit_logs').insert({
      actor_id: params.actorId ?? null,
      actor_email: params.actorEmail ?? null,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      old_value: params.oldValue ?? null,
      new_value: params.newValue ?? null,
      ip_address: params.ipAddress ?? null,
      user_agent: params.userAgent ?? null,
    })
  } catch (e) {
    console.error('[audit] Failed to write log:', e)
  }
}
