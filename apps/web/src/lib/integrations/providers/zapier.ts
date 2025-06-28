// Zapier Integration Provider
import { WorkspaceIntegration } from '../integration-service'

export interface ZapierConfig {
  webhook_url: string
  webhook_secret?: string
  zap_name?: string
  description?: string
}

export interface ZapierWebhook {
  id: string
  name: string
  url: string
  secret?: string
  events: string[]
  isActive: boolean
  totalTriggers: number
  lastTriggered?: string
}

export interface ZapierPayload {
  event: string
  timestamp: string
  workspace_id: string
  data: any
  metadata?: {
    source: string
    version: string
    retry_count?: number
  }
}

export class ZapierProvider {
  // Zapier doesn't have traditional OAuth - it uses webhook URLs
  // Users provide their Zap webhook URL to receive data

  // Test Zapier webhook connection
  async testConnection(config: ZapierConfig): Promise<{
    success: boolean
    data?: any
    error?: string
  }> {
    try {
      if (!config.webhook_url) {
        return { success: false, error: 'No webhook URL provided' }
      }

      // Send test payload to webhook
      const testPayload: ZapierPayload = {
        event: 'test_connection',
        timestamp: new Date().toISOString(),
        workspace_id: 'test',
        data: {
          test: true,
          message: 'This is a test connection from ColdCopy',
          timestamp: new Date().toISOString()
        },
        metadata: {
          source: 'coldcopy',
          version: '1.0'
        }
      }

      const response = await fetch(config.webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.webhook_secret && {
            'X-Zapier-Secret': config.webhook_secret
          })
        },
        body: JSON.stringify(testPayload),
        signal: AbortSignal.timeout(10000) // 10 second timeout
      })

      if (response.ok) {
        return {
          success: true,
          data: {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries())
          }
        }
      } else {
        const errorText = await response.text().catch(() => 'No response body')
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}. Response: ${errorText}`
        }
      }
    } catch (error: any) {
      console.error('Zapier connection test error:', error)
      if (error.name === 'AbortError') {
        return { success: false, error: 'Connection timeout - webhook took too long to respond' }
      }
      return { success: false, error: error.message || 'Failed to test webhook connection' }
    }
  }

  // Send data to Zapier webhook
  async triggerZap(config: ZapierConfig, event: string, data: any, options: {
    includeMetadata?: boolean
    retryCount?: number
    workspaceId?: string
  } = {}): Promise<{
    success: boolean
    data?: any
    error?: string
  }> {
    try {
      if (!config.webhook_url) {
        return { success: false, error: 'No webhook URL configured' }
      }

      const payload: ZapierPayload = {
        event,
        timestamp: new Date().toISOString(),
        workspace_id: options.workspaceId || 'unknown',
        data,
        ...(options.includeMetadata !== false && {
          metadata: {
            source: 'coldcopy',
            version: '1.0',
            retry_count: options.retryCount || 0
          }
        })
      }

      const response = await fetch(config.webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'ColdCopy/1.0',
          ...(config.webhook_secret && {
            'X-Zapier-Secret': config.webhook_secret
          })
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000) // 30 second timeout for data webhooks
      })

      if (response.ok) {
        let responseData
        try {
          const responseText = await response.text()
          responseData = responseText ? JSON.parse(responseText) : {}
        } catch {
          responseData = { status: 'received' }
        }

        return {
          success: true,
          data: {
            status: response.status,
            response: responseData
          }
        }
      } else {
        const errorText = await response.text().catch(() => 'No response body')
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}. Response: ${errorText}`
        }
      }
    } catch (error: any) {
      console.error('Zapier trigger error:', error)
      if (error.name === 'AbortError') {
        return { success: false, error: 'Webhook timeout - request took too long' }
      }
      return { success: false, error: error.message || 'Failed to trigger Zapier webhook' }
    }
  }

  // Send campaign completion data
  async sendCampaignCompleted(config: ZapierConfig, campaignData: any): Promise<{
    success: boolean
    data?: any
    error?: string
  }> {
    const payload = {
      campaign_id: campaignData.id,
      campaign_name: campaignData.name,
      campaign_type: campaignData.type || 'email',
      status: 'completed',
      completion_date: new Date().toISOString(),
      statistics: {
        total_sent: campaignData.stats?.total_sent || 0,
        delivered: campaignData.stats?.delivered || 0,
        opened: campaignData.stats?.opens || 0,
        clicked: campaignData.stats?.clicks || 0,
        replied: campaignData.stats?.replies || 0,
        bounced: campaignData.stats?.bounces || 0,
        unsubscribed: campaignData.stats?.unsubscribes || 0,
        open_rate: campaignData.stats?.open_rate || 0,
        click_rate: campaignData.stats?.click_rate || 0,
        reply_rate: campaignData.stats?.reply_rate || 0
      },
      duration_minutes: campaignData.duration_minutes,
      created_by: campaignData.created_by,
      workspace_name: campaignData.workspace_name
    }

    return this.triggerZap(config, 'campaign_completed', payload, {
      workspaceId: campaignData.workspace_id
    })
  }

  // Send new lead data
  async sendLeadCreated(config: ZapierConfig, leadData: any): Promise<{
    success: boolean
    data?: any
    error?: string
  }> {
    const payload = {
      lead_id: leadData.id,
      email: leadData.email,
      first_name: leadData.first_name,
      last_name: leadData.last_name,
      full_name: `${leadData.first_name || ''} ${leadData.last_name || ''}`.trim(),
      company: leadData.company,
      title: leadData.title,
      phone: leadData.phone,
      website: leadData.website,
      linkedin_url: leadData.linkedin_url,
      source: leadData.source || 'manual',
      tags: leadData.tags || [],
      custom_fields: leadData.custom_fields || {},
      enrichment_status: leadData.enrichment_status,
      created_date: leadData.created_at,
      workspace_name: leadData.workspace_name
    }

    return this.triggerZap(config, 'lead_created', payload, {
      workspaceId: leadData.workspace_id
    })
  }

  // Send lead updated data
  async sendLeadUpdated(config: ZapierConfig, leadData: any, changes: any): Promise<{
    success: boolean
    data?: any
    error?: string
  }> {
    const payload = {
      lead_id: leadData.id,
      email: leadData.email,
      first_name: leadData.first_name,
      last_name: leadData.last_name,
      full_name: `${leadData.first_name || ''} ${leadData.last_name || ''}`.trim(),
      company: leadData.company,
      title: leadData.title,
      status: leadData.status,
      changes: changes,
      updated_fields: Object.keys(changes),
      updated_date: new Date().toISOString(),
      workspace_name: leadData.workspace_name
    }

    return this.triggerZap(config, 'lead_updated', payload, {
      workspaceId: leadData.workspace_id
    })
  }

  // Send lead reply data
  async sendLeadReplied(config: ZapierConfig, replyData: any): Promise<{
    success: boolean
    data?: any
    error?: string
  }> {
    const payload = {
      reply_id: replyData.id,
      lead_id: replyData.lead_id,
      campaign_id: replyData.campaign_id,
      campaign_name: replyData.campaign_name,
      lead_email: replyData.lead_email,
      lead_name: replyData.lead_name || replyData.lead_email,
      subject: replyData.subject,
      message_preview: replyData.preview || replyData.body?.substring(0, 200),
      full_message: replyData.body,
      reply_date: replyData.received_at || new Date().toISOString(),
      sentiment: replyData.sentiment,
      is_positive: replyData.sentiment === 'positive',
      thread_id: replyData.thread_id,
      workspace_name: replyData.workspace_name
    }

    return this.triggerZap(config, 'lead_replied', payload, {
      workspaceId: replyData.workspace_id
    })
  }

  // Send campaign started data
  async sendCampaignStarted(config: ZapierConfig, campaignData: any): Promise<{
    success: boolean
    data?: any
    error?: string
  }> {
    const payload = {
      campaign_id: campaignData.id,
      campaign_name: campaignData.name,
      campaign_type: campaignData.type || 'email',
      status: 'started',
      start_date: new Date().toISOString(),
      scheduled_count: campaignData.scheduled_count || 0,
      target_audience: {
        total_leads: campaignData.total_leads || 0,
        segments: campaignData.segments || [],
        filters: campaignData.filters || {}
      },
      settings: {
        send_time: campaignData.send_time,
        time_zone: campaignData.time_zone,
        daily_limit: campaignData.daily_limit,
        tracking_enabled: campaignData.tracking_enabled
      },
      created_by: campaignData.created_by,
      workspace_name: campaignData.workspace_name
    }

    return this.triggerZap(config, 'campaign_started', payload, {
      workspaceId: campaignData.workspace_id
    })
  }

  // Send error data
  async sendError(config: ZapierConfig, errorData: any): Promise<{
    success: boolean
    data?: any
    error?: string
  }> {
    const payload = {
      error_id: errorData.id || 'unknown',
      error_type: errorData.type || 'general',
      error_message: errorData.message,
      error_code: errorData.code,
      severity: errorData.severity || 'medium',
      component: errorData.component,
      campaign_id: errorData.campaign_id,
      campaign_name: errorData.campaign_name,
      affected_count: errorData.affected_count || 1,
      timestamp: errorData.timestamp || new Date().toISOString(),
      stack_trace: errorData.stack_trace,
      user_id: errorData.user_id,
      workspace_name: errorData.workspace_name
    }

    return this.triggerZap(config, 'error_occurred', payload, {
      workspaceId: errorData.workspace_id
    })
  }

  // Validate webhook URL format
  validateWebhookUrl(url: string): { valid: boolean; error?: string } {
    try {
      const parsedUrl = new URL(url)
      
      // Check if it's HTTPS (required for security)
      if (parsedUrl.protocol !== 'https:') {
        return { valid: false, error: 'Webhook URL must use HTTPS' }
      }

      // Check if it looks like a Zapier webhook
      if (parsedUrl.hostname.includes('zapier.com') || parsedUrl.hostname.includes('hooks.zapier.com')) {
        return { valid: true }
      }

      // Allow other webhook providers but warn
      if (!parsedUrl.pathname || parsedUrl.pathname === '/') {
        return { valid: false, error: 'Webhook URL should include a specific endpoint path' }
      }

      return { valid: true }
    } catch (error) {
      return { valid: false, error: 'Invalid URL format' }
    }
  }

  // Get Zapier setup instructions
  getSetupInstructions(): {
    steps: string[]
    tips: string[]
    supportedEvents: string[]
  } {
    return {
      steps: [
        '1. Create a new Zap in your Zapier dashboard',
        '2. Choose "Webhooks by Zapier" as the trigger app',
        '3. Select "Catch Hook" as the trigger event',
        '4. Copy the webhook URL provided by Zapier',
        '5. Paste the webhook URL in the field above',
        '6. Test the connection to verify it works',
        '7. Configure your Zap actions based on the data you receive',
        '8. Turn on your Zap to start receiving data'
      ],
      tips: [
        'Use HTTPS webhook URLs for security',
        'Test your webhook with sample data first',
        'Set up filters in Zapier to handle specific events',
        'Use Zapier Formatter to transform data as needed',
        'Monitor your Zap execution history for errors',
        'Set up error notifications in Zapier if needed'
      ],
      supportedEvents: [
        'campaign_completed - When an email campaign finishes',
        'campaign_started - When an email campaign begins',
        'lead_created - When a new lead is added',
        'lead_updated - When lead information changes',
        'lead_replied - When a lead responds to an email',
        'error_occurred - When system errors happen'
      ]
    }
  }

  // Create webhook configuration
  createWebhookConfig(
    url: string,
    events: string[] = [],
    options: {
      secret?: string
      name?: string
      description?: string
      includeMetadata?: boolean
    } = {}
  ): ZapierConfig {
    const validation = this.validateWebhookUrl(url)
    if (!validation.valid) {
      throw new Error(`Invalid webhook URL: ${validation.error}`)
    }

    return {
      webhook_url: url,
      webhook_secret: options.secret,
      zap_name: options.name || 'ColdCopy Integration',
      description: options.description || 'Zapier integration for ColdCopy events'
    }
  }
}