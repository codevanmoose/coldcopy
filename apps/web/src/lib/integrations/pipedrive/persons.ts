import { PipedriveClient } from './client';
import { PipedriveAuth } from './auth';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import {
  PipedrivePerson,
  PipedriveApiResponse,
  PipedrivePersonMapping,
  PipedriveFieldMapping,
  PipedriveSyncError,
  PipedriveValidationError,
  ConflictResolution,
} from './types';

interface CreatePersonData {
  name: string;
  email?: string[];
  phone?: string[];
  org_id?: number;
  owner_id?: number;
  visible_to?: string;
  custom_fields?: Record<string, any>;
}

interface UpdatePersonData {
  name?: string;
  email?: string[];
  phone?: string[];
  org_id?: number;
  owner_id?: number;
  visible_to?: string;
  custom_fields?: Record<string, any>;
}

interface GetPersonsParams {
  start?: number;
  limit?: number;
  filter_id?: number;
  sort?: string;
  user_id?: number;
  search?: string;
}

interface PersonSyncResult {
  success: boolean;
  personId?: number;
  leadId?: string;
  action: 'created' | 'updated' | 'skipped' | 'conflict';
  conflictId?: string;
  error?: string;
}

interface BulkSyncResult {
  totalProcessed: number;
  successful: number;
  failed: number;
  conflicts: number;
  results: PersonSyncResult[];
}

export class PipedrivePersonsService {
  private client: PipedriveClient;
  private auth: PipedriveAuth;
  private workspaceId: string;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
    this.auth = new PipedriveAuth();
  }

  /**
   * Initialize the client with valid access token
   */
  private async initializeClient(): Promise<void> {
    if (!this.client) {
      const accessToken = await this.auth.getValidAccessToken(this.workspaceId);
      const integration = await this.auth.getIntegration(this.workspaceId);
      this.client = new PipedriveClient(accessToken, integration?.companyDomain);
    }
  }

  /**
   * Get all persons from Pipedrive
   */
  async getPersons(params?: GetPersonsParams): Promise<PipedriveApiResponse<PipedrivePerson[]>> {
    await this.initializeClient();

    const queryParams = new URLSearchParams();
    if (params?.start !== undefined) queryParams.append('start', params.start.toString());
    if (params?.limit !== undefined) queryParams.append('limit', params.limit.toString());
    if (params?.filter_id) queryParams.append('filter_id', params.filter_id.toString());
    if (params?.sort) queryParams.append('sort', params.sort);
    if (params?.user_id) queryParams.append('user_id', params.user_id.toString());

    const endpoint = `/persons${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return this.client.get<PipedrivePerson[]>(endpoint, { workspaceId: this.workspaceId });
  }

  /**
   * Get a specific person by ID
   */
  async getPerson(personId: number): Promise<PipedriveApiResponse<PipedrivePerson>> {
    await this.initializeClient();
    return this.client.get<PipedrivePerson>(`/persons/${personId}`, { workspaceId: this.workspaceId });
  }

  /**
   * Create a new person in Pipedrive
   */
  async createPerson(personData: CreatePersonData): Promise<PipedriveApiResponse<PipedrivePerson>> {
    await this.initializeClient();

    // Validate required fields
    if (!personData.name) {
      throw new PipedriveValidationError('Person name is required');
    }

    return this.client.post<PipedrivePerson>('/persons', personData, { workspaceId: this.workspaceId });
  }

  /**
   * Update an existing person in Pipedrive
   */
  async updatePerson(personId: number, updates: UpdatePersonData): Promise<PipedriveApiResponse<PipedrivePerson>> {
    await this.initializeClient();
    return this.client.put<PipedrivePerson>(`/persons/${personId}`, updates, { workspaceId: this.workspaceId });
  }

  /**
   * Delete a person from Pipedrive
   */
  async deletePerson(personId: number): Promise<PipedriveApiResponse<{ id: number }>> {
    await this.initializeClient();
    return this.client.delete<{ id: number }>(`/persons/${personId}`, { workspaceId: this.workspaceId });
  }

  /**
   * Search for persons in Pipedrive
   */
  async searchPersons(term: string, params?: { 
    fields?: string; 
    exact?: boolean; 
    organization_id?: number;
    limit?: number;
    start?: number;
  }): Promise<any> {
    await this.initializeClient();

    return this.client.search({
      term,
      fields: params?.fields || 'name,email,phone',
      exact: params?.exact,
      organization_id: params?.organization_id,
      limit: params?.limit || 50,
      start: params?.start || 0,
    }, { workspaceId: this.workspaceId });
  }

  /**
   * Get field mappings for person sync
   */
  private async getFieldMappings(): Promise<PipedriveFieldMapping[]> {
    const supabase = createServerClient(cookies());
    
    const { data, error } = await supabase
      .from('pipedrive_field_mappings')
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .in('source_system', ['coldcopy', 'pipedrive'])
      .in('target_system', ['coldcopy', 'pipedrive']);

    if (error) {
      throw new PipedriveSyncError('Failed to get field mappings: ' + error.message);
    }

    return data || [];
  }

  /**
   * Transform ColdCopy lead data to Pipedrive person format
   */
  private async transformLeadToPerson(lead: any, mappings: PipedriveFieldMapping[]): Promise<CreatePersonData> {
    const personData: CreatePersonData = {
      name: lead.first_name && lead.last_name 
        ? `${lead.first_name} ${lead.last_name}` 
        : lead.email || lead.name || 'Unknown',
    };

    // Set basic fields
    if (lead.email) {
      personData.email = [lead.email];
    }
    if (lead.phone) {
      personData.phone = [lead.phone];
    }

    // Apply field mappings
    const customFields: Record<string, any> = {};
    
    for (const mapping of mappings) {
      if (mapping.sourceSystem === 'coldcopy' && mapping.targetSystem === 'pipedrive') {
        const sourceValue = lead[mapping.sourceField];
        if (sourceValue !== undefined && sourceValue !== null) {
          let targetValue = sourceValue;

          // Apply transformation if specified
          if (mapping.transformation) {
            targetValue = await this.applyTransformation(sourceValue, mapping.transformation);
          }

          // Handle standard fields vs custom fields
          if (['name', 'email', 'phone', 'org_id', 'owner_id', 'visible_to'].includes(mapping.targetField)) {
            (personData as any)[mapping.targetField] = targetValue;
          } else {
            customFields[mapping.targetField] = targetValue;
          }
        }
      }
    }

    if (Object.keys(customFields).length > 0) {
      personData.custom_fields = customFields;
    }

    return personData;
  }

  /**
   * Transform Pipedrive person data to ColdCopy lead format
   */
  private async transformPersonToLead(person: PipedrivePerson, mappings: PipedriveFieldMapping[]): Promise<any> {
    const leadData: any = {
      first_name: person.first_name,
      last_name: person.last_name,
      email: person.email?.[0],
      phone: person.phone?.[0],
    };

    // Apply field mappings
    for (const mapping of mappings) {
      if (mapping.sourceSystem === 'pipedrive' && mapping.targetSystem === 'coldcopy') {
        let sourceValue: any;

        // Get value from person data
        if (['name', 'first_name', 'last_name', 'email', 'phone', 'org_id', 'owner_id'].includes(mapping.sourceField)) {
          sourceValue = (person as any)[mapping.sourceField];
        } else if (person.custom_fields) {
          sourceValue = person.custom_fields[mapping.sourceField];
        }

        if (sourceValue !== undefined && sourceValue !== null) {
          let targetValue = sourceValue;

          // Apply transformation if specified
          if (mapping.transformation) {
            targetValue = await this.applyTransformation(sourceValue, mapping.transformation);
          }

          leadData[mapping.targetField] = targetValue;
        }
      }
    }

    return leadData;
  }

  /**
   * Apply field transformation
   */
  private async applyTransformation(value: any, transformation: any): Promise<any> {
    // This is a simplified transformation implementation
    // In a real system, you would have more sophisticated transformation logic
    switch (transformation.type) {
      case 'format':
        if (transformation.config.format === 'uppercase') {
          return value.toString().toUpperCase();
        } else if (transformation.config.format === 'lowercase') {
          return value.toString().toLowerCase();
        }
        break;
      case 'lookup':
        // Implement lookup logic based on transformation.config
        break;
      case 'calculation':
        // Implement calculation logic based on transformation.config
        break;
      case 'conditional':
        // Implement conditional logic based on transformation.config
        break;
    }
    return value;
  }

  /**
   * Sync a ColdCopy lead to Pipedrive as a person
   */
  async syncLeadToPerson(lead: any): Promise<PersonSyncResult> {
    try {
      const supabase = createServerClient(cookies());
      const mappings = await this.getFieldMappings();

      // Check if person already exists
      const { data: syncStatus } = await supabase
        .from('pipedrive_sync_status')
        .select('*')
        .eq('workspace_id', this.workspaceId)
        .eq('entity_type', 'person')
        .eq('entity_id', lead.id)
        .single();

      const personData = await this.transformLeadToPerson(lead, mappings);

      if (syncStatus?.pipedrive_id) {
        // Update existing person
        const response = await this.updatePerson(syncStatus.pipedrive_id, personData);
        
        if (response.success) {
          // Update sync status
          await supabase
            .from('pipedrive_sync_status')
            .update({
              last_synced_at: new Date().toISOString(),
              status: 'synced',
              error_message: null,
            })
            .eq('id', syncStatus.id);

          return {
            success: true,
            personId: response.data.id,
            leadId: lead.id,
            action: 'updated',
          };
        }
      } else {
        // Create new person
        const response = await this.createPerson(personData);
        
        if (response.success) {
          // Create sync status record
          await supabase
            .from('pipedrive_sync_status')
            .insert({
              workspace_id: this.workspaceId,
              entity_type: 'person',
              entity_id: lead.id,
              pipedrive_id: response.data.id,
              last_synced_at: new Date().toISOString(),
              status: 'synced',
            });

          return {
            success: true,
            personId: response.data.id,
            leadId: lead.id,
            action: 'created',
          };
        }
      }

      return {
        success: false,
        leadId: lead.id,
        action: 'skipped',
        error: 'API request failed',
      };
    } catch (error) {
      console.error('Error syncing lead to person:', error);
      return {
        success: false,
        leadId: lead.id,
        action: 'skipped',
        error: (error as Error).message,
      };
    }
  }

  /**
   * Sync a Pipedrive person to ColdCopy as a lead
   */
  async syncPersonToLead(person: PipedrivePerson): Promise<PersonSyncResult> {
    try {
      const supabase = createServerClient(cookies());
      const mappings = await this.getFieldMappings();

      // Check if lead already exists
      const { data: syncStatus } = await supabase
        .from('pipedrive_sync_status')
        .select('*')
        .eq('workspace_id', this.workspaceId)
        .eq('entity_type', 'person')
        .eq('pipedrive_id', person.id)
        .single();

      const leadData = await this.transformPersonToLead(person, mappings);

      if (syncStatus?.entity_id) {
        // Update existing lead
        const { error } = await supabase
          .from('leads')
          .update(leadData)
          .eq('id', syncStatus.entity_id)
          .eq('workspace_id', this.workspaceId);

        if (!error) {
          // Update sync status
          await supabase
            .from('pipedrive_sync_status')
            .update({
              last_synced_at: new Date().toISOString(),
              status: 'synced',
              error_message: null,
            })
            .eq('id', syncStatus.id);

          return {
            success: true,
            personId: person.id,
            leadId: syncStatus.entity_id,
            action: 'updated',
          };
        }
      } else {
        // Create new lead
        const { data: newLead, error } = await supabase
          .from('leads')
          .insert({
            ...leadData,
            workspace_id: this.workspaceId,
          })
          .select()
          .single();

        if (!error && newLead) {
          // Create sync status record
          await supabase
            .from('pipedrive_sync_status')
            .insert({
              workspace_id: this.workspaceId,
              entity_type: 'person',
              entity_id: newLead.id,
              pipedrive_id: person.id,
              last_synced_at: new Date().toISOString(),
              status: 'synced',
            });

          return {
            success: true,
            personId: person.id,
            leadId: newLead.id,
            action: 'created',
          };
        }
      }

      return {
        success: false,
        personId: person.id,
        action: 'skipped',
        error: 'Database operation failed',
      };
    } catch (error) {
      console.error('Error syncing person to lead:', error);
      return {
        success: false,
        personId: person.id,
        action: 'skipped',
        error: (error as Error).message,
      };
    }
  }

  /**
   * Bulk sync leads to Pipedrive persons
   */
  async bulkSyncLeadsToPersons(leads: any[]): Promise<BulkSyncResult> {
    const results: PersonSyncResult[] = [];
    let successful = 0;
    let failed = 0;
    let conflicts = 0;

    for (const lead of leads) {
      const result = await this.syncLeadToPerson(lead);
      results.push(result);

      if (result.success) {
        successful++;
      } else if (result.action === 'conflict') {
        conflicts++;
      } else {
        failed++;
      }

      // Add delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return {
      totalProcessed: leads.length,
      successful,
      failed,
      conflicts,
      results,
    };
  }

  /**
   * Bulk sync persons from Pipedrive to leads
   */
  async bulkSyncPersonsToLeads(persons: PipedrivePerson[]): Promise<BulkSyncResult> {
    const results: PersonSyncResult[] = [];
    let successful = 0;
    let failed = 0;
    let conflicts = 0;

    for (const person of persons) {
      const result = await this.syncPersonToLead(person);
      results.push(result);

      if (result.success) {
        successful++;
      } else if (result.action === 'conflict') {
        conflicts++;
      } else {
        failed++;
      }

      // Add delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return {
      totalProcessed: persons.length,
      successful,
      failed,
      conflicts,
      results,
    };
  }

  /**
   * Get sync status for all persons
   */
  async getSyncStatus(): Promise<any[]> {
    const supabase = createServerClient(cookies());
    
    const { data, error } = await supabase
      .from('pipedrive_sync_status')
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .eq('entity_type', 'person')
      .order('last_synced_at', { ascending: false });

    if (error) {
      throw new PipedriveSyncError('Failed to get sync status: ' + error.message);
    }

    return data || [];
  }

  /**
   * Get person mapping information
   */
  async getPersonMapping(personId: number): Promise<PipedrivePersonMapping | null> {
    const supabase = createServerClient(cookies());
    
    const { data, error } = await supabase
      .from('pipedrive_sync_status')
      .select(`
        *,
        leads:entity_id (
          id,
          email,
          first_name,
          last_name,
          company,
          enrichment_data
        )
      `)
      .eq('workspace_id', this.workspaceId)
      .eq('entity_type', 'person')
      .eq('pipedrive_id', personId)
      .single();

    if (error || !data) {
      return null;
    }

    const lead = Array.isArray(data.leads) ? data.leads[0] : data.leads;

    return {
      pipedrivePersonId: personId,
      coldcopyLeadId: data.entity_id,
      emailPrimary: lead?.email || '',
      phonePrimary: lead?.phone,
      organizationName: lead?.company,
      jobTitle: lead?.job_title,
      enrichmentData: lead?.enrichment_data,
      syncStatus: data.status,
      lastSync: data.last_synced_at,
    };
  }
}