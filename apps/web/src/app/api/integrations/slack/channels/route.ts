import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { SlackProvider } from '@/lib/integrations/providers/slack'

// GET /api/integrations/slack/channels - Get Slack channels
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
      .select('auth_data')
      .eq('id', integrationId)
      .eq('workspace_id', profile.workspace_id)
      .single()

    if (error || !integration) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 })
    }

    const slackProvider = new SlackProvider()
    const result = await slackProvider.getChannels(integration.auth_data)

    if (!result.success) {
      return NextResponse.json({ 
        success: false, 
        error: result.error 
      }, { status: 400 })
    }

    // Save channels to database for future reference
    if (result.channels) {
      const channelData = result.channels.map(channel => ({
        workspace_integration_id: integrationId,
        slack_channel_id: channel.id,
        channel_name: channel.name,
        is_private: channel.is_private,
        is_archived: channel.is_archived,
        sync_enabled: false // Default to disabled
      }))

      // Upsert channels (insert or update)
      await supabase
        .from('slack_channels')
        .upsert(channelData, {
          onConflict: 'workspace_integration_id,slack_channel_id'
        })
    }

    return NextResponse.json({
      success: true,
      channels: result.channels || []
    })

  } catch (error) {
    console.error('Slack channels API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/integrations/slack/channels - Send test message to channel
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { integrationId, channelId, message } = body

    if (!integrationId || !channelId) {
      return NextResponse.json({ 
        error: 'integrationId and channelId are required' 
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
      .select('auth_data')
      .eq('id', integrationId)
      .eq('workspace_id', profile.workspace_id)
      .single()

    if (error || !integration) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 })
    }

    const slackProvider = new SlackProvider()
    const userName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'ColdCopy User'
    
    const slackMessage = {
      channel: channelId,
      text: message || `🚀 Test message from ${userName} via ColdCopy`,
      username: 'ColdCopy',
      icon_emoji: ':email:',
      attachments: [{
        color: 'good',
        title: 'ColdCopy Integration Test',
        text: 'This is a test message to verify the Slack integration is working correctly.',
        footer: 'ColdCopy',
        ts: Math.floor(Date.now() / 1000)
      }]
    }

    const result = await slackProvider.sendMessage(integration.auth_data, slackMessage)

    if (!result.success) {
      return NextResponse.json({ 
        success: false, 
        error: result.error 
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'Test message sent successfully',
      data: result.data
    })

  } catch (error) {
    console.error('Slack test message API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}