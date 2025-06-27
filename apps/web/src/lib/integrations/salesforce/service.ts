import { createClient } from '@/utils/supabase/server';
import { SalesforceClient } from './client';
import { SalesforceAuth } from './auth';
import {
  SalesforceIntegration,
  SalesforceSyncConfig,
  SalesforceFieldMapping,
  SalesforceLead,
  SalesforceContact,
  SalesforceCampaign,
  SalesforceTask,
  SalesforceSyncQueueItem,
  SalesforceSyncLog,
  FieldMappingConfig,
} from './types';

export class SalesforceService {
  private auth: SalesforceAuth;

  constructor() {
    this.auth = new SalesforceAuth({
      client_id: process.env.SALESFORCE_CLIENT_ID!,
      client_secret: process.env.SALESFORCE_CLIENT_SECRET!,
      redirect_uri: process.env.SALESFORCE_REDIRECT_URI!,
      api_version: 'v59.0',
      sandbox: process.env.SALESFORCE_SANDBOX === 'true',
    });
  }

  /**
   * Get Salesforce client for a workspace
   */
  async getClient(workspaceId: string): Promise<{ client?: SalesforceClient; error?: string }> {
    const { accessToken, instanceUrl, error } = await this.auth.getValidAccessToken(workspaceId);
    
    if (error || !accessToken || !instanceUrl) {
      return { error: error || 'Failed to get Salesforce client' };
    }

    const client = new SalesforceClient(instanceUrl, accessToken);
    return { client };
  }

  /**
   * Sync leads to Salesforce
   */
  async syncLeadsToSalesforce(
    workspaceId: string,
    leadIds?: string[]
  ): Promise<{ success: boolean; synced: number; failed: number; errors: string[] }> {
    const supabase = createClient();
    const results = {
      success: true,
      synced: 0,
      failed: 0,
      errors: [] as string[],
    };

    try {
      // Get Salesforce client
      const { client, error: clientError } = await this.getClient(workspaceId);
      if (clientError || !client) {
        throw new Error(clientError || 'Failed to get Salesforce client');
      }

      // Get field mappings
      const { data: fieldMapping } = await supabase
        .from('salesforce_field_mappings')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('local_object', 'lead')
        .eq('salesforce_object', 'Lead')
        .eq('is_active', true)
        .single();

      // Get leads to sync
      let query = supabase
        .from('leads')
        .select('*')
        .eq('workspace_id', workspaceId);

      if (leadIds && leadIds.length > 0) {
        query = query.in('id', leadIds);
      }

      const { data: leads, error: leadsError } = await query;
      if (leadsError) throw leadsError;

      // Process each lead
      for (const lead of leads || []) {
        try {
          // Check if lead already synced
          const { data: mapping } = await supabase
            .from('salesforce_object_mappings')
            .select('*')
            .eq('workspace_id', workspaceId)
            .eq('local_object_type', 'lead')
            .eq('local_object_id', lead.id)
            .single();

          const salesforceLead = this.mapLeadToSalesforce(lead, fieldMapping);

          if (mapping) {
            // Update existing Salesforce lead
            await client.updateRecord('Lead', mapping.salesforce_object_id, salesforceLead);
            
            // Update mapping
            await supabase
              .from('salesforce_object_mappings')
              .update({
                last_synced_at: new Date().toISOString(),
                sync_status: 'synced',
                local_version: lead.version || 1,
              })
              .eq('id', mapping.id);
          } else {
            // Create new Salesforce lead
            const salesforceId = await client.createLead(salesforceLead);
            
            // Create mapping
            await supabase
              .from('salesforce_object_mappings')
              .insert({
                workspace_id: workspaceId,
                local_object_type: 'lead',
                local_object_id: lead.id,
                salesforce_object_type: 'Lead',
                salesforce_object_id: salesforceId,
                sync_status: 'synced',
              });
          }

          results.synced++;
        } catch (error) {
          results.failed++;
          results.errors.push(`Lead ${lead.id}: ${error}`);
          console.error(`Error syncing lead ${lead.id}:`, error);
        }
      }
    } catch (error) {
      results.success = false;
      results.errors.push(`Sync error: ${error}`);
      console.error('Salesforce sync error:', error);
    }

    // Log sync results
    await this.logSyncResults(workspaceId, 'to_salesforce', results);

    return results;
  }

  /**
   * Sync leads from Salesforce
   */
  async syncLeadsFromSalesforce(
    workspaceId: string,
    modifiedSince?: string
  ): Promise<{ success: boolean; synced: number; failed: number; errors: string[] }> {
    const supabase = createClient();
    const results = {
      success: true,
      synced: 0,
      failed: 0,
      errors: [] as string[],
    };

    try {
      // Get Salesforce client
      const { client, error: clientError } = await this.getClient(workspaceId);
      if (clientError || !client) {
        throw new Error(clientError || 'Failed to get Salesforce client');
      }

      // Build SOQL query
      let soql = `SELECT Id, FirstName, LastName, Email, Company, Title, Phone, 
                  Website, Status, LeadSource, Industry, Rating, OwnerId, 
                  IsConverted, CreatedDate, LastModifiedDate 
                  FROM Lead`;

      if (modifiedSince) {
        soql += ` WHERE LastModifiedDate > ${modifiedSince}`;
      }

      soql += ' ORDER BY LastModifiedDate DESC LIMIT 200';

      // Query Salesforce leads
      const salesforceLeads = await client.query<SalesforceLead>(soql);

      // Process each Salesforce lead
      for (const sfLead of salesforceLeads.records) {
        try {
          // Check if lead already exists
          const { data: mapping } = await supabase
            .from('salesforce_object_mappings')
            .select('*')
            .eq('workspace_id', workspaceId)
            .eq('salesforce_object_type', 'Lead')
            .eq('salesforce_object_id', sfLead.Id)
            .single();

          const leadData = this.mapSalesforceToLead(sfLead);

          if (mapping) {
            // Update existing lead
            await supabase
              .from('leads')
              .update(leadData)
              .eq('id', mapping.local_object_id);
          } else {
            // Create new lead
            const { data: newLead, error: createError } = await supabase
              .from('leads')
              .insert({
                workspace_id: workspaceId,
                ...leadData,
              })
              .select()
              .single();

            if (createError) throw createError;

            // Create mapping
            await supabase
              .from('salesforce_object_mappings')
              .insert({
                workspace_id: workspaceId,
                local_object_type: 'lead',
                local_object_id: newLead.id,
                salesforce_object_type: 'Lead',
                salesforce_object_id: sfLead.Id,
                sync_status: 'synced',
              });
          }

          results.synced++;
        } catch (error) {
          results.failed++;
          results.errors.push(`Salesforce Lead ${sfLead.Id}: ${error}`);
          console.error(`Error syncing Salesforce lead ${sfLead.Id}:`, error);
        }
      }
    } catch (error) {
      results.success = false;
      results.errors.push(`Sync error: ${error}`);
      console.error('Salesforce sync error:', error);
    }

    // Log sync results
    await this.logSyncResults(workspaceId, 'from_salesforce', results);

    return results;
  }

  /**
   * Sync campaigns to Salesforce
   */
  async syncCampaignsToSalesforce(
    workspaceId: string,
    campaignIds?: string[]
  ): Promise<{ success: boolean; synced: number; failed: number; errors: string[] }> {
    const supabase = createClient();
    const results = {
      success: true,
      synced: 0,
      failed: 0,
      errors: [] as string[],
    };

    try {
      // Get Salesforce client
      const { client, error: clientError } = await this.getClient(workspaceId);
      if (clientError || !client) {
        throw new Error(clientError || 'Failed to get Salesforce client');
      }

      // Get campaigns to sync
      let query = supabase
        .from('campaigns')
        .select('*')
        .eq('workspace_id', workspaceId);

      if (campaignIds && campaignIds.length > 0) {
        query = query.in('id', campaignIds);
      }

      const { data: campaigns, error: campaignsError } = await query;
      if (campaignsError) throw campaignsError;

      // Process each campaign
      for (const campaign of campaigns || []) {
        try {
          // Check if campaign already synced
          const { data: mapping } = await supabase
            .from('salesforce_object_mappings')
            .select('*')
            .eq('workspace_id', workspaceId)
            .eq('local_object_type', 'campaign')
            .eq('local_object_id', campaign.id)
            .single();

          const salesforceCampaign = this.mapCampaignToSalesforce(campaign);

          if (mapping) {
            // Update existing Salesforce campaign
            await client.updateRecord('Campaign', mapping.salesforce_object_id, salesforceCampaign);
          } else {
            // Create new Salesforce campaign
            const salesforceId = await client.createCampaign(salesforceCampaign);
            
            // Create mapping
            await supabase
              .from('salesforce_object_mappings')
              .insert({
                workspace_id: workspaceId,
                local_object_type: 'campaign',
                local_object_id: campaign.id,
                salesforce_object_type: 'Campaign',
                salesforce_object_id: salesforceId,
                sync_status: 'synced',
              });
          }

          // Sync campaign members
          await this.syncCampaignMembers(workspaceId, campaign.id, mapping?.salesforce_object_id);

          results.synced++;
        } catch (error) {
          results.failed++;
          results.errors.push(`Campaign ${campaign.id}: ${error}`);
          console.error(`Error syncing campaign ${campaign.id}:`, error);
        }
      }
    } catch (error) {
      results.success = false;
      results.errors.push(`Sync error: ${error}`);
      console.error('Salesforce campaign sync error:', error);
    }

    return results;
  }

  /**
   * Sync email activities to Salesforce as tasks
   */
  async syncEmailActivities(
    workspaceId: string,
    startDate?: string
  ): Promise<{ success: boolean; synced: number; failed: number; errors: string[] }> {
    const supabase = createClient();
    const results = {
      success: true,
      synced: 0,
      failed: 0,
      errors: [] as string[],
    };

    try {
      // Get Salesforce client
      const { client, error: clientError } = await this.getClient(workspaceId);
      if (clientError || !client) {
        throw new Error(clientError || 'Failed to get Salesforce client');
      }

      // Get email events to sync
      let query = supabase
        .from('email_events')
        .select(`
          *,
          campaign_email!inner(
            id,
            subject,
            campaign_id,
            lead_id
          )
        `)
        .eq('campaign_email.workspace_id', workspaceId)
        .in('event_type', ['sent', 'opened', 'clicked', 'replied']);

      if (startDate) {
        query = query.gte('created_at', startDate);
      }

      const { data: events, error: eventsError } = await query;
      if (eventsError) throw eventsError;

      // Process each event
      for (const event of events || []) {
        try {
          // Get lead mapping
          const { data: leadMapping } = await supabase
            .from('salesforce_object_mappings')
            .select('salesforce_object_id')
            .eq('workspace_id', workspaceId)
            .eq('local_object_type', 'lead')
            .eq('local_object_id', event.campaign_email.lead_id)
            .single();

          if (leadMapping) {
            // Create task in Salesforce
            const task: Partial<SalesforceTask> = {
              Subject: `Email ${event.event_type}: ${event.campaign_email.subject}`,
              ActivityDate: new Date(event.created_at).toISOString().split('T')[0],
              Status: 'Completed',
              Priority: 'Normal',
              WhoId: leadMapping.salesforce_object_id,
              Description: `Email ${event.event_type} at ${new Date(event.created_at).toLocaleString()}`,
            };

            await client.createTask(task);
            results.synced++;
          }
        } catch (error) {
          results.failed++;
          results.errors.push(`Email event ${event.id}: ${error}`);
          console.error(`Error syncing email event ${event.id}:`, error);
        }
      }
    } catch (error) {
      results.success = false;
      results.errors.push(`Sync error: ${error}`);
      console.error('Salesforce activity sync error:', error);
    }

    return results;
  }

  /**
   * Process sync queue
   */
  async processSyncQueue(
    workspaceId: string,
    limit: number = 50
  ): Promise<{ processed: number; failed: number; errors: string[] }> {
    const supabase = createClient();
    const results = {
      processed: 0,
      failed: 0,
      errors: [] as string[],
    };

    try {
      // Get Salesforce client
      const { client, error: clientError } = await this.getClient(workspaceId);
      if (clientError || !client) {
        throw new Error(clientError || 'Failed to get Salesforce client');
      }

      // Get pending items from queue
      const { data: queueItems, error: queueError } = await supabase
        .from('salesforce_sync_queue')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('status', 'pending')
        .lte('scheduled_for', new Date().toISOString())
        .order('priority', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(limit);

      if (queueError) throw queueError;

      // Process each queue item
      for (const item of queueItems || []) {
        try {
          // Update status to processing
          await supabase
            .from('salesforce_sync_queue')
            .update({
              status: 'processing',
              started_at: new Date().toISOString(),
              attempts: item.attempts + 1,
            })
            .eq('id', item.id);

          // Process based on operation
          switch (item.operation) {
            case 'create':
              const createResult = await client.createRecord(item.object_type, item.payload);
              if (createResult.success && item.local_id) {
                // Create mapping
                await supabase
                  .from('salesforce_object_mappings')
                  .insert({
                    workspace_id: workspaceId,
                    local_object_type: this.getLocalObjectType(item.object_type),
                    local_object_id: item.local_id,
                    salesforce_object_type: item.object_type,
                    salesforce_object_id: createResult.id,
                    sync_status: 'synced',
                  });
              }
              break;

            case 'update':
              if (item.salesforce_id) {
                await client.updateRecord(item.object_type, item.salesforce_id, item.payload);
              }
              break;

            case 'delete':
              if (item.salesforce_id) {
                await client.deleteRecord(item.object_type, item.salesforce_id);
              }
              break;

            case 'upsert':
              // Implement upsert logic based on external ID
              break;
          }

          // Mark as completed
          await supabase
            .from('salesforce_sync_queue')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
            })
            .eq('id', item.id);

          results.processed++;
        } catch (error) {
          results.failed++;
          results.errors.push(`Queue item ${item.id}: ${error}`);

          // Update queue item with error
          await supabase
            .from('salesforce_sync_queue')
            .update({
              status: item.attempts >= item.max_attempts ? 'failed' : 'pending',
              error_message: String(error),
              scheduled_for: new Date(Date.now() + Math.pow(2, item.attempts) * 60000).toISOString(), // Exponential backoff
            })
            .eq('id', item.id);
        }
      }
    } catch (error) {
      console.error('Error processing sync queue:', error);
      results.errors.push(`Queue processing error: ${error}`);
    }

    return results;
  }

  // Helper methods

  private mapLeadToSalesforce(lead: any, fieldMapping?: SalesforceFieldMapping): Partial<SalesforceLead> {
    const defaultMapping: Partial<SalesforceLead> = {
      FirstName: lead.first_name,
      LastName: lead.last_name || 'Unknown',
      Email: lead.email,
      Company: lead.company || 'Unknown',
      Title: lead.job_title,
      Phone: lead.phone,
      Website: lead.website,
      LeadSource: lead.source || 'ColdCopy',
      Industry: lead.industry,
      Status: 'Open - Not Contacted',
    };

    // Apply custom field mappings if provided
    if (fieldMapping && fieldMapping.field_mappings) {
      return this.applyFieldMappings(lead, defaultMapping, fieldMapping.field_mappings);
    }

    return defaultMapping;
  }

  private mapSalesforceToLead(sfLead: SalesforceLead): any {
    return {
      first_name: sfLead.FirstName,
      last_name: sfLead.LastName,
      email: sfLead.Email,
      company: sfLead.Company,
      job_title: sfLead.Title,
      phone: sfLead.Phone,
      website: sfLead.Website,
      industry: sfLead.Industry,
      source: sfLead.LeadSource,
      salesforce_id: sfLead.Id,
      salesforce_data: sfLead,
    };
  }

  private mapCampaignToSalesforce(campaign: any): Partial<SalesforceCampaign> {
    return {
      Name: campaign.name,
      Type: 'Email',
      Status: campaign.status === 'active' ? 'In Progress' : 'Completed',
      StartDate: campaign.created_at,
      IsActive: campaign.status === 'active',
      Description: campaign.description,
    };
  }

  private applyFieldMappings(
    source: any,
    target: any,
    mappings: FieldMappingConfig[]
  ): any {
    const result = { ...target };

    for (const mapping of mappings) {
      const value = source[mapping.local_field];
      
      if (value !== undefined || mapping.default_value !== undefined) {
        const transformedValue = this.transformValue(
          value || mapping.default_value,
          mapping.transform,
          mapping.custom_transform
        );
        
        result[mapping.salesforce_field] = transformedValue;
      }
    }

    return result;
  }

  private transformValue(value: any, transform?: string, customTransform?: Function): any {
    if (customTransform) {
      return customTransform(value);
    }

    switch (transform) {
      case 'lowercase':
        return String(value).toLowerCase();
      case 'uppercase':
        return String(value).toUpperCase();
      case 'trim':
        return String(value).trim();
      case 'date':
        return new Date(value).toISOString();
      case 'boolean':
        return Boolean(value);
      case 'number':
        return Number(value);
      default:
        return value;
    }
  }

  private getLocalObjectType(salesforceType: string): string {
    const mapping: Record<string, string> = {
      'Lead': 'lead',
      'Contact': 'lead',
      'Campaign': 'campaign',
      'Task': 'email_event',
      'Event': 'email_event',
    };
    return mapping[salesforceType] || 'lead';
  }

  private async syncCampaignMembers(
    workspaceId: string,
    campaignId: string,
    salesforceCampaignId?: string
  ): Promise<void> {
    if (!salesforceCampaignId) return;

    const supabase = createClient();
    const { client } = await this.getClient(workspaceId);
    if (!client) return;

    // Get campaign emails
    const { data: campaignEmails } = await supabase
      .from('campaign_emails')
      .select('lead_id')
      .eq('campaign_id', campaignId)
      .eq('workspace_id', workspaceId);

    if (!campaignEmails) return;

    // Add each lead as campaign member
    for (const email of campaignEmails) {
      try {
        // Get lead's Salesforce ID
        const { data: mapping } = await supabase
          .from('salesforce_object_mappings')
          .select('salesforce_object_id')
          .eq('workspace_id', workspaceId)
          .eq('local_object_type', 'lead')
          .eq('local_object_id', email.lead_id)
          .single();

        if (mapping) {
          await client.addCampaignMember(
            salesforceCampaignId,
            mapping.salesforce_object_id,
            'Sent'
          );
        }
      } catch (error) {
        console.error(`Error adding campaign member:`, error);
      }
    }
  }

  private async logSyncResults(
    workspaceId: string,
    syncDirection: 'to_salesforce' | 'from_salesforce',
    results: any
  ): Promise<void> {
    const supabase = createClient();
    
    await supabase
      .from('salesforce_sync_logs')
      .insert({
        workspace_id: workspaceId,
        sync_type: 'manual',
        sync_direction: syncDirection,
        total_records: results.synced + results.failed,
        created_records: results.synced,
        failed_records: results.failed,
        status: results.success ? 'completed' : 'failed',
        error_message: results.errors.length > 0 ? results.errors.join('; ') : null,
        warnings: results.errors,
        completed_at: new Date().toISOString(),
      });
  }
}