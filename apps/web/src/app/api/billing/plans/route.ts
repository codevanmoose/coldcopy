import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { BillingErrorCode } from '@/lib/billing/types'

// GET /api/billing/plans - Get available subscription plans
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Get active subscription plans
    const { data: plans, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (error) {
      console.error('Error fetching subscription plans:', error)
      throw error
    }

    // Transform database format to API format
    const transformedPlans = plans.map(plan => ({
      id: plan.id,
      name: plan.name,
      slug: plan.slug,
      description: plan.description,
      priceMonthly: plan.price_monthly,
      priceYearly: plan.price_yearly,
      currency: plan.currency,
      features: plan.features,
      limits: plan.limits,
      isActive: plan.is_active,
      isPopular: plan.is_popular,
      displayOrder: plan.display_order,
      stripePriceIdMonthly: plan.stripe_price_id_monthly,
      stripePriceIdYearly: plan.stripe_price_id_yearly,
      stripeProductId: plan.stripe_product_id,
      createdAt: plan.created_at,
      updatedAt: plan.updated_at
    }))
    
    return NextResponse.json(transformedPlans)
  } catch (error: any) {
    console.error('Error in plans route:', error)
    
    return NextResponse.json(
      { 
        error: error.message || 'Internal server error',
        code: BillingErrorCode.UNKNOWN_ERROR
      },
      { status: 500 }
    )
  }
}