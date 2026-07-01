import * as React from 'react'
import { cn } from '@/lib/utils/cn'

// ─── Variants ──────────────────────────────────────────────────────────────
export type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'destructive'
  | 'info'
  | 'outline'

const variantClasses: Record<BadgeVariant, string> = {
  default:     'bg-[var(--color-muted)] text-[var(--color-foreground)] border-transparent',
  success:     'bg-[var(--color-success)]/20 text-[var(--color-success)] border-[var(--color-success)]/30',
  warning:     'bg-[var(--color-warning,#D97706)]/20 text-[var(--color-warning,#D97706)] border-[var(--color-warning,#D97706)]/30',
  destructive: 'bg-[var(--color-destructive)]/20 text-[var(--color-destructive)] border-[var(--color-destructive)]/30',
  info:        'bg-[var(--color-primary)]/20 text-[var(--color-primary)] border-[var(--color-primary)]/30',
  outline:     'bg-transparent text-[var(--color-foreground)] border-[var(--color-border)]',
}

const dotColorClasses: Record<BadgeVariant, string> = {
  default:     'bg-[var(--color-muted-foreground)]',
  success:     'bg-[var(--color-success)]',
  warning:     'bg-[var(--color-warning,#D97706)]',
  destructive: 'bg-[var(--color-destructive)]',
  info:        'bg-[var(--color-primary)]',
  outline:     'bg-[var(--color-foreground)]',
}

// ─── Props ─────────────────────────────────────────────────────────────────
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  dot?: boolean
  /** Pulse animation on the dot */
  pulse?: boolean
}

// ─── Component ─────────────────────────────────────────────────────────────
export function Badge({
  className,
  variant = 'default',
  dot = false,
  pulse = false,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        // Layout
        'inline-flex items-center gap-1.5',
        // Shape & size
        'px-2.5 py-0.5 rounded-full',
        // Typography
        'text-xs font-medium font-body tracking-wide',
        // Border
        'border',
        // Variant
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            'relative flex h-1.5 w-1.5 rounded-full flex-shrink-0',
            dotColorClasses[variant]
          )}
          aria-hidden="true"
        >
          {pulse && (
            <span
              className={cn(
                'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
                dotColorClasses[variant]
              )}
            />
          )}
        </span>
      )}
      {children}
    </span>
  )
}

// ─── Convenience exports for ticket/event status ───────────────────────────
export function TicketStatusBadge({
  status,
}: {
  status: 'unassigned' | 'assigned' | 'checked_in'
}) {
  const map: Record<typeof status, { variant: BadgeVariant; label: string }> = {
    unassigned: { variant: 'warning',     label: 'Unassigned' },
    assigned:   { variant: 'info',        label: 'Assigned'   },
    checked_in: { variant: 'success',     label: 'Checked In' },
  }
  const { variant, label } = map[status]
  return <Badge variant={variant} dot>{label}</Badge>
}

export function EventStatusBadge({
  status,
}: {
  status: 'draft' | 'published' | 'archived'
}) {
  const map: Record<typeof status, { variant: BadgeVariant; label: string }> = {
    draft:     { variant: 'warning',     label: 'Draft'     },
    published: { variant: 'success',     label: 'Published' },
    archived:  { variant: 'default',     label: 'Archived'  },
  }
  const { variant, label } = map[status]
  return <Badge variant={variant} dot>{label}</Badge>
}

export function UserRoleBadge({ role }: { role: 'admin' | 'event_assistant' | 'ticket_owner' }) {
  const map: Record<typeof role, { variant: BadgeVariant; label: string }> = {
    admin:           { variant: 'info',        label: 'Admin'           },
    event_assistant: { variant: 'warning',     label: 'Event Assistant' },
    ticket_owner:    { variant: 'default',     label: 'Ticket Owner'    },
  }
  const { variant, label } = map[role]
  return <Badge variant={variant}>{label}</Badge>
}
