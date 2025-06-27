import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { HubSpotClient } from '@/lib/integrations/hubspot/client'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      console.error('HubSpot OAuth error:', error)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=hubspot_auth_failed`
      )
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=invalid_callback`
      )
    }

    // Decode and validate state
    let stateData: { workspaceId: string; userId: string; timestamp: number }
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString())
    } catch {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=invalid_state`
      )
    }

    // Check state timestamp (should be within 10 minutes)
    if (Date.now() - stateData.timestamp > 10 * 60 * 1000) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=expired_state`
      )
    }

    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.id !== stateData.userId) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=unauthorized`
      )
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.HUBSPOT_CLIENT_ID!,
        client_secret: process.env.HUBSPOT_CLIENT_SECRET!,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/hubspot/callback`,
        code,
      }),
    })

    if (!tokenResponse.ok) {
      console.error('Failed to exchange code for tokens:', await tokenResponse.text())
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=token_exchange_failed`
      )
    }

    const tokenData = await tokenResponse.json()
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000)

    // Get account info to retrieve portal_id
    const hubspotClient = new HubSpotClient({
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt,
      portalId: 0, // Will be updated
    })

    const accountInfo = await hubspotClient.getAccountInfo()

    // Store connection in database
    const { error: dbError } = await supabase
      .from('hubspot_connections')
      .upsert({
        workspace_id: stateData.workspaceId,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: expiresAt.toISOString(),
        portal_id: accountInfo.portalId,
        hub_domain: `${accountInfo.portalId}.hs-sites.com`,
        user_id: user.id,
        scopes: tokenData.scope ? tokenData.scope.split(' ') : [],
        is_active: true,
      }, {
        onConflict: 'workspace_id'
      })

    if (dbError) {
      console.error('Failed to store HubSpot connection:', dbError)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=database_error`
      )
    }

    // Initialize default sync configurations
    const defaultConfigs = [
      { object_type: 'contacts', direction: 'bidirectional' as const },
      { object_type: 'companies', direction: 'bidirectional' as const },
      { object_type: 'deals', direction: 'to_hubspot' as const },
      { object_type: 'activities', direction: 'to_hubspot' as const },
    ]

    for (const config of defaultConfigs) {
      await supabase
        .from('hubspot_sync_configs')
        .upsert({
          workspace_id: stateData.workspaceId,
          object_type: config.object_type,
          direction: config.direction,
          is_enabled: true,
          field_mappings: {},
          sync_frequency_minutes: 30,
        }, {
          onConflict: 'workspace_id,object_type'
        })
    }

    // Create audit log
    await supabase.from('audit_logs').insert({
      workspace_id: stateData.workspaceId,
      user_id: user.id,
      action: 'hubspot_connected',
      resource_type: 'integration',
      metadata: {
        portal_id: accountInfo.portalId,
        scopes: tokenData.scope,
      },
    })

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?success=hubspot_connected`
    )
  } catch (error) {
    console.error('HubSpot callback error:', error)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=callback_failed`
    )
  }
}