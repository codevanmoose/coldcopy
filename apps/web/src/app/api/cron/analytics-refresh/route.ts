import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient()
    
    // Refresh materialized views
    const materializedViews = [
      'campaign_analytics_mv',
      'workspace_usage_analytics_mv',
      'lead_engagement_scores_mv',
      'email_deliverability_metrics_mv',
    ]

    let refreshed = 0
    let errors = 0

    for (const view of materializedViews) {
      try {
        await supabase.rpc('refresh_materialized_view', { view_name: view })
        refreshed++
      } catch (error) {
        console.error(`Failed to refresh ${view}:`, error)
        errors++
      }
    }

    // Update campaign analytics
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('id, workspace_id')
      .eq('status', 'active')
      .gt('updated_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())

    if (campaigns) {
      for (const campaign of campaigns) {
        try {
          await supabase.rpc('update_campaign_analytics', { 
            p_campaign_id: campaign.id 
          })
        } catch (error) {
          console.error(`Failed to update analytics for campaign ${campaign.id}:`, error)
        }
      }
    }

    // Update workspace analytics
    const { data: workspaces } = await supabase
      .from('workspaces')
      .select('id')
      .eq('status', 'active')

    if (workspaces) {
      for (const workspace of workspaces) {
        try {
          await supabase.rpc('update_workspace_analytics', { 
            p_workspace_id: workspace.id 
          })
        } catch (error) {
          console.error(`Failed to update analytics for workspace ${workspace.id}:`, error)
        }
      }
    }

    // Clean up old analytics data (older than 90 days)
    await supabase
      .from('analytics_events')
      .delete()
      .lt('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())

    return NextResponse.json({
      success: true,
      viewsRefreshed: refreshed,
      errors,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Analytics refresh cron error:', error)
    return NextResponse.json(
      { error: 'Failed to refresh analytics' },
      { status: 500 }
    )
  }
}