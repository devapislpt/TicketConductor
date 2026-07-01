/**
 * Unit tests for utility functions
 * Tests: format utils, isCutoffPassed, slugify, initials, generateQRCode, cn
 */

import { formatDate, formatDateTime, formatRelative } from '@/lib/utils/format'
import { isCutoffPassed } from '@/lib/utils/cutoff'
import { slugify } from '@/lib/utils/slugify'
import { initials } from '@/lib/utils/initials'
import { generateQRCode } from '@/lib/utils/qrcode'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Mock the qrcode module before any imports resolve it
// ---------------------------------------------------------------------------
jest.mock('qrcode', () => ({
  toDataURL: jest.fn(),
}))

import QRCode from 'qrcode'

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------
describe('formatDate', () => {
  it('formats a ISO date string as a human-readable date', () => {
    const result = formatDate('2026-10-15T00:00:00.000Z')
    // Should contain the month name and year; exact format depends on locale
    expect(result).toMatch(/Oct|October/)
    expect(result).toMatch(/2026/)
  })

  it('formats a Date object', () => {
    const date = new Date('2026-10-15T00:00:00.000Z')
    const result = formatDate(date)
    expect(result).toMatch(/2026/)
  })

  it('returns an empty string or placeholder for null/undefined input', () => {
    // Implementation may return '' or '—'; just verify it does not throw
    expect(() => formatDate(null as unknown as string)).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// formatDateTime
// ---------------------------------------------------------------------------
describe('formatDateTime', () => {
  it('includes both date and time components', () => {
    const result = formatDateTime('2026-10-15T14:30:00.000Z')
    // Should include some indication of time (digits and colon or am/pm)
    expect(result).toMatch(/\d{1,2}[:.]\d{2}|am|pm/i)
    expect(result).toMatch(/2026/)
  })

  it('formats a Date object correctly', () => {
    const date = new Date('2026-10-15T09:00:00.000Z')
    const result = formatDateTime(date)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('handles midnight correctly without throwing', () => {
    expect(() => formatDateTime('2026-10-15T00:00:00.000Z')).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// formatRelative
// ---------------------------------------------------------------------------
describe('formatRelative', () => {
  beforeEach(() => {
    // Pin "now" to a known value so relative formatting is deterministic
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-10-15T12:00:00.000Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('returns "just now" or similar for a very recent timestamp', () => {
    const recent = new Date('2026-10-15T11:59:50.000Z').toISOString()
    const result = formatRelative(recent)
    expect(result).toMatch(/just now|seconds ago|moments ago/i)
  })

  it('returns a minutes-ago string for a timestamp 5 minutes ago', () => {
    const fiveMinAgo = new Date('2026-10-15T11:55:00.000Z').toISOString()
    const result = formatRelative(fiveMinAgo)
    expect(result).toMatch(/5 minute|5 min/i)
  })

  it('returns a days-ago string for a timestamp 3 days ago', () => {
    const threeDaysAgo = new Date('2026-10-12T12:00:00.000Z').toISOString()
    const result = formatRelative(threeDaysAgo)
    expect(result).toMatch(/3 day/i)
  })

  it('returns a future-tense string for a future timestamp', () => {
    const tomorrow = new Date('2026-10-16T12:00:00.000Z').toISOString()
    const result = formatRelative(tomorrow)
    // Could be "in 1 day", "tomorrow", etc.
    expect(result).toMatch(/in |tomorrow/i)
  })
})

// ---------------------------------------------------------------------------
// isCutoffPassed
// ---------------------------------------------------------------------------
describe('isCutoffPassed', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-10-15T12:00:00.000Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('returns false when cutoff is null (no cutoff set)', () => {
    expect(isCutoffPassed(null)).toBe(false)
  })

  it('returns false when cutoff is undefined', () => {
    expect(isCutoffPassed(undefined)).toBe(false)
  })

  it('returns true when cutoff is in the past', () => {
    const pastCutoff = '2026-10-14T12:00:00.000Z' // yesterday
    expect(isCutoffPassed(pastCutoff)).toBe(true)
  })

  it('returns true when cutoff is exactly now (boundary: past)', () => {
    // Exactly "now" — implementation treats as passed
    const exactNow = '2026-10-15T12:00:00.000Z'
    expect(isCutoffPassed(exactNow)).toBe(true)
  })

  it('returns false when cutoff is in the future', () => {
    const futureCutoff = '2026-10-16T12:00:00.000Z' // tomorrow
    expect(isCutoffPassed(futureCutoff)).toBe(false)
  })

  it('returns false for a cutoff one second in the future', () => {
    const nearFuture = '2026-10-15T12:00:01.000Z'
    expect(isCutoffPassed(nearFuture)).toBe(false)
  })

  it('returns true for a cutoff one second in the past', () => {
    const nearPast = '2026-10-15T11:59:59.000Z'
    expect(isCutoffPassed(nearPast)).toBe(true)
  })

  it('accepts a Date object as well as a string', () => {
    const pastDate = new Date('2026-10-14T12:00:00.000Z')
    expect(isCutoffPassed(pastDate)).toBe(true)
    const futureDate = new Date('2026-10-16T12:00:00.000Z')
    expect(isCutoffPassed(futureDate)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// slugify
// ---------------------------------------------------------------------------
describe('slugify', () => {
  it('converts a simple string to lowercase hyphenated slug', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  it('replaces multiple spaces with a single hyphen', () => {
    expect(slugify('Hello   World')).toBe('hello-world')
  })

  it('removes special characters', () => {
    expect(slugify('FallCon 2026!')).toBe('fallcon-2026')
  })

  it('handles ampersands and common symbols', () => {
    expect(slugify('Rock & Roll')).toBe('rock-roll')
  })

  it('handles leading and trailing spaces', () => {
    expect(slugify('  hello world  ')).toBe('hello-world')
  })

  it('handles already-lowercase slugs', () => {
    expect(slugify('already-good')).toBe('already-good')
  })

  it('handles strings with numbers', () => {
    expect(slugify('Event 42 is here')).toBe('event-42-is-here')
  })

  it('handles accented / unicode characters gracefully', () => {
    const result = slugify('Café au lait')
    // Should at minimum not throw and not produce empty string
    expect(result.length).toBeGreaterThan(0)
    expect(result).toMatch(/^[a-z0-9-]+$/)
  })

  it('returns an empty string for empty input', () => {
    expect(slugify('')).toBe('')
  })

  it('handles strings that are only special chars', () => {
    const result = slugify('!!!')
    expect(result).toBe('')
  })
})

// ---------------------------------------------------------------------------
// initials
// ---------------------------------------------------------------------------
describe('initials', () => {
  it('returns uppercase initials for a full name', () => {
    expect(initials('Jane Doe')).toBe('JD')
  })

  it('returns single initial for a single-word name', () => {
    expect(initials('Madonna')).toBe('M')
  })

  it('returns first and last initial for three-word name', () => {
    // "Mary Jane Watson" → "MW" (first + last) or "MJW" (all) — test both patterns
    const result = initials('Mary Jane Watson')
    expect(result).toMatch(/^(MJW|MW)$/)
  })

  it('handles names with lowercase input', () => {
    const result = initials('john smith')
    expect(result).toMatch(/^JS$/i)
  })

  it('returns empty string for empty input', () => {
    expect(initials('')).toBe('')
  })

  it('handles null/undefined gracefully', () => {
    expect(() => initials(null as unknown as string)).not.toThrow()
    expect(() => initials(undefined as unknown as string)).not.toThrow()
  })

  it('trims extra whitespace', () => {
    expect(initials('  Alice   Bob  ')).toBe('AB')
  })

  it('handles hyphenated names', () => {
    const result = initials('Anne-Marie Dupont')
    // Could be "AD" or "AMD" depending on implementation
    expect(result.length).toBeGreaterThanOrEqual(2)
  })
})

// ---------------------------------------------------------------------------
// generateQRCode
// ---------------------------------------------------------------------------
describe('generateQRCode', () => {
  const mockToDataURL = QRCode.toDataURL as jest.Mock

  beforeEach(() => {
    mockToDataURL.mockReset()
  })

  it('calls qrcode.toDataURL with the provided value', async () => {
    const fakeDataURL = 'data:image/png;base64,abc123'
    mockToDataURL.mockResolvedValue(fakeDataURL)

    const result = await generateQRCode('ticket-uuid-1234')

    expect(mockToDataURL).toHaveBeenCalledTimes(1)
    expect(mockToDataURL).toHaveBeenCalledWith('ticket-uuid-1234', expect.any(Object))
    expect(result).toBe(fakeDataURL)
  })

  it('returns a string starting with "data:"', async () => {
    mockToDataURL.mockResolvedValue('data:image/png;base64,xyz')

    const result = await generateQRCode('some-ticket-id')
    expect(typeof result).toBe('string')
    expect(result.startsWith('data:')).toBe(true)
  })

  it('passes options to qrcode.toDataURL when provided', async () => {
    mockToDataURL.mockResolvedValue('data:image/png;base64,abc')

    await generateQRCode('ticket-id', { width: 256, margin: 2 })

    expect(mockToDataURL).toHaveBeenCalledWith(
      'ticket-id',
      expect.objectContaining({ width: 256, margin: 2 })
    )
  })

  it('propagates errors from the qrcode library', async () => {
    mockToDataURL.mockRejectedValue(new Error('QR generation failed'))

    await expect(generateQRCode('bad-input')).rejects.toThrow('QR generation failed')
  })

  it('handles empty string input without throwing (delegates to library)', async () => {
    mockToDataURL.mockResolvedValue('data:image/png;base64,empty')

    await expect(generateQRCode('')).resolves.toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// cn (clsx + tailwind-merge)
// ---------------------------------------------------------------------------
describe('cn utility', () => {
  it('joins class names with a space', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('ignores falsy values', () => {
    expect(cn('foo', false, null, undefined, 'bar')).toBe('foo bar')
  })

  it('handles conditional classes (clsx behaviour)', () => {
    const isActive = true
    const isDisabled = false
    expect(cn('base', isActive && 'active', isDisabled && 'disabled')).toBe('base active')
  })

  it('merges conflicting Tailwind classes (tailwind-merge behaviour)', () => {
    // tailwind-merge should keep the last conflicting class
    const result = cn('p-2', 'p-4')
    expect(result).toBe('p-4')
  })

  it('merges conflicting text-color classes', () => {
    const result = cn('text-red-500', 'text-blue-500')
    expect(result).toBe('text-blue-500')
  })

  it('does not merge non-conflicting classes', () => {
    const result = cn('p-4', 'text-sm', 'font-bold')
    expect(result).toBe('p-4 text-sm font-bold')
  })

  it('handles object syntax for conditional classes', () => {
    const result = cn({ 'bg-red-500': true, 'bg-blue-500': false })
    expect(result).toBe('bg-red-500')
  })

  it('handles array input', () => {
    const result = cn(['foo', 'bar'])
    expect(result).toBe('foo bar')
  })

  it('handles nested arrays and objects', () => {
    const result = cn(['foo', { bar: true, baz: false }])
    expect(result).toBe('foo bar')
  })

  it('returns empty string for no arguments', () => {
    expect(cn()).toBe('')
  })
})
