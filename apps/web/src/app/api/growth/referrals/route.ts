import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { referralService } from '@/lib/growth/referral-service'

// GET /api/growth/referrals - Get referrals for user or workspace
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'user' // 'user' or 'workspace'
    const userId = searchParams.get('user_id') || user.id

    // Get user's workspace
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()

    if (!profile?.workspace_id) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 400 })
    }

    if (type === 'user') {
      // Get referrals for specific user
      const referrals = await referralService.getUserReferrals(userId)
      return NextResponse.json({ success: true, referrals })
    } else {
      // Get all referrals for workspace (admin only)
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('user_id', user.id)
        .single()

      if (!['workspace_admin', 'super_admin'].includes(userProfile?.role)) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
      }

      const { data: workspaceReferrals, error } = await supabase
        .from('referrals')
        .select(`
          *,
          referral_codes (
            code,
            user_id
          ),
          referral_programs (
            name,
            referrer_reward_value,
            referrer_reward_unit
          )
        `)
        .eq('workspace_id', profile.workspace_id)
        .order('referred_at', { ascending: false })
        .limit(100)

      if (error) {
        return NextResponse.json({ error: 'Failed to fetch referrals' }, { status: 500 })
      }

      return NextResponse.json({ success: true, referrals: workspaceReferrals })
    }

  } catch (error: any) {
    console.error('Get referrals API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/growth/referrals - Create a new referral
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      referral_code,
      referee_email,
      referee_name,
      referee_user_id,
      referee_workspace_id,
      referral_source
    } = body

    if (!referral_code || !referee_email) {
      return NextResponse.json({ 
        error: 'referral_code and referee_email are required' 
      }, { status: 400 })
    }

    // Process the referral signup
    const result = await referralService.processReferralSignup({
      referral_code,
      referee_email,
      referee_name,
      referee_user_id,
      referee_workspace_id,
      referral_source: referral_source || 'direct'
    })

    if (!result.success) {
      return NextResponse.json({ 
        error: result.error || 'Failed to process referral' 
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'Referral processed successfully',
      referral_id: result.referral_id
    })

  } catch (error: any) {
    console.error('Create referral API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/growth/referrals - Update referral status
export async function PUT(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { referral_id, status, conversion_value, create_rewards } = body

    if (!referral_id || !status) {
      return NextResponse.json({ 
        error: 'referral_id and status are required' 
      }, { status: 400 })
    }

    // Check if user has permission to update this referral
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('workspace_id, role')
      .eq('user_id', user.id)
      .single()

    if (!profile?.workspace_id) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 400 })
    }

    // Verify referral belongs to workspace
    const { data: referral } = await supabase
      .from('referrals')
      .select('workspace_id, referrer_user_id')
      .eq('id', referral_id)
      .single()

    if (!referral) {
      return NextResponse.json({ error: 'Referral not found' }, { status: 404 })
    }

    // Check permissions: must be referrer or workspace admin
    const isReferrer = referral.referrer_user_id === user.id
    const isAdmin = ['workspace_admin', 'super_admin'].includes(profile.role)
    
    if (referral.workspace_id !== profile.workspace_id || (!isReferrer && !isAdmin)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    if (status === 'converted') {
      const result = await referralService.markReferralConverted({
        referral_id,
        conversion_value: conversion_value || 0,
        create_rewards: create_rewards || false
      })

      if (!result.success) {
        return NextResponse.json({ 
          error: result.error || 'Failed to mark as converted' 
        }, { status: 400 })
      }
    } else {
      // Update status directly
      const { error } = await supabase
        .from('referrals')
        .update({ status })
        .eq('id', referral_id)

      if (error) {
        return NextResponse.json({ error: 'Failed to update referral' }, { status: 500 })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Referral updated successfully'
    })

  } catch (error: any) {
    console.error('Update referral API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}