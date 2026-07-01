import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const supabase = await createClient()

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    console.error('[api/auth/callback] exchange error:', exchangeError.message)
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
  }

  // Fetch authenticated user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.redirect(`${origin}/login?error=no_user`)
  }

  // Look up role and active status from app_users
  const { data: appUser, error: appUserError } = await supabase
    .from('app_users')
    .select('role, is_active')
    .eq('id', user.id)
    .single()

  if (appUserError || !appUser) {
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/login?error=no_account`)
  }

  if (!appUser.is_active) {
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/login?error=account_inactive`)
  }

  // Role-based routing
  const role = appUser.role as string
  if (role === 'admin' || role === 'event_assistant') {
    return NextResponse.redirect(`${origin}/admin`)
  }

  // Honour ?next= if safe relative path, otherwise default to /dashboard
  const redirectTo = next.startsWith('/') ? next : '/dashboard'
  return NextResponse.redirect(`${origin}${redirectTo}`)
}
