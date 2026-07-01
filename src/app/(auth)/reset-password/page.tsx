'use client'

import { useState, useId, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion, AnimatePresence } from 'framer-motion'
import { resetPasswordSchema, type ResetPasswordFormData } from '@/lib/validators/auth'
import { createClient } from '@/lib/supabase/client'

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: 'At least 8 characters', pass: password.length >= 8 },
    { label: 'One uppercase letter', pass: /[A-Z]/.test(password) },
    { label: 'One lowercase letter', pass: /[a-z]/.test(password) },
    { label: 'One number', pass: /[0-9]/.test(password) },
  ]
  const score = checks.filter((c) => c.pass).length
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][score]
  const strengthColor = ['', `var(--color-destructive)`, '#D69E2E', `var(--color-primary)`, `var(--color-success)`][score]
  if (!password) return null
  return (
    <div className="mt-2 space-y-2" aria-label="Password strength">
      <div className="flex gap-1" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-1 flex-1 rounded-full transition-all duration-300"
            style={{ backgroundColor: i <= score ? strengthColor : 'rgba(255,255,255,0.1)' }} />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Password strength</span>
        {score > 0 && <span className="text-xs font-medium" style={{ color: strengthColor }}>{strengthLabel}</span>}
      </div>
      <ul className="space-y-1" aria-label="Password requirements">
        {checks.map((check) => (
          <li key={check.label} className="flex items-center gap-2 text-xs"
            style={{ color: check.pass ? `var(--color-success)` : 'rgba(255,255,255,0.35)' }}>
            <span aria-hidden="true">{check.pass ? '✓' : '○'}</span>
            <span>{check.label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function ResetPasswordPage() {
  const formId = useId()
  const passwordErrorId = `${formId}-password-error`
  const confirmErrorId = `${formId}-confirm-error`
  const [serverError, setServerError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const supabase = createClient()

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    mode: 'onChange',
  })

  const watchedPassword = watch('password', '')

  useEffect(() => {
    if (!success) return
    const timer = setTimeout(() => { window.location.href = '/dashboard' }, 2000)
    return () => clearTimeout(timer)
  }, [success])

  const onSubmit = async (data: ResetPasswordFormData) => {
    setServerError(null)
    const { error } = await supabase.auth.updateUser({ password: data.password })
    if (error) {
      setServerError(error.message ?? 'Failed to update password. Please try again.')
      return
    }
    setSuccess(true)
  }

  if (success) {
    return (
      <motion.div className="w-full max-w-md" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
        <div className="rounded-2xl p-8 flex flex-col items-center text-center"
          style={{ backgroundColor: 'rgba(20,20,20,0.8)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '1px solid rgba(201,168,76,0.2)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
          <motion.div className="flex items-center justify-center w-20 h-20 rounded-full mb-6"
            style={{ background: 'rgba(56,161,105,0.12)', border: '1px solid rgba(56,161,105,0.3)' }}
            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.5, delay: 0.1 }} aria-hidden="true">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </motion.div>
          <h2 className="text-xl font-light mb-2" style={{ color: 'rgba(255,255,255,0.9)' }}>Password updated</h2>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>Your password has been changed. Redirecting you to the dashboard…</p>
        </div>
      </motion.div>
    )
  }

  const inputStyle = (hasError: boolean) => ({
    backgroundColor: 'rgba(255,255,255,0.04)',
    border: hasError ? '1px solid rgba(229,62,62,0.7)' : '1px solid rgba(255,255,255,0.1)',
    color: '#fff',
    outline: 'none',
  })

  return (
    <motion.div className="w-full max-w-md" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}>
      <div className="rounded-2xl p-8"
        style={{ backgroundColor: 'rgba(20,20,20,0.8)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '1px solid rgba(201,168,76,0.2)', boxShadow: '0 24px 64px rgba(0,0,0,0.5), inset 0 1px 0 rgba(201,168,76,0.1)' }}>
        <div className="mb-6">
          <h2 className="text-xl font-light tracking-wide" style={{ color: 'rgba(255,255,255,0.9)' }}>Set new password</h2>
          <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Choose a strong password to secure your account.</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
          {/* New password */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${formId}-password`} className="text-sm font-medium tracking-wide" style={{ color: 'rgba(255,255,255,0.75)' }}>New password</label>
            <div className="relative">
              <input id={`${formId}-password`} type={showPassword ? 'text' : 'password'} placeholder="••••••••"
                autoComplete="new-password" disabled={isSubmitting}
                aria-describedby={errors.password ? passwordErrorId : undefined} aria-invalid={!!errors.password}
                className="w-full rounded-md px-4 py-3 pr-12 text-sm transition-all duration-200 disabled:opacity-50"
                style={inputStyle(!!errors.password)}
                onFocus={(e) => { e.currentTarget.style.border = '1px solid var(--color-primary)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(201,168,76,0.15)' }}
                onBlur={(e) => { e.currentTarget.style.border = errors.password ? '1px solid rgba(229,62,62,0.7)' : '1px solid rgba(255,255,255,0.1)'; e.currentTarget.style.boxShadow = 'none' }}
                {...register('password')} />
              <button type="button" onClick={() => setShowPassword((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded focus-visible:outline focus-visible:outline-2"
                style={{ color: 'rgba(255,255,255,0.3)' }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword
                  ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22" /></svg>
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>}
              </button>
            </div>
            <AnimatePresence mode="wait">
              {errors.password && (
                <motion.p id={passwordErrorId} role="alert" aria-live="polite" className="text-xs" style={{ color: `var(--color-destructive)` }}
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}>
                  {errors.password.message}
                </motion.p>
              )}
            </AnimatePresence>
            <PasswordStrength password={watchedPassword} />
          </div>

          {/* Confirm password */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${formId}-confirm`} className="text-sm font-medium tracking-wide" style={{ color: 'rgba(255,255,255,0.75)' }}>Confirm new password</label>
            <div className="relative">
              <input id={`${formId}-confirm`} type={showConfirm ? 'text' : 'password'} placeholder="••••••••"
                autoComplete="new-password" disabled={isSubmitting}
                aria-describedby={errors.confirmPassword ? confirmErrorId : undefined} aria-invalid={!!errors.confirmPassword}
                className="w-full rounded-md px-4 py-3 pr-12 text-sm transition-all duration-200 disabled:opacity-50"
                style={inputStyle(!!errors.confirmPassword)}
                onFocus={(e) => { e.currentTarget.style.border = '1px solid var(--color-primary)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(201,168,76,0.15)' }}
                onBlur={(e) => { e.currentTarget.style.border = errors.confirmPassword ? '1px solid rgba(229,62,62,0.7)' : '1px solid rgba(255,255,255,0.1)'; e.currentTarget.style.boxShadow = 'none' }}
                {...register('confirmPassword')} />
              <button type="button" onClick={() => setShowConfirm((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded focus-visible:outline focus-visible:outline-2"
                style={{ color: 'rgba(255,255,255,0.3)' }}
                aria-label={showConfirm ? 'Hide password confirmation' : 'Show password confirmation'}>
                {showConfirm
                  ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22" /></svg>
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>}
              </button>
            </div>
            <AnimatePresence mode="wait">
              {errors.confirmPassword && (
                <motion.p id={confirmErrorId} role="alert" aria-live="polite" className="text-xs" style={{ color: `var(--color-destructive)` }}
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}>
                  {errors.confirmPassword.message}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <AnimatePresence mode="wait">
            {serverError && (
              <motion.div role="alert" aria-live="assertive" className="rounded-md px-4 py-3 text-sm"
                style={{ backgroundColor: 'rgba(229,62,62,0.1)', border: '1px solid rgba(229,62,62,0.3)', color: `var(--color-destructive)` }}
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
                {serverError}
              </motion.div>
            )}
          </AnimatePresence>

          <button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}
            className="w-full rounded-md py-3.5 text-sm font-semibold tracking-widest uppercase transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ backgroundColor: `var(--color-primary)`, color: `var(--color-background)`, letterSpacing: '0.15em' }}
            onMouseEnter={(e) => { if (!isSubmitting) e.currentTarget.style.filter = 'brightness(1.1)' }}
            onMouseLeave={(e) => { e.currentTarget.style.filter = 'brightness(1)'; e.currentTarget.style.transform = 'scale(1)' }}
            onMouseDown={(e) => { if (!isSubmitting) e.currentTarget.style.transform = 'scale(0.98)' }}
            onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}>
            {isSubmitting
              ? <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Updating…
                </span>
              : 'Update Password'}
          </button>
        </form>
      </div>
    </motion.div>
  )
}
