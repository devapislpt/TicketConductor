/**
 * E2E tests — Ticket Management (authenticated as ticket_owner)
 * Covers: dashboard, pack detail, assign, edit, remove, cutoff enforcement
 *
 * All Supabase/API calls are intercepted via page.route() so tests run
 * without a live backend.
 */

import { test, expect, type Page } from '@playwright/test'

// ---------------------------------------------------------------------------
// Shared fixtures / mock data
// ---------------------------------------------------------------------------

const MOCK_USER = {
  id: 'user-uuid-owner',
  email: 'owner@example.com',
  role: 'ticket_owner',
}

const MOCK_PACK_OPEN = {
  id: 'pack-uuid-001',
  name: 'VIP Table 1',
  event_name: 'FallCon 2026',
  event_id: 'event-uuid-001',
  total_tickets: 4,
  assigned_count: 1,
  edit_cutoff: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
}

const MOCK_PACK_LOCKED = {
  id: 'pack-uuid-002',
  name: 'General Table 5',
  event_name: 'FallCon 2026',
  event_id: 'event-uuid-001',
  total_tickets: 6,
  assigned_count: 6,
  edit_cutoff: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // yesterday
}

const MOCK_TICKETS_OPEN = [
  {
    id: 'ticket-uuid-001',
    pack_id: 'pack-uuid-001',
    recipient_name: 'Alice Smith',
    recipient_email: 'alice@example.com',
    recipient_phone: null,
    notes: null,
    assigned: true,
    checked_in: false,
  },
  {
    id: 'ticket-uuid-002',
    pack_id: 'pack-uuid-001',
    recipient_name: null,
    recipient_email: null,
    recipient_phone: null,
    notes: null,
    assigned: false,
    checked_in: false,
  },
  {
    id: 'ticket-uuid-003',
    pack_id: 'pack-uuid-001',
    recipient_name: null,
    recipient_email: null,
    recipient_phone: null,
    notes: null,
    assigned: false,
    checked_in: false,
  },
  {
    id: 'ticket-uuid-004',
    pack_id: 'pack-uuid-001',
    recipient_name: null,
    recipient_email: null,
    recipient_phone: null,
    notes: null,
    assigned: false,
    checked_in: false,
  },
]

// ---------------------------------------------------------------------------
// Setup helpers
// ---------------------------------------------------------------------------

/** Mock authenticated session as ticket_owner */
async function mockAuthSession(page: Page): Promise<void> {
  await page.route('**/auth/v1/user', (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify(MOCK_USER),
    })
  )
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify(MOCK_USER),
    })
  )
  // Prevent redirect to /login
  await page.route('**/auth/v1/session', (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({ user: MOCK_USER, access_token: 'mock-token' }),
    })
  )
}

/** Mock the ticket packs list */
async function mockPacksList(page: Page, packs = [MOCK_PACK_OPEN, MOCK_PACK_LOCKED]): Promise<void> {
  await page.route('**/api/ticket-packs**', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, body: JSON.stringify(packs) })
    }
    return route.continue()
  })
}

/** Mock tickets for a specific pack */
async function mockPackDetail(page: Page, packId: string, tickets = MOCK_TICKETS_OPEN): Promise<void> {
  await page.route(`**/api/ticket-packs/${packId}`, (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({ ...MOCK_PACK_OPEN, tickets }),
    })
  )
  await page.route(`**/api/ticket-packs/${packId}/tickets**`, (route) =>
    route.fulfill({ status: 200, body: JSON.stringify(tickets) })
  )
}

// ---------------------------------------------------------------------------
// Dashboard tests
// ---------------------------------------------------------------------------

test.describe('Dashboard — ticket pack overview', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthSession(page)
    await mockPacksList(page)
  })

  test('dashboard shows ticket packs with progress stats', async ({ page }) => {
    await page.goto('/dashboard')

    // Should show at least one pack card
    const packCards = page.locator('[data-testid="pack-card"], .pack-card, [aria-label*="pack"]')
    await expect(packCards.first()).toBeVisible({ timeout: 10_000 })

    // Check that pack name is shown
    await expect(page.getByText('VIP Table 1')).toBeVisible()
  })

  test('dashboard shows assigned vs total progress stats', async ({ page }) => {
    await page.goto('/dashboard')

    // Pack with 1/4 assigned
    await expect(page.getByText(/1\s*\/\s*4|1 of 4/i)).toBeVisible()
  })

  test('locked pack shows a "Locked" badge', async ({ page }) => {
    await page.goto('/dashboard')

    await expect(page.getByText(/locked|closed|edit closed/i).first()).toBeVisible()
  })

  test('open pack shows edit-open indicator', async ({ page }) => {
    await page.goto('/dashboard')

    // Some indicator that the pack is still open for editing
    await expect(page.getByText(/edit open|open|editable/i).first()).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Pack detail / orders page
// ---------------------------------------------------------------------------

test.describe('Orders page — pack detail', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthSession(page)
    await mockPacksList(page)
    await mockPackDetail(page, 'pack-uuid-001')
  })

  test('clicking a pack card opens the orders page', async ({ page }) => {
    await page.goto('/dashboard')

    const packCard = page.getByText('VIP Table 1')
    await packCard.click()

    await expect(page).toHaveURL(/\/orders\/pack-uuid-001/)
  })

  test('orders page shows all tickets in the pack', async ({ page }) => {
    await page.goto('/orders/pack-uuid-001')

    // 4 tickets total
    const ticketCards = page.locator('[data-testid="ticket-card"], .ticket-card')
    await expect(ticketCards).toHaveCount(4)
  })

  test('assigned ticket shows recipient name', async ({ page }) => {
    await page.goto('/orders/pack-uuid-001')

    await expect(page.getByText('Alice Smith')).toBeVisible()
  })

  test('unassigned ticket shows "Assign Ticket" button', async ({ page }) => {
    await page.goto('/orders/pack-uuid-001')

    const assignButtons = page.getByRole('button', { name: /assign ticket/i })
    // 3 unassigned tickets
    await expect(assignButtons).toHaveCount(3)
  })
})

// ---------------------------------------------------------------------------
// Assign a ticket
// ---------------------------------------------------------------------------

test.describe('Assign ticket', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthSession(page)
    await mockPackDetail(page, 'pack-uuid-001')
  })

  test('assigning a ticket: fill form, save, see updated card', async ({ page }) => {
    // Mock the PUT endpoint to succeed
    await page.route('**/api/tickets/ticket-uuid-002', (route) => {
      if (route.request().method() === 'PUT') {
        return route.fulfill({
          status: 200,
          body: JSON.stringify({
            id: 'ticket-uuid-002',
            recipient_name: 'Bob Jones',
            recipient_email: 'bob@example.com',
            assigned: true,
          }),
        })
      }
      return route.continue()
    })

    await page.goto('/orders/pack-uuid-001')

    // Click the first "Assign Ticket" button (for ticket-uuid-002)
    const assignButtons = page.getByRole('button', { name: /assign ticket/i })
    await assignButtons.first().click()

    // Form/modal should appear
    const form = page.locator('[role="dialog"], form[data-testid="assign-form"]')
    await expect(form).toBeVisible()

    // Fill in the form
    await page.getByLabel(/first name/i).fill('Bob')
    await page.getByLabel(/last name/i).fill('Jones')
    await page.getByLabel(/email/i).fill('bob@example.com')

    // Submit
    await page.getByRole('button', { name: /save|confirm|assign/i }).click()

    // Modal should close and the card should now show "Bob Jones"
    await expect(form).toBeHidden()
    await expect(page.getByText('Bob Jones')).toBeVisible()
  })

  test('validation error prevents save when required fields are missing', async ({ page }) => {
    await page.goto('/orders/pack-uuid-001')

    const assignButtons = page.getByRole('button', { name: /assign ticket/i })
    await assignButtons.first().click()

    // Do not fill in any fields — just click save
    await page.getByRole('button', { name: /save|confirm|assign/i }).click()

    // Error messages should appear
    await expect(page.getByText(/required|first name|last name|email/i).first()).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Edit an existing assignment
// ---------------------------------------------------------------------------

test.describe('Edit ticket assignment', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthSession(page)
    await mockPackDetail(page, 'pack-uuid-001')
  })

  test('editing assignment: change name, verify update', async ({ page }) => {
    // Mock the PUT endpoint for the already-assigned ticket
    await page.route('**/api/tickets/ticket-uuid-001', (route) => {
      if (route.request().method() === 'PUT') {
        return route.fulfill({
          status: 200,
          body: JSON.stringify({
            id: 'ticket-uuid-001',
            recipient_name: 'Alice Johnson',
            recipient_email: 'alice@example.com',
            assigned: true,
          }),
        })
      }
      return route.continue()
    })

    await page.goto('/orders/pack-uuid-001')

    // Find the Edit button next to Alice Smith's ticket
    const aliceCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: 'Alice Smith' })
    const editButton = aliceCard.getByRole('button', { name: /edit/i })
    await expect(editButton).toBeVisible()
    await editButton.click()

    // Form pre-populated with "Alice Smith"
    const firstNameInput = page.getByLabel(/first name/i)
    await expect(firstNameInput).toHaveValue('Alice')

    // Change the last name
    await page.getByLabel(/last name/i).clear()
    await page.getByLabel(/last name/i).fill('Johnson')

    await page.getByRole('button', { name: /save/i }).click()

    // Card should now show "Alice Johnson"
    await expect(page.getByText('Alice Johnson')).toBeVisible()
    await expect(page.getByText('Alice Smith')).toHaveCount(0)
  })

  test('cancelling edit keeps original data', async ({ page }) => {
    await page.goto('/orders/pack-uuid-001')

    const aliceCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: 'Alice Smith' })
    await aliceCard.getByRole('button', { name: /edit/i }).click()

    await page.getByLabel(/last name/i).clear()
    await page.getByLabel(/last name/i).fill('Changed')

    // Cancel instead of saving
    await page.getByRole('button', { name: /cancel/i }).click()

    // Original name should still be visible
    await expect(page.getByText('Alice Smith')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Remove an assignment
// ---------------------------------------------------------------------------

test.describe('Remove ticket assignment', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthSession(page)
    await mockPackDetail(page, 'pack-uuid-001')
  })

  test('removing assignment: confirm dialog, verify card resets to unassigned', async ({ page }) => {
    // Mock the DELETE/PUT endpoint
    await page.route('**/api/tickets/ticket-uuid-001**', (route) => {
      if (['DELETE', 'PUT'].includes(route.request().method())) {
        return route.fulfill({
          status: 200,
          body: JSON.stringify({
            id: 'ticket-uuid-001',
            recipient_name: null,
            recipient_email: null,
            assigned: false,
          }),
        })
      }
      return route.continue()
    })

    await page.goto('/orders/pack-uuid-001')

    const aliceCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: 'Alice Smith' })
    const removeButton = aliceCard.getByRole('button', { name: /remove|delete/i })
    await removeButton.click()

    // Confirmation dialog
    const dialog = page.locator('[role="dialog"], [role="alertdialog"]')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText(/remove|confirm/i)).toBeVisible()

    // Confirm removal
    await dialog.getByRole('button', { name: /confirm|yes|remove/i }).click()

    // Dialog closes
    await expect(dialog).toBeHidden()

    // The ticket card should now show "Assign Ticket" (unassigned state)
    await expect(page.getByText('Alice Smith')).toHaveCount(0)
  })

  test('cancelling removal keeps the assignment', async ({ page }) => {
    await page.goto('/orders/pack-uuid-001')

    const aliceCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: 'Alice Smith' })
    await aliceCard.getByRole('button', { name: /remove|delete/i }).click()

    const dialog = page.locator('[role="dialog"], [role="alertdialog"]')
    await dialog.getByRole('button', { name: /cancel/i }).click()

    // Alice should still be there
    await expect(page.getByText('Alice Smith')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Cutoff enforcement
// ---------------------------------------------------------------------------

test.describe('Cutoff enforcement', () => {
  test('cutoff passed: no edit buttons visible, banner displayed', async ({ page }) => {
    const LOCKED_TICKETS = MOCK_TICKETS_OPEN.map((t) => ({
      ...t,
      recipient_name: `Person ${t.id.slice(-3)}`,
      recipient_email: `person${t.id.slice(-3)}@example.com`,
      assigned: true,
    }))

    // Mock auth
    await page.route('**/auth/v1/user', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify(MOCK_USER) })
    )

    // Mock the locked pack detail
    await page.route('**/api/ticket-packs/pack-uuid-002', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({ ...MOCK_PACK_LOCKED, tickets: LOCKED_TICKETS }),
      })
    )
    await page.route('**/api/ticket-packs/pack-uuid-002/tickets**', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify(LOCKED_TICKETS) })
    )

    await page.goto('/orders/pack-uuid-002')

    // Banner indicating cutoff has passed
    await expect(page.getByText(/edit.*deadline|edit window.*closed|cutoff.*passed/i)).toBeVisible()

    // No "Edit" or "Assign" or "Remove" buttons should be present
    const editButtons = page.getByRole('button', { name: /edit/i })
    await expect(editButtons).toHaveCount(0)

    const assignButtons = page.getByRole('button', { name: /assign ticket/i })
    await expect(assignButtons).toHaveCount(0)

    const removeButtons = page.getByRole('button', { name: /remove/i })
    await expect(removeButtons).toHaveCount(0)
  })

  test('server-side cutoff rejection shows error when form is submitted after cutoff', async ({ page }) => {
    // Simulate: form was open, but server now rejects because cutoff passed
    await page.route('**/auth/v1/user', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify(MOCK_USER) })
    )
    await mockPackDetail(page, 'pack-uuid-001')

    // The save endpoint returns 403
    await page.route('**/api/tickets/ticket-uuid-002', (route) => {
      if (route.request().method() === 'PUT') {
        return route.fulfill({
          status: 403,
          body: JSON.stringify({ error: 'edit_window_closed', message: 'The edit deadline has passed.' }),
        })
      }
      return route.continue()
    })

    await page.goto('/orders/pack-uuid-001')

    const assignButtons = page.getByRole('button', { name: /assign ticket/i })
    await assignButtons.first().click()

    await page.getByLabel(/first name/i).fill('Test')
    await page.getByLabel(/last name/i).fill('User')
    await page.getByLabel(/email/i).fill('test@example.com')
    await page.getByRole('button', { name: /save|confirm|assign/i }).click()

    // Error should appear
    await expect(page.getByText(/deadline.*passed|edit window.*closed/i)).toBeVisible()
  })
})
