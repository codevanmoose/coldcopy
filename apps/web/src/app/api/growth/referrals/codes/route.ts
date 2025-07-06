import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { referralService } from '@/lib/growth/referral-service'

// GET /api/growth/referrals/codes - Get referral codes for user
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id') || user.id

    // Get referral codes for user
    const referralCodes = await referralService.getUserReferralCodes(userId)

    return NextResponse.json({
      success: true,
      referral_codes: referralCodes
    })

  } catch (error: any) {
    console.error('Get referral codes API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/growth/referrals/codes - Generate a new referral code
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { program_id, prefix } = body

    if (!program_id) {
      return NextResponse.json({ 
        error: 'program_id is required' 
      }, { status: 400 })
    }

    // Get user's workspace
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('workspace_id')
      .eq('id', user.id)
      .single()

    if (!profile?.workspace_id) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 400 })
    }

    // Verify program exists and belongs to workspace
    const { data: program } = await supabase
      .from('referral_programs')
      .select('id, workspace_id, is_active')
      .eq('id', program_id)
      .eq('workspace_id', profile.workspace_id)
      .single()

    if (!program) {
      return NextResponse.json({ error: 'Referral program not found' }, { status: 404 })
    }

    if (!program.is_active) {
      return NextResponse.json({ error: 'Referral program is not active' }, { status: 400 })
    }

    // Generate referral code
    const result = await referralService.generateReferralCode({
      workspace_id: profile.workspace_id,
      user_id: user.id,
      program_id,
      prefix
    })

    if (!result.success) {
      return NextResponse.json({ 
        error: result.error || 'Failed to generate referral code' 
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'Referral code generated successfully',
      code: result.code,
      referral_code: result.referral_code
    })

  } catch (error: any) {
    console.error('Generate referral code API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/growth/referrals/codes - Update referral code
export async function PUT(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { code_id, custom_landing_page, is_active } = body

    if (!code_id) {
      return NextResponse.json({ 
        error: 'code_id is required' 
      }, { status: 400 })
    }

    // Verify user owns this referral code
    const { data: referralCode } = await supabase
      .from('referral_codes')
      .select('id, user_id')
      .eq('id', code_id)
      .eq('user_id', user.id)
      .single()

    if (!referralCode) {
      return NextResponse.json({ error: 'Referral code not found' }, { status: 404 })
    }

    // Update referral code
    const updates: any = {}
    if (custom_landing_page !== undefined) updates.custom_landing_page = custom_landing_page
    if (is_active !== undefined) updates.is_active = is_active

    const { error } = await supabase
      .from('referral_codes')
      .update(updates)
      .eq('id', code_id)

    if (error) {
      return NextResponse.json({ error: 'Failed to update referral code' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Referral code updated successfully'
    })

  } catch (error: any) {
    console.error('Update referral code API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}