'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import type { AppEvent } from '@/lib/types'

interface Props {
  events: Pick<AppEvent, 'id' | 'name' | 'status'>[]
  eventIdFilter?: string
}

export function TicketPacksClientSection({ events, eventIdFilter }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [eventId, setEventId] = useState(eventIdFilter ?? events[0]?.id ?? '')
  const [userId, setUserId] = useState('')
  const [packName, setPackName] = useState('')
  const [ticketCount, setTicketCount] = useState('4')
  const [userSearch, setUserSearch] = useState('')
  const [users, setUsers] = useState<Array<{ id: string; full_name: string | null; email: string }>>([])
  const [searchLoading, setSearchLoading] = useState(false)

  async function searchUsers(q: string) {
    if (!q || q.length < 2) { setUsers([]); return }
    setSearchLoading(true)
    try {
      const res = await fetch(`/api/admin/users?search=${encodeURIComponent(q)}`)
      const json = await res.json()
      setUsers(json.data ?? [])
    } finally {
      setSearchLoading(false)
    }
  }

  async function handleCreate() {
    if (!eventId || !userId || !packName || !ticketCount) {
      setError('All fields are required')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ticket-packs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          owner_id: userId,
          pack_name: packName,
          total_tickets: parseInt(ticketCount, 10),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to create pack')
      setOpen(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error creating pack')
    } finally {
      setLoading(false)
    }
  }

  const selectedUser = users.find((u) => u.id === userId)

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus size={14} aria-hidden="true" />
        Create Pack
      </Button>

      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Create Ticket Pack"
        description="Create a new ticket pack and assign it to a user."
        size="max-w-md"
      >
        <div className="space-y-4">
          {error && (
            <p role="alert" className="text-sm text-[var(--color-destructive)]">{error}</p>
          )}

          {/* Event select */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--color-foreground)]">
              Event <span className="text-[var(--color-primary)]">*</span>
            </label>
            <select
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              className="w-full h-10 px-3 rounded-[var(--border-radius)] bg-[var(--color-card)] text-[var(--color-foreground)] border border-[var(--color-border)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            >
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>{ev.name}</option>
              ))}
            </select>
          </div>

          {/* User search */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--color-foreground)]">
              Owner <span className="text-[var(--color-primary)]">*</span>
            </label>
            <Input
              placeholder="Search by name or email…"
              value={userSearch}
              onChange={(e) => {
                setUserSearch(e.target.value)
                searchUsers(e.target.value)
              }}
            />
            {searchLoading && (
              <p className="text-xs text-[var(--color-muted-foreground)]">Searching…</p>
            )}
            {users.length > 0 && !selectedUser && (
              <ul className="border border-[var(--color-border)] rounded-[var(--border-radius)] bg-[var(--color-card)] divide-y divide-[var(--color-border)] max-h-40 overflow-y-auto">
                {users.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-muted)] transition-colors"
                      onClick={() => {
                        setUserId(u.id)
                        setUserSearch(u.full_name ?? u.email)
                        setUsers([])
                      }}
                    >
                      <span className="font-medium">{u.full_name ?? '—'}</span>{' '}
                      <span className="text-[var(--color-muted-foreground)]">{u.email}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {selectedUser && (
              <p className="text-xs text-[var(--color-success)]">
                Selected: {selectedUser.full_name} ({selectedUser.email})
              </p>
            )}
          </div>

          <Input
            label="Pack Name"
            required
            placeholder="Table 1, VIP Section…"
            value={packName}
            onChange={(e) => setPackName(e.target.value)}
          />

          <Input
            label="Number of Tickets"
            required
            type="number"
            min="1"
            max="200"
            value={ticketCount}
            onChange={(e) => setTicketCount(e.target.value)}
            hint="The system will auto-generate individual ticket records."
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleCreate} loading={loading}>
              Create Pack
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
