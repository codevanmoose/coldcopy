/**
 * Browser detection utilities for handling browser-specific behaviors
 */

export function isSafari(): boolean {
  if (typeof window === 'undefined') return false
  
  const ua = window.navigator.userAgent.toLowerCase()
  const isSafariBrowser = /^((?!chrome|android).)*safari/i.test(ua)
  const isIOS = /iPad|iPhone|iPod/.test(window.navigator.userAgent) && !(window as any).MSStream
  
  return isSafariBrowser || isIOS
}

export function isWebKit(): boolean {
  if (typeof window === 'undefined') return false
  
  return 'WebkitAppearance' in document.documentElement.style
}

export function isChrome(): boolean {
  if (typeof window === 'undefined') return false
  
  const ua = window.navigator.userAgent.toLowerCase()
  return ua.includes('chrome') && !ua.includes('edge')
}

export function isFirefox(): boolean {
  if (typeof window === 'undefined') return false
  
  return window.navigator.userAgent.toLowerCase().includes('firefox')
}

export function getBrowserInfo() {
  if (typeof window === 'undefined') {
    return { name: 'unknown', version: 'unknown', isMobile: false }
  }
  
  const ua = window.navigator.userAgent
  let name = 'unknown'
  let version = 'unknown'
  
  if (isSafari()) {
    name = 'safari'
    const match = ua.match(/Version\/(\d+\.\d+)/)
    if (match) version = match[1]
  } else if (isChrome()) {
    name = 'chrome'
    const match = ua.match(/Chrome\/(\d+\.\d+)/)
    if (match) version = match[1]
  } else if (isFirefox()) {
    name = 'firefox'
    const match = ua.match(/Firefox\/(\d+\.\d+)/)
    if (match) version = match[1]
  }
  
  const isMobile = /Mobile|Android|iPhone|iPad|iPod/.test(ua)
  
  return { name, version, isMobile }
}

/**
 * Determines if we should delay auth checks based on browser
 * Safari and WebKit browsers often need extra time for cookie initialization
 */
export function shouldDelayAuthCheck(): boolean {
  return isSafari() || isWebKit()
}

/**
 * Get the recommended delay in milliseconds for auth checks
 */
export function getAuthCheckDelay(): number {
  if (isSafari()) return 150
  if (isWebKit()) return 100
  return 0
}

/**
 * Check if the browser supports third-party cookies
 * Safari has stricter cookie policies by default
 */
export function supportsThirdPartyCookies(): boolean {
  if (isSafari()) {
    // Safari blocks third-party cookies by default
    return false
  }
  return true
}

/**
 * Get cookie options optimized for the current browser
 */
export function getBrowserOptimizedCookieOptions() {
  const baseOptions = {
    path: '/',
    sameSite: 'lax' as const,
    secure: typeof window !== 'undefined' && window.location.protocol === 'https:',
  }
  
  if (isSafari()) {
    // Safari prefers 'lax' over 'strict' for auth cookies
    return {
      ...baseOptions,
      sameSite: 'lax' as const,
      // Don't set httpOnly on client-side (browser will ignore it anyway)
    }
  }
  
  return baseOptions
}