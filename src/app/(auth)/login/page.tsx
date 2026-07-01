'use client'

import { useState, useId } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion, AnimatePresence } from 'framer-motion'
import * as Tabs from '@radix-ui/react-tabs'
import Link from 'next/link'
import { loginSchema, magicLinkSchema, type LoginFormData, type MagicLinkFormData } from '@/lib/validators/auth'

type TabValue = 'magic-link' | 'password'

// ─── Shared Input component ───────────────────────────────────────────────────
function LuxuryInput({
  id,
  type = 'text',
  label,
  placeholder,
  errorId,
  errorMessage,
  autoComplete,
  disabled,
  ...rest
}: {
  id: string
  type?: string
  label: string
  placeholder?: string
  errorId?: string
  errorMessage?: string
  autoComplete?: string
  disabled?: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-sm font-medium tracking-wide"
        style={{ color: 'rgba(255,255,255,0.75)' }}
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        aria-describedby={errorMessage ? errorId : undefined}
        aria-invalid={!!errorMessage}
        className="w-full rounded-md px-4 py-3 text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          backgroundColor: 'rgba(255,255,255,0.04)',
          border: errorMessage
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
          e.currentTarget.style.border = errorMessage
            ? '1px solid rgba(229,62,62,0.7)'
            : '1px solid rgba(255,255,255,0.1)'
          e.currentTarget.style.boxShadow = 'none'
        }}
        {...rest}
      />
      <AnimatePresence mode="wait">
        {errorMessage && (
          <motion.p
            id={errorId}
            role="alert"
            aria-live="polite"
            className="text-xs mt-0.5"
            style={{ color: `var(--color-destructive)` }}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
          >
            {errorMessage}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Gold Button ──────────────────────────────────────────────────────────────
function GoldButton({
  children,
  loading,
  disabled,
  type = 'submit',
}: {
  children: React.ReactNode
  loading?: boolean
  disabled?: boolean
  type?: 'submit' | 'button' | 'reset'
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading}
      className="relative w-full rounded-md py-3.5 text-sm font-semibold tracking-widest uppercase transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
      style={{
        backgroundColor: `var(--color-primary)`,
        color: `var(--color-background)`,
        letterSpacing: '0.15em',
      }}
      onMouseEnter={(e) => {
        if (!disabled && !loading) e.currentTarget.style.filter = 'brightness(1.1)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.filter = 'brightness(1)'
        e.currentTarget.style.transform = 'scale(1)'
      }}
      onMouseDown={(e) => {
        if (!disabled && !loading) e.currentTarget.style.transform = 'scale(0.98)'
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = 'scale(1)'
      }}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span>Please wait…</span>
        </span>
      ) : (
        children
      )}
    </button>
  )
}

// ─── Magic Link Tab ───────────────────────────────────────────────────────────
function MagicLinkTab() {
  const formId = useId()
  const emailErrorId = `${formId}-email-error`
  const [serverError, setServerError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<MagicLinkFormData>({
    resolver: zodResolver(magicLinkSchema),
  })

  const onSubmit = async (data: MagicLinkFormData) => {
    setServerError(null)
    try {
      const res = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email }),
      })
      const json = await res.json()
      if (!res.ok) {
        setServerError(json.error ?? 'Something went wrong. Please try again.')
        return
      }
      setSuccess(true)
    } catch {
      setServerError('Network error. Please check your connection and try again.')
    }
  }

  if (success) {
    return (
      <motion.div
        className="flex flex-col items-center gap-4 py-6 text-center"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        role="status"
        aria-live="polite"
      >
        <div
          className="flex items-center justify-center w-16 h-16 rounded-full"
          style={{
            background: 'rgba(201,168,76,0.12)',
            border: '1px solid rgba(201,168,76,0.3)',
          }}
          aria-hidden="true"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.95 12a19.79 19.79 0 01-3.07-8.67A2 2 0 012.88 1h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L7.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
          </svg>
        </div>
        <div>
          <p className="text-base font-medium" style={{ color: `var(--color-primary)` }}>
            Magic link sent!
          </p>
          <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Check your email and click the link to sign in.
          </p>
        </div>
      </motion.div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <LuxuryInput
        id={`${formId}-email`}
        type="email"
        label="Email address"
        placeholder="you@example.com"
        autoComplete="email"
        disabled={isSubmitting}
        errorId={emailErrorId}
        errorMessage={errors.email?.message}
        {...register('email')}
      />

      <AnimatePresence mode="wait">
        {serverError && (
          <motion.div
            role="alert"
            aria-live="assertive"
            className="rounded-md px-4 py-3 text-sm"
            style={{
              backgroundColor: 'rgba(229,62,62,0.1)',
              border: '1px solid rgba(229,62,62,0.3)',
              color: `var(--color-destructive)`,
            }}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
          >
            {serverError}
          </motion.div>
        )}
      </AnimatePresence>

      <GoldButton loading={isSubmitting}>Send Magic Link</GoldButton>

      <p className="text-center text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
        We&apos;ll email you a secure, one-time sign-in link.
      </p>
    </form>
  )
}

// ─── Password Tab ─────────────────────────────────────────────────────────────
function PasswordTab() {
  const formId = useId()
  const emailErrorId = `${formId}-email-error`
  const passwordErrorId = `${formId}-password-error`
  const [serverError, setServerError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    setServerError(null)
    try {
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) {
        setServerError(json.error ?? 'Invalid email or password.')
        return
      }
      setSuccess(true)
      // Redirect handled server-side via cookie; navigate after brief delay
      setTimeout(() => {
        window.location.href = json.redirectTo ?? '/dashboard'
      }, 400)
    } catch {
      setServerError('Network error. Please check your connection and try again.')
    }
  }

  if (success) {
    return (
      <motion.div
        className="flex flex-col items-center gap-4 py-6 text-center"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35 }}
        role="status"
        aria-live="polite"
      >
        <div
          className="flex items-center justify-center w-16 h-16 rounded-full"
          style={{
            background: 'rgba(56,161,105,0.12)',
            border: '1px solid rgba(56,161,105,0.3)',
          }}
          aria-hidden="true"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <p className="text-sm" style={{ color: `var(--color-success)` }}>
          Signed in — redirecting…
        </p>
      </motion.div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <LuxuryInput
        id={`${formId}-email`}
        type="email"
        label="Email address"
        placeholder="you@example.com"
        autoComplete="email"
        disabled={isSubmitting}
        errorId={emailErrorId}
        errorMessage={errors.email?.message}
        {...register('email')}
      />

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor={`${formId}-password`}
            className="text-sm font-medium tracking-wide"
            style={{ color: 'rgba(255,255,255,0.75)' }}
          >
            Password
          </label>
          <Link
            href="/forgot-password"
            className="text-xs transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded"
            style={{ color: 'rgba(201,168,76,0.7)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = `var(--color-primary)`)}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(201,168,76,0.7)')}
          >
            Forgot password?
          </Link>
        </div>
        <input
          id={`${formId}-password`}
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          disabled={isSubmitting}
          aria-describedby={errors.password ? passwordErrorId : undefined}
          aria-invalid={!!errors.password}
          className="w-full rounded-md px-4 py-3 text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: 'rgba(255,255,255,0.04)',
            border: errors.password
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
            e.currentTarget.style.border = errors.password
              ? '1px solid rgba(229,62,62,0.7)'
              : '1px solid rgba(255,255,255,0.1)'
            e.currentTarget.style.boxShadow = 'none'
          }}
          {...register('password')}
        />
        <AnimatePresence mode="wait">
          {errors.password && (
            <motion.p
              id={passwordErrorId}
              role="alert"
              aria-live="polite"
              className="text-xs mt-0.5"
              style={{ color: `var(--color-destructive)` }}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
            >
              {errors.password.message}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence mode="wait">
        {serverError && (
          <motion.div
            role="alert"
            aria-live="assertive"
            className="rounded-md px-4 py-3 text-sm"
            style={{
              backgroundColor: 'rgba(229,62,62,0.1)',
              border: '1px solid rgba(229,62,62,0.3)',
              color: `var(--color-destructive)`,
            }}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
          >
            {serverError}
          </motion.div>
        )}
      </AnimatePresence>

      <GoldButton loading={isSubmitting}>Sign In</GoldButton>
    </form>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const [activeTab, setActiveTab] = useState<TabValue>('magic-link')

  return (
    <motion.div
      className="w-full max-w-md"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Glass card */}
      <div
        className="rounded-2xl p-8"
        style={{
          backgroundColor: 'rgba(20,20,20,0.8)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(201,168,76,0.2)',
          boxShadow:
            '0 24px 64px rgba(0,0,0,0.5), inset 0 1px 0 rgba(201,168,76,0.1)',
        }}
      >
        <div className="mb-6">
          <h2
            className="text-xl font-light tracking-wide"
            style={{ color: 'rgba(255,255,255,0.9)' }}
          >
            Welcome back
          </h2>
          <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Sign in to access your tickets and events.
          </p>
        </div>

        <Tabs.Root
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as TabValue)}
        >
          {/* Tab list */}
          <Tabs.List
            className="flex mb-6 rounded-lg p-1 gap-1"
            style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
            aria-label="Sign-in method"
          >
            {(
              [
                { value: 'magic-link', label: 'Magic Link' },
                { value: 'password', label: 'Password' },
              ] as const
            ).map((tab) => (
              <Tabs.Trigger
                key={tab.value}
                value={tab.value}
                className="flex-1 py-2 rounded-md text-sm font-medium transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={
                  activeTab === tab.value
                    ? {
                        backgroundColor: 'rgba(201,168,76,0.15)',
                        color: `var(--color-primary)`,
                        boxShadow: '0 0 0 1px rgba(201,168,76,0.3)',
                      }
                    : {
                        color: 'rgba(255,255,255,0.4)',
                        backgroundColor: 'transparent',
                      }
                }
              >
                {tab.label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>

          {/* Tab panels */}
          <Tabs.Content value="magic-link" tabIndex={-1}>
            <AnimatePresence mode="wait">
              {activeTab === 'magic-link' && (
                <motion.div
                  key="magic-link"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.25 }}
                >
                  <MagicLinkTab />
                </motion.div>
              )}
            </AnimatePresence>
          </Tabs.Content>

          <Tabs.Content value="password" tabIndex={-1}>
            <AnimatePresence mode="wait">
              {activeTab === 'password' && (
                <motion.div
                  key="password"
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.25 }}
                >
                  <PasswordTab />
                </motion.div>
              )}
            </AnimatePresence>
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </motion.div>
  )
}
