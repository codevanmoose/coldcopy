import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 1x1 transparent pixel
const TRACKING_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
)

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const emailId = searchParams.get('id')
    const workspaceId = searchParams.get('w')
    const campaignId = searchParams.get('c')
    const leadId = searchParams.get('l')

    if (!emailId || !workspaceId) {
      return new NextResponse(TRACKING_PIXEL, {
        headers: {
          'Content-Type': 'image/gif',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      })
    }

    // Log email open event
    const supabase = await createClient()
    await supabase.from('email_events').insert({
      workspace_id: workspaceId,
      campaign_id: campaignId,
      lead_id: leadId,
      event_type: 'opened',
      email_id: emailId,
      metadata: {
        user_agent: request.headers.get('user-agent'),
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      },
    })

    // Return tracking pixel
    return new NextResponse(TRACKING_PIXEL, {
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error) {
    console.error('Email tracking error:', error)
    // Still return the pixel even if tracking fails
    return new NextResponse(TRACKING_PIXEL, {
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  }
}