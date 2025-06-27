import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin
  const redirectTo = requestUrl.searchParams.get('redirect_to')?.toString()

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // Check if this is a new user and create trial subscription
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        // Check if user already has a subscription
        const { data: existingSubscription } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('workspace_id', user.id)
          .single()
        
        if (!existingSubscription) {
          // Create trial subscription for new user
          // This will be handled by the database trigger auto_create_free_subscription
          // which creates a trial when a workspace is created
        }
      }
      
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'
      
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${redirectTo || '/dashboard'}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${redirectTo || '/dashboard'}`)
      } else {
        return NextResponse.redirect(`${origin}${redirectTo || '/dashboard'}`)
      }
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}