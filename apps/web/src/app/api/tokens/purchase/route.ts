import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createPaymentIntent, createOrUpdateCustomer } from '@/lib/stripe/client'
import { z } from 'zod'

const purchaseSchema = z.object({
  packageId: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's workspace
    const { data: dbUser, error: userError } = await supabase
      .from('users')
      .select('*, workspace:workspaces(*)')
      .eq('id', user.id)
      .single()

    if (userError || !dbUser || !dbUser.workspace) {
      return NextResponse.json({ error: 'User workspace not found' }, { status: 404 })
    }

    // Only workspace admins can purchase tokens
    if (!['workspace_admin', 'super_admin'].includes(dbUser.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Parse request body
    const body = await request.json()
    const { packageId } = purchaseSchema.parse(body)

    // Get token package details
    const { data: tokenPackage, error: packageError } = await supabase
      .from('token_packages')
      .select('*')
      .eq('id', packageId)
      .eq('is_active', true)
      .single()

    if (packageError || !tokenPackage) {
      return NextResponse.json({ error: 'Token package not found' }, { status: 404 })
    }

    // Create or update Stripe customer
    const customerResult = await createOrUpdateCustomer(
      user.email!,
      {
        workspace_id: dbUser.workspace.id,
        workspace_name: dbUser.workspace.name,
        user_id: user.id,
      }
    )

    if (!customerResult.success) {
      return NextResponse.json(
        { error: customerResult.error || 'Failed to create customer' },
        { status: 500 }
      )
    }

    // Create payment intent
    const paymentResult = await createPaymentIntent({
      amount: tokenPackage.price_cents,
      currency: tokenPackage.currency || 'usd',
      customerId: customerResult.customerId,
      description: `${tokenPackage.tokens.toLocaleString()} AI tokens - ${tokenPackage.name}`,
      metadata: {
        workspace_id: dbUser.workspace.id,
        user_id: user.id,
        package_id: tokenPackage.id,
        tokens: tokenPackage.tokens.toString(),
      },
    })

    if (!paymentResult.success) {
      return NextResponse.json(
        { error: paymentResult.error || 'Failed to create payment intent' },
        { status: 500 }
      )
    }

    // Create pending purchase record
    const { data: purchase, error: purchaseError } = await supabase
      .from('token_purchases')
      .insert({
        workspace_id: dbUser.workspace.id,
        user_id: user.id,
        package_id: tokenPackage.id,
        tokens: tokenPackage.tokens,
        price_cents: tokenPackage.price_cents,
        currency: tokenPackage.currency || 'usd',
        stripe_payment_intent_id: paymentResult.paymentIntentId,
        status: 'pending',
        metadata: {
          package_name: tokenPackage.name,
          customer_id: customerResult.customerId,
        },
      })
      .select()
      .single()

    if (purchaseError) {
      console.error('Purchase record error:', purchaseError)
      return NextResponse.json(
        { error: 'Failed to create purchase record' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      clientSecret: paymentResult.clientSecret,
      purchaseId: purchase.id,
      tokens: tokenPackage.tokens,
      amount: tokenPackage.price_cents,
    })
  } catch (error) {
    console.error('Token purchase error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}