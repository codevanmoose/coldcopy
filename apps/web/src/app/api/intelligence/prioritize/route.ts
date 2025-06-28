import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const workspaceId = searchParams.get('workspace_id')
    const limit = parseInt(searchParams.get('limit') || '50')
    const includeReasons = searchParams.get('include_reasons') === 'true'
    const minScore = parseInt(searchParams.get('min_score') || '0')
    const filterEngagement = searchParams.get('filter_engagement') === 'true'
    const filterIntent = searchParams.get('filter_intent') === 'true'
    
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    // Get leads with their scores
    let query = supabase
      .from('leads')
      .select(`
        *,
        lead_scores!inner(
          total_score,
          engagement_score,
          intent_score,
          is_hot,
          is_qualified,
          last_calculated
        ),
        email_events(
          event_type,
          created_at
        )
      `)
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')
      .order('lead_scores.total_score', { ascending: false })
      .limit(limit)

    if (minScore > 0) {
      query = query.gte('lead_scores.total_score', minScore)
    }

    if (filterEngagement) {
      query = query.gte('lead_scores.engagement_score', 60)
    }

    if (filterIntent) {
      query = query.gte('lead_scores.intent_score', 60)
    }

    const { data: leads, error } = await query

    if (error) {
      throw error
    }

    // Process and prioritize leads
    const prioritizedLeads = leads.map(lead => {
      const score = lead.lead_scores?.[0] || {}
      const recentEvents = lead.email_events || []
      
      // Determine priority
      let priority = 'low'
      let reasons = []
      
      if (score.total_score >= 90) {
        priority = 'critical'
        reasons.push('Extremely high lead score (90+)')
      } else if (score.total_score >= 80) {
        priority = 'high'
        reasons.push('High lead score (80+)')
      } else if (score.total_score >= 60) {
        priority = 'medium'
        reasons.push('Good lead score (60+)')
      }
      
      // Check for recent engagement
      const recentEngagement = recentEvents.filter(e => 
        new Date(e.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      )
      
      if (recentEngagement.some(e => e.event_type === 'replied')) {
        priority = priority === 'low' ? 'medium' : priority
        reasons.push('Recently replied to email')
      }
      
      if (recentEngagement.filter(e => e.event_type === 'clicked').length >= 3) {
        priority = priority === 'low' ? 'medium' : priority
        reasons.push('High email engagement (3+ clicks)')
      }
      
      // Determine next best action
      let nextBestAction = {
        id: `nba-${lead.id}`,
        action: 'Send follow-up email',
        channel: 'email' as const,
        priority: 'medium' as const,
        timing: 'this_week' as const,
        reason: 'Standard nurture sequence',
        expectedImpact: 0.5,
        confidence: 0.7,
      }
      
      if (score.total_score >= 80 && score.intent_score >= 70) {
        nextBestAction = {
          id: `nba-${lead.id}`,
          action: 'Schedule a demo call',
          channel: 'phone' as const,
          priority: 'high' as const,
          timing: 'immediate' as const,
          reason: 'High score with strong buying intent',
          expectedImpact: 0.85,
          confidence: 0.9,
        }
      } else if (score.engagement_score < 40) {
        nextBestAction = {
          id: `nba-${lead.id}`,
          action: 'Try a different channel',
          channel: 'linkedin' as const,
          priority: 'medium' as const,
          timing: 'today' as const,
          reason: 'Low email engagement',
          expectedImpact: 0.6,
          confidence: 0.65,
        }
      }
      
      // Get last activity
      const lastActivity = recentEvents.length > 0
        ? new Date(Math.max(...recentEvents.map(e => new Date(e.created_at).getTime())))
        : new Date(lead.created_at)
      
      return {
        leadId: lead.id,
        leadName: `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || lead.email,
        company: lead.company || 'Unknown',
        score: score.total_score || 0,
        priority,
        reasons: includeReasons ? reasons : undefined,
        nextBestAction,
        lastActivity,
      }
    })
    
    // Sort by priority and score
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    prioritizedLeads.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
      if (priorityDiff !== 0) return priorityDiff
      return b.score - a.score
    })
    
    return NextResponse.json({
      prioritizedLeads,
      total: prioritizedLeads.length,
    })
  } catch (error) {
    console.error('Error prioritizing leads:', error)
    return NextResponse.json(
      { error: 'Failed to prioritize leads' },
      { status: 500 }
    )
  }
}