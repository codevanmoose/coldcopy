import { createClient } from '@/lib/supabase/client'

export interface AnalyticsTimeRange {
  start: Date
  end: Date
  period: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year'
}

export interface CampaignAnalytics {
  campaign_id: string
  campaign_name: string
  status: string
  emails_sent: number
  emails_delivered: number
  emails_opened: number
  emails_clicked: number
  emails_replied: number
  emails_bounced: number
  emails_unsubscribed: number
  delivery_rate: number
  open_rate: number
  click_rate: number
  reply_rate: number
  bounce_rate: number
  unsubscribe_rate: number
  cost_per_lead: number
  roi: number
  created_at: string
  last_activity: string
}

export interface LeadAnalytics {
  total_leads: number
  engaged_leads: number
  qualified_leads: number
  converted_leads: number
  enriched_leads: number
  engagement_rate: number
  qualification_rate: number
  conversion_rate: number
  enrichment_rate: number
  lead_sources: Array<{
    source: string
    count: number
    percentage: number
  }>
  lead_score_distribution: Array<{
    score_range: string
    count: number
    percentage: number
  }>
}

export interface EmailPerformanceAnalytics {
  total_sent: number
  total_delivered: number
  total_opened: number
  total_clicked: number
  total_replied: number
  total_bounced: number
  total_unsubscribed: number
  delivery_rate: number
  open_rate: number
  click_rate: number
  reply_rate: number
  bounce_rate: number
  unsubscribe_rate: number
  best_sending_time: string
  best_sending_day: string
  subject_line_performance: Array<{
    subject: string
    open_rate: number
    click_rate: number
    sent_count: number
  }>
  email_template_performance: Array<{
    template_id: string
    template_name: string
    open_rate: number
    click_rate: number
    reply_rate: number
    usage_count: number
  }>
}

export interface RevenueAnalytics {
  total_revenue: number
  monthly_recurring_revenue: number
  average_deal_size: number
  customer_lifetime_value: number
  cost_per_acquisition: number
  revenue_by_source: Array<{
    source: string
    revenue: number
    percentage: number
  }>
  revenue_trends: Array<{
    date: string
    revenue: number
    deals_closed: number
  }>
  pipeline_value: number
  conversion_funnel: Array<{
    stage: string
    count: number
    conversion_rate: number
    value: number
  }>
}

export interface AdvancedMetrics {
  engagement_score: number
  deliverability_score: number
  sender_reputation: number
  list_health_score: number
  campaign_effectiveness: number
  lead_quality_score: number
  predictive_analytics: {
    next_month_performance: {
      estimated_opens: number
      estimated_clicks: number
      estimated_replies: number
      confidence_level: number
    }
    churn_risk_leads: Array<{
      lead_id: string
      lead_email: string
      risk_score: number
      risk_factors: string[]
    }>
    optimal_send_times: Array<{
      day: string
      hour: number
      expected_open_rate: number
    }>
  }
}

export interface CompetitorAnalytics {
  market_share: number
  competitor_comparison: Array<{
    competitor: string
    market_share: number
    estimated_volume: number
    key_differentiators: string[]
  }>
  industry_benchmarks: {
    average_open_rate: number
    average_click_rate: number
    average_reply_rate: number
    average_bounce_rate: number
  }
}

export interface GeoAnalytics {
  performance_by_region: Array<{
    country: string
    region: string
    emails_sent: number
    open_rate: number
    click_rate: number
    reply_rate: number
    conversion_rate: number
  }>
  timezone_performance: Array<{
    timezone: string
    best_send_time: string
    open_rate: number
    click_rate: number
  }>
  language_performance: Array<{
    language: string
    emails_sent: number
    engagement_rate: number
    conversion_rate: number
  }>
}

export interface RealTimeAnalytics {
  active_campaigns: number
  emails_sent_today: number
  opens_last_hour: number
  clicks_last_hour: number
  replies_last_hour: number
  current_sending_rate: number
  server_performance: {
    response_time: number
    uptime: number
    error_rate: number
  }
  live_events: Array<{
    timestamp: string
    event_type: string
    campaign_name: string
    lead_email: string
    details: any
  }>
}

export class AdvancedAnalyticsService {
  private supabase = createClient()

  async getCampaignAnalytics(
    workspaceId: string,
    timeRange: AnalyticsTimeRange,
    campaignIds?: string[]
  ): Promise<CampaignAnalytics[]> {
    let query = this.supabase
      .from('mv_campaign_analytics')
      .select('*')
      .eq('workspace_id', workspaceId)
      .gte('created_at', timeRange.start.toISOString())
      .lte('created_at', timeRange.end.toISOString())

    if (campaignIds && campaignIds.length > 0) {
      query = query.in('campaign_id', campaignIds)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch campaign analytics: ${error.message}`)

    return data || []
  }

  async getLeadAnalytics(
    workspaceId: string,
    timeRange: AnalyticsTimeRange
  ): Promise<LeadAnalytics> {
    // Get lead metrics from materialized view
    const { data: leadMetrics, error: leadError } = await this.supabase
      .from('mv_lead_analytics')
      .select('*')
      .eq('workspace_id', workspaceId)
      .gte('period_start', timeRange.start.toISOString())
      .lte('period_end', timeRange.end.toISOString())
      .single()

    if (leadError) throw new Error(`Failed to fetch lead analytics: ${leadError.message}`)

    // Get lead sources
    const { data: leadSources, error: sourcesError } = await this.supabase
      .from('leads')
      .select('source')
      .eq('workspace_id', workspaceId)
      .gte('created_at', timeRange.start.toISOString())
      .lte('created_at', timeRange.end.toISOString())

    if (sourcesError) throw new Error(`Failed to fetch lead sources: ${sourcesError.message}`)

    // Calculate lead source distribution
    const sourceDistribution = this.calculateDistribution(
      leadSources?.map(l => l.source) || [],
      'Unknown'
    )

    // Get lead score distribution
    const { data: leadScores, error: scoresError } = await this.supabase
      .from('leads')
      .select('enrichment_data')
      .eq('workspace_id', workspaceId)
      .gte('created_at', timeRange.start.toISOString())
      .lte('created_at', timeRange.end.toISOString())

    if (scoresError) throw new Error(`Failed to fetch lead scores: ${scoresError.message}`)

    const scores = leadScores
      ?.map(l => l.enrichment_data?.score || 0)
      .filter(score => score > 0) || []

    const scoreDistribution = this.calculateScoreDistribution(scores)

    return {
      total_leads: leadMetrics?.total_leads || 0,
      engaged_leads: leadMetrics?.engaged_leads || 0,
      qualified_leads: leadMetrics?.qualified_leads || 0,
      converted_leads: leadMetrics?.converted_leads || 0,
      enriched_leads: leadMetrics?.enriched_leads || 0,
      engagement_rate: leadMetrics?.engagement_rate || 0,
      qualification_rate: leadMetrics?.qualification_rate || 0,
      conversion_rate: leadMetrics?.conversion_rate || 0,
      enrichment_rate: leadMetrics?.enrichment_rate || 0,
      lead_sources: sourceDistribution,
      lead_score_distribution: scoreDistribution,
    }
  }

  async getEmailPerformanceAnalytics(
    workspaceId: string,
    timeRange: AnalyticsTimeRange
  ): Promise<EmailPerformanceAnalytics> {
    // Get email performance from materialized view
    const { data: emailMetrics, error: emailError } = await this.supabase
      .from('mv_email_performance')
      .select('*')
      .eq('workspace_id', workspaceId)
      .gte('period_start', timeRange.start.toISOString())
      .lte('period_end', timeRange.end.toISOString())
      .single()

    if (emailError) throw new Error(`Failed to fetch email performance: ${emailError.message}`)

    // Get subject line performance
    const { data: subjectPerformance, error: subjectError } = await this.supabase.rpc(
      'get_subject_line_performance',
      {
        p_workspace_id: workspaceId,
        p_start_date: timeRange.start.toISOString(),
        p_end_date: timeRange.end.toISOString(),
      }
    )

    if (subjectError) throw new Error(`Failed to fetch subject performance: ${subjectError.message}`)

    // Get template performance
    const { data: templatePerformance, error: templateError } = await this.supabase.rpc(
      'get_template_performance',
      {
        p_workspace_id: workspaceId,
        p_start_date: timeRange.start.toISOString(),
        p_end_date: timeRange.end.toISOString(),
      }
    )

    if (templateError) throw new Error(`Failed to fetch template performance: ${templateError.message}`)

    return {
      total_sent: emailMetrics?.total_sent || 0,
      total_delivered: emailMetrics?.total_delivered || 0,
      total_opened: emailMetrics?.total_opened || 0,
      total_clicked: emailMetrics?.total_clicked || 0,
      total_replied: emailMetrics?.total_replied || 0,
      total_bounced: emailMetrics?.total_bounced || 0,
      total_unsubscribed: emailMetrics?.total_unsubscribed || 0,
      delivery_rate: emailMetrics?.delivery_rate || 0,
      open_rate: emailMetrics?.open_rate || 0,
      click_rate: emailMetrics?.click_rate || 0,
      reply_rate: emailMetrics?.reply_rate || 0,
      bounce_rate: emailMetrics?.bounce_rate || 0,
      unsubscribe_rate: emailMetrics?.unsubscribe_rate || 0,
      best_sending_time: emailMetrics?.best_sending_time || '10:00',
      best_sending_day: emailMetrics?.best_sending_day || 'Tuesday',
      subject_line_performance: subjectPerformance || [],
      email_template_performance: templatePerformance || [],
    }
  }

  async getRevenueAnalytics(
    workspaceId: string,
    timeRange: AnalyticsTimeRange
  ): Promise<RevenueAnalytics> {
    // Get revenue metrics from materialized view
    const { data: revenueMetrics, error: revenueError } = await this.supabase
      .from('mv_revenue_analytics')
      .select('*')
      .eq('workspace_id', workspaceId)
      .gte('period_start', timeRange.start.toISOString())
      .lte('period_end', timeRange.end.toISOString())
      .single()

    if (revenueError) throw new Error(`Failed to fetch revenue analytics: ${revenueError.message}`)

    // Get revenue trends
    const { data: revenueTrends, error: trendsError } = await this.supabase.rpc(
      'get_revenue_trends',
      {
        p_workspace_id: workspaceId,
        p_start_date: timeRange.start.toISOString(),
        p_end_date: timeRange.end.toISOString(),
        p_period: timeRange.period,
      }
    )

    if (trendsError) throw new Error(`Failed to fetch revenue trends: ${trendsError.message}`)

    return {
      total_revenue: revenueMetrics?.total_revenue || 0,
      monthly_recurring_revenue: revenueMetrics?.monthly_recurring_revenue || 0,
      average_deal_size: revenueMetrics?.average_deal_size || 0,
      customer_lifetime_value: revenueMetrics?.customer_lifetime_value || 0,
      cost_per_acquisition: revenueMetrics?.cost_per_acquisition || 0,
      revenue_by_source: revenueMetrics?.revenue_by_source || [],
      revenue_trends: revenueTrends || [],
      pipeline_value: revenueMetrics?.pipeline_value || 0,
      conversion_funnel: revenueMetrics?.conversion_funnel || [],
    }
  }

  async getAdvancedMetrics(
    workspaceId: string,
    timeRange: AnalyticsTimeRange
  ): Promise<AdvancedMetrics> {
    // Get advanced metrics using stored procedures
    const { data: metrics, error } = await this.supabase.rpc(
      'get_advanced_metrics',
      {
        p_workspace_id: workspaceId,
        p_start_date: timeRange.start.toISOString(),
        p_end_date: timeRange.end.toISOString(),
      }
    )

    if (error) throw new Error(`Failed to fetch advanced metrics: ${error.message}`)

    return metrics || {
      engagement_score: 0,
      deliverability_score: 0,
      sender_reputation: 0,
      list_health_score: 0,
      campaign_effectiveness: 0,
      lead_quality_score: 0,
      predictive_analytics: {
        next_month_performance: {
          estimated_opens: 0,
          estimated_clicks: 0,
          estimated_replies: 0,
          confidence_level: 0,
        },
        churn_risk_leads: [],
        optimal_send_times: [],
      },
    }
  }

  async getGeoAnalytics(
    workspaceId: string,
    timeRange: AnalyticsTimeRange
  ): Promise<GeoAnalytics> {
    // Get geographical performance data
    const { data: geoData, error } = await this.supabase.rpc(
      'get_geo_analytics',
      {
        p_workspace_id: workspaceId,
        p_start_date: timeRange.start.toISOString(),
        p_end_date: timeRange.end.toISOString(),
      }
    )

    if (error) throw new Error(`Failed to fetch geo analytics: ${error.message}`)

    return geoData || {
      performance_by_region: [],
      timezone_performance: [],
      language_performance: [],
    }
  }

  async getRealTimeAnalytics(workspaceId: string): Promise<RealTimeAnalytics> {
    // Get real-time metrics
    const { data: realTimeData, error } = await this.supabase.rpc(
      'get_realtime_analytics',
      { p_workspace_id: workspaceId }
    )

    if (error) throw new Error(`Failed to fetch real-time analytics: ${error.message}`)

    return realTimeData || {
      active_campaigns: 0,
      emails_sent_today: 0,
      opens_last_hour: 0,
      clicks_last_hour: 0,
      replies_last_hour: 0,
      current_sending_rate: 0,
      server_performance: {
        response_time: 0,
        uptime: 0,
        error_rate: 0,
      },
      live_events: [],
    }
  }

  async getCompetitorAnalytics(
    workspaceId: string,
    industry?: string
  ): Promise<CompetitorAnalytics> {
    // Get industry benchmarks and competitor data
    const { data: competitorData, error } = await this.supabase.rpc(
      'get_competitor_analytics',
      {
        p_workspace_id: workspaceId,
        p_industry: industry,
      }
    )

    if (error) throw new Error(`Failed to fetch competitor analytics: ${error.message}`)

    return competitorData || {
      market_share: 0,
      competitor_comparison: [],
      industry_benchmarks: {
        average_open_rate: 0,
        average_click_rate: 0,
        average_reply_rate: 0,
        average_bounce_rate: 0,
      },
    }
  }

  async exportAnalytics(
    workspaceId: string,
    timeRange: AnalyticsTimeRange,
    format: 'csv' | 'pdf' | 'xlsx',
    sections: string[]
  ): Promise<Blob> {
    // Generate comprehensive analytics export
    const { data, error } = await this.supabase.rpc(
      'export_analytics',
      {
        p_workspace_id: workspaceId,
        p_start_date: timeRange.start.toISOString(),
        p_end_date: timeRange.end.toISOString(),
        p_format: format,
        p_sections: sections,
      }
    )

    if (error) throw new Error(`Failed to export analytics: ${error.message}`)

    return new Blob([data], {
      type: format === 'pdf' ? 'application/pdf' : 
           format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' :
           'text/csv'
    })
  }

  private calculateDistribution(items: string[], defaultValue: string): Array<{source: string, count: number, percentage: number}> {
    const counts: Record<string, number> = {}
    const total = items.length

    items.forEach(item => {
      const key = item || defaultValue
      counts[key] = (counts[key] || 0) + 1
    })

    return Object.entries(counts).map(([source, count]) => ({
      source,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0
    }))
  }

  private calculateScoreDistribution(scores: number[]): Array<{score_range: string, count: number, percentage: number}> {
    const ranges = [
      { range: '0-20', min: 0, max: 20 },
      { range: '21-40', min: 21, max: 40 },
      { range: '41-60', min: 41, max: 60 },
      { range: '61-80', min: 61, max: 80 },
      { range: '81-100', min: 81, max: 100 },
    ]

    const total = scores.length
    
    return ranges.map(({ range, min, max }) => {
      const count = scores.filter(score => score >= min && score <= max).length
      return {
        score_range: range,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0
      }
    })
  }
}

// Export singleton instance
export const advancedAnalytics = new AdvancedAnalyticsService()