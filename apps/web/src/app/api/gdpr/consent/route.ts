import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const consentSchema = z.object({
  consents: z.array(z.object({
    user_id: z.string(),
    type: z.string(),
    status: z.boolean(),
    category: z.enum(['marketing', 'communication', 'data-processing', 'third-party']),
    metadata: z.object({
      name: z.string(),
      description: z.string(),
      required: z.boolean(),
    }).optional(),
  })),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse and validate request body
    const body = await request.json()
    const { consents } = consentSchema.parse(body)

    // Verify all consents belong to the authenticated user
    const invalidConsents = consents.filter(c => c.user_id !== user.id)
    if (invalidConsents.length > 0) {
      return NextResponse.json({ error: 'Invalid user ID in consents' }, { status: 403 })
    }

    // Update consents in database
    const { data, error } = await supabase
      .from('gdpr_consents')
      .upsert(consents, { onConflict: 'user_id,type' })
      .select()

    if (error) {
      console.error('Error updating consents:', error)
      return NextResponse.json({ error: 'Failed to update consents' }, { status: 500 })
    }

    // Log consent changes for audit trail
    const auditLogs = consents.map(consent => ({
      user_id: user.id,
      action: 'consent_update',
      resource_type: 'consent',
      resource_id: consent.type,
      metadata: {
        status: consent.status,
        category: consent.category,
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        user_agent: request.headers.get('user-agent'),
      },
    }))

    await supabase
      .from('gdpr_audit_logs')
      .insert(auditLogs)

    // If marketing consents were withdrawn, update email preferences
    const marketingConsentsWithdrawn = consents.filter(
      c => c.category === 'marketing' && !c.status
    )
    
    if (marketingConsentsWithdrawn.length > 0) {
      await supabase
        .from('user_preferences')
        .update({
          marketing_emails: false,
          product_updates: false,
          newsletters: false,
        })
        .eq('user_id', user.id)
    }

    return NextResponse.json({ 
      success: true, 
      data,
      message: 'Consent preferences updated successfully' 
    })
  } catch (error) {
    console.error('Error in consent API:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: error.errors }, { status: 400 })
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch user's consents
    const { data: consents, error } = await supabase
      .from('gdpr_consents')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching consents:', error)
      return NextResponse.json({ error: 'Failed to fetch consents' }, { status: 500 })
    }

    // Get consent categories with defaults
    const consentCategories = {
      marketing: ['marketing-emails', 'product-updates', 'newsletters'],
      communication: ['transactional-emails', 'support-communications', 'security-alerts'],
      'data-processing': ['usage-analytics', 'performance-monitoring', 'ai-training'],
      'third-party': ['integration-sharing', 'analytics-providers'],
    }

    // Build complete consent status
    const consentStatus = Object.entries(consentCategories).reduce((acc, [category, types]) => {
      acc[category] = types.map(type => {
        const consent = consents?.find(c => c.type === type)
        return {
          type,
          status: consent?.status ?? false,
          updated_at: consent?.updated_at,
        }
      })
      return acc
    }, {} as Record<string, any[]>)

    return NextResponse.json({ 
      success: true, 
      consents: consents || [],
      consentStatus,
    })
  } catch (error) {
    console.error('Error in consent GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Withdraw all optional consents
    const { error } = await supabase
      .from('gdpr_consents')
      .update({ status: false })
      .eq('user_id', user.id)
      .not('type', 'in', '(transactional-emails,security-alerts)')

    if (error) {
      console.error('Error withdrawing consents:', error)
      return NextResponse.json({ error: 'Failed to withdraw consents' }, { status: 500 })
    }

    // Log the withdrawal
    await supabase
      .from('gdpr_audit_logs')
      .insert({
        user_id: user.id,
        action: 'consent_withdraw_all',
        resource_type: 'consent',
        metadata: {
          ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
          user_agent: request.headers.get('user-agent'),
        },
      })

    // Update user preferences
    await supabase
      .from('user_preferences')
      .update({
        marketing_emails: false,
        product_updates: false,
        newsletters: false,
      })
      .eq('user_id', user.id)

    return NextResponse.json({ 
      success: true, 
      message: 'All optional consents withdrawn successfully' 
    })
  } catch (error) {
    console.error('Error in consent DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}