import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  // Public routes
  const publicRoutes = ['/login', '/magic-link', '/reset-password', '/auth-callback']
  const isPublicRoute = publicRoutes.some(r => path.startsWith(r))

  // API routes handle their own auth — never redirect them
  if (!user && !isPublicRoute && !path.startsWith('/api/')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user) {
    // Check role for admin routes
    if (path.startsWith('/admin')) {
      const { data: profile } = await supabase
        .from('app_users')
        .select('role')
        .eq('id', user.id)
        .single()

      if (!profile || !['admin', 'event_assistant'].includes(profile.role)) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }

      // Event assistants can only access check-in
      if (profile.role === 'event_assistant' && !path.startsWith('/admin/check-in')) {
        const url = request.nextUrl.clone()
        url.pathname = '/admin/check-in'
        return NextResponse.redirect(url)
      }
    }

    // Redirect logged-in users away from auth pages
    if (isPublicRoute && path !== '/auth-callback') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
