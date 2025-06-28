'use client'

import { createClient } from '@supabase/supabase-js'

export interface RetentionCampaign {
  id: string
  workspace_id: string
  name: string
  description?: string
  campaign_type: 'winback' | 'engagement' | 'onboarding' | 'milestone'
  target_audience: any
  churn_risk_threshold?: number
  days_inactive_threshold?: number
  email_template_id?: string
  in_app_message?: string
  offer_type?: 'discount' | 'free_credits' | 'feature_access' | 'consultation'
  offer_value?: number
  offer_duration_days?: number
  trigger_condition: string
  send_delay_hours: number
  max_sends_per_user: number
  total_sent: number
  total_opened: number
  total_clicked: number
  total_converted: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface UserLifecycleEvent {
  id: string
  workspace_id: string
  user_id: string
  event_type: string
  event_category: 'onboarding' | 'engagement' | 'retention' | 'churn'
  event_data: any
  session_id?: string
  page_url?: string
  user_agent?: string
  triggered_by: 'user_action' | 'system_event' | 'scheduled_job'
  automation_id?: string
  occurred_at: string
  processed_at?: string
}

export interface RetentionAnalytics {
  cohort_analysis: Array<{
    cohort_month: string
    users_count: number
    month_0: number
    month_1: number
    month_2: number
    month_3: number
    month_6: number
    month_12: number
  }>
  churn_analysis: {
    monthly_churn_rate: number
    weekly_churn_rate: number
    high_risk_users: number
    recent_churned: number
    churn_reasons: Array<{
      reason: string
      count: number
      percentage: number
    }>
  }
  engagement_metrics: {
    dau: number // Daily Active Users
    wau: number // Weekly Active Users
    mau: number // Monthly Active Users
    dau_mau_ratio: number
    avg_session_duration: number
    avg_sessions_per_user: number
    feature_adoption: Array<{
      feature: string
      adoption_rate: number
      avg_usage_per_user: number
    }>
  }
  retention_campaigns: {
    total_campaigns: number
    active_campaigns: number
    total_sent: number
    avg_open_rate: number
    avg_click_rate: number
    avg_conversion_rate: number
    roi: number
  }
}

export interface UserRetentionProfile {
  user_id: string
  cohort_month: string
  days_since_signup: number
  is_retained: boolean
  churn_risk_score: number
  engagement_score: number
  last_active_date: string
  total_sessions: number
  features_used: string[]
  lifecycle_stage: 'new' | 'active' | 'at_risk' | 'churned' | 'reactivated'
  recommended_actions: string[]
}

export class RetentionService {
  private supabase: any

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  // Track a lifecycle event
  async trackLifecycleEvent(params: {
    workspace_id: string
    user_id: string
    event_type: string
    event_category: 'onboarding' | 'engagement' | 'retention' | 'churn'
    event_data?: any
    session_id?: string
    page_url?: string
  }): Promise<{
    success: boolean
    event_id?: string
    error?: string
  }> {
    try {
      const { data, error } = await this.supabase
        .rpc('track_lifecycle_event', {
          p_workspace_id: params.workspace_id,
          p_user_id: params.user_id,
          p_event_type: params.event_type,
          p_event_category: params.event_category,
          p_event_data: params.event_data || {},
          p_session_id: params.session_id
        })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, event_id: data }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  // Calculate retention for workspace
  async calculateRetention(workspaceId: string, analysisDate?: Date): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      const { data, error } = await this.supabase
        .rpc('calculate_user_retention', {
          p_workspace_id: workspaceId,
          p_analysis_period: analysisDate?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0]
        })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  // Get retention analytics
  async getRetentionAnalytics(workspaceId: string): Promise<RetentionAnalytics> {
    try {
      // Get cohort analysis
      const { data: cohortData } = await this.supabase
        .from('user_retention_analytics')
        .select('cohort_month, user_id, analysis_period, is_retained')
        .eq('workspace_id', workspaceId)
        .order('cohort_month', { ascending: true })

      const cohortAnalysis = this.processCohortData(cohortData || [])

      // Get churn analysis
      const churnAnalysis = await this.getChurnAnalysis(workspaceId)

      // Get engagement metrics
      const engagementMetrics = await this.getEngagementMetrics(workspaceId)

      // Get retention campaigns metrics
      const campaignMetrics = await this.getRetentionCampaignMetrics(workspaceId)

      return {
        cohort_analysis: cohortAnalysis,
        churn_analysis: churnAnalysis,
        engagement_metrics: engagementMetrics,
        retention_campaigns: campaignMetrics
      }
    } catch (error) {
      console.error('Error fetching retention analytics:', error)
      return {
        cohort_analysis: [],
        churn_analysis: {
          monthly_churn_rate: 0,
          weekly_churn_rate: 0,
          high_risk_users: 0,
          recent_churned: 0,
          churn_reasons: []
        },
        engagement_metrics: {
          dau: 0,
          wau: 0,
          mau: 0,
          dau_mau_ratio: 0,
          avg_session_duration: 0,
          avg_sessions_per_user: 0,
          feature_adoption: []
        },
        retention_campaigns: {
          total_campaigns: 0,
          active_campaigns: 0,
          total_sent: 0,
          avg_open_rate: 0,
          avg_click_rate: 0,
          avg_conversion_rate: 0,
          roi: 0
        }
      }
    }
  }

  // Get user retention profile
  async getUserRetentionProfile(workspaceId: string, userId: string): Promise<UserRetentionProfile | null> {
    try {
      // Get latest retention analytics for user
      const { data: retentionData } = await this.supabase
        .from('user_retention_analytics')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId)
        .order('analysis_period', { ascending: false })
        .limit(1)
        .single()

      if (!retentionData) {
        return null
      }

      // Get user profile
      const { data: userProfile } = await this.supabase
        .from('user_profiles')
        .select('created_at')
        .eq('user_id', userId)
        .single()

      // Get recent lifecycle events
      const { data: recentEvents } = await this.supabase
        .from('user_lifecycle_events')
        .select('event_type, occurred_at')
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId)
        .order('occurred_at', { ascending: false })
        .limit(10)

      const signupDate = new Date(userProfile?.created_at)
      const daysSinceSignup = Math.floor((Date.now() - signupDate.getTime()) / (1000 * 60 * 60 * 24))
      
      // Determine lifecycle stage
      let lifecycleStage: 'new' | 'active' | 'at_risk' | 'churned' | 'reactivated' = 'new'
      
      if (daysSinceSignup > 30) {
        if (retentionData.churn_risk_score > 0.7) {
          lifecycleStage = 'at_risk'
        } else if (retentionData.is_retained) {
          lifecycleStage = 'active'
        } else {
          lifecycleStage = 'churned'
        }
      }

      // Generate recommendations
      const recommendedActions = this.generateRecommendations(retentionData, lifecycleStage)

      return {
        user_id: userId,
        cohort_month: retentionData.cohort_month,
        days_since_signup: daysSinceSignup,
        is_retained: retentionData.is_retained,
        churn_risk_score: retentionData.churn_risk_score,
        engagement_score: retentionData.engagement_score,
        last_active_date: recentEvents?.[0]?.occurred_at || retentionData.updated_at,
        total_sessions: retentionData.sessions_count || 0,
        features_used: retentionData.features_used || [],
        lifecycle_stage: lifecycleStage,
        recommended_actions: recommendedActions
      }
    } catch (error) {
      console.error('Error fetching user retention profile:', error)
      return null
    }
  }

  // Create retention campaign
  async createRetentionCampaign(params: Partial<RetentionCampaign> & { workspace_id: string }): Promise<{
    success: boolean
    campaign?: RetentionCampaign
    error?: string
  }> {
    try {
      const { data, error } = await this.supabase
        .from('retention_campaigns')
        .insert({
          workspace_id: params.workspace_id,
          name: params.name || 'Retention Campaign',
          description: params.description,
          campaign_type: params.campaign_type || 'engagement',
          target_audience: params.target_audience || {},
          churn_risk_threshold: params.churn_risk_threshold,
          days_inactive_threshold: params.days_inactive_threshold,
          email_template_id: params.email_template_id,
          in_app_message: params.in_app_message,
          offer_type: params.offer_type,
          offer_value: params.offer_value,
          offer_duration_days: params.offer_duration_days,
          trigger_condition: params.trigger_condition || 'churn_risk_increase',
          send_delay_hours: params.send_delay_hours || 0,
          max_sends_per_user: params.max_sends_per_user || 1
        })
        .select()
        .single()

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, campaign: data }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  // Get retention campaigns
  async getRetentionCampaigns(workspaceId: string): Promise<RetentionCampaign[]> {
    try {
      const { data, error } = await this.supabase
        .from('retention_campaigns')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching retention campaigns:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error fetching retention campaigns:', error)
      return []
    }
  }

  // Get users at risk of churning
  async getAtRiskUsers(workspaceId: string, riskThreshold: number = 0.7): Promise<UserRetentionProfile[]> {
    try {
      const { data: atRiskData } = await this.supabase
        .from('user_retention_analytics')
        .select(`
          user_id,
          cohort_month,
          churn_risk_score,
          engagement_score,
          is_retained,
          updated_at
        `)
        .eq('workspace_id', workspaceId)
        .gte('churn_risk_score', riskThreshold)
        .order('churn_risk_score', { ascending: false })
        .limit(50)

      if (!atRiskData) return []

      // Enrich with user profiles
      const userIds = atRiskData.map(u => u.user_id)
      const { data: userProfiles } = await this.supabase
        .from('user_profiles')
        .select('user_id, created_at')
        .in('user_id', userIds)

      const profileMap = new Map(userProfiles?.map(p => [p.user_id, p]) || [])

      return atRiskData.map(user => {
        const profile = profileMap.get(user.user_id)
        const signupDate = profile ? new Date(profile.created_at) : new Date()
        const daysSinceSignup = Math.floor((Date.now() - signupDate.getTime()) / (1000 * 60 * 60 * 24))

        return {
          user_id: user.user_id,
          cohort_month: user.cohort_month,
          days_since_signup: daysSinceSignup,
          is_retained: user.is_retained,
          churn_risk_score: user.churn_risk_score,
          engagement_score: user.engagement_score,
          last_active_date: user.updated_at,
          total_sessions: 0,
          features_used: [],
          lifecycle_stage: 'at_risk' as const,
          recommended_actions: this.generateRecommendations(user, 'at_risk')
        }
      })
    } catch (error) {
      console.error('Error fetching at-risk users:', error)
      return []
    }
  }

  // Process cohort data for analysis
  private processCohortData(data: any[]): Array<{
    cohort_month: string
    users_count: number
    month_0: number
    month_1: number
    month_2: number
    month_3: number
    month_6: number
    month_12: number
  }> {
    const cohortMap = new Map()

    // Group by cohort month
    data.forEach(record => {
      const cohortKey = record.cohort_month
      if (!cohortMap.has(cohortKey)) {
        cohortMap.set(cohortKey, {
          cohort_month: cohortKey,
          users: new Set(),
          retention_by_month: new Map()
        })
      }

      const cohort = cohortMap.get(cohortKey)
      cohort.users.add(record.user_id)

      const cohortDate = new Date(record.cohort_month)
      const analysisDate = new Date(record.analysis_period)
      const monthsDiff = (analysisDate.getFullYear() - cohortDate.getFullYear()) * 12 + 
                        (analysisDate.getMonth() - cohortDate.getMonth())

      if (!cohort.retention_by_month.has(monthsDiff)) {
        cohort.retention_by_month.set(monthsDiff, new Set())
      }

      if (record.is_retained) {
        cohort.retention_by_month.get(monthsDiff).add(record.user_id)
      }
    })

    // Convert to analysis format
    return Array.from(cohortMap.values()).map(cohort => {
      const totalUsers = cohort.users.size
      const getRetentionRate = (month: number) => {
        const retainedUsers = cohort.retention_by_month.get(month)?.size || 0
        return totalUsers > 0 ? (retainedUsers / totalUsers) * 100 : 0
      }

      return {
        cohort_month: cohort.cohort_month,
        users_count: totalUsers,
        month_0: getRetentionRate(0),
        month_1: getRetentionRate(1),
        month_2: getRetentionRate(2),
        month_3: getRetentionRate(3),
        month_6: getRetentionRate(6),
        month_12: getRetentionRate(12)
      }
    }).sort((a, b) => a.cohort_month.localeCompare(b.cohort_month))
  }

  // Get churn analysis
  private async getChurnAnalysis(workspaceId: string) {
    // This would involve complex queries to analyze churn patterns
    // For now, return mock data structure
    return {
      monthly_churn_rate: 5.2,
      weekly_churn_rate: 1.3,
      high_risk_users: 15,
      recent_churned: 8,
      churn_reasons: [
        { reason: 'Low engagement', count: 12, percentage: 35.3 },
        { reason: 'Feature complexity', count: 8, percentage: 23.5 },
        { reason: 'Pricing concerns', count: 6, percentage: 17.6 },
        { reason: 'Better alternative', count: 5, percentage: 14.7 },
        { reason: 'Other', count: 3, percentage: 8.8 }
      ]
    }
  }

  // Get engagement metrics
  private async getEngagementMetrics(workspaceId: string) {
    // This would calculate real engagement metrics
    // For now, return mock data structure
    return {
      dau: 127,
      wau: 412,
      mau: 1245,
      dau_mau_ratio: 0.102,
      avg_session_duration: 1847, // seconds
      avg_sessions_per_user: 3.4,
      feature_adoption: [
        { feature: 'Email Campaigns', adoption_rate: 89.2, avg_usage_per_user: 12.3 },
        { feature: 'Lead Import', adoption_rate: 76.8, avg_usage_per_user: 8.1 },
        { feature: 'AI Email Generation', adoption_rate: 64.5, avg_usage_per_user: 15.7 },
        { feature: 'Analytics Dashboard', adoption_rate: 45.2, avg_usage_per_user: 5.2 }
      ]
    }
  }

  // Get retention campaign metrics
  private async getRetentionCampaignMetrics(workspaceId: string) {
    const { data: campaigns } = await this.supabase
      .from('retention_campaigns')
      .select('total_sent, total_opened, total_clicked, total_converted, is_active')
      .eq('workspace_id', workspaceId)

    if (!campaigns || campaigns.length === 0) {
      return {
        total_campaigns: 0,
        active_campaigns: 0,
        total_sent: 0,
        avg_open_rate: 0,
        avg_click_rate: 0,
        avg_conversion_rate: 0,
        roi: 0
      }
    }

    const totalSent = campaigns.reduce((sum, c) => sum + c.total_sent, 0)
    const totalOpened = campaigns.reduce((sum, c) => sum + c.total_opened, 0)
    const totalClicked = campaigns.reduce((sum, c) => sum + c.total_clicked, 0)
    const totalConverted = campaigns.reduce((sum, c) => sum + c.total_converted, 0)

    return {
      total_campaigns: campaigns.length,
      active_campaigns: campaigns.filter(c => c.is_active).length,
      total_sent: totalSent,
      avg_open_rate: totalSent > 0 ? (totalOpened / totalSent) * 100 : 0,
      avg_click_rate: totalSent > 0 ? (totalClicked / totalSent) * 100 : 0,
      avg_conversion_rate: totalSent > 0 ? (totalConverted / totalSent) * 100 : 0,
      roi: 0 // Would calculate based on revenue and costs
    }
  }

  // Generate recommendations based on retention data
  private generateRecommendations(retentionData: any, lifecycleStage: string): string[] {
    const recommendations: string[] = []

    if (lifecycleStage === 'new') {
      recommendations.push('Complete onboarding checklist')
      recommendations.push('Try creating your first campaign')
      recommendations.push('Import your leads')
    } else if (lifecycleStage === 'at_risk') {
      if (retentionData.engagement_score < 0.3) {
        recommendations.push('Schedule a product demo')
        recommendations.push('Explore advanced features')
      }
      if (retentionData.churn_risk_score > 0.8) {
        recommendations.push('Contact customer success team')
        recommendations.push('Consider upgrading for more features')
      }
    } else if (lifecycleStage === 'churned') {
      recommendations.push('Send win-back email with discount')
      recommendations.push('Survey for feedback on why they left')
    }

    return recommendations
  }
}

// Export singleton instance
export const retentionService = new RetentionService()