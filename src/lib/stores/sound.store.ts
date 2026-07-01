import { create } from 'zustand'

// ─── Types ─────────────────────────────────────────────────────────────────
export type SoundName = 'click' | 'success' | 'error' | 'checkin'

interface SoundConfig {
  url: string
  volume?: number
  sprite?: Record<string, [number, number]>
}

// We use `unknown` here to avoid importing Howl at module level (SSR safety)
type HowlInstance = {
  play: () => void
  volume: (v: number) => void
  unload: () => void
  state: () => string
}

interface SoundStore {
  enabled: boolean
  volume: number
  sounds: Record<string, HowlInstance>
  isReady: boolean

  play: (name: SoundName) => void
  setEnabled: (enabled: boolean) => void
  setVolume: (volume: number) => void
  loadSounds: (config: Partial<Record<SoundName, SoundConfig>>) => Promise<void>
  unloadAll: () => void
}

// ─── Default Sound Config ──────────────────────────────────────────────────
const DEFAULT_SOUNDS: Record<SoundName, SoundConfig> = {
  click:   { url: '/sounds/click.mp3',   volume: 0.4 },
  success: { url: '/sounds/success.mp3', volume: 0.6 },
  error:   { url: '/sounds/error.mp3',   volume: 0.5 },
  checkin: { url: '/sounds/checkin.mp3', volume: 0.7 },
}

// ─── Lazy Howler Loader ────────────────────────────────────────────────────
async function createHowl(config: SoundConfig, masterVolume: number): Promise<HowlInstance> {
  // Dynamic import to avoid SSR issues
  const { Howl } = await import('howler')
  return new Howl({
    src: [config.url],
    volume: (config.volume ?? 0.5) * masterVolume,
    preload: true,
    html5: false,
  }) as unknown as HowlInstance
}

// ─── Zustand Store ─────────────────────────────────────────────────────────
export const useSoundStore = create<SoundStore>((set, get) => ({
  enabled: true,
  volume: 0.5,
  sounds: {},
  isReady: false,

  play: (name: SoundName) => {
    const { enabled, sounds } = get()

    // Guard: sounds disabled
    if (!enabled) return

    // Guard: document not visible (tab in background)
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return

    const sound = sounds[name]
    if (!sound) {
      console.warn(`[SoundStore] Sound "${name}" not loaded`)
      return
    }

    try {
      sound.play()
    } catch (err) {
      console.warn(`[SoundStore] Failed to play "${name}":`, err)
    }
  },

  setEnabled: (enabled: boolean) => {
    set({ enabled })
  },

  setVolume: (volume: number) => {
    const clamped = Math.max(0, Math.min(1, volume))
    set({ volume: clamped })

    // Update all loaded sounds' volume
    const { sounds } = get()
    Object.values(sounds).forEach((sound) => {
      try {
        sound.volume(clamped)
      } catch {
        // ignore
      }
    })
  },

  loadSounds: async (config: Partial<Record<SoundName, SoundConfig>> = {}) => {
    // SSR guard
    if (typeof window === 'undefined') return

    const merged = { ...DEFAULT_SOUNDS, ...config }
    const { volume } = get()
    const loaded: Record<string, HowlInstance> = {}

    // Unload existing sounds first
    get().unloadAll()

    await Promise.allSettled(
      (Object.entries(merged) as Array<[SoundName, SoundConfig]>).map(async ([name, cfg]) => {
        try {
          loaded[name] = await createHowl(cfg, volume)
        } catch (err) {
          console.warn(`[SoundStore] Failed to load sound "${name}":`, err)
        }
      })
    )

    set({ sounds: loaded, isReady: true })
  },

  unloadAll: () => {
    const { sounds } = get()
    Object.values(sounds).forEach((sound) => {
      try {
        sound.unload()
      } catch {
        // ignore
      }
    })
    set({ sounds: {}, isReady: false })
  },
}))

// ─── Selector Helpers ──────────────────────────────────────────────────────
export const selectSoundEnabled = (s: SoundStore) => s.enabled
export const selectSoundVolume = (s: SoundStore) => s.volume
export const selectSoundReady = (s: SoundStore) => s.isReady
export const selectPlay = (s: SoundStore) => s.play
