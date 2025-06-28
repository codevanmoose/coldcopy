// Gmail Integration Provider
import { WorkspaceIntegration } from '../integration-service'

export interface GmailConfig {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  scope: string
  email: string
  name?: string
}

export interface GmailLabel {
  id: string
  name: string
  type: 'system' | 'user'
  messageListVisibility: 'show' | 'hide'
  labelListVisibility: 'labelShow' | 'labelShowIfUnread' | 'labelHide'
  messagesTotal?: number
  messagesUnread?: number
  threadsTotal?: number
  threadsUnread?: number
}

export interface GmailMessage {
  id: string
  threadId: string
  labelIds: string[]
  snippet: string
  payload: {
    headers: Array<{ name: string; value: string }>
    body?: { data?: string; size: number }
    parts?: any[]
  }
  sizeEstimate: number
  historyId: string
  internalDate: string
}

export interface GmailThread {
  id: string
  snippet: string
  historyId: string
  messages: GmailMessage[]
}

export class GmailProvider {
  private baseUrl = 'https://gmail.googleapis.com/gmail/v1'
  private oauthUrl = 'https://oauth2.googleapis.com'

  // Get OAuth URL for Gmail authentication
  getOAuthUrl(redirectUri: string, state?: string): string {
    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.labels',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ].join(' ')

    const params = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
      redirect_uri: redirectUri,
      scope: scopes,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent'
    })

    if (state) {
      params.append('state', state)
    }

    return `${this.oauthUrl}/auth?${params.toString()}`
  }

  // Exchange OAuth code for access token
  async exchangeCodeForToken(code: string, redirectUri: string): Promise<{
    success: boolean
    config?: GmailConfig
    error?: string
  }> {
    try {
      const response = await fetch(`${this.oauthUrl}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri
        })
      })

      const tokenData = await response.json()

      if (!response.ok) {
        return { success: false, error: tokenData.error_description || 'OAuth exchange failed' }
      }

      // Get user info
      const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`
        }
      })

      const userData = await userResponse.json()

      const config: GmailConfig = {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_type: tokenData.token_type,
        expires_in: tokenData.expires_in,
        scope: tokenData.scope,
        email: userData.email,
        name: userData.name
      }

      return { success: true, config }
    } catch (error) {
      console.error('Gmail OAuth error:', error)
      return { success: false, error: 'Failed to exchange code for token' }
    }
  }

  // Refresh access token
  async refreshToken(config: GmailConfig): Promise<{
    success: boolean
    config?: GmailConfig
    error?: string
  }> {
    try {
      const response = await fetch(`${this.oauthUrl}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          refresh_token: config.refresh_token,
          grant_type: 'refresh_token'
        })
      })

      const tokenData = await response.json()

      if (!response.ok) {
        return { success: false, error: tokenData.error_description || 'Token refresh failed' }
      }

      const updatedConfig: GmailConfig = {
        ...config,
        access_token: tokenData.access_token,
        expires_in: tokenData.expires_in
      }

      return { success: true, config: updatedConfig }
    } catch (error) {
      console.error('Gmail token refresh error:', error)
      return { success: false, error: 'Failed to refresh token' }
    }
  }

  // Test Gmail connection
  async testConnection(config: GmailConfig): Promise<{
    success: boolean
    data?: any
    error?: string
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/users/me/profile`, {
        headers: {
          'Authorization': `Bearer ${config.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const error = await response.json()
        return { success: false, error: error.error?.message || 'Connection test failed' }
      }

      const data = await response.json()

      return {
        success: true,
        data: {
          email: data.emailAddress,
          messagesTotal: data.messagesTotal,
          threadsTotal: data.threadsTotal,
          historyId: data.historyId
        }
      }
    } catch (error) {
      console.error('Gmail connection test error:', error)
      return { success: false, error: 'Failed to test connection' }
    }
  }

  // Get labels
  async getLabels(config: GmailConfig): Promise<{
    success: boolean
    labels?: GmailLabel[]
    error?: string
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/users/me/labels`, {
        headers: {
          'Authorization': `Bearer ${config.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const error = await response.json()
        return { success: false, error: error.error?.message || 'Failed to fetch labels' }
      }

      const data = await response.json()

      const labels: GmailLabel[] = data.labels.map((label: any) => ({
        id: label.id,
        name: label.name,
        type: label.type,
        messageListVisibility: label.messageListVisibility,
        labelListVisibility: label.labelListVisibility,
        messagesTotal: label.messagesTotal,
        messagesUnread: label.messagesUnread,
        threadsTotal: label.threadsTotal,
        threadsUnread: label.threadsUnread
      }))

      return { success: true, labels }
    } catch (error) {
      console.error('Gmail labels fetch error:', error)
      return { success: false, error: 'Failed to fetch labels' }
    }
  }

  // Create label
  async createLabel(config: GmailConfig, labelName: string, options: {
    messageListVisibility?: 'show' | 'hide'
    labelListVisibility?: 'labelShow' | 'labelShowIfUnread' | 'labelHide'
  } = {}): Promise<{
    success: boolean
    label?: GmailLabel
    error?: string
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/users/me/labels`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: labelName,
          messageListVisibility: options.messageListVisibility || 'show',
          labelListVisibility: options.labelListVisibility || 'labelShow'
        })
      })

      if (!response.ok) {
        const error = await response.json()
        return { success: false, error: error.error?.message || 'Failed to create label' }
      }

      const data = await response.json()

      const label: GmailLabel = {
        id: data.id,
        name: data.name,
        type: data.type,
        messageListVisibility: data.messageListVisibility,
        labelListVisibility: data.labelListVisibility
      }

      return { success: true, label }
    } catch (error) {
      console.error('Gmail label creation error:', error)
      return { success: false, error: 'Failed to create label' }
    }
  }

  // Search messages
  async searchMessages(config: GmailConfig, query: string, options: {
    maxResults?: number
    pageToken?: string
    labelIds?: string[]
    includeSpamTrash?: boolean
  } = {}): Promise<{
    success: boolean
    messages?: GmailMessage[]
    nextPageToken?: string
    resultSizeEstimate?: number
    error?: string
  }> {
    try {
      const params = new URLSearchParams({
        q: query,
        maxResults: (options.maxResults || 10).toString(),
        includeSpamTrash: (options.includeSpamTrash || false).toString()
      })

      if (options.pageToken) {
        params.append('pageToken', options.pageToken)
      }

      if (options.labelIds && options.labelIds.length > 0) {
        options.labelIds.forEach(labelId => params.append('labelIds', labelId))
      }

      const response = await fetch(`${this.baseUrl}/users/me/messages?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${config.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const error = await response.json()
        return { success: false, error: error.error?.message || 'Failed to search messages' }
      }

      const data = await response.json()

      // Get full message details for each result
      const messages: GmailMessage[] = []
      if (data.messages) {
        for (const msgRef of data.messages.slice(0, 10)) { // Limit to avoid quota issues
          const msgResult = await this.getMessage(config, msgRef.id)
          if (msgResult.success && msgResult.message) {
            messages.push(msgResult.message)
          }
        }
      }

      return {
        success: true,
        messages,
        nextPageToken: data.nextPageToken,
        resultSizeEstimate: data.resultSizeEstimate
      }
    } catch (error) {
      console.error('Gmail message search error:', error)
      return { success: false, error: 'Failed to search messages' }
    }
  }

  // Get single message
  async getMessage(config: GmailConfig, messageId: string): Promise<{
    success: boolean
    message?: GmailMessage
    error?: string
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/users/me/messages/${messageId}`, {
        headers: {
          'Authorization': `Bearer ${config.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const error = await response.json()
        return { success: false, error: error.error?.message || 'Failed to get message' }
      }

      const message = await response.json()

      return { success: true, message }
    } catch (error) {
      console.error('Gmail message fetch error:', error)
      return { success: false, error: 'Failed to get message' }
    }
  }

  // Send email
  async sendEmail(config: GmailConfig, email: {
    to: string
    subject: string
    body: string
    isHtml?: boolean
    cc?: string
    bcc?: string
    replyTo?: string
  }): Promise<{
    success: boolean
    messageId?: string
    error?: string
  }> {
    try {
      // Construct email message
      const headers = [
        `To: ${email.to}`,
        `Subject: ${email.subject}`,
        `Content-Type: ${email.isHtml ? 'text/html' : 'text/plain'}; charset=utf-8`
      ]

      if (email.cc) headers.push(`Cc: ${email.cc}`)
      if (email.bcc) headers.push(`Bcc: ${email.bcc}`)
      if (email.replyTo) headers.push(`Reply-To: ${email.replyTo}`)

      const message = [
        ...headers,
        '',
        email.body
      ].join('\r\n')

      // Base64url encode the message
      const encodedMessage = btoa(message)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')

      const response = await fetch(`${this.baseUrl}/users/me/messages/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          raw: encodedMessage
        })
      })

      if (!response.ok) {
        const error = await response.json()
        return { success: false, error: error.error?.message || 'Failed to send email' }
      }

      const data = await response.json()

      return { success: true, messageId: data.id }
    } catch (error) {
      console.error('Gmail send error:', error)
      return { success: false, error: 'Failed to send email' }
    }
  }

  // Apply label to message
  async applyLabel(config: GmailConfig, messageId: string, labelIds: string[]): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/users/me/messages/${messageId}/modify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          addLabelIds: labelIds
        })
      })

      if (!response.ok) {
        const error = await response.json()
        return { success: false, error: error.error?.message || 'Failed to apply label' }
      }

      return { success: true }
    } catch (error) {
      console.error('Gmail label application error:', error)
      return { success: false, error: 'Failed to apply label' }
    }
  }

  // Remove label from message
  async removeLabel(config: GmailConfig, messageId: string, labelIds: string[]): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/users/me/messages/${messageId}/modify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          removeLabelIds: labelIds
        })
      })

      if (!response.ok) {
        const error = await response.json()
        return { success: false, error: error.error?.message || 'Failed to remove label' }
      }

      return { success: true }
    } catch (error) {
      console.error('Gmail label removal error:', error)
      return { success: false, error: 'Failed to remove label' }
    }
  }

  // Sync messages from Gmail (simplified version)
  async syncMessages(config: GmailConfig, options: {
    labelId?: string
    maxResults?: number
    query?: string
    lastHistoryId?: string
  } = {}): Promise<{
    success: boolean
    messages?: GmailMessage[]
    nextPageToken?: string
    historyId?: string
    error?: string
  }> {
    try {
      // If we have a history ID, use history API for incremental sync
      if (options.lastHistoryId) {
        return this.syncMessageHistory(config, options.lastHistoryId)
      }

      // Otherwise, do a full sync with search
      const query = options.query || (options.labelId ? `label:${options.labelId}` : 'in:inbox')
      return this.searchMessages(config, query, {
        maxResults: options.maxResults || 50
      })
    } catch (error) {
      console.error('Gmail sync error:', error)
      return { success: false, error: 'Failed to sync messages' }
    }
  }

  // Sync using Gmail history API
  private async syncMessageHistory(config: GmailConfig, startHistoryId: string): Promise<{
    success: boolean
    messages?: GmailMessage[]
    historyId?: string
    error?: string
  }> {
    try {
      const response = await fetch(
        `${this.baseUrl}/users/me/history?startHistoryId=${startHistoryId}&maxResults=100`,
        {
          headers: {
            'Authorization': `Bearer ${config.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (!response.ok) {
        const error = await response.json()
        return { success: false, error: error.error?.message || 'Failed to get message history' }
      }

      const data = await response.json()

      // Extract messages from history
      const messages: GmailMessage[] = []
      if (data.history) {
        for (const historyRecord of data.history) {
          if (historyRecord.messages) {
            for (const message of historyRecord.messages) {
              messages.push(message)
            }
          }
        }
      }

      return {
        success: true,
        messages,
        historyId: data.historyId
      }
    } catch (error) {
      console.error('Gmail history sync error:', error)
      return { success: false, error: 'Failed to sync message history' }
    }
  }

  // Extract email address from message headers
  extractEmailFromHeaders(headers: Array<{ name: string; value: string }>): string | null {
    const fromHeader = headers.find(h => h.name.toLowerCase() === 'from')
    if (!fromHeader) return null

    const match = fromHeader.value.match(/<(.+)>/)
    return match ? match[1] : fromHeader.value
  }

  // Extract subject from message headers
  extractSubjectFromHeaders(headers: Array<{ name: string; value: string }>): string | null {
    const subjectHeader = headers.find(h => h.name.toLowerCase() === 'subject')
    return subjectHeader?.value || null
  }
}