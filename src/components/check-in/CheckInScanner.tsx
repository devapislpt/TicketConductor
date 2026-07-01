'use client'

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useTransition,
} from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Camera,
  CameraOff,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Users,
  Clock,
  Scan,
  Mail,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Volume2,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useSoundStore } from '@/lib/stores/sound.store'
import { formatRelative } from '@/lib/utils/format'

// ─── Types ────────────────────────────────────────────────────────────────────
type ScanMode = 'qr' | 'email'

interface CheckInResult {
  success:            boolean
  already_checked_in: boolean
  ticket_id:          string
  recipient_name:     string | null
  recipient_email:    string | null
  event_name:         string | null
  pack_name:          string | null
  checked_in_at:      string | null
}

interface LookupTicket {
  ticket_id:       string
  qr_code:         string | null
  recipient_name:  string | null
  recipient_email: string | null
  status:          string
  event_name:      string | null
  pack_name:       string | null
}

interface RecentCheckin {
  ticket_id:       string
  recipient_name:  string | null
  recipient_email: string | null
  checked_in_at:   string
}

interface Stats {
  total:     number
  checkedIn: number
  remaining: number
}

interface CheckInScannerProps {
  eventId:      string
  eventName:    string
  initialStats: Stats
}

// ─── Corner Bracket Frame ─────────────────────────────────────────────────────
function CornerBrackets({ scanning }: { scanning: boolean }) {
  const c = 'var(--color-primary)'
  const size = 24
  const stroke = 3
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {/* Top-left */}
      <svg className="absolute top-3 left-3" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <path d={`M${stroke} ${size} L${stroke} ${stroke} L${size} ${stroke}`} fill="none" stroke={c} strokeWidth={stroke} strokeLinecap="round" />
      </svg>
      {/* Top-right */}
      <svg className="absolute top-3 right-3" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <path d={`M0 ${stroke} L${size - stroke} ${stroke} L${size - stroke} ${size}`} fill="none" stroke={c} strokeWidth={stroke} strokeLinecap="round" />
      </svg>
      {/* Bottom-left */}
      <svg className="absolute bottom-3 left-3" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <path d={`M${stroke} 0 L${stroke} ${size - stroke} L${size} ${size - stroke}`} fill="none" stroke={c} strokeWidth={stroke} strokeLinecap="round" />
      </svg>
      {/* Bottom-right */}
      <svg className="absolute bottom-3 right-3" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <path d={`M0 ${size - stroke} L${size - stroke} ${size - stroke} L${size - stroke} 0`} fill="none" stroke={c} strokeWidth={stroke} strokeLinecap="round" />
      </svg>

      {/* Scanning line */}
      {scanning && (
        <motion.div
          className="absolute left-6 right-6 h-0.5 rounded-full"
          style={{ background: `linear-gradient(90deg, transparent, ${c}, transparent)` }}
          animate={{ top: ['20%', '80%', '20%'] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </div>
  )
}

// ─── Check-in result overlay ──────────────────────────────────────────────────
function ResultOverlay({
  result,
  onReset,
}: {
  result: CheckInResult | null
  onReset: () => void
}) {
  const isAlready = result?.already_checked_in
  const isSuccess = result?.success && !isAlready

  return (
    <AnimatePresence>
      {result && (
        <motion.div
          key="result"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-label={isSuccess ? 'Check-in successful' : 'Already checked in'}
        >
          <motion.div
            initial={{ scale: 0.8, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className={cn(
              'relative w-full max-w-sm rounded-2xl border p-8 text-center shadow-2xl',
              isSuccess
                ? 'bg-[#0D1F0D] border-[var(--color-success)]'
                : 'bg-[#1F1A0D] border-[var(--color-primary)]',
            )}
          >
            {/* Icon */}
            <motion.div
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 18, delay: 0.1 }}
              className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full"
              style={{
                background: isSuccess
                  ? 'rgba(34, 197, 94, 0.15)'
                  : 'rgba(201, 168, 76, 0.15)',
              }}
            >
              {isSuccess ? (
                <CheckCircle2
                  className="h-12 w-12"
                  style={{ color: 'var(--color-success)' }}
                  aria-hidden="true"
                />
              ) : (
                <AlertCircle
                  className="h-12 w-12 text-[var(--color-primary)]"
                  aria-hidden="true"
                />
              )}
            </motion.div>

            {/* Status text */}
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={cn(
                'text-2xl font-bold tracking-tight',
                isSuccess ? 'text-[var(--color-success)]' : 'text-[var(--color-primary)]',
              )}
            >
              {isSuccess ? 'Checked In!' : 'Already Checked In'}
            </motion.p>

            {/* Attendee info */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-4 space-y-1"
            >
              {result.recipient_name && (
                <p className="text-lg font-semibold text-[var(--color-foreground)]">
                  {result.recipient_name}
                </p>
              )}
              {result.recipient_email && (
                <p className="text-sm text-[var(--color-muted-foreground)]">
                  {result.recipient_email}
                </p>
              )}
              {result.event_name && (
                <p className="mt-2 text-sm font-medium text-[var(--color-primary)]">
                  {result.event_name}
                </p>
              )}
            </motion.div>

            {/* Ticket # */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mt-3 font-mono text-xs text-[var(--color-muted-foreground)]"
            >
              Ticket #{result.ticket_id.slice(0, 8).toUpperCase()}
            </motion.p>

            {/* Auto-reset countdown progress */}
            <motion.div
              className="absolute bottom-0 left-0 h-1 rounded-b-2xl"
              style={{
                background: isSuccess ? 'var(--color-success)' : 'var(--color-primary)',
              }}
              initial={{ width: '100%' }}
              animate={{ width: '0%' }}
              transition={{ duration: 3, ease: 'linear' }}
            />

            {/* Manual dismiss */}
            <button
              onClick={onReset}
              className="mt-6 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] underline transition-colors"
            >
              Tap to dismiss
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Recent check-ins list ────────────────────────────────────────────────────
function RecentCheckins({ items }: { items: RecentCheckin[] }) {
  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-[var(--color-muted-foreground)]">
        No check-ins yet
      </p>
    )
  }
  return (
    <ul className="divide-y divide-[var(--color-border)]">
      {items.map((item, i) => (
        <motion.li
          key={item.ticket_id}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.04 }}
          className="flex items-center gap-3 py-2.5 px-1"
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-success)]/10">
            <CheckCircle2 className="h-3.5 w-3.5 text-[var(--color-success)]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[var(--color-foreground)]">
              {item.recipient_name ?? item.recipient_email ?? 'Guest'}
            </p>
            {item.recipient_email && item.recipient_name && (
              <p className="truncate text-xs text-[var(--color-muted-foreground)]">
                {item.recipient_email}
              </p>
            )}
          </div>
          <time
            className="shrink-0 text-xs text-[var(--color-muted-foreground)]"
            dateTime={item.checked_in_at}
            title={new Date(item.checked_in_at).toLocaleString()}
          >
            {formatRelative(item.checked_in_at)}
          </time>
        </motion.li>
      ))}
    </ul>
  )
}

// ─── Stats panel ──────────────────────────────────────────────────────────────
function StatsPanel({
  stats,
  recentCheckins,
  recentSearch,
  onRecentSearch,
}: {
  stats: Stats
  recentCheckins: RecentCheckin[]
  recentSearch: string
  onRecentSearch: (v: string) => void
}) {
  const pct = stats.total > 0 ? Math.round((stats.checkedIn / stats.total) * 100) : 0

  const filtered = recentSearch
    ? recentCheckins.filter(
        (r) =>
          r.recipient_name?.toLowerCase().includes(recentSearch.toLowerCase()) ||
          r.recipient_email?.toLowerCase().includes(recentSearch.toLowerCase()),
      )
    : recentCheckins

  return (
    <div className="flex flex-col gap-4">
      {/* Counters */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Total',      value: stats.total,     color: 'text-[var(--color-foreground)]' },
          { label: 'Checked In', value: stats.checkedIn, color: 'text-[var(--color-success)]'    },
          { label: 'Remaining',  value: stats.remaining, color: 'text-[var(--color-primary)]'    },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-3 text-center"
          >
            <p className={cn('text-xl font-bold tabular-nums', color)}>{value}</p>
            <p className="mt-0.5 text-[10px] text-[var(--color-muted-foreground)] uppercase tracking-wide">
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-[var(--color-muted-foreground)]">
          <span>Progress</span>
          <span className="font-semibold text-[var(--color-primary)]">{pct}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-muted)]">
          <motion.div
            className="h-full rounded-full bg-[var(--color-primary)]"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Recent check-ins */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2.5">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-foreground)]">
            <Clock className="h-3.5 w-3.5 text-[var(--color-primary)]" />
            Recent Check-Ins
          </div>
          <span className="rounded-full bg-[var(--color-primary)]/10 px-2 py-0.5 text-xs font-medium text-[var(--color-primary)]">
            last {Math.min(recentCheckins.length, 10)}
          </span>
        </div>

        {/* Search within recent */}
        <div className="border-b border-[var(--color-border)] px-3 py-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[var(--color-muted-foreground)]" />
            <input
              type="search"
              placeholder="Search checked-in..."
              value={recentSearch}
              onChange={(e) => onRecentSearch(e.target.value)}
              className="w-full rounded-md bg-[var(--color-muted)] pl-7 pr-3 py-1.5 text-xs text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              aria-label="Search checked-in attendees"
            />
          </div>
        </div>

        <div className="max-h-60 overflow-y-auto px-3">
          <RecentCheckins items={filtered} />
        </div>
      </div>
    </div>
  )
}

// ─── QR Scanner panel ─────────────────────────────────────────────────────────
function QRScannerPanel({
  onDetect,
  isSubmitting,
}: {
  onDetect: (code: string) => void
  isSubmitting: boolean
}) {
  const videoRef         = useRef<HTMLVideoElement>(null)
  const canvasRef        = useRef<HTMLCanvasElement>(null)
  const streamRef        = useRef<MediaStream | null>(null)
  const detectorRef      = useRef<BarcodeDetector | null>(null)
  const animFrameRef     = useRef<number>(0)
  const lastCodeRef      = useRef<string>('')
  const manualInputRef   = useRef<HTMLInputElement>(null)

  const [cameraActive,  setCameraActive]  = useState(false)
  const [cameraError,   setCameraError]   = useState<string | null>(null)
  const [manualCode,    setManualCode]    = useState('')
  const [hasBarcodeAPI, setHasBarcodeAPI] = useState(false)

  // Detect BarcodeDetector API support
  useEffect(() => {
    setHasBarcodeAPI(typeof BarcodeDetector !== 'undefined')
  }, [])

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      setCameraError(null)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraActive(true)

      // Set up BarcodeDetector
      if (hasBarcodeAPI) {
        // @ts-expect-error — BarcodeDetector is not in TS lib yet
        detectorRef.current = new BarcodeDetector({ formats: ['qr_code', 'code_128', 'code_39'] })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Camera access denied'
      setCameraError(msg)
      setCameraActive(false)
    }
  }, [hasBarcodeAPI])

  // Stop camera
  const stopCamera = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraActive(false)
  }, [])

  // Scan loop — runs every animation frame
  useEffect(() => {
    if (!cameraActive) return

    let running = true

    async function tick() {
      if (!running) return

      const video  = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || video.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(tick)
        return
      }

      canvas.width  = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        animFrameRef.current = requestAnimationFrame(tick)
        return
      }
      ctx.drawImage(video, 0, 0)

      // BarcodeDetector path
      if (detectorRef.current) {
        try {
          const barcodes = await detectorRef.current.detect(canvas)
          for (const barcode of barcodes) {
            const raw = barcode.rawValue
            if (raw && raw !== lastCodeRef.current) {
              lastCodeRef.current = raw
              onDetect(raw)
              // Throttle: wait 3 s before accepting another scan
              await new Promise((r) => setTimeout(r, 3000))
              lastCodeRef.current = ''
            }
          }
        } catch {
          // BarcodeDetector threw — ignore individual frame errors
        }
      }

      if (running) animFrameRef.current = requestAnimationFrame(tick)
    }

    animFrameRef.current = requestAnimationFrame(tick)
    return () => {
      running = false
      cancelAnimationFrame(animFrameRef.current)
    }
  }, [cameraActive, onDetect])

  // Auto-start on mount
  useEffect(() => {
    startCamera()
    return () => stopCamera()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const v = manualCode.trim()
    if (v) {
      onDetect(v)
      setManualCode('')
    }
  }

  return (
    <div className="space-y-4">
      {/* Camera viewport */}
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-[var(--color-border)] bg-black">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          muted
          playsInline
          aria-label="Camera feed for QR code scanning"
        />
        {/* Hidden canvas for frame capture */}
        <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

        <CornerBrackets scanning={cameraActive && !isSubmitting} />

        {/* Overlay states */}
        {!cameraActive && !cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 text-center">
            <Camera className="h-10 w-10 text-[var(--color-primary)]" />
            <p className="text-sm text-[var(--color-muted-foreground)]">Starting camera…</p>
          </div>
        )}

        {cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 text-center px-4">
            <CameraOff className="h-10 w-10 text-[var(--color-destructive)]" />
            <p className="text-sm font-medium text-[var(--color-destructive)]">Camera unavailable</p>
            <p className="text-xs text-[var(--color-muted-foreground)]">{cameraError}</p>
            <button
              onClick={startCamera}
              className="mt-2 flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] hover:brightness-110 transition-all"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        )}

        {isSubmitting && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="flex flex-col items-center gap-2">
              <RefreshCw className="h-8 w-8 animate-spin text-[var(--color-primary)]" />
              <p className="text-sm text-white">Processing…</p>
            </div>
          </div>
        )}

        {/* Camera toggle */}
        {cameraActive && (
          <button
            onClick={stopCamera}
            className="absolute bottom-3 right-3 rounded-full bg-black/60 p-2 text-white hover:bg-black/80 transition-colors"
            aria-label="Stop camera"
          >
            <CameraOff className="h-4 w-4" />
          </button>
        )}
        {!cameraActive && !cameraError && (
          <button
            onClick={startCamera}
            className="absolute bottom-3 right-3 rounded-full bg-[var(--color-primary)] p-2 text-[var(--color-primary-foreground)] hover:brightness-110 transition-all"
            aria-label="Start camera"
          >
            <Camera className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* BarcodeDetector warning */}
      {!hasBarcodeAPI && cameraActive && (
        <div className="flex items-start gap-2 rounded-lg border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 px-3 py-2.5 text-xs text-[var(--color-muted-foreground)]">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[var(--color-primary)]" />
          <span>
            Auto-detection not available in this browser. Use the field below to paste or type the QR code value.
          </span>
        </div>
      )}

      {/* Manual QR code entry */}
      <form onSubmit={handleManualSubmit} className="space-y-2">
        <label htmlFor="manual-qr" className="block text-xs font-medium text-[var(--color-muted-foreground)] uppercase tracking-wide">
          Or enter QR code value manually
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Scan className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted-foreground)]" />
            <input
              id="manual-qr"
              ref={manualInputRef}
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Paste QR code value…"
              disabled={isSubmitting}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] pl-9 pr-3 py-2.5 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] disabled:opacity-50 transition"
              aria-label="QR code value"
            />
          </div>
          <button
            type="submit"
            disabled={!manualCode.trim() || isSubmitting}
            className="shrink-0 rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--color-primary-foreground)] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Check In
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Email Lookup panel ───────────────────────────────────────────────────────
function EmailLookupPanel({
  onCheckIn,
  isSubmitting,
}: {
  onCheckIn: (ticketId: string) => void
  isSubmitting: boolean
}) {
  const [query,    setQuery]    = useState('')
  const [results,  setResults]  = useState<LookupTicket[]>([])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [selected, setSelected] = useState<LookupTicket | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced search
  useEffect(() => {
    setSelected(null)
    if (!query.trim() || query.length < 2) {
      setResults([])
      return
    }

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const res  = await fetch(`/api/check-in/lookup?email=${encodeURIComponent(query.trim())}`)
        const json = await res.json()
        if (json.error) throw new Error(json.error)
        setResults(json.data ?? [])
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Lookup failed')
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [query])

  const statusColor = (status: string) => {
    if (status === 'checked_in') return 'text-[var(--color-muted-foreground)] line-through'
    if (status === 'assigned')   return 'text-[var(--color-foreground)]'
    return 'text-[var(--color-muted-foreground)]'
  }

  const statusBadge = (status: string) => {
    if (status === 'checked_in') return 'bg-[var(--color-success)]/10 text-[var(--color-success)]'
    if (status === 'assigned')   return 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
    return 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]'
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="email-search" className="block text-xs font-medium text-[var(--color-muted-foreground)] uppercase tracking-wide mb-2">
          Search by email address
        </label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted-foreground)]" />
          <input
            id="email-search"
            type="email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="attendee@example.com"
            disabled={isSubmitting}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] pl-9 pr-3 py-2.5 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] disabled:opacity-50 transition"
            aria-label="Search by email"
            aria-autocomplete="list"
            aria-controls="email-results"
            aria-expanded={results.length > 0}
          />
          {loading && (
            <RefreshCw className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[var(--color-muted-foreground)]" />
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-[var(--color-destructive)]/30 bg-[var(--color-destructive)]/5 px-3 py-2 text-sm text-[var(--color-destructive)]">
          <XCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Results dropdown */}
      {results.length > 0 && (
        <ul
          id="email-results"
          role="listbox"
          aria-label="Ticket search results"
          className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] overflow-hidden"
        >
          {results.map((ticket) => (
            <li
              key={ticket.ticket_id}
              role="option"
              aria-selected={selected?.ticket_id === ticket.ticket_id}
              onClick={() => ticket.status !== 'checked_in' && setSelected(ticket)}
              className={cn(
                'cursor-pointer px-4 py-3 transition-colors',
                selected?.ticket_id === ticket.ticket_id
                  ? 'bg-[var(--color-primary)]/10'
                  : 'hover:bg-[var(--color-muted)]',
                ticket.status === 'checked_in' && 'cursor-not-allowed opacity-60',
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className={cn('text-sm font-medium truncate', statusColor(ticket.status))}>
                    {ticket.recipient_name ?? ticket.recipient_email ?? 'Unknown'}
                  </p>
                  {ticket.recipient_name && (
                    <p className="truncate text-xs text-[var(--color-muted-foreground)]">
                      {ticket.recipient_email}
                    </p>
                  )}
                  {ticket.pack_name && (
                    <p className="mt-0.5 truncate text-xs text-[var(--color-muted-foreground)]">
                      {ticket.pack_name}
                    </p>
                  )}
                </div>
                <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', statusBadge(ticket.status))}>
                  {ticket.status.replace('_', ' ')}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {query.length >= 2 && !loading && results.length === 0 && !error && (
        <p className="text-center text-sm text-[var(--color-muted-foreground)] py-4">
          No tickets found for &quot;{query}&quot;
        </p>
      )}

      {/* Check-in button */}
      <button
        onClick={() => selected && onCheckIn(selected.ticket_id)}
        disabled={!selected || isSubmitting}
        className="w-full rounded-lg bg-[var(--color-primary)] px-4 py-3 text-sm font-bold text-[var(--color-primary-foreground)] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        aria-disabled={!selected || isSubmitting}
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Processing…
          </span>
        ) : selected ? (
          `Check In ${selected.recipient_name ?? selected.recipient_email ?? 'Ticket'}`
        ) : (
          'Select a ticket above'
        )}
      </button>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function CheckInScanner({ eventId, eventName, initialStats }: CheckInScannerProps) {
  const [mode,          setMode]          = useState<ScanMode>('qr')
  const [result,        setResult]        = useState<CheckInResult | null>(null)
  const [stats,         setStats]         = useState<Stats>(initialStats)
  const [recentCheckins, setRecentCheckins] = useState<RecentCheckin[]>([])
  const [recentSearch,  setRecentSearch]  = useState('')
  const [panelOpen,     setPanelOpen]     = useState(false) // mobile collapsible
  const [isPending,     startTransition]  = useTransition()
  const [isSubmitting,  setIsSubmitting]  = useState(false)

  const { play, loadSounds, isReady: soundReady } = useSoundStore()

  // aria-live region ref
  const announceRef = useRef<HTMLDivElement>(null)

  // Load sounds once
  useEffect(() => {
    if (!soundReady) loadSounds()
  }, [loadSounds, soundReady])

  // Poll stats every 15 s
  useEffect(() => {
    const interval = setInterval(refreshStats, 15_000)
    refreshStats()
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  const refreshStats = useCallback(async () => {
    try {
      const res  = await fetch(`/api/check-in/stats?event_id=${eventId}`)
      const json = await res.json()
      if (json.data) {
        setStats({
          total:     json.data.total_tickets,
          checkedIn: json.data.checked_in,
          remaining: json.data.remaining,
        })
        setRecentCheckins(json.data.recent_checkins ?? [])
      }
    } catch {
      // silently ignore polling errors
    }
  }, [eventId])

  // Announce to screen readers
  const announce = useCallback((msg: string) => {
    if (announceRef.current) {
      announceRef.current.textContent = ''
      // Force re-announcement even for same text
      requestAnimationFrame(() => {
        if (announceRef.current) announceRef.current.textContent = msg
      })
    }
  }, [])

  // Core check-in action
  const performCheckIn = useCallback(
    async (ticketId: string) => {
      if (isSubmitting) return
      setIsSubmitting(true)
      try {
        const res  = await fetch(`/api/check-in/${ticketId}`, { method: 'POST' })
        const json = await res.json()

        if (json.error) {
          announce(`Error: ${json.error}`)
          play('error')
          return
        }

        const data = json.data as CheckInResult
        setResult(data)

        if (data.already_checked_in) {
          announce(
            `Already checked in: ${data.recipient_name ?? data.recipient_email ?? 'Guest'}`
          )
          play('error')
        } else if (data.success) {
          announce(
            `Checked in: ${data.recipient_name ?? data.recipient_email ?? 'Guest'} for ${eventName}`
          )
          play('checkin')
          // Optimistically update stats
          setStats((prev) => ({
            total:     prev.total,
            checkedIn: prev.checkedIn + 1,
            remaining: prev.remaining - 1,
          }))
          // Add to recent list
          if (data.checked_in_at) {
            setRecentCheckins((prev) => [
              {
                ticket_id:       ticketId,
                recipient_name:  data.recipient_name,
                recipient_email: data.recipient_email,
                checked_in_at:   data.checked_in_at!,
              },
              ...prev.slice(0, 9),
            ])
          }
        }

        // Auto-reset after 3 s
        setTimeout(() => {
          setResult(null)
          setIsSubmitting(false)
        }, 3000)
      } catch (e) {
        announce(`Network error: ${e instanceof Error ? e.message : 'Unknown error'}`)
        play('error')
        setIsSubmitting(false)
      }
    },
    [isSubmitting, announce, play, eventName],
  )

  // QR code detected from camera or manual input
  const handleQRDetect = useCallback(
    (code: string) => {
      // Lookup the QR code to get the ticket ID
      startTransition(async () => {
        setIsSubmitting(true)
        try {
          const res  = await fetch(`/api/check-in/lookup?qr_code=${encodeURIComponent(code)}`)
          const json = await res.json()
          if (json.error || !json.data?.length) {
            announce('QR code not found — no matching ticket')
            play('error')
            setIsSubmitting(false)
            return
          }
          await performCheckIn(json.data[0].ticket_id)
        } catch {
          announce('Failed to look up QR code')
          play('error')
          setIsSubmitting(false)
        }
      })
    },
    [announce, performCheckIn, play, startTransition],
  )

  const resetResult = useCallback(() => {
    setResult(null)
    setIsSubmitting(false)
  }, [])

  return (
    <>
      {/* ── WCAG AAA: Screen reader live region ───────────────────── */}
      <div
        ref={announceRef}
        role="status"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      />

      {/* ── Result overlay ────────────────────────────────────────── */}
      <ResultOverlay result={result} onReset={resetResult} />

      {/* ── Main layout ───────────────────────────────────────────── */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">

        {/* ── Scanner column ────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Mode toggle */}
          <div
            role="tablist"
            aria-label="Check-in mode"
            className="flex rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-1 gap-1"
          >
            {([ 'qr', 'email' ] as ScanMode[]).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                aria-controls={`panel-${m}`}
                onClick={() => setMode(m)}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all',
                  mode === m
                    ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)] shadow-sm'
                    : 'text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]',
                )}
              >
                {m === 'qr' ? (
                  <><Scan className="h-4 w-4" aria-hidden="true" /> QR Scan</>
                ) : (
                  <><Mail className="h-4 w-4" aria-hidden="true" /> Email Lookup</>
                )}
              </button>
            ))}
          </div>

          {/* Panel */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <div id="panel-qr" role="tabpanel" hidden={mode !== 'qr'}>
              <QRScannerPanel
                onDetect={handleQRDetect}
                isSubmitting={isSubmitting || isPending}
              />
            </div>
            <div id="panel-email" role="tabpanel" hidden={mode !== 'email'}>
              <EmailLookupPanel
                onCheckIn={performCheckIn}
                isSubmitting={isSubmitting}
              />
            </div>
          </div>

          {/* Sound indicator */}
          <div className="flex items-center gap-1.5 text-xs text-[var(--color-muted-foreground)]">
            <Volume2 className="h-3 w-3 text-[var(--color-primary)]" />
            <span>Audio feedback enabled — check-in sounds will play automatically</span>
          </div>
        </div>

        {/* ── Stats panel — desktop sidebar / mobile collapsible ──── */}
        <div className="lg:w-80 xl:w-96">
          {/* Mobile: collapsible toggle */}
          <button
            className="flex w-full items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-sm font-semibold text-[var(--color-foreground)] lg:hidden"
            onClick={() => setPanelOpen((o) => !o)}
            aria-expanded={panelOpen}
            aria-controls="stats-panel"
          >
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4 text-[var(--color-primary)]" />
              Check-In Stats
              <span className="ml-1 rounded-full bg-[var(--color-success)]/10 px-2 py-0.5 text-xs text-[var(--color-success)] font-bold">
                {stats.checkedIn}/{stats.total}
              </span>
            </span>
            {panelOpen ? (
              <ChevronUp className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            )}
          </button>

          {/* Panel body */}
          <div
            id="stats-panel"
            className={cn(
              'space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4',
              'lg:block',
              panelOpen ? 'mt-2 block' : 'hidden',
            )}
          >
            {/* Desktop header */}
            <div className="hidden lg:flex items-center gap-2 border-b border-[var(--color-border)] pb-3 mb-1">
              <Users className="h-4 w-4 text-[var(--color-primary)]" />
              <h2 className="font-semibold text-[var(--color-foreground)]">Check-In Stats</h2>
            </div>

            <StatsPanel
              stats={stats}
              recentCheckins={recentCheckins}
              recentSearch={recentSearch}
              onRecentSearch={setRecentSearch}
            />

            {/* Manual refresh */}
            <button
              onClick={() => startTransition(refreshStats)}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] py-2 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-muted)] transition-colors"
              aria-label="Refresh statistics"
            >
              <RefreshCw className={cn('h-3 w-3', isPending && 'animate-spin')} aria-hidden="true" />
              Refresh
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
