import { create } from 'zustand'

// We use unknown to avoid importing Howl at module level (SSR safety)
type HowlInstance = {
  play: () => number
  pause: () => void
  stop: () => void
  fade: (from: number, to: number, duration: number) => void
  volume: (v?: number) => number
  unload: () => void
  state: () => 'unloaded' | 'loading' | 'loaded'
  playing: () => boolean
  on: (event: string, fn: () => void) => void
}

// ─── Store Interface ───────────────────────────────────────────────────────
interface SoundtrackStore {
  isPlaying: boolean
  volume: number
  url: string | null
  isEnabled: boolean
  howl: HowlInstance | null

  play: () => void
  pause: () => void
  toggle: () => void
  stop: () => void
  setVolume: (volume: number) => void
  setEnabled: (enabled: boolean) => void
  load: (url: string, autoplay?: boolean) => Promise<void>
  unload: () => void
}

const FADE_DURATION = 1500 // ms

// ─── Lazy Howl Creator ─────────────────────────────────────────────────────
async function createSoundtrackHowl(url: string, volume: number): Promise<HowlInstance> {
  const { Howl } = await import('howler')
  return new Howl({
    src: [url],
    volume: 0, // start silent; fade in
    loop: true,
    html5: true, // streaming
    preload: true,
  }) as unknown as HowlInstance
}

// ─── Zustand Store ─────────────────────────────────────────────────────────
export const useSoundtrackStore = create<SoundtrackStore>((set, get) => ({
  isPlaying: false,
  volume: 0.2,
  url: null,
  isEnabled: false,
  howl: null,

  play: () => {
    const { howl, volume, isEnabled } = get()
    if (!isEnabled || !howl) return
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return

    try {
      if (!howl.playing()) {
        howl.play()
        // Fade in
        howl.fade(0, volume, FADE_DURATION)
      }
      set({ isPlaying: true })
    } catch (err) {
      console.warn('[SoundtrackStore] Failed to play:', err)
    }
  },

  pause: () => {
    const { howl, volume } = get()
    if (!howl) return

    try {
      // Fade out then pause
      howl.fade(volume, 0, FADE_DURATION)
      setTimeout(() => {
        if (howl.state() === 'loaded') {
          howl.pause()
        }
      }, FADE_DURATION)
      set({ isPlaying: false })
    } catch (err) {
      console.warn('[SoundtrackStore] Failed to pause:', err)
    }
  },

  toggle: () => {
    const { isPlaying } = get()
    if (isPlaying) {
      get().pause()
    } else {
      get().play()
    }
  },

  stop: () => {
    const { howl } = get()
    if (!howl) return

    try {
      howl.fade(get().volume, 0, 500)
      setTimeout(() => {
        if (howl.state() === 'loaded') howl.stop()
      }, 500)
    } catch {
      // ignore
    }
    set({ isPlaying: false })
  },

  setVolume: (volume: number) => {
    const clamped = Math.max(0, Math.min(1, volume))
    const { howl, isPlaying } = get()
    set({ volume: clamped })

    if (howl && isPlaying) {
      try {
        howl.fade(howl.volume(), clamped, 500)
      } catch {
        // ignore
      }
    }
  },

  setEnabled: (enabled: boolean) => {
    set({ isEnabled: enabled })
    if (!enabled) {
      get().stop()
    }
  },

  load: async (url: string, autoplay = false) => {
    // SSR guard
    if (typeof window === 'undefined') return

    // Unload any existing howl
    get().unload()

    set({ url })

    try {
      const { volume } = get()
      const howl = await createSoundtrackHowl(url, volume)

      howl.on('end', () => {
        // loop is true, so this shouldn't fire — but just in case
        set({ isPlaying: false })
      })

      set({ howl })

      if (autoplay && get().isEnabled) {
        get().play()
      }
    } catch (err) {
      console.warn('[SoundtrackStore] Failed to load soundtrack:', err)
    }
  },

  unload: () => {
    const { howl } = get()
    if (!howl) return

    try {
      howl.unload()
    } catch {
      // ignore
    }
    set({ howl: null, isPlaying: false })
  },
}))

// ─── Selector Helpers ──────────────────────────────────────────────────────
export const selectIsPlaying = (s: SoundtrackStore) => s.isPlaying
export const selectSoundtrackEnabled = (s: SoundtrackStore) => s.isEnabled
export const selectSoundtrackVolume = (s: SoundtrackStore) => s.volume
export const selectSoundtrackToggle = (s: SoundtrackStore) => s.toggle
