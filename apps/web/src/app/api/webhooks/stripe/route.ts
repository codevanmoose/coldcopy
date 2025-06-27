import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe/client'
import { createClient } from '@/lib/supabase/server'
import { handleBillingWebhook } from '@/lib/billing/webhook-handler'
import type Stripe from 'stripe'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')!
  
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  try {
    // Handle billing-related webhooks
    const billingEventTypes = [
      'customer.created',
      'customer.updated',
      'customer.deleted',
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'customer.subscription.trial_will_end',
      'invoice.created',
      'invoice.finalized',
      'invoice.payment_succeeded',
      'invoice.payment_failed',
      'invoice.payment_action_required',
      'payment_method.attached',
      'payment_method.detached',
      'payment_method.updated',
      'payment_intent.succeeded',
      'payment_intent.payment_failed',
      'charge.refunded'
    ]

    if (billingEventTypes.includes(event.type)) {
      const result = await handleBillingWebhook(event)
      
      if (!result.success) {
        console.error('Billing webhook handler error:', result.error)
        return NextResponse.json(
          { error: result.error?.message || 'Webhook handler failed' },
          { status: 500 }
        )
      }

      return NextResponse.json({ received: true })
    }

    // Handle token purchase webhooks (existing logic)
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        const { workspace_id, user_id, tokens } = paymentIntent.metadata

        // Only handle token purchases here, not subscription payments
        if (!tokens) {
          break
        }

        if (!workspace_id || !user_id) {
          console.error('Missing metadata in payment intent')
          break
        }

        // Update purchase record
        const { data: purchase, error: purchaseError } = await supabase
          .from('token_purchases')
          .update({
            status: 'succeeded',
            completed_at: new Date().toISOString(),
            stripe_charge_id: paymentIntent.latest_charge as string,
          })
          .eq('stripe_payment_intent_id', paymentIntent.id)
          .select()
          .single()

        if (purchaseError || !purchase) {
          console.error('Failed to update purchase:', purchaseError)
          break
        }

        // Add tokens to workspace
        const { error: balanceError } = await supabase
          .rpc('add_ai_tokens', {
            p_workspace_id: workspace_id,
            p_tokens_to_add: parseInt(tokens),
          })

        if (balanceError) {
          console.error('Failed to add tokens:', balanceError)
          break
        }

        // Record transaction
        await supabase.rpc('record_token_transaction', {
          p_workspace_id: workspace_id,
          p_user_id: user_id,
          p_type: 'purchase',
          p_amount: parseInt(tokens),
          p_description: `Purchased ${parseInt(tokens).toLocaleString()} tokens`,
          p_reference_type: 'purchase',
          p_reference_id: purchase.id,
          p_metadata: {
            stripe_payment_intent_id: paymentIntent.id,
            amount_paid: paymentIntent.amount,
            currency: paymentIntent.currency,
          },
        })

        console.log(`Tokens added successfully for workspace ${workspace_id}`)
        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        
        // Only handle token purchases here
        if (!paymentIntent.metadata.tokens) {
          break
        }
        
        // Update purchase record
        await supabase
          .from('token_purchases')
          .update({
            status: 'failed',
            metadata: {
              failure_code: paymentIntent.last_payment_error?.code,
              failure_message: paymentIntent.last_payment_error?.message,
            },
          })
          .eq('stripe_payment_intent_id', paymentIntent.id)

        console.log(`Payment failed for payment intent ${paymentIntent.id}`)
        break
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
        const { workspace_id, user_id, tokens } = charge.metadata

        // Only handle token purchase refunds here
        if (!tokens) {
          break
        }

        if (!workspace_id) {
          console.error('Missing metadata in charge')
          break
        }

        // Find the original purchase
        const { data: purchase } = await supabase
          .from('token_purchases')
          .select('*')
          .eq('stripe_charge_id', charge.id)
          .single()

        if (!purchase) {
          console.error('Purchase not found for charge:', charge.id)
          break
        }

        // Update purchase status
        await supabase
          .from('token_purchases')
          .update({
            status: 'refunded',
          })
          .eq('id', purchase.id)

        // Deduct tokens from workspace
        const tokensToRemove = parseInt(tokens)
        const { data: currentWorkspace } = await supabase
          .from('workspaces')
          .select('ai_tokens_balance')
          .eq('id', workspace_id)
          .single()

        if (currentWorkspace) {
          await supabase
            .from('workspaces')
            .update({
              ai_tokens_balance: Math.max(0, currentWorkspace.ai_tokens_balance - tokensToRemove),
            })
            .eq('id', workspace_id)
        }

        // Record refund transaction
        await supabase.rpc('record_token_transaction', {
          p_workspace_id: workspace_id,
          p_user_id: user_id || purchase.user_id,
          p_type: 'refund',
          p_amount: -tokensToRemove,
          p_description: `Refunded ${tokensToRemove.toLocaleString()} tokens`,
          p_reference_type: 'purchase',
          p_reference_id: purchase.id,
          p_metadata: {
            stripe_charge_id: charge.id,
            refund_amount: charge.amount_refunded,
          },
        })

        console.log(`Tokens refunded for workspace ${workspace_id}`)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook handler error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}