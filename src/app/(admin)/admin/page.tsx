import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  CalendarDays,
  Ticket,
  Users,
  LayoutGrid,
  CheckCircle2,
  CircleDashed,
  UserCheck,
  PackageOpen,
  Plus,
  Upload,
  Download,
  ClipboardList,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDateTime, formatRelative } from '@/lib/utils/format'
import type { AdminDashboardStats, AuditLog } from '@/lib/types'

// ─── Stat Card ──────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  icon: Icon,
  highlight = false,
  sub,
}: {
  label: string
  value: number | string
  icon: React.ElementType
  highlight?: boolean
  sub?: string
}) {
  return (
    <Card
      variant={highlight ? 'bordered' : 'default'}
      className="flex flex-col gap-3 p-5"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-widest text-[var(--color-muted-foreground)]">
          {label}
        </p>
        <span
          className={
            highlight
              ? 'text-[var(--color-primary)]'
              : 'text-[var(--color-muted-foreground)]'
          }
        >
          <Icon size={18} aria-hidden="true" />
        </span>
      </div>
      <p className="font-heading text-3xl font-bold text-[var(--color-foreground)]">
        {value}
      </p>
      {sub && (
        <p className="text-xs text-[var(--color-muted-foreground)]">{sub}</p>
      )}
    </Card>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default async function AdminDashboardPage() {
  const supabase = await createClient()

  // ── Fetch stats ────────────────────────────────────────────────────────
  const [
    { count: total_events },
    { count: active_events },
    { count: total_ticket_packs },
    { count: total_tickets },
    { count: assigned_tickets },
    { count: unassigned_tickets },
    { count: checked_in_tickets },
    { count: total_users },
  ] = await Promise.all([
    supabase.from('events').select('*', { count: 'exact', head: true }),
    supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published'),
    supabase.from('ticket_packs').select('*', { count: 'exact', head: true }),
    supabase.from('tickets').select('*', { count: 'exact', head: true }),
    supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'assigned'),
    supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'unassigned'),
    supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'checked_in'),
    supabase.from('app_users').select('*', { count: 'exact', head: true }),
  ])

  const stats: AdminDashboardStats = {
    total_events: total_events ?? 0,
    active_events: active_events ?? 0,
    total_ticket_packs: total_ticket_packs ?? 0,
    total_tickets: total_tickets ?? 0,
    assigned_tickets: assigned_tickets ?? 0,
    unassigned_tickets: unassigned_tickets ?? 0,
    checked_in_tickets: checked_in_tickets ?? 0,
    total_users: total_users ?? 0,
  }

  const assignedPct =
    stats.total_tickets > 0
      ? Math.round((stats.assigned_tickets / stats.total_tickets) * 100)
      : 0

  // ── Fetch recent audit logs ────────────────────────────────────────────
  const { data: auditLogs } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)

  const logs = (auditLogs ?? []) as AuditLog[]

  // ── Action badge label helper ──────────────────────────────────────────
  function actionVariant(action: string) {
    if (action.startsWith('user')) return 'info' as const
    if (action.startsWith('event')) return 'warning' as const
    if (action.startsWith('ticket')) return 'success' as const
    if (action.startsWith('pack')) return 'default' as const
    return 'outline' as const
  }

  return (
    <div className="space-y-8 p-6 md:p-8 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-[var(--letter-spacing-heading)] text-[var(--color-foreground)]">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            Welcome back. Here&apos;s what&apos;s happening.
          </p>
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="default">
            <Link href="/admin/events/new">
              <Plus size={14} aria-hidden="true" />
              Create Event
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/users">
              <Upload size={14} aria-hidden="true" />
              Import Users
            </Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href="/api/admin/export?format=csv">
              <Download size={14} aria-hidden="true" />
              Export CSV
            </Link>
          </Button>
        </div>
      </div>

      {/* ── Stat Grid ── */}
      <section aria-label="Dashboard statistics">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Total Events"
            value={stats.total_events}
            icon={CalendarDays}
          />
          <StatCard
            label="Active Events"
            value={stats.active_events}
            icon={LayoutGrid}
            highlight
          />
          <StatCard
            label="Ticket Packs"
            value={stats.total_ticket_packs}
            icon={PackageOpen}
          />
          <StatCard
            label="Total Tickets"
            value={stats.total_tickets}
            icon={Ticket}
          />
          <StatCard
            label="Assigned"
            value={`${assignedPct}%`}
            icon={UserCheck}
            highlight
            sub={`${stats.assigned_tickets} of ${stats.total_tickets}`}
          />
          <StatCard
            label="Unassigned"
            value={stats.unassigned_tickets}
            icon={CircleDashed}
          />
          <StatCard
            label="Checked In"
            value={stats.checked_in_tickets}
            icon={CheckCircle2}
          />
          <StatCard
            label="Total Users"
            value={stats.total_users}
            icon={Users}
          />
        </div>
      </section>

      {/* ── Recent Audit Log ── */}
      <section aria-label="Recent activity">
        <Card>
          <CardHeader divider>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <ClipboardList size={18} className="text-[var(--color-primary)]" aria-hidden="true" />
                Recent Activity
              </CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin/logs">View all</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {logs.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-[var(--color-muted-foreground)]">
                No audit entries yet.
              </p>
            ) : (
              <ul role="list" className="divide-y divide-[var(--color-border)]">
                {logs.map((log) => (
                  <li
                    key={log.id}
                    className="flex items-start gap-3 px-5 py-3 hover:bg-[var(--color-muted)] transition-colors duration-150"
                  >
                    <Badge variant={actionVariant(log.action)} className="mt-0.5 shrink-0">
                      {log.action}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--color-foreground)] truncate">
                        <span className="font-medium">
                          {log.actor_email ?? 'System'}
                        </span>{' '}
                        &rarr; {log.entity_type}
                        {log.entity_id ? (
                          <span className="text-[var(--color-muted-foreground)] ml-1 text-xs font-mono">
                            #{log.entity_id.slice(0, 8)}
                          </span>
                        ) : null}
                      </p>
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
      </section>
    </div>
  )
}
