import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const url = searchParams.get('url')
    const emailId = searchParams.get('id')
    const workspaceId = searchParams.get('w')
    const campaignId = searchParams.get('c')
    const leadId = searchParams.get('l')

    if (!url) {
      return NextResponse.json({ error: 'Missing URL parameter' }, { status: 400 })
    }

    if (emailId && workspaceId) {
      // Log click event
      const supabase = await createClient()
      await supabase.from('email_events').insert({
        workspace_id: workspaceId,
        campaign_id: campaignId,
        lead_id: leadId,
        event_type: 'clicked',
        email_id: emailId,
        metadata: {
          url,
          user_agent: request.headers.get('user-agent'),
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        },
      })
    }

    // Redirect to the actual URL
    return NextResponse.redirect(url, { status: 302 })
  } catch (error) {
    console.error('Click tracking error:', error)
    // Still redirect even if tracking fails
    const url = request.nextUrl.searchParams.get('url')
    if (url) {
      return NextResponse.redirect(url, { status: 302 })
    }
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}