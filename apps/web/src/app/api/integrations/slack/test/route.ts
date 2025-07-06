import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { SlackProvider } from '@/lib/integrations/providers/slack'

// POST /api/integrations/slack/test - Test Slack connection
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { integrationId } = body

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
      .select('auth_data, settings')
      .eq('id', integrationId)
      .eq('workspace_id', profile.workspace_id)
      .single()

    if (error || !integration) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 })
    }

    const slackProvider = new SlackProvider()
    const result = await slackProvider.testConnection(integration.auth_data)

    // Update integration status based on test result
    await supabase
      .from('workspace_integrations')
      .update({
        sync_status: result.success ? 'active' : 'error',
        last_error: result.success ? null : result.error,
        last_sync_at: new Date().toISOString()
      })
      .eq('id', integrationId)

    return NextResponse.json(result)

  } catch (error) {
    console.error('Slack test API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}