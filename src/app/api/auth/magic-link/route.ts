import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { magicLinkSchema } from '@/lib/validators/auth'

export async function POST(request: NextRequest) {
  // Parse and validate request body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = magicLinkSchema.safeParse(body)
  if (!parsed.success) {
    const message = parsed.error.errors[0]?.message ?? 'Invalid email address.'
    return NextResponse.json({ error: message }, { status: 422 })
  }

  const { email } = parsed.data
  const adminClient = createAdminClient()

  // Check if this email exists in app_users
  const { data: appUser, error: lookupError } = await adminClient
    .from('app_users')
    .select('id, is_active')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle()

  if (lookupError) {
    console.error('[magic-link] app_users lookup error:', lookupError.message)
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    )
  }

  if (!appUser) {
    // Return 404 with a clear message — no account found
    return NextResponse.json(
      { error: 'No account found with this email address.' },
      { status: 404 }
    )
  }

  if (!appUser.is_active) {
    return NextResponse.json(
      { error: 'Your account has been deactivated. Please contact an administrator.' },
      { status: 403 }
    )
  }

  // Determine redirect URL
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000')

  const emailRedirectTo = `${appUrl}/auth-callback`

  // Send magic link via Supabase
  const { error: otpError } = await adminClient.auth.signInWithOtp({
    email: email.toLowerCase().trim(),
    options: {
      emailRedirectTo,
      shouldCreateUser: false, // Never auto-create; user must exist
    },
  })

  if (otpError) {
    console.error('[magic-link] signInWithOtp error:', otpError.message)
    return NextResponse.json(
      { error: 'Failed to send magic link. Please try again.' },
      { status: 500 }
    )
  }

  // Log the action (fire-and-forget; do not block the response)
  adminClient
    .from('audit_logs')
    .insert({
      actor_id: null,
      actor_email: email.toLowerCase().trim(),
      action: 'user.magic_link_sent',
      entity_type: 'auth',
      entity_id: appUser.id,
      ip_address: request.headers.get('x-forwarded-for') ?? null,
      user_agent: request.headers.get('user-agent') ?? null,
    })
    .then(({ error }) => {
      if (error) console.warn('[magic-link] audit log error:', error.message)
    })

  return NextResponse.json({ success: true }, { status: 200 })
}
