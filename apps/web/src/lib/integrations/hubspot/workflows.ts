import { HubSpotClient } from './client';
import { HubSpotAuth } from './auth';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import {
  HubSpotSyncError,
  HubSpotRateLimitError,
  HubSpotValidationError,
} from './types';

// Email engagement event types
export type EmailEngagementEventType = 
  | 'email_sent'
  | 'email_opened'
  | 'email_clicked'
  | 'email_replied'
  | 'email_bounced'
  | 'email_unsubscribed';

// Workflow trigger configuration
export interface WorkflowTriggerConfig {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  enabled: boolean;
  eventType: EmailEngagementEventType;
  conditions?: TriggerCondition[];
  actions: WorkflowAction[];
  hubspotWorkflowId?: string;
  propertyUpdates?: PropertyUpdate[];
  createdAt: Date;
  updatedAt: Date;
}

// Trigger conditions for more granular control
export interface TriggerCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
  value: any;
}

// Workflow actions to perform
export interface WorkflowAction {
  type: 'trigger_workflow' | 'update_property' | 'add_to_list' | 'create_task' | 'send_notification';
  config: Record<string, any>;
}

// Property update configuration
export interface PropertyUpdate {
  propertyName: string;
  propertyValue: any;
  updateType: 'set' | 'increment' | 'append';
}

// Email engagement event data
export interface EmailEngagementEvent {
  id: string;
  workspaceId: string;
  eventType: EmailEngagementEventType;
  emailId: string;
  campaignId: string;
  leadId: string;
  leadEmail: string;
  hubspotContactId?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

// Rate limiter for workflow triggers
class WorkflowRateLimiter {
  private triggerCounts: Map<string, { count: number; resetAt: Date }> = new Map();
  private readonly maxTriggersPerMinute = 10;
  
  canTrigger(key: string): boolean {
    const now = new Date();
    const entry = this.triggerCounts.get(key);
    
    if (!entry || entry.resetAt < now) {
      this.triggerCounts.set(key, {
        count: 1,
        resetAt: new Date(now.getTime() + 60000), // 1 minute
      });
      return true;
    }
    
    if (entry.count >= this.maxTriggersPerMinute) {
      return false;
    }
    
    entry.count++;
    return true;
  }
  
  getRemainingTime(key: string): number {
    const entry = this.triggerCounts.get(key);
    if (!entry) return 0;
    
    const remaining = entry.resetAt.getTime() - Date.now();
    return Math.max(0, Math.ceil(remaining / 1000));
  }
}

export class HubSpotWorkflowTriggerService {
  private client: HubSpotClient;
  private auth: HubSpotAuth;
  private workspaceId: string;
  private rateLimiter: WorkflowRateLimiter;
  private configCache: Map<string, WorkflowTriggerConfig[]> = new Map();
  private cacheExpiry = 5 * 60 * 1000; // 5 minutes
  private lastCacheUpdate = 0;

  constructor(workspaceId: string, accessToken?: string) {
    this.workspaceId = workspaceId;
    this.auth = new HubSpotAuth();
    this.rateLimiter = new WorkflowRateLimiter();
    
    if (accessToken) {
      this.client = new HubSpotClient(accessToken);
    }
  }

  /**
   * Initialize client with valid access token
   */
  private async ensureClient() {
    if (!this.client) {
      const accessToken = await this.auth.getValidAccessToken(this.workspaceId);
      this.client = new HubSpotClient(accessToken);
    }
  }

  /**
   * Process an email engagement event
   */
  async processEngagementEvent(event: EmailEngagementEvent): Promise<void> {
    try {
      await this.ensureClient();
      
      // Get applicable workflow triggers
      const triggers = await this.getApplicableTriggers(event);
      
      if (triggers.length === 0) {
        console.log(`No triggers configured for event type: ${event.eventType}`);
        return;
      }

      // Process each trigger
      const results = await Promise.allSettled(
        triggers.map(trigger => this.executeTrigger(trigger, event))
      );

      // Log results
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`Failed to execute trigger ${triggers[index].name}:`, result.reason);
        }
      });
    } catch (error) {
      console.error('Error processing engagement event:', error);
      throw new HubSpotSyncError(
        `Failed to process engagement event: ${error.message}`,
        event.id,
        'workflow_trigger'
      );
    }
  }

  /**
   * Execute a workflow trigger
   */
  private async executeTrigger(
    trigger: WorkflowTriggerConfig,
    event: EmailEngagementEvent
  ): Promise<void> {
    // Check rate limits
    const rateLimitKey = `${trigger.id}:${event.leadId}`;
    if (!this.rateLimiter.canTrigger(rateLimitKey)) {
      const remainingTime = this.rateLimiter.getRemainingTime(rateLimitKey);
      throw new HubSpotRateLimitError(remainingTime);
    }

    // Ensure we have HubSpot contact ID
    const contactId = await this.ensureHubSpotContact(event);
    if (!contactId) {
      throw new HubSpotValidationError('Could not find or create HubSpot contact');
    }

    // Execute actions
    for (const action of trigger.actions) {
      await this.executeAction(action, event, contactId, trigger);
    }

    // Execute property updates
    if (trigger.propertyUpdates && trigger.propertyUpdates.length > 0) {
      await this.updateContactProperties(contactId, trigger.propertyUpdates, event);
    }

    // Log trigger execution
    await this.logTriggerExecution(trigger, event, contactId);
  }

  /**
   * Execute a workflow action
   */
  private async executeAction(
    action: WorkflowAction,
    event: EmailEngagementEvent,
    contactId: string,
    trigger: WorkflowTriggerConfig
  ): Promise<void> {
    switch (action.type) {
      case 'trigger_workflow':
        await this.triggerHubSpotWorkflow(
          action.config.workflowId || trigger.hubspotWorkflowId,
          contactId,
          event
        );
        break;

      case 'update_property':
        await this.updateContactProperty(
          contactId,
          action.config.propertyName,
          action.config.propertyValue,
          action.config.updateType
        );
        break;

      case 'add_to_list':
        await this.addContactToList(contactId, action.config.listId);
        break;

      case 'create_task':
        await this.createTask(contactId, action.config);
        break;

      case 'send_notification':
        await this.sendNotification(action.config, event);
        break;

      default:
        console.warn(`Unknown action type: ${action.type}`);
    }
  }

  /**
   * Trigger a HubSpot workflow
   */
  private async triggerHubSpotWorkflow(
    workflowId: string,
    contactId: string,
    event: EmailEngagementEvent
  ): Promise<void> {
    if (!workflowId) {
      throw new HubSpotValidationError('Workflow ID is required');
    }

    try {
      // HubSpot workflow enrollment API
      await this.client.post(`/automation/v2/workflows/${workflowId}/enrollments/contacts/${contactId}`, {
        portalId: await this.getPortalId(),
      });
    } catch (error) {
      // Try alternative API endpoint
      await this.client.post(`/workflows/v3/workflows/${workflowId}/enrollments`, {
        objectType: 'CONTACT',
        objectId: contactId,
        metadata: {
          source: 'ColdCopy',
          eventType: event.eventType,
          campaignId: event.campaignId,
          timestamp: event.timestamp.toISOString(),
        },
      });
    }
  }

  /**
   * Update contact properties based on engagement behavior
   */
  private async updateContactProperties(
    contactId: string,
    propertyUpdates: PropertyUpdate[],
    event: EmailEngagementEvent
  ): Promise<void> {
    const properties: Record<string, any> = {};

    for (const update of propertyUpdates) {
      const currentValue = await this.getContactPropertyValue(contactId, update.propertyName);
      
      switch (update.updateType) {
        case 'set':
          properties[update.propertyName] = this.resolvePropertyValue(update.propertyValue, event);
          break;
          
        case 'increment':
          const numValue = parseFloat(currentValue) || 0;
          properties[update.propertyName] = numValue + (parseFloat(update.propertyValue) || 1);
          break;
          
        case 'append':
          const existingValue = currentValue || '';
          const separator = update.propertyValue.separator || ', ';
          properties[update.propertyName] = existingValue 
            ? `${existingValue}${separator}${this.resolvePropertyValue(update.propertyValue.value, event)}`
            : this.resolvePropertyValue(update.propertyValue.value, event);
          break;
      }
    }

    // Add engagement tracking properties
    properties.coldcopy_last_engagement = event.timestamp.toISOString();
    properties.coldcopy_last_engagement_type = event.eventType;
    properties.coldcopy_engagement_score = await this.calculateEngagementScore(contactId, event);

    await this.client.patch(`/crm/v3/objects/contacts/${contactId}`, { properties });
  }

  /**
   * Update a single contact property
   */
  private async updateContactProperty(
    contactId: string,
    propertyName: string,
    propertyValue: any,
    updateType: string = 'set'
  ): Promise<void> {
    await this.updateContactProperties(
      contactId,
      [{
        propertyName,
        propertyValue,
        updateType: updateType as 'set' | 'increment' | 'append',
      }],
      {} as EmailEngagementEvent
    );
  }

  /**
   * Add contact to a HubSpot list
   */
  private async addContactToList(contactId: string, listId: string): Promise<void> {
    await this.client.post(`/contacts/v1/lists/${listId}/add`, {
      vids: [contactId],
    });
  }

  /**
   * Create a task in HubSpot
   */
  private async createTask(contactId: string, config: Record<string, any>): Promise<void> {
    const taskData = {
      properties: {
        hs_task_subject: config.subject || 'Follow up on email engagement',
        hs_task_body: config.body || 'Contact showed engagement with email campaign',
        hs_task_status: 'NOT_STARTED',
        hs_task_priority: config.priority || 'MEDIUM',
        hs_task_type: config.taskType || 'TODO',
        hs_timestamp: new Date(Date.now() + (config.dueInDays || 1) * 24 * 60 * 60 * 1000).toISOString(),
      },
      associations: [
        {
          to: { id: contactId },
          types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 204 }],
        },
      ],
    };

    await this.client.post('/crm/v3/objects/tasks', taskData);
  }

  /**
   * Send internal notification
   */
  private async sendNotification(config: Record<string, any>, event: EmailEngagementEvent): Promise<void> {
    const supabase = createServerClient(cookies());
    
    await supabase.from('notifications').insert({
      workspace_id: this.workspaceId,
      type: 'workflow_trigger',
      title: config.title || `Workflow triggered: ${event.eventType}`,
      message: config.message || `Contact ${event.leadEmail} triggered workflow from ${event.eventType}`,
      data: {
        eventId: event.id,
        eventType: event.eventType,
        leadId: event.leadId,
        campaignId: event.campaignId,
      },
      recipients: config.recipients || [],
    });
  }

  /**
   * Get applicable triggers for an event
   */
  private async getApplicableTriggers(event: EmailEngagementEvent): Promise<WorkflowTriggerConfig[]> {
    const allTriggers = await this.getTriggerConfigs();
    
    return allTriggers.filter(trigger => {
      // Check if trigger is enabled
      if (!trigger.enabled) return false;
      
      // Check event type matches
      if (trigger.eventType !== event.eventType) return false;
      
      // Check conditions
      if (trigger.conditions && trigger.conditions.length > 0) {
        return this.evaluateConditions(trigger.conditions, event);
      }
      
      return true;
    });
  }

  /**
   * Evaluate trigger conditions
   */
  private evaluateConditions(conditions: TriggerCondition[], event: EmailEngagementEvent): boolean {
    return conditions.every(condition => {
      const value = this.getEventFieldValue(event, condition.field);
      
      switch (condition.operator) {
        case 'equals':
          return value === condition.value;
        case 'not_equals':
          return value !== condition.value;
        case 'contains':
          return String(value).includes(String(condition.value));
        case 'greater_than':
          return Number(value) > Number(condition.value);
        case 'less_than':
          return Number(value) < Number(condition.value);
        default:
          return false;
      }
    });
  }

  /**
   * Get field value from event
   */
  private getEventFieldValue(event: EmailEngagementEvent, field: string): any {
    const fields = field.split('.');
    let value: any = event;
    
    for (const f of fields) {
      value = value?.[f];
    }
    
    return value;
  }

  /**
   * Resolve property value with template variables
   */
  private resolvePropertyValue(value: any, event: EmailEngagementEvent): any {
    if (typeof value !== 'string') return value;
    
    // Replace template variables
    return value
      .replace('{{eventType}}', event.eventType)
      .replace('{{campaignId}}', event.campaignId)
      .replace('{{timestamp}}', event.timestamp.toISOString())
      .replace('{{leadEmail}}', event.leadEmail);
  }

  /**
   * Calculate engagement score for contact
   */
  private async calculateEngagementScore(contactId: string, event: EmailEngagementEvent): Promise<number> {
    const weights = {
      email_sent: 1,
      email_opened: 2,
      email_clicked: 5,
      email_replied: 10,
      email_bounced: -5,
      email_unsubscribed: -10,
    };

    // Get current score
    const currentScore = await this.getContactPropertyValue(contactId, 'coldcopy_engagement_score') || 0;
    
    // Add event weight
    const eventWeight = weights[event.eventType] || 0;
    
    return Math.max(0, Number(currentScore) + eventWeight);
  }

  /**
   * Get contact property value
   */
  private async getContactPropertyValue(contactId: string, propertyName: string): Promise<any> {
    try {
      const response = await this.client.get(`/crm/v3/objects/contacts/${contactId}`, {
        params: { properties: propertyName },
      });
      
      return response.properties?.[propertyName];
    } catch (error) {
      return null;
    }
  }

  /**
   * Ensure HubSpot contact exists
   */
  private async ensureHubSpotContact(event: EmailEngagementEvent): Promise<string | null> {
    // Check if we already have the contact ID
    if (event.hubspotContactId) {
      return event.hubspotContactId;
    }

    const supabase = createServerClient(cookies());

    // Check sync status
    const { data: syncStatus } = await supabase
      .from('hubspot_sync_status')
      .select('hubspot_id')
      .eq('workspace_id', this.workspaceId)
      .eq('entity_type', 'contact')
      .eq('entity_id', event.leadId)
      .single();

    if (syncStatus?.hubspot_id) {
      return syncStatus.hubspot_id;
    }

    // Try to find by email
    const searchResponse = await this.client.post('/crm/v3/objects/contacts/search', {
      filterGroups: [{
        filters: [{
          propertyName: 'email',
          operator: 'EQ',
          value: event.leadEmail,
        }],
      }],
      properties: ['id'],
      limit: 1,
    });

    if (searchResponse.results?.[0]?.id) {
      const contactId = searchResponse.results[0].id;
      
      // Update sync status
      await supabase
        .from('hubspot_sync_status')
        .upsert({
          workspace_id: this.workspaceId,
          entity_type: 'contact',
          entity_id: event.leadId,
          hubspot_id: contactId,
          status: 'synced',
          last_synced_at: new Date().toISOString(),
        });
      
      return contactId;
    }

    // Create contact if auto-creation is enabled
    const config = await this.getWorkspaceConfig();
    if (config.autoCreateContacts) {
      return await this.createHubSpotContact(event);
    }

    return null;
  }

  /**
   * Create HubSpot contact
   */
  private async createHubSpotContact(event: EmailEngagementEvent): Promise<string> {
    const supabase = createServerClient(cookies());
    
    // Get lead data
    const { data: lead } = await supabase
      .from('leads')
      .select('*')
      .eq('id', event.leadId)
      .eq('workspace_id', this.workspaceId)
      .single();

    if (!lead) {
      throw new HubSpotValidationError('Lead not found');
    }

    const contactData = {
      properties: {
        email: lead.email,
        firstname: lead.first_name,
        lastname: lead.last_name,
        company: lead.company,
        phone: lead.phone,
        website: lead.website,
        coldcopy_lead_id: lead.id,
        coldcopy_source: 'ColdCopy Auto-sync',
        hs_lead_status: 'NEW',
      },
    };

    const response = await this.client.post('/crm/v3/objects/contacts', contactData);
    const contactId = response.id;

    // Update sync status
    await supabase
      .from('hubspot_sync_status')
      .insert({
        workspace_id: this.workspaceId,
        entity_type: 'contact',
        entity_id: event.leadId,
        hubspot_id: contactId,
        status: 'synced',
        last_synced_at: new Date().toISOString(),
      });

    return contactId;
  }

  /**
   * Get workspace configuration
   */
  private async getWorkspaceConfig(): Promise<any> {
    const supabase = createServerClient(cookies());
    
    const { data } = await supabase
      .from('hubspot_sync_config')
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .single();

    return data || {
      autoCreateContacts: false,
      autoLogActivities: true,
    };
  }

  /**
   * Get portal ID
   */
  private async getPortalId(): Promise<string> {
    const supabase = createServerClient(cookies());
    
    const { data } = await supabase
      .from('hubspot_integrations')
      .select('hub_id')
      .eq('workspace_id', this.workspaceId)
      .single();

    return data?.hub_id || '';
  }

  /**
   * Get trigger configurations
   */
  private async getTriggerConfigs(): Promise<WorkflowTriggerConfig[]> {
    // Check cache
    if (this.configCache.has(this.workspaceId) && 
        Date.now() - this.lastCacheUpdate < this.cacheExpiry) {
      return this.configCache.get(this.workspaceId)!;
    }

    const supabase = createServerClient(cookies());
    
    const { data, error } = await supabase
      .from('hubspot_workflow_triggers')
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .eq('enabled', true);

    if (error) {
      throw new HubSpotSyncError('Failed to load trigger configurations');
    }

    const configs = (data || []).map(config => ({
      ...config,
      conditions: config.conditions || [],
      actions: config.actions || [],
      propertyUpdates: config.property_updates || [],
      createdAt: new Date(config.created_at),
      updatedAt: new Date(config.updated_at),
    }));

    // Update cache
    this.configCache.set(this.workspaceId, configs);
    this.lastCacheUpdate = Date.now();

    return configs;
  }

  /**
   * Log trigger execution
   */
  private async logTriggerExecution(
    trigger: WorkflowTriggerConfig,
    event: EmailEngagementEvent,
    contactId: string
  ): Promise<void> {
    const supabase = createServerClient(cookies());
    
    await supabase
      .from('hubspot_workflow_executions')
      .insert({
        workspace_id: this.workspaceId,
        trigger_id: trigger.id,
        event_id: event.id,
        event_type: event.eventType,
        lead_id: event.leadId,
        hubspot_contact_id: contactId,
        execution_time: new Date().toISOString(),
        status: 'success',
      });
  }

  /**
   * Create or update workflow trigger configuration
   */
  async upsertTriggerConfig(config: Partial<WorkflowTriggerConfig>): Promise<WorkflowTriggerConfig> {
    const supabase = createServerClient(cookies());
    
    const data = {
      workspace_id: this.workspaceId,
      name: config.name,
      description: config.description,
      enabled: config.enabled ?? true,
      event_type: config.eventType,
      conditions: config.conditions || [],
      actions: config.actions || [],
      hubspot_workflow_id: config.hubspotWorkflowId,
      property_updates: config.propertyUpdates || [],
    };

    const { data: result, error } = await supabase
      .from('hubspot_workflow_triggers')
      .upsert(data)
      .select()
      .single();

    if (error) {
      throw new HubSpotSyncError('Failed to save trigger configuration');
    }

    // Clear cache
    this.configCache.delete(this.workspaceId);

    return {
      ...result,
      createdAt: new Date(result.created_at),
      updatedAt: new Date(result.updated_at),
    };
  }

  /**
   * Delete workflow trigger configuration
   */
  async deleteTriggerConfig(triggerId: string): Promise<void> {
    const supabase = createServerClient(cookies());
    
    const { error } = await supabase
      .from('hubspot_workflow_triggers')
      .delete()
      .eq('id', triggerId)
      .eq('workspace_id', this.workspaceId);

    if (error) {
      throw new HubSpotSyncError('Failed to delete trigger configuration');
    }

    // Clear cache
    this.configCache.delete(this.workspaceId);
  }

  /**
   * Test workflow trigger
   */
  async testTrigger(triggerId: string, testEvent?: Partial<EmailEngagementEvent>): Promise<void> {
    const configs = await this.getTriggerConfigs();
    const trigger = configs.find(c => c.id === triggerId);
    
    if (!trigger) {
      throw new HubSpotValidationError('Trigger configuration not found');
    }

    // Create test event
    const event: EmailEngagementEvent = {
      id: 'test-' + Date.now(),
      workspaceId: this.workspaceId,
      eventType: trigger.eventType,
      emailId: testEvent?.emailId || 'test-email-id',
      campaignId: testEvent?.campaignId || 'test-campaign-id',
      leadId: testEvent?.leadId || 'test-lead-id',
      leadEmail: testEvent?.leadEmail || 'test@example.com',
      timestamp: new Date(),
      metadata: testEvent?.metadata || {},
    };

    await this.executeTrigger(trigger, event);
  }
}

// Export service factory
export function createWorkflowTriggerService(workspaceId: string, accessToken?: string) {
  return new HubSpotWorkflowTriggerService(workspaceId, accessToken);
}