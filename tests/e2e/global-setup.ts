/**
 * Playwright global setup file.
 *
 * Runs once before all E2E tests. Suitable for:
 * - Validating required environment variables
 * - Pre-seeding test database state (if not fully mocked)
 * - Creating shared auth state files
 *
 * Because all tests in this suite use page.route() to mock API calls,
 * no real database operations are needed here. This file is a placeholder
 * that validates the environment and exits cleanly.
 */

import { chromium, FullConfig } from '@playwright/test'

async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use?.baseURL ?? 'http://localhost:3000'

  console.log(`[global-setup] Base URL: ${baseURL}`)
  console.log(`[global-setup] Running in CI: ${!!process.env.CI}`)

  // Validate that required environment variables are set if not in mock mode
  const requiredEnvVars: string[] = [
    // Add real env var names here if integration tests are added later
    // 'NEXT_PUBLIC_SUPABASE_URL',
    // 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ]

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.warn(`[global-setup] Warning: ${envVar} is not set`)
    }
  }

  // Optional: verify the dev server is reachable
  try {
    const browser = await chromium.launch()
    const page = await browser.newPage()
    const response = await page.goto(baseURL, { waitUntil: 'commit', timeout: 10_000 })
    if (!response || !response.ok()) {
      console.warn(`[global-setup] Warning: server at ${baseURL} returned status ${response?.status()}`)
    } else {
      console.log(`[global-setup] Server reachable at ${baseURL} (status ${response.status()})`)
    }
    await browser.close()
  } catch (err) {
    console.warn(`[global-setup] Warning: could not reach ${baseURL}:`, (err as Error).message)
  }
}

export default globalSetup
