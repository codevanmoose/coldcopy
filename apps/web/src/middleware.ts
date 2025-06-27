import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { DomainResolver, createDomainResolver } from './lib/white-label/domain-resolver'
import { gdprMiddleware, shouldShowCookieBanner } from './middleware/gdpr'

// Create domain resolver instance (shared across requests)
const domainResolver = createDomainResolver({
  enableCaching: true,
  cacheTimeout: 5 * 60 * 1000, // 5 minutes
  maxRetries: 3,
})

// Rate limiting for security
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100

export async function middleware(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // ====================================
    // 1. Rate Limiting & Security
    // ====================================
    
    const clientIP = request.ip || request.headers.get('x-forwarded-for') || 'unknown'
    const now = Date.now()
    
    // Clean up expired rate limit entries
    for (const [ip, data] of rateLimitMap.entries()) {
      if (now > data.resetTime) {
        rateLimitMap.delete(ip)
      }
    }
    
    // Check rate limit
    const rateLimit = rateLimitMap.get(clientIP)
    if (rateLimit) {
      if (now < rateLimit.resetTime) {
        rateLimit.count++
        if (rateLimit.count > RATE_LIMIT_MAX_REQUESTS) {
          return new NextResponse('Too Many Requests', { 
            status: 429,
            headers: {
              'Retry-After': String(Math.ceil((rateLimit.resetTime - now) / 1000)),
            },
          })
        }
      } else {
        // Reset window
        rateLimit.count = 1
        rateLimit.resetTime = now + RATE_LIMIT_WINDOW
      }
    } else {
      // First request from this IP
      rateLimitMap.set(clientIP, {
        count: 1,
        resetTime: now + RATE_LIMIT_WINDOW,
      })
    }

    // ====================================
    // 2. Domain Detection & Resolution
    // ====================================
    
    const domainContext = await domainResolver.resolveDomain(request)
    const pathname = request.nextUrl.pathname

    // ====================================
    // 3. Security Validation
    // ====================================
    
    // Validate domain ownership to prevent subdomain takeover
    if (domainContext.isCustomDomain) {
      const isValidOwnership = await domainResolver.validateDomainOwnership(domainContext)
      if (!isValidOwnership) {
        console.warn(`Invalid domain ownership: ${domainContext.domain}`)
        return new NextResponse('Domain not verified', { status: 403 })
      }
    }

    // ====================================
    // 4. Supabase Authentication
    // ====================================
    
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
            cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    // Get user with workspace context for white-label domains
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // ====================================
    // 5. White-Label Context Injection
    // ====================================
    
    let workspaceId: string | undefined = domainContext.workspaceId

    // For authenticated users on default domains, get their workspace
    if (user && !domainContext.isWhiteLabel) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('workspace_id')
          .eq('id', user.id)
          .single()
        
        workspaceId = profile?.workspace_id
      } catch (error) {
        console.warn('Failed to get user workspace:', error)
      }
    }

    // ====================================
    // 6. Routing Decision
    // ====================================
    
    const routingDecision = domainResolver.determineRouting(
      domainContext,
      pathname,
      !!user
    )

    // Handle routing actions
    switch (routingDecision.action) {
      case 'redirect':
        const redirectUrl = new URL(routingDecision.destination!, request.url)
        return NextResponse.redirect(redirectUrl, routingDecision.statusCode || 302)
      
      case 'block':
        return new NextResponse('Access Denied', { status: 403 })
      
      case 'rewrite':
        const rewriteUrl = new URL(routingDecision.destination!, request.url)
        supabaseResponse = NextResponse.rewrite(rewriteUrl)
        break
      
      case 'continue':
      default:
        // Continue with normal flow
        break
    }

    // ====================================
    // 7. Authentication Flow
    // ====================================
    
    // Define public routes
    const publicRoutes = [
      '/login', '/signup', '/auth/callback', '/auth/confirm', 
      '/forgot-password', '/reset-password', '/unsubscribe',
      '/api/webhooks/', '/api/track/', '/track/',
      '/favicon.ico', '/robots.txt', '/sitemap.xml',
      '/pricing', '/', // Allow access to pricing and landing page
    ]
    
    // White-label specific public routes
    const whiteLabelPublicRoutes = [
      '/white-label/login', '/white-label/signup', '/white-label/portal/',
    ]
    
    // API routes that bypass subscription checks
    const bypassSubscriptionRoutes = [
      '/api/billing/', '/api/auth/', '/api/webhooks/', '/api/track/',
    ]
    
    const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route)) ||
      (domainContext.isWhiteLabel && whiteLabelPublicRoutes.some(route => pathname.startsWith(route)))

    // Special handling for portal routes
    if (pathname.startsWith('/portal/')) {
      // Portal routes have their own authentication via access tokens
      const portalValidation = await validatePortalAccess(request, domainContext)
      if (!portalValidation.isValid) {
        const url = request.nextUrl.clone()
        url.pathname = '/portal/login'
        return NextResponse.redirect(url)
      }
    } else {
      // Standard authentication flow
      if (!user && !isPublicRoute) {
        const url = request.nextUrl.clone()
        url.pathname = domainContext.isWhiteLabel ? '/white-label/login' : '/login'
        url.searchParams.set('redirectTo', pathname)
        return NextResponse.redirect(url)
      }

      // Redirect authenticated users away from auth pages
      if (user && (pathname.startsWith('/login') || pathname.startsWith('/signup'))) {
        const url = request.nextUrl.clone()
        url.pathname = domainContext.isWhiteLabel ? '/white-label/dashboard' : '/dashboard'
        return NextResponse.redirect(url)
      }

      // ====================================
      // 7.1 Subscription & Trial Checks
      // ====================================
      
      // Skip subscription checks for bypass routes
      const shouldCheckSubscription = !bypassSubscriptionRoutes.some(route => pathname.startsWith(route))
      
      if (user && workspaceId && shouldCheckSubscription && !isPublicRoute) {
        try {
          // Check subscription status
          const { data: subscription } = await supabase
            .from('subscriptions')
            .select(`
              id,
              status,
              trial_end,
              plan:subscription_plans(
                slug,
                name
              )
            `)
            .eq('workspace_id', workspaceId)
            .single()

          if (subscription) {
            const now = new Date()
            const trialEnd = subscription.trial_end ? new Date(subscription.trial_end) : null
            
            // Check if trial has expired (with grace period)
            if (subscription.status === 'trialing' && trialEnd) {
              const gracePeriodEnd = new Date(trialEnd.getTime() + (3 * 24 * 60 * 60 * 1000)) // 3 days grace
              
              if (now > gracePeriodEnd) {
                // Trial expired and grace period over - redirect to billing
                if (!pathname.startsWith('/settings/billing')) {
                  const url = request.nextUrl.clone()
                  url.pathname = '/settings/billing'
                  url.searchParams.set('trial_expired', 'true')
                  return NextResponse.redirect(url)
                }
              }
            }
            
            // Check if subscription is canceled or past due
            if (subscription.status === 'canceled' || subscription.status === 'past_due') {
              // Allow access to settings and billing pages
              const allowedPaths = ['/settings', '/settings/billing', '/dashboard']
              if (!allowedPaths.some(path => pathname.startsWith(path))) {
                const url = request.nextUrl.clone()
                url.pathname = '/settings/billing'
                url.searchParams.set('subscription_inactive', 'true')
                return NextResponse.redirect(url)
              }
            }
            
            // Add subscription info to headers
            headers.set('x-subscription-status', subscription.status)
            headers.set('x-subscription-plan', subscription.plan?.slug || 'none')
            if (trialEnd) {
              headers.set('x-trial-end', trialEnd.toISOString())
            }
          }
        } catch (error) {
          console.warn('Failed to check subscription status:', error)
        }
      }
    }

    // ====================================
    // 8. GDPR Compliance
    // ====================================
    
    // Apply GDPR middleware
    const gdprResponse = await gdprMiddleware(request, supabaseResponse, workspaceId)
    
    // ====================================
    // 9. Header Injection
    // ====================================
    
    // Base headers
    const headers = new Headers(gdprResponse.headers)
    
    // Performance headers
    headers.set('x-response-time', `${Date.now() - startTime}ms`)
    headers.set('x-cache-status', domainContext.isWhiteLabel ? 'MISS' : 'HIT')
    
    // White-label context headers
    if (domainContext.isWhiteLabel) {
      headers.set('x-white-label', 'true')
      headers.set('x-workspace-id', domainContext.workspaceId!)
      headers.set('x-domain', domainContext.domain)
      
      if (domainContext.subdomain) {
        headers.set('x-subdomain', domainContext.subdomain)
      }
      
      // Branding headers
      const brandingHeaders = domainResolver.generateBrandingHeaders(domainContext)
      Object.entries(brandingHeaders).forEach(([key, value]) => {
        headers.set(key, value)
      })
      
      // Feature flags
      if (domainContext.settings?.feature_flags) {
        headers.set('x-feature-flags', JSON.stringify(domainContext.settings.feature_flags))
      }
    }
    
    // Security headers
    headers.set('x-frame-options', 'DENY')
    headers.set('x-content-type-options', 'nosniff')
    headers.set('referrer-policy', 'strict-origin-when-cross-origin')
    
    // Workspace context for all authenticated requests
    if (workspaceId) {
      headers.set('x-workspace-id', workspaceId)
    }
    
    // User context
    if (user) {
      headers.set('x-user-id', user.id)
      headers.set('x-authenticated', 'true')
    }

    // Check if should show cookie banner
    if (shouldShowCookieBanner(request)) {
      headers.set('x-show-cookie-banner', 'true')
    }
    
    // ====================================
    // 10. Response Finalization
    // ====================================
    
    // Create final response with all headers
    const finalResponse = new NextResponse(gdprResponse.body, {
      status: gdprResponse.status,
      statusText: gdprResponse.statusText,
      headers,
    })

    // Copy cookies from gdpr response
    gdprResponse.cookies.getAll().forEach(cookie => {
      finalResponse.cookies.set(cookie)
    })

    // Cleanup cache periodically (every 100 requests approximately)
    if (Math.random() < 0.01) {
      domainResolver.cleanupCache()
    }

    return finalResponse

  } catch (error) {
    console.error('Middleware error:', error)
    
    // Return a fallback response
    return NextResponse.next({
      headers: {
        'x-middleware-error': 'true',
        'x-response-time': `${Date.now() - startTime}ms`,
      },
    })
  }
}

// ====================================
// Helper Functions
// ====================================

/**
 * Validate portal access using access token
 */
async function validatePortalAccess(
  request: NextRequest, 
  domainContext: any
): Promise<{ isValid: boolean; portalId?: string; clientId?: string }> {
  const pathname = request.nextUrl.pathname
  const pathParts = pathname.split('/')
  const portalId = pathParts[2]
  
  if (!portalId) {
    return { isValid: false }
  }
  
  // Get access token from query params or headers
  const url = new URL(request.url)
  const accessToken = url.searchParams.get('token') || 
    request.headers.get('authorization')?.replace('Bearer ', '') ||
    request.cookies.get('portal-token')?.value
  
  if (!accessToken) {
    return { isValid: false }
  }
  
  try {
    // Validate portal access via API
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/validate_portal_access`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        p_portal_url: portalId,
        p_access_token: accessToken,
      }),
    })
    
    if (!response.ok) {
      return { isValid: false }
    }
    
    const data = await response.json()
    return {
      isValid: data && data.length > 0 && data[0].is_valid,
      portalId: data[0]?.portal_id,
      clientId: data[0]?.client_id,
    }
  } catch (error) {
    console.error('Portal validation error:', error)
    return { isValid: false }
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
     * - api routes (except auth callbacks)
     * - manifest and service worker files
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot)$|api/(?!auth|webhooks)).*)',
  ],
}