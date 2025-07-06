import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { SlackProvider } from '@/lib/integrations/providers/slack'
import { GmailProvider } from '@/lib/integrations/providers/gmail'
import { ZapierProvider } from '@/lib/integrations/providers/zapier'

// POST /api/integrations/trigger - Trigger integration event
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { event, data, workspace_id } = body

    if (!event || !data) {
      return NextResponse.json({ 
        error: 'event and data are required' 
      }, { status: 400 })
    }

    // Get user's workspace if not provided
    let workspaceId = workspace_id
    if (!workspaceId) {
      const { data: profile } = await supabase
        .from('user_profiles')
      .select('workspace_id')
      .eq('id', user.id)
        .single()

      if (!profile?.workspace_id) {
        return NextResponse.json({ error: 'No workspace found' }, { status: 400 })
      }
      workspaceId = profile.workspace_id
    }

    // Get active automations for this event
    const { data: automations, error } = await supabase
      .from('integration_automations')
      .select(`
        *,
        integration_providers (*),
        workspace_integrations (
          auth_data,
          settings,
          is_active,
          sync_status
        )
      `)
      .eq('workspace_id', workspaceId)
      .eq('trigger_event', event)
      .eq('is_active', true)
      .order('execution_order')

    if (error) {
      console.error('Error fetching automations:', error)
      return NextResponse.json({ error: 'Failed to fetch automations' }, { status: 500 })
    }

    const results = []
    
    for (const automation of automations || []) {
      try {
        // Check if conditions match
        if (!matchesConditions(data, automation.trigger_conditions)) {
          continue
        }

        // Get workspace integration for this provider
        const { data: integration } = await supabase
          .from('workspace_integrations')
          .select('auth_data, settings, is_active, sync_status')
          .eq('workspace_id', workspaceId)
          .eq('provider_id', automation.action_provider_id)
          .eq('is_active', true)
          .single()

        if (!integration || integration.sync_status !== 'active') {
          console.log(`Skipping automation ${automation.id}: integration not active`)
          continue
        }

        // Execute action based on provider
        const provider = automation.integration_providers
        const result = await executeProviderAction(
          provider.name,
          automation.action_type,
          integration.auth_data,
          automation.action_config,
          data,
          workspaceId
        )

        // Log execution
        await logExecution(
          supabase,
          automation.id,
          workspaceId,
          automation.action_provider_id,
          event,
          automation.action_type,
          result.success ? 'success' : 'failed',
          result.error,
          data,
          automation.action_config
        )

        // Update automation statistics
        await updateAutomationStats(supabase, automation.id, result.success)

        results.push({
          automation_id: automation.id,
          provider: provider.name,
          action: automation.action_type,
          success: result.success,
          error: result.error
        })

      } catch (error) {
        console.error(`Error executing automation ${automation.id}:`, error)
        
        // Log failed execution
        await logExecution(
          supabase,
          automation.id,
          workspaceId,
          automation.action_provider_id,
          event,
          automation.action_type,
          'failed',
          error.message,
          data,
          automation.action_config
        )

        results.push({
          automation_id: automation.id,
          provider: automation.integration_providers.name,
          action: automation.action_type,
          success: false,
          error: error.message
        })
      }
    }

    return NextResponse.json({
      success: true,
      triggered: results.length,
      results
    })

  } catch (error) {
    console.error('Trigger integrations API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper function to check if data matches conditions
function matchesConditions(eventData: any, conditions: any): boolean {
  if (!conditions || Object.keys(conditions).length === 0) {
    return true // No conditions = always match
  }

  for (const [key, value] of Object.entries(conditions)) {
    if (eventData[key] !== value) {
      return false
    }
  }

  return true
}

// Helper function to execute provider-specific actions
async function executeProviderAction(
  providerName: string,
  actionType: string,
  authData: any,
  actionConfig: any,
  eventData: any,
  workspaceId: string
): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    switch (providerName) {
      case 'slack':
        return await executeSlackAction(actionType, authData, actionConfig, eventData)
      
      case 'gmail':
        return await executeGmailAction(actionType, authData, actionConfig, eventData)
      
      case 'zapier':
        return await executeZapierAction(actionType, authData, actionConfig, eventData, workspaceId)
      
      default:
        return { success: false, error: `Unknown provider: ${providerName}` }
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Slack action executor
async function executeSlackAction(
  actionType: string,
  authData: any,
  actionConfig: any,
  eventData: any
): Promise<{ success: boolean; error?: string; data?: any }> {
  const slackProvider = new SlackProvider()

  switch (actionType) {
    case 'send_message':
      if (eventData.event === 'campaign_completed') {
        const message = slackProvider.createCampaignCompletedMessage(eventData)
        message.channel = actionConfig.channel
        return await slackProvider.sendMessage(authData, message)
      } else if (eventData.event === 'lead_replied') {
        const message = slackProvider.createReplyMessage(eventData)
        message.channel = actionConfig.channel
        return await slackProvider.sendMessage(authData, message)
      } else if (eventData.event === 'error_occurred') {
        const message = slackProvider.createErrorMessage(eventData)
        message.channel = actionConfig.channel
        return await slackProvider.sendMessage(authData, message)
      } else {
        // Generic message
        const message = {
          channel: actionConfig.channel,
          text: actionConfig.message || `Event: ${eventData.event}`,
          username: 'ColdCopy',
          icon_emoji: ':email:'
        }
        return await slackProvider.sendMessage(authData, message)
      }
    
    default:
      return { success: false, error: `Unknown Slack action: ${actionType}` }
  }
}

// Gmail action executor
async function executeGmailAction(
  actionType: string,
  authData: any,
  actionConfig: any,
  eventData: any
): Promise<{ success: boolean; error?: string; data?: any }> {
  const gmailProvider = new GmailProvider()

  switch (actionType) {
    case 'send_email':
      return await gmailProvider.sendEmail(authData, {
        to: actionConfig.to || eventData.email,
        subject: actionConfig.subject || `ColdCopy: ${eventData.event}`,
        body: actionConfig.body || JSON.stringify(eventData, null, 2),
        isHtml: actionConfig.isHtml || false
      })
    
    case 'apply_label':
      if (eventData.message_id && actionConfig.labelIds) {
        return await gmailProvider.applyLabel(authData, eventData.message_id, actionConfig.labelIds)
      }
      return { success: false, error: 'message_id and labelIds required for apply_label' }
    
    default:
      return { success: false, error: `Unknown Gmail action: ${actionType}` }
  }
}

// Zapier action executor
async function executeZapierAction(
  actionType: string,
  authData: any,
  actionConfig: any,
  eventData: any,
  workspaceId: string
): Promise<{ success: boolean; error?: string; data?: any }> {
  const zapierProvider = new ZapierProvider()

  switch (actionType) {
    case 'trigger_zap':
    case 'webhook':
      return await zapierProvider.triggerZap(authData, eventData.event, eventData, {
        workspaceId,
        includeMetadata: actionConfig.include_metadata !== false
      })
    
    default:
      return { success: false, error: `Unknown Zapier action: ${actionType}` }
  }
}

// Helper function to log execution
async function logExecution(
  supabase: any,
  automationId: string,
  workspaceId: string,
  providerId: string,
  triggerEvent: string,
  actionType: string,
  status: string,
  errorMessage: string | undefined,
  triggerData: any,
  actionData: any
) {
  await supabase
    .from('integration_execution_logs')
    .insert({
      automation_id: automationId,
      workspace_id: workspaceId,
      provider_id: providerId,
      execution_type: 'automation',
      trigger_event: triggerEvent,
      trigger_data: triggerData,
      action_type: actionType,
      action_data: actionData,
      status,
      error_message: errorMessage,
      completed_at: new Date().toISOString()
    })
}

// Helper function to update automation statistics
async function updateAutomationStats(
  supabase: any,
  automationId: string,
  success: boolean
) {
  if (success) {
    await supabase.rpc('increment_automation_success', {
      automation_id: automationId
    })
  } else {
    await supabase.rpc('increment_automation_failure', {
      automation_id: automationId
    })
  }
}