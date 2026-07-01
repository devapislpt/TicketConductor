'use client'

import { useState, useEffect, useCallback, useId } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion, AnimatePresence } from 'framer-motion'
import { magicLinkSchema, type MagicLinkFormData } from '@/lib/validators/auth'

// Animated envelope SVG
function EnvelopeIcon({ className }: { className?: string }) {
  return (
    <motion.svg
      width="64"
      height="64"
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.6, type: 'spring', bounce: 0.4 }}
    >
      {/* Envelope body */}
      <rect
        x="4"
        y="14"
        width="56"
        height="38"
        rx="4"
        stroke="var(--color-primary)"
        strokeWidth="2"
        fill="rgba(201,168,76,0.08)"
      />
      {/* Envelope flap lines */}
      <motion.path
        d="M4 18L32 36L60 18"
        stroke="var(--color-primary)"
        strokeWidth="2"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.7, delay: 0.3, ease: 'easeOut' }}
      />
      {/* Sparkle dots */}
      <motion.circle
        cx="50"
        cy="10"
        r="2"
        fill="var(--color-primary)"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: [0, 1, 0], scale: [0, 1.2, 0] }}
        transition={{ duration: 1.5, delay: 0.6, repeat: Infinity, repeatDelay: 2 }}
      />
      <motion.circle
        cx="14"
        cy="10"
        r="1.5"
        fill="var(--color-primary)"
        fillOpacity="0.6"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: [0, 1, 0], scale: [0, 1.2, 0] }}
        transition={{ duration: 1.5, delay: 0.9, repeat: Infinity, repeatDelay: 2 }}
      />
      <motion.circle
        cx="56"
        cy="24"
        r="1.5"
        fill="var(--color-primary)"
        fillOpacity="0.4"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: [0, 1, 0], scale: [0, 1.2, 0] }}
        transition={{ duration: 1.5, delay: 1.2, repeat: Infinity, repeatDelay: 2 }}
      />
    </motion.svg>
  )
}

const RESEND_COOLDOWN = 60

export default function MagicLinkPage() {
  const formId = useId()
  const emailErrorId = `${formId}-email-error`

  const [countdown, setCountdown] = useState(RESEND_COOLDOWN)
  const [canResend, setCanResend] = useState(false)
  const [resendStatus, setResendStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [resendError, setResendError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<MagicLinkFormData>({
    resolver: zodResolver(magicLinkSchema),
  })

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) {
      setCanResend(true)
      return
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  const handleResend = useCallback(
    async (data: MagicLinkFormData) => {
      if (!canResend || isSubmitting) return
      setResendStatus('loading')
      setResendError(null)
      try {
        const res = await fetch('/api/auth/magic-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: data.email }),
        })
        const json = await res.json()
        if (!res.ok) {
          setResendStatus('error')
          setResendError(json.error ?? 'Failed to resend. Please try again.')
          return
        }
        setResendStatus('success')
        setCanResend(false)
        setCountdown(RESEND_COOLDOWN)
        // Reset back to idle after a moment
        setTimeout(() => setResendStatus('idle'), 3000)
      } catch {
        setResendStatus('error')
        setResendError('Network error. Please try again.')
      }
    },
    [canResend, isSubmitting]
  )

  return (
    <motion.div
      className="w-full max-w-md"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
    >
      <div
        className="rounded-2xl p-8 flex flex-col items-center text-center"
        style={{
          backgroundColor: 'rgba(20,20,20,0.8)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(201,168,76,0.2)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5), inset 0 1px 0 rgba(201,168,76,0.1)',
        }}
      >
        {/* Icon */}
        <div
          className="mb-6 flex items-center justify-center w-24 h-24 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(201,168,76,0.12) 0%, rgba(201,168,76,0.04) 70%)',
            border: '1px solid rgba(201,168,76,0.2)',
          }}
        >
          <EnvelopeIcon />
        </div>

        {/* Heading */}
        <h2
          className="text-2xl font-light tracking-wide mb-2"
          style={{ color: 'rgba(255,255,255,0.92)' }}
        >
          Check your email
        </h2>
        <p className="text-sm mb-8 leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
          We&apos;ve sent a secure magic link to your email address. Click it to sign in instantly — no password needed.
        </p>

        {/* Divider */}
        <div className="w-full flex items-center gap-3 mb-6" aria-hidden="true">
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
            Didn&apos;t receive it?
          </span>
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
        </div>

        {/* Resend form */}
        <form
          onSubmit={handleSubmit(handleResend)}
          noValidate
          className="w-full flex flex-col gap-4"
          aria-label="Resend magic link"
        >
          <div className="flex flex-col gap-1.5 text-left">
            <label
              htmlFor={`${formId}-email`}
              className="text-sm font-medium tracking-wide"
              style={{ color: 'rgba(255,255,255,0.6)' }}
            >
              Email address
            </label>
            <input
              id={`${formId}-email`}
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              disabled={resendStatus === 'loading'}
              aria-describedby={errors.email ? emailErrorId : undefined}
              aria-invalid={!!errors.email}
              className="w-full rounded-md px-4 py-3 text-sm transition-all duration-200 disabled:opacity-50"
              style={{
                backgroundColor: 'rgba(255,255,255,0.04)',
                border: errors.email
                  ? '1px solid rgba(229,62,62,0.7)'
                  : '1px solid rgba(255,255,255,0.1)',
                color: '#fff',
                outline: 'none',
              }}
              onFocus={(e) => {
                e.currentTarget.style.border = '1px solid var(--color-primary)'
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(201,168,76,0.15)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.border = errors.email
                  ? '1px solid rgba(229,62,62,0.7)'
                  : '1px solid rgba(255,255,255,0.1)'
                e.currentTarget.style.boxShadow = 'none'
              }}
              {...register('email')}
            />
            <AnimatePresence mode="wait">
              {errors.email && (
                <motion.p
                  id={emailErrorId}
                  role="alert"
                  aria-live="polite"
                  className="text-xs"
                  style={{ color: `var(--color-destructive)` }}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                >
                  {errors.email.message}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Resend error */}
          <AnimatePresence mode="wait">
            {resendStatus === 'error' && resendError && (
              <motion.div
                role="alert"
                aria-live="assertive"
                className="rounded-md px-4 py-3 text-sm text-left"
                style={{
                  backgroundColor: 'rgba(229,62,62,0.1)',
                  border: '1px solid rgba(229,62,62,0.3)',
                  color: `var(--color-destructive)`,
                }}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
              >
                {resendError}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Resend success */}
          <AnimatePresence mode="wait">
            {resendStatus === 'success' && (
              <motion.div
                role="status"
                aria-live="polite"
                className="rounded-md px-4 py-3 text-sm text-left"
                style={{
                  backgroundColor: 'rgba(56,161,105,0.1)',
                  border: '1px solid rgba(56,161,105,0.3)',
                  color: `var(--color-success)`,
                }}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
              >
                Magic link resent! Check your inbox.
              </motion.div>
            )}
          </AnimatePresence>

          {/* Resend button */}
          <button
            type="submit"
            disabled={!canResend || resendStatus === 'loading'}
            aria-busy={resendStatus === 'loading'}
            aria-label={
              canResend
                ? 'Resend magic link'
                : `Resend available in ${countdown} seconds`
            }
            className="w-full rounded-md py-3 text-sm font-semibold tracking-widest uppercase transition-all duration-200 disabled:cursor-not-allowed"
            style={{
              backgroundColor: canResend ? `var(--color-primary)` : 'rgba(201,168,76,0.15)',
              color: canResend ? `var(--color-background)` : 'rgba(201,168,76,0.5)',
              border: canResend ? 'none' : '1px solid rgba(201,168,76,0.2)',
              letterSpacing: '0.15em',
            }}
            onMouseEnter={(e) => {
              if (canResend) e.currentTarget.style.filter = 'brightness(1.1)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.filter = 'brightness(1)'
            }}
          >
            {resendStatus === 'loading' ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Sending…
              </span>
            ) : canResend ? (
              'Resend Magic Link'
            ) : (
              <span>
                Resend in{' '}
                <span aria-live="off">
                  {String(Math.floor(countdown / 60)).padStart(2, '0')}:
                  {String(countdown % 60).padStart(2, '0')}
                </span>
              </span>
            )}
          </button>
        </form>

        {/* Back to login */}
        <a
          href="/login"
          className="mt-6 text-xs transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded"
          style={{ color: 'rgba(255,255,255,0.3)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
        >
          &larr; Back to sign in
        </a>
      </div>
    </motion.div>
  )
}
