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

    // Fetch settings for the workspace
    const { data: settings, error } = await supabase
      .from('white_label_settings')
      .select('*')
      .eq('workspace_id', workspaceId)
      .single()

    if (error && error.code !== 'PGRST116') { // Not found is OK
      console.error('Error fetching settings:', error)
      return NextResponse.json(
        { error: 'Failed to fetch settings' },
        { status: 500 }
      )
    }

    return NextResponse.json(settings)
  } catch (error) {
    console.error('Settings API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = createServerComponentClient<Database>({ cookies })
    const body = await request.json()
    const { workspaceId, settings } = body

    if (!workspaceId || !settings) {
      return NextResponse.json(
        { error: 'Workspace ID and settings data are required' },
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

    if (!workspaceUser || !['owner', 'admin'].includes(workspaceUser.role)) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Upsert the settings
    const { data: upsertedSettings, error } = await supabase
      .from('white_label_settings')
      .upsert({
        workspace_id: workspaceId,
        ...settings,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'workspace_id'
      })
      .select()
      .single()

    if (error) {
      console.error('Error upserting settings:', error)
      return NextResponse.json(
        { error: 'Failed to update settings' },
        { status: 500 }
      )
    }

    return NextResponse.json(upsertedSettings)
  } catch (error) {
    console.error('Update settings API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}