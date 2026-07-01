'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[AdminError]', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center space-y-4">
      <div className="w-12 h-12 rounded-full bg-[var(--color-destructive)]/10 flex items-center justify-center">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-destructive)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h2 className="font-heading text-xl font-semibold text-[var(--color-foreground)]">
        Page error
      </h2>
      <p className="text-sm text-[var(--color-muted-foreground)] max-w-sm">
        {error.message ?? 'An unexpected error occurred loading this page.'}
      </p>
      {error.digest && (
        <p className="text-xs font-mono text-[var(--color-muted-foreground)] opacity-60">
          Ref: {error.digest}
        </p>
      )}
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center justify-center h-9 px-4 rounded-[var(--border-radius)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)] text-sm font-medium transition-all hover:brightness-75"
        >
          Try again
        </button>
        <Link
          href="/admin"
          className="inline-flex items-center justify-center h-9 px-4 rounded-[var(--border-radius)] border border-[var(--color-border)] text-[var(--color-foreground)] text-sm font-medium transition-colors hover:bg-[var(--color-muted)]"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  )
}
