// Slack Integration Provider
import { WorkspaceIntegration } from '../integration-service'

export interface SlackConfig {
  token: string
  team_id: string
  team_name: string
  user_id: string
  user_name: string
  incoming_webhook?: {
    url: string
    channel: string
    channel_id: string
  }
}

export interface SlackChannel {
  id: string
  name: string
  is_private: boolean
  is_archived: boolean
  is_member: boolean
  num_members?: number
  purpose?: string
  topic?: string
}

export interface SlackMessage {
  channel: string
  text: string
  username?: string
  icon_emoji?: string
  icon_url?: string
  attachments?: SlackAttachment[]
  blocks?: any[]
  thread_ts?: string
  reply_broadcast?: boolean
}

export interface SlackAttachment {
  color?: string
  pretext?: string
  author_name?: string
  author_link?: string
  author_icon?: string
  title?: string
  title_link?: string
  text?: string
  fields?: Array<{
    title: string
    value: string
    short?: boolean
  }>
  image_url?: string
  thumb_url?: string
  footer?: string
  footer_icon?: string
  ts?: number
}

export class SlackProvider {
  private baseUrl = 'https://slack.com/api'

  // Get OAuth URL for Slack authentication
  getOAuthUrl(redirectUri: string, state?: string): string {
    const scopes = [
      'channels:read',
      'channels:write',
      'chat:write',
      'groups:read',
      'im:read',
      'team:read',
      'users:read',
      'incoming-webhook'
    ].join(',')

    const params = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_SLACK_CLIENT_ID!,
      scope: scopes,
      redirect_uri: redirectUri,
      response_type: 'code'
    })

    if (state) {
      params.append('state', state)
    }

    return `https://slack.com/oauth/v2/authorize?${params.toString()}`
  }

  // Exchange OAuth code for access token
  async exchangeCodeForToken(code: string, redirectUri: string): Promise<{
    success: boolean
    config?: SlackConfig
    error?: string
  }> {
    try {
      const response = await fetch('https://slack.com/api/oauth.v2.access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: process.env.NEXT_PUBLIC_SLACK_CLIENT_ID!,
          client_secret: process.env.SLACK_CLIENT_SECRET!,
          code,
          redirect_uri: redirectUri
        })
      })

      const data = await response.json()

      if (!data.ok) {
        return { success: false, error: data.error || 'OAuth exchange failed' }
      }

      const config: SlackConfig = {
        token: data.access_token,
        team_id: data.team.id,
        team_name: data.team.name,
        user_id: data.authed_user.id,
        user_name: data.authed_user.name || 'Unknown'
      }

      // Add incoming webhook if available
      if (data.incoming_webhook) {
        config.incoming_webhook = {
          url: data.incoming_webhook.url,
          channel: data.incoming_webhook.channel,
          channel_id: data.incoming_webhook.channel_id
        }
      }

      return { success: true, config }
    } catch (error) {
      console.error('Slack OAuth error:', error)
      return { success: false, error: 'Failed to exchange code for token' }
    }
  }

  // Test Slack connection
  async testConnection(config: SlackConfig): Promise<{
    success: boolean
    data?: any
    error?: string
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/auth.test`, {
        headers: {
          'Authorization': `Bearer ${config.token}`,
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (!data.ok) {
        return { success: false, error: data.error || 'Connection test failed' }
      }

      return {
        success: true,
        data: {
          user: data.user,
          user_id: data.user_id,
          team: data.team,
          team_id: data.team_id,
          url: data.url
        }
      }
    } catch (error) {
      console.error('Slack connection test error:', error)
      return { success: false, error: 'Failed to test connection' }
    }
  }

  // Get list of channels
  async getChannels(config: SlackConfig): Promise<{
    success: boolean
    channels?: SlackChannel[]
    error?: string
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/conversations.list?types=public_channel,private_channel`, {
        headers: {
          'Authorization': `Bearer ${config.token}`,
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (!data.ok) {
        return { success: false, error: data.error || 'Failed to fetch channels' }
      }

      const channels: SlackChannel[] = data.channels.map((channel: any) => ({
        id: channel.id,
        name: channel.name,
        is_private: channel.is_private,
        is_archived: channel.is_archived,
        is_member: channel.is_member,
        num_members: channel.num_members,
        purpose: channel.purpose?.value,
        topic: channel.topic?.value
      }))

      return { success: true, channels }
    } catch (error) {
      console.error('Slack channels fetch error:', error)
      return { success: false, error: 'Failed to fetch channels' }
    }
  }

  // Send message to Slack
  async sendMessage(config: SlackConfig, message: SlackMessage): Promise<{
    success: boolean
    data?: any
    error?: string
  }> {
    try {
      // Use incoming webhook if available and no specific channel
      if (config.incoming_webhook && !message.channel) {
        return this.sendWebhookMessage(config.incoming_webhook.url, message)
      }

      const response = await fetch(`${this.baseUrl}/chat.postMessage`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(message)
      })

      const data = await response.json()

      if (!data.ok) {
        return { success: false, error: data.error || 'Failed to send message' }
      }

      return {
        success: true,
        data: {
          ts: data.ts,
          channel: data.channel,
          message: data.message
        }
      }
    } catch (error) {
      console.error('Slack message send error:', error)
      return { success: false, error: 'Failed to send message' }
    }
  }

  // Send message via incoming webhook
  async sendWebhookMessage(webhookUrl: string, message: Partial<SlackMessage>): Promise<{
    success: boolean
    data?: any
    error?: string
  }> {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: message.text,
          username: message.username,
          icon_emoji: message.icon_emoji,
          icon_url: message.icon_url,
          attachments: message.attachments,
          blocks: message.blocks
        })
      })

      if (response.ok) {
        return { success: true, data: { status: 'sent' } }
      } else {
        const errorText = await response.text()
        return { success: false, error: `Webhook failed: ${errorText}` }
      }
    } catch (error) {
      console.error('Slack webhook error:', error)
      return { success: false, error: 'Failed to send webhook message' }
    }
  }

  // Create rich message for campaign completion
  createCampaignCompletedMessage(campaignData: any): SlackMessage {
    const stats = campaignData.stats || {}
    const openRate = stats.total_sent > 0 ? ((stats.opens || 0) / stats.total_sent * 100).toFixed(1) : '0'
    const clickRate = stats.total_sent > 0 ? ((stats.clicks || 0) / stats.total_sent * 100).toFixed(1) : '0'

    return {
      channel: '', // Will be set by caller
      text: `Campaign "${campaignData.name}" has completed!`,
      attachments: [
        {
          color: 'good',
          title: `📧 ${campaignData.name}`,
          title_link: `${process.env.NEXT_PUBLIC_APP_URL}/campaigns/${campaignData.id}`,
          fields: [
            {
              title: 'Total Sent',
              value: stats.total_sent?.toLocaleString() || '0',
              short: true
            },
            {
              title: 'Open Rate',
              value: `${openRate}%`,
              short: true
            },
            {
              title: 'Click Rate',
              value: `${clickRate}%`,
              short: true
            },
            {
              title: 'Replies',
              value: stats.replies?.toString() || '0',
              short: true
            }
          ],
          footer: 'ColdCopy',
          footer_icon: `${process.env.NEXT_PUBLIC_APP_URL}/icon-32.png`,
          ts: Math.floor(Date.now() / 1000)
        }
      ]
    }
  }

  // Create message for new reply
  createReplyMessage(replyData: any): SlackMessage {
    return {
      channel: '',
      text: `📬 New reply received!`,
      attachments: [
        {
          color: '#36a64f',
          title: `Reply from ${replyData.from_name || replyData.from_email}`,
          title_link: `${process.env.NEXT_PUBLIC_APP_URL}/inbox/${replyData.id}`,
          fields: [
            {
              title: 'Campaign',
              value: replyData.campaign_name || 'Unknown',
              short: true
            },
            {
              title: 'Lead',
              value: replyData.lead_name || replyData.from_email,
              short: true
            },
            {
              title: 'Subject',
              value: replyData.subject || 'No subject',
              short: false
            }
          ],
          text: replyData.preview || 'No preview available',
          footer: 'ColdCopy',
          footer_icon: `${process.env.NEXT_PUBLIC_APP_URL}/icon-32.png`,
          ts: Math.floor(Date.now() / 1000)
        }
      ]
    }
  }

  // Create error message
  createErrorMessage(errorData: any): SlackMessage {
    return {
      channel: '',
      text: `⚠️ Campaign Error`,
      attachments: [
        {
          color: 'danger',
          title: `Error in ${errorData.campaign_name || 'Unknown Campaign'}`,
          fields: [
            {
              title: 'Error Type',
              value: errorData.error_type || 'Unknown',
              short: true
            },
            {
              title: 'Affected Emails',
              value: errorData.affected_count?.toString() || 'Unknown',
              short: true
            }
          ],
          text: errorData.error_message || 'No details available',
          footer: 'ColdCopy',
          footer_icon: `${process.env.NEXT_PUBLIC_APP_URL}/icon-32.png`,
          ts: Math.floor(Date.now() / 1000)
        }
      ]
    }
  }

  // Refresh token (Slack tokens don't expire but this method is for consistency)
  async refreshToken(config: SlackConfig): Promise<{
    success: boolean
    config?: SlackConfig
    error?: string
  }> {
    // Slack access tokens don't expire, but we can test if they're still valid
    const testResult = await this.testConnection(config)
    
    if (testResult.success) {
      return { success: true, config }
    } else {
      return { success: false, error: 'Token is invalid and needs re-authorization' }
    }
  }
}