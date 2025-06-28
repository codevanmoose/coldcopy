import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

// GET /api/collaboration/presence - Get workspace presence
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
      .eq('user_id', user.id)
      .single()

    if (!profile?.workspace_id) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 400 })
    }

    // Get all online users in workspace
    const { data: presence, error } = await supabase
      .from('user_presence')
      .select(`
        *,
        user_profiles!user_id (
          first_name,
          last_name,
          email,
          avatar_url
        )
      `)
      .eq('workspace_id', profile.workspace_id)
      .neq('status', 'offline')
      .order('last_activity', { ascending: false })

    if (error) {
      console.error('Error fetching presence:', error)
      return NextResponse.json({ error: 'Failed to fetch presence' }, { status: 500 })
    }

    return NextResponse.json({ presence: presence || [] })

  } catch (error) {
    console.error('Presence API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/collaboration/presence - Update user presence
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      status,
      custom_status,
      current_page,
      current_resource_type,
      current_resource_id,
      session_id,
      device_type,
      browser
    } = body

    // Get user's workspace
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()

    if (!profile?.workspace_id) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 400 })
    }

    // Update user presence using function
    const { data, error } = await supabase.rpc('update_user_presence', {
      p_workspace_id: profile.workspace_id,
      p_status: status || 'online',
      p_custom_status: custom_status,
      p_current_page: current_page,
      p_current_resource_type: current_resource_type,
      p_current_resource_id: current_resource_id,
      p_session_id: session_id,
      p_device_type: device_type || 'desktop',
      p_browser: browser
    })

    if (error) {
      console.error('Error updating presence:', error)
      return NextResponse.json({ error: 'Failed to update presence' }, { status: 500 })
    }

    return NextResponse.json({ success: true, presence_id: data })

  } catch (error) {
    console.error('Presence update API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/collaboration/presence - Set user offline
export async function DELETE(request: NextRequest) {
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
      .eq('user_id', user.id)
      .single()

    if (!profile?.workspace_id) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 400 })
    }

    // Set user offline
    const { error } = await supabase
      .from('user_presence')
      .update({
        status: 'offline',
        last_seen: new Date().toISOString(),
        current_page: null,
        current_resource_type: null,
        current_resource_id: null
      })
      .eq('workspace_id', profile.workspace_id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Error setting user offline:', error)
      return NextResponse.json({ error: 'Failed to update presence' }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Presence offline API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}