/**
 * Consent-Aware Analytics Tracking
 * Wraps analytics functionality with consent checks
 */

import React from 'react'
import { ConsentType } from '@/lib/gdpr/types'

// Types
interface TrackingConsent {
  analytics: boolean
  marketing: boolean
  functional: boolean
}

interface TrackingEvent {
  event: string
  properties?: Record<string, any>
  userId?: string
  anonymousId?: string
}

interface PageViewEvent {
  url: string
  title?: string
  referrer?: string
  properties?: Record<string, any>
}

// Global consent state
let consentState: TrackingConsent = {
  analytics: false,
  marketing: false,
  functional: false,
}

// Queue for events that occur before consent is loaded
let eventQueue: Array<{ type: 'track' | 'page' | 'identify'; data: any }> = []

/**
 * Initialize consent state from cookies or GDPR context
 */
export function initializeConsent(consent: Partial<TrackingConsent>) {
  consentState = {
    analytics: consent.analytics || false,
    marketing: consent.marketing || false,
    functional: consent.functional || false,
  }

  // Process queued events if consent is granted
  if (consentState.analytics || consentState.marketing) {
    processEventQueue()
  }
}

/**
 * Update consent state
 */
export function updateConsent(consent: Partial<TrackingConsent>) {
  const previousState = { ...consentState }
  consentState = { ...consentState, ...consent }

  // If analytics was just enabled, process queue
  if (!previousState.analytics && consentState.analytics) {
    processEventQueue()
  }

  // If consent was revoked, clear tracking cookies
  if (previousState.analytics && !consentState.analytics) {
    clearTrackingCookies()
  }
}

/**
 * Check if tracking is allowed for a specific type
 */
export function isTrackingAllowed(type: 'analytics' | 'marketing' | 'functional'): boolean {
  return consentState[type] || false
}

/**
 * Track an event with consent check
 */
export function track(event: TrackingEvent): void {
  if (!consentState.analytics) {
    // Queue event for later if no consent yet
    eventQueue.push({ type: 'track', data: event })
    return
  }

  // Send to analytics providers
  try {
    // Google Analytics
    if (window.gtag && consentState.analytics) {
      window.gtag('event', event.event, {
        ...event.properties,
        user_id: event.userId,
      })
    }

    // Segment
    if (window.analytics && consentState.analytics) {
      window.analytics.track(event.event, event.properties, {
        userId: event.userId,
        anonymousId: event.anonymousId,
      })
    }

    // Facebook Pixel (marketing events only)
    if (window.fbq && consentState.marketing) {
      window.fbq('track', event.event, event.properties)
    }

    // Custom tracking endpoint
    if (consentState.analytics) {
      sendToCustomEndpoint('track', event)
    }
  } catch (error) {
    console.error('Tracking error:', error)
  }
}

/**
 * Track a page view with consent check
 */
export function page(event: PageViewEvent): void {
  if (!consentState.analytics) {
    eventQueue.push({ type: 'page', data: event })
    return
  }

  try {
    // Google Analytics
    if (window.gtag && consentState.analytics) {
      window.gtag('event', 'page_view', {
        page_path: event.url,
        page_title: event.title,
        page_referrer: event.referrer,
        ...event.properties,
      })
    }

    // Segment
    if (window.analytics && consentState.analytics) {
      window.analytics.page(event.title, event.properties)
    }

    // Custom tracking
    if (consentState.analytics) {
      sendToCustomEndpoint('page', event)
    }
  } catch (error) {
    console.error('Page tracking error:', error)
  }
}

/**
 * Identify a user with consent check
 */
export function identify(userId: string, traits?: Record<string, any>): void {
  if (!consentState.analytics) {
    eventQueue.push({ type: 'identify', data: { userId, traits } })
    return
  }

  try {
    // Google Analytics
    if (window.gtag && consentState.analytics) {
      window.gtag('config', 'GA_MEASUREMENT_ID', {
        user_id: userId,
        user_properties: traits,
      })
    }

    // Segment
    if (window.analytics && consentState.analytics) {
      window.analytics.identify(userId, traits)
    }

    // Custom tracking
    if (consentState.analytics) {
      sendToCustomEndpoint('identify', { userId, traits })
    }
  } catch (error) {
    console.error('Identify error:', error)
  }
}

/**
 * Track email events (opens, clicks) with consent check
 */
export function trackEmail(
  eventType: 'open' | 'click',
  emailId: string,
  metadata?: Record<string, any>
): void {
  // Email tracking requires both analytics and marketing consent
  if (!consentState.analytics || !consentState.marketing) {
    console.log('Email tracking blocked due to lack of consent')
    return
  }

  // Use a tracking pixel or beacon API
  const trackingUrl = `/api/track/${eventType}`
  const params = new URLSearchParams({
    email_id: emailId,
    ...metadata,
  })

  // Use Beacon API for reliability
  if (navigator.sendBeacon) {
    navigator.sendBeacon(`${trackingUrl}?${params}`)
  } else {
    // Fallback to fetch
    fetch(`${trackingUrl}?${params}`, {
      method: 'POST',
      keepalive: true,
    }).catch(() => {
      // Ignore errors
    })
  }
}

/**
 * Block tracking pixels based on consent
 */
export function blockTrackingPixels(): void {
  if (!consentState.analytics || !consentState.marketing) {
    // Find and remove tracking pixels
    const pixels = document.querySelectorAll('img[src*="track"], img[src*="pixel"]')
    pixels.forEach((pixel) => {
      const img = pixel as HTMLImageElement
      // Replace with transparent 1x1 pixel
      img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
      img.style.display = 'none'
    })
  }
}

/**
 * Process queued events after consent is granted
 */
function processEventQueue(): void {
  const queue = [...eventQueue]
  eventQueue = []

  queue.forEach(({ type, data }) => {
    switch (type) {
      case 'track':
        track(data)
        break
      case 'page':
        page(data)
        break
      case 'identify':
        identify(data.userId, data.traits)
        break
    }
  })
}

/**
 * Clear tracking cookies when consent is revoked
 */
function clearTrackingCookies(): void {
  const trackingCookies = [
    '_ga',
    '_gid',
    '_gat',
    '_fbp',
    'amplitude_id',
    'mp_',
    'ajs_user_id',
    'ajs_anonymous_id',
  ]

  trackingCookies.forEach((cookieName) => {
    // Clear cookie for current domain
    document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
    // Clear cookie for subdomain
    document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${window.location.hostname};`
  })

  // Clear localStorage items
  const trackingKeys = Object.keys(localStorage).filter(
    (key) =>
      key.includes('amplitude') ||
      key.includes('segment') ||
      key.includes('analytics') ||
      key.includes('mixpanel')
  )
  trackingKeys.forEach((key) => localStorage.removeItem(key))

  // Clear sessionStorage items
  const sessionKeys = Object.keys(sessionStorage).filter(
    (key) =>
      key.includes('amplitude') ||
      key.includes('segment') ||
      key.includes('analytics') ||
      key.includes('mixpanel')
  )
  sessionKeys.forEach((key) => sessionStorage.removeItem(key))
}

/**
 * Send tracking data to custom endpoint
 */
async function sendToCustomEndpoint(
  type: 'track' | 'page' | 'identify',
  data: any
): Promise<void> {
  try {
    await fetch('/api/analytics/collect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type,
        data,
        timestamp: new Date().toISOString(),
        consent: consentState,
      }),
    })
  } catch (error) {
    // Silently fail
  }
}

/**
 * Hook for React components to check consent state
 */
export function useTrackingConsent(): TrackingConsent {
  return { ...consentState }
}

/**
 * HOC to wrap components that need tracking
 */
export function withTrackingConsent<P extends object>(
  Component: React.ComponentType<P & { trackingConsent: TrackingConsent }>
): React.ComponentType<P> {
  return function WrappedComponent(props: P) {
    return React.createElement(Component, { ...props, trackingConsent: consentState } as P & { trackingConsent: TrackingConsent })
  }
}

// Auto-initialize from window context if available
if (typeof window !== 'undefined') {
  // Check for consent cookie
  const consentCookie = document.cookie
    .split('; ')
    .find((row) => row.startsWith('gdpr-consent='))
    ?.split('=')[1]

  if (consentCookie) {
    try {
      const consent = JSON.parse(decodeURIComponent(consentCookie))
      initializeConsent(consent)
    } catch (error) {
      console.error('Failed to parse consent cookie:', error)
    }
  }

  // Listen for consent updates
  window.addEventListener('gdpr-consent-updated', ((event: CustomEvent) => {
    updateConsent(event.detail)
  }) as EventListener)

  // Block tracking pixels on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', blockTrackingPixels)
  } else {
    blockTrackingPixels()
  }
}

// Type declarations for window objects
declare global {
  interface Window {
    gtag?: (...args: any[]) => void
    analytics?: {
      track: (event: string, properties?: any, options?: any) => void
      page: (name?: string, properties?: any) => void
      identify: (userId: string, traits?: any) => void
    }
    fbq?: (...args: any[]) => void
  }
}