import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { HubSpotClient } from './client';
import { HubSpotAuth } from './auth';
import {
  HubSpotContact,
  HubSpotFieldMapping,
  HubSpotSyncStatus,
  HubSpotSyncError,
  HubSpotSearchRequest,
  HubSpotSearchResponse,
  HubSpotBatchOperation,
} from './types';
import { Lead } from '@/types';

export class HubSpotContactSync {
  private client: HubSpotClient;
  private auth: HubSpotAuth;
  private workspaceId: string;

  constructor(workspaceId: string, accessToken?: string) {
    this.workspaceId = workspaceId;
    this.auth = new HubSpotAuth();
    
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
   * Sync a single lead to HubSpot
   */
  async syncLeadToHubSpot(lead: Lead): Promise<HubSpotContact> {
    await this.ensureClient();

    try {
      // Get field mappings
      const mappings = await this.getFieldMappings();
      
      // Check if contact already exists
      const existingContact = await this.findContactByEmail(lead.email);
      
      if (existingContact) {
        // Update existing contact
        return await this.updateContact(existingContact.id, lead, mappings);
      } else {
        // Create new contact
        return await this.createContact(lead, mappings);
      }
    } catch (error) {
      throw new HubSpotSyncError(
        `Failed to sync lead ${lead.id}: ${error.message}`,
        lead.id,
        'contact'
      );
    }
  }

  /**
   * Find contact by email
   */
  async findContactByEmail(email: string): Promise<HubSpotContact | null> {
    await this.ensureClient();

    const searchRequest: HubSpotSearchRequest = {
      filterGroups: [{
        filters: [{
          propertyName: 'email',
          operator: 'EQ',
          value: email,
        }],
      }],
      properties: ['email', 'firstname', 'lastname', 'company'],
      limit: 1,
    };

    const response = await this.client.post<HubSpotSearchResponse<HubSpotContact>>(
      '/crm/v3/objects/contacts/search',
      searchRequest
    );

    return response.results.length > 0 ? response.results[0] : null;
  }

  /**
   * Create a new contact in HubSpot
   */
  async createContact(
    lead: Lead,
    mappings: HubSpotFieldMapping[]
  ): Promise<HubSpotContact> {
    await this.ensureClient();

    const properties = this.mapLeadToHubSpotProperties(lead, mappings);
    
    const contact = await this.client.post<HubSpotContact>(
      '/crm/v3/objects/contacts',
      { properties }
    );

    // Record sync status
    await this.recordSyncStatus(lead.id, contact.id, 'synced');

    return contact;
  }

  /**
   * Update an existing contact in HubSpot
   */
  async updateContact(
    contactId: string,
    lead: Lead,
    mappings: HubSpotFieldMapping[]
  ): Promise<HubSpotContact> {
    await this.ensureClient();

    const properties = this.mapLeadToHubSpotProperties(lead, mappings);
    
    const contact = await this.client.patch<HubSpotContact>(
      `/crm/v3/objects/contacts/${contactId}`,
      { properties }
    );

    // Record sync status
    await this.recordSyncStatus(lead.id, contact.id, 'synced');

    return contact;
  }

  /**
   * Sync contacts from HubSpot to ColdCopy
   */
  async syncContactsFromHubSpot(
    modifiedAfter?: Date
  ): Promise<{ synced: number; errors: number }> {
    await this.ensureClient();

    let synced = 0;
    let errors = 0;
    let after: string | undefined;

    // Get field mappings
    const mappings = await this.getFieldMappings();

    do {
      const searchRequest: HubSpotSearchRequest = {
        filterGroups: modifiedAfter ? [{
          filters: [{
            propertyName: 'hs_lastmodifieddate',
            operator: 'GTE',
            value: modifiedAfter.toISOString(),
          }],
        }] : undefined,
        properties: this.getHubSpotProperties(mappings),
        limit: 100,
        after,
      };

      const response = await this.client.post<HubSpotSearchResponse<HubSpotContact>>(
        '/crm/v3/objects/contacts/search',
        searchRequest
      );

      for (const contact of response.results) {
        try {
          await this.syncContactToLead(contact, mappings);
          synced++;
        } catch (error) {
          console.error(`Failed to sync contact ${contact.id}:`, error);
          errors++;
        }
      }

      after = response.paging?.next?.after;
    } while (after);

    return { synced, errors };
  }

  /**
   * Sync HubSpot contact to ColdCopy lead
   */
  async syncContactToLead(
    contact: HubSpotContact,
    mappings: HubSpotFieldMapping[]
  ): Promise<void> {
    const supabase = createServerClient(cookies());

    // Map HubSpot properties to lead fields
    const leadData = this.mapHubSpotPropertiesToLead(contact, mappings);

    // Check if lead exists
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id')
      .eq('workspace_id', this.workspaceId)
      .eq('email', contact.properties.email)
      .single();

    if (existingLead) {
      // Update existing lead
      await supabase
        .from('leads')
        .update(leadData)
        .eq('id', existingLead.id);
    } else {
      // Create new lead
      await supabase
        .from('leads')
        .insert({
          ...leadData,
          workspace_id: this.workspaceId,
        });
    }

    // Record sync status
    await this.recordSyncStatus(
      existingLead?.id || leadData.email,
      contact.id,
      'synced'
    );
  }

  /**
   * Batch sync multiple leads
   */
  async batchSyncLeads(
    leadIds: string[]
  ): Promise<{ synced: number; errors: number }> {
    const supabase = createServerClient(cookies());
    
    // Get leads
    const { data: leads } = await supabase
      .from('leads')
      .select('*')
      .in('id', leadIds)
      .eq('workspace_id', this.workspaceId);

    if (!leads) {
      return { synced: 0, errors: 0 };
    }

    let synced = 0;
    let errors = 0;

    // Process in batches
    const batchSize = 100;
    for (let i = 0; i < leads.length; i += batchSize) {
      const batch = leads.slice(i, i + batchSize);
      
      try {
        await this.batchCreateOrUpdateContacts(batch);
        synced += batch.length;
      } catch (error) {
        console.error('Batch sync error:', error);
        errors += batch.length;
      }
    }

    return { synced, errors };
  }

  /**
   * Batch create or update contacts
   */
  private async batchCreateOrUpdateContacts(leads: Lead[]): Promise<void> {
    await this.ensureClient();

    const mappings = await this.getFieldMappings();
    const toCreate: any[] = [];
    const toUpdate: any[] = [];

    // Check which contacts exist
    for (const lead of leads) {
      const existingContact = await this.findContactByEmail(lead.email);
      const properties = this.mapLeadToHubSpotProperties(lead, mappings);

      if (existingContact) {
        toUpdate.push({
          id: existingContact.id,
          properties,
        });
      } else {
        toCreate.push({ properties });
      }
    }

    // Batch create
    if (toCreate.length > 0) {
      await this.client.post('/crm/v3/objects/contacts/batch/create', {
        inputs: toCreate,
      });
    }

    // Batch update
    if (toUpdate.length > 0) {
      await this.client.post('/crm/v3/objects/contacts/batch/update', {
        inputs: toUpdate,
      });
    }
  }

  /**
   * Get field mappings
   */
  private async getFieldMappings(): Promise<HubSpotFieldMapping[]> {
    const supabase = createServerClient(cookies());

    const { data } = await supabase
      .from('hubspot_field_mappings')
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .in('direction', ['to_hubspot', 'bidirectional']);

    return data || this.getDefaultMappings();
  }

  /**
   * Get default field mappings
   */
  private getDefaultMappings(): HubSpotFieldMapping[] {
    return [
      {
        id: '1',
        workspaceId: this.workspaceId,
        coldcopyField: 'email',
        hubspotProperty: 'email',
        direction: 'bidirectional',
        createdAt: new Date(),
      },
      {
        id: '2',
        workspaceId: this.workspaceId,
        coldcopyField: 'firstName',
        hubspotProperty: 'firstname',
        direction: 'bidirectional',
        createdAt: new Date(),
      },
      {
        id: '3',
        workspaceId: this.workspaceId,
        coldcopyField: 'lastName',
        hubspotProperty: 'lastname',
        direction: 'bidirectional',
        createdAt: new Date(),
      },
      {
        id: '4',
        workspaceId: this.workspaceId,
        coldcopyField: 'company',
        hubspotProperty: 'company',
        direction: 'bidirectional',
        createdAt: new Date(),
      },
      {
        id: '5',
        workspaceId: this.workspaceId,
        coldcopyField: 'phone',
        hubspotProperty: 'phone',
        direction: 'bidirectional',
        createdAt: new Date(),
      },
    ];
  }

  /**
   * Map lead to HubSpot properties
   */
  private mapLeadToHubSpotProperties(
    lead: Lead,
    mappings: HubSpotFieldMapping[]
  ): Record<string, any> {
    const properties: Record<string, any> = {};

    for (const mapping of mappings) {
      const value = lead[mapping.coldcopyField as keyof Lead];
      if (value !== undefined && value !== null) {
        properties[mapping.hubspotProperty] = value;
      }
    }

    return properties;
  }

  /**
   * Map HubSpot properties to lead
   */
  private mapHubSpotPropertiesToLead(
    contact: HubSpotContact,
    mappings: HubSpotFieldMapping[]
  ): Partial<Lead> {
    const lead: Partial<Lead> = {};

    for (const mapping of mappings) {
      if (mapping.direction === 'from_hubspot' || mapping.direction === 'bidirectional') {
        const value = contact.properties[mapping.hubspotProperty];
        if (value !== undefined && value !== null) {
          (lead as any)[mapping.coldcopyField] = value;
        }
      }
    }

    return lead;
  }

  /**
   * Get HubSpot properties to fetch
   */
  private getHubSpotProperties(mappings: HubSpotFieldMapping[]): string[] {
    const properties = new Set<string>();
    
    for (const mapping of mappings) {
      if (mapping.direction === 'from_hubspot' || mapping.direction === 'bidirectional') {
        properties.add(mapping.hubspotProperty);
      }
    }

    // Always include these core properties
    properties.add('email');
    properties.add('hs_lastmodifieddate');
    properties.add('createdate');

    return Array.from(properties);
  }

  /**
   * Record sync status
   */
  private async recordSyncStatus(
    entityId: string,
    hubspotId: string,
    status: 'pending' | 'synced' | 'error',
    errorMessage?: string
  ): Promise<void> {
    const supabase = createServerClient(cookies());

    await supabase
      .from('hubspot_sync_status')
      .upsert({
        workspace_id: this.workspaceId,
        entity_type: 'contact',
        entity_id: entityId,
        hubspot_id: hubspotId,
        status,
        error_message: errorMessage,
        last_synced_at: new Date().toISOString(),
      });
  }
}