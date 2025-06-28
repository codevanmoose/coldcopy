import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { Database } from '@/lib/supabase/database.types'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = createServerComponentClient<Database>({ cookies })
    const portalId = id

    if (!portalId) {
      return NextResponse.json(
        { error: 'Portal ID is required' },
        { status: 400 }
      )
    }

    // Verify user has access
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get portal to check workspace
    const { data: portal } = await supabase
      .from('white_label_client_portals')
      .select('workspace_id')
      .eq('id', portalId)
      .single()

    if (!portal) {
      return NextResponse.json(
        { error: 'Portal not found' },
        { status: 404 }
      )
    }

    // Check workspace access
    const { data: workspaceUser } = await supabase
      .from('workspace_users')
      .select('role')
      .eq('workspace_id', portal.workspace_id)
      .eq('user_id', user.id)
      .single()

    if (!workspaceUser || !['owner', 'admin', 'member'].includes(workspaceUser.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Delete the portal
    const { error } = await supabase
      .from('white_label_client_portals')
      .delete()
      .eq('id', portalId)

    if (error) {
      console.error('Error deleting portal:', error)
      return NextResponse.json(
        { error: 'Failed to delete portal' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete portal API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = createServerComponentClient<Database>({ cookies })
    const portalId = id
    const body = await request.json()

    if (!portalId) {
      return NextResponse.json(
        { error: 'Portal ID is required' },
        { status: 400 }
      )
    }

    // Verify user has access
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get portal to check workspace
    const { data: portal } = await supabase
      .from('white_label_client_portals')
      .select('workspace_id')
      .eq('id', portalId)
      .single()

    if (!portal) {
      return NextResponse.json(
        { error: 'Portal not found' },
        { status: 404 }
      )
    }

    // Check workspace access
    const { data: workspaceUser } = await supabase
      .from('workspace_users')
      .select('role')
      .eq('workspace_id', portal.workspace_id)
      .eq('user_id', user.id)
      .single()

    if (!workspaceUser || !['owner', 'admin', 'member'].includes(workspaceUser.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Update the portal
    const { data: updatedPortal, error } = await supabase
      .from('white_label_client_portals')
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq('id', portalId)
      .select()
      .single()

    if (error) {
      console.error('Error updating portal:', error)
      return NextResponse.json(
        { error: 'Failed to update portal' },
        { status: 500 }
      )
    }

    return NextResponse.json(updatedPortal)
  } catch (error) {
    console.error('Update portal API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = createServerComponentClient<Database>({ cookies })
    const portalId = id

    if (!portalId) {
      return NextResponse.json(
        { error: 'Portal ID is required' },
        { status: 400 }
      )
    }

    // Verify user has access
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get portal with client information
    const { data: portal, error } = await supabase
      .from('white_label_client_portals')
      .select(`
        *,
        leads:client_id (
          id,
          email,
          first_name,
          last_name,
          company
        )
      `)
      .eq('id', portalId)
      .single()

    if (error) {
      console.error('Error fetching portal:', error)
      return NextResponse.json(
        { error: 'Portal not found' },
        { status: 404 }
      )
    }

    // Check workspace access
    const { data: workspaceUser } = await supabase
      .from('workspace_users')
      .select('role')
      .eq('workspace_id', portal.workspace_id)
      .eq('user_id', user.id)
      .single()

    if (!workspaceUser) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    return NextResponse.json(portal)
  } catch (error) {
    console.error('Get portal API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
