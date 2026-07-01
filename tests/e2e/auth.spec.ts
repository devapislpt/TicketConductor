/**
 * E2E tests — Authentication
 * Covers: redirect, login page UI, magic link, password login, role-based redirect
 *
 * Strategy: page.route() is used to intercept API calls to Supabase and
 * internal Next.js API routes so tests run without a live backend.
 */

import { test, expect, type Page } from '@playwright/test'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Install a route mock that returns a JSON response */
async function mockAPI(
  page: Page,
  urlPattern: string | RegExp,
  status: number,
  body: unknown
): Promise<void> {
  await page.route(urlPattern, (route) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    })
  )
}

/** Mock a successful Supabase session (used to simulate logged-in state) */
async function setupAuthenticatedSession(page: Page, role: string = 'ticket_owner'): Promise<void> {
  // Intercept the Supabase session endpoint
  await page.route('**/auth/v1/token*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'mock-access-token',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'mock-refresh-token',
        user: {
          id: 'user-uuid-001',
          email: 'test@example.com',
          role: 'authenticated',
          user_metadata: { role },
        },
      }),
    })
  )

  // Intercept the profile/session fetch that the app makes after login
  await page.route('**/api/auth/session', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: { id: 'user-uuid-001', email: 'test@example.com', role } }),
    })
  )
}

// ---------------------------------------------------------------------------
// Unauthenticated redirect
// ---------------------------------------------------------------------------

test.describe('Unauthenticated access', () => {
  test('unauthenticated user visiting /dashboard is redirected to /login', async ({ page }) => {
    // Do not set up any auth mocks — user is anonymous
    await page.route('**/auth/v1/user', (route) =>
      route.fulfill({ status: 401, body: JSON.stringify({ error: 'not authenticated' }) })
    )

    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })

  test('unauthenticated user visiting /admin is redirected to /login', async ({ page }) => {
    await page.route('**/auth/v1/user', (route) =>
      route.fulfill({ status: 401, body: JSON.stringify({ error: 'not authenticated' }) })
    )

    await page.goto('/admin')
    await expect(page).toHaveURL(/\/login/)
  })

  test('unauthenticated user visiting /checkin is redirected to /login', async ({ page }) => {
    await page.route('**/auth/v1/user', (route) =>
      route.fulfill({ status: 401, body: JSON.stringify({ error: 'not authenticated' }) })
    )

    await page.goto('/checkin')
    await expect(page).toHaveURL(/\/login/)
  })
})

// ---------------------------------------------------------------------------
// Login page UI
// ---------------------------------------------------------------------------

test.describe('Login page structure', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
  })

  test('login page renders without crashing', async ({ page }) => {
    await expect(page).toHaveTitle(/FallCon|Ticket Conductor|Login/i)
  })

  test('login page shows both "Magic Link" and "Password" tabs', async ({ page }) => {
    const magicLinkTab = page.getByRole('tab', { name: /magic link/i })
    const passwordTab = page.getByRole('tab', { name: /password/i })

    await expect(magicLinkTab).toBeVisible()
    await expect(passwordTab).toBeVisible()
  })

  test('Magic Link tab is active by default', async ({ page }) => {
    const magicLinkTab = page.getByRole('tab', { name: /magic link/i })
    await expect(magicLinkTab).toHaveAttribute('aria-selected', 'true')
  })

  test('clicking Password tab shows password form fields', async ({ page }) => {
    await page.getByRole('tab', { name: /password/i }).click()

    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
  })

  test('Magic Link tab shows only email field', async ({ page }) => {
    // Default tab should already be Magic Link
    await expect(page.getByLabel(/email/i)).toBeVisible()
    // Password field should not be present on magic link tab
    const passwordInput = page.getByLabel(/^password$/i)
    await expect(passwordInput).toHaveCount(0)
  })
})

// ---------------------------------------------------------------------------
// Magic Link form
// ---------------------------------------------------------------------------

test.describe('Magic Link form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    // Ensure we are on the Magic Link tab
    const magicLinkTab = page.getByRole('tab', { name: /magic link/i })
    if (await magicLinkTab.getAttribute('aria-selected') !== 'true') {
      await magicLinkTab.click()
    }
  })

  test('submitting unknown email shows "No account found" error', async ({ page }) => {
    // Mock the API to return a 404 for unknown email
    await mockAPI(page, '**/api/auth/magic-link', 404, {
      error: 'no_account',
      message: 'No account found with that email address',
    })

    await page.getByLabel(/email/i).fill('notregistered@example.com')
    await page.getByRole('button', { name: /send magic link/i }).click()

    await expect(page.getByText(/no account found/i)).toBeVisible()
  })

  test('submitting valid email shows success message', async ({ page }) => {
    // Mock the API to return a 200 success
    await mockAPI(page, '**/api/auth/magic-link', 200, {
      message: 'Magic link sent',
    })

    await page.getByLabel(/email/i).fill('registered@example.com')
    await page.getByRole('button', { name: /send magic link/i }).click()

    await expect(page.getByText(/check your email/i)).toBeVisible()
  })

  test('submitting an invalid email format shows inline validation error', async ({ page }) => {
    await page.getByLabel(/email/i).fill('not-an-email')
    await page.getByRole('button', { name: /send magic link/i }).click()

    // Client-side validation should catch this before any API call
    const emailError = page.getByText(/valid email|invalid email/i)
    await expect(emailError).toBeVisible()
  })

  test('submit button is disabled while request is in flight', async ({ page }) => {
    // Use a slow mock to observe the in-progress state
    await page.route('**/api/auth/magic-link', async (route) => {
      await new Promise((r) => setTimeout(r, 500))
      await route.fulfill({ status: 200, body: JSON.stringify({ message: 'sent' }) })
    })

    await page.getByLabel(/email/i).fill('user@example.com')
    const submitBtn = page.getByRole('button', { name: /send magic link/i })
    await submitBtn.click()

    // Button should be disabled (or show loading state) while request is pending
    await expect(submitBtn).toBeDisabled()
  })

  test('submitting inactive account email shows deactivation error', async ({ page }) => {
    await mockAPI(page, '**/api/auth/magic-link', 403, {
      error: 'account_inactive',
      message: 'Your account has been deactivated. Please contact the event organizer.',
    })

    await page.getByLabel(/email/i).fill('inactive@example.com')
    await page.getByRole('button', { name: /send magic link/i }).click()

    await expect(page.getByText(/deactivated|contact the/i)).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Password form
// ---------------------------------------------------------------------------

test.describe('Password form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('tab', { name: /password/i }).click()
  })

  test('wrong password shows error message', async ({ page }) => {
    // Mock Supabase token endpoint to return an auth error
    await page.route('**/auth/v1/token*', (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'invalid_grant',
          error_description: 'Invalid login credentials',
        }),
      })
    )

    await page.getByLabel(/email/i).fill('user@example.com')
    await page.getByLabel(/^password$/i).fill('wrongpassword')
    await page.getByRole('button', { name: /sign in/i }).click()

    await expect(page.getByText(/invalid email or password|incorrect password|invalid credentials/i)).toBeVisible()
  })

  test('empty password shows validation error without making API call', async ({ page }) => {
    let apiCalled = false
    await page.route('**/auth/v1/token*', (route) => {
      apiCalled = true
      return route.continue()
    })

    await page.getByLabel(/email/i).fill('user@example.com')
    // Leave password empty
    await page.getByRole('button', { name: /sign in/i }).click()

    const pwError = page.getByText(/password.*required|enter.*password/i)
    await expect(pwError).toBeVisible()
    expect(apiCalled).toBe(false)
  })

  test('password shorter than 8 chars shows validation error', async ({ page }) => {
    await page.getByLabel(/email/i).fill('user@example.com')
    await page.getByLabel(/^password$/i).fill('short')
    await page.getByRole('button', { name: /sign in/i }).click()

    await expect(page.getByText(/8 character|at least 8|minimum/i)).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Role-based redirect after login
// ---------------------------------------------------------------------------

test.describe('Role-based redirect on successful login', () => {
  async function loginAsRole(page: Page, role: string): Promise<void> {
    await setupAuthenticatedSession(page, role)

    // Mock the internal session API (Next.js callback after Supabase auth)
    await page.route('**/api/auth/callback*', (route) =>
      route.fulfill({
        status: 302,
        headers: { Location: role === 'admin' ? '/admin/dashboard' : role === 'event_assistant' ? '/checkin' : '/dashboard' },
      })
    )

    await page.goto('/login')
    await page.getByRole('tab', { name: /password/i }).click()
    await page.getByLabel(/email/i).fill('user@example.com')
    await page.getByLabel(/^password$/i).fill('ValidPass1!')
    await page.getByRole('button', { name: /sign in/i }).click()
  }

  test('ticket_owner is redirected to /dashboard', async ({ page }) => {
    // Mock: after login the app fetches user profile with role=ticket_owner
    await page.route('**/auth/v1/token*', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          access_token: 'tok',
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: 'ref',
          user: { id: 'u1', email: 'owner@example.com', user_metadata: { role: 'ticket_owner' } },
        }),
      })
    )
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({ role: 'ticket_owner' }),
      })
    )

    await page.goto('/login')
    await page.getByRole('tab', { name: /password/i }).click()
    await page.getByLabel(/email/i).fill('owner@example.com')
    await page.getByLabel(/^password$/i).fill('ValidPass1!')
    await page.getByRole('button', { name: /sign in/i }).click()

    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('admin is redirected to /admin/dashboard', async ({ page }) => {
    await page.route('**/auth/v1/token*', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          access_token: 'tok',
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: 'ref',
          user: { id: 'u2', email: 'admin@example.com', user_metadata: { role: 'admin' } },
        }),
      })
    )
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ role: 'admin' }) })
    )

    await page.goto('/login')
    await page.getByRole('tab', { name: /password/i }).click()
    await page.getByLabel(/email/i).fill('admin@example.com')
    await page.getByLabel(/^password$/i).fill('AdminPass1!')
    await page.getByRole('button', { name: /sign in/i }).click()

    await expect(page).toHaveURL(/\/admin/)
  })

  test('event_assistant is redirected to /checkin', async ({ page }) => {
    await page.route('**/auth/v1/token*', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          access_token: 'tok',
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: 'ref',
          user: { id: 'u3', email: 'assistant@example.com', user_metadata: { role: 'event_assistant' } },
        }),
      })
    )
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ role: 'event_assistant' }) })
    )

    await page.goto('/login')
    await page.getByRole('tab', { name: /password/i }).click()
    await page.getByLabel(/email/i).fill('assistant@example.com')
    await page.getByLabel(/^password$/i).fill('AssistPass1!')
    await page.getByRole('button', { name: /sign in/i }).click()

    await expect(page).toHaveURL(/\/checkin/)
  })
})
