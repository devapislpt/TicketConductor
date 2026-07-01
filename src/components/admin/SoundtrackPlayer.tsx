'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play,
  Pause,
  Square,
  Volume2,
  VolumeX,
  Upload,
  Music,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useSoundtrackStore } from '@/lib/stores/soundtrack.store'
import { Button } from '@/components/ui/button'

interface SoundtrackPlayerProps {
  compact?: boolean
  className?: string
  onFileChange?: (url: string) => void
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function SoundtrackPlayer({
  compact = false,
  className,
  onFileChange,
}: SoundtrackPlayerProps) {
  const {
    isPlaying,
    volume,
    url,
    isEnabled,
    howl,
    toggle,
    stop,
    setVolume,
    load,
  } = useSoundtrackStore()

  const [isMuted, setIsMuted] = useState(false)
  const [prevVolume, setPrevVolume] = useState(volume)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [trackName, setTrackName] = useState<string>('')

  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (url) {
      const parts = url.split('/')
      const filename = parts[parts.length - 1]
      setTrackName(filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '))
    } else {
      setTrackName('')
    }
  }, [url])

  useEffect(() => {
    if (isPlaying && howl) {
      progressIntervalRef.current = setInterval(() => {
        try {
          const seek = (howl as any).seek?.() ?? 0
          const dur = (howl as any).duration?.() ?? 0
          const seekNum = typeof seek === 'number' ? seek : 0
          const durNum = typeof dur === 'number' ? dur : 0
          setCurrentTime(seekNum)
          setDuration(durNum)
          setProgress(durNum > 0 ? (seekNum / durNum) * 100 : 0)
        } catch { /* ignore */ }
      }, 250)
    } else {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
      if (!isPlaying) {
        setProgress(0)
        setCurrentTime(0)
      }
    }
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
    }
  }, [isPlaying, howl])

  const handleMuteToggle = useCallback(() => {
    if (isMuted) {
      setVolume(prevVolume)
      setIsMuted(false)
    } else {
      setPrevVolume(volume)
      setVolume(0)
      setIsMuted(true)
    }
  }, [isMuted, volume, prevVolume, setVolume])

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      setIsLoading(true)
      try {
        const objectUrl = URL.createObjectURL(file)
        setTrackName(file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '))
        await load(objectUrl, false)
        onFileChange?.(objectUrl)
      } catch (err) {
        console.error('[SoundtrackPlayer] File load error:', err)
      } finally {
        setIsLoading(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    },
    [load, onFileChange]
  )

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!howl || duration === 0) return
      const rect = e.currentTarget.getBoundingClientRect()
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      try {
        ;(howl as any).seek?.(pct * duration)
        setProgress(pct * 100)
        setCurrentTime(pct * duration)
      } catch { /* ignore */ }
    },
    [howl, duration]
  )

  const sliderStyle: React.CSSProperties = {
    background: `linear-gradient(to right, var(--color-primary) 0%, var(--color-primary) ${(isMuted ? 0 : volume) * 100}%, var(--color-border) ${(isMuted ? 0 : volume) * 100}%, var(--color-border) 100%)`,
  }

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <button
          onClick={toggle}
          disabled={!isEnabled || !url}
          className={cn(
            'flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center',
            'bg-[var(--color-primary)]/10 hover:bg-[var(--color-primary)]/20',
            'text-[var(--color-primary)] transition-colors duration-150',
            'disabled:opacity-40 disabled:cursor-not-allowed'
          )}
          aria-label={isPlaying ? 'Pause soundtrack' : 'Play soundtrack'}
        >
          <AnimatePresence mode="wait" initial={false}>
            {isLoading ? (
              <motion.span key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Loader2 size={13} className="animate-spin" />
              </motion.span>
            ) : isPlaying ? (
              <motion.span key="pause" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
                <Pause size={13} />
              </motion.span>
            ) : (
              <motion.span key="play" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
                <Play size={13} className="translate-x-[1px]" />
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-xs text-[var(--color-muted-foreground)] truncate">
            {trackName || 'No track loaded'}
          </p>
          {isPlaying && (
            <div className="mt-0.5 h-0.5 bg-[var(--color-border)] rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-[var(--color-primary)] rounded-full"
                style={{ width: `${progress}%` }}
                transition={{ duration: 0.25 }}
              />
            </div>
          )}
        </div>

        <button
          onClick={handleMuteToggle}
          className="flex-shrink-0 text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors"
          aria-label={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted || volume === 0 ? <VolumeX size={13} /> : <Volume2 size={13} />}
        </button>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-[var(--border-radius)] border border-[var(--color-border)]',
        'bg-[var(--color-card)] p-4 space-y-4',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <Music size={16} className="text-[var(--color-primary)] flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--color-foreground)] truncate">
            {trackName || 'No track loaded'}
          </p>
          {duration > 0 && (
            <p className="text-xs text-[var(--color-muted-foreground)]">
              {formatTime(currentTime)} / {formatTime(duration)}
            </p>
          )}
        </div>
        {isLoading && <Loader2 size={15} className="animate-spin text-[var(--color-primary)]" />}
      </div>

      {/* Progress bar */}
      <div
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Playback progress"
        onClick={handleProgressClick}
        className={cn(
          'relative h-2 rounded-full bg-[var(--color-border)] overflow-hidden',
          url && duration > 0 ? 'cursor-pointer' : 'cursor-default'
        )}
      >
        <motion.div
          className="absolute inset-y-0 left-0 bg-[var(--color-primary)] rounded-full"
          style={{ width: `${progress}%` }}
          transition={{ duration: 0.25 }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <Button
          size="icon"
          variant="default"
          onClick={toggle}
          disabled={!isEnabled || !url}
          silent
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className="w-9 h-9"
        >
          <AnimatePresence mode="wait" initial={false}>
            {isLoading ? (
              <motion.span key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Loader2 size={15} className="animate-spin" />
              </motion.span>
            ) : isPlaying ? (
              <motion.span key="pause" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
                <Pause size={15} />
              </motion.span>
            ) : (
              <motion.span key="play" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
                <Play size={15} className="translate-x-[1px]" />
              </motion.span>
            )}
          </AnimatePresence>
        </Button>

        <Button
          size="icon"
          variant="ghost"
          onClick={stop}
          disabled={!url}
          silent
          aria-label="Stop"
          className="w-8 h-8"
        >
          <Square size={13} />
        </Button>

        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={handleMuteToggle}
            className="text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors flex-shrink-0"
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted || volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>

          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={isMuted ? 0 : volume}
            onChange={(e) => {
              const v = parseFloat(e.target.value)
              setVolume(v)
              if (v > 0 && isMuted) setIsMuted(false)
            }}
            style={sliderStyle}
            aria-label="Volume"
            className="w-24 h-1.5 appearance-none rounded-full cursor-pointer accent-[var(--color-primary)]"
          />
          <span className="text-xs text-[var(--color-muted-foreground)] w-8 text-right">
            {Math.round((isMuted ? 0 : volume) * 100)}%
          </span>
        </div>
      </div>

      {/* Upload row */}
      <div className="flex items-center gap-2 pt-2 border-t border-[var(--color-border)]">
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleFileChange}
          aria-label="Upload audio file"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          silent
          className="gap-1.5"
        >
          <Upload size={13} />
          Upload Track
        </Button>
        <p className="text-xs text-[var(--color-muted-foreground)]">
          MP3, WAV, OGG supported
        </p>
      </div>
    </div>
  )
}
