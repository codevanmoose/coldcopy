import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { ZapierProvider } from '@/lib/integrations/providers/zapier'

// POST /api/integrations/zapier/webhook - Create or update Zapier webhook integration
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      webhookUrl, 
      webhookSecret, 
      zapName, 
      description, 
      events = [] 
    } = body

    if (!webhookUrl) {
      return NextResponse.json({ error: 'webhookUrl is required' }, { status: 400 })
    }

    // Get user's workspace
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('workspace_id')
      .eq('id', user.id)
      .single()

    if (!profile?.workspace_id) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 400 })
    }

    const zapierProvider = new ZapierProvider()

    // Validate webhook URL
    const validation = zapierProvider.validateWebhookUrl(webhookUrl)
    if (!validation.valid) {
      return NextResponse.json({ 
        success: false, 
        error: validation.error 
      }, { status: 400 })
    }

    // Test connection first
    const config = zapierProvider.createWebhookConfig(webhookUrl, events, {
      secret: webhookSecret,
      name: zapName,
      description
    })

    const testResult = await zapierProvider.testConnection(config)
    if (!testResult.success) {
      return NextResponse.json({ 
        success: false, 
        error: `Connection test failed: ${testResult.error}` 
      }, { status: 400 })
    }

    // Get Zapier provider
    const { data: provider } = await supabase
      .from('integration_providers')
      .select('id')
      .eq('name', 'zapier')
      .single()

    if (!provider) {
      return NextResponse.json({ error: 'Zapier provider not found' }, { status: 404 })
    }

    // Check if integration already exists
    const { data: existingIntegration } = await supabase
      .from('workspace_integrations')
      .select('id')
      .eq('workspace_id', profile.workspace_id)
      .eq('provider_id', provider.id)
      .single()

    const authData = {
      webhook_url: webhookUrl,
      webhook_secret: webhookSecret
    }

    const settings = {
      zap_name: zapName || 'ColdCopy Integration',
      description: description || 'Zapier integration for ColdCopy events',
      events: events,
      include_metadata: true
    }

    if (existingIntegration) {
      // Update existing integration
      const { error } = await supabase
        .from('workspace_integrations')
        .update({
          auth_data: authData,
          settings: settings,
          is_active: true,
          sync_status: 'active',
          last_sync_at: new Date().toISOString(),
          last_error: null
        })
        .eq('id', existingIntegration.id)

      if (error) {
        console.error('Error updating Zapier integration:', error)
        return NextResponse.json({ error: 'Failed to update integration' }, { status: 500 })
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Zapier integration updated successfully',
        integration_id: existingIntegration.id
      })
    } else {
      // Create new integration
      const { data: integration, error } = await supabase
        .from('workspace_integrations')
        .insert({
          workspace_id: profile.workspace_id,
          user_id: user.id,
          provider_id: provider.id,
          integration_name: zapName || 'Zapier Webhook',
          auth_data: authData,
          settings: settings,
          is_active: true,
          sync_status: 'active',
          last_sync_at: new Date().toISOString()
        })
        .select('id')
        .single()

      if (error) {
        console.error('Error creating Zapier integration:', error)
        return NextResponse.json({ error: 'Failed to create integration' }, { status: 500 })
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Zapier integration created successfully',
        integration_id: integration.id
      })
    }

  } catch (error) {
    console.error('Zapier webhook API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/integrations/zapier/webhook - Get webhook setup instructions
export async function GET() {
  try {
    const zapierProvider = new ZapierProvider()
    const instructions = zapierProvider.getSetupInstructions()

    return NextResponse.json({
      success: true,
      data: instructions
    })

  } catch (error) {
    console.error('Zapier instructions API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}