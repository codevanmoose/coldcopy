'use client'

import { createClient } from '@supabase/supabase-js'
import { stripeBilling } from './stripe-billing'

export interface SubscriptionItemMapping {
  id: string
  workspace_id: string
  stripe_subscription_id: string
  stripe_subscription_item_id: string
  stripe_price_id: string
  metric_type: string
  description?: string
}

export class StripeSyncService {
  private supabase: any

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  // Sync subscription items when subscription is created/updated
  async syncSubscriptionItems(params: {
    workspaceId: string
    stripeSubscriptionId: string
    subscriptionItems: Array<{
      id: string
      price: {
        id: string
        nickname?: string
      }
    }>
  }): Promise<{ success: boolean; error?: string }> {
    try {
      // First, remove existing mappings for this subscription
      await this.supabase
        .from('stripe_subscription_items')
        .delete()
        .eq('workspace_id', params.workspaceId)
        .eq('stripe_subscription_id', params.stripeSubscriptionId)

      // Map price nicknames to metric types
      const metricTypeMapping: { [key: string]: string } = {
        'ai-tokens': 'ai_tokens',
        'ai_tokens': 'ai_tokens',
        'emails': 'emails_sent',
        'email': 'emails_sent',
        'emails_sent': 'emails_sent',
        'leads': 'leads_enriched',
        'lead': 'leads_enriched',
        'leads_enriched': 'leads_enriched',
        'enrichment': 'leads_enriched',
        'api': 'api_calls',
        'api_calls': 'api_calls'
      }

      // Create new mappings
      const mappings = params.subscriptionItems.map(item => {
        const nickname = item.price.nickname?.toLowerCase() || ''
        let metricType = 'unknown'

        // Try to match nickname to metric type
        for (const [key, value] of Object.entries(metricTypeMapping)) {
          if (nickname.includes(key)) {
            metricType = value
            break
          }
        }

        return {
          workspace_id: params.workspaceId,
          stripe_subscription_id: params.stripeSubscriptionId,
          stripe_subscription_item_id: item.id,
          stripe_price_id: item.price.id,
          metric_type: metricType,
          description: item.price.nickname || 'Unknown pricing item'
        }
      })

      if (mappings.length > 0) {
        const { error } = await this.supabase
          .from('stripe_subscription_items')
          .insert(mappings)

        if (error) {
          throw error
        }
      }

      return { success: true }
    } catch (error: any) {
      console.error('Error syncing subscription items:', error)
      return { success: false, error: error.message }
    }
  }

  // Get subscription item mappings for workspace
  async getSubscriptionItemMappings(workspaceId: string): Promise<SubscriptionItemMapping[]> {
    try {
      const { data, error } = await this.supabase
        .from('stripe_subscription_items')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error fetching subscription item mappings:', error)
      return []
    }
  }

  // Batch sync usage data to Stripe
  async batchSyncUsageToStripe(params: {
    workspaceId: string
    billingPeriodStart: Date
    billingPeriodEnd: Date
  }): Promise<{
    success: boolean
    syncedRecords: number
    failedRecords: number
    errors: string[]
  }> {
    try {
      // Get subscription item mappings
      const mappings = await this.getSubscriptionItemMappings(params.workspaceId)
      
      if (mappings.length === 0) {
        return {
          success: true,
          syncedRecords: 0,
          failedRecords: 0,
          errors: ['No subscription item mappings found']
        }
      }

      // Get usage data for the period
      const { data: usageData, error: usageError } = await this.supabase
        .from('usage_metrics')
        .select('metric_type, total_tokens, units_used')
        .eq('workspace_id', params.workspaceId)
        .gte('billing_period', params.billingPeriodStart.toISOString().split('T')[0])
        .lte('billing_period', params.billingPeriodEnd.toISOString().split('T')[0])

      if (usageError) {
        throw usageError
      }

      if (!usageData || usageData.length === 0) {
        return {
          success: true,
          syncedRecords: 0,
          failedRecords: 0,
          errors: ['No usage data found for period']
        }
      }

      // Aggregate usage by metric type
      const aggregatedUsage = new Map<string, number>()
      
      for (const record of usageData) {
        const usage = record.total_tokens || record.units_used || 0
        const current = aggregatedUsage.get(record.metric_type) || 0
        aggregatedUsage.set(record.metric_type, current + usage)
      }

      // Create usage records for Stripe
      const usageRecords = []
      const errors: string[] = []
      
      for (const mapping of mappings) {
        const totalUsage = aggregatedUsage.get(mapping.metric_type) || 0
        
        if (totalUsage > 0) {
          usageRecords.push({
            subscriptionItemId: mapping.stripe_subscription_item_id,
            quantity: Math.round(totalUsage),
            timestamp: Math.floor(params.billingPeriodEnd.getTime() / 1000),
            action: 'set' as const
          })
        }
      }

      // Sync to Stripe
      if (usageRecords.length > 0) {
        const batchResult = await stripeBilling.batchRecordUsage(usageRecords)
        
        return {
          success: batchResult.failed === 0,
          syncedRecords: batchResult.successful,
          failedRecords: batchResult.failed,
          errors: batchResult.errors.map(e => e.error)
        }
      } else {
        return {
          success: true,
          syncedRecords: 0,
          failedRecords: 0,
          errors: ['No usage to sync']
        }
      }
    } catch (error: any) {
      console.error('Error batch syncing usage to Stripe:', error)
      return {
        success: false,
        syncedRecords: 0,
        failedRecords: 0,
        errors: [error.message]
      }
    }
  }

  // Auto-sync usage for all active subscriptions
  async autoSyncAllWorkspaces(): Promise<{
    totalWorkspaces: number
    successfulSyncs: number
    failedSyncs: number
    errors: Array<{ workspaceId: string; error: string }>
  }> {
    try {
      // Get all workspaces with active Stripe subscriptions
      const { data: workspaces, error } = await this.supabase
        .from('workspaces')
        .select('id, stripe_customer_id, stripe_subscription_id')
        .not('stripe_customer_id', 'is', null)
        .not('stripe_subscription_id', 'is', null)
        .eq('subscription_status', 'active')

      if (error) {
        throw error
      }

      if (!workspaces || workspaces.length === 0) {
        return {
          totalWorkspaces: 0,
          successfulSyncs: 0,
          failedSyncs: 0,
          errors: []
        }
      }

      // Set up billing period (current month)
      const now = new Date()
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)

      let successfulSyncs = 0
      let failedSyncs = 0
      const errors: Array<{ workspaceId: string; error: string }> = []

      // Process each workspace
      for (const workspace of workspaces) {
        try {
          const result = await this.batchSyncUsageToStripe({
            workspaceId: workspace.id,
            billingPeriodStart: periodStart,
            billingPeriodEnd: periodEnd
          })

          if (result.success) {
            successfulSyncs++
          } else {
            failedSyncs++
            errors.push({
              workspaceId: workspace.id,
              error: result.errors.join(', ')
            })
          }
        } catch (error: any) {
          failedSyncs++
          errors.push({
            workspaceId: workspace.id,
            error: error.message
          })
        }
      }

      return {
        totalWorkspaces: workspaces.length,
        successfulSyncs,
        failedSyncs,
        errors
      }
    } catch (error: any) {
      console.error('Error auto-syncing all workspaces:', error)
      return {
        totalWorkspaces: 0,
        successfulSyncs: 0,
        failedSyncs: 0,
        errors: [{ workspaceId: 'unknown', error: error.message }]
      }
    }
  }

  // Create default subscription item mappings for common pricing models
  async createDefaultMappings(params: {
    workspaceId: string
    stripeSubscriptionId: string
    plan: 'starter' | 'professional' | 'enterprise'
  }): Promise<{ success: boolean; error?: string }> {
    try {
      // Get usage-based prices from Stripe for the plan
      const usageBasedPrices = await stripeBilling.getUsageBasedPrices()
      
      // Filter prices by plan (assuming nickname contains plan name)
      const planPrices = usageBasedPrices.filter(price => 
        price.nickname?.toLowerCase().includes(params.plan.toLowerCase())
      )

      if (planPrices.length === 0) {
        return { success: false, error: 'No usage-based prices found for plan' }
      }

      // Create subscription in Stripe if needed and get items
      const subscription = await stripeBilling.createUsageBasedSubscription({
        customerId: '', // This would come from workspace
        priceIds: planPrices.map(p => p.id),
        metadata: {
          workspace_id: params.workspaceId,
          plan: params.plan
        }
      })

      // Sync the subscription items
      return this.syncSubscriptionItems({
        workspaceId: params.workspaceId,
        stripeSubscriptionId: subscription.id,
        subscriptionItems: subscription.items.data.map(item => ({
          id: item.id,
          price: {
            id: item.price.id,
            nickname: item.price.nickname
          }
        }))
      })
    } catch (error: any) {
      console.error('Error creating default mappings:', error)
      return { success: false, error: error.message }
    }
  }

  // Validate subscription item mappings
  async validateMappings(workspaceId: string): Promise<{
    valid: boolean
    issues: string[]
    recommendations: string[]
  }> {
    try {
      const mappings = await this.getSubscriptionItemMappings(workspaceId)
      const issues: string[] = []
      const recommendations: string[] = []

      if (mappings.length === 0) {
        issues.push('No subscription item mappings found')
        recommendations.push('Set up subscription item mappings for billing')
        return { valid: false, issues, recommendations }
      }

      // Check for unknown metric types
      const unknownMappings = mappings.filter(m => m.metric_type === 'unknown')
      if (unknownMappings.length > 0) {
        issues.push(`${unknownMappings.length} subscription items have unknown metric types`)
        recommendations.push('Update price nicknames to include metric type (ai-tokens, emails, leads)')
      }

      // Check for duplicate metric types
      const metricTypeCounts = new Map<string, number>()
      mappings.forEach(m => {
        const count = metricTypeCounts.get(m.metric_type) || 0
        metricTypeCounts.set(m.metric_type, count + 1)
      })

      const duplicates = Array.from(metricTypeCounts.entries()).filter(([_, count]) => count > 1)
      if (duplicates.length > 0) {
        issues.push(`Duplicate metric types found: ${duplicates.map(([type]) => type).join(', ')}`)
        recommendations.push('Ensure each metric type maps to only one subscription item')
      }

      // Check for essential metric types
      const essentialTypes = ['ai_tokens', 'emails_sent', 'leads_enriched']
      const mappedTypes = new Set(mappings.map(m => m.metric_type))
      const missingTypes = essentialTypes.filter(type => !mappedTypes.has(type))
      
      if (missingTypes.length > 0) {
        recommendations.push(`Consider adding mappings for: ${missingTypes.join(', ')}`)
      }

      return {
        valid: issues.length === 0,
        issues,
        recommendations
      }
    } catch (error: any) {
      console.error('Error validating mappings:', error)
      return {
        valid: false,
        issues: ['Error validating mappings'],
        recommendations: ['Contact support to resolve mapping validation issues']
      }
    }
  }
}

// Export singleton instance
export const stripeSyncService = new StripeSyncService()