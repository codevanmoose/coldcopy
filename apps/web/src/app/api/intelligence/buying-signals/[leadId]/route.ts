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
    const { workspace_id } = body
    
    if (!workspace_id) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    // Get lead with all activity data
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select(`
        *,
        email_events(
          event_type,
          created_at,
          metadata
        ),
        lead_activities(
          activity_type,
          activity_data,
          created_at
        )
      `)
      .eq('id', leadId)
      .eq('workspace_id', workspace_id)
      .single()

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    const emailEvents = lead.email_events || []
    const activities = lead.lead_activities || []
    const buyingSignals = []

    // Analyze email engagement patterns
    const recentEvents = emailEvents.filter(e => 
      new Date(e.created_at) > new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    )
    
    const recentClicks = recentEvents.filter(e => e.event_type === 'clicked')
    const recentOpens = recentEvents.filter(e => e.event_type === 'opened')
    const replies = recentEvents.filter(e => e.event_type === 'replied')

    // High engagement signal
    if (recentClicks.length >= 5) {
      buyingSignals.push({
        id: `signal-${Date.now()}-1`,
        leadId: leadId,
        signalType: 'high_intent',
        signalName: 'High Email Engagement',
        description: `Clicked ${recentClicks.length} links in the past 2 weeks`,
        confidence: 0.85,
        timestamp: new Date(),
        source: 'email_tracking',
        metadata: {
          clickCount: recentClicks.length,
          links: recentClicks.map(c => c.metadata?.link_url).filter(Boolean),
        },
      })
    }

    // Pricing page visits
    const pricingClicks = recentClicks.filter(c => 
      c.metadata?.link_url?.includes('pricing') || 
      c.metadata?.link_url?.includes('plans')
    )
    
    if (pricingClicks.length > 0) {
      buyingSignals.push({
        id: `signal-${Date.now()}-2`,
        leadId: leadId,
        signalType: 'high_intent',
        signalName: 'Pricing Interest',
        description: `Visited pricing page ${pricingClicks.length} time(s)`,
        confidence: 0.9,
        timestamp: new Date(pricingClicks[0].created_at),
        source: 'email_tracking',
        metadata: {
          visits: pricingClicks.length,
          lastVisit: pricingClicks[0].created_at,
        },
      })
    }

    // Reply engagement
    if (replies.length > 0) {
      buyingSignals.push({
        id: `signal-${Date.now()}-3`,
        leadId: leadId,
        signalType: 'medium_intent',
        signalName: 'Email Reply',
        description: 'Lead has replied to email communication',
        confidence: 0.8,
        timestamp: new Date(replies[0].created_at),
        source: 'email_tracking',
        metadata: {
          replyCount: replies.length,
        },
      })
    }

    // Sudden increase in engagement
    const oldEvents = emailEvents.filter(e => 
      new Date(e.created_at) < new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) &&
      new Date(e.created_at) > new Date(Date.now() - 28 * 24 * 60 * 60 * 1000)
    )
    
    if (recentOpens.length > oldEvents.length * 2 && recentOpens.length >= 3) {
      buyingSignals.push({
        id: `signal-${Date.now()}-4`,
        leadId: leadId,
        signalType: 'medium_intent',
        signalName: 'Engagement Surge',
        description: 'Significant increase in email engagement recently',
        confidence: 0.7,
        timestamp: new Date(),
        source: 'email_tracking',
        metadata: {
          recentOpens: recentOpens.length,
          previousOpens: oldEvents.filter(e => e.event_type === 'opened').length,
        },
      })
    }

    // Content consumption patterns
    const downloadClicks = recentClicks.filter(c => 
      c.metadata?.link_url?.includes('download') || 
      c.metadata?.link_url?.includes('whitepaper') ||
      c.metadata?.link_url?.includes('ebook') ||
      c.metadata?.link_url?.includes('guide')
    )
    
    if (downloadClicks.length >= 2) {
      buyingSignals.push({
        id: `signal-${Date.now()}-5`,
        leadId: leadId,
        signalType: 'medium_intent',
        signalName: 'Content Consumer',
        description: `Downloaded ${downloadClicks.length} resources`,
        confidence: 0.65,
        timestamp: new Date(),
        source: 'email_tracking',
        metadata: {
          downloads: downloadClicks.length,
        },
      })
    }

    // Demo or trial requests
    const demoClicks = recentClicks.filter(c => 
      c.metadata?.link_url?.includes('demo') || 
      c.metadata?.link_url?.includes('trial') ||
      c.metadata?.link_url?.includes('get-started')
    )
    
    if (demoClicks.length > 0) {
      buyingSignals.push({
        id: `signal-${Date.now()}-6`,
        leadId: leadId,
        signalType: 'high_intent',
        signalName: 'Demo Interest',
        description: 'Clicked on demo/trial links',
        confidence: 0.95,
        timestamp: new Date(demoClicks[0].created_at),
        source: 'email_tracking',
        metadata: {
          clicks: demoClicks.length,
        },
      })
    }

    // Company-level signals
    if (lead.enrichment_data?.company_funding_total > 10000000) {
      buyingSignals.push({
        id: `signal-${Date.now()}-7`,
        leadId: leadId,
        signalType: 'medium_intent',
        signalName: 'Well-Funded Company',
        description: 'Company has raised significant funding',
        confidence: 0.6,
        timestamp: new Date(),
        source: 'enrichment',
        metadata: {
          fundingTotal: lead.enrichment_data.company_funding_total,
        },
      })
    }

    // Job title signals
    if (lead.title?.toLowerCase().match(/director|vp|head|chief|president|ceo|cto|cfo/)) {
      buyingSignals.push({
        id: `signal-${Date.now()}-8`,
        leadId: leadId,
        signalType: 'medium_intent',
        signalName: 'Decision Maker',
        description: 'Senior position with purchasing authority',
        confidence: 0.7,
        timestamp: new Date(),
        source: 'profile',
        metadata: {
          title: lead.title,
        },
      })
    }

    // Negative signals
    const bounces = emailEvents.filter(e => e.event_type === 'bounced')
    const unsubscribes = emailEvents.filter(e => e.event_type === 'unsubscribed')
    
    if (bounces.length > 0) {
      buyingSignals.push({
        id: `signal-${Date.now()}-9`,
        leadId: leadId,
        signalType: 'negative',
        signalName: 'Email Bounced',
        description: 'Email address may be invalid',
        confidence: 0.9,
        timestamp: new Date(bounces[0].created_at),
        source: 'email_tracking',
        metadata: {
          bounceCount: bounces.length,
        },
      })
    }
    
    if (unsubscribes.length > 0) {
      buyingSignals.push({
        id: `signal-${Date.now()}-10`,
        leadId: leadId,
        signalType: 'negative',
        signalName: 'Unsubscribed',
        description: 'Lead has opted out of communications',
        confidence: 1.0,
        timestamp: new Date(unsubscribes[0].created_at),
        source: 'email_tracking',
      })
    }

    // Sort by confidence and timestamp
    buyingSignals.sort((a, b) => {
      if (a.signalType !== b.signalType) {
        const typeOrder = { high_intent: 0, medium_intent: 1, low_intent: 2, negative: 3 }
        return typeOrder[a.signalType] - typeOrder[b.signalType]
      }
      return b.confidence - a.confidence
    })

    // Save signals to database
    if (buyingSignals.length > 0) {
      await supabase
        .from('buying_signals')
        .upsert(
          buyingSignals.map(signal => ({
            ...signal,
            workspace_id,
          }))
        )
    }

    return NextResponse.json(buyingSignals)
  } catch (error) {
    console.error('Error detecting buying signals:', error)
    return NextResponse.json(
      { error: 'Failed to detect buying signals' },
      { status: 500 }
    )
  }
}
