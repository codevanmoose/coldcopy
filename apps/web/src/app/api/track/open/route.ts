import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateTrackingToken } from '@/lib/email/tracking'

// 1x1 transparent GIF
const TRACKING_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
)

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const token = searchParams.get('t')
    const emailId = searchParams.get('e')
    const leadId = searchParams.get('l')
    const workspaceId = searchParams.get('w')
    const campaignId = searchParams.get('c')

    // Validate required parameters
    if (!token || !emailId || !leadId || !workspaceId) {
      return new NextResponse(TRACKING_PIXEL, {
        status: 200,
        headers: {
          'Content-Type': 'image/gif',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      })
    }

    // Verify token
    const expectedToken = generateTrackingToken(`${emailId}-${leadId}`)
    if (token !== expectedToken) {
      console.warn('Invalid tracking token')
      return new NextResponse(TRACKING_PIXEL, {
        status: 200,
        headers: { 'Content-Type': 'image/gif' },
      })
    }

    // Record the open event
    const supabase = await createClient()
    
    // Check if this open was already recorded (prevent duplicates)
    const { data: existingEvent } = await supabase
      .from('email_events')
      .select('id')
      .eq('email_id', emailId)
      .eq('lead_id', leadId)
      .eq('event_type', 'opened')
      .single()

    if (!existingEvent) {
      // Record the open event
      await supabase
        .from('email_events')
        .insert({
          workspace_id: workspaceId,
          campaign_id: campaignId,
          lead_id: leadId,
          email_id: emailId,
          event_type: 'opened',
          metadata: {
            user_agent: request.headers.get('user-agent'),
            ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
            timestamp: new Date().toISOString(),
          },
        })

      // Update campaign email status
      await supabase
        .from('campaign_emails')
        .update({
          opened_at: new Date().toISOString(),
          open_count: 1, // Could increment this for multiple opens
        })
        .eq('id', emailId)
        .is('opened_at', null) // Only update if not already opened

      // Update lead engagement
      await supabase
        .from('leads')
        .update({
          last_activity_at: new Date().toISOString(),
          engagement_score: supabase.rpc('increment_engagement_score', { 
            p_lead_id: leadId,
            p_points: 10 // Points for opening an email
          }),
        })
        .eq('id', leadId)
    }

    // Return tracking pixel
    return new NextResponse(TRACKING_PIXEL, {
      status: 200,
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error) {
    console.error('Email tracking error:', error)
    // Always return the pixel even on error
    return new NextResponse(TRACKING_PIXEL, {
      status: 200,
      headers: { 'Content-Type': 'image/gif' },
    })
  }
}