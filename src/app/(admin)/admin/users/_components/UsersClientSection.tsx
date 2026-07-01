'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'

interface Props {
  teams: Array<{ id: string; name: string }>
}

export function UsersClientSection({ teams }: Props) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<{
    success: number; errors: Array<{ row: number; message: string }>; created_users: number; created_packs: number
  } | null>(null)

  // Add user form
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState('ticket_owner')
  const [teamId, setTeamId] = useState('')

  async function handleAddUser() {
    if (!email) { setError('Email required'); return }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, full_name: fullName, role, team_id: teamId || null }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to create user')
      setAddOpen(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  async function handleImport() {
    const file = fileRef.current?.files?.[0]
    if (!file) { setError('Please select a CSV file'); return }
    setLoading(true)
    setError(null)
    setImportResult(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/admin/import', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Import failed')
      setImportResult(json.data)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
          <Upload size={14} aria-hidden="true" />
          Import Users
        </Button>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <UserPlus size={14} aria-hidden="true" />
          Add User
        </Button>
      </div>

      {/* Add User Modal */}
      <Modal
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add User"
        description="Create a new user account and send them a magic link to sign in."
        size="max-w-md"
      >
        <div className="space-y-4">
          {error && (
            <p role="alert" className="text-sm text-[var(--color-destructive)]">{error}</p>
          )}
          <Input
            label="Email"
            type="email"
            required
            placeholder="user@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Full Name"
            placeholder="Jane Smith"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--color-foreground)]">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
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
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={loading}>Cancel</Button>
            <Button onClick={handleAddUser} loading={loading}>Create &amp; Send Link</Button>
          </div>
        </div>
      </Modal>

      {/* Import Modal */}
      <Modal
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Import Users via CSV"
        description="Upload a CSV file to bulk-create users and ticket packs."
        size="max-w-lg"
      >
        <div className="space-y-4">
          {error && (
            <p role="alert" className="text-sm text-[var(--color-destructive)]">{error}</p>
          )}

          <div className="rounded-[var(--border-radius)] bg-[var(--color-muted)] px-4 py-3 text-xs text-[var(--color-muted-foreground)] space-y-1">
            <p className="font-medium text-[var(--color-foreground)]">Required CSV columns:</p>
            <p className="font-mono">email, full_name, team_name, event_name, pack_name, ticket_count</p>
            <p>Rows with missing email will be skipped. Pack creation is optional.</p>
          </div>

          <div>
            <label className="text-sm font-medium text-[var(--color-foreground)] mb-1.5 block">
              CSV File
            </label>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="w-full text-sm text-[var(--color-foreground)] file:mr-3 file:py-1.5 file:px-3 file:rounded-[var(--border-radius)] file:border-0 file:text-xs file:bg-[var(--color-primary)] file:text-[var(--color-primary-foreground)] file:cursor-pointer hover:file:brightness-110"
            />
          </div>

          {importResult && (
            <div className="rounded-[var(--border-radius)] border border-[var(--color-success)]/30 bg-[var(--color-success)]/10 px-4 py-3 space-y-1">
              <p className="text-sm font-medium text-[var(--color-success)]">
                Import complete: {importResult.success} rows processed
              </p>
              <p className="text-xs text-[var(--color-foreground)]">
                {importResult.created_users} users created · {importResult.created_packs} packs created
              </p>
              {importResult.errors.length > 0 && (
                <ul className="mt-2 space-y-0.5">
                  {importResult.errors.map((e, i) => (
                    <li key={i} className="text-xs text-[var(--color-destructive)]">
                      Row {e.row}: {e.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setImportOpen(false)} disabled={loading}>Cancel</Button>
            <Button onClick={handleImport} loading={loading}>Import</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
