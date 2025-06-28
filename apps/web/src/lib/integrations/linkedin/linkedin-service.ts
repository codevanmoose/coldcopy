import { createClient } from '@/lib/supabase/client'

export interface LinkedInProfile {
  id: string
  firstName: string
  lastName: string
  headline: string
  profilePicture?: string
  profileUrl: string
  location?: string
  industry?: string
  connectionDegree: 'FIRST' | 'SECOND' | 'THIRD' | 'OUT_OF_NETWORK'
  companyName?: string
  companyPosition?: string
  mutualConnections?: number
  skills?: string[]
  contactInfo?: {
    email?: string
    phone?: string
    website?: string
  }
}

export interface LinkedInMessage {
  id: string
  conversationId: string
  from: string
  to: string
  content: string
  timestamp: Date
  messageType: 'TEXT' | 'MEDIA' | 'DOCUMENT'
  status: 'sent' | 'delivered' | 'read' | 'failed'
  metadata?: {
    threadId?: string
    subject?: string
    attachments?: Array<{
      type: string
      url: string
      name: string
    }>
  }
}

export interface LinkedInCampaign {
  id: string
  workspaceId: string
  name: string
  description?: string
  status: 'draft' | 'active' | 'paused' | 'completed'
  targetAudience: {
    jobTitles?: string[]
    companies?: string[]
    industries?: string[]
    locations?: string[]
    connectionDegree?: ('FIRST' | 'SECOND' | 'THIRD')[]
    keywords?: string[]
  }
  messageTemplate: string
  personalizationFields: string[]
  sequence: Array<{
    step: number
    delay: number // hours
    message: string
    action: 'connection_request' | 'message' | 'follow_up'
  }>
  limits: {
    dailyConnections: number
    dailyMessages: number
    weeklyLimit: number
  }
  analytics: {
    profilesViewed: number
    connectionsSent: number
    connectionsAccepted: number
    messagesSent: number
    messagesReplied: number
    acceptanceRate: number
    replyRate: number
  }
  createdAt: Date
  updatedAt: Date
}

export interface LinkedInConnectionRequest {
  id: string
  campaignId: string
  profileId: string
  profileUrl: string
  status: 'pending' | 'accepted' | 'ignored' | 'withdrawn'
  message?: string
  sentAt: Date
  respondedAt?: Date
  metadata?: any
}

export interface LinkedInAutomationRule {
  id: string
  workspaceId: string
  name: string
  trigger: {
    type: 'profile_visit' | 'connection_accepted' | 'message_received' | 'post_engagement'
    conditions?: any
  }
  actions: Array<{
    type: 'send_message' | 'send_connection' | 'like_post' | 'comment_post' | 'follow_company'
    delay?: number
    template?: string
    parameters?: any
  }>
  isActive: boolean
  createdAt: Date
}

export class LinkedInService {
  private supabase = createClient()
  private apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.coldcopy.cc'

  async getAuthUrl(workspaceId: string, redirectUri: string): Promise<string> {
    const response = await fetch(`${this.apiBaseUrl}/linkedin/auth/url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        redirect_uri: redirectUri,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to get LinkedIn auth URL')
    }

    const data = await response.json()
    return data.authUrl
  }

  async handleAuthCallback(
    workspaceId: string,
    code: string,
    state: string
  ): Promise<{ success: boolean; profile?: any }> {
    const response = await fetch(`${this.apiBaseUrl}/linkedin/auth/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        code,
        state,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to complete LinkedIn authentication')
    }

    return response.json()
  }

  async searchProfiles(
    workspaceId: string,
    criteria: {
      keywords?: string
      jobTitles?: string[]
      companies?: string[]
      industries?: string[]
      locations?: string[]
      connectionDegree?: ('FIRST' | 'SECOND' | 'THIRD')[]
      limit?: number
      offset?: number
    }
  ): Promise<{ profiles: LinkedInProfile[]; total: number; hasMore: boolean }> {
    const response = await fetch(`${this.apiBaseUrl}/linkedin/profiles/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        ...criteria,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to search LinkedIn profiles')
    }

    return response.json()
  }

  async getProfile(workspaceId: string, profileId: string): Promise<LinkedInProfile> {
    const response = await fetch(`${this.apiBaseUrl}/linkedin/profiles/${profileId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${await this.getToken()}`,
      },
    })

    if (!response.ok) {
      throw new Error('Failed to get LinkedIn profile')
    }

    return response.json()
  }

  async sendConnectionRequest(
    workspaceId: string,
    profileId: string,
    message?: string
  ): Promise<LinkedInConnectionRequest> {
    const response = await fetch(`${this.apiBaseUrl}/linkedin/connections/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        profile_id: profileId,
        message,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to send LinkedIn connection request')
    }

    return response.json()
  }

  async sendMessage(
    workspaceId: string,
    profileId: string,
    message: string,
    threadId?: string
  ): Promise<LinkedInMessage> {
    const response = await fetch(`${this.apiBaseUrl}/linkedin/messages/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        profile_id: profileId,
        message,
        thread_id: threadId,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to send LinkedIn message')
    }

    return response.json()
  }

  async getConversations(
    workspaceId: string,
    limit = 50,
    offset = 0
  ): Promise<{ conversations: any[]; total: number }> {
    const response = await fetch(
      `${this.apiBaseUrl}/linkedin/conversations?workspace_id=${workspaceId}&limit=${limit}&offset=${offset}`,
      {
        headers: {
          'Authorization': `Bearer ${await this.getToken()}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error('Failed to get LinkedIn conversations')
    }

    return response.json()
  }

  async getMessages(
    workspaceId: string,
    conversationId: string,
    limit = 50
  ): Promise<LinkedInMessage[]> {
    const response = await fetch(
      `${this.apiBaseUrl}/linkedin/conversations/${conversationId}/messages?workspace_id=${workspaceId}&limit=${limit}`,
      {
        headers: {
          'Authorization': `Bearer ${await this.getToken()}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error('Failed to get LinkedIn messages')
    }

    return response.json()
  }

  async createCampaign(workspaceId: string, campaign: Omit<LinkedInCampaign, 'id' | 'analytics' | 'createdAt' | 'updatedAt'>): Promise<LinkedInCampaign> {
    const response = await fetch(`${this.apiBaseUrl}/linkedin/campaigns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        ...campaign,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to create LinkedIn campaign')
    }

    return response.json()
  }

  async getCampaigns(workspaceId: string): Promise<LinkedInCampaign[]> {
    const response = await fetch(
      `${this.apiBaseUrl}/linkedin/campaigns?workspace_id=${workspaceId}`,
      {
        headers: {
          'Authorization': `Bearer ${await this.getToken()}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error('Failed to get LinkedIn campaigns')
    }

    return response.json()
  }

  async updateCampaign(
    workspaceId: string,
    campaignId: string,
    updates: Partial<LinkedInCampaign>
  ): Promise<LinkedInCampaign> {
    const response = await fetch(`${this.apiBaseUrl}/linkedin/campaigns/${campaignId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        ...updates,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to update LinkedIn campaign')
    }

    return response.json()
  }

  async startCampaign(workspaceId: string, campaignId: string): Promise<{ success: boolean }> {
    const response = await fetch(`${this.apiBaseUrl}/linkedin/campaigns/${campaignId}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to start LinkedIn campaign')
    }

    return response.json()
  }

  async pauseCampaign(workspaceId: string, campaignId: string): Promise<{ success: boolean }> {
    const response = await fetch(`${this.apiBaseUrl}/linkedin/campaigns/${campaignId}/pause`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to pause LinkedIn campaign')
    }

    return response.json()
  }

  async getCampaignAnalytics(
    workspaceId: string,
    campaignId: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<any> {
    const params = new URLSearchParams({
      workspace_id: workspaceId,
    })

    if (timeRange) {
      params.append('start_date', timeRange.start.toISOString())
      params.append('end_date', timeRange.end.toISOString())
    }

    const response = await fetch(
      `${this.apiBaseUrl}/linkedin/campaigns/${campaignId}/analytics?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${await this.getToken()}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error('Failed to get LinkedIn campaign analytics')
    }

    return response.json()
  }

  async createAutomationRule(
    workspaceId: string,
    rule: Omit<LinkedInAutomationRule, 'id' | 'createdAt'>
  ): Promise<LinkedInAutomationRule> {
    const response = await fetch(`${this.apiBaseUrl}/linkedin/automation/rules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        ...rule,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to create LinkedIn automation rule')
    }

    return response.json()
  }

  async getAutomationRules(workspaceId: string): Promise<LinkedInAutomationRule[]> {
    const response = await fetch(
      `${this.apiBaseUrl}/linkedin/automation/rules?workspace_id=${workspaceId}`,
      {
        headers: {
          'Authorization': `Bearer ${await this.getToken()}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error('Failed to get LinkedIn automation rules')
    }

    return response.json()
  }

  async updateAutomationRule(
    workspaceId: string,
    ruleId: string,
    updates: Partial<LinkedInAutomationRule>
  ): Promise<LinkedInAutomationRule> {
    const response = await fetch(`${this.apiBaseUrl}/linkedin/automation/rules/${ruleId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        ...updates,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to update LinkedIn automation rule')
    }

    return response.json()
  }

  async deleteAutomationRule(workspaceId: string, ruleId: string): Promise<{ success: boolean }> {
    const response = await fetch(`${this.apiBaseUrl}/linkedin/automation/rules/${ruleId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to delete LinkedIn automation rule')
    }

    return response.json()
  }

  async engageWithPost(
    workspaceId: string,
    postId: string,
    action: 'like' | 'comment' | 'share',
    content?: string
  ): Promise<{ success: boolean }> {
    const response = await fetch(`${this.apiBaseUrl}/linkedin/posts/${postId}/engage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        action,
        content,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to engage with LinkedIn post')
    }

    return response.json()
  }

  async getConnectionRequests(
    workspaceId: string,
    status?: 'pending' | 'accepted' | 'ignored'
  ): Promise<LinkedInConnectionRequest[]> {
    const params = new URLSearchParams({ workspace_id: workspaceId })
    if (status) {
      params.append('status', status)
    }

    const response = await fetch(
      `${this.apiBaseUrl}/linkedin/connections?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${await this.getToken()}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error('Failed to get LinkedIn connection requests')
    }

    return response.json()
  }

  async withdrawConnectionRequest(
    workspaceId: string,
    connectionId: string
  ): Promise<{ success: boolean }> {
    const response = await fetch(`${this.apiBaseUrl}/linkedin/connections/${connectionId}/withdraw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to withdraw LinkedIn connection request')
    }

    return response.json()
  }

  async getDailyLimits(workspaceId: string): Promise<{
    connections: { sent: number; limit: number }
    messages: { sent: number; limit: number }
    profileViews: { count: number; limit: number }
  }> {
    const response = await fetch(
      `${this.apiBaseUrl}/linkedin/limits?workspace_id=${workspaceId}`,
      {
        headers: {
          'Authorization': `Bearer ${await this.getToken()}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error('Failed to get LinkedIn daily limits')
    }

    return response.json()
  }

  private async getToken(): Promise<string> {
    const { data: { session } } = await this.supabase.auth.getSession()
    return session?.access_token || ''
  }
}

// Export singleton instance
export const linkedInService = new LinkedInService()