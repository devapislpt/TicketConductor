import { createClient } from '@/lib/supabase/server'
import { Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { UserRoleBadge, Badge } from '@/components/ui/badge'
import { formatDate, formatRelative } from '@/lib/utils/format'
import type { AppUser, UserRole } from '@/lib/types'
import { UsersClientSection } from './_components/UsersClientSection'

function roleFromParam(raw: string | undefined): UserRole | undefined {
  if (raw === 'admin' || raw === 'event_assistant' || raw === 'ticket_owner') return raw
  return undefined
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; team?: string; active?: string }>
}) {
  const { role: roleParam, team: teamParam, active: activeParam } = await searchParams
  const filterRole = roleFromParam(roleParam)

  const supabase = await createClient()

  // Fetch teams for filter
  const { data: teamsData } = await supabase
    .from('teams')
    .select('id, name')
    .order('name')

  const teams = (teamsData ?? []) as Array<{ id: string; name: string }>

  // Build users query
  let usersQuery = supabase
    .from('app_users')
    .select(`
      *,
      team:teams(id, name),
      ticket_packs(id)
    `)
    .order('created_at', { ascending: false })

  if (filterRole) usersQuery = usersQuery.eq('role', filterRole)
  if (teamParam) usersQuery = usersQuery.eq('team_id', teamParam)
  if (activeParam === 'true') usersQuery = usersQuery.eq('is_active', true)
  if (activeParam === 'false') usersQuery = usersQuery.eq('is_active', false)

  const { data: usersData, error } = await usersQuery

  const users = (usersData ?? []).map((u: any) => ({
    ...(u as AppUser),
    team: u.team as { id: string; name: string } | null,
    packCount: (u.ticket_packs ?? []).length,
  }))

  return (
    <div className="space-y-6 p-6 md:p-8 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-[var(--letter-spacing-heading)] text-[var(--color-foreground)]">
            Users
          </h1>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            Manage accounts, roles, and access
          </p>
        </div>
        {/* Client island handles modals */}
        <UsersClientSection teams={teams} />
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-[var(--color-muted-foreground)] uppercase tracking-wide shrink-0">
          Role:
        </span>
        {(['all', 'admin', 'event_assistant', 'ticket_owner'] as const).map((r) => {
          const isActive = r === 'all' ? !filterRole : filterRole === r
          const label = r === 'all' ? 'All' : r === 'event_assistant' ? 'Event Asst' : r.charAt(0).toUpperCase() + r.slice(1)
          return (
            <a
              key={r}
              href={r === 'all' ? '/admin/users' : `/admin/users?role=${r}`}
              className={`inline-flex items-center px-3 h-8 rounded-[var(--border-radius)] text-xs font-medium border transition-colors duration-150 ${
                isActive
                  ? 'bg-[var(--color-primary)] border-[var(--color-primary)]'
                  : 'bg-transparent border-[var(--color-border)] hover:border-[var(--color-primary)]'
              }`}
              style={{ color: isActive ? 'var(--color-primary-foreground)' : 'var(--color-foreground)' }}
            >
              {label}
            </a>
          )
        })}
        <span className="text-xs text-[var(--color-muted-foreground)] uppercase tracking-wide ml-2 shrink-0">
          Status:
        </span>
        {[['all', undefined], ['Active', 'true'], ['Inactive', 'false']].map(([label, val]) => (
          <a
            key={label}
            href={val ? `/admin/users?active=${val}${filterRole ? `&role=${filterRole}` : ''}` : `/admin/users${filterRole ? `?role=${filterRole}` : ''}`}
            className={`inline-flex items-center px-3 h-8 rounded-[var(--border-radius)] text-xs font-medium border transition-colors duration-150 ${
              activeParam === val || (label === 'all' && !activeParam)
                ? 'bg-[var(--color-primary)] border-[var(--color-primary)]'
                : 'bg-transparent border-[var(--color-border)] hover:border-[var(--color-primary)]'
            }`}
            style={{ color: activeParam === val || (label === 'all' && !activeParam) ? 'var(--color-primary-foreground)' : 'var(--color-foreground)' }}
          >
            {label}
          </a>
        ))}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-[var(--border-radius)] border border-[var(--color-destructive)]/40 bg-[var(--color-destructive)]/10 px-4 py-3 text-sm text-[var(--color-destructive)]"
        >
          Failed to load users: {error.message}
        </div>
      )}

      {/* ── Table ── */}
      <Card>
        <CardHeader divider>
          <CardTitle className="flex items-center gap-2">
            <Users size={18} className="text-[var(--color-primary)]" aria-hidden="true" />
            Users
            <span className="ml-auto text-sm font-normal text-[var(--color-muted-foreground)]">
              {users.length} total
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {users.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-[var(--color-muted-foreground)]">
              <Users size={36} strokeWidth={1} aria-hidden="true" />
              <p className="text-sm">No users found.</p>
            </div>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm" role="grid">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
                      {['Name', 'Role', 'Team', 'Status', 'Last Sign In', 'Packs', 'Actions'].map((h) => (
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
                    {users.map((user) => (
                      <tr
                        key={user.id}
                        className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-muted)] transition-colors duration-150"
                      >
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-[var(--color-foreground)]">
                              {user.full_name ?? '—'}
                            </p>
                            <p className="text-xs text-[var(--color-muted-foreground)]">
                              {user.email}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <UserRoleBadge role={user.role} />
                        </td>
                        <td className="px-4 py-3 text-[var(--color-foreground)]">
                          {user.team?.name ?? <span className="text-[var(--color-muted-foreground)]">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={user.is_active ? 'success' : 'destructive'}
                            dot
                            pulse={user.is_active}
                          >
                            {user.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-[var(--color-muted-foreground)]">
                          {user.last_sign_in_at
                            ? formatRelative(user.last_sign_in_at)
                            : 'Never'}
                        </td>
                        <td className="px-4 py-3 text-[var(--color-foreground)]">
                          {user.packCount}
                        </td>
                        <td className="px-4 py-3">
                          {/* Rendered by client island */}
                          <UserActionsCell user={user} teams={teams} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-[var(--color-border)]">
                {users.map((user) => (
                  <div key={user.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-[var(--color-foreground)]">
                          {user.full_name ?? user.email}
                        </p>
                        <p className="text-xs text-[var(--color-muted-foreground)]">{user.email}</p>
                      </div>
                      <UserRoleBadge role={user.role} />
                    </div>
                    <div className="flex gap-3 text-xs text-[var(--color-muted-foreground)]">
                      {user.team?.name && <span>{user.team.name}</span>}
                      <span>{user.packCount} packs</span>
                    </div>
                    <UserActionsCell user={user} teams={teams} />
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Small client component stub — imported from client section
import { UserActionsCell } from './_components/UserActionsCell'
