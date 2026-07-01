import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (!code) {
    // No code — redirect to login with error
    return NextResponse.redirect(
      `${origin}/login?error=missing_code`
    )
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('[auth-callback] exchangeCodeForSession error:', error.message)
    return NextResponse.redirect(
      `${origin}/login?error=auth_callback_failed`
    )
  }

  // Get the authenticated user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.redirect(`${origin}/login?error=no_user`)
  }

  // Look up the user's role in app_users
  const { data: appUser, error: appUserError } = await supabase
    .from('app_users')
    .select('role, is_active')
    .eq('id', user.id)
    .single()

  if (appUserError || !appUser) {
    // User authenticated but not in app_users — sign out and redirect
    await supabase.auth.signOut()
    return NextResponse.redirect(
      `${origin}/login?error=no_account`
    )
  }

  if (!appUser.is_active) {
    await supabase.auth.signOut()
    return NextResponse.redirect(
      `${origin}/login?error=account_inactive`
    )
  }

  // Route based on role
  const role = appUser.role as string
  if (role === 'admin' || role === 'event_assistant') {
    return NextResponse.redirect(`${origin}/admin`)
  }

  // ticket_owner or any other role -> dashboard
  // Honour ?next= param if it looks safe (relative path only)
  const redirectTo = next.startsWith('/') ? next : '/dashboard'
  return NextResponse.redirect(`${origin}${redirectTo}`)
}
