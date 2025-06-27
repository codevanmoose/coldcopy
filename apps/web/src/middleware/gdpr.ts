/**
 * GDPR Compliance Middleware
 * Handles consent checking, cookie policies, analytics blocking, and GDPR headers
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { gdprService } from '@/lib/gdpr/gdpr-service'
import { ConsentType, ConsentStatus } from '@/lib/gdpr/types'

// Cookie names
const CONSENT_COOKIE = 'gdpr-consent'
const VISITOR_ID_COOKIE = 'visitor-id'
const COOKIE_BANNER_DISMISSED = 'cookie-banner-dismissed'

// Analytics and tracking domains to block
const TRACKING_DOMAINS = [
  'google-analytics.com',
  'googletagmanager.com',
  'facebook.com',
  'doubleclick.net',
  'segment.io',
  'mixpanel.com',
  'amplitude.com',
  'heap.io',
  'hotjar.com',
  'fullstory.com',
  'clarity.ms',
  'mouseflow.com',
]

// GDPR-compliant headers
const GDPR_HEADERS = {
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-XSS-Protection': '1; mode=block',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  'Feature-Policy': 'geolocation none; microphone none; camera none',
}

export interface GdprContext {
  visitorId: string
  hasConsent: Record<ConsentType, boolean>
  consentVersion?: string
  isEuVisitor: boolean
  cookieConsent?: {
    necessary: boolean
    functional: boolean
    analytics: boolean
    marketing: boolean
  }
}

/**
 * Check if the visitor is from EU based on various signals
 */
function isEuVisitor(request: NextRequest): boolean {
  // Check CloudFlare CF-IPCountry header
  const country = request.headers.get('cf-ipcountry')
  if (country) {
    const euCountries = [
      'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
      'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
      'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
    ]
    return euCountries.includes(country.toUpperCase())
  }

  // Check timezone (fallback)
  const timezone = request.headers.get('x-timezone')
  if (timezone && timezone.startsWith('Europe/')) {
    return true
  }

  // Check accept-language header for EU languages
  const acceptLanguage = request.headers.get('accept-language')
  if (acceptLanguage) {
    const euLanguages = ['de', 'fr', 'it', 'es', 'pl', 'nl', 'pt', 'sv', 'fi', 'da']
    const primaryLang = acceptLanguage.split(',')[0]?.split('-')[0]?.toLowerCase()
    if (primaryLang && euLanguages.includes(primaryLang)) {
      return true
    }
  }

  // Default to true for safety
  return true
}

/**
 * Get or create visitor ID
 */
function getVisitorId(request: NextRequest): string {
  const existingId = request.cookies.get(VISITOR_ID_COOKIE)?.value
  if (existingId) return existingId

  // Generate new visitor ID
  return crypto.randomUUID()
}

/**
 * Parse consent cookie
 */
function parseConsentCookie(cookieValue: string | undefined): GdprContext['cookieConsent'] {
  if (!cookieValue) {
    return {
      necessary: true, // Always true
      functional: false,
      analytics: false,
      marketing: false,
    }
  }

  try {
    const parsed = JSON.parse(cookieValue)
    return {
      necessary: true,
      functional: parsed.functional || false,
      analytics: parsed.analytics || false,
      marketing: parsed.marketing || false,
    }
  } catch {
    return {
      necessary: true,
      functional: false,
      analytics: false,
      marketing: false,
    }
  }
}

/**
 * Check consent for a specific type
 */
async function checkConsent(
  workspaceId: string,
  visitorId: string,
  consentType: ConsentType
): Promise<boolean> {
  try {
    const supabase = createClient()
    const { consents } = await gdprService.checkConsent({
      workspaceId,
      consentTypes: [consentType],
    })

    return consents[consentType]?.granted || false
  } catch (error) {
    console.error('Failed to check consent:', error)
    return false
  }
}

/**
 * Block tracking scripts based on consent
 */
function shouldBlockScript(url: string, consent: GdprContext['cookieConsent']): boolean {
  const urlLower = url.toLowerCase()

  // Check if URL contains tracking domains
  for (const domain of TRACKING_DOMAINS) {
    if (urlLower.includes(domain)) {
      // Google Analytics requires analytics consent
      if (domain.includes('google') && !consent?.analytics) return true
      // Social media pixels require marketing consent
      if (domain.includes('facebook') && !consent?.marketing) return true
      // Other analytics tools
      if (!consent?.analytics) return true
    }
  }

  return false
}

/**
 * Inject GDPR headers into response
 */
function injectGdprHeaders(response: NextResponse, gdprContext: GdprContext): void {
  // Add GDPR compliance headers
  Object.entries(GDPR_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  // Add consent status headers
  response.headers.set('X-GDPR-Consent-Status', JSON.stringify(gdprContext.hasConsent))
  response.headers.set('X-GDPR-EU-Visitor', String(gdprContext.isEuVisitor))

  // Content Security Policy based on consent
  const cspDirectives = [
    "default-src 'self'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self'",
  ]

  if (gdprContext.cookieConsent?.analytics) {
    cspDirectives.push("script-src 'self' https://www.google-analytics.com https://www.googletagmanager.com")
    cspDirectives.push("connect-src 'self' https://www.google-analytics.com")
  }

  if (gdprContext.cookieConsent?.marketing) {
    cspDirectives.push("script-src 'self' https://connect.facebook.net")
    cspDirectives.push("connect-src 'self' https://www.facebook.com")
  }

  response.headers.set('Content-Security-Policy', cspDirectives.join('; '))
}

/**
 * GDPR Middleware
 */
export async function gdprMiddleware(
  request: NextRequest,
  response: NextResponse,
  workspaceId?: string
): Promise<NextResponse> {
  try {
    // Get visitor context
    const visitorId = getVisitorId(request)
    const isEu = isEuVisitor(request)
    const consentCookie = request.cookies.get(CONSENT_COOKIE)?.value
    const cookieConsent = parseConsentCookie(consentCookie)

    // Build GDPR context
    const gdprContext: GdprContext = {
      visitorId,
      hasConsent: {
        [ConsentType.MARKETING]: cookieConsent.marketing,
        [ConsentType.TRACKING]: cookieConsent.analytics,
        [ConsentType.DATA_PROCESSING]: true, // Assumed for logged-in users
        [ConsentType.COOKIES]: cookieConsent.functional,
        [ConsentType.PROFILING]: cookieConsent.marketing,
        [ConsentType.THIRD_PARTY_SHARING]: cookieConsent.marketing,
        [ConsentType.NEWSLETTER]: false, // Checked separately
        [ConsentType.PRODUCT_UPDATES]: false, // Checked separately
      },
      isEuVisitor: isEu,
      cookieConsent,
    }

    // For authenticated requests, check database consent
    if (workspaceId) {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // Check marketing consent
        gdprContext.hasConsent[ConsentType.MARKETING] = await checkConsent(
          workspaceId,
          user.id,
          ConsentType.MARKETING
        )

        // Check newsletter consent
        gdprContext.hasConsent[ConsentType.NEWSLETTER] = await checkConsent(
          workspaceId,
          user.id,
          ConsentType.NEWSLETTER
        )
      }
    }

    // Clone response to modify
    const modifiedResponse = new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: new Headers(response.headers),
    })

    // Inject GDPR headers
    injectGdprHeaders(modifiedResponse, gdprContext)

    // Set visitor ID cookie if new
    if (!request.cookies.get(VISITOR_ID_COOKIE)) {
      modifiedResponse.cookies.set(VISITOR_ID_COOKIE, visitorId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 365 * 24 * 60 * 60, // 1 year
      })
    }

    // Add GDPR context to request headers for downstream use
    modifiedResponse.headers.set('x-gdpr-context', JSON.stringify(gdprContext))

    // Block third-party scripts if no consent
    if (!cookieConsent.analytics || !cookieConsent.marketing) {
      // This would be handled by CSP headers and client-side script blocking
      modifiedResponse.headers.set('x-block-tracking', 'true')
    }

    return modifiedResponse
  } catch (error) {
    console.error('GDPR middleware error:', error)
    // Return original response on error
    return response
  }
}

/**
 * Check if request should show cookie banner
 */
export function shouldShowCookieBanner(request: NextRequest): boolean {
  // Check if banner was dismissed
  const dismissed = request.cookies.get(COOKIE_BANNER_DISMISSED)?.value
  if (dismissed === 'true') return false

  // Check if consent exists
  const consent = request.cookies.get(CONSENT_COOKIE)?.value
  if (consent) return false

  // Show banner for EU visitors or if we can't determine location
  return isEuVisitor(request)
}

/**
 * Record cookie consent
 */
export async function recordCookieConsent(
  request: NextRequest,
  consent: {
    necessary: boolean
    functional: boolean
    analytics: boolean
    marketing: boolean
  },
  workspaceId?: string
): Promise<void> {
  const visitorId = getVisitorId(request)

  // Record in database if workspace is available
  if (workspaceId) {
    try {
      await gdprService.recordCookieConsent({
        workspaceId,
        visitorId,
        necessary: consent.necessary,
        functional: consent.functional,
        analytics: consent.analytics,
        marketing: consent.marketing,
        ipAddress: request.ip || request.headers.get('x-forwarded-for') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      })
    } catch (error) {
      console.error('Failed to record cookie consent:', error)
    }
  }
}

/**
 * Create analytics blocking script
 */
export function createAnalyticsBlockingScript(consent: GdprContext['cookieConsent']): string {
  return `
    (function() {
      // Block Google Analytics if no consent
      if (!${consent?.analytics}) {
        window['ga-disable-GA_MEASUREMENT_ID'] = true;
        window.gtag = function() {};
      }

      // Block Facebook Pixel if no consent
      if (!${consent?.marketing}) {
        window.fbq = function() {};
      }

      // Block other tracking scripts
      const blockPatterns = ${JSON.stringify(TRACKING_DOMAINS)};
      const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
          mutation.addedNodes.forEach(function(node) {
            if (node.tagName === 'SCRIPT' && node.src) {
              for (const pattern of blockPatterns) {
                if (node.src.includes(pattern)) {
                  node.remove();
                  console.log('Blocked tracking script:', node.src);
                }
              }
            }
          });
        });
      });

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    })();
  `
}