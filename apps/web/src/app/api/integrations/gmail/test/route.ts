import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { GmailProvider } from '@/lib/integrations/providers/gmail'

// POST /api/integrations/gmail/test - Test Gmail connection
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { integrationId } = body

    if (!integrationId) {
      return NextResponse.json({ error: 'integrationId is required' }, { status: 400 })
    }

    // Get user's workspace
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('workspace_id')
      .eq('id', user.id)
      .single()

    if (!profile?.workspace_id) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 400 })
    }

    // Get integration
    const { data: integration, error } = await supabase
      .from('workspace_integrations')
      .select('auth_data, auth_expires_at')
      .eq('id', integrationId)
      .eq('workspace_id', profile.workspace_id)
      .single()

    if (error || !integration) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 })
    }

    const gmailProvider = new GmailProvider()
    let authData = integration.auth_data

    // Check if token needs refresh
    if (integration.auth_expires_at) {
      const expiresAt = new Date(integration.auth_expires_at)
      const now = new Date()
      const timeUntilExpiry = expiresAt.getTime() - now.getTime()
      
      // Refresh if expiring within 5 minutes
      if (timeUntilExpiry < 5 * 60 * 1000) {
        const refreshResult = await gmailProvider.refreshToken(authData)
        if (refreshResult.success && refreshResult.config) {
          authData = refreshResult.config
          
          // Update the token in database
          const newExpiresAt = new Date()
          newExpiresAt.setSeconds(newExpiresAt.getSeconds() + refreshResult.config.expires_in)
          
          await supabase
            .from('workspace_integrations')
            .update({
              auth_data: authData,
              auth_expires_at: newExpiresAt.toISOString()
            })
            .eq('id', integrationId)
        } else {
          return NextResponse.json({ 
            success: false, 
            error: `Token refresh failed: ${refreshResult.error}` 
          }, { status: 400 })
        }
      }
    }

    // Test connection
    const result = await gmailProvider.testConnection(authData)

    // Update integration status based on test result
    await supabase
      .from('workspace_integrations')
      .update({
        sync_status: result.success ? 'active' : 'error',
        last_error: result.success ? null : result.error,
        last_sync_at: new Date().toISOString()
      })
      .eq('id', integrationId)

    return NextResponse.json(result)

  } catch (error) {
    console.error('Gmail test API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}