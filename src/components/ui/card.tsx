'use client'

import * as React from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { cn } from '@/lib/utils/cn'

// ─── Variants ──────────────────────────────────────────────────────────────
export type CardVariant = 'default' | 'elevated' | 'bordered'

const variantClasses: Record<CardVariant, string> = {
  default:  'bg-[var(--color-card)] border border-[var(--color-border)]',
  elevated: 'bg-[var(--color-card)] border border-[var(--color-border)] shadow-[var(--shadow-lg)]',
  bordered: 'bg-transparent border border-[var(--color-primary)] shadow-[var(--shadow-gold)]',
}

// ─── Card Props ────────────────────────────────────────────────────────────
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
  glass?: boolean
  hover?: boolean
  as?: React.ElementType
}

// ─── Card ──────────────────────────────────────────────────────────────────
export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      variant = 'default',
      glass = false,
      hover = false,
      children,
      ...props
    },
    ref
  ) => {
    const baseClass = cn(
      'rounded-[var(--border-radius)] overflow-hidden',
      'text-[var(--color-card-foreground)]',
      variantClasses[variant],
      glass && [
        '!bg-[rgba(20,20,20,0.7)]',
        'backdrop-blur-[var(--backdrop-blur)]',
        '-webkit-backdrop-filter: blur(var(--backdrop-blur))',
        'border-[rgba(201,168,76,0.1)]',
      ],
      className
    )

    if (hover) {
      return (
        <motion.div
          ref={ref}
          className={baseClass}
          whileHover={{ y: -2, boxShadow: 'var(--shadow-gold)' }}
          transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          {...(props as HTMLMotionProps<'div'>)}
        >
          {children}
        </motion.div>
      )
    }

    return (
      <div ref={ref} className={baseClass} {...props}>
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'

// ─── CardHeader ───────────────────────────────────────────────────────────
export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Render a gold divider below the header */
  divider?: boolean
}

export const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, divider = false, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'px-5 py-4',
        divider && 'border-b border-[var(--color-border)]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
)

CardHeader.displayName = 'CardHeader'

// ─── CardTitle ────────────────────────────────────────────────────────────
export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, children, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      'font-heading text-lg font-semibold tracking-[var(--letter-spacing-heading)]',
      'text-[var(--color-foreground)]',
      className
    )}
    {...props}
  >
    {children}
  </h3>
))

CardTitle.displayName = 'CardTitle'

// ─── CardDescription ──────────────────────────────────────────────────────
export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-[var(--color-muted-foreground)] mt-1', className)}
    {...props}
  >
    {children}
  </p>
))

CardDescription.displayName = 'CardDescription'

// ─── CardContent ──────────────────────────────────────────────────────────
export const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('px-5 py-4', className)}
    {...props}
  >
    {children}
  </div>
))

CardContent.displayName = 'CardContent'

// ─── CardFooter ───────────────────────────────────────────────────────────
export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  divider?: boolean
}

export const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, divider = false, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'px-5 py-4 flex items-center',
        divider && 'border-t border-[var(--color-border)]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
)

CardFooter.displayName = 'CardFooter'
