import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { StripeService } from '@/lib/billing/stripe-service'
import { 
  BillingErrorCode,
  type AddPaymentMethodRequest 
} from '@/lib/billing/types'

const stripeService = new StripeService()

// GET /api/billing/payment-methods - List payment methods
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

    // Get payment methods
    const paymentMethods = await stripeService.listPaymentMethods(workspaceId)
    
    return NextResponse.json({ paymentMethods })
  } catch (error: any) {
    console.error('Error listing payment methods:', error)
    
    return NextResponse.json(
      { 
        error: error.message || 'Internal server error',
        code: error.code || BillingErrorCode.UNKNOWN_ERROR
      },
      { status: error.statusCode || 500 }
    )
  }
}

// POST /api/billing/payment-methods - Add payment method
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

    const body: AddPaymentMethodRequest = await request.json()
    
    // Validate request
    if (!body.paymentMethodId) {
      return NextResponse.json(
        { error: 'Payment method ID required' },
        { status: 400 }
      )
    }

    // Add payment method
    const paymentMethod = await stripeService.addPaymentMethod({
      workspaceId,
      ...body
    })
    
    return NextResponse.json({ paymentMethod })
  } catch (error: any) {
    console.error('Error adding payment method:', error)
    
    return NextResponse.json(
      { 
        error: error.message || 'Internal server error',
        code: error.code || BillingErrorCode.UNKNOWN_ERROR
      },
      { status: error.statusCode || 500 }
    )
  }
}