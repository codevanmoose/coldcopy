import { createClient } from '@/lib/supabase/client'
import { logApiError, logger } from '@/lib/logger'

interface ApiClientOptions {
  baseUrl?: string
  headers?: Record<string, string>
}

interface ApiResponse<T = any> {
  data?: T
  error?: string
  status: number
}

class ApiClient {
  private baseUrl: string
  private defaultHeaders: Record<string, string>

  constructor(options: ApiClientOptions = {}) {
    // Use relative URLs for Next.js API routes
    this.baseUrl = options.baseUrl || '/api'
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...options.headers,
    }
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    if (session?.access_token) {
      return {
        'Authorization': `Bearer ${session.access_token}`,
      }
    }
    
    return {}
  }

  private async request<T = any>(
    method: string,
    path: string,
    options: {
      body?: any
      headers?: Record<string, string>
      params?: Record<string, string>
    } = {}
  ): Promise<ApiResponse<T>> {
    const timer = logger.startTimer(`API ${method} ${path}`)
    
    try {
      // Handle relative URLs for Next.js API routes
      const url = path.startsWith('http') 
        ? new URL(path) 
        : new URL(this.baseUrl + path, typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')
      
      // Add query params if provided
      if (options.params) {
        Object.entries(options.params).forEach(([key, value]) => {
          url.searchParams.append(key, value)
        })
      }

      // Get auth headers
      const authHeaders = await this.getAuthHeaders()

      logger.debug(`API Request: ${method} ${url.toString()}`, {
        headers: options.headers,
        hasBody: !!options.body,
      })

      const response = await fetch(url.toString(), {
        method,
        headers: {
          ...this.defaultHeaders,
          ...authHeaders,
          ...options.headers,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      })

      const contentType = response.headers.get('content-type')
      let data: any = null

      if (contentType?.includes('application/json')) {
        data = await response.json()
      } else if (contentType?.includes('text/')) {
        data = await response.text()
      }

      timer({ status: response.status })

      if (!response.ok) {
        const error = {
          error: data?.error || data?.message || `Request failed with status ${response.status}`,
          status: response.status,
        }
        
        logApiError(path, error, options.body)
        
        return error
      }

      logger.debug(`API Response: ${method} ${path}`, {
        status: response.status,
        hasData: !!data,
      })

      return {
        data,
        status: response.status,
      }
    } catch (error) {
      timer({ error: true })
      
      logApiError(path, error, options.body)
      
      return {
        error: error instanceof Error ? error.message : 'Network error',
        status: 0,
      }
    }
  }

  async get<T = any>(path: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>('GET', path, { params })
  }

  async post<T = any>(path: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>('POST', path, { body })
  }

  async put<T = any>(path: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', path, { body })
  }

  async patch<T = any>(path: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', path, { body })
  }

  async delete<T = any>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', path)
  }
}

// Create a singleton instance
export const apiClient = new ApiClient()

// Export the class for custom instances
export { ApiClient }

// Convenience methods for common API calls
export const api = {
  // Auth
  auth: {
    login: (email: string, password: string) => 
      apiClient.post('/auth/login', { email, password }),
    logout: () => 
      apiClient.post('/auth/logout'),
    refreshToken: () => 
      apiClient.post('/auth/refresh'),
  },

  // Workspaces
  workspaces: {
    list: () => 
      apiClient.get('/workspaces'),
    get: (id: string) => 
      apiClient.get(`/workspaces/${id}`),
    create: (data: any) => 
      apiClient.post('/workspaces', data),
    update: (id: string, data: any) => 
      apiClient.patch(`/workspaces/${id}`, data),
    delete: (id: string) => 
      apiClient.delete(`/workspaces/${id}`),
  },

  // Leads
  leads: {
    list: (workspaceId: string, params?: any) => 
      apiClient.get(`/workspaces/${workspaceId}/leads`, params),
    get: (workspaceId: string, id: string) => 
      apiClient.get(`/workspaces/${workspaceId}/leads/${id}`),
    create: (workspaceId: string, data: any) => 
      apiClient.post(`/workspaces/${workspaceId}/leads`, data),
    update: (workspaceId: string, id: string, data: any) => 
      apiClient.patch(`/workspaces/${workspaceId}/leads/${id}`, data),
    delete: (workspaceId: string, id: string) => 
      apiClient.delete(`/workspaces/${workspaceId}/leads/${id}`),
    import: (workspaceId: string, file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      return apiClient.post(`/workspaces/${workspaceId}/leads/import`, formData)
    },
  },

  // Campaigns
  campaigns: {
    list: (workspaceId: string, params?: any) => 
      apiClient.get(`/workspaces/${workspaceId}/campaigns`, params),
    get: (workspaceId: string, id: string) => 
      apiClient.get(`/workspaces/${workspaceId}/campaigns/${id}`),
    getWithDetails: (workspaceId: string, id: string) => 
      apiClient.get(`/workspaces/${workspaceId}/campaigns/${id}/details`),
    create: (workspaceId: string, data: any) => 
      apiClient.post(`/workspaces/${workspaceId}/campaigns`, data),
    update: (workspaceId: string, id: string, data: any) => 
      apiClient.patch(`/workspaces/${workspaceId}/campaigns/${id}`, data),
    delete: (workspaceId: string, id: string) => 
      apiClient.delete(`/workspaces/${workspaceId}/campaigns/${id}`),
    start: (workspaceId: string, id: string) => 
      apiClient.post(`/workspaces/${workspaceId}/campaigns/${id}/start`),
    pause: (workspaceId: string, id: string) => 
      apiClient.post(`/workspaces/${workspaceId}/campaigns/${id}/pause`),
    resume: (workspaceId: string, id: string) => 
      apiClient.post(`/workspaces/${workspaceId}/campaigns/${id}/resume`),
  },

  // Email warm-up
  warmup: {
    pools: {
      list: (workspaceId: string) => 
        apiClient.get(`/workspaces/${workspaceId}/warmup/pools`),
      get: (workspaceId: string, id: string) => 
        apiClient.get(`/workspaces/${workspaceId}/warmup/pools/${id}`),
      create: (workspaceId: string, data: any) => 
        apiClient.post(`/workspaces/${workspaceId}/warmup/pools`, data),
      update: (workspaceId: string, id: string, data: any) => 
        apiClient.patch(`/workspaces/${workspaceId}/warmup/pools/${id}`, data),
      delete: (workspaceId: string, id: string) => 
        apiClient.delete(`/workspaces/${workspaceId}/warmup/pools/${id}`),
    },
    campaigns: {
      list: (workspaceId: string) => 
        apiClient.get(`/workspaces/${workspaceId}/warmup/campaigns`),
      get: (workspaceId: string, id: string) => 
        apiClient.get(`/workspaces/${workspaceId}/warmup/campaigns/${id}`),
      create: (workspaceId: string, data: any) => 
        apiClient.post(`/workspaces/${workspaceId}/warmup/campaigns`, data),
      start: (workspaceId: string, id: string) => 
        apiClient.post(`/workspaces/${workspaceId}/warmup/campaigns/${id}/start`),
      pause: (workspaceId: string, id: string) => 
        apiClient.post(`/workspaces/${workspaceId}/warmup/campaigns/${id}/pause`),
      stats: (workspaceId: string, id: string) => 
        apiClient.get(`/workspaces/${workspaceId}/warmup/campaigns/${id}/stats`),
    },
  },

  // Email sending
  email: {
    send: (data: any) => 
      apiClient.post('/email/send', data),
    verify: (email: string) => 
      apiClient.post('/email/verify', { email }),
  },

  // Billing & Subscriptions
  billing: {
    subscription: {
      get: () => 
        apiClient.get('/billing/subscription'),
      create: (data: any) => 
        apiClient.post('/billing/subscription', data),
      update: (data: any) => 
        apiClient.patch('/billing/subscription', data),
      cancel: (data?: any) => 
        apiClient.delete('/billing/subscription', data),
      preview: (data: any) => 
        apiClient.post('/billing/subscription/preview', data),
    },
    plans: {
      list: () => 
        apiClient.get('/billing/plans'),
    },
    paymentMethods: {
      list: () => 
        apiClient.get('/billing/payment-methods'),
      create: (data: any) => 
        apiClient.post('/billing/payment-methods', data),
      delete: (id: string) => 
        apiClient.delete(`/billing/payment-methods/${id}`),
    },
    usage: {
      get: (params?: any) => 
        apiClient.get('/billing/usage', params),
    },
    portal: {
      create: () => 
        apiClient.post('/billing/portal'),
    },
    trial: {
      get: () => 
        apiClient.get('/billing/trial'),
      extend: (data: any) => 
        apiClient.post('/billing/trial', data),
    },
  },

  // Analytics
  analytics: {
    overview: (workspaceId: string, params?: any) => 
      apiClient.get(`/workspaces/${workspaceId}/analytics/overview`, params),
    campaigns: (workspaceId: string, params?: any) => 
      apiClient.get(`/workspaces/${workspaceId}/analytics/campaigns`, params),
    leads: (workspaceId: string, params?: any) => 
      apiClient.get(`/workspaces/${workspaceId}/analytics/leads`, params),
    emailEvents: (workspaceId: string, emailId: string) => 
      apiClient.get(`/workspaces/${workspaceId}/analytics/emails/${emailId}/events`),
    campaignTracking: (workspaceId: string, campaignId: string) => 
      apiClient.get(`/workspaces/${workspaceId}/analytics/campaigns/${campaignId}/tracking`),
    
    // Advanced Analytics
    advanced: (params?: any) =>
      apiClient.get('/analytics/advanced', params),
    exportAdvanced: (data: any) =>
      apiClient.post('/analytics/advanced', data),
  },

  // Multi-Channel Outreach
  multiChannel: {
    campaigns: {
      list: (params?: any) =>
        apiClient.get('/campaigns/multi-channel', params),
      create: (data: any) =>
        apiClient.post('/campaigns/multi-channel', data),
      get: (campaignId: string, params?: any) =>
        apiClient.get(`/campaigns/multi-channel/${campaignId}`, params),
      update: (campaignId: string, data: any) =>
        apiClient.patch(`/campaigns/multi-channel/${campaignId}`, data),
      start: (campaignId: string) =>
        apiClient.post(`/campaigns/multi-channel/${campaignId}/start`),
      pause: (campaignId: string) =>
        apiClient.post(`/campaigns/multi-channel/${campaignId}/pause`),
      analytics: (campaignId: string, params?: any) =>
        apiClient.get(`/campaigns/multi-channel/${campaignId}/analytics`, params),
    },
    channels: {
      linkedin: {
        connect: (workspaceId: string, data: any) =>
          apiClient.post(`/workspaces/${workspaceId}/linkedin/connect`, data),
        campaigns: (workspaceId: string) =>
          apiClient.get(`/workspaces/${workspaceId}/linkedin/campaigns`),
        send: (workspaceId: string, data: any) =>
          apiClient.post(`/workspaces/${workspaceId}/linkedin/send`, data),
      },
      twitter: {
        connect: (workspaceId: string, data: any) =>
          apiClient.post(`/workspaces/${workspaceId}/twitter/connect`, data),
        campaigns: (workspaceId: string) =>
          apiClient.get(`/workspaces/${workspaceId}/twitter/campaigns`),
        send: (workspaceId: string, data: any) =>
          apiClient.post(`/workspaces/${workspaceId}/twitter/send`, data),
      },
      sms: {
        connect: (workspaceId: string, data: any) =>
          apiClient.post(`/workspaces/${workspaceId}/sms/connect`, data),
        campaigns: (workspaceId: string) =>
          apiClient.get(`/workspaces/${workspaceId}/sms/campaigns`),
        send: (workspaceId: string, data: any) =>
          apiClient.post(`/workspaces/${workspaceId}/sms/send`, data),
      },
    },
  },

  // LinkedIn
  linkedin: {
    profiles: {
      search: (workspaceId: string, query: string) => 
        apiClient.get(`/workspaces/${workspaceId}/linkedin/profiles/search`, { q: query }),
      import: (workspaceId: string, profileUrl: string) => 
        apiClient.post(`/workspaces/${workspaceId}/linkedin/profiles/import`, { profileUrl }),
    },
    messages: {
      send: (workspaceId: string, data: any) => 
        apiClient.post(`/workspaces/${workspaceId}/linkedin/messages`, data),
    },
    engagement: {
      track: (workspaceId: string, data: any) => 
        apiClient.post(`/workspaces/${workspaceId}/linkedin/engagement`, data),
      analytics: (workspaceId: string, params?: any) => 
        apiClient.get(`/workspaces/${workspaceId}/linkedin/analytics`, params),
    },
  },

  // Sales Intelligence
  salesIntelligence: {
    signals: (workspaceId: string, params?: any) => 
      apiClient.get(`/workspaces/${workspaceId}/sales-intelligence/signals`, params),
    visitors: (workspaceId: string, params?: any) => 
      apiClient.get(`/workspaces/${workspaceId}/sales-intelligence/visitors`, params),
    score: (workspaceId: string, leadId: string) => 
      apiClient.get(`/workspaces/${workspaceId}/sales-intelligence/score/${leadId}`),
  },

  // Email Deliverability
  deliverability: {
    analyze: (workspaceId: string, content: string) => 
      apiClient.post(`/workspaces/${workspaceId}/deliverability/analyze`, { content }),
    reputation: (workspaceId: string, domain: string) => 
      apiClient.get(`/workspaces/${workspaceId}/deliverability/reputation/${domain}`),
    test: (workspaceId: string, data: any) => 
      apiClient.post(`/workspaces/${workspaceId}/deliverability/test`, data),
  },

  // Smart Reply
  smartReply: {
    suggestions: (workspaceId: string, messageId: string) => 
      apiClient.get(`/workspaces/${workspaceId}/smart-reply/suggestions/${messageId}`),
    generate: (workspaceId: string, data: any) => 
      apiClient.post(`/workspaces/${workspaceId}/smart-reply/generate`, data),
  },

  // Inbox
  inbox: {
    threads: {
      list: (workspaceId: string, params?: any) => 
        apiClient.get(`/workspaces/${workspaceId}/inbox/threads`, params),
      get: (workspaceId: string, threadId: string) => 
        apiClient.get(`/workspaces/${workspaceId}/inbox/threads/${threadId}`),
      update: (workspaceId: string, threadId: string, data: any) => 
        apiClient.patch(`/workspaces/${workspaceId}/inbox/threads/${threadId}`, data),
      markRead: (workspaceId: string, threadId: string) => 
        apiClient.post(`/workspaces/${workspaceId}/inbox/threads/${threadId}/mark-read`),
    },
    messages: {
      list: (workspaceId: string, threadId: string) => 
        apiClient.get(`/workspaces/${workspaceId}/inbox/threads/${threadId}/messages`),
      send: (workspaceId: string, threadId: string, data: any) => 
        apiClient.post(`/workspaces/${workspaceId}/inbox/threads/${threadId}/messages`, data),
    },
  },

  // Sentiment Analysis
  sentiment: {
    analyze: (workspaceId: string, text: string) => 
      apiClient.post(`/workspaces/${workspaceId}/sentiment/analyze`, { text }),
    conversation: (workspaceId: string, conversationId: string) => 
      apiClient.get(`/workspaces/${workspaceId}/sentiment/conversation/${conversationId}`),
  },

  // Meeting Scheduler
  meetings: {
    availability: (workspaceId: string, params?: any) => 
      apiClient.get(`/workspaces/${workspaceId}/meetings/availability`, params),
    schedule: (workspaceId: string, data: any) => 
      apiClient.post(`/workspaces/${workspaceId}/meetings/schedule`, data),
    reschedule: (workspaceId: string, meetingId: string, data: any) => 
      apiClient.patch(`/workspaces/${workspaceId}/meetings/${meetingId}`, data),
    cancel: (workspaceId: string, meetingId: string) => 
      apiClient.delete(`/workspaces/${workspaceId}/meetings/${meetingId}`),
  },

  // Advanced AI Features
  ai: {
    generateEmail: (data: any) => 
      apiClient.post('/ai/generate-email', data),
    analyzeImages: (data: any) => 
      apiClient.post('/ai/analyze-images', data),
    optimizeEmail: (data: any) => 
      apiClient.post('/ai/optimize-email', data),
  },

  // Admin Dashboard
  admin: {
    getSystemMetrics: () => 
      apiClient.get('/admin/system-metrics'),
    getWorkspaces: () => 
      apiClient.get('/admin/workspaces'),
    getWorkspace: (workspaceId: string) => 
      apiClient.get(`/admin/workspaces/${workspaceId}`),
    updateWorkspace: (workspaceId: string, data: any) => 
      apiClient.patch(`/admin/workspaces/${workspaceId}`, data),
    suspendWorkspace: (workspaceId: string) => 
      apiClient.post(`/admin/workspaces/${workspaceId}/suspend`),
    activateWorkspace: (workspaceId: string) => 
      apiClient.post(`/admin/workspaces/${workspaceId}/activate`),
    getUsers: (params?: any) => 
      apiClient.get('/admin/users', params),
    getUser: (userId: string) => 
      apiClient.get(`/admin/users/${userId}`),
    updateUser: (userId: string, data: any) => 
      apiClient.patch(`/admin/users/${userId}`, data),
    getDatabaseStats: () => 
      apiClient.get('/admin/database/stats'),
    getCacheStats: () => 
      apiClient.get('/admin/cache/stats'),
    getSystemHealth: () => 
      apiClient.get('/admin/system/health'),
    refreshCache: () => 
      apiClient.post('/admin/cache/refresh'),
    runMaintenance: () => 
      apiClient.post('/admin/system/maintenance'),
  },

  // Workflow Automation
  workflows: {
    list: (workspaceId: string, params?: any) => 
      apiClient.get('/workflows', { workspace_id: workspaceId, ...params }),
    get: (workspaceId: string, workflowId: string) => 
      apiClient.get(`/workflows/${workflowId}`, { workspace_id: workspaceId }),
    create: (workspaceId: string, data: any) => 
      apiClient.post('/workflows', { workspace_id: workspaceId, ...data }),
    update: (workspaceId: string, workflowId: string, data: any) => 
      apiClient.patch(`/workflows/${workflowId}`, { workspace_id: workspaceId, ...data }),
    delete: (workspaceId: string, workflowId: string) => 
      apiClient.delete(`/workflows/${workflowId}`, { workspace_id: workspaceId }),
    duplicate: (workspaceId: string, workflowId: string, newName?: string) => 
      apiClient.post(`/workflows/${workflowId}/duplicate`, { workspace_id: workspaceId, new_name: newName }),
    execute: (workspaceId: string, workflowId: string, context: any) => 
      apiClient.post(`/workflows/${workflowId}/execute`, { workspace_id: workspaceId, context }),
    pause: (workspaceId: string, workflowId: string) => 
      apiClient.post(`/workflows/${workflowId}/pause`, { workspace_id: workspaceId }),
    resume: (workspaceId: string, workflowId: string) => 
      apiClient.post(`/workflows/${workflowId}/resume`, { workspace_id: workspaceId }),
    test: (workspaceId: string, workflow: any, testData: any) => 
      apiClient.post('/workflows/test', { workspace_id: workspaceId, workflow, test_data: testData }),
    validate: (workspaceId: string, workflow: any) => 
      apiClient.post('/workflows/validate', { workspace_id: workspaceId, workflow }),
    
    // Workflow executions
    executions: {
      list: (workspaceId: string, workflowId?: string, params?: any) => 
        apiClient.get('/workflow-executions', { workspace_id: workspaceId, workflow_id: workflowId, ...params }),
      get: (workspaceId: string, executionId: string) => 
        apiClient.get(`/workflow-executions/${executionId}`, { workspace_id: workspaceId }),
      cancel: (workspaceId: string, executionId: string) => 
        apiClient.post(`/workflow-executions/${executionId}/cancel`, { workspace_id: workspaceId }),
      retry: (workspaceId: string, executionId: string, fromActionId?: string) => 
        apiClient.post(`/workflow-executions/${executionId}/retry`, { workspace_id: workspaceId, from_action_id: fromActionId }),
    },

    // Workflow templates
    templates: {
      list: (params?: any) => 
        apiClient.get('/workflow-templates', params),
      create: (workspaceId: string, templateId: string, customizations?: any) => 
        apiClient.post(`/workflow-templates/${templateId}/create`, { workspace_id: workspaceId, customizations }),
    },

    // Workflow analytics
    analytics: (workspaceId: string, workflowId?: string, timeRange?: any) => 
      apiClient.get('/workflow-analytics', { workspace_id: workspaceId, workflow_id: workflowId, ...timeRange }),
  },

  // Lead Intelligence
  intelligence: {
    calculateScore: (workspaceId: string, leadId: string, options?: any) => 
      apiClient.post(`/intelligence/score/${leadId}`, { workspace_id: workspaceId, ...options }),
    bulkScore: (workspaceId: string, leadIds: string[], options?: any) => 
      apiClient.post('/intelligence/score/bulk', { workspace_id: workspaceId, lead_ids: leadIds, ...options }),
    generateInsights: (workspaceId: string, leadId: string, options?: any) => 
      apiClient.post(`/intelligence/insights/${leadId}`, { workspace_id: workspaceId, ...options }),
    detectBuyingSignals: (workspaceId: string, leadId: string) => 
      apiClient.post(`/intelligence/buying-signals/${leadId}`, { workspace_id: workspaceId }),
    prioritizeLeads: (workspaceId: string, params?: any) => 
      apiClient.get('/intelligence/prioritize', { workspace_id: workspaceId, ...params }),
    getScoreHistory: (workspaceId: string, leadId: string, params?: any) => 
      apiClient.get('/intelligence/score-history', { workspace_id: workspaceId, lead_id: leadId, ...params }),
    getCompanyIntelligence: (workspaceId: string, companyName: string, options?: any) => 
      apiClient.post('/intelligence/company', { workspace_id: workspaceId, company_name: companyName, ...options }),
    trackActivity: (workspaceId: string, leadId: string, activity: any) => 
      apiClient.post('/intelligence/activity', { workspace_id: workspaceId, lead_id: leadId, ...activity }),
    trackEngagement: (workspaceId: string, leadId: string, engagement: any) => 
      apiClient.post('/intelligence/engagement', { workspace_id: workspaceId, lead_id: leadId, ...engagement }),
    aiAnalysis: (workspaceId: string, leadId: string, analysisType: string) => 
      apiClient.post(`/intelligence/ai-analysis/${leadId}`, { workspace_id: workspaceId, analysis_type: analysisType }),
    segmentLeads: (workspaceId: string, criteria: any) => 
      apiClient.post('/intelligence/segment', { workspace_id: workspaceId, criteria }),
    setupAlerts: (workspaceId: string, alerts: any[]) => 
      apiClient.post('/intelligence/alerts', { workspace_id: workspaceId, alerts }),
  },
}