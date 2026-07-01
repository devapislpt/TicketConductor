import { createClient } from '@/lib/supabase/server'
import { ClipboardList } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils/format'
import type { AuditLog, AuditAction } from '@/lib/types'
import { LogsClientSection } from './_components/LogsClientSection'

const PAGE_SIZE = 50

function actionVariant(action: string) {
  if (action.startsWith('user')) return 'info' as const
  if (action.startsWith('event')) return 'warning' as const
  if (action.startsWith('ticket')) return 'success' as const
  if (action.startsWith('theme') || action.startsWith('settings')) return 'outline' as const
  return 'default' as const
}

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: Promise<{
    action?: string
    actor?: string
    from?: string
    to?: string
    page?: string
  }>
}) {
  const { action, actor, from, to, page: pageParam } = await searchParams
  const page = Math.max(0, parseInt(pageParam ?? '0', 10))

  const supabase = await createClient()

  let query = supabase
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

  if (action) query = query.eq('action', action)
  if (actor) query = query.ilike('actor_email', `%${actor}%`)
  if (from) query = query.gte('created_at', from)
  if (to) query = query.lte('created_at', to + 'T23:59:59Z')

  const { data, count, error } = await query

  const logs = (data ?? []) as AuditLog[]
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)

  // Distinct action types for filter dropdown
  const { data: actionsData } = await supabase
    .from('audit_logs')
    .select('action')
    .order('action')
  const distinctActions = [...new Set((actionsData ?? []).map((r: any) => r.action as string))]

  return (
    <div className="space-y-6 p-6 md:p-8 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-[var(--letter-spacing-heading)] text-[var(--color-foreground)]">
            Audit Log
          </h1>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            Full history of all admin and user actions
          </p>
        </div>
        {/* Export button — client island also handles filter form */}
        <LogsClientSection
          currentFilters={{ action, actor, from, to }}
          distinctActions={distinctActions}
        />
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-[var(--border-radius)] border border-[var(--color-destructive)]/40 bg-[var(--color-destructive)]/10 px-4 py-3 text-sm text-[var(--color-destructive)]"
        >
          Failed to load logs: {error.message}
        </div>
      )}

      {/* ── Table ── */}
      <Card>
        <CardHeader divider>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList size={18} className="text-[var(--color-primary)]" aria-hidden="true" />
            Entries
            <span className="ml-auto text-sm font-normal text-[var(--color-muted-foreground)]">
              {count ?? 0} total · page {page + 1} of {Math.max(1, totalPages)}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-[var(--color-muted-foreground)]">
              <ClipboardList size={36} strokeWidth={1} aria-hidden="true" />
              <p className="text-sm">No log entries found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" role="grid">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
                    {['Timestamp', 'Actor', 'Action', 'Entity', 'Changes'].map((h) => (
                      <th
                        key={h}
                        scope="col"
                        className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <LogRow key={log.id} log={log} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border)]">
              <p className="text-xs text-[var(--color-muted-foreground)]">
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, count ?? 0)} of {count ?? 0}
              </p>
              <div className="flex gap-2">
                {page > 0 && (
                  <a
                    href={`/admin/logs?page=${page - 1}${action ? `&action=${action}` : ''}${actor ? `&actor=${actor}` : ''}`}
                    className="inline-flex items-center px-3 h-8 text-xs rounded-[var(--border-radius)] border border-[var(--color-border)] hover:border-[var(--color-primary)] text-[var(--color-foreground)] transition-colors"
                  >
                    &larr; Prev
                  </a>
                )}
                {page < totalPages - 1 && (
                  <a
                    href={`/admin/logs?page=${page + 1}${action ? `&action=${action}` : ''}${actor ? `&actor=${actor}` : ''}`}
                    className="inline-flex items-center px-3 h-8 text-xs rounded-[var(--border-radius)] border border-[var(--color-border)] hover:border-[var(--color-primary)] text-[var(--color-foreground)] transition-colors"
                  >
                    Next &rarr;
                  </a>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Log Row (server) ─────────────────────────────────────────────────────────
import { LogRowExpander } from './_components/LogRowExpander'

function LogRow({ log }: { log: AuditLog }) {
  return (
    <tr className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-muted)] transition-colors duration-150 align-top">
      <td className="px-4 py-3 text-xs text-[var(--color-muted-foreground)] whitespace-nowrap">
        <time dateTime={log.created_at}>{formatDateTime(log.created_at)}</time>
      </td>
      <td className="px-4 py-3">
        <p className="text-sm text-[var(--color-foreground)]">{log.actor_email ?? 'System'}</p>
      </td>
      <td className="px-4 py-3">
        <Badge variant={actionVariant(log.action)}>{log.action}</Badge>
      </td>
      <td className="px-4 py-3">
        <p className="text-sm text-[var(--color-foreground)]">{log.entity_type}</p>
        {log.entity_id && (
          <p className="text-xs font-mono text-[var(--color-muted-foreground)]">
            #{log.entity_id.slice(0, 8)}
          </p>
        )}
      </td>
      <td className="px-4 py-3">
        {(log.old_value || log.new_value) ? (
          <LogRowExpander oldValue={log.old_value} newValue={log.new_value} />
        ) : (
          <span className="text-xs text-[var(--color-muted-foreground)]">—</span>
        )}
      </td>
    </tr>
  )
}
