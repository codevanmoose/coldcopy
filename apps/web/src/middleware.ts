import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  
  try {
    // Create response
    let supabaseResponse = NextResponse.next({ request })
    
    // Create Supabase client
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    // Get user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Define public routes
    const publicRoutes = [
      '/login', '/signup', '/auth/callback', '/auth/confirm', 
      '/forgot-password', '/reset-password', '/unsubscribe',
      '/api/webhooks/', '/api/track/', '/track/',
      '/favicon.ico', '/robots.txt', '/sitemap.xml',
      '/pricing', '/', // Allow access to pricing and landing page
      '/privacy-policy', '/terms-of-service', // Legal pages should be public
    ]
    
    const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))

    // Redirect to login if not authenticated and not public route
    if (!user && !isPublicRoute) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('redirectTo', pathname)
      return NextResponse.redirect(url)
    }

    // Redirect authenticated users away from auth pages
    if (user && (pathname.startsWith('/login') || pathname.startsWith('/signup'))) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    return supabaseResponse

  } catch (error) {
    console.error('Middleware error:', error)
    
    // Return a fallback response
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets
     * - api routes
     * - manifest and service worker files
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot)$|api/).*)',
  ],
}