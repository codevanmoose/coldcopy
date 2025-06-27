import { supabase } from '@/lib/supabase/client'

export enum ConversionEvent {
  // Trial events
  TRIAL_STARTED = 'trial_started',
  TRIAL_ONBOARDING_COMPLETED = 'trial_onboarding_completed',
  TRIAL_PAYMENT_METHOD_ADDED = 'trial_payment_method_added',
  TRIAL_ENDED = 'trial_ended',
  TRIAL_CONVERTED = 'trial_converted',
  
  // Feature usage events
  FIRST_EMAIL_SENT = 'first_email_sent',
  FIRST_LEAD_ENRICHED = 'first_lead_enriched',
  FIRST_AI_EMAIL_GENERATED = 'first_ai_email_generated',
  FIRST_CAMPAIGN_CREATED = 'first_campaign_created',
  FIRST_TEAM_MEMBER_INVITED = 'first_team_member_invited',
  
  // Engagement events
  FEATURE_LIMIT_REACHED = 'feature_limit_reached',
  UPGRADE_CLICKED = 'upgrade_clicked',
  PRICING_VIEWED = 'pricing_viewed',
  BILLING_VIEWED = 'billing_viewed',
  
  // Conversion events
  SUBSCRIPTION_CREATED = 'subscription_created',
  SUBSCRIPTION_UPGRADED = 'subscription_upgraded',
  SUBSCRIPTION_DOWNGRADED = 'subscription_downgraded',
  SUBSCRIPTION_CANCELLED = 'subscription_cancelled',
  
  // Revenue events
  PAYMENT_SUCCEEDED = 'payment_succeeded',
  PAYMENT_FAILED = 'payment_failed',
  REVENUE_RECOGNIZED = 'revenue_recognized',
}

export interface ConversionEventData {
  event: ConversionEvent
  workspaceId: string
  userId?: string
  properties?: Record<string, any>
  revenue?: number
  timestamp?: Date
}

export interface ConversionMetrics {
  trialStartedCount: number
  trialConversionRate: number
  averageTrialDuration: number
  featureAdoptionRate: Record<string, number>
  revenueMetrics: {
    mrr: number
    arr: number
    ltv: number
    churnRate: number
  }
  topConversionTriggers: Array<{
    event: string
    conversionRate: number
    count: number
  }>
}

export class ConversionTracker {
  private static instance: ConversionTracker
  private eventQueue: ConversionEventData[] = []
  private flushInterval: NodeJS.Timeout | null = null
  private isAnalyticsEnabled: boolean = true

  private constructor() {
    // Start flush interval
    this.startFlushInterval()
    
    // Check if analytics is enabled
    if (typeof window !== 'undefined') {
      this.isAnalyticsEnabled = !window.localStorage.getItem('disable-analytics')
    }
  }

  static getInstance(): ConversionTracker {
    if (!ConversionTracker.instance) {
      ConversionTracker.instance = new ConversionTracker()
    }
    return ConversionTracker.instance
  }

  /**
   * Track a conversion event
   */
  async track(eventData: ConversionEventData): Promise<void> {
    if (!this.isAnalyticsEnabled) return

    try {
      // Add timestamp if not provided
      if (!eventData.timestamp) {
        eventData.timestamp = new Date()
      }

      // Add to queue for batch processing
      this.eventQueue.push(eventData)

      // Flush immediately for critical events
      const criticalEvents = [
        ConversionEvent.TRIAL_CONVERTED,
        ConversionEvent.SUBSCRIPTION_CREATED,
        ConversionEvent.PAYMENT_SUCCEEDED,
      ]

      if (criticalEvents.includes(eventData.event)) {
        await this.flush()
      }
    } catch (error) {
      console.error('Error tracking conversion event:', error)
    }
  }

  /**
   * Track trial start
   */
  async trackTrialStart(workspaceId: string, userId: string, planId: string): Promise<void> {
    await this.track({
      event: ConversionEvent.TRIAL_STARTED,
      workspaceId,
      userId,
      properties: {
        planId,
        source: this.getTrafficSource(),
        device: this.getDeviceInfo(),
      },
    })
  }

  /**
   * Track feature usage
   */
  async trackFeatureUsage(
    workspaceId: string, 
    feature: 'email' | 'enrichment' | 'ai' | 'campaign' | 'team',
    properties?: Record<string, any>
  ): Promise<void> {
    const eventMap = {
      email: ConversionEvent.FIRST_EMAIL_SENT,
      enrichment: ConversionEvent.FIRST_LEAD_ENRICHED,
      ai: ConversionEvent.FIRST_AI_EMAIL_GENERATED,
      campaign: ConversionEvent.FIRST_CAMPAIGN_CREATED,
      team: ConversionEvent.FIRST_TEAM_MEMBER_INVITED,
    }

    // Check if this is the first usage
    const isFirstUsage = await this.isFirstFeatureUsage(workspaceId, feature)
    
    if (isFirstUsage) {
      await this.track({
        event: eventMap[feature],
        workspaceId,
        properties: {
          ...properties,
          daysFromTrialStart: await this.getDaysFromTrialStart(workspaceId),
        },
      })
    }
  }

  /**
   * Track upgrade events
   */
  async trackUpgrade(
    workspaceId: string,
    fromPlan: string,
    toPlan: string,
    revenue: number,
    trigger?: string
  ): Promise<void> {
    const isTrialConversion = fromPlan === 'trial' || fromPlan === 'free'
    
    await this.track({
      event: isTrialConversion ? ConversionEvent.TRIAL_CONVERTED : ConversionEvent.SUBSCRIPTION_UPGRADED,
      workspaceId,
      revenue,
      properties: {
        fromPlan,
        toPlan,
        trigger,
        daysFromTrialStart: await this.getDaysFromTrialStart(workspaceId),
        featuresUsed: await this.getFeaturesUsed(workspaceId),
      },
    })
  }

  /**
   * Get conversion metrics
   */
  async getConversionMetrics(dateRange?: { start: Date; end: Date }): Promise<ConversionMetrics> {
    try {
      const { data: events, error } = await supabase
        .from('conversion_events')
        .select('*')
        .gte('created_at', dateRange?.start.toISOString() || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .lte('created_at', dateRange?.end.toISOString() || new Date().toISOString())

      if (error) throw error

      // Calculate metrics
      const trialStarts = events.filter(e => e.event === ConversionEvent.TRIAL_STARTED)
      const trialConversions = events.filter(e => e.event === ConversionEvent.TRIAL_CONVERTED)
      
      const metrics: ConversionMetrics = {
        trialStartedCount: trialStarts.length,
        trialConversionRate: trialStarts.length > 0 ? (trialConversions.length / trialStarts.length) * 100 : 0,
        averageTrialDuration: await this.calculateAverageTrialDuration(),
        featureAdoptionRate: await this.calculateFeatureAdoptionRate(events),
        revenueMetrics: await this.calculateRevenueMetrics(events),
        topConversionTriggers: await this.calculateTopConversionTriggers(events),
      }

      return metrics
    } catch (error) {
      console.error('Error getting conversion metrics:', error)
      return {
        trialStartedCount: 0,
        trialConversionRate: 0,
        averageTrialDuration: 0,
        featureAdoptionRate: {},
        revenueMetrics: { mrr: 0, arr: 0, ltv: 0, churnRate: 0 },
        topConversionTriggers: [],
      }
    }
  }

  /**
   * Identify conversion triggers
   */
  async identifyConversionTriggers(workspaceId: string): Promise<string[]> {
    try {
      // Get all events for the workspace
      const { data: events, error } = await supabase
        .from('conversion_events')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: true })

      if (error) throw error

      // Find events that occurred before conversion
      const conversionEvent = events.find(e => 
        e.event === ConversionEvent.TRIAL_CONVERTED || 
        e.event === ConversionEvent.SUBSCRIPTION_CREATED
      )

      if (!conversionEvent) return []

      const preConversionEvents = events.filter(e => 
        new Date(e.created_at) < new Date(conversionEvent.created_at)
      )

      // Identify key triggers
      const triggers: string[] = []
      
      if (preConversionEvents.some(e => e.event === ConversionEvent.FIRST_EMAIL_SENT)) {
        triggers.push('sent_first_email')
      }
      if (preConversionEvents.some(e => e.event === ConversionEvent.FIRST_LEAD_ENRICHED)) {
        triggers.push('enriched_leads')
      }
      if (preConversionEvents.some(e => e.event === ConversionEvent.FIRST_AI_EMAIL_GENERATED)) {
        triggers.push('used_ai_generation')
      }
      if (preConversionEvents.some(e => e.event === ConversionEvent.FEATURE_LIMIT_REACHED)) {
        triggers.push('hit_usage_limit')
      }
      if (preConversionEvents.some(e => e.event === ConversionEvent.TRIAL_PAYMENT_METHOD_ADDED)) {
        triggers.push('added_payment_method_early')
      }

      return triggers
    } catch (error) {
      console.error('Error identifying conversion triggers:', error)
      return []
    }
  }

  /**
   * Private helper methods
   */
  private startFlushInterval(): void {
    this.flushInterval = setInterval(() => {
      this.flush()
    }, 30000) // Flush every 30 seconds
  }

  private async flush(): Promise<void> {
    if (this.eventQueue.length === 0) return

    const events = [...this.eventQueue]
    this.eventQueue = []

    try {
      const { error } = await supabase
        .from('conversion_events')
        .insert(
          events.map(event => ({
            event: event.event,
            workspace_id: event.workspaceId,
            user_id: event.userId,
            properties: event.properties || {},
            revenue: event.revenue,
            created_at: event.timestamp,
          }))
        )

      if (error) throw error

      // Send to external analytics if configured
      if (typeof window !== 'undefined' && (window as any).analytics) {
        events.forEach(event => {
          (window as any).analytics.track(event.event, {
            ...event.properties,
            workspace_id: event.workspaceId,
            revenue: event.revenue,
          })
        })
      }
    } catch (error) {
      console.error('Error flushing conversion events:', error)
      // Re-add events to queue for retry
      this.eventQueue.unshift(...events)
    }
  }

  private getTrafficSource(): Record<string, string> {
    if (typeof window === 'undefined') return {}

    const urlParams = new URLSearchParams(window.location.search)
    return {
      utm_source: urlParams.get('utm_source') || 'direct',
      utm_medium: urlParams.get('utm_medium') || 'none',
      utm_campaign: urlParams.get('utm_campaign') || '',
      referrer: document.referrer || 'direct',
    }
  }

  private getDeviceInfo(): Record<string, string> {
    if (typeof window === 'undefined') return {}

    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
    }
  }

  private async isFirstFeatureUsage(workspaceId: string, feature: string): Promise<boolean> {
    const eventMap = {
      email: ConversionEvent.FIRST_EMAIL_SENT,
      enrichment: ConversionEvent.FIRST_LEAD_ENRICHED,
      ai: ConversionEvent.FIRST_AI_EMAIL_GENERATED,
      campaign: ConversionEvent.FIRST_CAMPAIGN_CREATED,
      team: ConversionEvent.FIRST_TEAM_MEMBER_INVITED,
    }

    try {
      const { data, error } = await supabase
        .from('conversion_events')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('event', eventMap[feature as keyof typeof eventMap])
        .single()

      return !data
    } catch {
      return true // Assume first usage if error
    }
  }

  private async getDaysFromTrialStart(workspaceId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('trial_start')
        .eq('workspace_id', workspaceId)
        .single()

      if (error || !data?.trial_start) return 0

      const trialStart = new Date(data.trial_start)
      const now = new Date()
      return Math.floor((now.getTime() - trialStart.getTime()) / (1000 * 60 * 60 * 24))
    } catch {
      return 0
    }
  }

  private async getFeaturesUsed(workspaceId: string): Promise<string[]> {
    const features = []
    
    // Check which features have been used
    const featureEvents = [
      { event: ConversionEvent.FIRST_EMAIL_SENT, feature: 'email' },
      { event: ConversionEvent.FIRST_LEAD_ENRICHED, feature: 'enrichment' },
      { event: ConversionEvent.FIRST_AI_EMAIL_GENERATED, feature: 'ai' },
      { event: ConversionEvent.FIRST_CAMPAIGN_CREATED, feature: 'campaign' },
      { event: ConversionEvent.FIRST_TEAM_MEMBER_INVITED, feature: 'team' },
    ]

    for (const { event, feature } of featureEvents) {
      try {
        const { data } = await supabase
          .from('conversion_events')
          .select('id')
          .eq('workspace_id', workspaceId)
          .eq('event', event)
          .single()

        if (data) features.push(feature)
      } catch {
        // Feature not used
      }
    }

    return features
  }

  private async calculateAverageTrialDuration(): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('trial_start, trial_end, status')
        .in('status', ['active', 'past_due', 'canceled'])
        .not('trial_start', 'is', null)

      if (error || !data) return 14 // Default trial duration

      const durations = data
        .map(sub => {
          const start = new Date(sub.trial_start)
          const end = sub.trial_end ? new Date(sub.trial_end) : new Date()
          return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
        })
        .filter(d => d > 0 && d <= 30) // Filter out invalid durations

      return durations.length > 0 
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 14
    } catch {
      return 14
    }
  }

  private async calculateFeatureAdoptionRate(events: any[]): Promise<Record<string, number>> {
    const featureEvents = [
      ConversionEvent.FIRST_EMAIL_SENT,
      ConversionEvent.FIRST_LEAD_ENRICHED,
      ConversionEvent.FIRST_AI_EMAIL_GENERATED,
      ConversionEvent.FIRST_CAMPAIGN_CREATED,
      ConversionEvent.FIRST_TEAM_MEMBER_INVITED,
    ]

    const totalWorkspaces = new Set(events.map(e => e.workspace_id)).size
    const adoptionRate: Record<string, number> = {}

    for (const featureEvent of featureEvents) {
      const workspacesUsingFeature = new Set(
        events.filter(e => e.event === featureEvent).map(e => e.workspace_id)
      ).size

      const rate = totalWorkspaces > 0 ? (workspacesUsingFeature / totalWorkspaces) * 100 : 0
      adoptionRate[featureEvent] = Math.round(rate)
    }

    return adoptionRate
  }

  private async calculateRevenueMetrics(events: any[]): Promise<any> {
    // This would typically integrate with your billing system
    // For now, return placeholder metrics
    return {
      mrr: 0,
      arr: 0,
      ltv: 0,
      churnRate: 0,
    }
  }

  private async calculateTopConversionTriggers(events: any[]): Promise<any[]> {
    // Analyze which events most frequently precede conversions
    const conversionEvents = events.filter(e => 
      e.event === ConversionEvent.TRIAL_CONVERTED || 
      e.event === ConversionEvent.SUBSCRIPTION_CREATED
    )

    const triggerCounts: Record<string, { count: number; conversions: number }> = {}

    for (const conversion of conversionEvents) {
      const workspaceEvents = events.filter(e => 
        e.workspace_id === conversion.workspace_id &&
        new Date(e.created_at) < new Date(conversion.created_at)
      )

      for (const event of workspaceEvents) {
        if (!triggerCounts[event.event]) {
          triggerCounts[event.event] = { count: 0, conversions: 0 }
        }
        triggerCounts[event.event].count++
        triggerCounts[event.event].conversions++
      }
    }

    return Object.entries(triggerCounts)
      .map(([event, data]) => ({
        event,
        conversionRate: (data.conversions / data.count) * 100,
        count: data.count,
      }))
      .sort((a, b) => b.conversionRate - a.conversionRate)
      .slice(0, 5)
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
      this.flushInterval = null
    }
    this.flush() // Final flush
  }
}

// Export singleton instance
export const conversionTracker = ConversionTracker.getInstance()

// Convenience functions
export const trackTrialStart = (workspaceId: string, userId: string, planId: string) =>
  conversionTracker.trackTrialStart(workspaceId, userId, planId)

export const trackFeatureUsage = (
  workspaceId: string,
  feature: 'email' | 'enrichment' | 'ai' | 'campaign' | 'team',
  properties?: Record<string, any>
) => conversionTracker.trackFeatureUsage(workspaceId, feature, properties)

export const trackUpgrade = (
  workspaceId: string,
  fromPlan: string,
  toPlan: string,
  revenue: number,
  trigger?: string
) => conversionTracker.trackUpgrade(workspaceId, fromPlan, toPlan, revenue, trigger)

export const getConversionMetrics = (dateRange?: { start: Date; end: Date }) =>
  conversionTracker.getConversionMetrics(dateRange)

export const identifyConversionTriggers = (workspaceId: string) =>
  conversionTracker.identifyConversionTriggers(workspaceId)