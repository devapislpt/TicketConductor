import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuration for FallCon Ticket Conductor E2E tests.
 *
 * Environment variables:
 *   PLAYWRIGHT_BASE_URL  — override the base URL (default: http://localhost:3000)
 *   CI                   — set to any truthy value in CI to adjust retries/workers
 */

export default defineConfig({
  // Directory containing E2E test specs
  testDir: './tests/e2e',

  // Run all tests within each spec file sequentially to avoid shared-state issues
  fullyParallel: true,

  // Fail the build on CI if any test.only() is accidentally committed
  forbidOnly: !!process.env.CI,

  // Retry failed tests once on CI, zero locally
  retries: process.env.CI ? 1 : 0,

  // Use fewer workers on CI to avoid resource contention
  workers: process.env.CI ? 2 : undefined,

  // Reporter: HTML report always; additional line reporter on CI
  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    process.env.CI ? ['github'] : ['list'],
  ],

  // Shared settings for all projects
  use: {
    // Base URL used by page.goto('/path')
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',

    // Collect traces on first retry to aid debugging
    trace: 'on-first-retry',

    // Screenshot only on test failure
    screenshot: 'only-on-failure',

    // Video only on test failure
    video: 'on-first-retry',

    // Global timeout for each action (click, fill, etc.)
    actionTimeout: 15_000,

    // Navigation timeout
    navigationTimeout: 30_000,
  },

  // Output directory for test artifacts (screenshots, videos, traces)
  outputDir: 'test-results',

  // Timeout for each individual test
  timeout: 60_000,

  // Timeout for the expect() assertions
  expect: {
    timeout: 10_000,
  },

  // ---------------------------------------------------------------------------
  // Browser projects
  // ---------------------------------------------------------------------------
  projects: [
    // Desktop Chromium — primary browser
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        // Headless by default; set PLAYWRIGHT_HEADED=1 to see the browser
        headless: !process.env.PLAYWRIGHT_HEADED,
      },
    },

    // Mobile Chromium — Pixel 5 form factor
    {
      name: 'chromium-mobile-pixel5',
      use: {
        ...devices['Pixel 5'],
        // Pixel 5: 393 x 851 logical pixels
      },
    },
  ],

  // ---------------------------------------------------------------------------
  // Web server — spin up Next.js dev server before running tests
  // ---------------------------------------------------------------------------
  webServer: {
    command: 'npm run dev',
    url: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    // Wait up to 120 seconds for the server to start (Next.js cold start can be slow)
    timeout: 120_000,
    // Reuse an already-running server if one exists on the port
    reuseExistingServer: !process.env.CI,
    // Pipe server stdout/stderr to the test runner output
    stdout: 'pipe',
    stderr: 'pipe',
  },

  // Global setup file — runs once before the entire test suite
  // Used for seeding test data, checking env vars, etc.
  globalSetup: './tests/e2e/global-setup.ts',
})
