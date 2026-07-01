'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import { Ticket, Users, AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils/cn'

type StatColor = 'primary' | 'success' | 'warning' | 'muted'
type StatIcon = 'ticket' | 'users' | 'alert'

interface AnimatedStatCardProps {
  label: string
  value: number
  icon: StatIcon
  color: StatColor
}

const ICONS: Record<StatIcon, React.ElementType> = {
  ticket: Ticket,
  users: Users,
  alert: AlertCircle,
}

const COLOR_CLASSES: Record<StatColor, { text: string; bg: string; border: string }> = {
  primary: {
    text: 'text-[var(--color-primary)]',
    bg: 'bg-[var(--color-primary)]/10',
    border: 'border-[var(--color-primary)]/20',
  },
  success: {
    text: 'text-[var(--color-success)]',
    bg: 'bg-[var(--color-success)]/10',
    border: 'border-[var(--color-success)]/20',
  },
  warning: {
    text: 'text-[var(--color-warning,#D97706)]',
    bg: 'bg-[var(--color-warning,#D97706)]/10',
    border: 'border-[var(--color-warning,#D97706)]/20',
  },
  muted: {
    text: 'text-[var(--color-muted-foreground)]',
    bg: 'bg-[var(--color-muted)]',
    border: 'border-[var(--color-border)]',
  },
}

function useCountUp(target: number, duration = 800) {
  const [display, setDisplay] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })

  useEffect(() => {
    if (!inView) return
    const start = performance.now()
    const tick = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(eased * target))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [inView, target, duration])

  return { display, ref }
}

export function AnimatedStatCard({ label, value, icon, color }: AnimatedStatCardProps) {
  const Icon = ICONS[icon]
  const colors = COLOR_CLASSES[color]
  const { display, ref } = useCountUp(value)

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
    >
      <Card variant="default" className="h-full">
        <CardContent className="flex items-center gap-4 py-5">
          <div
            className={cn(
              'flex-shrink-0 w-12 h-12 rounded-[var(--border-radius)] border flex items-center justify-center',
              colors.bg,
              colors.border,
            )}
            aria-hidden="true"
          >
            <Icon size={22} className={colors.text} />
          </div>
          <div>
            <p
              className={cn('font-heading text-3xl font-semibold', colors.text)}
              aria-label={`${value} ${label}`}
            >
              {display}
            </p>
            <p className="text-xs font-body text-[var(--color-muted-foreground)] uppercase tracking-widest mt-0.5">
              {label}
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
