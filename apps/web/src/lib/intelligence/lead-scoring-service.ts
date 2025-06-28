import { createClient } from '@/lib/supabase/client'

export interface LeadScore {
  id: string
  leadId: string
  workspaceId: string
  
  // Core scores
  totalScore: number
  engagementScore: number
  profileScore: number
  behaviorScore: number
  intentScore: number
  fitScore: number
  
  // Score breakdown
  scoreBreakdown: {
    demographic: number
    firmographic: number
    behavioral: number
    engagement: number
    intent: number
    social: number
    email: number
    website: number
  }
  
  // Predictive scores
  predictiveScores: {
    conversionProbability: number
    churnRisk: number
    dealSize: number
    timeToClose: number
    lifetimeValue: number
  }
  
  // Score factors
  positiveFactors: ScoreFactor[]
  negativeFactors: ScoreFactor[]
  
  // Intelligence insights
  insights: LeadInsight[]
  recommendations: string[]
  nextBestActions: NextBestAction[]
  
  // Scoring metadata
  scoringModel: string
  scoringVersion: string
  lastCalculated: Date
  scoreHistory: ScoreHistoryEntry[]
  
  // Thresholds
  isHot: boolean
  isQualified: boolean
  isEngaged: boolean
  requiresNurturing: boolean
}

export interface ScoreFactor {
  factor: string
  category: string
  impact: number // -100 to +100
  description: string
  timestamp: Date
}

export interface LeadInsight {
  id: string
  type: 'positive' | 'negative' | 'neutral' | 'warning' | 'opportunity'
  category: string
  title: string
  description: string
  importance: 'high' | 'medium' | 'low'
  actionable: boolean
  suggestedAction?: string
  timestamp: Date
}

export interface NextBestAction {
  id: string
  action: string
  channel: 'email' | 'linkedin' | 'phone' | 'sms' | 'meeting'
  priority: 'high' | 'medium' | 'low'
  timing: 'immediate' | 'today' | 'this_week' | 'next_week'
  reason: string
  expectedImpact: number
  confidence: number
}

export interface ScoreHistoryEntry {
  timestamp: Date
  score: number
  change: number
  reason: string
}

export interface ScoringRule {
  id: string
  name: string
  category: string
  condition: {
    field: string
    operator: string
    value: any
  }
  scoreImpact: number
  isActive: boolean
}

export interface LeadActivity {
  id: string
  leadId: string
  type: string
  channel: string
  timestamp: Date
  details: any
  scoreImpact?: number
}

export interface BuyingSignal {
  id: string
  leadId: string
  signalType: 'high_intent' | 'medium_intent' | 'low_intent' | 'negative'
  signalName: string
  description: string
  confidence: number
  timestamp: Date
  source: string
  metadata?: any
}

export interface CompanyIntelligence {
  companyName: string
  industry: string
  size: string
  revenue?: number
  growthRate?: number
  technologies: string[]
  recentNews: NewsItem[]
  fundingHistory: FundingRound[]
  competitivePosition: string
  marketTrends: string[]
  buyingPower: number
  decisionMakers: DecisionMaker[]
}

export interface NewsItem {
  title: string
  description: string
  url: string
  publishedAt: Date
  sentiment: 'positive' | 'negative' | 'neutral'
  relevance: number
}

export interface FundingRound {
  date: Date
  amount: number
  round: string
  investors: string[]
}

export interface DecisionMaker {
  name: string
  title: string
  department: string
  seniority: string
  linkedinUrl?: string
  email?: string
  influence: number
}

export class LeadScoringService {
  private supabase = createClient()
  private apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.coldcopy.cc'

  // Core scoring methods
  async calculateLeadScore(
    workspaceId: string,
    leadId: string,
    options?: {
      includeHistory?: boolean
      includePredictive?: boolean
      includeInsights?: boolean
    }
  ): Promise<LeadScore> {
    const response = await fetch(`${this.apiBaseUrl}/intelligence/score/${leadId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        include_history: options?.includeHistory,
        include_predictive: options?.includePredictive,
        include_insights: options?.includeInsights,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to calculate lead score')
    }

    return response.json()
  }

  async bulkScoreLeads(
    workspaceId: string,
    leadIds: string[],
    options?: {
      batchSize?: number
      includeInsights?: boolean
    }
  ): Promise<LeadScore[]> {
    const response = await fetch(`${this.apiBaseUrl}/intelligence/score/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        lead_ids: leadIds,
        batch_size: options?.batchSize || 100,
        include_insights: options?.includeInsights,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to bulk score leads')
    }

    return response.json()
  }

  async updateScoringRules(
    workspaceId: string,
    rules: ScoringRule[]
  ): Promise<{ success: boolean; rulesUpdated: number }> {
    const response = await fetch(`${this.apiBaseUrl}/intelligence/scoring-rules`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        rules,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to update scoring rules')
    }

    return response.json()
  }

  // Activity tracking
  async trackLeadActivity(
    workspaceId: string,
    leadId: string,
    activity: Omit<LeadActivity, 'id' | 'leadId'>
  ): Promise<LeadActivity> {
    const response = await fetch(`${this.apiBaseUrl}/intelligence/activity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        lead_id: leadId,
        ...activity,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to track lead activity')
    }

    return response.json()
  }

  async getLeadActivities(
    workspaceId: string,
    leadId: string,
    options?: {
      limit?: number
      offset?: number
      startDate?: Date
      endDate?: Date
      types?: string[]
    }
  ): Promise<{ activities: LeadActivity[]; total: number }> {
    const params = new URLSearchParams({
      workspace_id: workspaceId,
      lead_id: leadId,
    })

    if (options?.limit) params.append('limit', options.limit.toString())
    if (options?.offset) params.append('offset', options.offset.toString())
    if (options?.startDate) params.append('start_date', options.startDate.toISOString())
    if (options?.endDate) params.append('end_date', options.endDate.toISOString())
    if (options?.types?.length) params.append('types', options.types.join(','))

    const response = await fetch(`${this.apiBaseUrl}/intelligence/activity?${params}`, {
      headers: {
        'Authorization': `Bearer ${await this.getToken()}`,
      },
    })

    if (!response.ok) {
      throw new Error('Failed to get lead activities')
    }

    return response.json()
  }

  // Buying signals
  async detectBuyingSignals(
    workspaceId: string,
    leadId: string
  ): Promise<BuyingSignal[]> {
    const response = await fetch(`${this.apiBaseUrl}/intelligence/buying-signals/${leadId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to detect buying signals')
    }

    return response.json()
  }

  async trackBuyingSignal(
    workspaceId: string,
    signal: Omit<BuyingSignal, 'id'>
  ): Promise<BuyingSignal> {
    const response = await fetch(`${this.apiBaseUrl}/intelligence/buying-signals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        ...signal,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to track buying signal')
    }

    return response.json()
  }

  // Company intelligence
  async getCompanyIntelligence(
    workspaceId: string,
    companyName: string,
    options?: {
      includeNews?: boolean
      includeFunding?: boolean
      includeDecisionMakers?: boolean
      includeTechnologies?: boolean
    }
  ): Promise<CompanyIntelligence> {
    const response = await fetch(`${this.apiBaseUrl}/intelligence/company`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        company_name: companyName,
        include_news: options?.includeNews,
        include_funding: options?.includeFunding,
        include_decision_makers: options?.includeDecisionMakers,
        include_technologies: options?.includeTechnologies,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to get company intelligence')
    }

    return response.json()
  }

  // Lead insights
  async generateLeadInsights(
    workspaceId: string,
    leadId: string,
    options?: {
      insightTypes?: string[]
      includeRecommendations?: boolean
      includeNextBestActions?: boolean
    }
  ): Promise<{
    insights: LeadInsight[]
    recommendations: string[]
    nextBestActions: NextBestAction[]
  }> {
    const response = await fetch(`${this.apiBaseUrl}/intelligence/insights/${leadId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        insight_types: options?.insightTypes,
        include_recommendations: options?.includeRecommendations,
        include_next_best_actions: options?.includeNextBestActions,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to generate lead insights')
    }

    return response.json()
  }

  // Predictive analytics
  async getPredictiveAnalytics(
    workspaceId: string,
    leadIds: string[]
  ): Promise<{
    predictions: Array<{
      leadId: string
      conversionProbability: number
      expectedDealSize: number
      timeToClose: number
      churnRisk: number
      recommendations: string[]
    }>
    modelAccuracy: number
    lastUpdated: Date
  }> {
    const response = await fetch(`${this.apiBaseUrl}/intelligence/predictive`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        lead_ids: leadIds,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to get predictive analytics')
    }

    return response.json()
  }

  // Lead prioritization
  async prioritizeLeads(
    workspaceId: string,
    options?: {
      limit?: number
      includeReasons?: boolean
      filterByScore?: number
      filterByEngagement?: boolean
      filterByIntent?: boolean
    }
  ): Promise<{
    prioritizedLeads: Array<{
      leadId: string
      leadName: string
      company: string
      score: number
      priority: 'critical' | 'high' | 'medium' | 'low'
      reasons: string[]
      nextBestAction: NextBestAction
      lastActivity: Date
    }>
    total: number
  }> {
    const params = new URLSearchParams({ workspace_id: workspaceId })

    if (options?.limit) params.append('limit', options.limit.toString())
    if (options?.includeReasons) params.append('include_reasons', 'true')
    if (options?.filterByScore) params.append('min_score', options.filterByScore.toString())
    if (options?.filterByEngagement) params.append('filter_engagement', 'true')
    if (options?.filterByIntent) params.append('filter_intent', 'true')

    const response = await fetch(`${this.apiBaseUrl}/intelligence/prioritize?${params}`, {
      headers: {
        'Authorization': `Bearer ${await this.getToken()}`,
      },
    })

    if (!response.ok) {
      throw new Error('Failed to prioritize leads')
    }

    return response.json()
  }

  // Engagement tracking
  async trackEngagement(
    workspaceId: string,
    leadId: string,
    engagement: {
      type: 'email_open' | 'email_click' | 'website_visit' | 'content_download' | 'form_submission' | 'social_interaction'
      channel: string
      contentId?: string
      duration?: number
      metadata?: any
    }
  ): Promise<{ success: boolean; scoreImpact: number }> {
    const response = await fetch(`${this.apiBaseUrl}/intelligence/engagement`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        lead_id: leadId,
        ...engagement,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to track engagement')
    }

    return response.json()
  }

  // Score history and trends
  async getScoreHistory(
    workspaceId: string,
    leadId: string,
    options?: {
      startDate?: Date
      endDate?: Date
      interval?: 'hourly' | 'daily' | 'weekly' | 'monthly'
    }
  ): Promise<{
    history: ScoreHistoryEntry[]
    trend: 'increasing' | 'decreasing' | 'stable'
    averageScore: number
    peakScore: number
    lowestScore: number
  }> {
    const params = new URLSearchParams({
      workspace_id: workspaceId,
      lead_id: leadId,
    })

    if (options?.startDate) params.append('start_date', options.startDate.toISOString())
    if (options?.endDate) params.append('end_date', options.endDate.toISOString())
    if (options?.interval) params.append('interval', options.interval)

    const response = await fetch(`${this.apiBaseUrl}/intelligence/score-history?${params}`, {
      headers: {
        'Authorization': `Bearer ${await this.getToken()}`,
      },
    })

    if (!response.ok) {
      throw new Error('Failed to get score history')
    }

    return response.json()
  }

  // AI-powered lead analysis
  async analyzeLeadWithAI(
    workspaceId: string,
    leadId: string,
    analysisType: 'personality' | 'communication_style' | 'buying_stage' | 'objections' | 'comprehensive'
  ): Promise<{
    analysis: {
      type: string
      summary: string
      details: any
      confidence: number
      recommendations: string[]
    }
    suggestedContent: {
      emailTemplates: string[]
      talkingPoints: string[]
      objectionHandling: string[]
    }
  }> {
    const response = await fetch(`${this.apiBaseUrl}/intelligence/ai-analysis/${leadId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        analysis_type: analysisType,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to analyze lead with AI')
    }

    return response.json()
  }

  // Lead segmentation
  async segmentLeads(
    workspaceId: string,
    segmentationCriteria: {
      scoreRange?: { min: number; max: number }
      industries?: string[]
      companySize?: string[]
      engagement?: 'high' | 'medium' | 'low'
      buyingStage?: string[]
      customFields?: Record<string, any>
    }
  ): Promise<{
    segments: Array<{
      segmentId: string
      segmentName: string
      criteria: any
      leadCount: number
      averageScore: number
      topActions: NextBestAction[]
    }>
    totalLeads: number
  }> {
    const response = await fetch(`${this.apiBaseUrl}/intelligence/segment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        criteria: segmentationCriteria,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to segment leads')
    }

    return response.json()
  }

  // Real-time alerts
  async setupScoreAlerts(
    workspaceId: string,
    alerts: Array<{
      name: string
      condition: {
        field: string
        operator: string
        value: any
      }
      channels: ('email' | 'slack' | 'webhook' | 'in_app')[]
      recipients: string[]
      isActive: boolean
    }>
  ): Promise<{ success: boolean; alertsCreated: number }> {
    const response = await fetch(`${this.apiBaseUrl}/intelligence/alerts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        alerts,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to setup score alerts')
    }

    return response.json()
  }

  private async getToken(): Promise<string> {
    const { data: { session } } = await this.supabase.auth.getSession()
    return session?.access_token || ''
  }
}

// Export singleton instance
export const leadScoringService = new LeadScoringService()