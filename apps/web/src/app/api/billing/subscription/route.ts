import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { StripeService } from '@/lib/billing/stripe-service'
import { 
  BillingErrorCode,
  type CreateSubscriptionRequest,
  type UpdateSubscriptionRequest,
  type CancelSubscriptionRequest 
} from '@/lib/billing/types'

const stripeService = new StripeService()

// GET /api/billing/subscription - Get billing summary
export async function GET(request: NextRequest) {
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

    // Get billing summary
    const summary = await stripeService.getBillingSummary(workspaceId)
    
    return NextResponse.json(summary)
  } catch (error: any) {
    console.error('Error fetching billing summary:', error)
    
    return NextResponse.json(
      { 
        error: error.message || 'Internal server error',
        code: error.code || BillingErrorCode.UNKNOWN_ERROR
      },
      { status: error.statusCode || 500 }
    )
  }
}

// POST /api/billing/subscription - Create subscription
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

    const body: CreateSubscriptionRequest = await request.json()
    
    // Validate request
    if (!body.planSlug) {
      return NextResponse.json(
        { error: 'Plan slug required' },
        { status: 400 }
      )
    }

    // Create subscription
    const result = await stripeService.createSubscription({
      workspaceId,
      ...body
    })
    
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error creating subscription:', error)
    
    return NextResponse.json(
      { 
        error: error.message || 'Internal server error',
        code: error.code || BillingErrorCode.UNKNOWN_ERROR
      },
      { status: error.statusCode || 500 }
    )
  }
}

// PATCH /api/billing/subscription - Update subscription
export async function PATCH(request: NextRequest) {
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

    const body: UpdateSubscriptionRequest = await request.json()

    // Get current subscription
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('workspace_id', workspaceId)
      .single()

    if (subError || !subscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      )
    }

    // Update subscription
    const result = await stripeService.updateSubscription({
      subscriptionId: subscription.id,
      ...body
    })
    
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error updating subscription:', error)
    
    return NextResponse.json(
      { 
        error: error.message || 'Internal server error',
        code: error.code || BillingErrorCode.UNKNOWN_ERROR
      },
      { status: error.statusCode || 500 }
    )
  }
}

// DELETE /api/billing/subscription - Cancel subscription
export async function DELETE(request: NextRequest) {
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

    const body: CancelSubscriptionRequest = await request.json()

    // Get current subscription
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('workspace_id', workspaceId)
      .single()

    if (subError || !subscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      )
    }

    // Cancel subscription
    const result = await stripeService.cancelSubscription({
      subscriptionId: subscription.id,
      ...body
    })
    
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error canceling subscription:', error)
    
    return NextResponse.json(
      { 
        error: error.message || 'Internal server error',
        code: error.code || BillingErrorCode.UNKNOWN_ERROR
      },
      { status: error.statusCode || 500 }
    )
  }
}