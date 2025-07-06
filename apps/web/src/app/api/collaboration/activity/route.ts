import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

// GET /api/collaboration/activity - Get activity feed
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const activityType = searchParams.get('activityType')
    const resourceType = searchParams.get('resourceType')
    const userId = searchParams.get('userId')
    const since = searchParams.get('since')

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
      .from('activity_feed')
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
      .eq('is_public', true)

    // Apply filters
    if (activityType) {
      query = query.eq('activity_type', activityType)
    }

    if (resourceType) {
      query = query.eq('resource_type', resourceType)
    }

    if (userId) {
      query = query.eq('user_id', userId)
    }

    if (since) {
      query = query.gte('created_at', since)
    }

    const { data: activities, error } = await query
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching activity:', error)
      return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 })
    }

    return NextResponse.json({ activities: activities || [] })

  } catch (error) {
    console.error('Activity API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/collaboration/activity - Log new activity
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      activity_type,
      resource_type,
      resource_id,
      resource_name,
      activity_data = {},
      description,
      is_public = true
    } = body

    if (!activity_type || !resource_type || !resource_id || !resource_name) {
      return NextResponse.json({ 
        error: 'activity_type, resource_type, resource_id, and resource_name are required' 
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

    // Log activity using function
    const { data, error } = await supabase.rpc('log_activity', {
      p_workspace_id: profile.workspace_id,
      p_activity_type: activity_type,
      p_resource_type: resource_type,
      p_resource_id: resource_id,
      p_resource_name: resource_name,
      p_activity_data: activity_data,
      p_description: description,
      p_is_public: is_public
    })

    if (error) {
      console.error('Error logging activity:', error)
      return NextResponse.json({ error: 'Failed to log activity' }, { status: 500 })
    }

    return NextResponse.json({ success: true, activity_id: data })

  } catch (error) {
    console.error('Activity logging API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/collaboration/activity/stats - Get activity statistics
export async function PATCH(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '7')

    // Get user's workspace
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('workspace_id')
      .eq('id', user.id)
      .single()

    if (!profile?.workspace_id) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 400 })
    }

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Get activity statistics
    const { data: stats, error } = await supabase
      .from('activity_feed')
      .select('activity_type, resource_type, user_id, created_at')
      .eq('workspace_id', profile.workspace_id)
      .eq('is_public', true)
      .gte('created_at', startDate.toISOString())

    if (error) {
      console.error('Error fetching activity stats:', error)
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
    }

    // Calculate statistics
    const totalActivities = stats?.length || 0
    const uniqueUsers = new Set(stats?.map(s => s.user_id)).size
    
    const activityByType = stats?.reduce((acc, activity) => {
      acc[activity.activity_type] = (acc[activity.activity_type] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}

    const activityByResource = stats?.reduce((acc, activity) => {
      acc[activity.resource_type] = (acc[activity.resource_type] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}

    // Daily activity trend
    const dailyActivity = stats?.reduce((acc, activity) => {
      const date = new Date(activity.created_at).toDateString()
      acc[date] = (acc[date] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}

    return NextResponse.json({
      summary: {
        totalActivities,
        uniqueUsers,
        dateRange: {
          start: startDate.toISOString(),
          end: new Date().toISOString()
        }
      },
      breakdown: {
        byType: activityByType,
        byResource: activityByResource,
        daily: dailyActivity
      }
    })

  } catch (error) {
    console.error('Activity stats API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}