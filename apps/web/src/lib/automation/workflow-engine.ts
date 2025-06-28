import { createClient } from '@/lib/supabase/client'

export interface WorkflowTrigger {
  id: string
  type: 'email_opened' | 'email_clicked' | 'email_replied' | 'form_submitted' | 'lead_created' | 'lead_updated' | 'campaign_completed' | 'time_based' | 'api_webhook' | 'score_changed' | 'tag_added' | 'linkedin_connected' | 'twitter_followed' | 'sms_replied'
  conditions: {
    field?: string
    operator?: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'starts_with' | 'ends_with' | 'is_empty' | 'is_not_empty'
    value?: any
    timeDelay?: number // minutes
    recurringSchedule?: {
      frequency: 'daily' | 'weekly' | 'monthly'
      time?: string // HH:MM format
      days?: string[] // for weekly
      date?: number // for monthly (1-31)
    }
  }
  filters?: {
    leadFilters?: Record<string, any>
    campaignFilters?: Record<string, any>
    customFilters?: Record<string, any>
  }
}

export interface WorkflowAction {
  id: string
  type: 'send_email' | 'add_to_campaign' | 'update_lead_field' | 'add_tag' | 'remove_tag' | 'create_task' | 'send_notification' | 'update_lead_score' | 'move_to_sequence' | 'pause_campaign' | 'send_linkedin_message' | 'send_twitter_dm' | 'send_sms' | 'webhook_call' | 'wait' | 'branch_condition'
  config: {
    // Email actions
    templateId?: string
    emailContent?: string
    subject?: string
    fromName?: string
    fromEmail?: string
    
    // Campaign actions
    campaignId?: string
    sequenceStep?: number
    
    // Field update actions
    fieldName?: string
    fieldValue?: any
    operation?: 'set' | 'add' | 'subtract' | 'append' | 'prepend'
    
    // Tag actions
    tags?: string[]
    
    // Task actions
    taskTitle?: string
    taskDescription?: string
    assignedTo?: string
    dueDate?: Date
    priority?: 'low' | 'medium' | 'high'
    
    // Notification actions
    notificationType?: 'email' | 'slack' | 'webhook' | 'in_app'
    recipients?: string[]
    message?: string
    webhookUrl?: string
    
    // Social media actions
    messageContent?: string
    platform?: 'linkedin' | 'twitter' | 'sms'
    
    // Wait actions
    waitDuration?: number // minutes
    waitUntil?: Date
    
    // Branch conditions
    branchConditions?: Array<{
      condition: any
      nextActionId: string
    }>
    defaultNextActionId?: string
    
    // Webhook actions
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
    headers?: Record<string, string>
    body?: any
  }
  position: { x: number; y: number }
  nextActionId?: string
  onSuccess?: string // action ID to execute on success
  onFailure?: string // action ID to execute on failure
}

export interface WorkflowCondition {
  id: string
  type: 'if_then_else' | 'switch' | 'filter'
  conditions: Array<{
    field: string
    operator: string
    value: any
    logicalOperator?: 'AND' | 'OR'
  }>
  branches: Array<{
    name: string
    condition?: any
    nextActionId: string
  }>
  defaultBranch?: string
}

export interface Workflow {
  id: string
  workspaceId: string
  name: string
  description?: string
  status: 'draft' | 'active' | 'paused' | 'archived'
  version: number
  
  // Workflow definition
  trigger: WorkflowTrigger
  actions: WorkflowAction[]
  conditions: WorkflowCondition[]
  
  // Execution settings
  settings: {
    maxExecutionsPerHour?: number
    maxExecutionsPerDay?: number
    timezone?: string
    enableLogging?: boolean
    enableRetries?: boolean
    maxRetries?: number
    retryDelay?: number // minutes
    deadLetterHandling?: boolean
  }
  
  // Analytics
  analytics: {
    totalExecutions: number
    successfulExecutions: number
    failedExecutions: number
    averageExecutionTime: number
    lastExecutedAt?: Date
    conversionRate?: number
  }
  
  // Metadata
  createdBy: string
  createdAt: Date
  updatedAt: Date
  lastModifiedBy?: string
  tags?: string[]
  folder?: string
}

export interface WorkflowExecution {
  id: string
  workflowId: string
  workspaceId: string
  
  // Execution context
  triggeredBy: {
    type: string
    entityId?: string
    entityType?: 'lead' | 'campaign' | 'email' | 'user'
    metadata?: any
  }
  
  // Execution state
  status: 'running' | 'completed' | 'failed' | 'paused' | 'cancelled'
  currentActionId?: string
  executionContext: Record<string, any>
  
  // Timing
  startedAt: Date
  completedAt?: Date
  estimatedCompletionAt?: Date
  
  // Results
  result?: any
  error?: {
    message: string
    code?: string
    actionId?: string
    stack?: string
  }
  
  // Execution log
  executionLog: Array<{
    timestamp: Date
    actionId: string
    actionType: string
    status: 'started' | 'completed' | 'failed' | 'skipped'
    duration?: number
    input?: any
    output?: any
    error?: any
  }>
}

export interface WorkflowTemplate {
  id: string
  name: string
  description: string
  category: 'lead_nurturing' | 'onboarding' | 'sales_process' | 'customer_success' | 'marketing' | 'support' | 'custom'
  tags: string[]
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  estimatedSetupTime: number // minutes
  workflow: Omit<Workflow, 'id' | 'workspaceId' | 'createdBy' | 'createdAt' | 'updatedAt'>
  usageCount: number
  rating: number
  author: string
  isPublic: boolean
}

export class WorkflowEngine {
  private supabase = createClient()
  private apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.coldcopy.cc'

  // Workflow Management
  async createWorkflow(
    workspaceId: string,
    workflow: Omit<Workflow, 'id' | 'workspaceId' | 'createdBy' | 'createdAt' | 'updatedAt' | 'analytics'>
  ): Promise<Workflow> {
    const response = await fetch(`${this.apiBaseUrl}/workflows`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        ...workflow,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to create workflow')
    }

    return response.json()
  }

  async getWorkflows(
    workspaceId: string,
    filters?: {
      status?: string
      tags?: string[]
      folder?: string
      search?: string
      limit?: number
      offset?: number
    }
  ): Promise<{ workflows: Workflow[]; total: number }> {
    const params = new URLSearchParams({ workspace_id: workspaceId })
    
    if (filters?.status) params.append('status', filters.status)
    if (filters?.tags?.length) params.append('tags', filters.tags.join(','))
    if (filters?.folder) params.append('folder', filters.folder)
    if (filters?.search) params.append('search', filters.search)
    if (filters?.limit) params.append('limit', filters.limit.toString())
    if (filters?.offset) params.append('offset', filters.offset.toString())

    const response = await fetch(`${this.apiBaseUrl}/workflows?${params}`, {
      headers: {
        'Authorization': `Bearer ${await this.getToken()}`,
      },
    })

    if (!response.ok) {
      throw new Error('Failed to get workflows')
    }

    return response.json()
  }

  async getWorkflow(workspaceId: string, workflowId: string): Promise<Workflow> {
    const response = await fetch(`${this.apiBaseUrl}/workflows/${workflowId}?workspace_id=${workspaceId}`, {
      headers: {
        'Authorization': `Bearer ${await this.getToken()}`,
      },
    })

    if (!response.ok) {
      throw new Error('Failed to get workflow')
    }

    return response.json()
  }

  async updateWorkflow(
    workspaceId: string,
    workflowId: string,
    updates: Partial<Workflow>
  ): Promise<Workflow> {
    const response = await fetch(`${this.apiBaseUrl}/workflows/${workflowId}`, {
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
      throw new Error('Failed to update workflow')
    }

    return response.json()
  }

  async deleteWorkflow(workspaceId: string, workflowId: string): Promise<{ success: boolean }> {
    const response = await fetch(`${this.apiBaseUrl}/workflows/${workflowId}`, {
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
      throw new Error('Failed to delete workflow')
    }

    return response.json()
  }

  async duplicateWorkflow(
    workspaceId: string,
    workflowId: string,
    newName?: string
  ): Promise<Workflow> {
    const response = await fetch(`${this.apiBaseUrl}/workflows/${workflowId}/duplicate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        new_name: newName,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to duplicate workflow')
    }

    return response.json()
  }

  // Workflow Execution
  async executeWorkflow(
    workspaceId: string,
    workflowId: string,
    context: {
      leadId?: string
      campaignId?: string
      emailId?: string
      customData?: Record<string, any>
    }
  ): Promise<WorkflowExecution> {
    const response = await fetch(`${this.apiBaseUrl}/workflows/${workflowId}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        context,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to execute workflow')
    }

    return response.json()
  }

  async pauseWorkflow(workspaceId: string, workflowId: string): Promise<{ success: boolean }> {
    const response = await fetch(`${this.apiBaseUrl}/workflows/${workflowId}/pause`, {
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
      throw new Error('Failed to pause workflow')
    }

    return response.json()
  }

  async resumeWorkflow(workspaceId: string, workflowId: string): Promise<{ success: boolean }> {
    const response = await fetch(`${this.apiBaseUrl}/workflows/${workflowId}/resume`, {
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
      throw new Error('Failed to resume workflow')
    }

    return response.json()
  }

  // Workflow Executions
  async getWorkflowExecutions(
    workspaceId: string,
    workflowId?: string,
    filters?: {
      status?: string
      startDate?: Date
      endDate?: Date
      limit?: number
      offset?: number
    }
  ): Promise<{ executions: WorkflowExecution[]; total: number }> {
    const params = new URLSearchParams({ workspace_id: workspaceId })
    
    if (workflowId) params.append('workflow_id', workflowId)
    if (filters?.status) params.append('status', filters.status)
    if (filters?.startDate) params.append('start_date', filters.startDate.toISOString())
    if (filters?.endDate) params.append('end_date', filters.endDate.toISOString())
    if (filters?.limit) params.append('limit', filters.limit.toString())
    if (filters?.offset) params.append('offset', filters.offset.toString())

    const response = await fetch(`${this.apiBaseUrl}/workflow-executions?${params}`, {
      headers: {
        'Authorization': `Bearer ${await this.getToken()}`,
      },
    })

    if (!response.ok) {
      throw new Error('Failed to get workflow executions')
    }

    return response.json()
  }

  async getWorkflowExecution(
    workspaceId: string,
    executionId: string
  ): Promise<WorkflowExecution> {
    const response = await fetch(
      `${this.apiBaseUrl}/workflow-executions/${executionId}?workspace_id=${workspaceId}`,
      {
        headers: {
          'Authorization': `Bearer ${await this.getToken()}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error('Failed to get workflow execution')
    }

    return response.json()
  }

  async cancelWorkflowExecution(
    workspaceId: string,
    executionId: string
  ): Promise<{ success: boolean }> {
    const response = await fetch(`${this.apiBaseUrl}/workflow-executions/${executionId}/cancel`, {
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
      throw new Error('Failed to cancel workflow execution')
    }

    return response.json()
  }

  async retryWorkflowExecution(
    workspaceId: string,
    executionId: string,
    fromActionId?: string
  ): Promise<WorkflowExecution> {
    const response = await fetch(`${this.apiBaseUrl}/workflow-executions/${executionId}/retry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        from_action_id: fromActionId,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to retry workflow execution')
    }

    return response.json()
  }

  // Workflow Templates
  async getWorkflowTemplates(
    category?: string,
    difficulty?: string,
    tags?: string[],
    search?: string
  ): Promise<WorkflowTemplate[]> {
    const params = new URLSearchParams()
    
    if (category) params.append('category', category)
    if (difficulty) params.append('difficulty', difficulty)
    if (tags?.length) params.append('tags', tags.join(','))
    if (search) params.append('search', search)

    const response = await fetch(`${this.apiBaseUrl}/workflow-templates?${params}`, {
      headers: {
        'Authorization': `Bearer ${await this.getToken()}`,
      },
    })

    if (!response.ok) {
      throw new Error('Failed to get workflow templates')
    }

    return response.json()
  }

  async createWorkflowFromTemplate(
    workspaceId: string,
    templateId: string,
    customizations?: {
      name?: string
      description?: string
      settings?: any
    }
  ): Promise<Workflow> {
    const response = await fetch(`${this.apiBaseUrl}/workflow-templates/${templateId}/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        customizations,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to create workflow from template')
    }

    return response.json()
  }

  // Analytics
  async getWorkflowAnalytics(
    workspaceId: string,
    workflowId?: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<{
    totalExecutions: number
    successRate: number
    averageExecutionTime: number
    executionTrends: Array<{ date: string; executions: number; successRate: number }>
    topPerformingWorkflows: Array<{ id: string; name: string; executions: number; successRate: number }>
    commonFailureReasons: Array<{ reason: string; count: number; percentage: number }>
  }> {
    const params = new URLSearchParams({ workspace_id: workspaceId })
    
    if (workflowId) params.append('workflow_id', workflowId)
    if (timeRange) {
      params.append('start_date', timeRange.start.toISOString())
      params.append('end_date', timeRange.end.toISOString())
    }

    const response = await fetch(`${this.apiBaseUrl}/workflow-analytics?${params}`, {
      headers: {
        'Authorization': `Bearer ${await this.getToken()}`,
      },
    })

    if (!response.ok) {
      throw new Error('Failed to get workflow analytics')
    }

    return response.json()
  }

  // Testing and Validation
  async testWorkflow(
    workspaceId: string,
    workflow: Workflow,
    testData: Record<string, any>
  ): Promise<{
    isValid: boolean
    errors: Array<{ actionId: string; message: string }>
    warnings: Array<{ actionId: string; message: string }>
    estimatedExecutionTime: number
  }> {
    const response = await fetch(`${this.apiBaseUrl}/workflows/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        workflow,
        test_data: testData,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to test workflow')
    }

    return response.json()
  }

  async validateWorkflow(
    workspaceId: string,
    workflow: Workflow
  ): Promise<{
    isValid: boolean
    errors: string[]
    warnings: string[]
    suggestions: string[]
  }> {
    const response = await fetch(`${this.apiBaseUrl}/workflows/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        workflow,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to validate workflow')
    }

    return response.json()
  }

  private async getToken(): Promise<string> {
    const { data: { session } } = await this.supabase.auth.getSession()
    return session?.access_token || ''
  }
}

// Export singleton instance
export const workflowEngine = new WorkflowEngine()