'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Props {
  currentFilters: {
    action?: string
    actor?: string
    from?: string
    to?: string
  }
  distinctActions: string[]
}

export function LogsClientSection({ currentFilters, distinctActions }: Props) {
  const router = useRouter()
  const [filterOpen, setFilterOpen] = useState(false)
  const [action, setAction] = useState(currentFilters.action ?? '')
  const [actor, setActor] = useState(currentFilters.actor ?? '')
  const [from, setFrom] = useState(currentFilters.from ?? '')
  const [to, setTo] = useState(currentFilters.to ?? '')

  function applyFilters() {
    const params = new URLSearchParams()
    if (action) params.set('action', action)
    if (actor) params.set('actor', actor)
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    router.push(`/admin/logs?${params.toString()}`)
  }

  function clearFilters() {
    setAction('')
    setActor('')
    setFrom('')
    setTo('')
    router.push('/admin/logs')
  }

  const hasFilters = !!(currentFilters.action || currentFilters.actor || currentFilters.from || currentFilters.to)

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button
          variant={hasFilters ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterOpen((v) => !v)}
        >
          <Filter size={14} aria-hidden="true" />
          Filters{hasFilters ? ' (active)' : ''}
        </Button>
        <Button asChild variant="ghost" size="sm">
          <a href="/api/admin/export?format=csv&type=audit" download>
            <Download size={14} aria-hidden="true" />
            Export CSV
          </a>
        </Button>
      </div>

      {filterOpen && (
        <div className="rounded-[var(--border-radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--color-muted-foreground)] uppercase tracking-wide">
                Action Type
              </label>
              <select
                value={action}
                onChange={(e) => setAction(e.target.value)}
                className="w-full h-9 px-3 rounded-[var(--border-radius)] bg-[var(--color-card)] text-[var(--color-foreground)] border border-[var(--color-border)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              >
                <option value="">All actions</option>
                {distinctActions.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <Input
              label="Actor Email"
              placeholder="Search by email…"
              value={actor}
              onChange={(e) => setActor(e.target.value)}
              wrapperClassName="space-y-1"
            />
            <Input
              label="From Date"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              wrapperClassName="space-y-1"
            />
            <Input
              label="To Date"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              wrapperClassName="space-y-1"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear
            </Button>
            <Button size="sm" onClick={applyFilters}>
              Apply Filters
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
