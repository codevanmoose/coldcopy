import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { addDays, isAfter, isBefore, differenceInDays } from 'date-fns'
import { BillingNotificationType, SubscriptionStatus } from '@/lib/billing/types'

// Initialize Supabase client with service role for admin operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
)

// Trial configuration
const TRIAL_DURATION_DAYS = 14
const TRIAL_WARNING_DAYS = [7, 3, 1] // Days before trial end to send warnings
const GRACE_PERIOD_DAYS = 3 // Extra days after trial ends before restricting access

interface TrialCheckResult {
  processedCount: number
  expiredCount: number
  warningsSent: number
  errors: string[]
}

/**
 * GET /api/billing/trial - Check and update trial statuses
 * This endpoint should be called regularly (e.g., via cron job) to manage trials
 */
export async function GET(request: NextRequest) {
  try {
    // Verify this is being called by an authorized source (e.g., cron job)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await processTrials()
    
    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Trial processing error:', error)
    return NextResponse.json(
      { error: 'Failed to process trials' },
      { status: 500 }
    )
  }
}

/**
 * Process all active trials
 */
async function processTrials(): Promise<TrialCheckResult> {
  const result: TrialCheckResult = {
    processedCount: 0,
    expiredCount: 0,
    warningsSent: 0,
    errors: [],
  }

  try {
    // Get all trialing subscriptions
    const { data: trialSubscriptions, error } = await supabase
      .from('subscriptions')
      .select(`
        *,
        workspace:workspaces!inner(
          id,
          name,
          owner_id
        )
      `)
      .eq('status', SubscriptionStatus.TRIALING)
      .not('trial_end', 'is', null)

    if (error) throw error

    if (!trialSubscriptions || trialSubscriptions.length === 0) {
      return result
    }

    result.processedCount = trialSubscriptions.length

    // Process each trial subscription
    await Promise.all(
      trialSubscriptions.map(async (subscription) => {
        try {
          await processTrialSubscription(subscription, result)
        } catch (error) {
          console.error(`Error processing subscription ${subscription.id}:`, error)
          result.errors.push(`Subscription ${subscription.id}: ${error}`)
        }
      })
    )

    return result
  } catch (error) {
    console.error('Error fetching trial subscriptions:', error)
    result.errors.push(`Global error: ${error}`)
    return result
  }
}

/**
 * Process a single trial subscription
 */
async function processTrialSubscription(
  subscription: any,
  result: TrialCheckResult
): Promise<void> {
  const now = new Date()
  const trialEnd = new Date(subscription.trial_end)
  const daysRemaining = differenceInDays(trialEnd, now)
  const gracePeriodEnd = addDays(trialEnd, GRACE_PERIOD_DAYS)

  // Check if trial has expired
  if (isAfter(now, trialEnd)) {
    // Check if we're still in grace period
    if (isBefore(now, gracePeriodEnd)) {
      // Send grace period notification if not already sent
      await sendTrialNotification(
        subscription,
        BillingNotificationType.TRIAL_ENDED,
        {
          gracePeriodDays: differenceInDays(gracePeriodEnd, now),
          inGracePeriod: true,
        }
      )
    } else {
      // Grace period has ended, update subscription status
      await expireTrialSubscription(subscription)
      result.expiredCount++
    }
  } else {
    // Trial is still active, check if we need to send warnings
    if (TRIAL_WARNING_DAYS.includes(daysRemaining)) {
      const sent = await sendTrialNotification(
        subscription,
        BillingNotificationType.TRIAL_ENDING,
        { daysRemaining }
      )
      if (sent) result.warningsSent++
    }
  }
}

/**
 * Expire a trial subscription
 */
async function expireTrialSubscription(subscription: any): Promise<void> {
  // Update subscription status to canceled
  const { error: updateError } = await supabase
    .from('subscriptions')
    .update({
      status: SubscriptionStatus.CANCELED,
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscription.id)

  if (updateError) throw updateError

  // Create billing event
  await supabase.from('billing_events').insert({
    workspace_id: subscription.workspace_id,
    event_type: 'subscription.deleted',
    data: {
      subscription_id: subscription.id,
      reason: 'trial_expired',
      trial_end: subscription.trial_end,
    },
  })

  // Send trial expired notification
  await sendTrialNotification(
    subscription,
    BillingNotificationType.TRIAL_ENDED,
    { expired: true }
  )

  // Send email notification
  await sendTrialExpiredEmail(subscription)
}

/**
 * Send trial notification
 */
async function sendTrialNotification(
  subscription: any,
  type: BillingNotificationType,
  data?: Record<string, any>
): Promise<boolean> {
  try {
    // Check if notification was already sent today
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { data: existingNotification } = await supabase
      .from('billing_notifications')
      .select('id')
      .eq('workspace_id', subscription.workspace_id)
      .eq('type', type)
      .gte('created_at', today.toISOString())
      .single()

    if (existingNotification) {
      return false // Already sent today
    }

    // Create notification
    let title = ''
    let message = ''

    switch (type) {
      case BillingNotificationType.TRIAL_ENDING:
        const days = data?.daysRemaining || 0
        title = `Trial ending ${days === 1 ? 'tomorrow' : `in ${days} days`}`
        message = `Your trial will end soon. Upgrade now to keep access to all features.`
        break
      case BillingNotificationType.TRIAL_ENDED:
        if (data?.inGracePeriod) {
          title = 'Trial ended - Grace period active'
          message = `Your trial has ended but you have ${data.gracePeriodDays} days remaining to upgrade.`
        } else if (data?.expired) {
          title = 'Trial expired'
          message = 'Your trial has expired. Upgrade to regain access to all features.'
        } else {
          title = 'Trial ended'
          message = 'Your trial has ended. Upgrade to continue using all features.'
        }
        break
    }

    const { error } = await supabase.from('billing_notifications').insert({
      workspace_id: subscription.workspace_id,
      type,
      title,
      message,
      data: data || {},
      read: false,
    })

    if (error) throw error

    return true
  } catch (error) {
    console.error('Error sending trial notification:', error)
    return false
  }
}

/**
 * Send trial expired email
 */
async function sendTrialExpiredEmail(subscription: any): Promise<void> {
  try {
    // Get user email
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', subscription.workspace.owner_id)
      .single()

    if (!profile?.email) return

    // Send email via your email service
    const emailData = {
      to: profile.email,
      subject: 'Your ColdCopy trial has expired',
      template: 'trial-expired',
      data: {
        name: profile.full_name || 'there',
        workspaceName: subscription.workspace.name,
        trialEndDate: new Date(subscription.trial_end).toLocaleDateString(),
        upgradeUrl: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`,
      },
    }

    // Send email (implement your email sending logic)
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/email/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.INTERNAL_API_KEY}`,
      },
      body: JSON.stringify(emailData),
    })
  } catch (error) {
    console.error('Error sending trial expired email:', error)
  }
}

/**
 * POST /api/billing/trial/extend - Extend a trial (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const { workspaceId, days = 7 } = await request.json()

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID required' },
        { status: 400 }
      )
    }

    // Get current subscription
    const { data: subscription, error: fetchError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('status', SubscriptionStatus.TRIALING)
      .single()

    if (fetchError || !subscription) {
      return NextResponse.json(
        { error: 'No active trial found' },
        { status: 404 }
      )
    }

    // Extend trial
    const currentTrialEnd = new Date(subscription.trial_end)
    const newTrialEnd = addDays(currentTrialEnd, days)

    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({
        trial_end: newTrialEnd.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscription.id)

    if (updateError) throw updateError

    // Create billing event
    await supabase.from('billing_events').insert({
      workspace_id: workspaceId,
      event_type: 'subscription.updated',
      data: {
        subscription_id: subscription.id,
        action: 'trial_extended',
        extension_days: days,
        old_trial_end: subscription.trial_end,
        new_trial_end: newTrialEnd.toISOString(),
      },
    })

    return NextResponse.json({
      success: true,
      subscription: {
        ...subscription,
        trial_end: newTrialEnd.toISOString(),
      },
    })
  } catch (error) {
    console.error('Error extending trial:', error)
    return NextResponse.json(
      { error: 'Failed to extend trial' },
      { status: 500 }
    )
  }
}