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
    const domainId = id

    if (!domainId) {
      return NextResponse.json(
        { error: 'Domain ID is required' },
        { status: 400 }
      )
    }

    // Verify user has admin access
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get domain to check workspace
    const { data: domain } = await supabase
      .from('white_label_domains')
      .select('workspace_id')
      .eq('id', domainId)
      .single()

    if (!domain) {
      return NextResponse.json(
        { error: 'Domain not found' },
        { status: 404 }
      )
    }

    // Check workspace admin access
    const { data: workspaceUser } = await supabase
      .from('workspace_users')
      .select('role')
      .eq('workspace_id', domain.workspace_id)
      .eq('user_id', user.id)
      .single()

    if (!workspaceUser || !['owner', 'admin'].includes(workspaceUser.role)) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Delete the domain
    const { error } = await supabase
      .from('white_label_domains')
      .delete()
      .eq('id', domainId)

    if (error) {
      console.error('Error deleting domain:', error)
      return NextResponse.json(
        { error: 'Failed to delete domain' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete domain API error:', error)
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
    const domainId = id
    const body = await request.json()

    if (!domainId) {
      return NextResponse.json(
        { error: 'Domain ID is required' },
        { status: 400 }
      )
    }

    // Verify user has admin access
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get domain to check workspace
    const { data: domain } = await supabase
      .from('white_label_domains')
      .select('workspace_id')
      .eq('id', domainId)
      .single()

    if (!domain) {
      return NextResponse.json(
        { error: 'Domain not found' },
        { status: 404 }
      )
    }

    // Check workspace admin access
    const { data: workspaceUser } = await supabase
      .from('workspace_users')
      .select('role')
      .eq('workspace_id', domain.workspace_id)
      .eq('user_id', user.id)
      .single()

    if (!workspaceUser || !['owner', 'admin'].includes(workspaceUser.role)) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Update the domain
    const { data: updatedDomain, error } = await supabase
      .from('white_label_domains')
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq('id', domainId)
      .select()
      .single()

    if (error) {
      console.error('Error updating domain:', error)
      return NextResponse.json(
        { error: 'Failed to update domain' },
        { status: 500 }
      )
    }

    return NextResponse.json(updatedDomain)
  } catch (error) {
    console.error('Update domain API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
