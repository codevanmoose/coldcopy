import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { HubSpotClient } from './client';
import { HubSpotAuth } from './auth';
import { HubSpotContactSync } from './contacts';
import { HubSpotWorkflowTrigger } from './workflows';

export interface WebhookEvent {
  eventId: number;
  subscriptionType: string;
  portalId: number;
  appId: number;
  occurredAt: number;
  eventType: string;
  objectId: number;
  propertyName?: string;
  propertyValue?: any;
  changeSource?: string;
  sourceId?: string;
}

export interface ProcessingResult {
  success: boolean;
  message: string;
  data?: any;
}

export class HubSpotWebhookProcessor {
  private supabase: any;

  constructor() {
    this.supabase = createServerClient(cookies());
  }

  /**
   * Process a batch of webhook events
   */
  async processBatch(events: WebhookEvent[]): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];
    
    // Group events by portal for efficient processing
    const eventsByPortal = this.groupEventsByPortal(events);
    
    for (const [portalId, portalEvents] of Object.entries(eventsByPortal)) {
      // Get workspace for this portal
      const workspace = await this.getWorkspaceForPortal(portalId);
      if (!workspace) {
        results.push(...portalEvents.map(event => ({
          success: false,
          message: `No workspace found for portal ${portalId}`,
        })));
        continue;
      }
      
      // Process events for this workspace
      for (const event of portalEvents) {
        const result = await this.processEvent(event, workspace.id);
        results.push(result);
      }
    }
    
    return results;
  }

  /**
   * Process a single webhook event
   */
  async processEvent(
    event: WebhookEvent,
    workspaceId: string
  ): Promise<ProcessingResult> {
    try {
      // Log the event
      await this.logEvent(event);
      
      // Route to appropriate handler
      switch (event.eventType) {
        case 'contact.creation':
          return await this.handleContactCreation(event, workspaceId);
          
        case 'contact.propertyChange':
          return await this.handleContactUpdate(event, workspaceId);
          
        case 'contact.deletion':
          return await this.handleContactDeletion(event, workspaceId);
          
        case 'contact.merge':
          return await this.handleContactMerge(event, workspaceId);
          
        case 'engagement.creation':
          return await this.handleEngagementCreation(event, workspaceId);
          
        case 'deal.creation':
          return await this.handleDealCreation(event, workspaceId);
          
        case 'deal.propertyChange':
          return await this.handleDealUpdate(event, workspaceId);
          
        default:
          return {
            success: true,
            message: `Unhandled event type: ${event.eventType}`,
          };
      }
    } catch (error) {
      console.error('Error processing webhook event:', error);
      await this.logError(event, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Handle contact creation
   */
  private async handleContactCreation(
    event: WebhookEvent,
    workspaceId: string
  ): Promise<ProcessingResult> {
    // Queue contact for import
    await this.supabase
      .from('hubspot_import_queue')
      .insert({
        workspace_id: workspaceId,
        hubspot_contact_id: event.objectId.toString(),
        status: 'pending',
      });
    
    // Process immediately if possible
    const auth = new HubSpotAuth();
    const accessToken = await auth.getValidAccessToken(workspaceId);
    const contactSync = new HubSpotContactSync(workspaceId, accessToken);
    
    const contact = await contactSync.fetchContact(event.objectId.toString());
    if (contact) {
      const lead = await contactSync.createLeadFromContact(contact);
      return {
        success: true,
        message: `Created lead ${lead.id} from HubSpot contact ${event.objectId}`,
        data: { leadId: lead.id },
      };
    }
    
    return {
      success: true,
      message: `Queued contact ${event.objectId} for import`,
    };
  }

  /**
   * Handle contact property update
   */
  private async handleContactUpdate(
    event: WebhookEvent,
    workspaceId: string
  ): Promise<ProcessingResult> {
    if (!event.propertyName) {
      return {
        success: true,
        message: 'No property specified in update event',
      };
    }
    
    // Find corresponding lead
    const { data: syncStatus } = await this.supabase
      .from('hubspot_sync_status')
      .select('entity_id')
      .eq('workspace_id', workspaceId)
      .eq('entity_type', 'contact')
      .eq('hubspot_id', event.objectId.toString())
      .single();
    
    if (!syncStatus) {
      // Contact not synced yet, queue for import
      await this.handleContactCreation(event, workspaceId);
      return {
        success: true,
        message: `Contact ${event.objectId} not found, queued for import`,
      };
    }
    
    // Get field mapping
    const { data: fieldMapping } = await this.supabase
      .from('integration_field_mappings')
      .select('local_field, transform_rule')
      .eq('workspace_id', workspaceId)
      .eq('integration_id', 'hubspot')
      .eq('remote_field', event.propertyName)
      .eq('direction', 'bidirectional')
      .single();
    
    if (!fieldMapping) {
      return {
        success: true,
        message: `No mapping found for property ${event.propertyName}`,
      };
    }
    
    // Apply transformation if needed
    let value = event.propertyValue;
    if (fieldMapping.transform_rule) {
      value = this.applyTransform(value, fieldMapping.transform_rule);
    }
    
    // Update lead
    const updateData: any = {};
    updateData[fieldMapping.local_field] = value;
    
    await this.supabase
      .from('leads')
      .update(updateData)
      .eq('id', syncStatus.entity_id)
      .eq('workspace_id', workspaceId);
    
    // Trigger workflows if configured
    const workflowTrigger = new HubSpotWorkflowTrigger(workspaceId);
    await workflowTrigger.processPropertyChange(
      syncStatus.entity_id,
      event.propertyName,
      event.propertyValue
    );
    
    return {
      success: true,
      message: `Updated lead ${syncStatus.entity_id} property ${fieldMapping.local_field}`,
      data: { leadId: syncStatus.entity_id, field: fieldMapping.local_field, value },
    };
  }

  /**
   * Handle contact deletion
   */
  private async handleContactDeletion(
    event: WebhookEvent,
    workspaceId: string
  ): Promise<ProcessingResult> {
    const { data: syncStatus } = await this.supabase
      .from('hubspot_sync_status')
      .select('entity_id')
      .eq('workspace_id', workspaceId)
      .eq('entity_type', 'contact')
      .eq('hubspot_id', event.objectId.toString())
      .single();
    
    if (syncStatus) {
      // Soft delete the lead
      await this.supabase
        .from('leads')
        .update({ 
          deleted_at: new Date().toISOString(),
          deletion_reason: 'Deleted in HubSpot',
        })
        .eq('id', syncStatus.entity_id)
        .eq('workspace_id', workspaceId);
      
      // Update sync status
      await this.supabase
        .from('hubspot_sync_status')
        .update({ sync_state: 'deleted' })
        .eq('entity_id', syncStatus.entity_id)
        .eq('workspace_id', workspaceId);
      
      return {
        success: true,
        message: `Soft-deleted lead ${syncStatus.entity_id}`,
        data: { leadId: syncStatus.entity_id },
      };
    }
    
    return {
      success: true,
      message: `Contact ${event.objectId} not found in system`,
    };
  }

  /**
   * Handle contact merge
   */
  private async handleContactMerge(
    event: WebhookEvent,
    workspaceId: string
  ): Promise<ProcessingResult> {
    const winningContactId = event.objectId.toString();
    const mergedContactId = event.sourceId;
    
    if (!mergedContactId) {
      return {
        success: false,
        message: 'No merged contact ID provided',
      };
    }
    
    // Update sync status to point to winning contact
    const { data: syncStatus } = await this.supabase
      .from('hubspot_sync_status')
      .update({ hubspot_id: winningContactId })
      .eq('workspace_id', workspaceId)
      .eq('entity_type', 'contact')
      .eq('hubspot_id', mergedContactId)
      .select('entity_id')
      .single();
    
    if (syncStatus) {
      return {
        success: true,
        message: `Updated sync mapping for merged contact`,
        data: { 
          leadId: syncStatus.entity_id,
          oldHubSpotId: mergedContactId,
          newHubSpotId: winningContactId,
        },
      };
    }
    
    return {
      success: true,
      message: `Merged contact ${mergedContactId} not found in system`,
    };
  }

  /**
   * Handle engagement creation
   */
  private async handleEngagementCreation(
    event: WebhookEvent,
    workspaceId: string
  ): Promise<ProcessingResult> {
    // Log engagement for analytics
    await this.supabase
      .from('hubspot_engagement_log')
      .insert({
        workspace_id: workspaceId,
        engagement_id: event.objectId.toString(),
        event_type: event.eventType,
        occurred_at: new Date(event.occurredAt).toISOString(),
      });
    
    // Could trigger workflows based on engagement type
    const workflowTrigger = new HubSpotWorkflowTrigger(workspaceId);
    await workflowTrigger.processEngagement(event.objectId.toString(), 'created');
    
    return {
      success: true,
      message: `Logged engagement ${event.objectId}`,
    };
  }

  /**
   * Handle deal creation
   */
  private async handleDealCreation(
    event: WebhookEvent,
    workspaceId: string
  ): Promise<ProcessingResult> {
    // Could create opportunity record or trigger workflows
    return {
      success: true,
      message: `Deal ${event.objectId} created`,
    };
  }

  /**
   * Handle deal update
   */
  private async handleDealUpdate(
    event: WebhookEvent,
    workspaceId: string
  ): Promise<ProcessingResult> {
    // Could update opportunity status or trigger workflows
    if (event.propertyName === 'dealstage') {
      // Trigger workflow for deal stage change
      const workflowTrigger = new HubSpotWorkflowTrigger(workspaceId);
      await workflowTrigger.processDealStageChange(
        event.objectId.toString(),
        event.propertyValue
      );
    }
    
    return {
      success: true,
      message: `Deal ${event.objectId} updated`,
    };
  }

  /**
   * Group events by portal ID
   */
  private groupEventsByPortal(
    events: WebhookEvent[]
  ): Record<string, WebhookEvent[]> {
    return events.reduce((acc, event) => {
      const portalId = event.portalId.toString();
      if (!acc[portalId]) {
        acc[portalId] = [];
      }
      acc[portalId].push(event);
      return acc;
    }, {} as Record<string, WebhookEvent[]>);
  }

  /**
   * Get workspace for a HubSpot portal
   */
  private async getWorkspaceForPortal(
    portalId: string
  ): Promise<{ id: string } | null> {
    const { data } = await this.supabase
      .from('integrations')
      .select('workspace_id')
      .eq('provider', 'hubspot')
      .eq('provider_account_id', portalId)
      .eq('is_active', true)
      .single();
    
    return data ? { id: data.workspace_id } : null;
  }

  /**
   * Apply transformation rule to a value
   */
  private applyTransform(value: any, rule: any): any {
    if (!rule || !rule.type) return value;
    
    switch (rule.type) {
      case 'uppercase':
        return typeof value === 'string' ? value.toUpperCase() : value;
        
      case 'lowercase':
        return typeof value === 'string' ? value.toLowerCase() : value;
        
      case 'trim':
        return typeof value === 'string' ? value.trim() : value;
        
      case 'date_format':
        if (value && rule.format) {
          const date = new Date(value);
          // Simple date formatting
          return date.toISOString().split('T')[0];
        }
        return value;
        
      case 'number_format':
        if (typeof value === 'number' && rule.decimals !== undefined) {
          return value.toFixed(rule.decimals);
        }
        return value;
        
      case 'map':
        if (rule.mapping && rule.mapping[value] !== undefined) {
          return rule.mapping[value];
        }
        return value;
        
      default:
        return value;
    }
  }

  /**
   * Log webhook event
   */
  private async logEvent(event: WebhookEvent): Promise<void> {
    await this.supabase
      .from('hubspot_webhook_logs')
      .insert({
        event_id: event.eventId.toString(),
        event_type: event.eventType,
        portal_id: event.portalId.toString(),
        object_id: event.objectId.toString(),
        occurred_at: new Date(event.occurredAt).toISOString(),
        event_data: event,
      });
  }

  /**
   * Log webhook error
   */
  private async logError(event: WebhookEvent, error: any): Promise<void> {
    await this.supabase
      .from('hubspot_webhook_errors')
      .insert({
        event_id: event.eventId.toString(),
        event_type: event.eventType,
        error_message: error instanceof Error ? error.message : 'Unknown error',
        event_data: event,
      });
  }
}