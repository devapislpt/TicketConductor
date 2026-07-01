'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

// ─── Props ─────────────────────────────────────────────────────────────────
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  required?: boolean
  wrapperClassName?: string
}

// ─── Component ─────────────────────────────────────────────────────────────
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      wrapperClassName,
      label,
      error,
      hint,
      required,
      type = 'text',
      id,
      disabled,
      ...props
    },
    ref
  ) => {
    const inputId = id ?? React.useId()
    const errorId = `${inputId}-error`
    const hintId  = `${inputId}-hint`

    const [showPassword, setShowPassword] = React.useState(false)
    const [isFocused, setIsFocused] = React.useState(false)

    const isPassword = type === 'password'
    const resolvedType = isPassword ? (showPassword ? 'text' : 'password') : type

    const hasError = Boolean(error)

    // Build aria-describedby list
    const describedBy = [
      error ? errorId : null,
      hint  ? hintId  : null,
    ].filter(Boolean).join(' ') || undefined

    return (
      <div className={cn('flex flex-col gap-1.5 w-full', wrapperClassName)}>
        {/* Label */}
        {label && (
          <label
            htmlFor={inputId}
            className={cn(
              'text-sm font-medium font-body tracking-wide',
              hasError
                ? 'text-[var(--color-destructive)]'
                : 'text-[var(--color-foreground)]'
            )}
          >
            {label}
            {required && (
              <span
                className="ml-1 text-[var(--color-primary)]"
                aria-label="required"
              >
                *
              </span>
            )}
          </label>
        )}

        {/* Input wrapper with animated border */}
        <div className="relative">
          <motion.div
            className={cn(
              'absolute inset-0 rounded-[var(--border-radius)] pointer-events-none',
              'ring-2 ring-inset',
              isFocused && !hasError
                ? 'ring-[var(--color-primary)]'
                : hasError
                ? 'ring-[var(--color-destructive)]'
                : 'ring-[var(--color-border)]'
            )}
            animate={{
              boxShadow: isFocused && !hasError
                ? '0 0 0 3px rgba(201, 168, 76, 0.15)'
                : hasError
                ? '0 0 0 3px rgba(220, 38, 38, 0.15)'
                : 'none',
            }}
            transition={{ duration: 0.15 }}
          />

          <input
            ref={ref}
            id={inputId}
            type={resolvedType}
            disabled={disabled}
            aria-invalid={hasError}
            aria-describedby={describedBy}
            aria-required={required}
            onFocus={(e) => {
              setIsFocused(true)
              props.onFocus?.(e)
            }}
            onBlur={(e) => {
              setIsFocused(false)
              props.onBlur?.(e)
            }}
            className={cn(
              // Layout
              'w-full h-10 px-3 py-2',
              // Background & text
              'bg-[var(--color-card)] text-[var(--color-foreground)]',
              'font-body text-sm',
              // Shape
              'rounded-[var(--border-radius)]',
              // Border (visual only — real focus handled by motion wrapper)
              'border border-transparent',
              // Placeholder
              'placeholder:text-[var(--color-muted-foreground)]',
              // Disabled
              'disabled:opacity-50 disabled:cursor-not-allowed',
              // Remove default outline (we handle it above)
              'outline-none focus:outline-none',
              // Transition
              'transition-colors duration-[var(--animation-duration)]',
              // Password padding
              isPassword && 'pr-10',
              className
            )}
            {...props}
          />

          {/* Password toggle */}
          {isPassword && (
            <button
              type="button"
              tabIndex={-1}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword((v) => !v)}
              className={cn(
                'absolute right-3 top-1/2 -translate-y-1/2',
                'text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]',
                'transition-colors duration-150',
                'focus-visible:outline-none focus-visible:text-[var(--color-primary)]'
              )}
            >
              {showPassword ? (
                <EyeOff size={16} aria-hidden="true" />
              ) : (
                <Eye size={16} aria-hidden="true" />
              )}
            </button>
          )}

          {/* Error icon (non-password) */}
          {hasError && !isPassword && (
            <div
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-destructive)]"
              aria-hidden="true"
            >
              <AlertCircle size={16} />
            </div>
          )}
        </div>

        {/* Error message */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.p
              id={errorId}
              role="alert"
              aria-live="polite"
              className="text-xs text-[var(--color-destructive)] flex items-center gap-1"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
            >
              <AlertCircle size={12} aria-hidden="true" />
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Hint */}
        {hint && !error && (
          <p
            id={hintId}
            className="text-xs text-[var(--color-muted-foreground)]"
          >
            {hint}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
