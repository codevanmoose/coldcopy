import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { leadScoringService } from '@/lib/intelligence/lead-scoring-service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const { leadId } = await params;
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { workspace_id, include_history, include_predictive, include_insights } = body
    
    if (!workspace_id) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    // Get lead details
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .eq('workspace_id', workspace_id)
      .single()

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    // Calculate base scores
    const profileScore = calculateProfileScore(lead)
    const engagementScore = await calculateEngagementScore(leadId)
    const behaviorScore = await calculateBehaviorScore(leadId)
    const intentScore = await calculateIntentScore(leadId)
    const fitScore = calculateFitScore(lead)

    // Calculate total score (weighted average)
    const totalScore = Math.round(
      profileScore * 0.2 +
      engagementScore * 0.25 +
      behaviorScore * 0.2 +
      intentScore * 0.25 +
      fitScore * 0.1
    )

    // Score breakdown
    const scoreBreakdown = {
      demographic: calculateDemographicScore(lead),
      firmographic: calculateFirmographicScore(lead),
      behavioral: behaviorScore,
      engagement: engagementScore,
      intent: intentScore,
      social: await calculateSocialScore(lead),
      email: await calculateEmailScore(leadId),
      website: await calculateWebsiteScore(leadId),
    }

    // Predictive scores
    const predictiveScores = include_predictive ? {
      conversionProbability: calculateConversionProbability(totalScore, engagementScore, intentScore),
      churnRisk: calculateChurnRisk(engagementScore, behaviorScore),
      dealSize: estimateDealSize(lead, fitScore),
      timeToClose: estimateTimeToClose(totalScore, intentScore),
      lifetimeValue: estimateLifetimeValue(lead, totalScore),
    } : {}

    // Score factors
    const { positiveFactors, negativeFactors } = await getScoreFactors(lead, leadId)

    // Insights and recommendations
    const insights = include_insights ? await generateInsights(lead, totalScore, scoreBreakdown) : []
    const recommendations = include_insights ? generateRecommendations(totalScore, scoreBreakdown) : []
    const nextBestActions = include_insights ? await generateNextBestActions(lead, totalScore, intentScore) : []

    // Score history
    const scoreHistory = include_history ? await getScoreHistory(leadId) : []

    // Determine lead status
    const isHot = totalScore >= 80
    const isQualified = totalScore >= 60 && fitScore >= 70
    const isEngaged = engagementScore >= 70
    const requiresNurturing = totalScore < 60 || engagementScore < 50

    // Save score to database
    await supabase
      .from('lead_scores')
      .upsert({
        lead_id: leadId,
        workspace_id: workspace_id,
        total_score: totalScore,
        profile_score: profileScore,
        engagement_score: engagementScore,
        behavior_score: behaviorScore,
        intent_score: intentScore,
        fit_score: fitScore,
        score_breakdown: scoreBreakdown,
        predictive_scores: predictiveScores,
        is_hot: isHot,
        is_qualified: isQualified,
        is_engaged: isEngaged,
        requires_nurturing: requiresNurturing,
        positive_factors: positiveFactors,
        negative_factors: negativeFactors,
        insights,
        recommendations,
        last_calculated: new Date().toISOString(),
      })

    const response = {
      id: `score-${leadId}`,
      leadId: leadId,
      workspaceId: workspace_id,
      totalScore,
      engagementScore,
      profileScore,
      behaviorScore,
      intentScore,
      fitScore,
      scoreBreakdown,
      predictiveScores,
      positiveFactors,
      negativeFactors,
      insights,
      recommendations,
      nextBestActions,
      scoringModel: 'v2.0',
      scoringVersion: '2.0.0',
      lastCalculated: new Date(),
      scoreHistory,
      isHot,
      isQualified,
      isEngaged,
      requiresNurturing,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error calculating lead score:', error)
    return NextResponse.json(
      { error: 'Failed to calculate lead score' },
      { status: 500 }
    )
  }
}

// Helper functions for score calculation
function calculateProfileScore(lead: any): number {
  let score = 50 // Base score
  
  // Job title scoring
  if (lead.title) {
    const seniorTitles = ['ceo', 'cto', 'cfo', 'vp', 'director', 'head']
    const titleLower = lead.title.toLowerCase()
    if (seniorTitles.some(t => titleLower.includes(t))) score += 20
    else if (titleLower.includes('manager')) score += 15
    else score += 10
  }
  
  // Company information
  if (lead.company) score += 10
  if (lead.phone) score += 5
  if (lead.linkedin_url) score += 5
  
  return Math.min(score, 100)
}

async function calculateEngagementScore(leadId: string): Promise<number> {
  const supabase = createClient()
  
  // Get email engagement
  const { data: emailEvents } = await supabase
    .from('email_events')
    .select('event_type')
    .eq('lead_id', leadId)
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

  let score = 0
  if (emailEvents) {
    const opens = emailEvents.filter(e => e.event_type === 'opened').length
    const clicks = emailEvents.filter(e => e.event_type === 'clicked').length
    const replies = emailEvents.filter(e => e.event_type === 'replied').length
    
    score += Math.min(opens * 5, 30)
    score += Math.min(clicks * 10, 40)
    score += Math.min(replies * 20, 30)
  }
  
  return Math.min(score, 100)
}

async function calculateBehaviorScore(leadId: string): Promise<number> {
  // Simplified behavior score based on recent activities
  return 60 // Placeholder
}

async function calculateIntentScore(leadId: string): Promise<number> {
  // Simplified intent score based on buying signals
  return 70 // Placeholder
}

function calculateFitScore(lead: any): number {
  let score = 50
  
  // Industry fit
  if (lead.enrichment_data?.industry) {
    const targetIndustries = ['technology', 'software', 'saas', 'finance']
    if (targetIndustries.includes(lead.enrichment_data.industry.toLowerCase())) {
      score += 20
    }
  }
  
  // Company size fit
  if (lead.enrichment_data?.company_size) {
    const size = parseInt(lead.enrichment_data.company_size)
    if (size >= 50 && size <= 500) score += 20
    else if (size > 500) score += 15
  }
  
  return Math.min(score, 100)
}

function calculateDemographicScore(lead: any): number {
  return calculateProfileScore(lead) // Reuse profile score logic
}

function calculateFirmographicScore(lead: any): number {
  return calculateFitScore(lead) // Reuse fit score logic
}

async function calculateSocialScore(lead: any): Promise<number> {
  let score = 0
  if (lead.linkedin_url) score += 50
  if (lead.enrichment_data?.twitter_handle) score += 25
  return score
}

async function calculateEmailScore(leadId: string): Promise<number> {
  return calculateEngagementScore(leadId) // Reuse engagement score
}

async function calculateWebsiteScore(leadId: string): Promise<number> {
  // Placeholder for website visit tracking
  return 50
}

function calculateConversionProbability(totalScore: number, engagementScore: number, intentScore: number): number {
  const weighted = (totalScore * 0.3 + engagementScore * 0.4 + intentScore * 0.3) / 100
  return Math.min(weighted * 1.2, 0.95) // Cap at 95%
}

function calculateChurnRisk(engagementScore: number, behaviorScore: number): number {
  const risk = 1 - ((engagementScore + behaviorScore) / 200)
  return Math.max(risk * 0.8, 0.05) // Floor at 5%
}

function estimateDealSize(lead: any, fitScore: number): number {
  let baseSize = 10000
  
  if (lead.enrichment_data?.company_size) {
    const size = parseInt(lead.enrichment_data.company_size)
    if (size > 1000) baseSize = 100000
    else if (size > 500) baseSize = 50000
    else if (size > 100) baseSize = 25000
  }
  
  return Math.round(baseSize * (fitScore / 100))
}

function estimateTimeToClose(totalScore: number, intentScore: number): number {
  const baseDays = 90
  const reduction = ((totalScore + intentScore) / 200) * 60
  return Math.round(baseDays - reduction)
}

function estimateLifetimeValue(lead: any, totalScore: number): number {
  const dealSize = estimateDealSize(lead, totalScore)
  const years = 3
  const expansionRate = 1.2
  return Math.round(dealSize * years * expansionRate)
}

async function getScoreFactors(lead: any, leadId: string) {
  const positiveFactors = []
  const negativeFactors = []
  
  // Positive factors
  if (lead.title?.toLowerCase().includes('director')) {
    positiveFactors.push({
      factor: 'Senior job title',
      category: 'profile',
      impact: 20,
      description: 'Decision maker level',
      timestamp: new Date(),
    })
  }
  
  // Negative factors
  if (!lead.phone) {
    negativeFactors.push({
      factor: 'Missing phone number',
      category: 'profile',
      impact: -10,
      description: 'Incomplete contact information',
      timestamp: new Date(),
    })
  }
  
  return { positiveFactors, negativeFactors }
}

async function generateInsights(lead: any, totalScore: number, scoreBreakdown: any) {
  const insights = []
  
  if (totalScore >= 80) {
    insights.push({
      id: `insight-${Date.now()}-1`,
      type: 'positive',
      category: 'score',
      title: 'Hot Lead Alert',
      description: 'This lead has a high score and shows strong buying signals. Prioritize for immediate outreach.',
      importance: 'high',
      actionable: true,
      suggestedAction: 'Schedule a discovery call within the next 2 days',
      timestamp: new Date(),
    })
  }
  
  if (scoreBreakdown.engagement < 50) {
    insights.push({
      id: `insight-${Date.now()}-2`,
      type: 'warning',
      category: 'engagement',
      title: 'Low Engagement',
      description: 'This lead has not been engaging with recent communications. Consider a different approach.',
      importance: 'medium',
      actionable: true,
      suggestedAction: 'Try a different channel or personalize your messaging',
      timestamp: new Date(),
    })
  }
  
  return insights
}

function generateRecommendations(totalScore: number, scoreBreakdown: any): string[] {
  const recommendations = []
  
  if (scoreBreakdown.engagement < 60) {
    recommendations.push('Increase email personalization to improve engagement')
  }
  
  if (scoreBreakdown.social < 50) {
    recommendations.push('Connect on LinkedIn to build a stronger relationship')
  }
  
  if (totalScore >= 70) {
    recommendations.push('Move to a more aggressive outreach cadence')
  }
  
  return recommendations
}

async function generateNextBestActions(lead: any, totalScore: number, intentScore: number) {
  const actions = []
  
  if (totalScore >= 80 && intentScore >= 70) {
    actions.push({
      id: `action-${Date.now()}-1`,
      action: 'Schedule a demo call',
      channel: 'phone',
      priority: 'high',
      timing: 'immediate',
      reason: 'High score and strong buying intent detected',
      expectedImpact: 0.8,
      confidence: 0.85,
    })
  }
  
  if (!lead.linkedin_url) {
    actions.push({
      id: `action-${Date.now()}-2`,
      action: 'Connect on LinkedIn',
      channel: 'linkedin',
      priority: 'medium',
      timing: 'today',
      reason: 'Build relationship and gather more insights',
      expectedImpact: 0.5,
      confidence: 0.7,
    })
  }
  
  return actions
}

async function getScoreHistory(leadId: string) {
  const supabase = createClient()
  
  const { data: history } = await supabase
    .from('lead_score_history')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .limit(30)
  
  return history?.map(h => ({
    timestamp: new Date(h.created_at),
    score: h.score,
    change: h.change || 0,
    reason: h.reason || 'Score update',
  })) || []
}
