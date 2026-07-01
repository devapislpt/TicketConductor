'use client'

import { useEffect, useRef } from 'react'
import { useThemeStore } from '@/lib/stores/theme.store'
import { useSoundStore } from '@/lib/stores/sound.store'
import { useSoundtrackStore } from '@/lib/stores/soundtrack.store'

// ─── Props ─────────────────────────────────────────────────────────────────
interface ThemeProviderProps {
  children: React.ReactNode
}

// ─── Google Fonts Loader ───────────────────────────────────────────────────
function loadGoogleFont(families: string[]): void {
  if (typeof document === 'undefined') return

  const existing = document.getElementById('fallcon-google-fonts')
  if (existing) existing.remove()

  const encodedFamilies = families
    .map((f) => {
      const name = f.replace(/ /g, '+')
      return `family=${name}:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400`
    })
    .join('&')

  const link = document.createElement('link')
  link.id = 'fallcon-google-fonts'
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?${encodedFamilies}&display=swap`
  document.head.appendChild(link)
}

// ─── Preconnect Helper ─────────────────────────────────────────────────────
function ensureGoogleFontsPreconnect(): void {
  if (typeof document === 'undefined') return
  if (document.querySelector('link[href="https://fonts.googleapis.com"]')) return

  const preconnect1 = document.createElement('link')
  preconnect1.rel = 'preconnect'
  preconnect1.href = 'https://fonts.googleapis.com'

  const preconnect2 = document.createElement('link')
  preconnect2.rel = 'preconnect'
  preconnect2.href = 'https://fonts.gstatic.com'
  preconnect2.crossOrigin = 'anonymous'

  document.head.prepend(preconnect2)
  document.head.prepend(preconnect1)
}

// ─── Component ─────────────────────────────────────────────────────────────
export function ThemeProvider({ children }: ThemeProviderProps) {
  const loadFromDB = useThemeStore((s) => s.loadFromDB)
  const theme = useThemeStore((s) => s.theme)
  const isLoaded = useThemeStore((s) => s.isLoaded)

  const loadSounds = useSoundStore((s) => s.loadSounds)
  const setSoundEnabled = useSoundStore((s) => s.setEnabled)
  const setSoundVolume = useSoundStore((s) => s.setVolume)

  const loadSoundtrack = useSoundtrackStore((s) => s.load)
  const setSoundtrackEnabled = useSoundtrackStore((s) => s.setEnabled)
  const setSoundtrackVolume = useSoundtrackStore((s) => s.setVolume)

  const reducedMotion = useRef(false)
  const initialized = useRef(false)

  // Detect reduced motion preference
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    reducedMotion.current = mq.matches

    const handler = (e: MediaQueryListEvent) => {
      reducedMotion.current = e.matches
      if (e.matches) {
        document.documentElement.style.setProperty('--animations-enabled', '0')
        document.documentElement.style.setProperty('--animation-duration', '0ms')
      } else {
        const animEnabled = theme.animations_enabled === 'true'
        document.documentElement.style.setProperty('--animations-enabled', animEnabled ? '1' : '0')
        document.documentElement.style.setProperty('--animation-duration', `${theme.animation_duration}ms`)
      }
    }

    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme.animations_enabled, theme.animation_duration])

  // Load theme from server on mount
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    ensureGoogleFontsPreconnect()
    loadFromDB()
  }, [loadFromDB])

  // Apply font settings when theme loads
  useEffect(() => {
    if (!isLoaded) return

    const families = [
      theme.font_heading || 'Cormorant Garamond',
      theme.font_body || 'Inter',
    ].filter((f, i, arr) => arr.indexOf(f) === i) // deduplicate

    // JetBrains Mono always loaded
    if (!families.includes('JetBrains Mono')) {
      families.push('JetBrains Mono')
    }

    loadGoogleFont(families)
  }, [isLoaded, theme.font_heading, theme.font_body])

  // Configure sounds when theme loads
  useEffect(() => {
    if (!isLoaded) return

    const soundsEnabled = theme.sounds_enabled === 'true'
    const volume = parseFloat(theme.sound_volume) || 0.5

    setSoundEnabled(soundsEnabled)
    setSoundVolume(volume)

    if (soundsEnabled) {
      loadSounds({
        click:   { url: theme.sound_click_url,   volume: 0.4 },
        success: { url: theme.sound_success_url, volume: 0.6 },
        error:   { url: theme.sound_error_url,   volume: 0.5 },
        checkin: { url: theme.sound_checkin_url, volume: 0.7 },
      })
    }
  }, [
    isLoaded,
    theme.sounds_enabled,
    theme.sound_volume,
    theme.sound_click_url,
    theme.sound_success_url,
    theme.sound_error_url,
    theme.sound_checkin_url,
    loadSounds,
    setSoundEnabled,
    setSoundVolume,
  ])

  // Configure soundtrack when theme loads
  useEffect(() => {
    if (!isLoaded) return

    const soundtrackEnabled = theme.soundtrack_enabled === 'true'
    const volume = parseFloat(theme.soundtrack_volume) || 0.2
    const autoplay = theme.soundtrack_autoplay === 'true'

    setSoundtrackEnabled(soundtrackEnabled)
    setSoundtrackVolume(volume)

    if (soundtrackEnabled && theme.soundtrack_url) {
      loadSoundtrack(theme.soundtrack_url, autoplay && !reducedMotion.current)
    }
  }, [
    isLoaded,
    theme.soundtrack_enabled,
    theme.soundtrack_url,
    theme.soundtrack_volume,
    theme.soundtrack_autoplay,
    loadSoundtrack,
    setSoundtrackEnabled,
    setSoundtrackVolume,
  ])

  return <>{children}</>
}

export default ThemeProvider
