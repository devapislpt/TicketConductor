'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface Props {
  oldValue: Record<string, unknown> | null
  newValue: Record<string, unknown> | null
}

export function LogRowExpander({ oldValue, newValue }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline"
        aria-expanded={open}
      >
        {open ? <ChevronDown size={12} aria-hidden="true" /> : <ChevronRight size={12} aria-hidden="true" />}
        {open ? 'Hide' : 'View'} changes
      </button>

      {open && (
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          {oldValue && (
            <div>
              <p className="font-medium text-[var(--color-muted-foreground)] mb-1">Before</p>
              <pre className="bg-[var(--color-muted)] rounded p-2 overflow-auto max-h-32 text-[var(--color-foreground)] whitespace-pre-wrap break-all">
                {JSON.stringify(oldValue, null, 2)}
              </pre>
            </div>
          )}
          {newValue && (
            <div>
              <p className="font-medium text-[var(--color-muted-foreground)] mb-1">After</p>
              <pre className="bg-[var(--color-muted)] rounded p-2 overflow-auto max-h-32 text-[var(--color-foreground)] whitespace-pre-wrap break-all">
                {JSON.stringify(newValue, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
