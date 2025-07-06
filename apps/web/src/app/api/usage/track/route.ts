import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

// POST /api/usage/track - Track usage metrics
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
      provider,
      model_name,
      input_tokens,
      output_tokens,
      units_used,
      feature_name,
      resource_type,
      resource_id,
      request_data,
      response_data,
      duration_ms
    } = body

    // Validate required fields
    if (!metric_type || !feature_name) {
      return NextResponse.json({ 
        error: 'metric_type and feature_name are required' 
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

    let usageId: string

    // Track AI usage with pricing calculation
    if (metric_type === 'ai_tokens' && provider && model_name) {
      const { data, error } = await supabase.rpc('track_ai_usage', {
        p_workspace_id: profile.workspace_id,
        p_user_id: user.id,
        p_provider: provider,
        p_model_name: model_name,
        p_input_tokens: input_tokens || 0,
        p_output_tokens: output_tokens || 0,
        p_feature_name: feature_name,
        p_resource_type: resource_type,
        p_resource_id: resource_id,
        p_request_data: request_data || {},
        p_response_data: response_data || {}
      })

      if (error) {
        console.error('Error tracking AI usage:', error)
        return NextResponse.json({ error: 'Failed to track AI usage' }, { status: 500 })
      }

      usageId = data
    } else {
      // Track general usage
      const { data, error } = await supabase
        .from('usage_metrics')
        .insert({
          workspace_id: profile.workspace_id,
          user_id: user.id,
          metric_type,
          provider,
          model_name,
          input_tokens: input_tokens || 0,
          output_tokens: output_tokens || 0,
          total_tokens: (input_tokens || 0) + (output_tokens || 0),
          units_used: units_used || 1,
          feature_name,
          resource_type,
          resource_id,
          request_data: request_data || {},
          response_data: response_data || {},
          duration_ms
        })
        .select('id')
        .single()

      if (error) {
        console.error('Error tracking usage:', error)
        return NextResponse.json({ error: 'Failed to track usage' }, { status: 500 })
      }

      usageId = data.id

      // Update usage limits for non-AI metrics
      if (metric_type !== 'ai_tokens') {
        await supabase.rpc('update_usage_limits', {
          p_workspace_id: profile.workspace_id,
          p_metric_type: metric_type,
          p_units_used: units_used || 1
        })
      }
    }

    return NextResponse.json({ 
      success: true, 
      usage_id: usageId 
    })

  } catch (error) {
    console.error('Usage tracking API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/usage/track - Get usage summary
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const period_start = searchParams.get('period_start')
    const period_end = searchParams.get('period_end')
    const metric_type = searchParams.get('metric_type')

    // Get user's workspace
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('workspace_id')
      .eq('id', user.id)
      .single()

    if (!profile?.workspace_id) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 400 })
    }

    // Get usage summary
    const { data: summary, error } = await supabase.rpc('get_usage_summary', {
      p_workspace_id: profile.workspace_id,
      p_period_start: period_start,
      p_period_end: period_end
    })

    if (error) {
      console.error('Error fetching usage summary:', error)
      return NextResponse.json({ error: 'Failed to fetch usage summary' }, { status: 500 })
    }

    // Get current limits
    const { data: limits } = await supabase
      .from('usage_limits')
      .select('*')
      .eq('workspace_id', profile.workspace_id)
      .eq('is_active', true)

    // Get current month usage for limits
    const currentDate = new Date()
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
      .toISOString().split('T')[0]

    const { data: currentUsage, error: currentError } = await supabase
      .from('usage_metrics')
      .select('metric_type, total_tokens, units_used, total_cost')
      .eq('workspace_id', profile.workspace_id)
      .gte('billing_period', monthStart)

    if (currentError) {
      console.error('Error fetching current usage:', currentError)
    }

    // Aggregate current usage by metric type
    const currentByMetric: any = {}
    currentUsage?.forEach(record => {
      const key = record.metric_type
      if (!currentByMetric[key]) {
        currentByMetric[key] = { usage: 0, cost: 0 }
      }
      currentByMetric[key].usage += record.total_tokens || record.units_used || 0
      currentByMetric[key].cost += record.total_cost || 0
    })

    // Add limits to current usage
    limits?.forEach(limit => {
      if (currentByMetric[limit.metric_type]) {
        currentByMetric[limit.metric_type].limit = limit.monthly_limit
        currentByMetric[limit.metric_type].daily_limit = limit.daily_limit
        currentByMetric[limit.metric_type].burst_limit = limit.burst_limit
      } else {
        currentByMetric[limit.metric_type] = {
          usage: 0,
          cost: 0,
          limit: limit.monthly_limit,
          daily_limit: limit.daily_limit,
          burst_limit: limit.burst_limit
        }
      }
    })

    return NextResponse.json({
      success: true,
      summary: summary || [],
      current_usage: currentByMetric,
      limits: limits || []
    })

  } catch (error) {
    console.error('Usage summary API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}