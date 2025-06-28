import { NextRequest, NextResponse } from 'next/server'
import { referralService } from '@/lib/growth/referral-service'

// POST /api/growth/referrals/click - Track referral click (public endpoint)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { referral_code, utm_source, utm_medium, utm_campaign } = body

    if (!referral_code) {
      return NextResponse.json({ 
        error: 'referral_code is required' 
      }, { status: 400 })
    }

    // Get request metadata
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Track the click
    const result = await referralService.trackReferralClick({
      referral_code,
      utm_source,
      utm_medium,
      utm_campaign,
      ip_address: ip,
      user_agent: userAgent
    })

    if (!result.success) {
      return NextResponse.json({ 
        error: result.error || 'Invalid referral code' 
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'Click tracked successfully',
      referral_code_id: result.referral_code_id
    })

  } catch (error: any) {
    console.error('Track referral click API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/growth/referrals/click - Redirect with click tracking
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const referralCode = searchParams.get('code')
    const redirectUrl = searchParams.get('redirect') || process.env.NEXT_PUBLIC_APP_URL || 'https://coldcopy.cc'
    
    if (!referralCode) {
      return NextResponse.redirect(redirectUrl)
    }

    // Extract UTM parameters
    const utmSource = searchParams.get('utm_source')
    const utmMedium = searchParams.get('utm_medium')
    const utmCampaign = searchParams.get('utm_campaign')

    // Get request metadata
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Track the click (don't await to avoid delay)
    referralService.trackReferralClick({
      referral_code: referralCode,
      utm_source: utmSource || undefined,
      utm_medium: utmMedium || undefined,
      utm_campaign: utmCampaign || undefined,
      ip_address: ip,
      user_agent: userAgent
    }).catch(error => {
      console.error('Error tracking referral click:', error)
    })

    // Construct redirect URL with referral info
    const redirectUrlObj = new URL(redirectUrl)
    redirectUrlObj.searchParams.set('ref', referralCode)
    
    if (utmSource) redirectUrlObj.searchParams.set('utm_source', utmSource)
    if (utmMedium) redirectUrlObj.searchParams.set('utm_medium', utmMedium)
    if (utmCampaign) redirectUrlObj.searchParams.set('utm_campaign', utmCampaign)

    return NextResponse.redirect(redirectUrlObj.toString())

  } catch (error: any) {
    console.error('Referral redirect error:', error)
    // Fallback to redirect without tracking
    const redirectUrl = new URL(request.url).searchParams.get('redirect') || 
                        process.env.NEXT_PUBLIC_APP_URL || 
                        'https://coldcopy.cc'
    return NextResponse.redirect(redirectUrl)
  }
}