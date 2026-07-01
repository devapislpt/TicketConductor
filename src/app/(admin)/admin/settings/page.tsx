'use client'

import React, { useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Palette,
  Volume2,
  Plug,
  ChevronRight,
  Zap,
  Music,
  CheckCircle,
  Loader2,
  Settings2,
  Mail,
  Server,
  AlertTriangle,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useThemeStore } from '@/lib/stores/theme.store'
import { useSoundStore } from '@/lib/stores/sound.store'
import { toast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { SoundtrackPlayer } from '@/components/admin/SoundtrackPlayer'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { SystemConfigEditor } from '@/components/admin/SystemConfigEditor'

// ─── Quick toggle ──────────────────────────────────────────────────────────

interface QuickToggleProps {
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
  icon: React.ReactNode
}

function QuickToggle({ label, description, checked, onChange, icon }: QuickToggleProps) {
  return (
    <div className="flex items-center justify-between py-3 px-4 rounded-[var(--border-radius)] border border-[var(--color-border)] bg-[var(--color-muted)]">
      <div className="flex items-center gap-3">
        <span className="text-[var(--color-primary)]">{icon}</span>
        <div>
          <p className="text-sm font-medium text-[var(--color-foreground)]">{label}</p>
          <p className="text-xs text-[var(--color-muted-foreground)]">{description}</p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
          checked ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'
        )}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 600, damping: 30 }}
          className="inline-block h-4 w-4 rounded-full bg-white shadow-sm"
          style={{ x: checked ? 20 : 4 }}
        />
      </button>
    </div>
  )
}

// ─── Section link card ─────────────────────────────────────────────────────

interface SectionLinkProps {
  href: string
  icon: React.ReactNode
  title: string
  description: string
  badge?: string
}

function SectionLink({ href, icon, title, description, badge }: SectionLinkProps) {
  return (
    <Link href={href} className="block group">
      <motion.div
        whileHover={{ y: -2 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
        className={cn(
          'flex items-center gap-4 px-5 py-4',
          'rounded-[var(--border-radius)] border border-[var(--color-border)]',
          'bg-[var(--color-card)] hover:border-[var(--color-primary)]/50',
          'transition-colors duration-150 cursor-pointer',
          'group'
        )}
      >
        <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-[var(--color-foreground)] group-hover:text-[var(--color-primary)] transition-colors">
              {title}
            </p>
            {badge && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-[var(--color-primary)]/15 text-[var(--color-primary)] border border-[var(--color-primary)]/25 font-medium">
                {badge}
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--color-muted-foreground)] mt-0.5 truncate">{description}</p>
        </div>
        <ChevronRight size={16} className="text-[var(--color-muted-foreground)] group-hover:text-[var(--color-primary)] transition-colors flex-shrink-0" />
      </motion.div>
    </Link>
  )
}

// ─── Service status card ───────────────────────────────────────────────────

type ServiceStatus = 'configured' | 'partial' | 'unconfigured' | 'loading'

interface ServiceStatusCardProps {
  icon: React.ReactNode
  title: string
  status: ServiceStatus
  description: string
  onConfigure: () => void
}

function ServiceStatusCard({ icon, title, status, description, onConfigure }: ServiceStatusCardProps) {
  const statusCfg = {
    configured: {
      color: 'text-[var(--color-success)]',
      bg: 'bg-[var(--color-success)]/10',
      border: 'border-[var(--color-success)]/20',
      label: 'Configured',
      icon: <CheckCircle size={14} />,
    },
    partial: {
      color: 'text-amber-400',
      bg: 'bg-amber-400/10',
      border: 'border-amber-400/20',
      label: 'Partially configured',
      icon: <AlertTriangle size={14} />,
    },
    unconfigured: {
      color: 'text-[var(--color-destructive)]',
      bg: 'bg-[var(--color-destructive)]/10',
      border: 'border-[var(--color-destructive)]/20',
      label: 'Not configured',
      icon: <XCircle size={14} />,
    },
    loading: {
      color: 'text-[var(--color-muted-foreground)]',
      bg: 'bg-[var(--color-muted)]/40',
      border: 'border-[var(--color-border)]',
      label: 'Loading&hellip;',
      icon: <Loader2 size={14} className="animate-spin" />,
    },
  }[status]

  return (
    <div className={cn(
      'flex items-center gap-4 px-4 py-3 rounded-[var(--border-radius)] border',
      'bg-[var(--color-card)]',
      'border-[var(--color-border)]'
    )}>
      <div className={cn('flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center', statusCfg.bg, statusCfg.color)}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--color-foreground)]">{title}</p>
        <div className={cn('inline-flex items-center gap-1 text-xs mt-0.5', statusCfg.color)}>
          {statusCfg.icon}
          <span dangerouslySetInnerHTML={{ __html: statusCfg.label }} />
        </div>
        <p className="text-xs text-[var(--color-muted-foreground)] mt-0.5 truncate">{description}</p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onConfigure}
        silent
        className="flex-shrink-0"
      >
        Configure
      </Button>
    </div>
  )
}

// ─── Color swatch strip ────────────────────────────────────────────────────

function ThemeSwatch({ theme }: { theme: ReturnType<typeof useThemeStore>['theme'] }) {
  const swatches = [
    theme.color_primary,
    theme.color_secondary,
    theme.color_accent,
    theme.color_background,
    theme.color_card,
    theme.color_border,
    theme.color_success,
    theme.color_destructive,
  ]

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {swatches.map((color, i) => (
        <div
          key={i}
          title={color}
          className="w-7 h-7 rounded-lg border border-[var(--color-border)] shadow-sm flex-shrink-0"
          style={{ background: color }}
        />
      ))}
      <span className="text-xs text-[var(--color-muted-foreground)] ml-1">
        {theme.font_heading} / {theme.font_body}
      </span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { theme, updateKey } = useThemeStore()
  const { setEnabled: setSoundEnabled } = useSoundStore()
  const [isSaving, setIsSaving] = useState(false)

  // Ref for scrolling to system config section
  const systemConfigRef = useRef<HTMLDivElement>(null)

  const scrollToSystemConfig = useCallback(() => {
    systemConfigRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const handleToggleSave = useCallback(async (updates: Record<string, string>) => {
    setIsSaving(true)
    try {
      const res = await fetch('/api/admin/theme', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error ?? 'Save failed')
    } catch (e) {
      toast.error(`Failed to save: ${e instanceof Error ? e.message : 'Unknown error'}`)
    } finally {
      setIsSaving(false)
    }
  }, [])

  const handleAnimationsToggle = useCallback(
    (v: boolean) => {
      updateKey('animations_enabled', v ? 'true' : 'false')
      handleToggleSave({ animations_enabled: v ? 'true' : 'false' })
    },
    [updateKey, handleToggleSave]
  )

  const handleSoundsToggle = useCallback(
    (v: boolean) => {
      updateKey('sounds_enabled', v ? 'true' : 'false')
      setSoundEnabled(v)
      handleToggleSave({ sounds_enabled: v ? 'true' : 'false' })
    },
    [updateKey, setSoundEnabled, handleToggleSave]
  )

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-[var(--letter-spacing-heading)] text-[var(--color-foreground)]">
          Settings
        </h1>
        <p className="text-sm text-[var(--color-muted-foreground)] mt-1">
          Manage API credentials, theming, sounds, and integrations for the admin panel.
        </p>
      </div>

      {/* ── System Configuration ──────────────────────────────────────────── */}
      <section ref={systemConfigRef} className="space-y-3 scroll-mt-6">
        <div className="flex items-center gap-2">
          <h2 className="text-xs uppercase tracking-wider text-[var(--color-muted-foreground)] font-medium">
            System Configuration
          </h2>
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-[var(--color-primary)]/15 text-[var(--color-primary)] border border-[var(--color-primary)]/25 font-medium">
            New
          </span>
        </div>

        <p className="text-xs text-[var(--color-muted-foreground)]">
          Set API keys and credentials directly in the admin panel — no .env file editing required.
          Values marked as secret are encrypted at rest using AES-256-GCM.
        </p>

        {/* Service status overview */}
        <div className="space-y-2">
          <ServiceStatusCard
            icon={<Mail size={16} />}
            title="Email (Resend)"
            status="loading"
            description="Ticket confirmations and magic link sign-ins"
            onConfigure={scrollToSystemConfig}
          />
          <ServiceStatusCard
            icon={<Server size={16} />}
            title="Connect Integration"
            status="loading"
            description="External API sync and data integration"
            onConfigure={scrollToSystemConfig}
          />
        </div>

        {/* The actual editor */}
        <Card>
          <CardHeader divider>
            <div className="flex items-center gap-2.5">
              <Settings2 size={16} className="text-[var(--color-primary)]" />
              <CardTitle className="text-base">API Keys &amp; Credentials</CardTitle>
            </div>
            <CardDescription>
              Changes only take effect after clicking Save. Secrets are never returned to the browser after saving.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SystemConfigEditor />
          </CardContent>
        </Card>
      </section>

      {/* ── Section links ─────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-wider text-[var(--color-muted-foreground)] font-medium">Sections</h2>
        <SectionLink
          href="/admin/settings/theming"
          icon={<Palette size={18} />}
          title="Theming"
          description="Colors, typography, spacing, shapes, and live preview"
        />
        <SectionLink
          href="/admin/settings/theming#sounds"
          icon={<Volume2 size={18} />}
          title="Sounds & Music"
          description="UI sound effects, volume, soundtrack configuration"
        />
        <SectionLink
          href="/admin/connect"
          icon={<Plug size={18} />}
          title="Connect Integration"
          description="External API sync and integration settings"
          badge="Beta"
        />
      </section>

      {/* ── Quick settings ────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs uppercase tracking-wider text-[var(--color-muted-foreground)] font-medium">Quick Settings</h2>
          {isSaving && <Loader2 size={13} className="animate-spin text-[var(--color-muted-foreground)]" />}
        </div>
        <QuickToggle
          label="Animations"
          description="Framer Motion transitions and micro-interactions"
          checked={theme.animations_enabled === 'true'}
          onChange={handleAnimationsToggle}
          icon={<Zap size={16} />}
        />
        <QuickToggle
          label="Sound Effects"
          description="Click, success, error, and check-in sounds"
          checked={theme.sounds_enabled === 'true'}
          onChange={handleSoundsToggle}
          icon={<Volume2 size={16} />}
        />
      </section>

      {/* ── Soundtrack quick controls ─────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-wider text-[var(--color-muted-foreground)] font-medium">Background Music</h2>
        <Card>
          <CardHeader divider>
            <CardTitle className="text-sm">Soundtrack Player</CardTitle>
            <CardDescription>Quick controls — full settings in Theming</CardDescription>
          </CardHeader>
          <CardContent>
            <SoundtrackPlayer />
          </CardContent>
        </Card>
      </section>

      {/* ── Current theme preview ─────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-wider text-[var(--color-muted-foreground)] font-medium">Current Theme</h2>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2 flex-1">
                <p className="text-sm font-medium text-[var(--color-foreground)]">
                  Active palette &amp; fonts
                </p>
                <ThemeSwatch theme={theme} />
                <div className="flex flex-wrap gap-3 text-xs text-[var(--color-muted-foreground)]">
                  <span>Radius: {theme.border_radius}</span>
                  <span>Duration: {theme.animation_duration}ms</span>
                  <span>Size: {theme.font_size_base}</span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                asChild
                silent
                className="flex-shrink-0"
              >
                <Link href="/admin/settings/theming">
                  Edit <ChevronRight size={13} className="ml-1" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
