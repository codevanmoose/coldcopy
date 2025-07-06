import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

// GET /api/integrations - Get all integrations for workspace
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    // Get workspace integrations with provider details
    const { data: integrations, error } = await supabase
      .from('workspace_integrations')
      .select(`
        *,
        integration_providers (
          name,
          display_name,
          description,
          category,
          auth_type,
          supported_events,
          supported_actions,
          icon_url,
          website_url
        )
      `)
      .eq('workspace_id', profile.workspace_id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching integrations:', error)
      return NextResponse.json({ error: 'Failed to fetch integrations' }, { status: 500 })
    }

    // Remove sensitive auth data from response
    const safeIntegrations = integrations?.map(integration => ({
      ...integration,
      auth_data: {
        // Only include non-sensitive fields
        email: integration.auth_data?.email,
        team_name: integration.auth_data?.team_name,
        user_name: integration.auth_data?.user_name,
        webhook_url: integration.auth_data?.webhook_url ? '[CONFIGURED]' : null
      }
    })) || []

    return NextResponse.json({
      success: true,
      integrations: safeIntegrations
    })

  } catch (error) {
    console.error('Integrations API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/integrations - Remove integration
export async function DELETE(request: NextRequest) {
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

    // Verify integration belongs to workspace
    const { data: integration, error: fetchError } = await supabase
      .from('workspace_integrations')
      .select('id, provider_id')
      .eq('id', integrationId)
      .eq('workspace_id', profile.workspace_id)
      .single()

    if (fetchError || !integration) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 })
    }

    // Delete integration (cascades to related tables)
    const { error: deleteError } = await supabase
      .from('workspace_integrations')
      .delete()
      .eq('id', integrationId)

    if (deleteError) {
      console.error('Error deleting integration:', deleteError)
      return NextResponse.json({ error: 'Failed to delete integration' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Integration deleted successfully'
    })

  } catch (error) {
    console.error('Delete integration API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/integrations - Update integration settings
export async function PATCH(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { integrationId, settings, isActive } = body

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

    // Verify integration belongs to workspace
    const { data: integration, error: fetchError } = await supabase
      .from('workspace_integrations')
      .select('id')
      .eq('id', integrationId)
      .eq('workspace_id', profile.workspace_id)
      .single()

    if (fetchError || !integration) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 })
    }

    // Prepare update data
    const updateData: any = {}
    if (settings !== undefined) updateData.settings = settings
    if (isActive !== undefined) updateData.is_active = isActive
    updateData.updated_at = new Date().toISOString()

    // Update integration
    const { error: updateError } = await supabase
      .from('workspace_integrations')
      .update(updateData)
      .eq('id', integrationId)

    if (updateError) {
      console.error('Error updating integration:', updateError)
      return NextResponse.json({ error: 'Failed to update integration' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Integration updated successfully'
    })

  } catch (error) {
    console.error('Update integration API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}