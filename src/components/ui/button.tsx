'use client'

import * as React from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '@/lib/utils/cn'
import { useSoundStore } from '@/lib/stores/sound.store'
import { useThemeStore } from '@/lib/stores/theme.store'

// ─── Variants ──────────────────────────────────────────────────────────────
export type ButtonVariant =
  | 'default'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'destructive'
  | 'success'

export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

const variantClasses: Record<ButtonVariant, string> = {
  default:     'bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:brightness-75 focus-visible:ring-[var(--color-primary)]',
  secondary:   'bg-[var(--color-secondary)] text-[var(--color-secondary-foreground)] hover:brightness-125 focus-visible:ring-[var(--color-secondary)]',
  outline:     'border border-[var(--color-primary)] text-[var(--color-primary)] bg-transparent hover:bg-[var(--color-primary)] hover:text-[var(--color-primary-foreground)] focus-visible:ring-[var(--color-primary)]',
  ghost:       'text-[var(--color-foreground)] bg-transparent hover:bg-[var(--color-muted)] focus-visible:ring-[var(--color-border)]',
  destructive: 'bg-[var(--color-destructive)] text-white hover:brightness-110 focus-visible:ring-[var(--color-destructive)]',
  success:     'bg-[var(--color-success)] text-white hover:brightness-110 focus-visible:ring-[var(--color-success)]',
}

// Inline style fallback for asChild: guarantees text color regardless of CSS cascade.
// The global a { color } rule can beat Tailwind utility classes; inline style always wins.
const variantTextColor: Record<ButtonVariant, string | undefined> = {
  default:     'var(--color-primary-foreground)',
  secondary:   'var(--color-secondary-foreground)',
  outline:     undefined,
  ghost:       'var(--color-foreground)',
  destructive: '#ffffff',
  success:     '#ffffff',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm:   'h-8 px-3 text-xs gap-1.5',
  md:   'h-10 px-5 text-sm gap-2',
  lg:   'h-12 px-7 text-base gap-2.5',
  icon: 'h-10 w-10 p-0',
}

// ─── Loading Spinner ───────────────────────────────────────────────────────
function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('animate-spin', className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
      width="16"
      height="16"
    >
      <circle
        className="opacity-25"
        cx="12" cy="12" r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}

// ─── Props ─────────────────────────────────────────────────────────────────
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  asChild?: boolean
  silent?: boolean
}

// ─── Component ─────────────────────────────────────────────────────────────
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'default',
      size = 'md',
      loading = false,
      asChild = false,
      silent = false,
      disabled,
      onClick,
      style,
      children,
      ...props
    },
    ref
  ) => {
    const play = useSoundStore((s) => s.play)
    const animationsEnabled = useThemeStore((s) => s.theme.animations_enabled === 'true')

    const isDisabled = disabled || loading
    const Comp = asChild ? Slot : 'button'

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!silent && !isDisabled) {
        play('click')
      }
      onClick?.(e)
    }

    const baseClasses = cn(
      'inline-flex items-center justify-center font-body font-medium',
      'rounded-[var(--border-radius)]',
      'transition-all duration-[var(--animation-duration)] ease-[var(--animation-easing)]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)]',
      'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
      'select-none whitespace-nowrap',
      variantClasses[variant],
      sizeClasses[size],
      'tracking-wide',
      className
    )

    if (!animationsEnabled) {
      return (
        <Comp
          ref={ref}
          className={baseClasses}
          disabled={isDisabled}
          aria-busy={loading}
          aria-disabled={isDisabled}
          onClick={handleClick}
          style={style}
          {...props}
        >
          {loading && <Spinner className="mr-1.5" />}
          {children}
        </Comp>
      )
    }

    // asChild: render via Slot so a Link becomes the actual DOM element.
    // Inline style color is the highest-specificity override — no CSS rule can beat it.
    if (asChild) {
      const textColor = variantTextColor[variant]
      const mergedStyle: React.CSSProperties | undefined = textColor
        ? { color: textColor, ...style }
        : style
      return (
        <Slot
          ref={ref}
          className={baseClasses}
          style={mergedStyle}
          onClick={handleClick}
          {...props}
        >
          {children}
        </Slot>
      )
    }

    return (
      <motion.button
        ref={ref}
        className={baseClasses}
        disabled={isDisabled}
        aria-busy={loading}
        aria-disabled={isDisabled}
        onClick={handleClick as React.MouseEventHandler<HTMLButtonElement>}
        style={style}
        whileHover={isDisabled ? undefined : { scale: 1.02 }}
        whileTap={isDisabled ? undefined : { scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        {...(props as HTMLMotionProps<'button'>)}
      >
        {loading && <Spinner className="mr-1.5" />}
        {children}
      </motion.button>
    )
  }
)

Button.displayName = 'Button'
