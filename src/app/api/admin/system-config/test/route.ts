/**
 * POST /api/admin/system-config/test
 *
 * Tests live connectivity for a service using stored config.
 *
 * Body: { service: 'email' | 'connect' }
 *
 * email   → sends a test email via Resend to the currently logged-in admin
 * connect → makes a GET to {connect_api_url}/health (falls back to /ping)
 *
 * Returns: { success: boolean, message: string, status_code?: number }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getConfig } from '@/lib/config/system'
import { z } from 'zod'
import { Resend } from 'resend'

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { user: null, profile: null, error: 'Unauthorized', status: 401 }

  const { data: profile } = await supabase
    .from('app_users')
    .select('role, email, full_name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { user: null, profile: null, error: 'Forbidden', status: 403 }
  }

  return { user, profile, error: null, status: 200 }
}

// ─── Validation ───────────────────────────────────────────────────────────────

const bodySchema = z.object({
  service: z.enum(['email', 'connect']),
})

// ─── Email test ───────────────────────────────────────────────────────────────

async function testEmail(adminEmail: string, adminName: string | null) {
  // Read API key from DB first, fall back to env
  const dbKey = await getConfig('resend_api_key')
  const apiKey = dbKey ?? process.env.RESEND_API_KEY

  if (!apiKey) {
    return {
      success: false,
      message: 'No Resend API key configured. Set it in System Config or RESEND_API_KEY env var.',
    }
  }

  // Build from address
  const dbFromEmail = await getConfig('resend_from_email')
  const dbFromName = await getConfig('resend_from_name')
  const fromEmail = dbFromEmail ?? process.env.RESEND_FROM_EMAIL ?? 'noreply@fallcon.com'
  const fromName = dbFromName ?? process.env.RESEND_FROM_NAME ?? 'FallCon Ticket Conductor'
  const fromAddress = `${fromName} <${fromEmail}>`

  const recipient = adminName ? `${adminName} <${adminEmail}>` : adminEmail

  try {
    const resend = new Resend(apiKey)

    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: [adminEmail],
      subject: 'FallCon — Test Email',
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head><meta charset="utf-8" /><title>Test Email</title></head>
        <body style="margin:0;padding:0;background:#0D0D0D;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0D0D0D;">
            <tr>
              <td align="center" style="padding:40px 16px;">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#141414;border:1px solid #2A2A2A;border-radius:8px;overflow:hidden;">
                  <tr>
                    <td style="padding:32px 40px 28px;text-align:center;background:#0A0A0A;border-bottom:1px solid #1E1E1E;">
                      <p style="font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:600;color:#C9A84C;letter-spacing:0.12em;text-transform:uppercase;margin:0;">FallCon</p>
                      <p style="font-size:10px;color:#5A5A5A;letter-spacing:0.2em;text-transform:uppercase;margin:6px 0 0;">Ticket Conductor</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:40px 40px 32px;text-align:center;">
                      <p style="font-size:11px;color:#C9A84C;letter-spacing:0.25em;text-transform:uppercase;margin:0 0 12px;">System Config Test</p>
                      <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:400;color:#F0EDE6;margin:0 0 16px;">Email is working!</h1>
                      <p style="font-size:15px;color:#8A8A8A;line-height:1.6;margin:0 0 16px;">
                        This test email was sent from the FallCon Ticket Conductor admin panel to confirm that your Resend integration is correctly configured.
                      </p>
                      <p style="font-size:13px;color:#5A5A5A;">Sent to: <strong style="color:#8A8A8A;">${recipient}</strong></p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:20px 40px;text-align:center;border-top:1px solid #1E1E1E;">
                      <p style="font-size:12px;color:#3A3A3A;margin:0;">&copy; ${new Date().getFullYear()} FallCon Ticket Conductor — Admin System</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    })

    if (error) {
      return {
        success: false,
        message: `Resend API error: ${error.message}`,
      }
    }

    return {
      success: true,
      message: `Test email sent successfully to ${adminEmail}. Check your inbox. (ID: ${data?.id ?? 'n/a'})`,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, message: `Failed to send test email: ${msg}` }
  }
}

// ─── Connect test ─────────────────────────────────────────────────────────────

async function testConnect() {
  const apiUrl = await getConfig('connect_api_url')
  const apiKey = await getConfig('connect_api_key')

  if (!apiUrl) {
    return {
      success: false,
      message: 'Connect API URL is not configured.',
      status_code: null,
    }
  }

  // Normalise URL — strip trailing slash
  const baseUrl = apiUrl.replace(/\/$/, '')

  // Try /health first, fall back to /ping
  const endpoints = ['/health', '/ping']

  for (const endpoint of endpoints) {
    const url = `${baseUrl}${endpoint}`
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`
        headers['X-Api-Key'] = apiKey
      }

      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(10_000),
      })

      if (response.ok) {
        return {
          success: true,
          message: `Connection successful (${url} responded ${response.status}).`,
          status_code: response.status,
        }
      }

      // Non-2xx but reachable — report back
      return {
        success: false,
        message: `Connect API at ${url} responded with HTTP ${response.status}.`,
        status_code: response.status,
      }
    } catch (err) {
      // Network error — try next endpoint
      if (endpoint === endpoints[endpoints.length - 1]) {
        const msg = err instanceof Error ? err.message : 'Network error'
        return {
          success: false,
          message: `Could not reach Connect API at ${baseUrl}: ${msg}`,
          status_code: null,
        }
      }
    }
  }

  return { success: false, message: 'Connection test exhausted all endpoints.', status_code: null }
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { user, profile, error, status } = await requireAdmin()
  if (!user) return NextResponse.json({ success: false, message: error }, { status })

  try {
    const body = await req.json()
    const parsed = bodySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: 'Invalid request body. Expected { service: "email" | "connect" }' },
        { status: 422 }
      )
    }

    const { service } = parsed.data

    if (service === 'email') {
      const result = await testEmail(
        profile!.email as string,
        profile!.full_name as string | null
      )
      return NextResponse.json(result)
    }

    if (service === 'connect') {
      const result = await testConnect()
      return NextResponse.json(result)
    }

    return NextResponse.json({ success: false, message: 'Unknown service.' }, { status: 422 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error'
    console.error('[system-config/test POST]', msg)
    return NextResponse.json({ success: false, message: msg }, { status: 500 })
  }
}
