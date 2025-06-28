import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createHubSpotClient } from '@/lib/integrations/hubspot/client'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get workspace from request or use default
    const searchParams = request.nextUrl.searchParams
    const workspaceId = searchParams.get('workspace_id')

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 })
    }

    // Get HubSpot connection status
    const { data: connection, error } = await supabase
      .from('hubspot_connections')
      .select('*')
      .eq('workspace_id', workspaceId)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching HubSpot connection:', error)
      return NextResponse.json({ error: 'Failed to fetch connection' }, { status: 500 })
    }

    if (!connection) {
      return NextResponse.json({ 
        connected: false,
        connection: null 
      })
    }

    // Check if connection is active and not expired
    const now = new Date()
    const expiresAt = new Date(connection.expires_at)
    const isExpired = now >= expiresAt

    return NextResponse.json({
      connected: connection.is_active && !isExpired,
      connection: {
        id: connection.id,
        workspace_id: connection.workspace_id,
        portal_id: connection.portal_id,
        hub_domain: connection.hub_domain,
        is_active: connection.is_active,
        expires_at: connection.expires_at,
        last_sync_at: connection.last_sync_at,
        created_at: connection.created_at,
        // Don't expose sensitive tokens
      },
      isExpired,
    })
  } catch (error) {
    console.error('HubSpot connection check error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { workspace_id, code, redirect_uri } = body

    if (!workspace_id || !code) {
      return NextResponse.json({ 
        error: 'Workspace ID and authorization code required' 
      }, { status: 400 })
    }

    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.HUBSPOT_CLIENT_ID!,
        client_secret: process.env.HUBSPOT_CLIENT_SECRET!,
        redirect_uri: redirect_uri || `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/hubspot/callback`,
        code,
      }),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('HubSpot token exchange failed:', errorText)
      return NextResponse.json({ 
        error: 'Failed to exchange authorization code' 
      }, { status: 400 })
    }

    const tokenData = await tokenResponse.json()
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000)

    // Get account info to retrieve portal_id
    const tempClient = new (await import('@/lib/integrations/hubspot/client')).HubSpotClient({
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt,
      portalId: 0, // Will be updated
    })

    const accountInfo = await tempClient.getAccountInfo()

    // Store connection in database
    const { data: connection, error } = await supabase
      .from('hubspot_connections')
      .upsert({
        workspace_id,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: expiresAt.toISOString(),
        portal_id: accountInfo.portalId,
        hub_domain: `app.hubspot.com`,
        is_active: true,
        last_sync_at: new Date().toISOString(),
      }, {
        onConflict: 'workspace_id'
      })
      .select()
      .single()

    if (error) {
      console.error('Error storing HubSpot connection:', error)
      return NextResponse.json({ error: 'Failed to store connection' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      connection: {
        id: connection.id,
        workspace_id: connection.workspace_id,
        portal_id: connection.portal_id,
        hub_domain: connection.hub_domain,
        is_active: connection.is_active,
        expires_at: connection.expires_at,
        last_sync_at: connection.last_sync_at,
        created_at: connection.created_at,
      },
    })
  } catch (error) {
    console.error('HubSpot connection error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const workspaceId = searchParams.get('workspace_id')

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 })
    }

    // Deactivate the connection
    const { error } = await supabase
      .from('hubspot_connections')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('workspace_id', workspaceId)

    if (error) {
      console.error('Error disconnecting HubSpot:', error)
      return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('HubSpot disconnection error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}