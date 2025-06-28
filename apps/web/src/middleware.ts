import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { DomainResolver, createDomainResolver } from './lib/white-label/domain-resolver'
import { gdprMiddleware, shouldShowCookieBanner } from './middleware/gdpr'
import { checkRateLimit, RATE_LIMITS } from './lib/security/rate-limiter'
import { ApiKeyManager } from './lib/security/api-keys'
import { MetricsCollector, rateLimitHits } from './lib/monitoring/metrics'

// Create domain resolver instance (shared across requests)
const domainResolver = createDomainResolver({
  enableCaching: true,
  cacheTimeout: 5 * 60 * 1000, // 5 minutes
  maxRetries: 3,
})

// Paths that allow API key authentication
const API_KEY_ALLOWED_PATHS = [
  '/api/leads',
  '/api/campaigns',
  '/api/analytics',
  '/api/email',
  '/api/webhooks',
]

export async function middleware(request: NextRequest) {
  const startTime = Date.now()
  const pathname = request.nextUrl.pathname
  
  try {
    // ====================================
    // 1. Rate Limiting & Security
    // ====================================
    
    // Apply advanced rate limiting to API routes
    if (pathname.startsWith('/api/')) {
      const rateLimitResponse = await applyRateLimit(request, pathname)
      if (rateLimitResponse) {
        return rateLimitResponse
      }
    }

    // ====================================
    // 2. Domain Detection & Resolution
    // ====================================
    
    const domainContext = await domainResolver.resolveDomain(request)

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
    
    // Check API key authentication for API routes
    if (pathname.startsWith('/api/') && isApiKeyAllowedPath(pathname)) {
      const apiKeyResponse = await checkApiKeyAuth(request, pathname)
      if (apiKeyResponse) {
        return apiKeyResponse
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
            
            // Store subscription info to add to headers later
            supabaseResponse.headers.set('x-subscription-status', subscription.status)
            supabaseResponse.headers.set('x-subscription-plan', subscription.plan?.slug || 'none')
            if (trialEnd) {
              supabaseResponse.headers.set('x-trial-end', trialEnd.toISOString())
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
    headers.set('x-xss-protection', '1; mode=block')
    headers.set('referrer-policy', 'strict-origin-when-cross-origin')
    headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()')
    
    // Content Security Policy
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' https://api.stripe.com https://*.supabase.co wss://*.supabase.co https://api.openai.com https://api.anthropic.com",
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; ')
    
    headers.set('content-security-policy', csp)
    
    // HSTS (only in production)
    if (process.env.NODE_ENV === 'production') {
      headers.set(
        'strict-transport-security',
        'max-age=31536000; includeSubDomains; preload'
      )
    }
    
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

    // ====================================
    // 11. Metrics Collection
    // ====================================
    
    // Record HTTP request metrics
    const responseTime = Date.now() - startTime
    const statusCode = finalResponse.status
    
    MetricsCollector.recordHttpRequest(
      request.method,
      pathname,
      statusCode,
      responseTime,
      workspaceId
    )
    
    // Record API usage if this was an API request
    if (pathname.startsWith('/api/')) {
      MetricsCollector.recordApiUsage(
        pathname,
        request.method,
        workspaceId,
        request.headers.get('X-API-Key-Id') || undefined
      )
    }

    return finalResponse

  } catch (error) {
    console.error('Middleware error:', error)
    
    // Record error metrics
    MetricsCollector.recordError(
      'middleware_error',
      pathname,
      'error'
    )
    
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
 * Apply rate limiting based on route
 */
async function applyRateLimit(
  request: NextRequest,
  pathname: string
): Promise<Response | null> {
  // Determine rate limit config based on path
  let config;
  
  if (pathname.startsWith('/api/auth/signin')) {
    config = RATE_LIMITS.auth.signin;
  } else if (pathname.startsWith('/api/auth/signup')) {
    config = RATE_LIMITS.auth.signup;
  } else if (pathname.startsWith('/api/auth/reset-password')) {
    config = RATE_LIMITS.auth.passwordReset;
  } else if (pathname.startsWith('/api/enrichment')) {
    config = RATE_LIMITS.api.enrichment;
  } else if (pathname.startsWith('/api/ai')) {
    config = RATE_LIMITS.api.ai;
  } else if (pathname.startsWith('/api/export')) {
    config = RATE_LIMITS.api.export;
  } else if (pathname.startsWith('/api/upload')) {
    config = RATE_LIMITS.api.upload;
  } else if (pathname.startsWith('/api/email/track')) {
    config = RATE_LIMITS.public.tracking;
  } else if (pathname.startsWith('/api/unsubscribe')) {
    config = RATE_LIMITS.public.unsubscribe;
  } else if (pathname.startsWith('/api/webhooks')) {
    config = RATE_LIMITS.webhooks.default;
  } else if (pathname.startsWith('/api/leads')) {
    config = RATE_LIMITS.api.leads;
  } else if (pathname.startsWith('/api/campaigns')) {
    config = RATE_LIMITS.api.campaigns;
  } else {
    config = RATE_LIMITS.api.default;
  }

  const rateLimitResult = await checkRateLimit(request, config);
  
  // Record rate limit hit if request was blocked
  if (rateLimitResult && rateLimitResult.status === 429) {
    rateLimitHits.labels(pathname, 'user').inc();
  }
  
  return rateLimitResult;
}

/**
 * Check if path allows API key authentication
 */
function isApiKeyAllowedPath(pathname: string): boolean {
  return API_KEY_ALLOWED_PATHS.some(path => pathname.startsWith(path));
}

/**
 * Extract API key from request
 */
function extractApiKey(request: NextRequest): string | null {
  // Check Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer cc_')) {
    return authHeader.substring(7); // Remove 'Bearer ' prefix
  }
  
  // Check X-API-Key header
  const apiKeyHeader = request.headers.get('x-api-key');
  if (apiKeyHeader?.startsWith('cc_')) {
    return apiKeyHeader;
  }
  
  return null;
}

/**
 * Check API key authentication
 */
async function checkApiKeyAuth(
  request: NextRequest,
  pathname: string
): Promise<Response | null> {
  const apiKey = extractApiKey(request);
  
  if (!apiKey) {
    return null; // No API key provided, continue with regular auth
  }
  
  const validation = await ApiKeyManager.validateApiKey(apiKey);
  
  if (!validation.valid) {
    return new Response(
      JSON.stringify({ error: validation.error || 'Invalid API key' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  // Check scope
  const requiredScope = getRequiredScope(pathname, request.method);
  if (requiredScope && !ApiKeyManager.hasScope(validation.apiKey!, requiredScope)) {
    return new Response(
      JSON.stringify({ error: 'Insufficient permissions' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  // Add API key context to headers
  request.headers.set('X-API-Key-Id', validation.apiKey!.id);
  request.headers.set('X-Workspace-Id', validation.apiKey!.workspace_id);
  request.headers.set('X-API-Key-Auth', 'true');
  
  return null; // Authentication successful
}

/**
 * Get required scope for API endpoint
 */
function getRequiredScope(pathname: string, method: string): string | null {
  if (pathname.startsWith('/api/leads')) {
    if (method === 'GET') return 'leads.read';
    if (method === 'POST' || method === 'PUT' || method === 'PATCH') return 'leads.write';
    if (method === 'DELETE') return 'leads.delete';
    if (pathname.includes('/import')) return 'leads.import';
    if (pathname.includes('/export')) return 'leads.export';
    if (pathname.includes('/enrich')) return 'leads.enrich';
  }
  
  if (pathname.startsWith('/api/campaigns')) {
    if (method === 'GET') return 'campaigns.read';
    if (method === 'POST' || method === 'PUT' || method === 'PATCH') return 'campaigns.write';
    if (method === 'DELETE') return 'campaigns.delete';
    if (pathname.includes('/send')) return 'campaigns.send';
  }
  
  if (pathname.startsWith('/api/email')) {
    if (pathname.includes('/send')) return 'email.send';
    if (pathname.includes('/track')) return 'email.track';
    return 'email.read';
  }
  
  if (pathname.startsWith('/api/analytics')) {
    return 'analytics.read';
  }
  
  if (pathname.startsWith('/api/workspace')) {
    if (method === 'GET') return 'workspace.read';
    if (pathname.includes('/members')) return 'workspace.members';
    return 'workspace.write';
  }
  
  if (pathname.startsWith('/api/webhooks')) {
    if (method === 'GET') return 'webhooks.read';
    return 'webhooks.write';
  }
  
  return null;
}

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