import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { StripeService } from '@/lib/billing/stripe-service'
import { 
  BillingErrorCode,
  type ReportUsageRequest 
} from '@/lib/billing/types'

const stripeService = new StripeService()

// GET /api/billing/usage - Get usage summary
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

    // Get period from query params
    const searchParams = request.nextUrl.searchParams
    const period = searchParams.get('period') || 'current'
    
    let startDate: Date
    let endDate: Date = new Date()
    
    switch (period) {
      case '30d':
        startDate = new Date()
        startDate.setDate(startDate.getDate() - 30)
        break
      case '90d':
        startDate = new Date()
        startDate.setDate(startDate.getDate() - 90)
        break
      case 'current':
      default:
        // Get current billing period from subscription
        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('current_period_start, current_period_end')
          .eq('workspace_id', workspaceId)
          .single()
        
        if (subscription?.current_period_start) {
          startDate = new Date(subscription.current_period_start)
          endDate = new Date(subscription.current_period_end || new Date())
        } else {
          // Default to last 30 days if no subscription
          startDate = new Date()
          startDate.setDate(startDate.getDate() - 30)
        }
    }

    // Get usage summary
    const usage = await stripeService.getUsageSummary(workspaceId, {
      start: startDate,
      end: endDate
    })
    
    return NextResponse.json(usage)
  } catch (error: any) {
    console.error('Error fetching usage summary:', error)
    
    return NextResponse.json(
      { 
        error: error.message || 'Internal server error',
        code: error.code || BillingErrorCode.UNKNOWN_ERROR
      },
      { status: error.statusCode || 500 }
    )
  }
}

// POST /api/billing/usage - Report usage
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
    
    // Check auth - this endpoint should typically only be called by service role
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body: ReportUsageRequest = await request.json()
    
    // Validate request
    if (!body.metricName || !body.quantity) {
      return NextResponse.json(
        { error: 'Metric name and quantity required' },
        { status: 400 }
      )
    }

    // Report usage
    const usageRecord = await stripeService.reportUsage({
      workspaceId,
      ...body
    })
    
    return NextResponse.json({ usageRecord })
  } catch (error: any) {
    console.error('Error reporting usage:', error)
    
    return NextResponse.json(
      { 
        error: error.message || 'Internal server error',
        code: error.code || BillingErrorCode.UNKNOWN_ERROR
      },
      { status: error.statusCode || 500 }
    )
  }
}