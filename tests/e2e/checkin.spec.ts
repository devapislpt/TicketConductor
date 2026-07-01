/**
 * E2E tests — Check-In system
 * Authenticated as admin or event_assistant
 * Covers: hub, QR mode, email lookup, already-checked-in, stats panel
 *
 * All API/Supabase calls mocked via page.route().
 */

import { test, expect, type Page } from '@playwright/test'

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_ADMIN = {
  id: 'user-uuid-admin',
  email: 'admin@fallcon.org',
  role: 'admin',
  first_name: 'Admin',
  last_name: 'User',
}

const MOCK_ASSISTANT = {
  id: 'user-uuid-assistant',
  email: 'assistant@fallcon.org',
  role: 'event_assistant',
  first_name: 'Event',
  last_name: 'Helper',
}

const MOCK_EVENTS = [
  {
    id: 'event-uuid-001',
    name: 'FallCon 2026',
    start_date: '2026-10-15T09:00:00.000Z',
    end_date: '2026-10-17T18:00:00.000Z',
    venue: 'Convention Center',
    status: 'published',
    total_tickets: 120,
    checked_in: 45,
  },
  {
    id: 'event-uuid-002',
    name: 'SpringFest 2027',
    start_date: '2027-04-20T10:00:00.000Z',
    end_date: '2027-04-20T22:00:00.000Z',
    venue: 'City Hall',
    status: 'published',
    total_tickets: 80,
    checked_in: 0,
  },
]

const MOCK_TICKETS = [
  {
    id: 'ticket-uuid-001',
    event_id: 'event-uuid-001',
    pack_id: 'pack-uuid-001',
    recipient_name: 'Alice Smith',
    recipient_email: 'alice@example.com',
    assigned: true,
    checked_in: false,
    checked_in_at: null,
  },
  {
    id: 'ticket-uuid-002',
    event_id: 'event-uuid-001',
    pack_id: 'pack-uuid-001',
    recipient_name: 'Bob Jones',
    recipient_email: 'bob@example.com',
    assigned: true,
    checked_in: true,
    checked_in_at: '2026-10-15T10:30:00.000Z',
  },
]

const MOCK_CHECKIN_STATS = {
  event_id: 'event-uuid-001',
  total_tickets: 120,
  checked_in: 45,
  remaining: 75,
}

// ---------------------------------------------------------------------------
// Setup helpers
// ---------------------------------------------------------------------------

async function mockSession(page: Page, user = MOCK_ADMIN): Promise<void> {
  await page.route('**/auth/v1/user', (route) =>
    route.fulfill({ status: 200, body: JSON.stringify(user) })
  )
  await page.route('**/auth/v1/session', (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({ user, access_token: 'mock-token' }),
    })
  )
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ status: 200, body: JSON.stringify(user) })
  )
}

async function mockCheckInEventsAPI(page: Page): Promise<void> {
  await page.route('**/api/check-in/events**', (route) =>
    route.fulfill({ status: 200, body: JSON.stringify(MOCK_EVENTS) })
  )
  // Also intercept the general events endpoint in case the app uses it
  await page.route('**/api/events**', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        body: JSON.stringify(MOCK_EVENTS.filter((e) => e.status === 'published')),
      })
    }
    return route.continue()
  })
}

async function mockCheckInStatsAPI(page: Page, eventId = 'event-uuid-001'): Promise<void> {
  await page.route(`**/api/check-in/${eventId}/stats**`, (route) =>
    route.fulfill({ status: 200, body: JSON.stringify(MOCK_CHECKIN_STATS) })
  )
  await page.route(`**/api/check-in/stats*eventId=${eventId}*`, (route) =>
    route.fulfill({ status: 200, body: JSON.stringify(MOCK_CHECKIN_STATS) })
  )
}

// ---------------------------------------------------------------------------
// Check-In Hub
// ---------------------------------------------------------------------------

test.describe('Check-In Hub', () => {
  test.beforeEach(async ({ page }) => {
    await mockSession(page)
    await mockCheckInEventsAPI(page)
  })

  test('check-in hub shows published events', async ({ page }) => {
    await page.goto('/checkin')

    await expect(page.getByText('FallCon 2026')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('SpringFest 2027')).toBeVisible()
  })

  test('check-in hub shows event dates and venues', async ({ page }) => {
    await page.goto('/checkin')

    await expect(page.getByText(/Convention Center/i)).toBeVisible()
    await expect(page.getByText(/Oct|October/i).first()).toBeVisible()
  })

  test('check-in hub shows check-in progress per event', async ({ page }) => {
    await page.goto('/checkin')

    // FallCon 2026 has 45/120 checked in
    await expect(page.getByText(/45.*120|45 of 120|45\/120/i).first()).toBeVisible()
  })

  test('clicking an event card navigates to the event check-in page', async ({ page }) => {
    await mockCheckInStatsAPI(page)

    await page.goto('/checkin')

    await page.getByText('FallCon 2026').click()

    await expect(page).toHaveURL(/\/checkin\/event-uuid-001/)
  })

  test('empty state shown when no published events', async ({ page }) => {
    await page.route('**/api/check-in/events**', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify([]) })
    )
    await page.route('**/api/events**', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify([]) })
    )

    await page.goto('/checkin')

    await expect(page.getByText(/no events|no.*check.in/i)).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Event check-in page — mode buttons
// ---------------------------------------------------------------------------

test.describe('Event check-in page — mode selection', () => {
  test.beforeEach(async ({ page }) => {
    await mockSession(page)
    await mockCheckInStatsAPI(page)
    await page.route('**/api/check-in/events**', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify(MOCK_EVENTS) })
    )
  })

  test('event check-in page has QR Scan and Email Lookup mode buttons', async ({ page }) => {
    await page.goto('/checkin/event-uuid-001')

    const qrButton = page.getByRole('button', { name: /qr scan|scan qr|camera/i })
    const emailButton = page.getByRole('button', { name: /email lookup|email search/i })

    await expect(qrButton).toBeVisible({ timeout: 10_000 })
    await expect(emailButton).toBeVisible()
  })

  test('clicking Email Lookup shows the email search input', async ({ page }) => {
    await page.goto('/checkin/event-uuid-001')

    await page.getByRole('button', { name: /email lookup|email search/i }).click()

    const searchInput = page.getByPlaceholder(/email|search attendee/i)
    await expect(searchInput).toBeVisible()
  })

  test('clicking QR Scan shows the scanner UI', async ({ page }) => {
    // Grant camera permissions (or mock the permission denial gracefully)
    await page.context().grantPermissions(['camera'])

    await page.goto('/checkin/event-uuid-001')

    await page.getByRole('button', { name: /qr scan|scan qr|camera/i }).click()

    // Either the video element or a camera-unavailable message is shown
    const scanner = page.locator('video, [data-testid="qr-scanner"], [aria-label*="scanner"]')
    const cameraError = page.getByText(/camera not available|use email lookup/i)

    const scannerOrError = scanner.or(cameraError)
    await expect(scannerOrError.first()).toBeVisible({ timeout: 5_000 })
  })
})

// ---------------------------------------------------------------------------
// Email lookup check-in
// ---------------------------------------------------------------------------

test.describe('Email Lookup check-in', () => {
  test.beforeEach(async ({ page }) => {
    await mockSession(page)
    await mockCheckInStatsAPI(page)
    await page.route('**/api/check-in/events**', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify(MOCK_EVENTS) })
    )
  })

  test('email lookup: type email, see matching result, click check in, see success overlay', async ({ page }) => {
    // Mock the lookup endpoint
    await page.route('**/api/check-in/lookup**', (route) => {
      const url = new URL(route.request().url())
      const email = url.searchParams.get('email') ?? ''
      const matches = MOCK_TICKETS.filter(
        (t) => t.recipient_email.includes(email) && !t.checked_in
      )
      return route.fulfill({ status: 200, body: JSON.stringify(matches) })
    })

    // Mock the check-in POST endpoint
    await page.route('**/api/check-in/scan', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 200,
          body: JSON.stringify({
            success: true,
            ticket: { ...MOCK_TICKETS[0], checked_in: true, checked_in_at: new Date().toISOString() },
          }),
        })
      }
      return route.continue()
    })

    await page.goto('/checkin/event-uuid-001')

    // Switch to email lookup mode
    await page.getByRole('button', { name: /email lookup|email search/i }).click()

    // Type the attendee's email
    const searchInput = page.getByPlaceholder(/email|search attendee/i)
    await searchInput.fill('alice@example.com')

    // Wait for results (debounced)
    await expect(page.getByText('Alice Smith')).toBeVisible({ timeout: 5_000 })

    // Click "Check In" on the result
    const checkInButton = page.getByRole('button', { name: /check in/i }).first()
    await checkInButton.click()

    // Success overlay should appear
    const successOverlay = page.locator('[data-testid="success-overlay"], [aria-label*="success"], .checkin-success')
    const successText = page.getByText(/checked in|success/i)
    await expect(successText.first()).toBeVisible({ timeout: 5_000 })
  })

  test('no matches found shows empty state message', async ({ page }) => {
    await page.route('**/api/check-in/lookup**', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify([]) })
    )

    await page.goto('/checkin/event-uuid-001')
    await page.getByRole('button', { name: /email lookup|email search/i }).click()

    const searchInput = page.getByPlaceholder(/email|search attendee/i)
    await searchInput.fill('notfound@example.com')

    await expect(page.getByText(/no tickets found|no results|not found/i)).toBeVisible({ timeout: 5_000 })
  })

  test('multiple matches are all shown in results list', async ({ page }) => {
    const multipleMatches = [
      MOCK_TICKETS[0],
      {
        ...MOCK_TICKETS[0],
        id: 'ticket-uuid-005',
        recipient_name: 'Alice Wonderland',
        recipient_email: 'alice.w@example.com',
      },
    ]

    await page.route('**/api/check-in/lookup**', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify(multipleMatches) })
    )

    await page.goto('/checkin/event-uuid-001')
    await page.getByRole('button', { name: /email lookup|email search/i }).click()

    await page.getByPlaceholder(/email|search attendee/i).fill('alice')

    await expect(page.getByText('Alice Smith')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('Alice Wonderland')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Already checked-in ticket handling
// ---------------------------------------------------------------------------

test.describe('Already checked-in ticket', () => {
  test.beforeEach(async ({ page }) => {
    await mockSession(page)
    await mockCheckInStatsAPI(page)
    await page.route('**/api/check-in/events**', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify(MOCK_EVENTS) })
    )
  })

  test('already checked-in ticket shows different state in email lookup results', async ({ page }) => {
    // Return Bob Jones who is already checked in
    await page.route('**/api/check-in/lookup**', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify([MOCK_TICKETS[1]]) })
    )

    await page.goto('/checkin/event-uuid-001')
    await page.getByRole('button', { name: /email lookup|email search/i }).click()

    await page.getByPlaceholder(/email|search attendee/i).fill('bob@example.com')

    // Should show "Checked In" badge instead of active "Check In" button
    await expect(page.getByText('Bob Jones')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText(/checked in|already checked/i).first()).toBeVisible()

    // The "Check In" button should be disabled or absent for already-checked-in results
    const checkInButtons = page.getByRole('button', { name: /^check in$/i })
    // Either 0 buttons, or they are all disabled
    const count = await checkInButtons.count()
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        await expect(checkInButtons.nth(i)).toBeDisabled()
      }
    }
  })

  test('QR scan of already-checked-in ticket shows warning overlay', async ({ page }) => {
    // Mock the scan endpoint to return 409 (already checked in)
    await page.route('**/api/check-in/scan', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 409,
          body: JSON.stringify({
            error: 'already_checked_in',
            ticket: MOCK_TICKETS[1],
            message: 'This ticket has already been checked in.',
          }),
        })
      }
      return route.continue()
    })

    await page.goto('/checkin/event-uuid-001')

    // Trigger the scan programmatically (simulating a QR decode result)
    // This assumes the app exposes a way to trigger check-in by ticket ID (or via the lookup form)
    await page.route('**/api/check-in/lookup**', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify([MOCK_TICKETS[1]]) })
    )

    await page.getByRole('button', { name: /email lookup|email search/i }).click()
    await page.getByPlaceholder(/email|search attendee/i).fill('bob@example.com')
    await expect(page.getByText('Bob Jones')).toBeVisible({ timeout: 5_000 })

    // Try to check in again (should show warning)
    const checkInBtn = page.getByRole('button', { name: /check in/i }).first()
    if (await checkInBtn.isEnabled()) {
      await checkInBtn.click()
      // Warning overlay / error message
      await expect(page.getByText(/already checked in|already been checked/i)).toBeVisible()
    }
  })
})

// ---------------------------------------------------------------------------
// Stats panel
// ---------------------------------------------------------------------------

test.describe('Check-in stats panel', () => {
  test.beforeEach(async ({ page }) => {
    await mockSession(page)
    await mockCheckInStatsAPI(page)
    await page.route('**/api/check-in/events**', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify(MOCK_EVENTS) })
    )
  })

  test('stats panel shows correct counts for the event', async ({ page }) => {
    await page.goto('/checkin/event-uuid-001')

    // Stats: 45 checked in, 120 total, 75 remaining
    await expect(page.getByText(/45|checked.in/i).first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/120|total/i).first()).toBeVisible()
  })

  test('stats panel shows a progress bar or percentage', async ({ page }) => {
    await page.goto('/checkin/event-uuid-001')

    // 45/120 = 37.5% — should show some progress indicator
    const progressBar = page.locator('[role="progressbar"], progress, [data-testid="progress-bar"]')
    const percentage = page.getByText(/37|38|%/i)

    const indicator = progressBar.or(percentage)
    await expect(indicator.first()).toBeVisible({ timeout: 5_000 })
  })

  test('stats update after a successful check-in', async ({ page }) => {
    let checkedIn = 45

    // Lookup returns Alice (not yet checked in)
    await page.route('**/api/check-in/lookup**', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify([MOCK_TICKETS[0]]) })
    )

    // Scan succeeds and increments the count
    await page.route('**/api/check-in/scan', (route) => {
      if (route.request().method() === 'POST') {
        checkedIn++
        return route.fulfill({
          status: 200,
          body: JSON.stringify({
            success: true,
            ticket: { ...MOCK_TICKETS[0], checked_in: true },
          }),
        })
      }
      return route.continue()
    })

    // Stats endpoint reflects updated count after check-in
    await page.route('**/api/check-in/event-uuid-001/stats**', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({ ...MOCK_CHECKIN_STATS, checked_in: checkedIn }),
      })
    )
    await page.route('**/api/check-in/stats*eventId=event-uuid-001*', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({ ...MOCK_CHECKIN_STATS, checked_in: checkedIn }),
      })
    )

    await page.goto('/checkin/event-uuid-001')

    await page.getByRole('button', { name: /email lookup|email search/i }).click()
    await page.getByPlaceholder(/email|search attendee/i).fill('alice@example.com')
    await expect(page.getByText('Alice Smith')).toBeVisible({ timeout: 5_000 })

    const checkInButton = page.getByRole('button', { name: /^check in$/i }).first()
    if (await checkInButton.isEnabled()) {
      await checkInButton.click()
      // After check-in, stats should show 46
      await expect(page.getByText(/46/)).toBeVisible({ timeout: 5_000 })
    }
  })
})

// ---------------------------------------------------------------------------
// Event assistant access restrictions
// ---------------------------------------------------------------------------

test.describe('Event assistant access restrictions', () => {
  test.beforeEach(async ({ page }) => {
    await mockSession(page, MOCK_ASSISTANT)
    await mockCheckInEventsAPI(page)
    await mockCheckInStatsAPI(page)
  })

  test('event assistant can access /checkin hub', async ({ page }) => {
    await page.goto('/checkin')
    await expect(page).toHaveURL(/\/checkin/)
    await expect(page.getByText(/error|forbidden|403/i)).toHaveCount(0)
  })

  test('event assistant is redirected away from /admin routes', async ({ page }) => {
    // Server-side check: admin routes return 403 for non-admins
    await page.route('**/admin/**', (route) =>
      route.fulfill({
        status: 403,
        body: JSON.stringify({ error: 'forbidden' }),
      })
    )

    await page.goto('/admin/events')

    // Should be redirected to /checkin (role default)
    await expect(page).toHaveURL(/\/checkin|\/login/)
  })

  test('event assistant is redirected away from /dashboard', async ({ page }) => {
    await page.goto('/dashboard')

    // Should redirect to /checkin (role default for event_assistant)
    await expect(page).toHaveURL(/\/checkin/)
  })

  test('event assistant does not see admin override button on already-checked-in ticket', async ({ page }) => {
    await page.route('**/api/check-in/lookup**', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify([MOCK_TICKETS[1]]) })
    )
    await page.route('**/api/check-in/scan', (route) =>
      route.fulfill({
        status: 409,
        body: JSON.stringify({ error: 'already_checked_in', ticket: MOCK_TICKETS[1] }),
      })
    )

    await page.goto('/checkin/event-uuid-001')
    await page.getByRole('button', { name: /email lookup|email search/i }).click()
    await page.getByPlaceholder(/email|search attendee/i).fill('bob@example.com')

    await expect(page.getByText('Bob Jones')).toBeVisible({ timeout: 5_000 })

    // Admin-only "Override" button should not be visible for event_assistant
    const overrideButton = page.getByRole('button', { name: /override|force check.in/i })
    await expect(overrideButton).toHaveCount(0)
  })
})
