import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function authMiddleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => 
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Define public routes that don't require authentication
  const publicRoutes = [
    '/auth/login',
    '/auth/signup',
    '/auth/reset-password',
    '/auth/verify',
    '/',
    '/pricing',
    '/features',
    '/about',
    '/contact'
  ]

  const isPublicRoute = publicRoutes.some(route => 
    request.nextUrl.pathname.startsWith(route)
  )

  // Redirect to login if accessing protected route without auth
  if (!user && !isPublicRoute) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/auth/login'
    redirectUrl.searchParams.set('redirectTo', request.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Redirect to dashboard if accessing auth routes while authenticated
  if (user && request.nextUrl.pathname.startsWith('/auth/')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Check workspace access for workspace-specific routes
  if (user && request.nextUrl.pathname.startsWith('/dashboard')) {
    const { data: workspaces } = await supabase
      .rpc('get_user_workspaces', { user_id: user.id })

    if (!workspaces || workspaces.length === 0) {
      // User has no workspaces, redirect to onboarding
      return NextResponse.redirect(new URL('/onboarding/workspace', request.url))
    }

    // Set workspace context in headers for server components
    const currentWorkspace = workspaces.find(w => w.is_default) || workspaces[0]
    response.headers.set('x-workspace-id', currentWorkspace.workspace_id)
    response.headers.set('x-workspace-role', currentWorkspace.role)
  }

  return response
}