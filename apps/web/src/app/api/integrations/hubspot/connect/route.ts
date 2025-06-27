import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspace_id')
    
    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user has permission to manage integrations
    const { data: hasPermission } = await supabase
      .rpc('check_user_permission', {
        p_user_id: user.id,
        p_workspace_id: workspaceId,
        p_permission: 'settings:manage'
      })

    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
      )
    }

    // Generate state parameter for security
    const state = Buffer.from(JSON.stringify({
      workspaceId,
      userId: user.id,
      timestamp: Date.now(),
    })).toString('base64')

    // HubSpot OAuth URL
    const hubspotAuthUrl = new URL('https://app.hubspot.com/oauth/authorize')
    hubspotAuthUrl.searchParams.set('client_id', process.env.HUBSPOT_CLIENT_ID!)
    hubspotAuthUrl.searchParams.set('redirect_uri', `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/hubspot/callback`)
    hubspotAuthUrl.searchParams.set('scope', [
      'contacts',
      'content',
      'reports',
      'social',
      'automation',
      'timeline',
      'business-intelligence',
      'crm.objects.contacts.read',
      'crm.objects.contacts.write',
      'crm.objects.companies.read', 
      'crm.objects.companies.write',
      'crm.objects.deals.read',
      'crm.objects.deals.write',
      'crm.schemas.contacts.read',
      'crm.schemas.companies.read',
      'crm.schemas.deals.read',
    ].join(' '))
    hubspotAuthUrl.searchParams.set('state', state)
    hubspotAuthUrl.searchParams.set('response_type', 'code')

    return NextResponse.redirect(hubspotAuthUrl.toString())
  } catch (error) {
    console.error('HubSpot connect error:', error)
    return NextResponse.json(
      { error: 'Failed to initiate HubSpot connection' },
      { status: 500 }
    )
  }
}