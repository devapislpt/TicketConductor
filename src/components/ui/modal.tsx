'use client'

import * as React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

// ─── Animation Variants ────────────────────────────────────────────────────
const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
}

const contentVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 8 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 350, damping: 28 },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: 6,
    transition: { duration: 0.15, ease: 'easeIn' },
  },
}

// ─── Props ─────────────────────────────────────────────────────────────────
export interface ModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  /** Max width class e.g. 'max-w-lg', 'max-w-2xl' */
  size?: string
  hideClose?: boolean
  children: React.ReactNode
  className?: string
}

// ─── Modal ─────────────────────────────────────────────────────────────────
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  size = 'max-w-lg',
  hideClose = false,
  children,
  className,
}: ModalProps) {
  const titleId = React.useId()
  const descId  = React.useId()

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            {/* Overlay */}
            <Dialog.Overlay asChild>
              <motion.div
                className={cn(
                  'fixed inset-0 z-50',
                  'bg-[var(--color-overlay,rgba(0,0,0,0.75))]',
                  'backdrop-blur-sm'
                )}
                variants={overlayVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={{ duration: 0.2 }}
              />
            </Dialog.Overlay>

            {/* Content */}
            <Dialog.Content
              asChild
              aria-labelledby={title ? titleId : undefined}
              aria-describedby={description ? descId : undefined}
            >
              <motion.div
                className={cn(
                  // Positioning
                  'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
                  // Layout
                  'w-[calc(100vw-2rem)] md:w-full',
                  size,
                  // Visual
                  'bg-[var(--color-card)] text-[var(--color-card-foreground)]',
                  'rounded-[var(--border-radius)]',
                  'border border-[var(--color-border)]',
                  'shadow-[var(--shadow-lg)]',
                  // Overflow
                  'max-h-[90dvh] overflow-y-auto',
                  // Focus
                  'focus:outline-none',
                  className
                )}
                variants={contentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                {/* Close button */}
                {!hideClose && (
                  <Dialog.Close asChild>
                    <button
                      className={cn(
                        'absolute right-4 top-4 z-10',
                        'rounded-[var(--border-radius)] p-1',
                        'text-[var(--color-muted-foreground)]',
                        'hover:text-[var(--color-foreground)] hover:bg-[var(--color-muted)]',
                        'transition-colors duration-150',
                        'focus-visible:outline-none focus-visible:ring-2',
                        'focus-visible:ring-[var(--color-primary)]',
                        'focus-visible:ring-offset-[var(--color-card)]',
                      )}
                      aria-label="Close dialog"
                    >
                      <X size={18} aria-hidden="true" />
                    </button>
                  </Dialog.Close>
                )}

                {/* Header */}
                {(title || description) && (
                  <div className="px-6 pt-6 pb-4 border-b border-[var(--color-border)]">
                    {title && (
                      <Dialog.Title
                        id={titleId}
                        className="font-heading text-xl font-semibold tracking-[var(--letter-spacing-heading)] text-[var(--color-foreground)] pr-8"
                      >
                        {title}
                      </Dialog.Title>
                    )}
                    {description && (
                      <Dialog.Description
                        id={descId}
                        className="mt-1 text-sm text-[var(--color-muted-foreground)]"
                      >
                        {description}
                      </Dialog.Description>
                    )}
                  </div>
                )}

                {/* Body */}
                <div className={cn('p-6', (title || description) && 'pt-5')}>
                  {children}
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}

// ─── Re-export Radix primitives for composition ────────────────────────────
export const ModalTrigger = Dialog.Trigger
export const ModalClose  = Dialog.Close
