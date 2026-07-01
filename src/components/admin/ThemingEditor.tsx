'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Palette,
  Type,
  Layout,
  Zap,
  Volume2,
  RotateCcw,
  Save,
  X,
  Play,
  Upload,
  Check,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useThemeStore } from '@/lib/stores/theme.store'
import { useSoundStore } from '@/lib/stores/sound.store'
import { useSoundtrackStore } from '@/lib/stores/soundtrack.store'
import { toast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { ThemePreview } from '@/components/admin/ThemePreview'
import { SoundtrackPlayer } from '@/components/admin/SoundtrackPlayer'
import type { ThemeConfig } from '@/lib/types'

// ─── Constants ─────────────────────────────────────────────────────────────

const GOOGLE_FONTS_HEADING = [
  'Cormorant Garamond', 'Playfair Display', 'Libre Baskerville',
  'Merriweather', 'EB Garamond', 'Crimson Text', 'Lora',
  'DM Serif Display', 'Spectral', 'Alegreya',
]
const GOOGLE_FONTS_BODY = [
  'Inter', 'Roboto', 'Open Sans', 'Lato', 'Poppins',
  'Nunito', 'Source Sans 3', 'DM Sans', 'Figtree', 'Outfit',
]
const GOOGLE_FONTS_MONO = [
  'JetBrains Mono', 'Fira Code', 'Source Code Pro',
  'IBM Plex Mono', 'Space Mono', 'Roboto Mono',
  'Inconsolata', 'Courier Prime',
]
const EASING_OPTIONS = [
  { label: 'Ease Out (default)', value: 'cubic-bezier(0.4, 0, 0.2, 1)' },
  { label: 'Ease In',            value: 'cubic-bezier(0.4, 0, 1, 1)' },
  { label: 'Ease In-Out',        value: 'cubic-bezier(0.4, 0, 0.2, 1)' },
  { label: 'Spring',             value: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
  { label: 'Linear',             value: 'linear' },
]
const COLOR_FIELDS: Array<{ key: keyof ThemeConfig; label: string }> = [
  { key: 'color_primary',            label: 'Primary' },
  { key: 'color_primary_foreground', label: 'Primary Foreground' },
  { key: 'color_secondary',          label: 'Secondary' },
  { key: 'color_secondary_foreground', label: 'Secondary Foreground' },
  { key: 'color_accent',             label: 'Accent' },
  { key: 'color_accent_foreground',  label: 'Accent Foreground' },
  { key: 'color_background',         label: 'Background' },
  { key: 'color_foreground',         label: 'Foreground' },
  { key: 'color_card',               label: 'Card' },
  { key: 'color_card_foreground',    label: 'Card Foreground' },
  { key: 'color_border',             label: 'Border' },
  { key: 'color_muted',              label: 'Muted' },
  { key: 'color_muted_foreground',   label: 'Muted Foreground' },
  { key: 'color_destructive',        label: 'Destructive' },
  { key: 'color_success',            label: 'Success' },
]

const TABS = [
  { id: 'colors',     label: 'Colors',          icon: Palette },
  { id: 'typography', label: 'Typography',      icon: Type },
  { id: 'spacing',    label: 'Spacing & Shape', icon: Layout },
  { id: 'animations', label: 'Animations',      icon: Zap },
  { id: 'sounds',     label: 'Sounds',          icon: Volume2 },
] as const

type TabId = typeof TABS[number]['id']

// ─── Subcomponents ─────────────────────────────────────────────────────────

interface ColorRowProps {
  label: string
  value: string
  onChange: (v: string) => void
}

function ColorRow({ label, value, onChange }: ColorRowProps) {
  const [hex, setHex] = useState(value)

  // Keep local hex in sync with parent value
  useEffect(() => { setHex(value) }, [value])

  const handleHexBlur = () => {
    const cleaned = hex.startsWith('#') ? hex : `#${hex}`
    if (/^#[0-9A-Fa-f]{6}$/.test(cleaned)) {
      onChange(cleaned)
      setHex(cleaned)
    } else {
      setHex(value) // revert
    }
  }

  return (
    <div className="flex items-center gap-3">
      {/* Native color picker */}
      <label className="relative cursor-pointer flex-shrink-0">
        <input
          type="color"
          value={value}
          onChange={(e) => { onChange(e.target.value); setHex(e.target.value) }}
          className="sr-only"
          aria-label={`Pick color for ${label}`}
        />
        <div
          className="w-9 h-9 rounded-lg border-2 border-[var(--color-border)] hover:border-[var(--color-primary)] transition-colors shadow-sm"
          style={{ background: value }}
          title="Click to pick color"
        />
      </label>

      {/* Hex text input */}
      <input
        type="text"
        value={hex}
        maxLength={7}
        onChange={(e) => setHex(e.target.value)}
        onBlur={handleHexBlur}
        onKeyDown={(e) => { if (e.key === 'Enter') handleHexBlur() }}
        className={cn(
          'w-28 px-2 py-1.5 rounded-md text-xs font-mono',
          'bg-[var(--color-muted)] border border-[var(--color-border)]',
          'text-[var(--color-foreground)] focus:outline-none',
          'focus:ring-1 focus:ring-[var(--color-primary)]',
        )}
        aria-label={`Hex value for ${label}`}
      />

      {/* Label */}
      <span className="text-sm text-[var(--color-muted-foreground)] flex-1">{label}</span>
    </div>
  )
}

interface ToggleProps {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}

function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
        checked ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'
      )}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 600, damping: 30 }}
        className={cn(
          'inline-block h-4 w-4 rounded-full bg-white shadow-sm',
          'translate-x-1',
        )}
        style={{ x: checked ? 20 : 0 }}
      />
    </button>
  )
}

interface SliderProps {
  min: number
  max: number
  step?: number
  value: number
  onChange: (v: number) => void
  label: string
  unit?: string
}

function Slider({ min, max, step = 1, value, onChange, label, unit }: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        style={{
          background: `linear-gradient(to right, var(--color-primary) 0%, var(--color-primary) ${pct}%, var(--color-border) ${pct}%, var(--color-border) 100%)`,
        }}
        className="flex-1 h-1.5 appearance-none rounded-full cursor-pointer accent-[var(--color-primary)]"
      />
      <span className="text-xs font-mono text-[var(--color-muted-foreground)] w-16 text-right">
        {value}{unit}
      </span>
    </div>
  )
}

interface SoundRowProps {
  label: string
  urlKey: keyof ThemeConfig
  value: string
  onUrlChange: (v: string) => void
  onPlay: () => void
}

function SoundRow({ label, urlKey, value, onUrlChange, onPlay }: SoundRowProps) {
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const objectUrl = URL.createObjectURL(file)
    onUrlChange(objectUrl)
    if (fileRef.current) fileRef.current.value = ''
  }

  const filename = value.split('/').pop() ?? value

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-[var(--color-border)] last:border-0">
      <span className="text-sm text-[var(--color-foreground)] w-24 flex-shrink-0">{label}</span>

      <span className="flex-1 text-xs font-mono text-[var(--color-muted-foreground)] truncate" title={value}>
        {filename}
      </span>

      <input type="file" accept="audio/*" ref={fileRef} className="hidden" onChange={handleFile} aria-label={`Upload ${label} sound`} />
      <button
        onClick={() => fileRef.current?.click()}
        className="p-1.5 rounded text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-muted)] transition-colors"
        aria-label={`Upload ${label} sound file`}
        title="Upload file"
      >
        <Upload size={14} />
      </button>
      <button
        onClick={onPlay}
        className="p-1.5 rounded text-[var(--color-muted-foreground)] hover:text-[var(--color-primary)] hover:bg-[var(--color-muted)] transition-colors"
        aria-label={`Preview ${label} sound`}
        title="Preview"
      >
        <Play size={14} />
      </button>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

interface ThemingEditorProps {
  initialConfig: ThemeConfig
}

export function ThemingEditor({ initialConfig }: ThemingEditorProps) {
  const { theme, updateKey, applyToDOM, setTheme } = useThemeStore()
  const { play: playSound, setEnabled: setSoundEnabled, setVolume: setSoundVolume } = useSoundStore()
  const { setEnabled: setSoundtrackEnabled, setVolume: setSoundtrackVolume, load: loadSoundtrack } = useSoundtrackStore()

  const [activeTab, setActiveTab] = useState<TabId>('colors')
  const [savedConfig, setSavedConfig] = useState<ThemeConfig>(initialConfig)
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [animTestKey, setAnimTestKey] = useState(0)
  const [showSaveSuccess, setShowSaveSuccess] = useState(false)

  // Initialize store from server-fetched config
  useEffect(() => {
    setTheme(initialConfig)
    setSavedConfig(initialConfig)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Track if there are unsaved changes
  useEffect(() => {
    setHasChanges(JSON.stringify(theme) !== JSON.stringify(savedConfig))
  }, [theme, savedConfig])

  const update = useCallback(
    <K extends keyof ThemeConfig>(key: K, value: ThemeConfig[K]) => {
      updateKey(key, value)
    },
    [updateKey]
  )

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await fetch('/api/admin/theme', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(theme),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error ?? 'Save failed')
      setSavedConfig(theme)
      setHasChanges(false)
      setShowSaveSuccess(true)
      setTimeout(() => setShowSaveSuccess(false), 2000)
      toast.success('Theme saved successfully.')
    } catch (e) {
      toast.error(`Failed to save theme: ${e instanceof Error ? e.message : 'Unknown error'}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDiscard = () => {
    setTheme(savedConfig)
    applyToDOM(savedConfig)
    setHasChanges(false)
    toast.info('Changes discarded.')
  }

  const handleResetToDefaults = () => {
    fetch('/api/admin/theme')
      .then(r => r.json())
      .catch(() => ({ data: null }))
    // Reset locally using store defaults — just re-init from initial defaults
    const defaults = initialConfig // could widen to true defaults
    setTheme(defaults)
    applyToDOM(defaults)
  }

  const testAnimation = () => {
    setAnimTestKey(k => k + 1)
  }

  const borderRadiusPx = parseFloat(theme.border_radius) * 16

  return (
    <div className="flex flex-col h-full">
      {/* ── Sticky toolbar ── */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--color-border)] bg-[var(--color-card)] sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-lg font-semibold tracking-[var(--letter-spacing-heading)] text-[var(--color-foreground)]">
            Theme Editor
          </h1>
          {hasChanges && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-primary)]/15 text-[var(--color-primary)] font-medium border border-[var(--color-primary)]/30">
              Unsaved changes
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleDiscard} disabled={!hasChanges} silent>
            <X size={14} className="mr-1" /> Discard
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleSave}
            loading={isSaving}
            disabled={!hasChanges}
            silent
            className="gap-1.5"
          >
            <AnimatePresence mode="wait" initial={false}>
              {showSaveSuccess ? (
                <motion.span key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                  <Check size={14} />
                </motion.span>
              ) : (
                <motion.span key="save" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                  <Save size={14} />
                </motion.span>
              )}
            </AnimatePresence>
            Save All
          </Button>
        </div>
      </div>

      {/* ── Body: tabs + preview ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: tab nav + content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-[var(--color-border)] px-4 overflow-x-auto flex-shrink-0">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                  activeTab === id
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'border-transparent text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]'
                )}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="p-6 space-y-6"
              >

                {/* ── COLORS TAB ── */}
                {activeTab === 'colors' && (
                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="font-heading font-semibold text-[var(--color-foreground)]">Color Palette</h2>
                        <p className="text-sm text-[var(--color-muted-foreground)] mt-0.5">
                          Click a swatch or edit the hex value. Changes apply instantly.
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={handleResetToDefaults} silent className="gap-1.5 text-xs">
                        <RotateCcw size={13} /> Reset to Defaults
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {COLOR_FIELDS.map(({ key, label }) => (
                        <ColorRow
                          key={key}
                          label={label}
                          value={theme[key] as string}
                          onChange={(v) => update(key, v)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* ── TYPOGRAPHY TAB ── */}
                {activeTab === 'typography' && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="font-heading font-semibold text-[var(--color-foreground)]">Typography</h2>
                      <p className="text-sm text-[var(--color-muted-foreground)] mt-0.5">
                        Font changes apply immediately via CSS variables.
                      </p>
                    </div>

                    {/* Font families */}
                    <div className="space-y-4">
                      <h3 className="text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">Font Families</h3>
                      {[
                        { key: 'font_heading' as const, label: 'Heading Font', options: GOOGLE_FONTS_HEADING },
                        { key: 'font_body' as const, label: 'Body Font', options: GOOGLE_FONTS_BODY },
                        { key: 'font_mono' as const, label: 'Monospace Font', options: GOOGLE_FONTS_MONO },
                      ].map(({ key, label, options }) => (
                        <div key={key} className="flex items-center gap-4">
                          <label className="text-sm text-[var(--color-foreground)] w-32 flex-shrink-0">{label}</label>
                          <select
                            value={theme[key]}
                            onChange={(e) => update(key, e.target.value)}
                            className={cn(
                              'flex-1 px-3 py-2 rounded-md text-sm',
                              'bg-[var(--color-muted)] border border-[var(--color-border)]',
                              'text-[var(--color-foreground)] focus:outline-none',
                              'focus:ring-1 focus:ring-[var(--color-primary)]'
                            )}
                          >
                            {options.map(f => (
                              <option key={f} value={f}>{f}</option>
                            ))}
                          </select>
                          <span
                            className="text-sm px-2 py-1 rounded bg-[var(--color-muted)] text-[var(--color-foreground)]"
                            style={{ fontFamily: `'${theme[key]}', serif` }}
                          >
                            Aa
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Numeric settings */}
                    <div className="space-y-4">
                      <h3 className="text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">Size & Scale</h3>

                      <div className="flex items-center gap-4">
                        <label className="text-sm text-[var(--color-foreground)] w-32 flex-shrink-0">Base Size</label>
                        <input
                          type="number"
                          min={10}
                          max={24}
                          step={1}
                          value={parseInt(theme.font_size_base, 10)}
                          onChange={(e) => update('font_size_base', `${e.target.value}px`)}
                          className={cn(
                            'w-24 px-3 py-2 rounded-md text-sm',
                            'bg-[var(--color-muted)] border border-[var(--color-border)]',
                            'text-[var(--color-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]'
                          )}
                          aria-label="Font size base in px"
                        />
                        <span className="text-xs text-[var(--color-muted-foreground)]">px</span>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm text-[var(--color-foreground)]">Heading Weight</label>
                          <span className="text-xs font-mono text-[var(--color-muted-foreground)]">{theme.font_weight_heading}</span>
                        </div>
                        <Slider
                          min={300}
                          max={900}
                          step={100}
                          value={parseInt(theme.font_weight_heading, 10)}
                          onChange={(v) => update('font_weight_heading', String(v))}
                          label="Heading font weight"
                        />
                      </div>

                      <div className="flex items-center gap-4">
                        <label className="text-sm text-[var(--color-foreground)] w-32 flex-shrink-0">Line Height</label>
                        <input
                          type="number"
                          min={1}
                          max={3}
                          step={0.1}
                          value={parseFloat(theme.line_height_base)}
                          onChange={(e) => update('line_height_base', e.target.value)}
                          className={cn(
                            'w-24 px-3 py-2 rounded-md text-sm',
                            'bg-[var(--color-muted)] border border-[var(--color-border)]',
                            'text-[var(--color-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]'
                          )}
                          aria-label="Line height"
                        />
                      </div>

                      <div className="flex items-center gap-4">
                        <label className="text-sm text-[var(--color-foreground)] w-32 flex-shrink-0">Letter Spacing</label>
                        <input
                          type="text"
                          value={theme.letter_spacing_heading}
                          onChange={(e) => update('letter_spacing_heading', e.target.value)}
                          placeholder="e.g. 0.02em"
                          className={cn(
                            'w-32 px-3 py-2 rounded-md text-sm font-mono',
                            'bg-[var(--color-muted)] border border-[var(--color-border)]',
                            'text-[var(--color-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]'
                          )}
                          aria-label="Letter spacing for headings"
                        />
                      </div>
                    </div>

                    {/* Live text preview */}
                    <div className="rounded-[var(--border-radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-5 space-y-3">
                      <h3 className="text-xs uppercase tracking-wider text-[var(--color-muted-foreground)] mb-3">Preview</h3>
                      <p
                        style={{
                          fontFamily: `'${theme.font_heading}', serif`,
                          fontSize: `calc(${theme.font_size_base} * 1.4)`,
                          fontWeight: theme.font_weight_heading,
                          letterSpacing: theme.letter_spacing_heading,
                          color: 'var(--color-foreground)',
                          lineHeight: theme.line_height_base,
                        }}
                      >
                        FallCon 2026 — Heading
                      </p>
                      <p
                        style={{
                          fontFamily: `'${theme.font_body}', sans-serif`,
                          fontSize: theme.font_size_base,
                          color: 'var(--color-muted-foreground)',
                          lineHeight: theme.line_height_base,
                        }}
                      >
                        Body text — The quick brown fox jumps over the lazy dog. Ticket confirmation emails and dashboard content use this font.
                      </p>
                      <code
                        style={{
                          fontFamily: `'${theme.font_mono}', monospace`,
                          fontSize: `calc(${theme.font_size_base} * 0.875)`,
                          color: 'var(--color-primary)',
                          background: 'var(--color-muted)',
                          padding: '2px 8px',
                          borderRadius: 4,
                          display: 'inline-block',
                        }}
                      >
                        QR-CODE-ABC123 — Mono
                      </code>
                    </div>
                  </div>
                )}

                {/* ── SPACING & SHAPE TAB ── */}
                {activeTab === 'spacing' && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="font-heading font-semibold text-[var(--color-foreground)]">Spacing & Shape</h2>
                      <p className="text-sm text-[var(--color-muted-foreground)] mt-0.5">
                        Control border radius and spacing unit.
                      </p>
                    </div>

                    {/* Border radius */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-[var(--color-foreground)]">Border Radius</label>
                        <span className="text-xs font-mono text-[var(--color-muted-foreground)]">{theme.border_radius}</span>
                      </div>
                      <Slider
                        min={0}
                        max={32}
                        step={1}
                        value={borderRadiusPx}
                        onChange={(v) => update('border_radius', `${(v / 16).toFixed(3)}rem`)}
                        label="Border radius"
                        unit="px"
                      />
                      <div className="flex items-center gap-2 text-xs text-[var(--color-muted-foreground)]">
                        <span>Sharp (0)</span>
                        <div className="flex-1 h-px bg-[var(--color-border)]" />
                        <span>Very Rounded (2rem)</span>
                      </div>
                    </div>

                    {/* Shape preview */}
                    <div className="rounded-[var(--border-radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-5">
                      <p className="text-xs uppercase tracking-wider text-[var(--color-muted-foreground)] mb-4">Shape Preview</p>
                      <div className="flex flex-wrap gap-4 items-start">
                        {['Button', 'Badge', 'Input', 'Card'].map((name) => (
                          <div key={name} className="flex flex-col items-center gap-2">
                            <div
                              style={{
                                borderRadius: theme.border_radius,
                                background: name === 'Badge'
                                  ? 'var(--color-primary)30'
                                  : name === 'Card'
                                  ? 'var(--color-card)'
                                  : 'var(--color-primary)',
                                border: name === 'Card' || name === 'Input'
                                  ? '1px solid var(--color-border)'
                                  : 'none',
                                color: name === 'Badge'
                                  ? 'var(--color-primary)'
                                  : '#fff',
                                padding: name === 'Card' ? '16px 20px' : name === 'Badge' ? '4px 12px' : '8px 18px',
                                fontSize: 13,
                                minWidth: name === 'Input' ? 120 : undefined,
                                minHeight: name === 'Card' ? 60 : undefined,
                                fontFamily: 'var(--font-body)',
                              }}
                            >
                              {name}
                            </div>
                            <span className="text-xs text-[var(--color-muted-foreground)]">{name}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Spacing unit */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-[var(--color-foreground)]">Spacing Unit</label>
                        <span className="text-xs font-mono text-[var(--color-muted-foreground)]">{theme.spacing_unit}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="text"
                          value={theme.spacing_unit}
                          onChange={(e) => update('spacing_unit', e.target.value)}
                          placeholder="0.25rem"
                          className={cn(
                            'w-32 px-3 py-2 rounded-md text-sm font-mono',
                            'bg-[var(--color-muted)] border border-[var(--color-border)]',
                            'text-[var(--color-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]'
                          )}
                          aria-label="Spacing unit"
                        />
                        <p className="text-xs text-[var(--color-muted-foreground)]">
                          Base spacing unit (e.g. 0.25rem = 4px)
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── ANIMATIONS TAB ── */}
                {activeTab === 'animations' && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="font-heading font-semibold text-[var(--color-foreground)]">Animations</h2>
                      <p className="text-sm text-[var(--color-muted-foreground)] mt-0.5">
                        Control motion preferences globally.
                      </p>
                    </div>

                    {/* Master toggle */}
                    <div className="flex items-center justify-between p-4 rounded-[var(--border-radius)] border border-[var(--color-border)] bg-[var(--color-card)]">
                      <div>
                        <p className="text-sm font-medium text-[var(--color-foreground)]">Enable Animations</p>
                        <p className="text-xs text-[var(--color-muted-foreground)] mt-0.5">
                          Master switch for all motion effects
                        </p>
                      </div>
                      <Toggle
                        checked={theme.animations_enabled === 'true'}
                        onChange={(v) => update('animations_enabled', v ? 'true' : 'false')}
                        label="Enable animations"
                      />
                    </div>

                    <div className={cn('space-y-5', theme.animations_enabled !== 'true' && 'opacity-40 pointer-events-none')}>
                      {/* Duration */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium text-[var(--color-foreground)]">Duration</label>
                          <span className="text-xs font-mono text-[var(--color-muted-foreground)]">{theme.animation_duration}ms</span>
                        </div>
                        <Slider
                          min={100}
                          max={1000}
                          step={50}
                          value={parseInt(theme.animation_duration, 10)}
                          onChange={(v) => update('animation_duration', String(v))}
                          label="Animation duration"
                          unit="ms"
                        />
                      </div>

                      {/* Easing */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-[var(--color-foreground)]">Easing Function</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {EASING_OPTIONS.map(({ label, value }) => (
                            <button
                              key={value}
                              onClick={() => update('animation_easing', value)}
                              className={cn(
                                'text-left px-3 py-2.5 rounded-[var(--border-radius)] text-sm border transition-colors',
                                theme.animation_easing === value
                                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                                  : 'border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:border-[var(--color-primary)]/50'
                              )}
                            >
                              <span className="font-medium">{label}</span>
                              <span className="block text-xs font-mono mt-0.5 opacity-60 truncate">{value}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Test animation */}
                      <div className="space-y-3">
                        <label className="text-sm font-medium text-[var(--color-foreground)]">Test Animation</label>
                        <div className="flex items-center gap-4">
                          <Button variant="outline" size="sm" onClick={testAnimation} silent className="gap-1.5">
                            <Play size={13} /> Test Animation
                          </Button>
                          <div className="flex-1 flex items-center justify-center h-12">
                            <AnimatePresence mode="wait">
                              <motion.div
                                key={animTestKey}
                                initial={{ opacity: 0, scale: 0.6, x: -20 }}
                                animate={{ opacity: 1, scale: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0.6, x: 20 }}
                                transition={{
                                  duration: parseInt(theme.animation_duration, 10) / 1000,
                                  ease: theme.animation_easing as any,
                                }}
                                className="px-4 py-2 rounded-[var(--border-radius)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)] text-sm font-medium"
                              >
                                Animated Element
                              </motion.div>
                            </AnimatePresence>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── SOUNDS TAB ── */}
                {activeTab === 'sounds' && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="font-heading font-semibold text-[var(--color-foreground)]">Sounds & Music</h2>
                      <p className="text-sm text-[var(--color-muted-foreground)] mt-0.5">
                        Configure UI sounds and background music.
                      </p>
                    </div>

                    {/* Sound effects section */}
                    <div className="space-y-4">
                      <h3 className="text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">Sound Effects</h3>

                      {/* Master toggle */}
                      <div className="flex items-center justify-between p-4 rounded-[var(--border-radius)] border border-[var(--color-border)] bg-[var(--color-card)]">
                        <div>
                          <p className="text-sm font-medium text-[var(--color-foreground)]">Enable Sound Effects</p>
                          <p className="text-xs text-[var(--color-muted-foreground)] mt-0.5">UI click, success, error, and check-in sounds</p>
                        </div>
                        <Toggle
                          checked={theme.sounds_enabled === 'true'}
                          onChange={(v) => {
                            update('sounds_enabled', v ? 'true' : 'false')
                            setSoundEnabled(v)
                          }}
                          label="Enable sound effects"
                        />
                      </div>

                      <div className={cn('space-y-4', theme.sounds_enabled !== 'true' && 'opacity-40 pointer-events-none')}>
                        {/* Volume */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-[var(--color-foreground)]">Volume</label>
                            <span className="text-xs font-mono text-[var(--color-muted-foreground)]">
                              {Math.round(parseFloat(theme.sound_volume) * 100)}%
                            </span>
                          </div>
                          <Slider
                            min={0}
                            max={1}
                            step={0.01}
                            value={parseFloat(theme.sound_volume)}
                            onChange={(v) => {
                              update('sound_volume', String(v))
                              setSoundVolume(v)
                            }}
                            label="Sound effects volume"
                          />
                        </div>

                        {/* Per-sound rows */}
                        <div className="rounded-[var(--border-radius)] border border-[var(--color-border)] bg-[var(--color-card)]">
                          <div className="px-4 py-3 border-b border-[var(--color-border)]">
                            <p className="text-xs font-medium text-[var(--color-muted-foreground)] uppercase tracking-wider">Sound Files</p>
                          </div>
                          <div className="px-4">
                            {(
                              [
                                { key: 'sound_click_url' as const,   label: 'Click',    sound: 'click' as const },
                                { key: 'sound_success_url' as const, label: 'Success',  sound: 'success' as const },
                                { key: 'sound_error_url' as const,   label: 'Error',    sound: 'error' as const },
                                { key: 'sound_checkin_url' as const, label: 'Check-in', sound: 'checkin' as const },
                              ] as const
                            ).map(({ key, label, sound }) => (
                              <SoundRow
                                key={key}
                                urlKey={key}
                                label={label}
                                value={theme[key] as string}
                                onUrlChange={(v) => update(key, v)}
                                onPlay={() => playSound(sound)}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Soundtrack section */}
                    <div className="space-y-4">
                      <h3 className="text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">Background Soundtrack</h3>

                      <div className="flex items-center justify-between p-4 rounded-[var(--border-radius)] border border-[var(--color-border)] bg-[var(--color-card)]">
                        <div>
                          <p className="text-sm font-medium text-[var(--color-foreground)]">Enable Soundtrack</p>
                          <p className="text-xs text-[var(--color-muted-foreground)] mt-0.5">
                            Ambient background music for the admin panel
                          </p>
                        </div>
                        <Toggle
                          checked={theme.soundtrack_enabled === 'true'}
                          onChange={(v) => {
                            update('soundtrack_enabled', v ? 'true' : 'false')
                            setSoundtrackEnabled(v)
                          }}
                          label="Enable soundtrack"
                        />
                      </div>

                      <div className={cn('space-y-4', theme.soundtrack_enabled !== 'true' && 'opacity-40 pointer-events-none')}>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-[var(--color-foreground)]">Volume</label>
                            <span className="text-xs font-mono text-[var(--color-muted-foreground)]">
                              {Math.round(parseFloat(theme.soundtrack_volume) * 100)}%
                            </span>
                          </div>
                          <Slider
                            min={0}
                            max={1}
                            step={0.01}
                            value={parseFloat(theme.soundtrack_volume)}
                            onChange={(v) => {
                              update('soundtrack_volume', String(v))
                              setSoundtrackVolume(v)
                            }}
                            label="Soundtrack volume"
                          />
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-[var(--border-radius)] border border-[var(--color-border)] bg-[var(--color-muted)]">
                          <div>
                            <p className="text-sm text-[var(--color-foreground)]">Autoplay on Load</p>
                            <p className="text-xs text-[var(--color-muted-foreground)] mt-0.5">Start music when admin opens the panel</p>
                          </div>
                          <Toggle
                            checked={theme.soundtrack_autoplay === 'true'}
                            onChange={(v) => update('soundtrack_autoplay', v ? 'true' : 'false')}
                            label="Autoplay soundtrack"
                          />
                        </div>

                        {/* URL input */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-[var(--color-foreground)]">Soundtrack URL or File</label>
                          <input
                            type="url"
                            value={theme.soundtrack_url}
                            onChange={(e) => update('soundtrack_url', e.target.value)}
                            onBlur={() => {
                              if (theme.soundtrack_url) {
                                loadSoundtrack(theme.soundtrack_url, false)
                              }
                            }}
                            placeholder="https://example.com/music.mp3 or /sounds/soundtrack.mp3"
                            className={cn(
                              'w-full px-3 py-2 rounded-md text-sm',
                              'bg-[var(--color-muted)] border border-[var(--color-border)]',
                              'text-[var(--color-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]',
                              'placeholder:text-[var(--color-muted-foreground)]'
                            )}
                            aria-label="Soundtrack URL"
                          />
                        </div>

                        {/* Player */}
                        <SoundtrackPlayer
                          onFileChange={(url) => update('soundtrack_url', url)}
                        />
                      </div>
                    </div>
                  </div>
                )}

              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Right: live preview panel */}
        <div className="hidden lg:flex w-80 xl:w-96 border-l border-[var(--color-border)] flex-col bg-[var(--color-background)]">
          <div className="px-4 py-3 border-b border-[var(--color-border)] flex-shrink-0">
            <p className="text-xs uppercase tracking-wider text-[var(--color-muted-foreground)] font-medium">Live Preview</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <ThemePreview theme={theme} />
          </div>
        </div>
      </div>
    </div>
  )
}
