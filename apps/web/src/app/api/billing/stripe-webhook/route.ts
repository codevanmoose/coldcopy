import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripeBilling } from '@/lib/billing/stripe-billing'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = headers().get('stripe-signature')

    if (!signature) {
      return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
    }

    // Verify the webhook signature and construct the event
    const { event, handled, error } = await stripeBilling.handleWebhook(body, signature)

    if (error) {
      console.error('Webhook signature verification failed:', error)
      return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 })
    }

    const supabase = createServerComponentClient({ cookies })

    // Handle specific events
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object, supabase)
        break
      
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object, supabase)
        break
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object, supabase)
        break
      
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object, supabase)
        break
      
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object, supabase)
        break
      
      case 'customer.created':
        await handleCustomerCreated(event.data.object, supabase)
        break
      
      case 'usage_record.created':
        await handleUsageRecordCreated(event.data.object, supabase)
        break
      
      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ 
      received: true, 
      handled, 
      event_type: event.type 
    })

  } catch (error: any) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}

// Handle subscription creation
async function handleSubscriptionCreated(subscription: any, supabase: any) {
  try {
    const customerId = subscription.customer
    const workspaceId = subscription.metadata?.workspace_id

    if (!workspaceId) {
      console.error('No workspace_id in subscription metadata')
      return
    }

    // Create billing event
    await supabase
      .from('billing_events')
      .insert({
        workspace_id: workspaceId,
        event_type: 'subscription_created',
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        amount: subscription.items.data[0]?.price?.unit_amount || 0,
        currency: subscription.currency,
        status: subscription.status,
        event_data: subscription,
        processed_at: new Date().toISOString()
      })

    // Update workspace subscription status
    await supabase
      .from('workspaces')
      .update({
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        subscription_status: subscription.status,
        subscription_plan: subscription.items.data[0]?.price?.nickname || 'unknown',
        trial_ends_at: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', workspaceId)

    console.log('Subscription created for workspace:', workspaceId)
  } catch (error) {
    console.error('Error handling subscription created:', error)
  }
}

// Handle subscription updates
async function handleSubscriptionUpdated(subscription: any, supabase: any) {
  try {
    const workspaceId = subscription.metadata?.workspace_id

    if (!workspaceId) {
      console.error('No workspace_id in subscription metadata')
      return
    }

    // Create billing event
    await supabase
      .from('billing_events')
      .insert({
        workspace_id: workspaceId,
        event_type: 'subscription_updated',
        stripe_customer_id: subscription.customer,
        stripe_subscription_id: subscription.id,
        amount: subscription.items.data[0]?.price?.unit_amount || 0,
        currency: subscription.currency,
        status: subscription.status,
        event_data: subscription,
        processed_at: new Date().toISOString()
      })

    // Update workspace subscription
    await supabase
      .from('workspaces')
      .update({
        subscription_status: subscription.status,
        subscription_plan: subscription.items.data[0]?.price?.nickname || 'unknown',
        trial_ends_at: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', workspaceId)

    console.log('Subscription updated for workspace:', workspaceId)
  } catch (error) {
    console.error('Error handling subscription updated:', error)
  }
}

// Handle subscription cancellation
async function handleSubscriptionDeleted(subscription: any, supabase: any) {
  try {
    const workspaceId = subscription.metadata?.workspace_id

    if (!workspaceId) {
      console.error('No workspace_id in subscription metadata')
      return
    }

    // Create billing event
    await supabase
      .from('billing_events')
      .insert({
        workspace_id: workspaceId,
        event_type: 'subscription_cancelled',
        stripe_customer_id: subscription.customer,
        stripe_subscription_id: subscription.id,
        status: 'cancelled',
        event_data: subscription,
        processed_at: new Date().toISOString()
      })

    // Update workspace to free plan
    await supabase
      .from('workspaces')
      .update({
        subscription_status: 'cancelled',
        subscription_plan: 'free',
        stripe_subscription_id: null,
        trial_ends_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', workspaceId)

    // Reset usage limits to free tier
    await supabase.rpc('reset_usage_limits_to_free', {
      p_workspace_id: workspaceId
    })

    console.log('Subscription cancelled for workspace:', workspaceId)
  } catch (error) {
    console.error('Error handling subscription deleted:', error)
  }
}

// Handle successful payments
async function handlePaymentSucceeded(invoice: any, supabase: any) {
  try {
    const customerId = invoice.customer
    const subscriptionId = invoice.subscription
    const workspaceId = invoice.metadata?.workspace_id

    if (!workspaceId) {
      // Try to get workspace_id from subscription metadata
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single()
      
      if (!workspace) {
        console.error('No workspace found for customer:', customerId)
        return
      }
    }

    // Create billing event
    await supabase
      .from('billing_events')
      .insert({
        workspace_id: workspaceId || workspace.id,
        event_type: 'payment_succeeded',
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        stripe_invoice_id: invoice.id,
        amount: invoice.amount_paid,
        currency: invoice.currency,
        status: 'paid',
        event_data: invoice,
        processed_at: new Date().toISOString()
      })

    // Update subscription status if it was past due
    if (subscriptionId) {
      await supabase
        .from('workspaces')
        .update({
          subscription_status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('stripe_subscription_id', subscriptionId)
    }

    console.log('Payment succeeded for invoice:', invoice.id)
  } catch (error) {
    console.error('Error handling payment succeeded:', error)
  }
}

// Handle failed payments
async function handlePaymentFailed(invoice: any, supabase: any) {
  try {
    const customerId = invoice.customer
    const subscriptionId = invoice.subscription

    // Get workspace
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('id, name, email')
      .eq('stripe_customer_id', customerId)
      .single()

    if (!workspace) {
      console.error('No workspace found for customer:', customerId)
      return
    }

    // Create billing event
    await supabase
      .from('billing_events')
      .insert({
        workspace_id: workspace.id,
        event_type: 'payment_failed',
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        stripe_invoice_id: invoice.id,
        amount: invoice.amount_due,
        currency: invoice.currency,
        status: 'failed',
        event_data: invoice,
        processed_at: new Date().toISOString()
      })

    // Update subscription status
    await supabase
      .from('workspaces')
      .update({
        subscription_status: 'past_due',
        updated_at: new Date().toISOString()
      })
      .eq('id', workspace.id)

    // TODO: Send payment failure notification email
    console.log('Payment failed for workspace:', workspace.id)
  } catch (error) {
    console.error('Error handling payment failed:', error)
  }
}

// Handle customer creation
async function handleCustomerCreated(customer: any, supabase: any) {
  try {
    const workspaceId = customer.metadata?.workspace_id

    if (!workspaceId) {
      console.log('Customer created without workspace_id metadata')
      return
    }

    // Update workspace with Stripe customer ID
    await supabase
      .from('workspaces')
      .update({
        stripe_customer_id: customer.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', workspaceId)

    console.log('Customer created and linked to workspace:', workspaceId)
  } catch (error) {
    console.error('Error handling customer created:', error)
  }
}

// Handle usage record creation
async function handleUsageRecordCreated(usageRecord: any, supabase: any) {
  try {
    // Get subscription item to find workspace
    const subscriptionItemId = usageRecord.subscription_item

    // This would require additional logic to map subscription items to workspaces
    // For now, we'll log the usage record
    console.log('Usage record created:', {
      subscription_item: subscriptionItemId,
      quantity: usageRecord.quantity,
      timestamp: usageRecord.timestamp
    })

    // TODO: Sync usage record with internal billing system
  } catch (error) {
    console.error('Error handling usage record created:', error)
  }
}