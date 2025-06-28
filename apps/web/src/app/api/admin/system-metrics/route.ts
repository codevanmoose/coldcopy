import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is super admin
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!userProfile || userProfile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Aggregate system metrics
    const metrics = await Promise.all([
      // Workspace metrics
      supabase.rpc('get_workspace_metrics'),
      
      // User metrics
      supabase.rpc('get_user_metrics'),
      
      // Campaign metrics
      supabase.rpc('get_campaign_metrics'),
      
      // Email metrics
      supabase.rpc('get_email_metrics'),
      
      // Revenue metrics
      supabase.rpc('get_revenue_metrics'),
      
      // System health metrics
      supabase.rpc('get_system_health_metrics'),
    ])

    const [
      workspaceMetrics,
      userMetrics,
      campaignMetrics,
      emailMetrics,
      revenueMetrics,
      systemMetrics,
    ] = metrics

    return NextResponse.json({
      workspaces: workspaceMetrics.data || {
        total: 0,
        active_30d: 0,
        trial: 0,
        paid: 0,
      },
      users: userMetrics.data || {
        total: 0,
        active_30d: 0,
        new_30d: 0,
      },
      campaigns: campaignMetrics.data || {
        total: 0,
        active: 0,
        completed_30d: 0,
      },
      emails: emailMetrics.data || {
        sent_30d: 0,
        delivered_30d: 0,
        opened_30d: 0,
        clicked_30d: 0,
      },
      revenue: revenueMetrics.data || {
        mrr: 0,
        total_30d: 0,
        trial_conversions_30d: 0,
      },
      system: systemMetrics.data || {
        database_size: 'N/A',
        cache_hit_rate: 0,
        avg_response_time: 0,
        uptime: 'N/A',
      },
    })
  } catch (error) {
    console.error('Admin metrics error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}