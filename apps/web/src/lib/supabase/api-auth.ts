import { NextRequest } from 'next/server'
import { createClient } from './server'
import { createClient as createBrowserClient } from './client'

/**
 * Create a Supabase client for API routes that can handle both cookie-based 
 * and header-based authentication
 */
export async function createApiClient(request: NextRequest) {
  // First try to get auth from Authorization header
  const authHeader = request.headers.get('authorization')
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '')
    
    // Create a client and set the session with the token
    const supabase = createBrowserClient()
    
    // Manually set the session
    await supabase.auth.setSession({
      access_token: token,
      refresh_token: '' // We don't have refresh token from header
    })
    
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (user && !error) {
      return {
        supabase,
        user,
        isAuthenticated: true
      }
    }
  }
  
  // Fallback to cookie-based authentication
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  return {
    supabase,
    user,
    isAuthenticated: !!user
  }
}

/**
 * Middleware to check authentication for API routes
 */
export async function requireAuth(request: NextRequest) {
  const { user, supabase } = await createApiClient(request)
  
  if (!user) {
    return {
      error: { error: 'Unauthorized' },
      status: 401,
      supabase: null,
      user: null
    }
  }
  
  return {
    error: null,
    status: 200,
    supabase,
    user
  }
}