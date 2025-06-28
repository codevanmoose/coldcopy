import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { stripeBilling } from '@/lib/billing/stripe-billing'
import { usageTracker } from '@/lib/billing/usage-tracker'

// POST /api/billing/sync-usage - Sync usage data to Stripe for billing
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { workspace_id, billing_period } = body

    // If no workspace_id provided, get from user profile
    let workspaceId = workspace_id
    if (!workspaceId) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('workspace_id')
        .eq('user_id', user.id)
        .single()

      if (!profile?.workspace_id) {
        return NextResponse.json({ error: 'No workspace found' }, { status: 400 })
      }
      workspaceId = profile.workspace_id
    }

    // Get workspace with billing info
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('id', workspaceId)
      .single()

    if (!workspace?.stripe_customer_id || !workspace?.stripe_subscription_id) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 400 })
    }

    // Get current month's usage if no period specified
    const currentDate = new Date()
    const period = billing_period || `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`

    // Get usage data from our system
    const periodStart = new Date(`${period}-01`)
    const periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0)

    const { data: usageData } = await supabase
      .from('usage_metrics')
      .select(`
        metric_type,
        provider,
        model_name,
        total_tokens,
        units_used,
        total_cost
      `)
      .eq('workspace_id', workspaceId)
      .gte('billing_period', periodStart.toISOString().split('T')[0])
      .lte('billing_period', periodEnd.toISOString().split('T')[0])

    if (!usageData || usageData.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No usage data found for the specified period',
        synced_records: 0
      })
    }

    // Get subscription items from Stripe
    const activeSubscription = await stripeBilling.getActiveSubscription(workspace.stripe_customer_id)
    if (!activeSubscription) {
      return NextResponse.json({ error: 'No active subscription found in Stripe' }, { status: 400 })
    }

    // Map metric types to subscription items
    const subscriptionItemMap = new Map()
    for (const item of activeSubscription.items.data) {
      const priceNickname = item.price.nickname?.toLowerCase()
      if (priceNickname?.includes('ai') || priceNickname?.includes('token')) {
        subscriptionItemMap.set('ai_tokens', item.id)
      } else if (priceNickname?.includes('email')) {
        subscriptionItemMap.set('emails_sent', item.id)
      } else if (priceNickname?.includes('lead') || priceNickname?.includes('enrich')) {
        subscriptionItemMap.set('leads_enriched', item.id)
      }
    }

    // Aggregate usage by metric type
    const aggregatedUsage = new Map()
    for (const record of usageData) {
      const key = record.metric_type
      const usage = record.total_tokens || record.units_used || 0
      
      if (aggregatedUsage.has(key)) {
        aggregatedUsage.set(key, aggregatedUsage.get(key) + usage)
      } else {
        aggregatedUsage.set(key, usage)
      }
    }

    // Sync usage to Stripe
    const usageRecords = []
    const syncResults = {
      successful: 0,
      failed: 0,
      errors: [] as Array<{ metric_type: string; error: string }>
    }

    for (const [metricType, totalUsage] of aggregatedUsage.entries()) {
      const subscriptionItemId = subscriptionItemMap.get(metricType)
      
      if (subscriptionItemId && totalUsage > 0) {
        usageRecords.push({
          subscriptionItemId,
          quantity: Math.round(totalUsage),
          timestamp: Math.floor(periodEnd.getTime() / 1000),
          action: 'set' as const
        })
      }
    }

    if (usageRecords.length > 0) {
      const batchResult = await stripeBilling.batchRecordUsage(usageRecords)
      
      syncResults.successful = batchResult.successful
      syncResults.failed = batchResult.failed
      syncResults.errors = batchResult.errors.map(err => ({
        metric_type: 'unknown',
        error: err.error
      }))

      // Create billing event for the sync
      await supabase
        .from('billing_events')
        .insert({
          workspace_id: workspaceId,
          event_type: 'usage_sync',
          stripe_customer_id: workspace.stripe_customer_id,
          stripe_subscription_id: workspace.stripe_subscription_id,
          amount: 0,
          currency: 'usd',
          status: syncResults.failed > 0 ? 'partial_failure' : 'success',
          event_data: {
            billing_period: period,
            usage_records: usageRecords,
            sync_results: syncResults
          },
          processed_at: new Date().toISOString()
        })
    }

    return NextResponse.json({
      success: true,
      message: 'Usage data synced to Stripe',
      billing_period: period,
      synced_records: syncResults.successful,
      failed_records: syncResults.failed,
      usage_breakdown: Object.fromEntries(aggregatedUsage),
      errors: syncResults.errors
    })

  } catch (error: any) {
    console.error('Sync usage API error:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to sync usage data' 
    }, { status: 500 })
  }
}

// GET /api/billing/sync-usage - Get usage sync status and history
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspace_id = searchParams.get('workspace_id')
    const limit = parseInt(searchParams.get('limit') || '20')

    // Get workspace
    let workspaceId = workspace_id
    if (!workspaceId) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('workspace_id')
        .eq('user_id', user.id)
        .single()

      if (!profile?.workspace_id) {
        return NextResponse.json({ error: 'No workspace found' }, { status: 400 })
      }
      workspaceId = profile.workspace_id
    }

    // Get recent usage sync events
    const { data: syncEvents, error } = await supabase
      .from('billing_events')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('event_type', 'usage_sync')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching sync events:', error)
      return NextResponse.json({ error: 'Failed to fetch sync history' }, { status: 500 })
    }

    // Get current month usage summary
    const currentUsage = await usageTracker.getCurrentMonthUsage(workspaceId)

    return NextResponse.json({
      success: true,
      sync_history: syncEvents || [],
      current_month_usage: currentUsage
    })

  } catch (error: any) {
    console.error('Get sync status API error:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to get sync status' 
    }, { status: 500 })
  }
}