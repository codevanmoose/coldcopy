import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { retrievePaymentIntent } from '@/lib/stripe/client'
import { z } from 'zod'

const confirmSchema = z.object({
  purchaseId: z.string().uuid(),
  paymentIntentId: z.string(),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { purchaseId, paymentIntentId } = confirmSchema.parse(body)

    // Get purchase record
    const { data: purchase, error: purchaseError } = await supabase
      .from('token_purchases')
      .select('*, workspace:workspaces(*)')
      .eq('id', purchaseId)
      .eq('stripe_payment_intent_id', paymentIntentId)
      .single()

    if (purchaseError || !purchase) {
      return NextResponse.json({ error: 'Purchase not found' }, { status: 404 })
    }

    // Verify user has access to this purchase
    const { data: dbUser } = await supabase
      .from('users')
      .select('workspace_id')
      .eq('id', user.id)
      .single()

    if (!dbUser || dbUser.workspace_id !== purchase.workspace_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Check if already processed
    if (purchase.status === 'succeeded') {
      return NextResponse.json({
        success: true,
        message: 'Purchase already completed',
        newBalance: purchase.workspace.ai_tokens_balance,
      })
    }

    // Retrieve payment intent from Stripe
    const paymentResult = await retrievePaymentIntent(paymentIntentId)
    if (!paymentResult.success || !paymentResult.paymentIntent) {
      return NextResponse.json(
        { error: 'Failed to verify payment' },
        { status: 500 }
      )
    }

    const { paymentIntent } = paymentResult

    // Verify payment succeeded
    if (paymentIntent.status !== 'succeeded') {
      return NextResponse.json(
        { error: `Payment ${paymentIntent.status}` },
        { status: 400 }
      )
    }

    // Start transaction to update purchase and add tokens
    const { error: updateError } = await supabase.rpc('begin')
    
    if (!updateError) {
      try {
        // Update purchase status
        const { error: purchaseUpdateError } = await supabase
          .from('token_purchases')
          .update({
            status: 'succeeded',
            completed_at: new Date().toISOString(),
            stripe_charge_id: paymentIntent.latest_charge,
            payment_method: paymentIntent.payment_method,
          })
          .eq('id', purchaseId)

        if (purchaseUpdateError) throw purchaseUpdateError

        // Add tokens to workspace balance
        const { data: newBalance, error: balanceError } = await supabase
          .rpc('add_ai_tokens', {
            p_workspace_id: purchase.workspace_id,
            p_tokens_to_add: purchase.tokens,
          })

        if (balanceError) throw balanceError

        // Record transaction
        const { error: transactionError } = await supabase
          .rpc('record_token_transaction', {
            p_workspace_id: purchase.workspace_id,
            p_user_id: user.id,
            p_type: 'purchase',
            p_amount: purchase.tokens,
            p_description: `Purchased ${purchase.tokens.toLocaleString()} tokens`,
            p_reference_type: 'purchase',
            p_reference_id: purchaseId,
            p_metadata: {
              package_id: purchase.package_id,
              price_cents: purchase.price_cents,
              stripe_payment_intent_id: paymentIntentId,
            },
          })

        if (transactionError) throw transactionError

        // Commit transaction
        await supabase.rpc('commit')

        return NextResponse.json({
          success: true,
          message: 'Tokens added successfully',
          tokensAdded: purchase.tokens,
          newBalance: newBalance,
        })
      } catch (error) {
        // Rollback on error
        await supabase.rpc('rollback')
        throw error
      }
    }

    return NextResponse.json(
      { error: 'Failed to process purchase' },
      { status: 500 }
    )
  } catch (error) {
    console.error('Token confirmation error:', error)
    
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