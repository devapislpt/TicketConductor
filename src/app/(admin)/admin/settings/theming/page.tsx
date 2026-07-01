import { Suspense } from 'react'
import { createAdminClient } from '@/lib/supabase/server'
import { ThemingEditor } from '@/components/admin/ThemingEditor'
import type { ThemeConfig } from '@/lib/types'
import { Loader2 } from 'lucide-react'

// Default theme fallback — mirrors theme.store defaults
const DEFAULT_THEME: ThemeConfig = {
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

async function fetchThemeConfig(): Promise<ThemeConfig> {
  try {
    const adminSupa = createAdminClient()
    const { data, error } = await adminSupa
      .from('theme_settings')
      .select('key, value')

    if (error) throw error

    const config = { ...DEFAULT_THEME }
    for (const row of data ?? []) {
      if (row.key in config) {
        ;(config as Record<string, string>)[row.key as string] = row.value as string
      }
    }
    return config
  } catch (err) {
    console.warn('[theming/page] Failed to load theme from DB, using defaults:', err)
    return DEFAULT_THEME
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export const metadata = {
  title: 'Theming | Settings | FallCon Ticket Conductor',
}

export default async function ThemingPage() {
  const initialConfig = await fetchThemeConfig()

  return (
    <div className="flex flex-col h-[calc(100vh-var(--admin-nav-height,64px))] overflow-hidden">
      <Suspense
        fallback={
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={24} className="animate-spin text-[var(--color-primary)]" />
          </div>
        }
      >
        <ThemingEditor initialConfig={initialConfig} />
      </Suspense>
    </div>
  )
}
