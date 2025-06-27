import { supabase } from '@/lib/supabase/client'
import { BillingErrorCode, UsageMetric, type PlanLimits } from './types'

export interface UsageCheckResult {
  allowed: boolean
  currentUsage: number
  limit: number | null
  remainingUsage: number | null
  percentageUsed: number
  message?: string
  upgradeRequired?: boolean
}

export interface UsageReport {
  metric: UsageMetric
  quantity: number
  metadata?: Record<string, any>
}

export class UsageLimiter {
  private workspaceId: string
  private cache: Map<string, { data: any; timestamp: number }> = new Map()
  private cacheTimeout = 5 * 60 * 1000 // 5 minutes

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId
  }

  /**
   * Check if a specific action is allowed based on usage limits
   */
  async checkUsage(metric: UsageMetric, quantity: number = 1): Promise<UsageCheckResult> {
    try {
      // Get current subscription and limits
      const limits = await this.getSubscriptionLimits()
      const currentUsage = await this.getCurrentUsage(metric)
      
      const limit = limits?.[metric] ?? null
      const totalUsageAfterAction = currentUsage + quantity

      // If no limit is set (null), the action is allowed
      if (limit === null) {
        return {
          allowed: true,
          currentUsage,
          limit: null,
          remainingUsage: null,
          percentageUsed: 0,
        }
      }

      // Check if the action would exceed the limit
      const allowed = totalUsageAfterAction <= limit
      const remainingUsage = Math.max(0, limit - currentUsage)
      const percentageUsed = limit > 0 ? (currentUsage / limit) * 100 : 100

      let message: string | undefined
      let upgradeRequired = false

      if (!allowed) {
        upgradeRequired = true
        switch (metric) {
          case UsageMetric.EMAILS_SENT:
            message = `You've reached your monthly email limit of ${limit}. Upgrade to send more emails.`
            break
          case UsageMetric.LEADS_ENRICHED:
            message = `You've reached your lead enrichment limit of ${limit}. Upgrade to enrich more leads.`
            break
          case UsageMetric.AI_TOKENS:
            message = `You've reached your AI usage limit. Upgrade for more AI-powered features.`
            break
          default:
            message = `You've reached your usage limit for this feature. Please upgrade your plan.`
        }
      } else if (percentageUsed >= 90) {
        message = `You've used ${Math.round(percentageUsed)}% of your ${this.getMetricDisplayName(metric)} limit.`
      }

      return {
        allowed,
        currentUsage,
        limit,
        remainingUsage,
        percentageUsed,
        message,
        upgradeRequired,
      }
    } catch (error) {
      console.error('Error checking usage:', error)
      // In case of error, allow the action but log it
      return {
        allowed: true,
        currentUsage: 0,
        limit: null,
        remainingUsage: null,
        percentageUsed: 0,
        message: 'Unable to verify usage limits. Please try again.',
      }
    }
  }

  /**
   * Check multiple usage metrics at once
   */
  async checkMultipleUsages(checks: Array<{ metric: UsageMetric; quantity: number }>): Promise<Record<UsageMetric, UsageCheckResult>> {
    const results: Record<UsageMetric, UsageCheckResult> = {} as any
    
    // Run checks in parallel for better performance
    await Promise.all(
      checks.map(async ({ metric, quantity }) => {
        results[metric] = await this.checkUsage(metric, quantity)
      })
    )
    
    return results
  }

  /**
   * Report usage after an action is performed
   */
  async reportUsage(reports: UsageReport[]): Promise<void> {
    try {
      // Batch insert usage records
      const usageRecords = reports.map(report => ({
        workspace_id: this.workspaceId,
        metric_name: report.metric,
        quantity: report.quantity,
        metadata: report.metadata || {},
      }))

      const { error } = await supabase
        .from('usage_records')
        .insert(usageRecords)

      if (error) throw error

      // Clear cache after reporting usage
      this.clearCache()
    } catch (error) {
      console.error('Error reporting usage:', error)
      // Don't throw - we don't want to block the user action if reporting fails
    }
  }

  /**
   * Get current usage for a specific metric
   */
  async getCurrentUsage(metric: UsageMetric): Promise<number> {
    const cacheKey = `usage-${metric}`
    const cached = this.getFromCache(cacheKey)
    
    if (cached) {
      return cached.total_quantity || 0
    }

    try {
      const { data, error } = await supabase
        .rpc('calculate_period_usage', {
          p_workspace_id: this.workspaceId,
          p_metric_name: metric,
        })
        .single()

      if (error) throw error

      this.setCache(cacheKey, data)
      return data?.total_quantity || 0
    } catch (error) {
      console.error('Error getting current usage:', error)
      return 0
    }
  }

  /**
   * Get all current usage metrics
   */
  async getAllUsage(): Promise<Record<UsageMetric, number>> {
    try {
      const { data, error } = await supabase
        .rpc('calculate_period_usage', {
          p_workspace_id: this.workspaceId,
        })

      if (error) throw error

      const usage: Record<UsageMetric, number> = {
        [UsageMetric.EMAILS_SENT]: 0,
        [UsageMetric.LEADS_ENRICHED]: 0,
        [UsageMetric.AI_TOKENS]: 0,
      }

      data?.forEach((record: any) => {
        if (record.metric_name in usage) {
          usage[record.metric_name as UsageMetric] = record.total_quantity || 0
        }
      })

      return usage
    } catch (error) {
      console.error('Error getting all usage:', error)
      return {
        [UsageMetric.EMAILS_SENT]: 0,
        [UsageMetric.LEADS_ENRICHED]: 0,
        [UsageMetric.AI_TOKENS]: 0,
      }
    }
  }

  /**
   * Get subscription limits
   */
  private async getSubscriptionLimits(): Promise<PlanLimits | null> {
    const cacheKey = 'subscription-limits'
    const cached = this.getFromCache(cacheKey)
    
    if (cached) {
      return cached
    }

    try {
      const { data, error } = await supabase
        .rpc('get_subscription_limits', {
          p_workspace_id: this.workspaceId,
        })

      if (error) throw error

      this.setCache(cacheKey, data)
      return data
    } catch (error) {
      console.error('Error getting subscription limits:', error)
      return null
    }
  }

  /**
   * Check if workspace is in trial
   */
  async isInTrial(): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('status, trial_end')
        .eq('workspace_id', this.workspaceId)
        .single()

      if (error) throw error

      return data?.status === 'trialing' && 
             data?.trial_end && 
             new Date(data.trial_end) > new Date()
    } catch (error) {
      console.error('Error checking trial status:', error)
      return false
    }
  }

  /**
   * Get days remaining in trial
   */
  async getTrialDaysRemaining(): Promise<number | null> {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('trial_end')
        .eq('workspace_id', this.workspaceId)
        .single()

      if (error) throw error

      if (!data?.trial_end) return null

      const trialEnd = new Date(data.trial_end)
      const now = new Date()
      const daysRemaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      
      return Math.max(0, daysRemaining)
    } catch (error) {
      console.error('Error getting trial days remaining:', error)
      return null
    }
  }

  /**
   * Helper to get display name for metrics
   */
  private getMetricDisplayName(metric: UsageMetric): string {
    switch (metric) {
      case UsageMetric.EMAILS_SENT:
        return 'email'
      case UsageMetric.LEADS_ENRICHED:
        return 'lead enrichment'
      case UsageMetric.AI_TOKENS:
        return 'AI usage'
      default:
        return 'usage'
    }
  }

  /**
   * Cache management
   */
  private getFromCache(key: string): any {
    const cached = this.cache.get(key)
    if (!cached) return null
    
    if (Date.now() - cached.timestamp > this.cacheTimeout) {
      this.cache.delete(key)
      return null
    }
    
    return cached.data
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() })
  }

  private clearCache(): void {
    this.cache.clear()
  }
}

/**
 * Create a usage limiter instance for a workspace
 */
export function createUsageLimiter(workspaceId: string): UsageLimiter {
  return new UsageLimiter(workspaceId)
}

/**
 * Higher-level usage checking functions
 */
export async function canSendEmail(workspaceId: string, count: number = 1): Promise<UsageCheckResult> {
  const limiter = createUsageLimiter(workspaceId)
  return limiter.checkUsage(UsageMetric.EMAILS_SENT, count)
}

export async function canEnrichLead(workspaceId: string, count: number = 1): Promise<UsageCheckResult> {
  const limiter = createUsageLimiter(workspaceId)
  return limiter.checkUsage(UsageMetric.LEADS_ENRICHED, count)
}

export async function canUseAI(workspaceId: string, estimatedTokens: number = 100): Promise<UsageCheckResult> {
  const limiter = createUsageLimiter(workspaceId)
  return limiter.checkUsage(UsageMetric.AI_TOKENS, estimatedTokens)
}

/**
 * Middleware for API routes to check usage limits
 */
export async function withUsageLimit(
  metric: UsageMetric,
  quantity: number = 1
) {
  return async (req: Request, handler: (req: Request) => Promise<Response>) => {
    // Extract workspace ID from request headers or auth context
    const workspaceId = req.headers.get('x-workspace-id')
    
    if (!workspaceId) {
      return new Response(
        JSON.stringify({ error: 'Workspace ID required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const limiter = createUsageLimiter(workspaceId)
    const usageCheck = await limiter.checkUsage(metric, quantity)

    if (!usageCheck.allowed) {
      return new Response(
        JSON.stringify({
          error: usageCheck.message,
          code: BillingErrorCode.USAGE_LIMIT_EXCEEDED,
          upgradeRequired: usageCheck.upgradeRequired,
          usage: {
            current: usageCheck.currentUsage,
            limit: usageCheck.limit,
            remaining: usageCheck.remainingUsage,
          },
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Continue with the handler
    const response = await handler(req)

    // Report usage if the request was successful
    if (response.ok) {
      await limiter.reportUsage([{ metric, quantity }])
    }

    return response
  }
}