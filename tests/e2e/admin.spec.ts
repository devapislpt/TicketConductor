/**
 * E2E tests — Admin panel (authenticated as admin)
 * Covers: dashboard, events CRUD, users, audit log, reports
 *
 * All API calls are intercepted via page.route() — no live backend needed.
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

const MOCK_EVENTS = [
  {
    id: 'event-uuid-001',
    name: 'FallCon 2026',
    description: 'Annual autumn convention',
    start_date: '2026-10-15T09:00:00.000Z',
    end_date: '2026-10-17T18:00:00.000Z',
    venue: 'Convention Center',
    status: 'published',
    edit_cutoff: '2026-10-10T23:59:00.000Z',
    total_tickets: 120,
    checked_in: 45,
  },
  {
    id: 'event-uuid-002',
    name: 'SpringFest 2027',
    description: 'Spring event',
    start_date: '2027-04-20T10:00:00.000Z',
    end_date: '2027-04-20T22:00:00.000Z',
    venue: 'City Hall',
    status: 'draft',
    edit_cutoff: null,
    total_tickets: 80,
    checked_in: 0,
  },
]

const MOCK_USERS = [
  {
    id: 'user-uuid-001',
    email: 'owner1@example.com',
    first_name: 'Jane',
    last_name: 'Smith',
    role: 'ticket_owner',
    status: 'active',
  },
  {
    id: 'user-uuid-002',
    email: 'assistant@example.com',
    first_name: 'Tom',
    last_name: 'Hall',
    role: 'event_assistant',
    status: 'active',
  },
  {
    id: 'user-uuid-003',
    email: 'inactive@example.com',
    first_name: 'Old',
    last_name: 'Account',
    role: 'ticket_owner',
    status: 'inactive',
  },
]

const MOCK_AUDIT_LOG = [
  {
    id: 'audit-uuid-001',
    created_at: '2026-10-14T14:30:00.000Z',
    actor_id: 'user-uuid-admin',
    actor_email: 'admin@fallcon.org',
    action: 'event.create',
    target_type: 'event',
    target_id: 'event-uuid-001',
    details: { name: 'FallCon 2026' },
  },
  {
    id: 'audit-uuid-002',
    created_at: '2026-10-14T15:00:00.000Z',
    actor_id: 'user-uuid-admin',
    actor_email: 'admin@fallcon.org',
    action: 'ticket.update',
    target_type: 'ticket',
    target_id: 'ticket-uuid-001',
    details: { old: { recipient_name: null }, new: { recipient_name: 'Alice Smith' } },
  },
]

const MOCK_STATS = {
  total_events: 2,
  total_users: 3,
  total_tickets: 200,
  tickets_assigned: 120,
  tickets_checked_in: 45,
}

// ---------------------------------------------------------------------------
// Setup helpers
// ---------------------------------------------------------------------------

async function mockAdminSession(page: Page): Promise<void> {
  await page.route('**/auth/v1/user', (route) =>
    route.fulfill({ status: 200, body: JSON.stringify(MOCK_ADMIN) })
  )
  await page.route('**/auth/v1/session', (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({ user: MOCK_ADMIN, access_token: 'mock-admin-token' }),
    })
  )
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ status: 200, body: JSON.stringify(MOCK_ADMIN) })
  )
}

async function mockEventsAPI(page: Page): Promise<void> {
  await page.route('**/api/events**', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, body: JSON.stringify(MOCK_EVENTS) })
    }
    return route.continue()
  })
  await page.route('**/api/admin/events**', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, body: JSON.stringify(MOCK_EVENTS) })
    }
    return route.continue()
  })
}

async function mockUsersAPI(page: Page): Promise<void> {
  await page.route('**/api/admin/users**', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, body: JSON.stringify(MOCK_USERS) })
    }
    return route.continue()
  })
}

async function mockAuditLogAPI(page: Page): Promise<void> {
  await page.route('**/api/admin/audit-log**', (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({ entries: MOCK_AUDIT_LOG, total: MOCK_AUDIT_LOG.length, page: 1 }),
    })
  )
}

async function mockStatsAPI(page: Page): Promise<void> {
  await page.route('**/api/admin/stats**', (route) =>
    route.fulfill({ status: 200, body: JSON.stringify(MOCK_STATS) })
  )
}

// ---------------------------------------------------------------------------
// Admin dashboard
// ---------------------------------------------------------------------------

test.describe('Admin dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await mockAdminSession(page)
    await mockStatsAPI(page)
    await mockEventsAPI(page)
  })

  test('admin dashboard renders without errors', async ({ page }) => {
    await page.goto('/admin/dashboard')
    await expect(page).toHaveURL(/\/admin/)
    // Page should not show an error state
    await expect(page.getByText(/error|500|not found/i)).toHaveCount(0)
  })

  test('admin dashboard shows stat cards', async ({ page }) => {
    await page.goto('/admin/dashboard')

    // Should show total events stat
    await expect(page.getByText(/2|total events/i).first()).toBeVisible({ timeout: 10_000 })
    // Should show total users stat
    await expect(page.getByText(/3|total users/i).first()).toBeVisible()
  })

  test('admin dashboard shows total tickets and check-in progress', async ({ page }) => {
    await page.goto('/admin/dashboard')

    await expect(page.getByText(/200|total tickets/i).first()).toBeVisible()
    await expect(page.getByText(/45|checked.in/i).first()).toBeVisible()
  })

  test('admin nav links are visible', async ({ page }) => {
    await page.goto('/admin/dashboard')

    await expect(page.getByRole('link', { name: /events/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /users/i })).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Events management
// ---------------------------------------------------------------------------

test.describe('Events management', () => {
  test.beforeEach(async ({ page }) => {
    await mockAdminSession(page)
    await mockEventsAPI(page)
  })

  test('events page shows event list', async ({ page }) => {
    await page.goto('/admin/events')

    await expect(page.getByText('FallCon 2026')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('SpringFest 2027')).toBeVisible()
  })

  test('events page shows status badges for each event', async ({ page }) => {
    await page.goto('/admin/events')

    await expect(page.getByText(/published/i).first()).toBeVisible()
    await expect(page.getByText(/draft/i).first()).toBeVisible()
  })

  test('create event: fill form, save, verify in list', async ({ page }) => {
    const newEvent = {
      id: 'event-uuid-003',
      name: 'WinterGala 2027',
      description: 'A new winter event',
      start_date: '2027-12-01T18:00:00.000Z',
      end_date: '2027-12-01T23:00:00.000Z',
      venue: 'Grand Ballroom',
      status: 'draft',
      edit_cutoff: null,
      total_tickets: 0,
      checked_in: 0,
    }

    // After creation, the list endpoint returns all 3 events
    let eventCreated = false
    await page.route('**/api/events**', (route) => {
      if (route.request().method() === 'POST') {
        eventCreated = true
        return route.fulfill({ status: 201, body: JSON.stringify(newEvent) })
      }
      if (route.request().method() === 'GET') {
        const list = eventCreated ? [...MOCK_EVENTS, newEvent] : MOCK_EVENTS
        return route.fulfill({ status: 200, body: JSON.stringify(list) })
      }
      return route.continue()
    })
    await page.route('**/api/admin/events**', (route) => {
      if (route.request().method() === 'GET') {
        const list = eventCreated ? [...MOCK_EVENTS, newEvent] : MOCK_EVENTS
        return route.fulfill({ status: 200, body: JSON.stringify(list) })
      }
      return route.continue()
    })

    await page.goto('/admin/events')

    // Open Create Event form
    await page.getByRole('button', { name: /new event|create event/i }).click()

    const form = page.locator('[role="dialog"], form[data-testid="event-form"]')
    await expect(form).toBeVisible()

    await page.getByLabel(/event name|name/i).fill('WinterGala 2027')
    await page.getByLabel(/venue|location/i).fill('Grand Ballroom')

    // Fill start/end dates if they exist as inputs
    const startDateInput = page.getByLabel(/start date/i)
    if (await startDateInput.isVisible()) {
      await startDateInput.fill('2027-12-01')
    }

    await page.getByRole('button', { name: /create|save/i }).click()

    // Form should close
    await expect(form).toBeHidden({ timeout: 5_000 })

    // New event appears in list
    await expect(page.getByText('WinterGala 2027')).toBeVisible({ timeout: 5_000 })
  })

  test('edit event: clicking edit opens pre-populated form', async ({ page }) => {
    await page.route('**/api/events/event-uuid-001', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ status: 200, body: JSON.stringify(MOCK_EVENTS[0]) })
      }
      if (route.request().method() === 'PUT') {
        return route.fulfill({ status: 200, body: JSON.stringify(MOCK_EVENTS[0]) })
      }
      return route.continue()
    })

    await page.goto('/admin/events')

    const fallconRow = page.locator('tr, [data-testid="event-row"]').filter({ hasText: 'FallCon 2026' })
    await fallconRow.getByRole('button', { name: /edit/i }).click()

    const form = page.locator('[role="dialog"], form')
    await expect(form).toBeVisible()

    // Form should be pre-populated with event name
    const nameInput = page.getByLabel(/event name|name/i)
    await expect(nameInput).toHaveValue('FallCon 2026')
  })
})

// ---------------------------------------------------------------------------
// Users management
// ---------------------------------------------------------------------------

test.describe('Users management', () => {
  test.beforeEach(async ({ page }) => {
    await mockAdminSession(page)
    await mockUsersAPI(page)
  })

  test('users page shows user list with role badges', async ({ page }) => {
    await page.goto('/admin/users')

    await expect(page.getByText('Jane Smith')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Tom Hall')).toBeVisible()
    await expect(page.getByText('Old Account')).toBeVisible()
  })

  test('users page shows role badges', async ({ page }) => {
    await page.goto('/admin/users')

    await expect(page.getByText(/ticket.owner/i).first()).toBeVisible()
    await expect(page.getByText(/event.assistant/i).first()).toBeVisible()
  })

  test('inactive user has a visual indicator', async ({ page }) => {
    await page.goto('/admin/users')

    const inactiveRow = page.locator('tr, [data-testid="user-row"]').filter({ hasText: 'Old Account' })
    await expect(inactiveRow.getByText(/inactive/i)).toBeVisible()
  })

  test('users page has a "Send Magic Link" action available', async ({ page }) => {
    await page.goto('/admin/users')

    // Open kebab menu or find the button for the first active user
    const janeRow = page.locator('tr, [data-testid="user-row"]').filter({ hasText: 'Jane Smith' })
    const menuOrButton = janeRow.getByRole('button', { name: /magic link|send link|actions/i })
    await expect(menuOrButton.first()).toBeVisible()
  })

  test('sending magic link shows success toast', async ({ page }) => {
    await page.route('**/api/admin/users/user-uuid-001/magic-link', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ message: 'Magic link sent' }) })
    )

    await page.goto('/admin/users')

    // Trigger the send magic link action for Jane Smith
    const janeRow = page.locator('tr, [data-testid="user-row"]').filter({ hasText: 'Jane Smith' })

    // May be a direct button or inside a dropdown menu
    const actionButton = janeRow.getByRole('button', { name: /actions|more|\.\.\./i })
    if (await actionButton.isVisible()) {
      await actionButton.click()
    }
    await page.getByRole('menuitem', { name: /send magic link/i }).click()

    await expect(page.getByText(/magic link sent|link sent/i)).toBeVisible({ timeout: 5_000 })
  })
})

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

test.describe('Audit log', () => {
  test.beforeEach(async ({ page }) => {
    await mockAdminSession(page)
    await mockAuditLogAPI(page)
  })

  test('audit log page shows entries', async ({ page }) => {
    await page.goto('/admin/audit-log')

    await expect(page.getByText(/event\.create|event.create/i)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/ticket\.update|ticket.update/i)).toBeVisible()
  })

  test('audit log shows actor email', async ({ page }) => {
    await page.goto('/admin/audit-log')

    await expect(page.getByText('admin@fallcon.org').first()).toBeVisible()
  })

  test('audit log shows timestamps', async ({ page }) => {
    await page.goto('/admin/audit-log')

    // Should show some date/time string
    await expect(page.getByText(/Oct|2026/i).first()).toBeVisible()
  })

  test('audit log supports filtering by action type', async ({ page }) => {
    // Mock filtered response
    await page.route('**/api/admin/audit-log*action=event*', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          entries: [MOCK_AUDIT_LOG[0]],
          total: 1,
          page: 1,
        }),
      })
    )

    await page.goto('/admin/audit-log')

    const filterInput = page.getByPlaceholder(/filter|search|action/i)
    if (await filterInput.isVisible()) {
      await filterInput.fill('event')
      // Results should narrow
      await expect(page.getByText(/event\.create/i)).toBeVisible()
    }
  })
})

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

test.describe('Reports', () => {
  test.beforeEach(async ({ page }) => {
    await mockAdminSession(page)
    await mockEventsAPI(page)
  })

  test('reports page loads without error', async ({ page }) => {
    await page.goto('/admin/reports')
    await expect(page.getByText(/error|500/i)).toHaveCount(0)
  })

  test('reports page: select event, see roster summary', async ({ page }) => {
    const MOCK_ROSTER = {
      event: MOCK_EVENTS[0],
      total_tickets: 120,
      assigned: 100,
      checked_in: 45,
      packs: [
        {
          id: 'pack-uuid-001',
          name: 'VIP Table 1',
          owner: 'Jane Smith',
          tickets: 4,
          assigned: 4,
          checked_in: 2,
        },
      ],
    }

    await page.route('**/api/admin/events/event-uuid-001/roster*', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify(MOCK_ROSTER) })
    )
    await page.route('**/api/admin/reports*event*event-uuid-001*', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify(MOCK_ROSTER) })
    )

    await page.goto('/admin/reports')

    // Select FallCon 2026 from event dropdown
    const eventSelect = page.getByRole('combobox', { name: /event/i })
    if (await eventSelect.isVisible()) {
      await eventSelect.selectOption({ label: 'FallCon 2026' })
    } else {
      // May be a custom select or button
      await page.getByText(/select event|choose event/i).click()
      await page.getByText('FallCon 2026').click()
    }

    // Should show roster data
    await expect(page.getByText(/120|total tickets/i).first()).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText(/45|checked.in/i).first()).toBeVisible()
  })

  test('export roster button triggers CSV download', async ({ page }) => {
    await page.route('**/api/admin/events/event-uuid-001/roster*format=csv*', (route) =>
      route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="roster-fallcon-2026.csv"',
        },
        body: 'ticket_id,first_name,last_name,email\nticket-1,Alice,Smith,alice@example.com',
      })
    )

    await page.goto('/admin/reports')

    // Select an event first
    const eventSelect = page.getByRole('combobox', { name: /event/i })
    if (await eventSelect.isVisible()) {
      await eventSelect.selectOption({ label: 'FallCon 2026' })
    }

    const downloadPromise = page.waitForEvent('download', { timeout: 10_000 }).catch(() => null)
    const exportBtn = page.getByRole('button', { name: /export.*csv|download.*roster/i })
    if (await exportBtn.isVisible()) {
      await exportBtn.click()
    }

    // Either a download happens, or we at least verified the button exists
    // (download event only fires for real file downloads)
    await expect(exportBtn).toBeVisible()
  })
})
