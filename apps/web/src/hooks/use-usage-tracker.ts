'use client'

import { useCallback } from 'react'
import { usageTracker, UsageLimit, UsageSummary, FeatureUsage } from '@/lib/billing/usage-tracker'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'

export function useUsageTracker() {
  const { user, workspace } = useAuth()

  // Track AI usage with automatic limit checking
  const trackAI = useCallback(async (params: {
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
  }) => {
    if (!user || !workspace) {
      throw new Error('User or workspace not available')
    }

    // Check limits before tracking
    const limitCheck = await usageTracker.checkUsageLimits(
      workspace.id,
      'ai_tokens',
      params.inputTokens + params.outputTokens
    )

    if (!limitCheck.allowed) {
      toast.error(limitCheck.message || 'Usage limit exceeded')
      throw new Error(limitCheck.message || 'Usage limit exceeded')
    }

    return usageTracker.trackAIUsage({
      workspaceId: workspace.id,
      userId: user.id,
      ...params
    })
  }, [user, workspace])

  // Track feature usage
  const trackFeature = useCallback(async (params: {
    featureName: string
    featureCategory?: string
    metadata?: any
    sessionId?: string
  }) => {
    if (!user || !workspace) {
      throw new Error('User or workspace not available')
    }

    return usageTracker.trackFeatureUsage({
      workspaceId: workspace.id,
      userId: user.id,
      ...params
    })
  }, [user, workspace])

  // Track general usage (emails, enrichments, etc.)
  const trackUsage = useCallback(async (params: {
    metricType: 'emails_sent' | 'leads_enriched' | 'api_calls'
    unitsUsed: number
    featureName: string
    resourceType?: string
    resourceId?: string
    metadata?: any
  }) => {
    if (!user || !workspace) {
      throw new Error('User or workspace not available')
    }

    // Check limits before tracking
    const limitCheck = await usageTracker.checkUsageLimits(
      workspace.id,
      params.metricType,
      params.unitsUsed
    )

    if (!limitCheck.allowed) {
      toast.error(limitCheck.message || 'Usage limit exceeded')
      throw new Error(limitCheck.message || 'Usage limit exceeded')
    }

    return usageTracker.trackUsage({
      workspaceId: workspace.id,
      userId: user.id,
      ...params
    })
  }, [user, workspace])

  // Check usage limits without tracking
  const checkLimits = useCallback(async (
    metricType: string,
    unitsToUse: number = 1
  ) => {
    if (!workspace) {
      throw new Error('Workspace not available')
    }

    return usageTracker.checkUsageLimits(workspace.id, metricType, unitsToUse)
  }, [workspace])

  // Get usage limits
  const getUsageLimits = useCallback(async (): Promise<UsageLimit[]> => {
    if (!workspace) return []
    return usageTracker.getUsageLimits(workspace.id)
  }, [workspace])

  // Get usage summary
  const getUsageSummary = useCallback(async (
    periodStart?: string,
    periodEnd?: string
  ): Promise<UsageSummary[]> => {
    if (!workspace) return []
    return usageTracker.getUsageSummary(workspace.id, periodStart, periodEnd)
  }, [workspace])

  // Get current month usage
  const getCurrentMonthUsage = useCallback(async () => {
    if (!workspace) return {}
    return usageTracker.getCurrentMonthUsage(workspace.id)
  }, [workspace])

  // Get feature usage analytics
  const getFeatureUsage = useCallback(async (days: number = 30): Promise<FeatureUsage[]> => {
    if (!workspace) return []
    return usageTracker.getFeatureUsage(workspace.id, days)
  }, [workspace])

  // Get usage trends
  const getUsageTrends = useCallback(async (
    metricType: string,
    days: number = 30
  ) => {
    if (!workspace) return []
    return usageTracker.getUsageTrends(workspace.id, metricType, days)
  }, [workspace])

  return {
    // Tracking functions
    trackAI,
    trackFeature,
    trackUsage,
    
    // Limit checking
    checkLimits,
    getUsageLimits,
    
    // Analytics
    getUsageSummary,
    getCurrentMonthUsage,
    getFeatureUsage,
    getUsageTrends,
    
    // Direct access to tracker
    usageTracker
  }
}

// Hook for AI providers to track usage automatically
export function useAIUsageTracker(provider: string, modelName: string) {
  const { trackAI, checkLimits } = useUsageTracker()

  const trackAndCheckAI = useCallback(async (params: {
    inputTokens: number
    outputTokens: number
    featureName: string
    resourceType?: string
    resourceId?: string
    requestData?: any
    responseData?: any
    durationMs?: number
  }) => {
    // Pre-check limits
    const totalTokens = params.inputTokens + params.outputTokens
    const limitCheck = await checkLimits('ai_tokens', totalTokens)
    
    if (!limitCheck.allowed) {
      throw new Error(limitCheck.message || 'AI usage limit exceeded')
    }

    // Track usage
    return trackAI({
      provider,
      modelName,
      ...params
    })
  }, [trackAI, checkLimits, provider, modelName])

  return {
    trackAI: trackAndCheckAI,
    checkLimits: (tokens: number) => checkLimits('ai_tokens', tokens)
  }
}