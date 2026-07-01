'use client'

import { Toaster, toast as hotToast, type ToastOptions } from 'react-hot-toast'
import { motion } from 'framer-motion'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useSoundStore } from '@/lib/stores/sound.store'

// ─── Types ─────────────────────────────────────────────────────────────────
export type ToastVariant = 'success' | 'error' | 'info'

interface ToastConfig {
  icon: React.ReactNode
  borderColor: string
  iconColor: string
}

const TOAST_CONFIGS: Record<ToastVariant, ToastConfig> = {
  success: {
    icon: <CheckCircle size={18} aria-hidden="true" />,
    borderColor: 'border-l-[var(--color-success)]',
    iconColor: 'text-[var(--color-success)]',
  },
  error: {
    icon: <XCircle size={18} aria-hidden="true" />,
    borderColor: 'border-l-[var(--color-destructive)]',
    iconColor: 'text-[var(--color-destructive)]',
  },
  info: {
    icon: <Info size={18} aria-hidden="true" />,
    borderColor: 'border-l-[var(--color-primary)]',
    iconColor: 'text-[var(--color-primary)]',
  },
}

// ─── Custom Toast Renderer ─────────────────────────────────────────────────
interface LuxuryToastProps {
  message: string
  variant: ToastVariant
  toastId: string
  visible: boolean
}

function LuxuryToast({ message, variant, toastId, visible }: LuxuryToastProps) {
  const config = TOAST_CONFIGS[variant]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={visible
        ? { opacity: 1, y: 0, scale: 1 }
        : { opacity: 0, y: -8, scale: 0.95 }
      }
      transition={{ type: 'spring', stiffness: 350, damping: 28 }}
      role="alert"
      aria-live="polite"
      className={cn(
        // Layout
        'flex items-start gap-3',
        // Width
        'w-[360px] max-w-[calc(100vw-2rem)]',
        // Visual
        'bg-[var(--color-card)]',
        'border border-[var(--color-border)]',
        'border-l-4',
        config.borderColor,
        'rounded-[var(--border-radius)]',
        'shadow-[var(--shadow-lg)]',
        // Spacing
        'px-4 py-3',
      )}
    >
      {/* Icon */}
      <span className={cn('flex-shrink-0 mt-0.5', config.iconColor)}>
        {config.icon}
      </span>

      {/* Message */}
      <p className="flex-1 text-sm font-body text-[var(--color-foreground)] leading-relaxed">
        {message}
      </p>

      {/* Dismiss button */}
      <button
        onClick={() => hotToast.dismiss(toastId)}
        className={cn(
          'flex-shrink-0 mt-0.5',
          'text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]',
          'transition-colors duration-150',
          'focus-visible:outline-none focus-visible:text-[var(--color-primary)]',
          'rounded p-0.5'
        )}
        aria-label="Dismiss notification"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </motion.div>
  )
}

// ─── Toaster Component (put in layout) ────────────────────────────────────
export function LuxuryToaster() {
  return (
    <Toaster
      position="bottom-right"
      gutter={8}
      containerClassName="!bottom-4 !right-4 md:!bottom-6 md:!right-6"
      toastOptions={{
        duration: 4000,
        style: {
          // Override react-hot-toast's default styles
          background: 'transparent',
          border: 'none',
          boxShadow: 'none',
          padding: 0,
          maxWidth: '100%',
        },
      }}
    />
  )
}

// ─── Toast API ─────────────────────────────────────────────────────────────
interface ShowToastOptions extends ToastOptions {
  silent?: boolean
}

/**
 * Internal helper that renders a LuxuryToast via react-hot-toast's custom() API.
 * Plays the appropriate sound unless `silent: true`.
 */
function showToast(
  message: string,
  variant: ToastVariant,
  options?: ShowToastOptions
): string {
  const id = hotToast.custom(
    (t) => (
      <LuxuryToast
        message={message}
        variant={variant}
        toastId={t.id}
        visible={t.visible}
      />
    ),
    {
      duration: 4000,
      ...options,
    }
  )

  return id
}

// ─── Sound-aware toast helpers ─────────────────────────────────────────────
/**
 * These are plain functions (not hooks) so they can be called anywhere.
 * They access the Zustand store directly via getState().
 */
export const toast = {
  success: (message: string, options?: ShowToastOptions): string => {
    if (!options?.silent) {
      useSoundStore.getState().play('success')
    }
    return showToast(message, 'success', options)
  },

  error: (message: string, options?: ShowToastOptions): string => {
    if (!options?.silent) {
      useSoundStore.getState().play('error')
    }
    return showToast(message, 'error', options)
  },

  info: (message: string, options?: ShowToastOptions): string => {
    return showToast(message, 'info', options)
  },

  checkin: (message: string, options?: ShowToastOptions): string => {
    if (!options?.silent) {
      useSoundStore.getState().play('checkin')
    }
    return showToast(message, 'success', options)
  },

  dismiss: (id?: string) => hotToast.dismiss(id),
}
