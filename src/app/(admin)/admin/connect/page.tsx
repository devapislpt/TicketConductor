import { createClient } from '@/lib/supabase/server'
import { Plug, Clock, CheckCircle2, XCircle, Zap, Users, Ticket, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDateTime, formatRelative } from '@/lib/utils/format'
import { ConnectClientSection } from './_components/ConnectClientSection'

export default async function AdminConnectPage() {
  const supabase = await createClient()

  // Fetch connect config if it exists
  const { data: configData } = await supabase
    .from('connect_config')
    .select('*')
    .limit(1)
    .maybeSingle()

  const config = configData as {
    id: string
    api_url: string | null
    api_key_hint: string | null
    is_enabled: boolean
    last_sync_at: string | null
    sync_status: 'idle' | 'syncing' | 'error' | null
    error_message: string | null
    created_at: string
    updated_at: string
  } | null

  // Fetch sync log history (stub from audit_logs with entity_type = 'connect_sync')
  const { data: syncLogsData } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('entity_type', 'connect_sync')
    .order('created_at', { ascending: false })
    .limit(10)

  const syncLogs = (syncLogsData ?? []) as Array<{
    id: string
    action: string
    created_at: string
    new_value: Record<string, unknown> | null
    actor_email: string | null
  }>

  const isConfigured = !!(config?.api_url && config?.api_key_hint)
  const statusVariant =
    config?.sync_status === 'syncing' ? 'info' :
    config?.sync_status === 'error' ? 'destructive' :
    isConfigured ? 'success' : 'warning'

  const statusLabel =
    config?.sync_status === 'syncing' ? 'Syncing…' :
    config?.sync_status === 'error' ? 'Error' :
    isConfigured ? 'Configured' : 'Not configured'

  return (
    <div className="space-y-8 p-6 md:p-8 max-w-4xl mx-auto">
      {/* ── Header ── */}
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-[var(--letter-spacing-heading)] text-[var(--color-foreground)] flex items-center gap-3">
          <Plug size={28} className="text-[var(--color-primary)]" aria-hidden="true" />
          Connect Integration
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Sync data with external systems via the Connect API.
        </p>
      </div>

      {/* ── Status Card ── */}
      <Card variant={isConfigured ? 'bordered' : 'default'}>
        <CardHeader divider>
          <div className="flex items-center justify-between">
            <CardTitle>Integration Status</CardTitle>
            <Badge variant={statusVariant} dot pulse={config?.sync_status === 'syncing'}>
              {statusLabel}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-[var(--color-muted-foreground)] uppercase tracking-wide mb-1">API URL</p>
              <p className="text-[var(--color-foreground)] font-mono text-xs truncate">
                {config?.api_url ?? <span className="text-[var(--color-muted-foreground)]">Not set</span>}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-muted-foreground)] uppercase tracking-wide mb-1">API Key</p>
              <p className="text-[var(--color-foreground)] font-mono text-xs">
                {config?.api_key_hint
                  ? `••••••••${config.api_key_hint}`
                  : <span className="text-[var(--color-muted-foreground)]">Not set</span>}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-muted-foreground)] uppercase tracking-wide mb-1">Last Sync</p>
              <p className="text-[var(--color-foreground)] text-xs">
                {config?.last_sync_at
                  ? formatRelative(config.last_sync_at)
                  : <span className="text-[var(--color-muted-foreground)]">Never</span>}
              </p>
            </div>
          </div>

          {config?.sync_status === 'error' && config.error_message && (
            <div className="mt-4 rounded-[var(--border-radius)] border border-[var(--color-destructive)]/30 bg-[var(--color-destructive)]/10 px-3 py-2 text-xs text-[var(--color-destructive)]">
              <span className="font-medium">Last error:</span> {config.error_message}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Config Form + Action Buttons (client island) ── */}
      <ConnectClientSection config={config} isConfigured={isConfigured} />

      {/* ── Sync Log ── */}
      <Card>
        <CardHeader divider>
          <CardTitle className="flex items-center gap-2">
            <Clock size={16} className="text-[var(--color-primary)]" aria-hidden="true" />
            Sync History
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {syncLogs.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-[var(--color-muted-foreground)]">
              No sync history yet.
            </p>
          ) : (
            <ul role="list" className="divide-y divide-[var(--color-border)]">
              {syncLogs.map((log) => (
                <li key={log.id} className="flex items-center gap-3 px-5 py-3">
                  {log.new_value?.status === 'error' ? (
                    <XCircle size={14} className="text-[var(--color-destructive)] shrink-0" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 size={14} className="text-[var(--color-success)] shrink-0" aria-hidden="true" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--color-foreground)] truncate">
                      {String(log.new_value?.message ?? log.action)}
                    </p>
                    {log.new_value?.records_synced !== undefined && (
                      <p className="text-xs text-[var(--color-muted-foreground)]">
                        {String(log.new_value.records_synced)} records synced
                      </p>
                    )}
                  </div>
                  <time
                    dateTime={log.created_at}
                    className="shrink-0 text-xs text-[var(--color-muted-foreground)]"
                    title={formatDateTime(log.created_at)}
                  >
                    {formatRelative(log.created_at)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ── Roadmap ── */}
      <Card>
        <CardHeader divider>
          <CardTitle className="flex items-center gap-2">
            <Zap size={16} className="text-[var(--color-primary)]" aria-hidden="true" />
            What Connect Will Enable
          </CardTitle>
          <CardDescription>
            Planned capabilities for the Connect integration once activated.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4">
            {[
              {
                icon: Users,
                title: 'Automated User Provisioning',
                desc: 'Sync attendees from your CRM or registration system automatically. New registrants become ticket owners without manual CSV imports.',
              },
              {
                icon: Ticket,
                title: 'Real-time Ticket Allocation',
                desc: 'When a purchase is made in your ticketing platform, a pack is created here instantly via webhook.',
              },
              {
                icon: RefreshCw,
                title: 'Bidirectional Status Sync',
                desc: 'Check-in status, ticket assignments, and attendee data flow back to your source system in real time.',
              },
              {
                icon: Plug,
                title: 'Custom Webhook Events',
                desc: 'Configure outbound webhooks to notify your systems when key events occur: check-ins, assignments, pack creation.',
              },
            ].map(({ icon: Icon, title, desc }) => (
              <li key={title} className="flex gap-4">
                <div className="shrink-0 mt-0.5 w-8 h-8 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center">
                  <Icon size={14} className="text-[var(--color-primary)]" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--color-foreground)]">{title}</p>
                  <p className="text-sm text-[var(--color-muted-foreground)] mt-0.5">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
