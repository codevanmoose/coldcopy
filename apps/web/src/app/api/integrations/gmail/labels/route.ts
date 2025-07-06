import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { GmailProvider } from '@/lib/integrations/providers/gmail'

// GET /api/integrations/gmail/labels - Get Gmail labels
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const integrationId = searchParams.get('integrationId')

    if (!integrationId) {
      return NextResponse.json({ error: 'integrationId is required' }, { status: 400 })
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

    // Get integration
    const { data: integration, error } = await supabase
      .from('workspace_integrations')
      .select('auth_data, auth_expires_at')
      .eq('id', integrationId)
      .eq('workspace_id', profile.workspace_id)
      .single()

    if (error || !integration) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 })
    }

    const gmailProvider = new GmailProvider()
    let authData = integration.auth_data

    // Check if token needs refresh
    if (integration.auth_expires_at) {
      const expiresAt = new Date(integration.auth_expires_at)
      const now = new Date()
      const timeUntilExpiry = expiresAt.getTime() - now.getTime()
      
      if (timeUntilExpiry < 5 * 60 * 1000) {
        const refreshResult = await gmailProvider.refreshToken(authData)
        if (refreshResult.success && refreshResult.config) {
          authData = refreshResult.config
          
          const newExpiresAt = new Date()
          newExpiresAt.setSeconds(newExpiresAt.getSeconds() + refreshResult.config.expires_in)
          
          await supabase
            .from('workspace_integrations')
            .update({
              auth_data: authData,
              auth_expires_at: newExpiresAt.toISOString()
            })
            .eq('id', integrationId)
        }
      }
    }

    const result = await gmailProvider.getLabels(authData)

    if (!result.success) {
      return NextResponse.json({ 
        success: false, 
        error: result.error 
      }, { status: 400 })
    }

    // Save labels to database for future reference
    if (result.labels) {
      const labelData = result.labels.map(label => ({
        workspace_integration_id: integrationId,
        gmail_label_id: label.id,
        label_name: label.name,
        label_type: label.type,
        sync_enabled: false // Default to disabled
      }))

      // Upsert labels (insert or update)
      await supabase
        .from('gmail_labels')
        .upsert(labelData, {
          onConflict: 'workspace_integration_id,gmail_label_id'
        })
    }

    return NextResponse.json({
      success: true,
      labels: result.labels || []
    })

  } catch (error) {
    console.error('Gmail labels API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/integrations/gmail/labels - Create Gmail label
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { integrationId, labelName, messageListVisibility, labelListVisibility } = body

    if (!integrationId || !labelName) {
      return NextResponse.json({ 
        error: 'integrationId and labelName are required' 
      }, { status: 400 })
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

    // Get integration
    const { data: integration, error } = await supabase
      .from('workspace_integrations')
      .select('auth_data, auth_expires_at')
      .eq('id', integrationId)
      .eq('workspace_id', profile.workspace_id)
      .single()

    if (error || !integration) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 })
    }

    const gmailProvider = new GmailProvider()
    let authData = integration.auth_data

    // Handle token refresh if needed
    if (integration.auth_expires_at) {
      const expiresAt = new Date(integration.auth_expires_at)
      const now = new Date()
      const timeUntilExpiry = expiresAt.getTime() - now.getTime()
      
      if (timeUntilExpiry < 5 * 60 * 1000) {
        const refreshResult = await gmailProvider.refreshToken(authData)
        if (refreshResult.success && refreshResult.config) {
          authData = refreshResult.config
          
          const newExpiresAt = new Date()
          newExpiresAt.setSeconds(newExpiresAt.getSeconds() + refreshResult.config.expires_in)
          
          await supabase
            .from('workspace_integrations')
            .update({
              auth_data: authData,
              auth_expires_at: newExpiresAt.toISOString()
            })
            .eq('id', integrationId)
        }
      }
    }

    const result = await gmailProvider.createLabel(authData, labelName, {
      messageListVisibility,
      labelListVisibility
    })

    if (!result.success) {
      return NextResponse.json({ 
        success: false, 
        error: result.error 
      }, { status: 400 })
    }

    // Save new label to database
    if (result.label) {
      await supabase
        .from('gmail_labels')
        .insert({
          workspace_integration_id: integrationId,
          gmail_label_id: result.label.id,
          label_name: result.label.name,
          label_type: result.label.type,
          sync_enabled: true // Enable sync for created labels
        })
    }

    return NextResponse.json({
      success: true,
      message: 'Label created successfully',
      label: result.label
    })

  } catch (error) {
    console.error('Gmail create label API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}