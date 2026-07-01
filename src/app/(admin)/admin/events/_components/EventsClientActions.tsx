'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Pencil, Eye, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'

interface EventsClientActionsProps {
  eventId: string
  eventName: string
}

export function EventsClientActions({ eventId, eventName }: EventsClientActionsProps) {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/events/${eventId}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Delete failed')
      setConfirmOpen(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <Button asChild variant="ghost" size="icon" aria-label={`Edit ${eventName}`}>
          <Link href={`/admin/events/${eventId}`}>
            <Pencil size={14} aria-hidden="true" />
          </Link>
        </Button>
        <Button asChild variant="ghost" size="icon" aria-label={`View ${eventName}`}>
          <Link href={`/events/${eventId}`} target="_blank" rel="noopener noreferrer">
            <Eye size={14} aria-hidden="true" />
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Delete ${eventName}`}
          onClick={() => setConfirmOpen(true)}
          className="text-[var(--color-destructive)] hover:text-[var(--color-destructive)]"
        >
          <Trash2 size={14} aria-hidden="true" />
        </Button>
      </div>

      <Modal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Archive Event"
        description={`Are you sure you want to archive "${eventName}"? This will hide it from users but can be restored later.`}
        size="max-w-md"
      >
        {error && (
          <p role="alert" className="mb-4 text-sm text-[var(--color-destructive)]">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} loading={deleting}>
            Archive Event
          </Button>
        </div>
      </Modal>
    </>
  )
}
