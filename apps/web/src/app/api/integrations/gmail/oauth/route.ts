import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { GmailProvider } from '@/lib/integrations/providers/gmail'

// GET /api/integrations/gmail/oauth - Get OAuth URL for Gmail
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const redirectUri = searchParams.get('redirect_uri') || `${process.env.NEXT_PUBLIC_APP_URL}/integrations/gmail/callback`

    // Get user's workspace to include in state
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()

    if (!profile?.workspace_id) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 400 })
    }

    const gmailProvider = new GmailProvider()
    const state = JSON.stringify({
      workspace_id: profile.workspace_id,
      user_id: user.id,
      timestamp: Date.now()
    })

    const oauthUrl = gmailProvider.getOAuthUrl(redirectUri, state)

    return NextResponse.json({
      success: true,
      oauth_url: oauthUrl,
      state
    })

  } catch (error) {
    console.error('Gmail OAuth URL API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/integrations/gmail/oauth - Handle OAuth callback
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { code, state, redirect_uri } = body

    if (!code) {
      return NextResponse.json({ error: 'Authorization code is required' }, { status: 400 })
    }

    // Verify state parameter
    let stateData
    try {
      stateData = JSON.parse(state)
    } catch {
      return NextResponse.json({ error: 'Invalid state parameter' }, { status: 400 })
    }

    if (stateData.user_id !== user.id) {
      return NextResponse.json({ error: 'State validation failed' }, { status: 400 })
    }

    // Exchange code for token
    const gmailProvider = new GmailProvider()
    const redirectUri = redirect_uri || `${process.env.NEXT_PUBLIC_APP_URL}/integrations/gmail/callback`
    
    const tokenResult = await gmailProvider.exchangeCodeForToken(code, redirectUri)
    if (!tokenResult.success) {
      return NextResponse.json({ 
        success: false, 
        error: tokenResult.error 
      }, { status: 400 })
    }

    // Calculate token expiry
    const expiresAt = new Date()
    expiresAt.setSeconds(expiresAt.getSeconds() + tokenResult.config.expires_in)

    // Get Gmail provider from database
    const { data: provider } = await supabase
      .from('integration_providers')
      .select('id')
      .eq('name', 'gmail')
      .single()

    if (!provider) {
      return NextResponse.json({ error: 'Gmail provider not found' }, { status: 404 })
    }

    // Check if integration already exists
    const { data: existingIntegration } = await supabase
      .from('workspace_integrations')
      .select('id')
      .eq('workspace_id', stateData.workspace_id)
      .eq('provider_id', provider.id)
      .single()

    const integrationName = `Gmail (${tokenResult.config.email})`
    
    if (existingIntegration) {
      // Update existing integration
      const { error } = await supabase
        .from('workspace_integrations')
        .update({
          auth_data: tokenResult.config,
          auth_expires_at: expiresAt.toISOString(),
          integration_name: integrationName,
          is_active: true,
          sync_status: 'active',
          last_sync_at: new Date().toISOString(),
          last_error: null
        })
        .eq('id', existingIntegration.id)

      if (error) {
        console.error('Error updating Gmail integration:', error)
        return NextResponse.json({ error: 'Failed to update integration' }, { status: 500 })
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Gmail integration updated successfully',
        integration_id: existingIntegration.id,
        email: tokenResult.config.email
      })
    } else {
      // Create new integration
      const { data: integration, error } = await supabase
        .from('workspace_integrations')
        .insert({
          workspace_id: stateData.workspace_id,
          user_id: user.id,
          provider_id: provider.id,
          integration_name: integrationName,
          auth_data: tokenResult.config,
          auth_expires_at: expiresAt.toISOString(),
          settings: {
            auto_sync: true,
            sync_labels: [],
            create_coldcopy_label: true,
            events: ['email_received', 'email_sent']
          },
          is_active: true,
          sync_status: 'active',
          last_sync_at: new Date().toISOString()
        })
        .select('id')
        .single()

      if (error) {
        console.error('Error creating Gmail integration:', error)
        return NextResponse.json({ error: 'Failed to create integration' }, { status: 500 })
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Gmail integration created successfully',
        integration_id: integration.id,
        email: tokenResult.config.email
      })
    }

  } catch (error) {
    console.error('Gmail OAuth callback API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}