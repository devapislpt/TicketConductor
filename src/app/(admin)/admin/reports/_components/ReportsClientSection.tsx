'use client'

import { useRouter } from 'next/navigation'
import type { AppEvent } from '@/lib/types'
import { formatDate } from '@/lib/utils/format'

interface Props {
  events: Pick<AppEvent, 'id' | 'name' | 'status' | 'start_date'>[]
  selectedEventId: string
}

export function ReportsClientSection({ events, selectedEventId }: Props) {
  const router = useRouter()

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-[var(--color-muted-foreground)] uppercase tracking-wide">
        Select Event
      </label>
      <select
        value={selectedEventId}
        onChange={(e) => router.push(`/admin/reports?event_id=${e.target.value}`)}
        className="h-10 px-3 rounded-[var(--border-radius)] bg-[var(--color-card)] text-[var(--color-foreground)] border border-[var(--color-border)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)] min-w-[240px]"
      >
        {events.map((ev) => (
          <option key={ev.id} value={ev.id}>
            {ev.name} — {formatDate(ev.start_date)}
          </option>
        ))}
      </select>
    </div>
  )
}
