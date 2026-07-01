'use client'

import React from 'react'
import { cn } from '@/lib/utils/cn'
import type { ThemeConfig } from '@/lib/types'

interface ThemePreviewProps {
  theme: ThemeConfig
  className?: string
}

export function ThemePreview({ theme, className }: ThemePreviewProps) {
  // Build inline style overrides so the preview reflects live values
  // without touching the document root (which is handled by applyToDOM)
  const previewVars: React.CSSProperties = {
    '--preview-primary': theme.color_primary,
    '--preview-primary-fg': theme.color_primary_foreground,
    '--preview-secondary': theme.color_secondary,
    '--preview-secondary-fg': theme.color_secondary_foreground,
    '--preview-accent': theme.color_accent,
    '--preview-background': theme.color_background,
    '--preview-foreground': theme.color_foreground,
    '--preview-card': theme.color_card,
    '--preview-card-fg': theme.color_card_foreground,
    '--preview-border': theme.color_border,
    '--preview-muted': theme.color_muted,
    '--preview-muted-fg': theme.color_muted_foreground,
    '--preview-destructive': theme.color_destructive,
    '--preview-success': theme.color_success,
    '--preview-radius': theme.border_radius,
    '--preview-font-heading': `'${theme.font_heading}', Georgia, serif`,
    '--preview-font-body': `'${theme.font_body}', system-ui, sans-serif`,
    '--preview-font-mono': `'${theme.font_mono}', 'Courier New', monospace`,
    '--preview-font-size': theme.font_size_base,
    '--preview-font-weight-heading': theme.font_weight_heading,
    '--preview-line-height': theme.line_height_base,
    '--preview-letter-spacing': theme.letter_spacing_heading,
  } as React.CSSProperties

  return (
    <div
      style={previewVars}
      className={cn(
        'rounded-[var(--border-radius)] overflow-hidden',
        'bg-[var(--preview-background)] text-[var(--preview-foreground)]',
        'border border-[var(--preview-border)]',
        'text-[length:var(--preview-font-size)]',
        'font-[family-name:var(--preview-font-body)]',
        'leading-[var(--preview-line-height)]',
        className
      )}
    >
      {/* Header bar */}
      <div
        className="px-4 py-3 border-b"
        style={{ borderColor: 'var(--preview-border)', background: 'var(--preview-card)' }}
      >
        <p
          className="text-base font-semibold tracking-[var(--preview-letter-spacing)]"
          style={{
            fontFamily: 'var(--preview-font-heading)',
            fontWeight: 'var(--preview-font-weight-heading)',
            color: 'var(--preview-foreground)',
          }}
        >
          FallCon Ticket Conductor
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--preview-muted-fg)' }}>
          Preview — changes apply in real-time
        </p>
      </div>

      <div className="p-4 space-y-5">
        {/* Buttons */}
        <section>
          <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--preview-muted-fg)' }}>
            Buttons
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              style={{
                background: 'var(--preview-primary)',
                color: 'var(--preview-primary-fg)',
                borderRadius: 'var(--preview-radius)',
                border: 'none',
                padding: '6px 14px',
                fontSize: '0.8em',
                fontFamily: 'var(--preview-font-body)',
                fontWeight: 500,
                cursor: 'default',
              }}
            >
              Primary
            </button>
            <button
              style={{
                background: 'var(--preview-secondary)',
                color: 'var(--preview-secondary-fg)',
                borderRadius: 'var(--preview-radius)',
                border: 'none',
                padding: '6px 14px',
                fontSize: '0.8em',
                fontFamily: 'var(--preview-font-body)',
                fontWeight: 500,
                cursor: 'default',
              }}
            >
              Secondary
            </button>
            <button
              style={{
                background: 'transparent',
                color: 'var(--preview-primary)',
                borderRadius: 'var(--preview-radius)',
                border: '1px solid var(--preview-primary)',
                padding: '6px 14px',
                fontSize: '0.8em',
                fontFamily: 'var(--preview-font-body)',
                fontWeight: 500,
                cursor: 'default',
              }}
            >
              Outline
            </button>
            <button
              style={{
                background: 'var(--preview-destructive)',
                color: '#fff',
                borderRadius: 'var(--preview-radius)',
                border: 'none',
                padding: '6px 14px',
                fontSize: '0.8em',
                fontFamily: 'var(--preview-font-body)',
                fontWeight: 500,
                cursor: 'default',
              }}
            >
              Danger
            </button>
          </div>
        </section>

        {/* Badges */}
        <section>
          <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--preview-muted-fg)' }}>
            Badges
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Published', bg: 'var(--preview-success)', opacity: '20%', color: 'var(--preview-success)' },
              { label: 'Draft', bg: '#D97706', opacity: '20%', color: '#D97706' },
              { label: 'Checked In', bg: 'var(--preview-primary)', opacity: '20%', color: 'var(--preview-primary)' },
            ].map(({ label, bg, color }) => (
              <span
                key={label}
                style={{
                  background: bg + '30',
                  color,
                  border: `1px solid ${bg}50`,
                  borderRadius: '9999px',
                  padding: '2px 10px',
                  fontSize: '0.72em',
                  fontFamily: 'var(--preview-font-body)',
                  fontWeight: 500,
                  cursor: 'default',
                }}
              >
                {label}
              </span>
            ))}
          </div>
        </section>

        {/* Input */}
        <section>
          <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--preview-muted-fg)' }}>
            Input
          </p>
          <input
            readOnly
            value="ryan@fallcon.com"
            style={{
              width: '100%',
              background: 'var(--preview-muted)',
              color: 'var(--preview-foreground)',
              border: '1px solid var(--preview-border)',
              borderRadius: 'var(--preview-radius)',
              padding: '6px 10px',
              fontSize: '0.8em',
              fontFamily: 'var(--preview-font-body)',
              outline: 'none',
              cursor: 'default',
            }}
          />
        </section>

        {/* Card */}
        <section>
          <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--preview-muted-fg)' }}>
            Card
          </p>
          <div
            style={{
              background: 'var(--preview-card)',
              border: '1px solid var(--preview-border)',
              borderRadius: 'var(--preview-radius)',
              padding: '12px',
            }}
          >
            <p
              className="text-sm font-semibold"
              style={{
                fontFamily: 'var(--preview-font-heading)',
                fontWeight: 'var(--preview-font-weight-heading)',
                color: 'var(--preview-foreground)',
                letterSpacing: 'var(--preview-letter-spacing)',
                marginBottom: 4,
              }}
            >
              FallCon 2026 — Weekend Pass
            </p>
            <p style={{ fontSize: '0.78em', color: 'var(--preview-muted-fg)', fontFamily: 'var(--preview-font-body)' }}>
              3 tickets assigned · Oct 15–17, 2026
            </p>
            <div
              style={{
                marginTop: 8,
                padding: '4px 8px',
                background: 'var(--preview-success)20',
                border: '1px solid var(--preview-success)40',
                borderRadius: 'var(--preview-radius)',
                fontSize: '0.72em',
                color: 'var(--preview-success)',
                display: 'inline-block',
                fontFamily: 'var(--preview-font-body)',
              }}
            >
              ✓ Published
            </div>
          </div>
        </section>

        {/* Typography */}
        <section>
          <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--preview-muted-fg)' }}>
            Typography
          </p>
          <p
            style={{
              fontFamily: 'var(--preview-font-heading)',
              fontWeight: 'var(--preview-font-weight-heading)',
              fontSize: '1.2em',
              color: 'var(--preview-foreground)',
              letterSpacing: 'var(--preview-letter-spacing)',
              marginBottom: 4,
            }}
          >
            Heading — {theme.font_heading}
          </p>
          <p
            style={{
              fontFamily: 'var(--preview-font-body)',
              fontSize: '0.85em',
              color: 'var(--preview-muted-fg)',
              marginBottom: 4,
            }}
          >
            Body — {theme.font_body}. The quick brown fox jumps over the lazy dog.
          </p>
          <p
            style={{
              fontFamily: 'var(--preview-font-mono)',
              fontSize: '0.75em',
              color: 'var(--preview-primary)',
              background: 'var(--preview-muted)',
              padding: '2px 6px',
              borderRadius: 4,
              display: 'inline-block',
            }}
          >
            mono — {theme.font_mono}
          </p>
        </section>

        {/* Color swatches */}
        <section>
          <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--preview-muted-fg)' }}>
            Color Palette
          </p>
          <div className="flex gap-1.5 flex-wrap">
            {[
              { label: 'Primary', color: theme.color_primary },
              { label: 'Secondary', color: theme.color_secondary },
              { label: 'Background', color: theme.color_background },
              { label: 'Card', color: theme.color_card },
              { label: 'Border', color: theme.color_border },
              { label: 'Success', color: theme.color_success },
              { label: 'Danger', color: theme.color_destructive },
            ].map(({ label, color }) => (
              <div key={label} className="flex flex-col items-center gap-1">
                <div
                  title={color}
                  style={{
                    width: 28,
                    height: 28,
                    background: color,
                    borderRadius: 6,
                    border: '1px solid var(--preview-border)',
                  }}
                />
                <span style={{ fontSize: '0.6em', color: 'var(--preview-muted-fg)', fontFamily: 'var(--preview-font-mono)' }}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
