import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // In the browser, these values are replaced at build time
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

// Create a singleton instance for backward compatibility
// This will only be created when actually used
let supabaseInstance: ReturnType<typeof createClient> | null = null

export function getSupabase() {
  if (!supabaseInstance) {
    supabaseInstance = createClient()
  }
  return supabaseInstance
}

// Export as supabase for backward compatibility
export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(target, prop) {
    return getSupabase()[prop as keyof ReturnType<typeof createClient>]
  }
})

// Mock hook for backward compatibility
export function useSupabase() {
  return createClient()
}