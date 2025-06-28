import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { ZapierProvider } from '@/lib/integrations/providers/zapier'

// POST /api/integrations/zapier/test - Test Zapier webhook connection
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { integrationId, webhookUrl, webhookSecret } = body

    // Get user's workspace
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()

    if (!profile?.workspace_id) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 400 })
    }

    const zapierProvider = new ZapierProvider()

    // If integrationId provided, get existing integration
    if (integrationId) {
      const { data: integration, error } = await supabase
        .from('workspace_integrations')
        .select('auth_data, settings')
        .eq('id', integrationId)
        .eq('workspace_id', profile.workspace_id)
        .single()

      if (error || !integration) {
        return NextResponse.json({ error: 'Integration not found' }, { status: 404 })
      }

      const config = {
        webhook_url: integration.auth_data.webhook_url,
        webhook_secret: integration.auth_data.webhook_secret
      }

      const result = await zapierProvider.testConnection(config)
      return NextResponse.json(result)
    }

    // Test with provided webhook URL
    if (webhookUrl) {
      // Validate URL format first
      const validation = zapierProvider.validateWebhookUrl(webhookUrl)
      if (!validation.valid) {
        return NextResponse.json({ 
          success: false, 
          error: validation.error 
        }, { status: 400 })
      }

      const config = {
        webhook_url: webhookUrl,
        webhook_secret: webhookSecret
      }

      const result = await zapierProvider.testConnection(config)
      return NextResponse.json(result)
    }

    return NextResponse.json({ 
      error: 'Either integrationId or webhookUrl is required' 
    }, { status: 400 })

  } catch (error) {
    console.error('Zapier test API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}