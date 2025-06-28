import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { RedisManager } from '@/lib/cache/redis-manager'

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!process.env.REDIS_URL) {
      return NextResponse.json({ 
        success: true, 
        message: 'Redis not configured, skipping cache warming' 
      })
    }

    const supabase = createClient()
    const redis = new RedisManager()
    
    let warmed = 0
    let errors = 0

    // Warm popular lead scores
    const { data: popularLeads } = await supabase
      .from('leads')
      .select('id, workspace_id')
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(100)

    if (popularLeads) {
      for (const lead of popularLeads) {
        try {
          const cacheKey = `lead_score:${lead.workspace_id}:${lead.id}`
          
          // Check if already cached
          const cached = await redis.get(cacheKey)
          if (!cached) {
            // Fetch and cache the score
            const { data: score } = await supabase
              .from('lead_scores')
              .select('*')
              .eq('lead_id', lead.id)
              .single()
              
            if (score) {
              await redis.set(cacheKey, score, { ttl: 3600 }) // 1 hour TTL
              warmed++
            }
          }
        } catch (error) {
          console.error(`Failed to warm cache for lead ${lead.id}:`, error)
          errors++
        }
      }
    }

    // Warm campaign analytics
    const { data: activeCampaigns } = await supabase
      .from('campaigns')
      .select('id, workspace_id')
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(50)

    if (activeCampaigns) {
      for (const campaign of activeCampaigns) {
        try {
          const cacheKey = `campaign_analytics:${campaign.workspace_id}:${campaign.id}`
          
          const cached = await redis.get(cacheKey)
          if (!cached) {
            // Calculate and cache analytics
            const { data: analytics } = await supabase.rpc('get_campaign_analytics', {
              p_campaign_id: campaign.id
            })
            
            if (analytics) {
              await redis.set(cacheKey, analytics, { ttl: 300 }) // 5 minute TTL
              warmed++
            }
          }
        } catch (error) {
          console.error(`Failed to warm cache for campaign ${campaign.id}:`, error)
          errors++
        }
      }
    }

    // Warm workspace dashboards
    const { data: activeWorkspaces } = await supabase
      .from('workspaces')
      .select('id')
      .eq('status', 'active')
      .order('last_active_at', { ascending: false })
      .limit(20)

    if (activeWorkspaces) {
      for (const workspace of activeWorkspaces) {
        try {
          const cacheKey = `workspace_dashboard:${workspace.id}`
          
          const cached = await redis.get(cacheKey)
          if (!cached) {
            // Build and cache dashboard data
            const [campaignStats, leadStats, revenueStats] = await Promise.all([
              supabase.rpc('get_campaign_stats', { p_workspace_id: workspace.id }),
              supabase.rpc('get_lead_stats', { p_workspace_id: workspace.id }),
              supabase.rpc('get_revenue_stats', { p_workspace_id: workspace.id }),
            ])
            
            const dashboardData = {
              campaigns: campaignStats.data,
              leads: leadStats.data,
              revenue: revenueStats.data,
              cachedAt: new Date().toISOString(),
            }
            
            await redis.set(cacheKey, dashboardData, { ttl: 600 }) // 10 minute TTL
            warmed++
          }
        } catch (error) {
          console.error(`Failed to warm cache for workspace ${workspace.id}:`, error)
          errors++
        }
      }
    }

    // Get cache stats
    const stats = await redis.getStats()

    return NextResponse.json({
      success: true,
      warmed,
      errors,
      cacheStats: stats,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Cache warming cron error:', error)
    return NextResponse.json(
      { error: 'Failed to warm cache' },
      { status: 500 }
    )
  }
}