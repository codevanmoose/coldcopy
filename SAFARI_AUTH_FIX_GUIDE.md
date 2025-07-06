# Safari Authentication Fix Guide

## Issue Summary
The login page in Safari redirects to the dashboard immediately, while it works correctly in Firefox. This is likely due to Safari's stricter cookie handling and different storage API behavior.

## Root Causes Identified

### 1. **Cookie Configuration Issues**
Safari has stricter cookie policies, especially for:
- Third-party cookies
- SameSite attribute handling
- Secure cookie requirements

### 2. **Client-Side Hydration Race Condition**
The login page checks authentication status in a `useEffect` hook, which may execute differently in Safari due to:
- Different JavaScript execution timing
- Storage API access timing
- Cookie availability during hydration

### 3. **Middleware Cookie Handling**
The middleware creates a new Supabase client on each request and may not properly handle Safari's cookie restrictions.

## Recommended Fixes

### Fix 1: Update Client-Side Authentication Check (Primary Fix)
The main issue is in `/apps/web/src/app/(auth)/login/page.tsx` where the auth check happens too early in Safari.

```typescript
// Before (current implementation)
useEffect(() => {
  const checkAuthStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        router.push('/dashboard')
        return
      }
    } catch (error) {
      console.error('Error checking auth status:', error)
    } finally {
      setIsCheckingAuth(false)
    }
  }
  checkAuthStatus()
}, [router, supabase.auth])

// After (Safari-compatible fix)
useEffect(() => {
  const checkAuthStatus = async () => {
    try {
      // Add a small delay for Safari to properly initialize cookies
      if (navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome')) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      
      // Use onAuthStateChange for more reliable detection
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
          router.push('/dashboard')
        }
      })
      
      // Still check current session
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        router.push('/dashboard')
        return
      }
      
      // Cleanup subscription
      return () => subscription.unsubscribe()
    } catch (error) {
      console.error('Error checking auth status:', error)
    } finally {
      setIsCheckingAuth(false)
    }
  }
  checkAuthStatus()
}, [router, supabase.auth])
```

### Fix 2: Update Supabase Client Cookie Options
Update `/apps/web/src/lib/supabase/client.ts` to include Safari-specific cookie options:

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables:', {
      url: !!supabaseUrl,
      key: !!supabaseAnonKey
    })
    throw new Error('Missing Supabase environment variables. Please check your .env.local file.')
  }

  return createBrowserClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        // Custom cookie options for Safari compatibility
        get(name) {
          // Ensure we're in the browser
          if (typeof window === 'undefined') return null
          
          const cookies = document.cookie.split(';')
          const cookie = cookies.find(c => c.trim().startsWith(`${name}=`))
          return cookie ? decodeURIComponent(cookie.split('=')[1]) : null
        },
        set(name, value, options) {
          if (typeof window === 'undefined') return
          
          let cookieString = `${name}=${encodeURIComponent(value)}`
          
          // Safari-friendly cookie options
          if (options?.maxAge) {
            cookieString += `; Max-Age=${options.maxAge}`
          }
          if (options?.expires) {
            cookieString += `; Expires=${options.expires.toUTCString()}`
          }
          // Use 'lax' for Safari compatibility
          cookieString += `; SameSite=${options?.sameSite || 'lax'}`
          cookieString += '; Path=/'
          
          // Only set Secure in production
          if (window.location.protocol === 'https:') {
            cookieString += '; Secure'
          }
          
          document.cookie = cookieString
        },
        remove(name, options) {
          if (typeof window === 'undefined') return
          
          let cookieString = `${name}=; Max-Age=0`
          cookieString += `; Path=${options?.path || '/'}`
          
          document.cookie = cookieString
        }
      }
    }
  )
}
```

### Fix 3: Add Safari Detection Utility
Create `/apps/web/src/lib/utils/browser.ts`:

```typescript
export function isSafari(): boolean {
  if (typeof window === 'undefined') return false
  
  const ua = window.navigator.userAgent
  const isSafariBrowser = /^((?!chrome|android).)*safari/i.test(ua)
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream
  
  return isSafariBrowser || isIOS
}

export function isWebKit(): boolean {
  if (typeof window === 'undefined') return false
  
  return 'WebkitAppearance' in document.documentElement.style
}

export function shouldDelayAuthCheck(): boolean {
  // Safari and WebKit browsers need a delay for cookie initialization
  return isSafari() || isWebKit()
}
```

### Fix 4: Update Middleware for Safari
Update `/apps/web/src/middleware.ts` to handle Safari cookies better:

```typescript
// Add Safari-specific cookie handling
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const, // Explicitly use 'lax' for Safari
  path: '/',
  // Add domain for Safari
  ...(process.env.NODE_ENV === 'production' && { domain: '.coldcopy.cc' })
}
```

### Fix 5: Alternative Login Page Implementation
If the above fixes don't work, create a more robust login page that doesn't redirect on mount:

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isReady, setIsReady] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    // Don't check auth immediately - wait for user interaction
    const redirectTo = searchParams.get('redirectTo')
    
    // Only check if explicitly requested (e.g., from a protected route)
    if (redirectTo) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          router.push(redirectTo)
        } else {
          setIsReady(true)
        }
      })
    } else {
      // Don't auto-check, just show the login form
      setIsReady(true)
    }
  }, [])

  if (!isReady) {
    return <LoadingSpinner />
  }

  return <LoginForm />
}
```

## Testing the Fix

Run the test script to verify the fix works across browsers:

```bash
node test-safari-auth.js
```

## Additional Debugging

If issues persist, check:

1. **Safari Developer Tools**:
   - Open Safari > Preferences > Advanced > Show Develop menu
   - Develop > Show Web Inspector > Storage tab
   - Check cookies and localStorage for Supabase auth tokens

2. **Cookie Settings**:
   - Safari > Preferences > Privacy
   - Ensure "Prevent cross-site tracking" isn't blocking auth cookies

3. **Console Errors**:
   - Look for any Safari-specific JavaScript errors
   - Check for blocked third-party storage access

## Environment Variables to Verify

Ensure these are properly set in Vercel:
```
NEXT_PUBLIC_SUPABASE_URL=https://zicipvpablahehxstbfr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

## Immediate Action Items

1. Apply Fix 1 (update auth check timing) - Most likely to resolve the issue
2. Test with the provided test script
3. If still not working, apply Fix 2 (custom cookie handling)
4. Consider Fix 5 as a last resort (remove auto-redirect entirely)

The issue is most likely due to Safari's different timing for cookie availability during the React hydration phase. The proposed fixes address this by either delaying the auth check or using more robust cookie handling.