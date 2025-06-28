'use client'

import { createClient } from '@supabase/supabase-js'

export interface UsageMetric {
  id: string
  workspace_id: string
  user_id: string
  metric_type: 'ai_tokens' | 'emails_sent' | 'leads_enriched' | 'api_calls'
  provider?: string
  model_name?: string
  input_tokens: number
  output_tokens: number
  total_tokens: number
  units_used: number
  cost_per_unit: number
  total_cost: number
  resource_type?: string
  resource_id?: string
  feature_name: string
  request_data: any
  response_data: any
  duration_ms?: number
  billing_period: string
  created_at: string
}

export interface UsageLimit {
  id: string
  workspace_id: string
  metric_type: string
  limit_type: 'hard' | 'soft' | 'warning'
  monthly_limit?: number
  daily_limit?: number
  burst_limit?: number
  current_monthly_usage: number
  current_daily_usage: number
  current_burst_usage: number
  warning_threshold: number
  warning_sent_at?: string
  limit_reached_at?: string
  is_active: boolean
}

export interface AIModelPricing {
  id: string
  provider: string
  model_name: string
  model_version?: string
  input_price_per_1k: number
  output_price_per_1k: number
  max_tokens: number
  context_window: number
  supports_functions: boolean
  supports_vision: boolean
  supports_streaming: boolean
  description?: string
  performance_tier: 'basic' | 'advanced' | 'premium'
  is_active: boolean
}

export interface UsageSummary {
  metric_type: string
  provider: string
  total_units: number
  total_cost: number
  request_count: number
}

export interface FeatureUsage {
  feature_name: string
  feature_category: string
  usage_count: number
  last_used: string
}

export class UsageTracker {
  private supabase: any

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  // Track AI token usage
  async trackAIUsage(params: {
    workspaceId: string
    userId: string
    provider: string
    modelName: string
    inputTokens: number
    outputTokens: number
    featureName: string
    resourceType?: string
    resourceId?: string
    requestData?: any
    responseData?: any
    durationMs?: number
  }): Promise<{ success: boolean; usageId?: string; error?: string }> {
    try {
      const { data, error } = await this.supabase.rpc('track_ai_usage', {
        p_workspace_id: params.workspaceId,
        p_user_id: params.userId,
        p_provider: params.provider,
        p_model_name: params.modelName,
        p_input_tokens: params.inputTokens,
        p_output_tokens: params.outputTokens,
        p_feature_name: params.featureName,
        p_resource_type: params.resourceType,
        p_resource_id: params.resourceId,
        p_request_data: params.requestData || {},
        p_response_data: params.responseData || {}
      })

      if (error) {
        console.error('Error tracking AI usage:', error)
        return { success: false, error: error.message }
      }

      return { success: true, usageId: data }
    } catch (error: any) {
      console.error('Error tracking AI usage:', error)
      return { success: false, error: error.message }
    }
  }

  // Track feature usage
  async trackFeatureUsage(params: {
    workspaceId: string
    userId: string
    featureName: string
    featureCategory?: string
    metadata?: any
    sessionId?: string
  }): Promise<{ success: boolean; usageId?: string; error?: string }> {
    try {
      const { data, error } = await this.supabase.rpc('track_feature_usage', {
        p_workspace_id: params.workspaceId,
        p_user_id: params.userId,
        p_feature_name: params.featureName,
        p_feature_category: params.featureCategory,
        p_metadata: params.metadata || {},
        p_session_id: params.sessionId
      })

      if (error) {
        console.error('Error tracking feature usage:', error)
        return { success: false, error: error.message }
      }

      return { success: true, usageId: data }
    } catch (error: any) {
      console.error('Error tracking feature usage:', error)
      return { success: false, error: error.message }
    }
  }

  // Track general usage (emails, enrichments, etc.)
  async trackUsage(params: {
    workspaceId: string
    userId: string
    metricType: 'emails_sent' | 'leads_enriched' | 'api_calls'
    unitsUsed: number
    featureName: string
    resourceType?: string
    resourceId?: string
    metadata?: any
  }): Promise<{ success: boolean; usageId?: string; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from('usage_metrics')
        .insert({
          workspace_id: params.workspaceId,
          user_id: params.userId,
          metric_type: params.metricType,
          units_used: params.unitsUsed,
          total_tokens: 0,
          feature_name: params.featureName,
          resource_type: params.resourceType,
          resource_id: params.resourceId,
          request_data: params.metadata || {}
        })
        .select('id')
        .single()

      if (error) {
        console.error('Error tracking usage:', error)
        return { success: false, error: error.message }
      }

      // Update usage limits
      await this.supabase.rpc('update_usage_limits', {
        p_workspace_id: params.workspaceId,
        p_metric_type: params.metricType,
        p_units_used: params.unitsUsed
      })

      return { success: true, usageId: data.id }
    } catch (error: any) {
      console.error('Error tracking usage:', error)
      return { success: false, error: error.message }
    }
  }

  // Get usage limits for workspace
  async getUsageLimits(workspaceId: string): Promise<UsageLimit[]> {
    try {
      const { data, error } = await this.supabase
        .from('usage_limits')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching usage limits:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error fetching usage limits:', error)
      return []
    }
  }

  // Check if usage limit is exceeded
  async checkUsageLimits(
    workspaceId: string, 
    metricType: string, 
    unitsToUse: number = 1
  ): Promise<{
    allowed: boolean
    limitType?: string
    currentUsage?: number
    limit?: number
    message?: string
  }> {
    try {
      const limits = await this.getUsageLimits(workspaceId)
      const limit = limits.find(l => l.metric_type === metricType)

      if (!limit) {
        return { allowed: true } // No limits configured
      }

      // Check burst limit (hourly)
      if (limit.burst_limit && limit.current_burst_usage + unitsToUse > limit.burst_limit) {
        return {
          allowed: false,
          limitType: 'burst',
          currentUsage: limit.current_burst_usage,
          limit: limit.burst_limit,
          message: `Burst limit exceeded. You can use ${limit.burst_limit} ${metricType} per hour.`
        }
      }

      // Check daily limit
      if (limit.daily_limit && limit.current_daily_usage + unitsToUse > limit.daily_limit) {
        return {
          allowed: false,
          limitType: 'daily',
          currentUsage: limit.current_daily_usage,
          limit: limit.daily_limit,
          message: `Daily limit exceeded. You can use ${limit.daily_limit} ${metricType} per day.`
        }
      }

      // Check monthly limit
      if (limit.monthly_limit && limit.current_monthly_usage + unitsToUse > limit.monthly_limit) {
        return {
          allowed: false,
          limitType: 'monthly',
          currentUsage: limit.current_monthly_usage,
          limit: limit.monthly_limit,
          message: `Monthly limit exceeded. You can use ${limit.monthly_limit} ${metricType} per month.`
        }
      }

      return { allowed: true }
    } catch (error) {
      console.error('Error checking usage limits:', error)
      return { allowed: false, message: 'Error checking usage limits' }
    }
  }

  // Get usage summary
  async getUsageSummary(
    workspaceId: string,
    periodStart?: string,
    periodEnd?: string
  ): Promise<UsageSummary[]> {
    try {
      const { data, error } = await this.supabase.rpc('get_usage_summary', {
        p_workspace_id: workspaceId,
        p_period_start: periodStart,
        p_period_end: periodEnd
      })

      if (error) {
        console.error('Error fetching usage summary:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error fetching usage summary:', error)
      return []
    }
  }

  // Get AI model pricing
  async getAIModelPricing(): Promise<AIModelPricing[]> {
    try {
      const { data, error } = await this.supabase
        .from('ai_model_pricing')
        .select('*')
        .eq('is_active', true)
        .order('provider', { ascending: true })
        .order('performance_tier', { ascending: false })

      if (error) {
        console.error('Error fetching AI model pricing:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error fetching AI model pricing:', error)
      return []
    }
  }

  // Calculate estimated cost for AI request
  calculateAICost(
    provider: string,
    modelName: string,
    inputTokens: number,
    outputTokens: number,
    pricing: AIModelPricing[]
  ): number {
    const model = pricing.find(p => p.provider === provider && p.model_name === modelName)
    if (!model) return 0

    const inputCost = (inputTokens / 1000) * model.input_price_per_1k
    const outputCost = (outputTokens / 1000) * model.output_price_per_1k
    
    return inputCost + outputCost
  }

  // Get current month usage
  async getCurrentMonthUsage(workspaceId: string): Promise<{
    [metricType: string]: {
      usage: number
      cost: number
      limit?: number
    }
  }> {
    try {
      const currentDate = new Date()
      const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
        .toISOString().split('T')[0]
      const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
        .toISOString().split('T')[0]

      const [summary, limits] = await Promise.all([
        this.getUsageSummary(workspaceId, monthStart, monthEnd),
        this.getUsageLimits(workspaceId)
      ])

      const result: any = {}

      summary.forEach(item => {
        const key = `${item.metric_type}_${item.provider}`.replace(/[^a-zA-Z0-9_]/g, '_')
        result[key] = {
          usage: item.total_units,
          cost: item.total_cost
        }
      })

      limits.forEach(limit => {
        if (result[limit.metric_type]) {
          result[limit.metric_type].limit = limit.monthly_limit
        } else {
          result[limit.metric_type] = {
            usage: limit.current_monthly_usage,
            cost: 0,
            limit: limit.monthly_limit
          }
        }
      })

      return result
    } catch (error) {
      console.error('Error fetching current month usage:', error)
      return {}
    }
  }

  // Get feature usage analytics
  async getFeatureUsage(
    workspaceId: string,
    days: number = 30
  ): Promise<FeatureUsage[]> {
    try {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      const { data, error } = await this.supabase
        .from('feature_usage')
        .select('feature_name, feature_category, created_at')
        .eq('workspace_id', workspaceId)
        .gte('date_used', startDate.toISOString().split('T')[0])
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching feature usage:', error)
        return []
      }

      // Aggregate the data
      const aggregated: { [key: string]: FeatureUsage } = {}
      
      data?.forEach(item => {
        const key = item.feature_name
        if (aggregated[key]) {
          aggregated[key].usage_count++
          if (item.created_at > aggregated[key].last_used) {
            aggregated[key].last_used = item.created_at
          }
        } else {
          aggregated[key] = {
            feature_name: item.feature_name,
            feature_category: item.feature_category || 'unknown',
            usage_count: 1,
            last_used: item.created_at
          }
        }
      })

      return Object.values(aggregated).sort((a, b) => b.usage_count - a.usage_count)
    } catch (error) {
      console.error('Error fetching feature usage:', error)
      return []
    }
  }

  // Get usage trends (daily usage over time)
  async getUsageTrends(
    workspaceId: string,
    metricType: string,
    days: number = 30
  ): Promise<{ date: string; usage: number; cost: number }[]> {
    try {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      const { data, error } = await this.supabase
        .from('usage_metrics')
        .select('billing_period, total_tokens, units_used, total_cost')
        .eq('workspace_id', workspaceId)
        .eq('metric_type', metricType)
        .gte('billing_period', startDate.toISOString().split('T')[0])
        .order('billing_period', { ascending: true })

      if (error) {
        console.error('Error fetching usage trends:', error)
        return []
      }

      // Aggregate by date
      const aggregated: { [date: string]: { usage: number; cost: number } } = {}
      
      data?.forEach(item => {
        const date = item.billing_period
        const usage = item.total_tokens || item.units_used || 0
        const cost = item.total_cost || 0

        if (aggregated[date]) {
          aggregated[date].usage += usage
          aggregated[date].cost += cost
        } else {
          aggregated[date] = { usage, cost }
        }
      })

      return Object.entries(aggregated).map(([date, data]) => ({
        date,
        usage: data.usage,
        cost: data.cost
      }))
    } catch (error) {
      console.error('Error fetching usage trends:', error)
      return []
    }
  }
}

// Export singleton instance
export const usageTracker = new UsageTracker()