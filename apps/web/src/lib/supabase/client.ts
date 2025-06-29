import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables. Please check your .env.local file.')
  }

  return createBrowserClient(
    supabaseUrl,
    supabaseAnonKey
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