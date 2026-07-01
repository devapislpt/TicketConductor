'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Mail, Lock, Eye, PowerOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import type { AppUser, UserRole } from '@/lib/types'

interface Props {
  user: AppUser & { team?: { id: string; name: string } | null; packCount?: number }
  teams: Array<{ id: string; name: string }>
}

export function UserActionsCell({ user, teams }: Props) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Edit form state
  const [role, setRole] = useState<UserRole>(user.role)
  const [teamId, setTeamId] = useState(user.team_id ?? '')
  const [fullName, setFullName] = useState(user.full_name ?? '')

  async function handleUpdate() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, role, team_id: teamId || null, full_name: fullName }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Update failed')
      setEditOpen(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  async function sendMagicLink() {
    setLoading(true)
    try {
      await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, action: 'magic_link' }),
      })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  async function sendPasswordReset() {
    setLoading(true)
    try {
      await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, action: 'password_reset' }),
      })
    } finally {
      setLoading(false)
    }
  }

  async function toggleActive() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, is_active: !user.is_active }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  async function impersonate() {
    // Sets a cookie via API then redirects to user dashboard
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: user.id, action: 'impersonate' }),
    })
    if (res.ok) {
      window.location.href = '/dashboard'
    }
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setEditOpen(true)}
          aria-label="Edit user"
        >
          <Pencil size={14} aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={sendMagicLink}
          disabled={loading}
          aria-label="Send magic link"
          title="Send magic link"
        >
          <Mail size={14} aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={sendPasswordReset}
          disabled={loading}
          aria-label="Send password reset"
          title="Send password reset"
        >
          <Lock size={14} aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={impersonate}
          aria-label="Impersonate user"
          title="View as user"
        >
          <Eye size={14} aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleActive}
          disabled={loading}
          aria-label={user.is_active ? 'Deactivate user' : 'Activate user'}
          title={user.is_active ? 'Deactivate' : 'Activate'}
          className={user.is_active ? 'text-[var(--color-destructive)] hover:text-[var(--color-destructive)]' : 'text-[var(--color-success)] hover:text-[var(--color-success)]'}
        >
          <PowerOff size={14} aria-hidden="true" />
        </Button>
      </div>

      {/* Edit modal */}
      <Modal
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Edit User"
        description={user.email}
        size="max-w-md"
      >
        <div className="space-y-4">
          {error && (
            <p role="alert" className="text-sm text-[var(--color-destructive)]">{error}</p>
          )}

          <Input
            label="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--color-foreground)]">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full h-10 px-3 rounded-[var(--border-radius)] bg-[var(--color-card)] text-[var(--color-foreground)] border border-[var(--color-border)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            >
              <option value="ticket_owner">Ticket Owner</option>
              <option value="event_assistant">Event Assistant</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--color-foreground)]">Team</label>
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="w-full h-10 px-3 rounded-[var(--border-radius)] bg-[var(--color-card)] text-[var(--color-foreground)] border border-[var(--color-border)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            >
              <option value="">— No Team —</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} loading={loading}>
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
