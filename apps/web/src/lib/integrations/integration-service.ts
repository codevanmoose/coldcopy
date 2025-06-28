// Integration Service - Manage third-party integrations
'use client'

import { createClient } from '@supabase/supabase-js'

export interface IntegrationProvider {
  id: string
  name: string
  display_name: string
  description: string
  category: 'communication' | 'automation' | 'email' | 'crm' | 'analytics'
  auth_type: 'oauth2' | 'api_key' | 'webhook' | 'none'
  auth_config: any
  webhook_support: boolean
  supported_events: string[]
  supported_actions: string[]
  is_active: boolean
  is_premium: boolean
  icon_url?: string
  website_url?: string
  documentation_url?: string
}

export interface WorkspaceIntegration {
  id: string
  workspace_id: string
  user_id: string
  provider_id: string
  integration_name: string
  auth_data: any
  auth_expires_at?: string
  settings: any
  webhook_url?: string
  is_active: boolean
  last_sync_at?: string
  last_error?: string
  sync_status: 'active' | 'error' | 'paused' | 'disconnected'
  total_executions: number
  monthly_executions: number
  created_at: string
  updated_at: string
  integration_providers?: IntegrationProvider
}

export interface IntegrationAutomation {
  id: string
  workspace_id: string
  name: string
  description?: string
  trigger_event: string
  trigger_conditions: any
  action_provider_id: string
  action_type: string
  action_config: any
  is_active: boolean
  execution_order: number
  total_executions: number
  successful_executions: number
  failed_executions: number
  last_execution_at?: string
  last_success_at?: string
  last_error?: string
  created_at: string
  integration_providers?: IntegrationProvider
}

export interface ExecutionLog {
  id: string
  workspace_id: string
  automation_id?: string
  provider_id: string
  execution_type: 'automation' | 'manual' | 'webhook'
  trigger_event: string
  action_type: string
  status: 'success' | 'failed' | 'partial'
  error_message?: string
  execution_duration_ms?: number
  started_at: string
  completed_at?: string
  integration_providers?: IntegrationProvider
}

export class IntegrationService {
  private static instance: IntegrationService
  private supabase: any

  private constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  static getInstance(): IntegrationService {
    if (!IntegrationService.instance) {
      IntegrationService.instance = new IntegrationService()
    }
    return IntegrationService.instance
  }

  // Get available integration providers
  async getProviders(): Promise<IntegrationProvider[]> {
    try {
      const { data, error } = await this.supabase
        .from('integration_providers')
        .select('*')
        .eq('is_active', true)
        .order('display_name')

      if (error) {
        console.error('Error fetching providers:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error fetching providers:', error)
      return []
    }
  }

  // Get workspace integrations
  async getWorkspaceIntegrations(): Promise<WorkspaceIntegration[]> {
    try {
      const { data, error } = await this.supabase
        .from('workspace_integrations')
        .select(`
          *,
          integration_providers (*)
        `)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching integrations:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error fetching integrations:', error)
      return []
    }
  }

  // Create new integration
  async createIntegration(
    providerId: string,
    integrationName: string,
    authData: any,
    settings: any = {}
  ): Promise<{ success: boolean; integration?: WorkspaceIntegration; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from('workspace_integrations')
        .insert({
          provider_id: providerId,
          integration_name: integrationName,
          auth_data: authData,
          settings,
          is_active: true,
          sync_status: 'active'
        })
        .select(`
          *,
          integration_providers (*)
        `)
        .single()

      if (error) {
        console.error('Error creating integration:', error)
        return { success: false, error: error.message }
      }

      return { success: true, integration: data }
    } catch (error) {
      console.error('Error creating integration:', error)
      return { success: false, error: 'Failed to create integration' }
    }
  }

  // Update integration
  async updateIntegration(
    integrationId: string,
    updates: Partial<WorkspaceIntegration>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('workspace_integrations')
        .update(updates)
        .eq('id', integrationId)

      if (error) {
        console.error('Error updating integration:', error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      console.error('Error updating integration:', error)
      return { success: false, error: 'Failed to update integration' }
    }
  }

  // Delete integration
  async deleteIntegration(integrationId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('workspace_integrations')
        .delete()
        .eq('id', integrationId)

      if (error) {
        console.error('Error deleting integration:', error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      console.error('Error deleting integration:', error)
      return { success: false, error: 'Failed to delete integration' }
    }
  }

  // Test integration connection
  async testIntegration(integrationId: string): Promise<{ success: boolean; error?: string; data?: any }> {
    try {
      // Get integration details
      const { data: integration, error: fetchError } = await this.supabase
        .from('workspace_integrations')
        .select(`
          *,
          integration_providers (*)
        `)
        .eq('id', integrationId)
        .single()

      if (fetchError || !integration) {
        return { success: false, error: 'Integration not found' }
      }

      // Test based on provider type
      const provider = integration.integration_providers
      const testResult = await this.performProviderTest(provider, integration)

      // Update integration status based on test result
      await this.updateIntegration(integrationId, {
        sync_status: testResult.success ? 'active' : 'error',
        last_error: testResult.success ? null : testResult.error,
        last_sync_at: new Date().toISOString()
      })

      return testResult
    } catch (error) {
      console.error('Error testing integration:', error)
      return { success: false, error: 'Failed to test integration' }
    }
  }

  // Perform provider-specific test
  private async performProviderTest(
    provider: IntegrationProvider,
    integration: WorkspaceIntegration
  ): Promise<{ success: boolean; error?: string; data?: any }> {
    switch (provider.name) {
      case 'slack':
        return this.testSlackIntegration(integration)
      case 'gmail':
        return this.testGmailIntegration(integration)
      case 'zapier':
        return this.testZapierIntegration(integration)
      case 'webhook':
        return this.testWebhookIntegration(integration)
      default:
        return { success: true, data: { message: 'No test available for this provider' } }
    }
  }

  // Provider-specific test methods
  private async testSlackIntegration(integration: WorkspaceIntegration): Promise<any> {
    try {
      const response = await fetch('/api/integrations/slack/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ integrationId: integration.id })
      })

      const result = await response.json()
      return result
    } catch (error) {
      return { success: false, error: 'Failed to test Slack connection' }
    }
  }

  private async testGmailIntegration(integration: WorkspaceIntegration): Promise<any> {
    try {
      const response = await fetch('/api/integrations/gmail/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ integrationId: integration.id })
      })

      const result = await response.json()
      return result
    } catch (error) {
      return { success: false, error: 'Failed to test Gmail connection' }
    }
  }

  private async testZapierIntegration(integration: WorkspaceIntegration): Promise<any> {
    try {
      if (!integration.webhook_url) {
        return { success: false, error: 'No webhook URL configured' }
      }

      const testPayload = {
        test: true,
        timestamp: new Date().toISOString(),
        workspace_id: integration.workspace_id
      }

      const response = await fetch(integration.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload)
      })

      if (response.ok) {
        return { success: true, data: { status: response.status } }
      } else {
        return { success: false, error: `HTTP ${response.status}: ${response.statusText}` }
      }
    } catch (error) {
      return { success: false, error: 'Failed to test Zapier webhook' }
    }
  }

  private async testWebhookIntegration(integration: WorkspaceIntegration): Promise<any> {
    try {
      if (!integration.webhook_url) {
        return { success: false, error: 'No webhook URL configured' }
      }

      const testPayload = {
        test: true,
        timestamp: new Date().toISOString(),
        workspace_id: integration.workspace_id
      }

      const response = await fetch(integration.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload)
      })

      if (response.ok) {
        return { success: true, data: { status: response.status } }
      } else {
        return { success: false, error: `HTTP ${response.status}: ${response.statusText}` }
      }
    } catch (error) {
      return { success: false, error: 'Failed to test webhook' }
    }
  }

  // Get automations
  async getAutomations(): Promise<IntegrationAutomation[]> {
    try {
      const { data, error } = await this.supabase
        .from('integration_automations')
        .select(`
          *,
          integration_providers!action_provider_id (*)
        `)
        .order('execution_order')

      if (error) {
        console.error('Error fetching automations:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error fetching automations:', error)
      return []
    }
  }

  // Create automation
  async createAutomation(automation: Omit<IntegrationAutomation, 'id' | 'workspace_id' | 'created_at' | 'total_executions' | 'successful_executions' | 'failed_executions'>): Promise<{ success: boolean; automation?: IntegrationAutomation; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from('integration_automations')
        .insert({
          ...automation,
          total_executions: 0,
          successful_executions: 0,
          failed_executions: 0
        })
        .select(`
          *,
          integration_providers!action_provider_id (*)
        `)
        .single()

      if (error) {
        console.error('Error creating automation:', error)
        return { success: false, error: error.message }
      }

      return { success: true, automation: data }
    } catch (error) {
      console.error('Error creating automation:', error)
      return { success: false, error: 'Failed to create automation' }
    }
  }

  // Update automation
  async updateAutomation(
    automationId: string,
    updates: Partial<IntegrationAutomation>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('integration_automations')
        .update(updates)
        .eq('id', automationId)

      if (error) {
        console.error('Error updating automation:', error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      console.error('Error updating automation:', error)
      return { success: false, error: 'Failed to update automation' }
    }
  }

  // Delete automation
  async deleteAutomation(automationId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('integration_automations')
        .delete()
        .eq('id', automationId)

      if (error) {
        console.error('Error deleting automation:', error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      console.error('Error deleting automation:', error)
      return { success: false, error: 'Failed to delete automation' }
    }
  }

  // Execute automation manually
  async executeAutomation(
    automationId: string,
    triggerData: any = {}
  ): Promise<{ success: boolean; executionId?: string; error?: string }> {
    try {
      const { data, error } = await this.supabase.rpc('execute_integration_automation', {
        p_automation_id: automationId,
        p_trigger_data: triggerData
      })

      if (error) {
        console.error('Error executing automation:', error)
        return { success: false, error: error.message }
      }

      return { success: true, executionId: data }
    } catch (error) {
      console.error('Error executing automation:', error)
      return { success: false, error: 'Failed to execute automation' }
    }
  }

  // Get execution logs
  async getExecutionLogs(limit: number = 50): Promise<ExecutionLog[]> {
    try {
      const { data, error } = await this.supabase
        .from('integration_execution_logs')
        .select(`
          *,
          integration_providers (*)
        `)
        .order('started_at', { ascending: false })
        .limit(limit)

      if (error) {
        console.error('Error fetching execution logs:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error fetching execution logs:', error)
      return []
    }
  }

  // Trigger event (used by application to trigger automations)
  async triggerEvent(
    event: string,
    eventData: any,
    conditions: any = {}
  ): Promise<{ success: boolean; executions: number; error?: string }> {
    try {
      // Find matching automations
      const { data: automations, error } = await this.supabase
        .from('integration_automations')
        .select('*')
        .eq('trigger_event', event)
        .eq('is_active', true)
        .order('execution_order')

      if (error) {
        console.error('Error fetching automations for event:', error)
        return { success: false, executions: 0, error: error.message }
      }

      let executionCount = 0
      
      // Execute each matching automation
      for (const automation of automations || []) {
        // Check if conditions match
        if (this.matchesConditions(eventData, automation.trigger_conditions)) {
          const result = await this.executeAutomation(automation.id, eventData)
          if (result.success) {
            executionCount++
          }
        }
      }

      return { success: true, executions: executionCount }
    } catch (error) {
      console.error('Error triggering event:', error)
      return { success: false, executions: 0, error: 'Failed to trigger event' }
    }
  }

  // Check if event data matches automation conditions
  private matchesConditions(eventData: any, conditions: any): boolean {
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

  // Get integration statistics
  async getIntegrationStats(): Promise<{
    totalIntegrations: number
    activeIntegrations: number
    totalAutomations: number
    activeAutomations: number
    monthlyExecutions: number
    successRate: number
  }> {
    try {
      const [integrationsResult, automationsResult, executionsResult] = await Promise.all([
        this.supabase
          .from('workspace_integrations')
          .select('id, is_active, monthly_executions'),
        this.supabase
          .from('integration_automations')
          .select('id, is_active, successful_executions, failed_executions'),
        this.supabase
          .from('integration_execution_logs')
          .select('status')
          .gte('started_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      ])

      const integrations = integrationsResult.data || []
      const automations = automationsResult.data || []
      const executions = executionsResult.data || []

      const totalExecutions = automations.reduce((sum, a) => sum + a.successful_executions + a.failed_executions, 0)
      const successfulExecutions = automations.reduce((sum, a) => sum + a.successful_executions, 0)

      return {
        totalIntegrations: integrations.length,
        activeIntegrations: integrations.filter(i => i.is_active).length,
        totalAutomations: automations.length,
        activeAutomations: automations.filter(a => a.is_active).length,
        monthlyExecutions: integrations.reduce((sum, i) => sum + i.monthly_executions, 0),
        successRate: totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0
      }
    } catch (error) {
      console.error('Error fetching integration stats:', error)
      return {
        totalIntegrations: 0,
        activeIntegrations: 0,
        totalAutomations: 0,
        activeAutomations: 0,
        monthlyExecutions: 0,
        successRate: 0
      }
    }
  }
}

// Export singleton instance
export const integrationService = IntegrationService.getInstance()