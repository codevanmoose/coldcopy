import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { Database } from '@/lib/supabase/database.types'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerComponentClient<Database>({ cookies })
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID is required' },
        { status: 400 }
      )
    }

    // Verify user has access to this workspace
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check workspace membership
    const { data: workspaceUser } = await supabase
      .from('workspace_users')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!workspaceUser) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Fetch portals for the workspace
    const { data: portals, error } = await supabase
      .from('white_label_client_portals')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching portals:', error)
      return NextResponse.json(
        { error: 'Failed to fetch portals' },
        { status: 500 }
      )
    }

    return NextResponse.json(portals)
  } catch (error) {
    console.error('Portals API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerComponentClient<Database>({ cookies })
    const body = await request.json()
    const { 
      workspaceId, 
      clientId, 
      permissions, 
      allowedFeatures, 
      customWelcomeMessage,
      expiresInDays = 365 
    } = body

    if (!workspaceId || !clientId) {
      return NextResponse.json(
        { error: 'Workspace ID and client ID are required' },
        { status: 400 }
      )
    }

    // Verify user has admin access to this workspace
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data: workspaceUser } = await supabase
      .from('workspace_users')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!workspaceUser || !['owner', 'admin', 'member'].includes(workspaceUser.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Verify client exists and belongs to workspace
    const { data: client } = await supabase
      .from('leads')
      .select('id, email, first_name, last_name')
      .eq('id', clientId)
      .eq('workspace_id', workspaceId)
      .single()

    if (!client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      )
    }

    // Generate unique portal URL and access token
    const portalUrl = generatePortalUrl()
    const accessToken = generateAccessToken()

    // Calculate expiration date
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + expiresInDays)

    // Prepare portal data
    const portalData = {
      workspace_id: workspaceId,
      client_id: clientId,
      portal_url: portalUrl,
      access_token: accessToken,
      permissions: permissions || {
        view_campaigns: true,
        view_analytics: false,
        download_reports: false,
        update_profile: true,
        view_invoices: false,
        manage_team: false
      },
      allowed_features: allowedFeatures || ['dashboard', 'campaigns', 'profile'],
      custom_welcome_message: customWelcomeMessage || null,
      expires_at: expiresAt.toISOString(),
      is_active: true,
      login_attempts: 0,
      is_locked: false,
      email_notifications: true,
      notification_frequency: 'weekly'
    }

    // Insert the portal
    const { data: newPortal, error } = await supabase
      .from('white_label_client_portals')
      .insert(portalData)
      .select()
      .single()

    if (error) {
      console.error('Error creating portal:', error)
      
      // Handle unique constraint violations
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Portal already exists for this client' },
          { status: 409 }
        )
      }
      
      return NextResponse.json(
        { error: 'Failed to create portal' },
        { status: 500 }
      )
    }

    // Send email notification to client (in a real app)
    // await sendPortalInvitationEmail(client, newPortal)

    return NextResponse.json(newPortal, { status: 201 })
  } catch (error) {
    console.error('Create portal API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function generatePortalUrl(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `client-${timestamp}-${random}`
}

function generateAccessToken(): string {
  // Generate a secure random token
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}