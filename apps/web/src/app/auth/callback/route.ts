import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/dashboard'
  const error = requestUrl.searchParams.get('error')
  const error_description = requestUrl.searchParams.get('error_description')

  if (error) {
    // Handle errors from Supabase
    console.error('Auth callback error:', error, error_description)
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error_description || error)}`, requestUrl.origin)
    )
  }

  if (code) {
    const supabase = await createClient()
    
    try {
      // Exchange the code for a session
      const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code)
      
      if (sessionError) {
        console.error('Session exchange error:', sessionError)
        return NextResponse.redirect(
          new URL(`/login?error=${encodeURIComponent(sessionError.message)}`, requestUrl.origin)
        )
      }

      // Get the user to ensure they're authenticated
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError || !user) {
        console.error('User fetch error:', userError)
        return NextResponse.redirect(
          new URL('/login?error=Failed to authenticate user', requestUrl.origin)
        )
      }

      // Check if this is an email confirmation
      const isEmailConfirmation = requestUrl.searchParams.get('type') === 'email'
      
      if (isEmailConfirmation) {
        // For email confirmations, redirect to a success page or dashboard
        return NextResponse.redirect(new URL('/dashboard?welcome=true', requestUrl.origin))
      }

      // Redirect to the 'next' URL or dashboard
      return NextResponse.redirect(new URL(next, requestUrl.origin))
      
    } catch (error) {
      console.error('Auth callback error:', error)
      return NextResponse.redirect(
        new URL('/login?error=Authentication failed', requestUrl.origin)
      )
    }
  }

  // If no code is present, redirect to login
  return NextResponse.redirect(new URL('/login', requestUrl.origin))
}