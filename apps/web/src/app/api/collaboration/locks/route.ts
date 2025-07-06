import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

// GET /api/collaboration/locks - Get resource locks
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const resourceType = searchParams.get('resourceType')
    const resourceId = searchParams.get('resourceId')

    // Get user's workspace
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('workspace_id')
      .eq('id', user.id)
      .single()

    if (!profile?.workspace_id) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 400 })
    }

    let query = supabase
      .from('resource_locks')
      .select(`
        *,
        user_profiles!locked_by_user_id (
          first_name,
          last_name,
          email,
          avatar_url
        )
      `)
      .eq('workspace_id', profile.workspace_id)
      .or('auto_release_at.is.null,auto_release_at.gt.now()')

    // Filter by resource if specified
    if (resourceType && resourceId) {
      query = query
        .eq('resource_type', resourceType)
        .eq('resource_id', resourceId)
    }

    const { data: locks, error } = await query.order('acquired_at', { ascending: false })

    if (error) {
      console.error('Error fetching locks:', error)
      return NextResponse.json({ error: 'Failed to fetch locks' }, { status: 500 })
    }

    return NextResponse.json({ locks: locks || [] })

  } catch (error) {
    console.error('Locks API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/collaboration/locks - Acquire resource lock
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      resource_type,
      resource_id,
      lock_type = 'editing',
      session_id,
      lock_reason,
      auto_release_minutes = 30
    } = body

    if (!resource_type || !resource_id) {
      return NextResponse.json({ 
        error: 'resource_type and resource_id are required' 
      }, { status: 400 })
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

    // Acquire lock using function
    const { data, error } = await supabase.rpc('acquire_resource_lock', {
      p_workspace_id: profile.workspace_id,
      p_resource_type: resource_type,
      p_resource_id: resource_id,
      p_lock_type: lock_type,
      p_session_id: session_id,
      p_lock_reason: lock_reason,
      p_auto_release_minutes: auto_release_minutes
    })

    if (error) {
      console.error('Error acquiring lock:', error)
      return NextResponse.json({ error: 'Failed to acquire lock' }, { status: 500 })
    }

    return NextResponse.json(data)

  } catch (error) {
    console.error('Lock acquisition API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/collaboration/locks - Release resource lock
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const resourceType = searchParams.get('resourceType')
    const resourceId = searchParams.get('resourceId')
    const lockType = searchParams.get('lockType') || 'editing'

    if (!resourceType || !resourceId) {
      return NextResponse.json({ 
        error: 'resourceType and resourceId are required' 
      }, { status: 400 })
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

    // Release lock using function
    const { data, error } = await supabase.rpc('release_resource_lock', {
      p_workspace_id: profile.workspace_id,
      p_resource_type: resourceType,
      p_resource_id: resourceId,
      p_lock_type: lockType
    })

    if (error) {
      console.error('Error releasing lock:', error)
      return NextResponse.json({ error: 'Failed to release lock' }, { status: 500 })
    }

    return NextResponse.json({ success: data })

  } catch (error) {
    console.error('Lock release API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}