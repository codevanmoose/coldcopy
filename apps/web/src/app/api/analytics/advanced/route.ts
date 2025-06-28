import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { advancedAnalytics } from '@/lib/analytics/advanced-analytics-service'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspace_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const period = searchParams.get('period') || 'day'
    const type = searchParams.get('type') || 'overview'

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 })
    }

    // Verify user has access to workspace
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Set default date range if not provided
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    
    const timeRange = {
      start: startDate ? new Date(startDate) : thirtyDaysAgo,
      end: endDate ? new Date(endDate) : now,
      period: period as 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year'
    }

    let result: any

    switch (type) {
      case 'campaigns':
        result = await advancedAnalytics.getCampaignAnalytics(workspaceId, timeRange)
        break
      
      case 'leads':
        result = await advancedAnalytics.getLeadAnalytics(workspaceId, timeRange)
        break
      
      case 'emails':
        result = await advancedAnalytics.getEmailPerformanceAnalytics(workspaceId, timeRange)
        break
      
      case 'revenue':
        result = await advancedAnalytics.getRevenueAnalytics(workspaceId, timeRange)
        break
      
      case 'advanced':
        result = await advancedAnalytics.getAdvancedMetrics(workspaceId, timeRange)
        break
      
      case 'geo':
        result = await advancedAnalytics.getGeoAnalytics(workspaceId, timeRange)
        break
      
      case 'realtime':
        result = await advancedAnalytics.getRealTimeAnalytics(workspaceId)
        break
      
      case 'competitor':
        const industry = searchParams.get('industry')
        result = await advancedAnalytics.getCompetitorAnalytics(workspaceId, industry || undefined)
        break
      
      case 'overview':
      default:
        // Get all analytics for overview
        const [campaigns, leads, emails, revenue, advanced] = await Promise.all([
          advancedAnalytics.getCampaignAnalytics(workspaceId, timeRange),
          advancedAnalytics.getLeadAnalytics(workspaceId, timeRange),
          advancedAnalytics.getEmailPerformanceAnalytics(workspaceId, timeRange),
          advancedAnalytics.getRevenueAnalytics(workspaceId, timeRange),
          advancedAnalytics.getAdvancedMetrics(workspaceId, timeRange),
        ])
        
        result = {
          campaigns,
          leads,
          emails,
          revenue,
          advanced,
          summary: {
            total_campaigns: campaigns.length,
            total_emails_sent: emails.total_sent,
            average_open_rate: emails.open_rate,
            total_revenue: revenue.total_revenue,
            engagement_score: advanced.engagement_score,
          }
        }
        break
    }

    return NextResponse.json({
      success: true,
      data: result,
      timeRange: {
        start: timeRange.start.toISOString(),
        end: timeRange.end.toISOString(),
        period: timeRange.period,
      }
    })
  } catch (error) {
    console.error('Advanced analytics error:', error)
    
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { workspace_id, start_date, end_date, format, sections } = body

    if (!workspace_id || !format || !sections) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify user has access to workspace
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Set default date range if not provided
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    
    const timeRange = {
      start: start_date ? new Date(start_date) : thirtyDaysAgo,
      end: end_date ? new Date(end_date) : now,
      period: 'day' as const
    }

    // Export analytics data
    const blob = await advancedAnalytics.exportAnalytics(
      workspace_id,
      timeRange,
      format,
      sections
    )

    const headers = new Headers()
    headers.set('Content-Type', 
      format === 'pdf' ? 'application/pdf' : 
      format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' :
      'text/csv'
    )
    headers.set('Content-Disposition', `attachment; filename="analytics-${format}-${new Date().toISOString().split('T')[0]}.${format}"`)

    return new NextResponse(blob, { headers })
  } catch (error) {
    console.error('Analytics export error:', error)
    
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}