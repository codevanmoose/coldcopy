import { createClient } from '@/lib/supabase/client'

export interface SMSContact {
  id: string
  phoneNumber: string
  countryCode: string
  firstName?: string
  lastName?: string
  company?: string
  tags?: string[]
  customFields?: Record<string, any>
  status: 'active' | 'unsubscribed' | 'bounced' | 'invalid'
  carrier?: string
  region?: string
  timezone?: string
  lastMessageAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface SMSMessage {
  id: string
  conversationId: string
  fromNumber: string
  toNumber: string
  content: string
  messageType: 'text' | 'mms' | 'template'
  direction: 'inbound' | 'outbound'
  status: 'queued' | 'sent' | 'delivered' | 'failed' | 'undelivered' | 'received'
  statusDetails?: string
  mediaUrls?: string[]
  cost?: number
  segments: number
  createdAt: Date
  deliveredAt?: Date
  metadata?: {
    campaignId?: string
    templateId?: string
    errorCode?: string
    errorMessage?: string
    providerId?: string
  }
}

export interface SMSCampaign {
  id: string
  workspaceId: string
  name: string
  description?: string
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed'
  messageContent: string
  messageType: 'text' | 'mms' | 'template'
  mediaUrls?: string[]
  targetAudience: {
    tags?: string[]
    customFilters?: Record<string, any>
    excludeUnsubscribed: boolean
    includedContacts?: string[]
    excludedContacts?: string[]
  }
  scheduling: {
    sendNow: boolean
    scheduledAt?: Date
    timezone?: string
    respectQuietHours: boolean
    quietHoursStart?: string // HH:MM format
    quietHoursEnd?: string
    allowedDays?: string[] // ['monday', 'tuesday', ...]
  }
  personalization: {
    enabled: boolean
    fields: string[] // ['{firstName}', '{company}', ...]
    fallbackValues: Record<string, string>
  }
  limits: {
    dailyLimit?: number
    hourlyLimit?: number
    rateLimitPerMinute: number
  }
  analytics: {
    totalSent: number
    totalDelivered: number
    totalFailed: number
    totalReplies: number
    deliveryRate: number
    replyRate: number
    totalCost: number
    avgCostPerMessage: number
  }
  createdAt: Date
  updatedAt: Date
}

export interface SMSTemplate {
  id: string
  workspaceId: string
  name: string
  content: string
  messageType: 'text' | 'mms'
  mediaUrls?: string[]
  variables: string[]
  category: 'marketing' | 'transactional' | 'notification' | 'appointment'
  isApproved: boolean
  complianceNotes?: string
  usageCount: number
  lastUsedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface SMSAutomationRule {
  id: string
  workspaceId: string
  name: string
  description?: string
  trigger: {
    type: 'keyword_received' | 'new_contact' | 'tag_added' | 'date_based' | 'api_event' | 'opt_in'
    conditions: {
      keywords?: string[]
      tags?: string[]
      customFields?: Record<string, any>
      timeDelay?: number // minutes
    }
  }
  actions: Array<{
    type: 'send_message' | 'add_tag' | 'remove_tag' | 'update_field' | 'add_to_campaign' | 'send_webhook'
    templateId?: string
    customMessage?: string
    tags?: string[]
    fieldUpdates?: Record<string, any>
    webhookUrl?: string
    delay?: number // minutes
  }>
  isActive: boolean
  createdAt: Date
}

export interface SMSConversation {
  id: string
  workspaceId: string
  contactId: string
  contactNumber: string
  businessNumber: string
  status: 'active' | 'closed' | 'archived'
  lastMessageAt: Date
  lastMessageContent?: string
  lastMessageDirection: 'inbound' | 'outbound'
  unreadCount: number
  tags?: string[]
  assignedTo?: string
  notes?: string
  createdAt: Date
  updatedAt: Date
}

export interface SMSProvider {
  id: string
  name: string
  type: 'twilio' | 'aws_sns' | 'messagebird' | 'vonage' | 'bandwidth'
  isEnabled: boolean
  priority: number
  configuration: Record<string, any>
  supportedFeatures: string[]
  costPerSMS: number
  costPerMMS: number
}

export class SMSService {
  private supabase = createClient()
  private apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.coldcopy.cc'

  // Contact Management
  async getContacts(
    workspaceId: string,
    filters?: {
      search?: string
      tags?: string[]
      status?: string
      limit?: number
      offset?: number
    }
  ): Promise<{ contacts: SMSContact[]; total: number }> {
    const params = new URLSearchParams({ workspace_id: workspaceId })
    
    if (filters?.search) params.append('search', filters.search)
    if (filters?.tags?.length) params.append('tags', filters.tags.join(','))
    if (filters?.status) params.append('status', filters.status)
    if (filters?.limit) params.append('limit', filters.limit.toString())
    if (filters?.offset) params.append('offset', filters.offset.toString())

    const response = await fetch(`${this.apiBaseUrl}/sms/contacts?${params}`, {
      headers: {
        'Authorization': `Bearer ${await this.getToken()}`,
      },
    })

    if (!response.ok) {
      throw new Error('Failed to get SMS contacts')
    }

    return response.json()
  }

  async createContact(
    workspaceId: string,
    contact: Omit<SMSContact, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<SMSContact> {
    const response = await fetch(`${this.apiBaseUrl}/sms/contacts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        ...contact,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to create SMS contact')
    }

    return response.json()
  }

  async updateContact(
    workspaceId: string,
    contactId: string,
    updates: Partial<SMSContact>
  ): Promise<SMSContact> {
    const response = await fetch(`${this.apiBaseUrl}/sms/contacts/${contactId}`, {
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
      throw new Error('Failed to update SMS contact')
    }

    return response.json()
  }

  async deleteContact(workspaceId: string, contactId: string): Promise<{ success: boolean }> {
    const response = await fetch(`${this.apiBaseUrl}/sms/contacts/${contactId}`, {
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
      throw new Error('Failed to delete SMS contact')
    }

    return response.json()
  }

  async importContacts(
    workspaceId: string,
    contacts: Array<Omit<SMSContact, 'id' | 'createdAt' | 'updatedAt'>>,
    options?: {
      skipDuplicates?: boolean
      updateExisting?: boolean
      validateNumbers?: boolean
    }
  ): Promise<{ imported: number; failed: number; errors: string[] }> {
    const response = await fetch(`${this.apiBaseUrl}/sms/contacts/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        contacts,
        options,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to import SMS contacts')
    }

    return response.json()
  }

  // Messaging
  async sendMessage(
    workspaceId: string,
    message: {
      toNumber: string
      content: string
      mediaUrls?: string[]
      templateId?: string
      personalization?: Record<string, string>
      scheduledAt?: Date
    }
  ): Promise<SMSMessage> {
    const response = await fetch(`${this.apiBaseUrl}/sms/messages/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        ...message,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to send SMS message')
    }

    return response.json()
  }

  async getMessages(
    workspaceId: string,
    conversationId?: string,
    filters?: {
      phoneNumber?: string
      startDate?: Date
      endDate?: Date
      status?: string
      direction?: 'inbound' | 'outbound'
      limit?: number
      offset?: number
    }
  ): Promise<{ messages: SMSMessage[]; total: number }> {
    const params = new URLSearchParams({ workspace_id: workspaceId })
    
    if (conversationId) params.append('conversation_id', conversationId)
    if (filters?.phoneNumber) params.append('phone_number', filters.phoneNumber)
    if (filters?.startDate) params.append('start_date', filters.startDate.toISOString())
    if (filters?.endDate) params.append('end_date', filters.endDate.toISOString())
    if (filters?.status) params.append('status', filters.status)
    if (filters?.direction) params.append('direction', filters.direction)
    if (filters?.limit) params.append('limit', filters.limit.toString())
    if (filters?.offset) params.append('offset', filters.offset.toString())

    const response = await fetch(`${this.apiBaseUrl}/sms/messages?${params}`, {
      headers: {
        'Authorization': `Bearer ${await this.getToken()}`,
      },
    })

    if (!response.ok) {
      throw new Error('Failed to get SMS messages')
    }

    return response.json()
  }

  async getMessageStatus(
    workspaceId: string,
    messageId: string
  ): Promise<{ status: string; statusDetails?: string; deliveredAt?: Date; cost?: number }> {
    const response = await fetch(`${this.apiBaseUrl}/sms/messages/${messageId}/status`, {
      headers: {
        'Authorization': `Bearer ${await this.getToken()}`,
      },
    })

    if (!response.ok) {
      throw new Error('Failed to get SMS message status')
    }

    return response.json()
  }

  // Campaigns
  async createCampaign(
    workspaceId: string,
    campaign: Omit<SMSCampaign, 'id' | 'analytics' | 'createdAt' | 'updatedAt'>
  ): Promise<SMSCampaign> {
    const response = await fetch(`${this.apiBaseUrl}/sms/campaigns`, {
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
      throw new Error('Failed to create SMS campaign')
    }

    return response.json()
  }

  async getCampaigns(workspaceId: string, status?: string): Promise<SMSCampaign[]> {
    const params = new URLSearchParams({ workspace_id: workspaceId })
    if (status) params.append('status', status)

    const response = await fetch(`${this.apiBaseUrl}/sms/campaigns?${params}`, {
      headers: {
        'Authorization': `Bearer ${await this.getToken()}`,
      },
    })

    if (!response.ok) {
      throw new Error('Failed to get SMS campaigns')
    }

    return response.json()
  }

  async updateCampaign(
    workspaceId: string,
    campaignId: string,
    updates: Partial<SMSCampaign>
  ): Promise<SMSCampaign> {
    const response = await fetch(`${this.apiBaseUrl}/sms/campaigns/${campaignId}`, {
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
      throw new Error('Failed to update SMS campaign')
    }

    return response.json()
  }

  async startCampaign(workspaceId: string, campaignId: string): Promise<{ success: boolean }> {
    const response = await fetch(`${this.apiBaseUrl}/sms/campaigns/${campaignId}/start`, {
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
      throw new Error('Failed to start SMS campaign')
    }

    return response.json()
  }

  async pauseCampaign(workspaceId: string, campaignId: string): Promise<{ success: boolean }> {
    const response = await fetch(`${this.apiBaseUrl}/sms/campaigns/${campaignId}/pause`, {
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
      throw new Error('Failed to pause SMS campaign')
    }

    return response.json()
  }

  async getCampaignAnalytics(
    workspaceId: string,
    campaignId: string
  ): Promise<{
    totalSent: number
    totalDelivered: number
    totalFailed: number
    totalReplies: number
    deliveryRate: number
    replyRate: number
    totalCost: number
    timeline: Array<{ date: string; sent: number; delivered: number; cost: number }>
  }> {
    const response = await fetch(
      `${this.apiBaseUrl}/sms/campaigns/${campaignId}/analytics?workspace_id=${workspaceId}`,
      {
        headers: {
          'Authorization': `Bearer ${await this.getToken()}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error('Failed to get SMS campaign analytics')
    }

    return response.json()
  }

  // Templates
  async createTemplate(
    workspaceId: string,
    template: Omit<SMSTemplate, 'id' | 'usageCount' | 'lastUsedAt' | 'createdAt' | 'updatedAt'>
  ): Promise<SMSTemplate> {
    const response = await fetch(`${this.apiBaseUrl}/sms/templates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        ...template,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to create SMS template')
    }

    return response.json()
  }

  async getTemplates(workspaceId: string, category?: string): Promise<SMSTemplate[]> {
    const params = new URLSearchParams({ workspace_id: workspaceId })
    if (category) params.append('category', category)

    const response = await fetch(`${this.apiBaseUrl}/sms/templates?${params}`, {
      headers: {
        'Authorization': `Bearer ${await this.getToken()}`,
      },
    })

    if (!response.ok) {
      throw new Error('Failed to get SMS templates')
    }

    return response.json()
  }

  // Conversations
  async getConversations(
    workspaceId: string,
    filters?: {
      status?: string
      assignedTo?: string
      tags?: string[]
      unreadOnly?: boolean
      limit?: number
      offset?: number
    }
  ): Promise<{ conversations: SMSConversation[]; total: number }> {
    const params = new URLSearchParams({ workspace_id: workspaceId })
    
    if (filters?.status) params.append('status', filters.status)
    if (filters?.assignedTo) params.append('assigned_to', filters.assignedTo)
    if (filters?.tags?.length) params.append('tags', filters.tags.join(','))
    if (filters?.unreadOnly) params.append('unread_only', 'true')
    if (filters?.limit) params.append('limit', filters.limit.toString())
    if (filters?.offset) params.append('offset', filters.offset.toString())

    const response = await fetch(`${this.apiBaseUrl}/sms/conversations?${params}`, {
      headers: {
        'Authorization': `Bearer ${await this.getToken()}`,
      },
    })

    if (!response.ok) {
      throw new Error('Failed to get SMS conversations')
    }

    return response.json()
  }

  async updateConversation(
    workspaceId: string,
    conversationId: string,
    updates: Partial<SMSConversation>
  ): Promise<SMSConversation> {
    const response = await fetch(`${this.apiBaseUrl}/sms/conversations/${conversationId}`, {
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
      throw new Error('Failed to update SMS conversation')
    }

    return response.json()
  }

  // Automation
  async createAutomationRule(
    workspaceId: string,
    rule: Omit<SMSAutomationRule, 'id' | 'createdAt'>
  ): Promise<SMSAutomationRule> {
    const response = await fetch(`${this.apiBaseUrl}/sms/automation/rules`, {
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
      throw new Error('Failed to create SMS automation rule')
    }

    return response.json()
  }

  async getAutomationRules(workspaceId: string): Promise<SMSAutomationRule[]> {
    const response = await fetch(
      `${this.apiBaseUrl}/sms/automation/rules?workspace_id=${workspaceId}`,
      {
        headers: {
          'Authorization': `Bearer ${await this.getToken()}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error('Failed to get SMS automation rules')
    }

    return response.json()
  }

  // Analytics
  async getAnalytics(
    workspaceId: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<{
    totalContacts: number
    totalMessages: number
    totalCost: number
    deliveryRate: number
    replyRate: number
    optOutRate: number
    messagesByDay: Array<{ date: string; sent: number; delivered: number; cost: number }>
    topPerformingCampaigns: Array<{ id: string; name: string; deliveryRate: number; replyRate: number }>
  }> {
    const params = new URLSearchParams({ workspace_id: workspaceId })
    
    if (timeRange) {
      params.append('start_date', timeRange.start.toISOString())
      params.append('end_date', timeRange.end.toISOString())
    }

    const response = await fetch(`${this.apiBaseUrl}/sms/analytics?${params}`, {
      headers: {
        'Authorization': `Bearer ${await this.getToken()}`,
      },
    })

    if (!response.ok) {
      throw new Error('Failed to get SMS analytics')
    }

    return response.json()
  }

  // Compliance
  async handleOptOut(
    workspaceId: string,
    phoneNumber: string,
    keyword?: string
  ): Promise<{ success: boolean }> {
    const response = await fetch(`${this.apiBaseUrl}/sms/compliance/opt-out`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        phone_number: phoneNumber,
        keyword,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to handle SMS opt-out')
    }

    return response.json()
  }

  async handleOptIn(
    workspaceId: string,
    phoneNumber: string,
    keyword?: string,
    doubleOptIn = false
  ): Promise<{ success: boolean }> {
    const response = await fetch(`${this.apiBaseUrl}/sms/compliance/opt-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        phone_number: phoneNumber,
        keyword,
        double_opt_in: doubleOptIn,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to handle SMS opt-in')
    }

    return response.json()
  }

  async validatePhoneNumber(
    workspaceId: string,
    phoneNumber: string
  ): Promise<{
    isValid: boolean
    formattedNumber: string
    carrier?: string
    region?: string
    type?: 'mobile' | 'landline' | 'voip'
  }> {
    const response = await fetch(`${this.apiBaseUrl}/sms/validation/phone`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        phone_number: phoneNumber,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to validate phone number')
    }

    return response.json()
  }

  private async getToken(): Promise<string> {
    const { data: { session } } = await this.supabase.auth.getSession()
    return session?.access_token || ''
  }
}

// Export singleton instance
export const smsService = new SMSService()