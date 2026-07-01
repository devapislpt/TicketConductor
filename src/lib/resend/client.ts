import { Resend } from 'resend'
import * as React from 'react'

// ─── Config resolution ────────────────────────────────────────────────────────
//
// Priority: DB system_config (runtime) > environment variable (deploy-time)
//
// This lets the app work with zero env vars beyond SYSTEM_SECRET + Supabase
// once the admin has configured keys via Admin > Settings > System Config.

async function resolveApiKey(): Promise<string> {
  // Dynamic import so this module stays compatible with edge if needed,
  // and avoids a circular import during build-time.
  try {
    const { getConfig } = await import('@/lib/config/system')
    const dbKey = await getConfig('resend_api_key')
    if (dbKey) return dbKey
  } catch {
    // system module unavailable (e.g. crypto not in edge runtime) — fall through
  }

  const envKey = process.env.RESEND_API_KEY
  if (!envKey) {
    throw new Error(
      '[Resend] No API key found. Set resend_api_key in Admin > Settings > System Config, ' +
      'or set the RESEND_API_KEY environment variable.'
    )
  }
  return envKey
}

async function resolveFromAddress(): Promise<string> {
  try {
    const { getConfig } = await import('@/lib/config/system')
    const [dbEmail, dbName] = await Promise.all([
      getConfig('resend_from_email'),
      getConfig('resend_from_name'),
    ])
    if (dbEmail) {
      const name = dbName ?? process.env.RESEND_FROM_NAME ?? 'FallCon Ticket Conductor'
      return `${name} <${dbEmail}>`
    }
  } catch {
    // fall through to env vars
  }

  const envEmail = process.env.RESEND_FROM_EMAIL
  if (envEmail) {
    const envName = process.env.RESEND_FROM_NAME ?? 'FallCon Ticket Conductor'
    return `${envName} <${envEmail}>`
  }

  return 'FallCon Ticket Conductor <noreply@fallcon.com>'
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface SendEmailOptions {
  to: string | string[]
  subject: string
  react: React.ReactElement
  replyTo?: string
  from?: string
}

export interface SendEmailResult {
  id: string | null
  error: string | null
}

// ─── sendEmail ────────────────────────────────────────────────────────────────
/**
 * Sends a transactional email via Resend.
 *
 * Resolution order for API key and from-address:
 *   1. DB system_config (Admin UI — runtime, takes precedence)
 *   2. Environment variables (RESEND_API_KEY, RESEND_FROM_EMAIL, RESEND_FROM_NAME)
 *
 * Returns { id, error } — never throws, so callers can handle gracefully.
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  try {
    const [apiKey, fromAddress] = await Promise.all([
      resolveApiKey(),
      resolveFromAddress(),
    ])

    const resend = new Resend(apiKey)

    const { data, error } = await resend.emails.send({
      from: options.from ?? fromAddress,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      react: options.react,
      reply_to: options.replyTo,
    })

    if (error) {
      console.error('[Resend] Send error:', error)
      return { id: null, error: error.message }
    }

    return { id: data?.id ?? null, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown Resend error'
    console.error('[Resend] Unexpected error:', message)
    return { id: null, error: message }
  }
}

// ─── sendTicketConfirmation ────────────────────────────────────────────────────
/**
 * Convenience wrapper for sending a ticket confirmation email.
 */
export async function sendTicketConfirmationEmail(params: {
  to: string
  recipientName: string
  eventName: string
  eventDate: string
  locationName?: string
  locationAddress?: string
  qrCode?: string
  ticketNumber?: number
}): Promise<SendEmailResult> {
  const { TicketConfirmation } = await import('./emails/TicketConfirmation')

  return sendEmail({
    to: params.to,
    subject: `Your ticket to ${params.eventName} is confirmed`,
    react: React.createElement(TicketConfirmation, {
      recipientName: params.recipientName,
      eventName: params.eventName,
      eventDate: params.eventDate,
      locationName: params.locationName,
      locationAddress: params.locationAddress,
      qrCode: params.qrCode,
      ticketNumber: params.ticketNumber,
    }),
  })
}

// ─── sendMagicLinkEmail ───────────────────────────────────────────────────────
/**
 * Sends a magic link sign-in email.
 * Uses plain HTML for maximum deliverability (no React Email component).
 */
export async function sendMagicLinkEmail(
  email: string,
  magicLink: string
): Promise<SendEmailResult> {
  try {
    const [apiKey, fromAddress] = await Promise.all([
      resolveApiKey(),
      resolveFromAddress(),
    ])

    const resend = new Resend(apiKey)

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sign in to FallCon Ticket Conductor</title>
</head>
<body style="margin:0;padding:0;background:#0D0D0D;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0D0D0D;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#141414;border:1px solid #2A2A2A;border-radius:8px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 28px;text-align:center;background:#0A0A0A;border-bottom:1px solid #1E1E1E;">
              <p style="font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:600;color:#C9A84C;letter-spacing:0.12em;text-transform:uppercase;margin:0;">FallCon</p>
              <p style="font-size:10px;color:#5A5A5A;letter-spacing:0.2em;text-transform:uppercase;margin:6px 0 0;">Ticket Conductor</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;text-align:center;">
              <p style="font-size:11px;color:#C9A84C;letter-spacing:0.25em;text-transform:uppercase;margin:0 0 12px;">Sign In</p>
              <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:400;color:#F0EDE6;letter-spacing:0.02em;margin:0 0 16px;line-height:1.3;">Your magic link is ready</h1>
              <p style="font-size:15px;color:#8A8A8A;line-height:1.6;margin:0 0 32px;">Click the button below to sign in to FallCon Ticket Conductor. This link expires in 60 minutes and can only be used once.</p>
              <a href="${magicLink}" style="display:inline-block;background:#C9A84C;color:#0A0A0A;font-size:14px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;text-decoration:none;padding:14px 36px;border-radius:6px;" target="_blank">Sign In Now</a>
              <p style="font-size:12px;color:#5A5A5A;margin:24px 0 0;line-height:1.5;">Or copy and paste this URL into your browser:<br /><span style="font-family:'Courier New',monospace;color:#8A8A8A;word-break:break-all;">${magicLink}</span></p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;text-align:center;border-top:1px solid #1E1E1E;">
              <p style="font-size:12px;color:#3A3A3A;margin:0;line-height:1.6;">If you didn't request this email, you can safely ignore it.<br />&copy; ${new Date().getFullYear()} FallCon Ticket Conductor</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: [email],
      subject: 'Sign in to FallCon Ticket Conductor',
      html,
    })

    if (error) {
      console.error('[Resend] Magic link send error:', error)
      return { id: null, error: error.message }
    }

    return { id: data?.id ?? null, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Resend] Magic link unexpected error:', message)
    return { id: null, error: message }
  }
}
