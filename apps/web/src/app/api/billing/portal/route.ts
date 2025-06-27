import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { StripeService } from '@/lib/billing/stripe-service'
import { 
  BillingErrorCode,
  type CreatePortalSessionRequest 
} from '@/lib/billing/types'

const stripeService = new StripeService()

// POST /api/billing/portal - Create customer portal session
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

    const body: CreatePortalSessionRequest = await request.json()
    
    // Validate request
    if (!body.returnUrl) {
      return NextResponse.json(
        { error: 'Return URL required' },
        { status: 400 }
      )
    }

    // Create portal session
    const session = await stripeService.createPortalSession({
      workspaceId,
      ...body
    })
    
    return NextResponse.json(session)
  } catch (error: any) {
    console.error('Error creating portal session:', error)
    
    return NextResponse.json(
      { 
        error: error.message || 'Internal server error',
        code: error.code || BillingErrorCode.UNKNOWN_ERROR
      },
      { status: error.statusCode || 500 }
    )
  }
}