'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, Printer, RefreshCw, QrCode, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────
interface TicketQRCodeProps {
  /** The raw value to encode — typically the ticket's qr_code field */
  value: string
  /** Attendee's name */
  recipientName:  string | null
  /** Event name */
  eventName:      string | null
  /** Pack / order name */
  packName?:      string | null
  /** Ticket UUID (shown as short ID below) */
  ticketId:       string
  /** Optional additional className on the card wrapper */
  className?:     string
}

// ─── Component ────────────────────────────────────────────────────────────────
export function TicketQRCode({
  value,
  recipientName,
  eventName,
  packName,
  ticketId,
  className,
}: TicketQRCodeProps) {
  const canvasRef      = useRef<HTMLCanvasElement>(null)
  const [dataUrl,      setDataUrl]      = useState<string | null>(null)
  const [generating,   setGenerating]   = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [justDownloaded, setJustDownloaded] = useState(false)

  // ── Generate QR code client-side via qrcode package ────────────────────
  const generate = useCallback(async () => {
    if (!value) {
      setError('No QR code value available for this ticket.')
      setGenerating(false)
      return
    }

    setGenerating(true)
    setError(null)

    try {
      // Dynamic import to avoid SSR issues (qrcode uses browser APIs)
      const QRCode = (await import('qrcode')).default

      // Render to a hidden canvas so we can read back a data URL
      const canvas = canvasRef.current
      if (!canvas) throw new Error('Canvas not available')

      await QRCode.toCanvas(canvas, value, {
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 400,
        color: {
          dark:  '#C9A84C',  // gold modules
          light: '#0A0A0A', // near-black background
        },
      })

      const url = canvas.toDataURL('image/png')
      setDataUrl(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate QR code')
    } finally {
      setGenerating(false)
    }
  }, [value])

  useEffect(() => {
    generate()
  }, [generate])

  // ── Download PNG ──────────────────────────────────────────────────────
  const handleDownload = () => {
    if (!dataUrl) return

    const name     = recipientName ?? 'ticket'
    const event    = eventName     ?? 'event'
    const slug     = `${name}-${event}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)
    const filename = `ticket-qr-${slug}-${ticketId.slice(0, 8)}.png`

    const link    = document.createElement('a')
    link.href     = dataUrl
    link.download = filename
    link.click()

    setJustDownloaded(true)
    setTimeout(() => setJustDownloaded(false), 2000)
  }

  // ── Print ─────────────────────────────────────────────────────────────
  const handlePrint = () => {
    if (!dataUrl) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Ticket — ${recipientName ?? ''}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&family=Inter:wght@400;500&display=swap');
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              background: #0A0A0A;
              color: #F5F0E8;
              font-family: 'Inter', sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              padding: 2rem;
            }
            .card {
              border: 2px solid #C9A84C;
              border-radius: 16px;
              padding: 2rem;
              max-width: 360px;
              width: 100%;
              text-align: center;
            }
            .event-name {
              font-family: 'Playfair Display', serif;
              font-size: 1.1rem;
              color: #C9A84C;
              letter-spacing: 0.05em;
              margin-bottom: 1.5rem;
            }
            .qr-img {
              width: 260px;
              height: 260px;
              border-radius: 8px;
              margin: 0 auto 1.5rem;
              display: block;
            }
            .name {
              font-size: 1.2rem;
              font-weight: 600;
              color: #F5F0E8;
              margin-bottom: 0.25rem;
            }
            .pack {
              font-size: 0.8rem;
              color: #9CA3AF;
              margin-bottom: 0.5rem;
            }
            .ticket-id {
              font-family: monospace;
              font-size: 0.75rem;
              color: #6B7280;
              margin-top: 1rem;
            }
            .divider {
              border: none;
              border-top: 1px solid #2A2A2A;
              margin: 1rem 0;
            }
            @media print {
              body { background: white; color: black; }
              .card { border-color: #000; }
              .event-name { color: #000; }
              .name { color: #000; }
            }
          </style>
        </head>
        <body>
          <div class="card">
            ${eventName ? `<p class="event-name">${eventName}</p>` : ''}
            <img class="qr-img" src="${dataUrl}" alt="QR code for ${recipientName ?? 'ticket'}" />
            <hr class="divider" />
            ${recipientName ? `<p class="name">${recipientName}</p>` : ''}
            ${packName     ? `<p class="pack">${packName}</p>`       : ''}
            <p class="ticket-id">#${ticketId.slice(0, 8).toUpperCase()}</p>
          </div>
          <script>window.onload = () => { window.print(); window.close(); }<\/script>
        </body>
      </html>
    `)
    win.document.close()
  }

  // ── Short display ID ──────────────────────────────────────────────────
  const shortId = ticketId.slice(0, 8).toUpperCase()

  return (
    <div
      className={cn(
        // Card shell
        'group relative flex flex-col items-center rounded-2xl overflow-hidden',
        'border border-[var(--color-primary)]/40 bg-[var(--color-card)]',
        'shadow-[0_0_40px_rgba(201,168,76,0.08)]',
        'transition-shadow hover:shadow-[0_0_60px_rgba(201,168,76,0.16)]',
        'print:shadow-none print:border-2 print:border-[#C9A84C] print:rounded-2xl',
        className,
      )}
      aria-label={`QR code ticket for ${recipientName ?? 'attendee'}`}
    >
      {/* ── Top accent bar ──────────────────────────────────────────── */}
      <div
        className="h-1 w-full"
        style={{
          background: 'linear-gradient(90deg, transparent, #C9A84C 30%, #C9A84C 70%, transparent)',
        }}
        aria-hidden="true"
      />

      {/* ── Event name header ───────────────────────────────────────── */}
      {eventName && (
        <div className="w-full px-6 pt-5 pb-2 text-center">
          <p
            className="text-sm font-semibold uppercase tracking-[0.15em] text-[var(--color-primary)]"
            aria-label={`Event: ${eventName}`}
          >
            {eventName}
          </p>
        </div>
      )}

      {/* ── QR code display ─────────────────────────────────────────── */}
      <div className="relative px-6 py-4 flex items-center justify-center">
        {/* Hidden canvas where qrcode renders */}
        <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

        {/* States: generating / error / ready */}
        <AnimatePresence mode="wait">
          {generating && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex h-56 w-56 flex-col items-center justify-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)]"
              aria-label="Generating QR code"
              aria-busy="true"
            >
              <RefreshCw className="h-8 w-8 animate-spin text-[var(--color-primary)]" aria-hidden="true" />
              <p className="text-xs text-[var(--color-muted-foreground)]">Generating…</p>
            </motion.div>
          )}

          {!generating && error && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex h-56 w-56 flex-col items-center justify-center gap-3 rounded-xl border border-[var(--color-destructive)]/30 bg-[var(--color-destructive)]/5 p-4 text-center"
              role="alert"
            >
              <AlertCircle className="h-8 w-8 text-[var(--color-destructive)]" aria-hidden="true" />
              <p className="text-xs text-[var(--color-destructive)]">{error}</p>
              <button
                onClick={generate}
                className="mt-1 rounded-md bg-[var(--color-destructive)]/10 px-3 py-1.5 text-xs text-[var(--color-destructive)] hover:bg-[var(--color-destructive)]/20 transition-colors"
              >
                Retry
              </button>
            </motion.div>
          )}

          {!generating && !error && dataUrl && (
            <motion.div
              key="qr"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              className="relative"
            >
              {/* Luxury corner brackets */}
              <div className="pointer-events-none absolute inset-0 z-10" aria-hidden="true">
                {[
                  'top-0 left-0 border-t-2 border-l-2 rounded-tl-lg',
                  'top-0 right-0 border-t-2 border-r-2 rounded-tr-lg',
                  'bottom-0 left-0 border-b-2 border-l-2 rounded-bl-lg',
                  'bottom-0 right-0 border-b-2 border-r-2 rounded-br-lg',
                ].map((cls, i) => (
                  <div
                    key={i}
                    className={cn('absolute h-5 w-5 border-[var(--color-primary)]', cls)}
                  />
                ))}
              </div>

              {/* QR image */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={dataUrl}
                alt={`QR code for ${recipientName ?? 'ticket'} — scan to check in`}
                className="h-52 w-52 rounded-lg object-contain"
                style={{ imageRendering: 'pixelated' }}
              />

              {/* Centre watermark badge */}
              <div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0A0A0A] p-1.5 shadow-lg"
                aria-hidden="true"
              >
                <QrCode className="h-5 w-5 text-[var(--color-primary)]" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Divider ──────────────────────────────────────────────────── */}
      <div className="w-full px-6">
        <div
          className="h-px w-full"
          style={{
            background: 'linear-gradient(90deg, transparent, var(--color-border) 20%, var(--color-border) 80%, transparent)',
          }}
          aria-hidden="true"
        />
      </div>

      {/* ── Ticket info ───────────────────────────────────────────────── */}
      <div className="w-full px-6 py-4 text-center space-y-1">
        {recipientName && (
          <p className="text-base font-bold text-[var(--color-foreground)] tracking-tight">
            {recipientName}
          </p>
        )}
        {packName && (
          <p className="text-sm text-[var(--color-muted-foreground)]">{packName}</p>
        )}
        <p
          className="font-mono text-xs text-[var(--color-muted-foreground)] tracking-wider mt-1"
          aria-label={`Ticket number ${shortId}`}
        >
          #{shortId}
        </p>
      </div>

      {/* ── Action buttons ────────────────────────────────────────────── */}
      <div className="w-full px-6 pb-5 flex gap-2 print:hidden" aria-label="Ticket actions">
        <button
          onClick={handleDownload}
          disabled={!dataUrl || generating}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5',
            'text-sm font-semibold transition-all',
            'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]',
            'hover:brightness-110 active:brightness-90',
            'disabled:opacity-40 disabled:cursor-not-allowed',
          )}
          aria-label="Download QR code as PNG"
        >
          <AnimatePresence mode="wait">
            {justDownloaded ? (
              <motion.span
                key="done"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2"
              >
                ✓ Saved
              </motion.span>
            ) : (
              <motion.span
                key="download"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Download
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        <button
          onClick={handlePrint}
          disabled={!dataUrl || generating}
          className={cn(
            'flex items-center justify-center gap-2 rounded-lg px-4 py-2.5',
            'border border-[var(--color-primary)] text-[var(--color-primary)]',
            'text-sm font-semibold transition-all',
            'hover:bg-[var(--color-primary)] hover:text-[var(--color-primary-foreground)]',
            'disabled:opacity-40 disabled:cursor-not-allowed',
          )}
          aria-label="Print ticket"
        >
          <Printer className="h-4 w-4" aria-hidden="true" />
          Print
        </button>
      </div>

      {/* ── Bottom accent bar ────────────────────────────────────────── */}
      <div
        className="h-px w-full"
        style={{
          background: 'linear-gradient(90deg, transparent, #C9A84C 30%, #C9A84C 70%, transparent)',
          opacity: 0.4,
        }}
        aria-hidden="true"
      />
    </div>
  )
}
