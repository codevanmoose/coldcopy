import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
    const { 
      workspace_id, 
      insight_types, 
      include_recommendations, 
      include_next_best_actions 
    } = body
    
    if (!workspace_id) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    // Get lead with all related data
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select(`
        *,
        lead_scores(*),
        email_events(
          event_type,
          created_at,
          metadata
        ),
        campaigns(
          name,
          status
        )
      `)
      .eq('id', leadId)
      .eq('workspace_id', workspace_id)
      .single()

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    const score = lead.lead_scores?.[0]
    const emailEvents = lead.email_events || []
    const campaigns = lead.campaigns || []

    // Generate insights
    const insights = []

    // Score-based insights
    if (!insight_types || insight_types.includes('score')) {
      if (score?.total_score >= 80) {
        insights.push({
          id: `insight-${Date.now()}-1`,
          type: 'positive',
          category: 'score',
          title: 'High-Value Lead',
          description: 'This lead has an excellent score of ' + score.total_score + ' and shows strong buying signals.',
          importance: 'high',
          actionable: true,
          suggestedAction: 'Prioritize immediate personal outreach with a custom demo offer',
          timestamp: new Date(),
        })
      } else if (score?.total_score < 40) {
        insights.push({
          id: `insight-${Date.now()}-2`,
          type: 'warning',
          category: 'score',
          title: 'Low Lead Score',
          description: 'Current score is only ' + score?.total_score + '. This lead may need more nurturing.',
          importance: 'medium',
          actionable: true,
          suggestedAction: 'Move to a long-term nurture campaign with educational content',
          timestamp: new Date(),
        })
      }
    }

    // Engagement insights
    if (!insight_types || insight_types.includes('engagement')) {
      const recentEvents = emailEvents.filter(e => 
        new Date(e.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      )
      
      const opens = recentEvents.filter(e => e.event_type === 'opened').length
      const clicks = recentEvents.filter(e => e.event_type === 'clicked').length
      const replies = recentEvents.filter(e => e.event_type === 'replied').length
      
      if (clicks >= 5) {
        insights.push({
          id: `insight-${Date.now()}-3`,
          type: 'opportunity',
          category: 'engagement',
          title: 'High Email Engagement',
          description: `Lead has clicked ${clicks} links in the past week, showing strong interest`,
          importance: 'high',
          actionable: true,
          suggestedAction: 'Send a personalized offer or schedule a call',
          timestamp: new Date(),
        })
      } else if (opens === 0 && emailEvents.length > 5) {
        insights.push({
          id: `insight-${Date.now()}-4`,
          type: 'negative',
          category: 'engagement',
          title: 'Email Fatigue Detected',
          description: 'Recent emails are not being opened. The lead may be disengaged.',
          importance: 'medium',
          actionable: true,
          suggestedAction: 'Pause email outreach and try a different channel like LinkedIn',
          timestamp: new Date(),
        })
      }
      
      if (replies > 0) {
        insights.push({
          id: `insight-${Date.now()}-5`,
          type: 'positive',
          category: 'engagement',
          title: 'Active Conversation',
          description: 'Lead has replied to emails, indicating active interest',
          importance: 'high',
          actionable: true,
          suggestedAction: 'Continue the conversation with personalized follow-ups',
          timestamp: new Date(),
        })
      }
    }

    // Profile insights
    if (!insight_types || insight_types.includes('profile')) {
      if (lead.title?.toLowerCase().includes('director') || lead.title?.toLowerCase().includes('vp')) {
        insights.push({
          id: `insight-${Date.now()}-6`,
          type: 'positive',
          category: 'profile',
          title: 'Decision Maker',
          description: 'This lead holds a senior position and likely has decision-making authority',
          importance: 'high',
          actionable: false,
          timestamp: new Date(),
        })
      }
      
      if (!lead.phone && !lead.linkedin_url) {
        insights.push({
          id: `insight-${Date.now()}-7`,
          type: 'neutral',
          category: 'profile',
          title: 'Limited Contact Information',
          description: 'Only email address available. Consider enriching this lead.',
          importance: 'low',
          actionable: true,
          suggestedAction: 'Use lead enrichment to find phone and LinkedIn profile',
          timestamp: new Date(),
        })
      }
    }

    // Timing insights
    if (!insight_types || insight_types.includes('timing')) {
      const daysSinceCreated = Math.floor(
        (Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24)
      )
      
      if (daysSinceCreated > 30 && score?.total_score < 60) {
        insights.push({
          id: `insight-${Date.now()}-8`,
          type: 'warning',
          category: 'timing',
          title: 'Stale Lead',
          description: `Lead has been in the system for ${daysSinceCreated} days with limited progress`,
          importance: 'medium',
          actionable: true,
          suggestedAction: 'Re-evaluate lead quality or try a re-engagement campaign',
          timestamp: new Date(),
        })
      }
    }

    // Generate recommendations
    const recommendations = include_recommendations ? generateRecommendations(lead, score, emailEvents) : []

    // Generate next best actions
    const nextBestActions = include_next_best_actions ? generateNextBestActions(lead, score, insights) : []

    return NextResponse.json({
      insights,
      recommendations,
      nextBestActions,
    })
  } catch (error) {
    console.error('Error generating insights:', error)
    return NextResponse.json(
      { error: 'Failed to generate insights' },
      { status: 500 }
    )
  }
}

function generateRecommendations(lead: any, score: any, emailEvents: any[]): string[] {
  const recommendations = []

  // Score-based recommendations
  if (score?.total_score >= 80) {
    recommendations.push('Move this lead to your high-priority outreach list')
    recommendations.push('Consider offering a personalized demo or trial')
  } else if (score?.total_score < 40) {
    recommendations.push('Focus on educational content to build trust')
    recommendations.push('Use a longer nurture sequence before sales outreach')
  }

  // Engagement-based recommendations
  const recentClicks = emailEvents.filter(e => 
    e.event_type === 'clicked' && 
    new Date(e.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  ).length

  if (recentClicks >= 3) {
    recommendations.push('Lead is showing high interest - accelerate your outreach cadence')
  }

  // Profile-based recommendations
  if (!lead.company) {
    recommendations.push('Research and add company information for better targeting')
  }

  if (!lead.phone) {
    recommendations.push('Find phone number to enable multi-channel outreach')
  }

  // Channel recommendations
  if (emailEvents.filter(e => e.event_type === 'opened').length === 0 && emailEvents.length > 3) {
    recommendations.push('Email channel is not working - try LinkedIn or phone outreach')
  }

  return recommendations
}

function generateNextBestActions(lead: any, score: any, insights: any[]): any[] {
  const actions = []

  // High-priority actions based on score
  if (score?.total_score >= 80 && score?.intent_score >= 70) {
    actions.push({
      id: `action-${Date.now()}-1`,
      action: 'Schedule a personalized demo',
      channel: 'phone',
      priority: 'high',
      timing: 'immediate',
      reason: 'High score with strong buying intent',
      expectedImpact: 0.85,
      confidence: 0.9,
    })
  }

  // Engagement-based actions
  const hasPositiveEngagement = insights.some(i => 
    i.category === 'engagement' && i.type === 'positive'
  )

  if (hasPositiveEngagement) {
    actions.push({
      id: `action-${Date.now()}-2`,
      action: 'Send personalized case study',
      channel: 'email',
      priority: 'high',
      timing: 'today',
      reason: 'Capitalize on current engagement',
      expectedImpact: 0.7,
      confidence: 0.8,
    })
  }

  // Re-engagement actions
  const needsReengagement = insights.some(i => 
    i.type === 'warning' || i.type === 'negative'
  )

  if (needsReengagement && !lead.linkedin_url) {
    actions.push({
      id: `action-${Date.now()}-3`,
      action: 'Connect on LinkedIn',
      channel: 'linkedin',
      priority: 'medium',
      timing: 'this_week',
      reason: 'Try different channel for re-engagement',
      expectedImpact: 0.5,
      confidence: 0.6,
    })
  }

  // Default nurture action
  if (actions.length === 0) {
    actions.push({
      id: `action-${Date.now()}-4`,
      action: 'Continue nurture sequence',
      channel: 'email',
      priority: 'low',
      timing: 'next_week',
      reason: 'Standard nurture progression',
      expectedImpact: 0.3,
      confidence: 0.5,
    })
  }

  return actions
}
