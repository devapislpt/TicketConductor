import { create } from 'zustand'
import type { ThemeConfig } from '@/lib/types'

// ─── Default Theme ─────────────────────────────────────────────────────────
const defaultTheme: ThemeConfig = {
  color_primary: '#C9A84C',
  color_primary_foreground: '#0A0A0A',
  color_secondary: '#1E1E1E',
  color_secondary_foreground: '#F0EDE6',
  color_accent: '#C9A84C',
  color_accent_foreground: '#0A0A0A',
  color_background: '#0A0A0A',
  color_foreground: '#F0EDE6',
  color_card: '#141414',
  color_card_foreground: '#F0EDE6',
  color_border: '#2A2A2A',
  color_muted: '#1A1A1A',
  color_muted_foreground: '#8A8A8A',
  color_destructive: '#DC2626',
  color_success: '#16A34A',
  font_heading: 'Cormorant Garamond',
  font_body: 'Inter',
  font_mono: 'JetBrains Mono',
  font_size_base: '16px',
  font_weight_heading: '600',
  line_height_base: '1.6',
  letter_spacing_heading: '0.02em',
  border_radius: '0.5rem',
  spacing_unit: '0.25rem',
  animations_enabled: 'true',
  animation_duration: '200',
  animation_easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  sounds_enabled: 'true',
  sound_volume: '0.5',
  sound_click_url: '/sounds/click.mp3',
  sound_success_url: '/sounds/success.mp3',
  sound_error_url: '/sounds/error.mp3',
  sound_checkin_url: '/sounds/checkin.mp3',
  soundtrack_enabled: 'false',
  soundtrack_url: '/sounds/soundtrack.mp3',
  soundtrack_volume: '0.2',
  soundtrack_autoplay: 'false',
}

// ─── CSS Variable Map ──────────────────────────────────────────────────────
const CSS_VAR_MAP: Record<keyof ThemeConfig, string> = {
  color_primary:             '--color-primary',
  color_primary_foreground:  '--color-primary-foreground',
  color_secondary:           '--color-secondary',
  color_secondary_foreground:'--color-secondary-foreground',
  color_accent:              '--color-accent',
  color_accent_foreground:   '--color-accent-foreground',
  color_background:          '--color-background',
  color_foreground:          '--color-foreground',
  color_card:                '--color-card',
  color_card_foreground:     '--color-card-foreground',
  color_border:              '--color-border',
  color_muted:               '--color-muted',
  color_muted_foreground:    '--color-muted-foreground',
  color_destructive:         '--color-destructive',
  color_success:             '--color-success',
  font_heading:              '--font-heading',
  font_body:                 '--font-body',
  font_mono:                 '--font-mono',
  font_size_base:            '--font-size-base',
  font_weight_heading:       '--font-weight-heading',
  line_height_base:          '--line-height-base',
  letter_spacing_heading:    '--letter-spacing-heading',
  border_radius:             '--border-radius',
  spacing_unit:              '--spacing-unit',
  animations_enabled:        '--animations-enabled-raw',
  animation_duration:        '--animation-duration-ms',
  animation_easing:          '--animation-easing',
  sounds_enabled:            '--sounds-enabled-raw',
  sound_volume:              '--sound-volume-raw',
  sound_click_url:           '--sound-click-url',
  sound_success_url:         '--sound-success-url',
  sound_error_url:           '--sound-error-url',
  sound_checkin_url:         '--sound-checkin-url',
  soundtrack_enabled:        '--soundtrack-enabled-raw',
  soundtrack_url:            '--soundtrack-url',
  soundtrack_volume:         '--soundtrack-volume-raw',
  soundtrack_autoplay:       '--soundtrack-autoplay-raw',
}

// ─── Store Interface ───────────────────────────────────────────────────────
interface ThemeStore {
  theme: ThemeConfig
  isLoaded: boolean
  setTheme: (config: ThemeConfig) => void
  updateKey: <K extends keyof ThemeConfig>(key: K, value: ThemeConfig[K]) => void
  loadFromDB: () => Promise<void>
  applyToDOM: (config: ThemeConfig) => void
}

// ─── Apply to DOM ──────────────────────────────────────────────────────────
function applyThemeToDOM(config: ThemeConfig): void {
  if (typeof document === 'undefined') return

  const root = document.documentElement

  ;(Object.keys(config) as Array<keyof ThemeConfig>).forEach((key) => {
    const cssVar = CSS_VAR_MAP[key]
    if (!cssVar) return

    const value = config[key]

    // Special handling for font families — wrap in quotes for CSS
    if (key === 'font_heading' || key === 'font_body' || key === 'font_mono') {
      root.style.setProperty(cssVar, `'${value}', ${getFontFallback(key)}`)
      // Also set the standard CSS var name
      const standardVar = key === 'font_heading'
        ? '--font-heading'
        : key === 'font_body'
        ? '--font-body'
        : '--font-mono'
      root.style.setProperty(standardVar, `'${value}', ${getFontFallback(key)}`)
    } else if (key === 'animation_duration') {
      root.style.setProperty('--animation-duration', `${value}ms`)
    } else if (key === 'animations_enabled') {
      root.style.setProperty('--animations-enabled', value === 'true' ? '1' : '0')
    } else {
      root.style.setProperty(cssVar, value)
    }
  })
}

function getFontFallback(key: keyof ThemeConfig): string {
  if (key === 'font_heading') return 'Georgia, serif'
  if (key === 'font_body') return 'system-ui, sans-serif'
  return "'Courier New', monospace"
}

// ─── Zustand Store ─────────────────────────────────────────────────────────
export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: defaultTheme,
  isLoaded: false,

  setTheme: (config) => {
    set({ theme: config, isLoaded: true })
    get().applyToDOM(config)
  },

  updateKey: (key, value) => {
    const updated = { ...get().theme, [key]: value }
    set({ theme: updated })
    get().applyToDOM(updated)
  },

  loadFromDB: async () => {
    try {
      const res = await fetch('/api/admin/theme', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to fetch theme')
      const json = await res.json()

      // API returns { data: ThemeConfig } or { data: ThemeSetting[] }
      let config: ThemeConfig
      if (Array.isArray(json.data)) {
        // Convert ThemeSetting[] to ThemeConfig
        config = { ...defaultTheme }
        for (const setting of json.data as Array<{ key: string; value: string }>) {
          if (setting.key in config) {
            (config as Record<string, string>)[setting.key] = setting.value
          }
        }
      } else {
        config = { ...defaultTheme, ...json.data }
      }

      set({ theme: config, isLoaded: true })
      get().applyToDOM(config)
    } catch (err) {
      console.warn('[ThemeStore] Failed to load theme from DB, using defaults:', err)
      set({ isLoaded: true })
      get().applyToDOM(get().theme)
    }
  },

  applyToDOM: (config) => {
    applyThemeToDOM(config)
  },
}))

// ─── Selector Helpers ──────────────────────────────────────────────────────
export const selectTheme = (s: ThemeStore) => s.theme
export const selectIsLoaded = (s: ThemeStore) => s.isLoaded
export const selectAnimationsEnabled = (s: ThemeStore) =>
  s.theme.animations_enabled === 'true'
export const selectSoundsEnabled = (s: ThemeStore) =>
  s.theme.sounds_enabled === 'true'
