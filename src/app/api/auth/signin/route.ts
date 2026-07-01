import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { loginSchema } from '@/lib/validators/auth'

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    const message = parsed.error.errors[0]?.message ?? 'Invalid credentials.'
    return NextResponse.json({ error: message }, { status: 422 })
  }

  const { email, password } = parsed.data

  let supabase: Awaited<ReturnType<typeof createClient>>
  try {
    supabase = await createClient()
  } catch (err) {
    console.error('[signin] createClient error:', err)
    return NextResponse.json({ error: `Config error: ${String(err)}` }, { status: 500 })
  }

  // Attempt password sign-in
  let signInData: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>['data']
  try {
    const result = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password,
    })
    if (result.error) {
      console.error('[signin] signInWithPassword error:', result.error.message)
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
    }
    signInData = result.data
  } catch (err) {
    console.error('[signin] signInWithPassword threw:', err)
    return NextResponse.json({ error: `Auth error: ${String(err)}` }, { status: 500 })
  }

  if (!signInData?.user) {
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
  }

  const user = signInData.user

  // Check app_users for role + active status
  const adminClient = createAdminClient()
  const { data: appUser, error: appUserError } = await adminClient
    .from('app_users')
    .select('role, is_active')
    .eq('id', user.id)
    .single()

  if (appUserError || !appUser) {
    await supabase.auth.signOut()
    return NextResponse.json(
      { error: 'No account found. Please contact an administrator.' },
      { status: 403 }
    )
  }

  if (!appUser.is_active) {
    await supabase.auth.signOut()
    return NextResponse.json(
      { error: 'Your account has been deactivated. Please contact an administrator.' },
      { status: 403 }
    )
  }

  // Determine redirect destination by role
  const role = appUser.role as string
  const redirectTo =
    role === 'admin' || role === 'event_assistant' ? '/admin' : '/dashboard'

  // Update last_sign_in_at (fire-and-forget)
  adminClient
    .from('app_users')
    .update({ last_sign_in_at: new Date().toISOString() })
    .eq('id', user.id)
    .then(({ error }) => {
      if (error) console.warn('[signin] last_sign_in_at update error:', error.message)
    })

  return NextResponse.json({ success: true, redirectTo }, { status: 200 })
}
