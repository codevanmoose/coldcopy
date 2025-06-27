import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { StripeService } from '@/lib/billing/stripe-service'
import { BillingErrorCode } from '@/lib/billing/types'

const stripeService = new StripeService()

// POST /api/billing/subscription/preview - Preview subscription change with proration
export async function POST(request: NextRequest) {
  try {
    const workspaceId = request.headers.get('x-workspace-id')
    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID required' },
        { status: 400 }
      )
    }

    const supabase = createClient()
    
    // Check auth
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { planSlug, isYearly } = await request.json()
    
    if (!planSlug) {
      return NextResponse.json(
        { error: 'Plan slug required' },
        { status: 400 }
      )
    }

    // Get current subscription
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select(`
        *,
        plan:subscription_plans(*)
      `)
      .eq('workspace_id', workspaceId)
      .single()

    if (!subscription) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 404 }
      )
    }

    // Get target plan
    const { data: targetPlan } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('slug', planSlug)
      .single()

    if (!targetPlan) {
      return NextResponse.json(
        { error: 'Invalid plan' },
        { status: 400 }
      )
    }

    // Calculate proration preview
    const preview = await stripeService.previewSubscriptionUpdate(
      subscription.stripe_subscription_id,
      {
        planSlug,
        isYearly
      }
    )
    
    return NextResponse.json(preview)
  } catch (error: any) {
    console.error('Error previewing subscription:', error)
    
    return NextResponse.json(
      { 
        error: error.message || 'Internal server error',
        code: error.code || BillingErrorCode.UNKNOWN_ERROR
      },
      { status: error.statusCode || 500 }
    )
  }
}