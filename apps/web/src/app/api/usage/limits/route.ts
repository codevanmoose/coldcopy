import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

// GET /api/usage/limits - Get usage limits for workspace
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

    // Get usage limits
    const { data: limits, error } = await supabase
      .from('usage_limits')
      .select('*')
      .eq('workspace_id', profile.workspace_id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching usage limits:', error)
      return NextResponse.json({ error: 'Failed to fetch usage limits' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      limits: limits || []
    })

  } catch (error) {
    console.error('Usage limits API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/usage/limits - Create or update usage limits
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      metric_type,
      limit_type,
      monthly_limit,
      daily_limit,
      burst_limit,
      warning_threshold
    } = body

    if (!metric_type || !limit_type) {
      return NextResponse.json({ 
        error: 'metric_type and limit_type are required' 
      }, { status: 400 })
    }

    // Get user's workspace and verify admin role
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('workspace_id')
      .eq('id', user.id)
      .single()

    if (!profile?.workspace_id) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 400 })
    }

    if (!['workspace_admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Check if limit already exists
    const { data: existingLimit } = await supabase
      .from('usage_limits')
      .select('id')
      .eq('workspace_id', profile.workspace_id)
      .eq('metric_type', metric_type)
      .eq('is_active', true)
      .single()

    if (existingLimit) {
      // Update existing limit
      const { data, error } = await supabase
        .from('usage_limits')
        .update({
          limit_type,
          monthly_limit,
          daily_limit,
          burst_limit,
          warning_threshold: warning_threshold || 0.8,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingLimit.id)
        .select()
        .single()

      if (error) {
        console.error('Error updating usage limit:', error)
        return NextResponse.json({ error: 'Failed to update usage limit' }, { status: 500 })
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Usage limit updated successfully',
        limit: data 
      })
    } else {
      // Create new limit
      const { data, error } = await supabase
        .from('usage_limits')
        .insert({
          workspace_id: profile.workspace_id,
          metric_type,
          limit_type,
          monthly_limit,
          daily_limit,
          burst_limit,
          warning_threshold: warning_threshold || 0.8,
          is_active: true
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating usage limit:', error)
        return NextResponse.json({ error: 'Failed to create usage limit' }, { status: 500 })
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Usage limit created successfully',
        limit: data 
      })
    }

  } catch (error) {
    console.error('Create usage limits API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/usage/limits - Update specific usage limit
export async function PUT(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { limit_id, ...updates } = body

    if (!limit_id) {
      return NextResponse.json({ error: 'limit_id is required' }, { status: 400 })
    }

    // Get user's workspace and verify admin role
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('workspace_id')
      .eq('id', user.id)
      .single()

    if (!profile?.workspace_id) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 400 })
    }

    if (!['workspace_admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Verify the limit belongs to this workspace
    const { data: limit, error: fetchError } = await supabase
      .from('usage_limits')
      .select('workspace_id')
      .eq('id', limit_id)
      .single()

    if (fetchError || !limit) {
      return NextResponse.json({ error: 'Usage limit not found' }, { status: 404 })
    }

    if (limit.workspace_id !== profile.workspace_id) {
      return NextResponse.json({ error: 'Unauthorized access to limit' }, { status: 403 })
    }

    // Update the limit
    const { data, error } = await supabase
      .from('usage_limits')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', limit_id)
      .select()
      .single()

    if (error) {
      console.error('Error updating usage limit:', error)
      return NextResponse.json({ error: 'Failed to update usage limit' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Usage limit updated successfully',
      limit: data 
    })

  } catch (error) {
    console.error('Update usage limit API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/usage/limits - Delete usage limit
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit_id = searchParams.get('limit_id')

    if (!limit_id) {
      return NextResponse.json({ error: 'limit_id is required' }, { status: 400 })
    }

    // Get user's workspace and verify admin role
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('workspace_id')
      .eq('id', user.id)
      .single()

    if (!profile?.workspace_id) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 400 })
    }

    if (!['workspace_admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Verify the limit belongs to this workspace
    const { data: limit, error: fetchError } = await supabase
      .from('usage_limits')
      .select('workspace_id')
      .eq('id', limit_id)
      .single()

    if (fetchError || !limit) {
      return NextResponse.json({ error: 'Usage limit not found' }, { status: 404 })
    }

    if (limit.workspace_id !== profile.workspace_id) {
      return NextResponse.json({ error: 'Unauthorized access to limit' }, { status: 403 })
    }

    // Soft delete by setting is_active to false
    const { error } = await supabase
      .from('usage_limits')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', limit_id)

    if (error) {
      console.error('Error deleting usage limit:', error)
      return NextResponse.json({ error: 'Failed to delete usage limit' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Usage limit deleted successfully' 
    })

  } catch (error) {
    console.error('Delete usage limit API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}