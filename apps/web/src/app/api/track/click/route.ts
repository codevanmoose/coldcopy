import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateTrackingToken } from '@/lib/email/tracking'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const token = searchParams.get('t')
    const emailId = searchParams.get('e')
    const leadId = searchParams.get('l')
    const workspaceId = searchParams.get('w')
    const campaignId = searchParams.get('c')
    const targetUrl = searchParams.get('u')

    // Validate required parameters
    if (!token || !emailId || !leadId || !workspaceId || !targetUrl) {
      return NextResponse.redirect(new URL('/', request.url))
    }

    // Decode the target URL
    const decodedUrl = decodeURIComponent(targetUrl)

    // Verify token
    const expectedToken = generateTrackingToken(`${emailId}-${leadId}`)
    if (token !== expectedToken) {
      console.warn('Invalid click tracking token')
      // Still redirect to avoid breaking user experience
      return NextResponse.redirect(decodedUrl)
    }

    // Record the click event
    const supabase = await createClient()
    
    await supabase
      .from('email_events')
      .insert({
        workspace_id: workspaceId,
        campaign_id: campaignId,
        lead_id: leadId,
        email_id: emailId,
        event_type: 'clicked',
        metadata: {
          url: decodedUrl,
          user_agent: request.headers.get('user-agent'),
          ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
          timestamp: new Date().toISOString(),
        },
      })

    // Update campaign email click status
    const { data: emailData } = await supabase
      .from('campaign_emails')
      .select('clicked_at, click_count')
      .eq('id', emailId)
      .single()

    await supabase
      .from('campaign_emails')
      .update({
        clicked_at: emailData?.clicked_at || new Date().toISOString(),
        click_count: (emailData?.click_count || 0) + 1,
      })
      .eq('id', emailId)

    // Update lead engagement
    await supabase
      .from('leads')
      .update({
        last_activity_at: new Date().toISOString(),
        engagement_score: supabase.rpc('increment_engagement_score', { 
          p_lead_id: leadId,
          p_points: 20 // Points for clicking a link
        }),
      })
      .eq('id', leadId)

    // Check if this indicates high intent (clicked within 1 hour of opening)
    const { data: openEvent } = await supabase
      .from('email_events')
      .select('created_at')
      .eq('email_id', emailId)
      .eq('lead_id', leadId)
      .eq('event_type', 'opened')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (openEvent) {
      const openTime = new Date(openEvent.created_at)
      const clickTime = new Date()
      const timeDiff = clickTime.getTime() - openTime.getTime()
      const hoursDiff = timeDiff / (1000 * 60 * 60)

      if (hoursDiff <= 1) {
        // Mark as high intent lead
        // Mark as high intent lead
        const { data: currentLead } = await supabase
          .from('leads')
          .select('tags, custom_fields')
          .eq('id', leadId)
          .single()

        if (currentLead && !currentLead.tags?.includes('high-intent')) {
          await supabase
            .from('leads')
            .update({
              tags: [...(currentLead.tags || []), 'high-intent'],
              custom_fields: {
                ...(currentLead.custom_fields || {}),
                high_intent_at: new Date().toISOString(),
              },
            })
            .eq('id', leadId)
        }
      }
    }

    // Redirect to the target URL
    return NextResponse.redirect(decodedUrl)
  } catch (error) {
    console.error('Click tracking error:', error)
    
    // Try to redirect to the URL anyway
    const targetUrl = request.nextUrl.searchParams.get('u')
    if (targetUrl) {
      try {
        const decodedUrl = decodeURIComponent(targetUrl)
        return NextResponse.redirect(decodedUrl)
      } catch {
        // If decode fails, redirect to home
      }
    }
    
    return NextResponse.redirect(new URL('/', request.url))
  }
}