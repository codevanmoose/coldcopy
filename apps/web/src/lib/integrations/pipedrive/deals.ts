import { PipedriveClient } from './client';
import { PipedriveAuth } from './auth';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import {
  PipedriveDeal,
  PipedrivePipeline,
  PipedriveStage,
  PipedriveApiResponse,
  PipedriveStageMapping,
  PipelineAction,
  PipedriveSyncError,
  PipedriveValidationError,
} from './types';

interface CreateDealData {
  title: string;
  value?: number;
  currency?: string;
  person_id?: number;
  org_id?: number;
  stage_id?: number;
  pipeline_id?: number;
  status?: 'open' | 'won' | 'lost';
  probability?: number;
  expected_close_date?: string;
  visible_to?: string;
  owner_id?: number;
  custom_fields?: Record<string, any>;
}

interface UpdateDealData {
  title?: string;
  value?: number;
  currency?: string;
  person_id?: number;
  org_id?: number;
  stage_id?: number;
  status?: 'open' | 'won' | 'lost';
  probability?: number;
  expected_close_date?: string;
  visible_to?: string;
  owner_id?: number;
  custom_fields?: Record<string, any>;
  close_time?: string;
  won_time?: string;
  lost_time?: string;
  lost_reason?: string;
}

interface GetDealsParams {
  start?: number;
  limit?: number;
  filter_id?: number;
  stage_id?: number;
  status?: 'open' | 'won' | 'lost' | 'deleted' | 'all_not_deleted';
  user_id?: number;
  owned_by_you?: boolean;
  sort?: string;
}

interface DealSyncResult {
  success: boolean;
  dealId?: number;
  leadId?: string;
  action: 'created' | 'updated' | 'skipped' | 'stage_changed';
  previousStageId?: number;
  newStageId?: number;
  triggeredActions?: PipelineAction[];
  error?: string;
}

interface BulkDealSyncResult {
  totalProcessed: number;
  successful: number;
  failed: number;
  stageChanges: number;
  results: DealSyncResult[];
}

interface StageChangeEvent {
  dealId: number;
  previousStageId: number;
  newStageId: number;
  changedAt: Date;
  changedByUserId?: number;
  dealValue?: number;
  probability?: number;
}

export class PipedriveDealsService {
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
   * Get all deals from Pipedrive
   */
  async getDeals(params?: GetDealsParams): Promise<PipedriveApiResponse<PipedriveDeal[]>> {
    await this.initializeClient();

    const queryParams = new URLSearchParams();
    if (params?.start !== undefined) queryParams.append('start', params.start.toString());
    if (params?.limit !== undefined) queryParams.append('limit', params.limit.toString());
    if (params?.filter_id) queryParams.append('filter_id', params.filter_id.toString());
    if (params?.stage_id) queryParams.append('stage_id', params.stage_id.toString());
    if (params?.status) queryParams.append('status', params.status);
    if (params?.user_id) queryParams.append('user_id', params.user_id.toString());
    if (params?.owned_by_you) queryParams.append('owned_by_you', '1');
    if (params?.sort) queryParams.append('sort', params.sort);

    const endpoint = `/deals${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return this.client.get<PipedriveDeal[]>(endpoint, { workspaceId: this.workspaceId });
  }

  /**
   * Get a specific deal by ID
   */
  async getDeal(dealId: number): Promise<PipedriveApiResponse<PipedriveDeal>> {
    await this.initializeClient();
    return this.client.get<PipedriveDeal>(`/deals/${dealId}`, { workspaceId: this.workspaceId });
  }

  /**
   * Create a new deal in Pipedrive
   */
  async createDeal(dealData: CreateDealData): Promise<PipedriveApiResponse<PipedriveDeal>> {
    await this.initializeClient();

    // Validate required fields
    if (!dealData.title) {
      throw new PipedriveValidationError('Deal title is required');
    }

    return this.client.post<PipedriveDeal>('/deals', dealData, { workspaceId: this.workspaceId });
  }

  /**
   * Update an existing deal in Pipedrive
   */
  async updateDeal(dealId: number, updates: UpdateDealData): Promise<PipedriveApiResponse<PipedriveDeal>> {
    await this.initializeClient();
    return this.client.put<PipedriveDeal>(`/deals/${dealId}`, updates, { workspaceId: this.workspaceId });
  }

  /**
   * Delete a deal from Pipedrive
   */
  async deleteDeal(dealId: number): Promise<PipedriveApiResponse<{ id: number }>> {
    await this.initializeClient();
    return this.client.delete<{ id: number }>(`/deals/${dealId}`, { workspaceId: this.workspaceId });
  }

  /**
   * Move deal to a specific stage
   */
  async moveDealToStage(dealId: number, stageId: number): Promise<PipedriveApiResponse<PipedriveDeal>> {
    await this.initializeClient();
    
    // Get current deal to track stage change
    const currentDeal = await this.getDeal(dealId);
    if (!currentDeal.success) {
      throw new PipedriveSyncError('Failed to get current deal data');
    }

    const previousStageId = currentDeal.data.stage_id;
    
    // Update the deal stage
    const result = await this.updateDeal(dealId, { stage_id: stageId });
    
    if (result.success) {
      // Handle stage change event
      await this.handleStageChange({
        dealId,
        previousStageId,
        newStageId: stageId,
        changedAt: new Date(),
        dealValue: result.data.value,
        probability: result.data.probability,
      });
    }

    return result;
  }

  /**
   * Get all pipelines from Pipedrive
   */
  async getPipelines(): Promise<PipedriveApiResponse<PipedrivePipeline[]>> {
    await this.initializeClient();
    return this.client.get<PipedrivePipeline[]>('/pipelines', { workspaceId: this.workspaceId });
  }

  /**
   * Get all stages from Pipedrive
   */
  async getStages(pipelineId?: number): Promise<PipedriveApiResponse<PipedriveStage[]>> {
    await this.initializeClient();
    const endpoint = pipelineId ? `/stages?pipeline_id=${pipelineId}` : '/stages';
    return this.client.get<PipedriveStage[]>(endpoint, { workspaceId: this.workspaceId });
  }

  /**
   * Search for deals in Pipedrive
   */
  async searchDeals(term: string, params?: { 
    fields?: string; 
    exact?: boolean; 
    person_id?: number;
    organization_id?: number;
    limit?: number;
    start?: number;
  }): Promise<any> {
    await this.initializeClient();

    return this.client.search({
      term,
      fields: params?.fields || 'title,person_name,org_name',
      exact: params?.exact,
      person_id: params?.person_id,
      organization_id: params?.organization_id,
      limit: params?.limit || 50,
      start: params?.start || 0,
    }, { workspaceId: this.workspaceId });
  }

  /**
   * Create deal from ColdCopy lead
   */
  async createDealFromLead(lead: any, stageId?: number): Promise<DealSyncResult> {
    try {
      const supabase = createServerClient(cookies());

      // Get default stage if not provided
      if (!stageId) {
        const config = await this.getDefaultDealConfig();
        stageId = config.defaultStageId;
      }

      // Check if person exists for this lead
      const { data: personSync } = await supabase
        .from('pipedrive_sync_status')
        .select('pipedrive_id')
        .eq('workspace_id', this.workspaceId)
        .eq('entity_type', 'person')
        .eq('entity_id', lead.id)
        .single();

      const dealData: CreateDealData = {
        title: `Deal for ${lead.first_name} ${lead.last_name}` || `Deal for ${lead.email}`,
        person_id: personSync?.pipedrive_id,
        stage_id: stageId,
        value: lead.estimated_value || 0,
        currency: 'USD', // Default currency
      };

      // Add organization if available
      if (lead.company) {
        // Try to find organization by company name
        const orgSearch = await this.client.search({
          term: lead.company,
          fields: 'name',
          exact: true,
        }, { workspaceId: this.workspaceId });

        if (orgSearch.success && orgSearch.data?.items?.length > 0) {
          dealData.org_id = orgSearch.data.items[0].item.id;
        }
      }

      const response = await this.createDeal(dealData);

      if (response.success) {
        // Create sync status record
        await supabase
          .from('pipedrive_sync_status')
          .insert({
            workspace_id: this.workspaceId,
            entity_type: 'deal',
            entity_id: lead.id,
            pipedrive_id: response.data.id,
            last_synced_at: new Date().toISOString(),
            status: 'synced',
          });

        // Log activity
        await supabase
          .from('pipedrive_activity_log')
          .insert({
            workspace_id: this.workspaceId,
            lead_id: lead.id,
            pipedrive_deal_id: response.data.id,
            activity_type: 'deal_created',
            activity_data: {
              title: dealData.title,
              value: dealData.value,
              stage_id: stageId,
            },
          });

        return {
          success: true,
          dealId: response.data.id,
          leadId: lead.id,
          action: 'created',
        };
      }

      return {
        success: false,
        leadId: lead.id,
        action: 'skipped',
        error: 'Failed to create deal',
      };
    } catch (error) {
      console.error('Error creating deal from lead:', error);
      return {
        success: false,
        leadId: lead.id,
        action: 'skipped',
        error: (error as Error).message,
      };
    }
  }

  /**
   * Handle stage change events and trigger actions
   */
  async handleStageChange(event: StageChangeEvent): Promise<void> {
    const supabase = createServerClient(cookies());

    try {
      // Record stage change in history
      await supabase
        .from('pipedrive_stage_history')
        .insert({
          workspace_id: this.workspaceId,
          deal_id: event.dealId,
          stage_id: event.newStageId,
          previous_stage_id: event.previousStageId,
          changed_at: event.changedAt.toISOString(),
          changed_by_user_id: event.changedByUserId,
          deal_value: event.dealValue,
          probability: event.probability,
        });

      // Get stage mappings for this stage
      const { data: stageMapping } = await supabase
        .from('pipedrive_stage_mappings')
        .select('*')
        .eq('workspace_id', this.workspaceId)
        .eq('pipedrive_stage_id', event.newStageId)
        .single();

      if (stageMapping && stageMapping.trigger_actions) {
        const actions = Array.isArray(stageMapping.trigger_actions) 
          ? stageMapping.trigger_actions 
          : [];

        // Execute triggered actions
        for (const action of actions) {
          await this.executeStageAction(action, event.dealId, stageMapping);
        }
      }
    } catch (error) {
      console.error('Error handling stage change:', error);
    }
  }

  /**
   * Execute pipeline action based on stage change
   */
  private async executeStageAction(
    action: PipelineAction,
    dealId: number,
    stageMapping: any
  ): Promise<void> {
    const supabase = createServerClient(cookies());

    try {
      switch (action) {
        case PipelineAction.START_CAMPAIGN:
          await this.startCampaignForDeal(dealId);
          break;
        
        case PipelineAction.STOP_CAMPAIGN:
          await this.stopCampaignForDeal(dealId);
          break;
        
        case PipelineAction.SEND_NOTIFICATION:
          await this.sendNotificationForDeal(dealId, stageMapping);
          break;
        
        case PipelineAction.UPDATE_LEAD_SCORE:
          await this.updateLeadScoreFromDeal(dealId, stageMapping.probability);
          break;
        
        case PipelineAction.ASSIGN_OWNER:
          await this.assignOwnerFromDeal(dealId);
          break;
      }

      // Log action execution
      await supabase
        .from('pipedrive_activity_log')
        .insert({
          workspace_id: this.workspaceId,
          pipedrive_deal_id: dealId,
          activity_type: 'pipeline_action',
          activity_data: {
            action,
            stage_mapping_id: stageMapping.id,
            executed_at: new Date().toISOString(),
          },
        });
    } catch (error) {
      console.error(`Error executing action ${action}:`, error);
    }
  }

  /**
   * Start campaign for deal
   */
  private async startCampaignForDeal(dealId: number): Promise<void> {
    // Implementation would depend on your campaign system
    // This is a placeholder for the actual campaign logic
    console.log(`Starting campaign for deal ${dealId}`);
  }

  /**
   * Stop campaign for deal
   */
  private async stopCampaignForDeal(dealId: number): Promise<void> {
    // Implementation would depend on your campaign system
    console.log(`Stopping campaign for deal ${dealId}`);
  }

  /**
   * Send notification for deal
   */
  private async sendNotificationForDeal(dealId: number, stageMapping: any): Promise<void> {
    // Implementation would depend on your notification system
    console.log(`Sending notification for deal ${dealId} in stage ${stageMapping.pipedrive_stage_id}`);
  }

  /**
   * Update lead score based on deal probability
   */
  private async updateLeadScoreFromDeal(dealId: number, probability: number): Promise<void> {
    const supabase = createServerClient(cookies());

    // Get the lead associated with this deal
    const { data: syncStatus } = await supabase
      .from('pipedrive_sync_status')
      .select('entity_id')
      .eq('workspace_id', this.workspaceId)
      .eq('entity_type', 'deal')
      .eq('pipedrive_id', dealId)
      .single();

    if (syncStatus?.entity_id) {
      // Update lead score based on probability
      const newScore = Math.round(probability * 100); // Convert to 0-100 scale
      
      await supabase
        .from('leads')
        .update({ score: newScore })
        .eq('id', syncStatus.entity_id)
        .eq('workspace_id', this.workspaceId);
    }
  }

  /**
   * Assign owner based on deal owner
   */
  private async assignOwnerFromDeal(dealId: number): Promise<void> {
    // Implementation would depend on your user/owner assignment system
    console.log(`Assigning owner for deal ${dealId}`);
  }

  /**
   * Get default deal configuration
   */
  private async getDefaultDealConfig(): Promise<{ defaultPipelineId?: number; defaultStageId?: number }> {
    // Get first pipeline and its first stage as defaults
    const pipelines = await this.getPipelines();
    if (pipelines.success && pipelines.data.length > 0) {
      const firstPipeline = pipelines.data[0];
      const stages = await this.getStages(firstPipeline.id);
      
      if (stages.success && stages.data.length > 0) {
        return {
          defaultPipelineId: firstPipeline.id,
          defaultStageId: stages.data[0].id,
        };
      }
    }
    
    return {};
  }

  /**
   * Get stage mappings for workspace
   */
  async getStageMappings(): Promise<PipedriveStageMapping[]> {
    const supabase = createServerClient(cookies());
    
    const { data, error } = await supabase
      .from('pipedrive_stage_mappings')
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .order('pipedrive_stage_id');

    if (error) {
      throw new PipedriveSyncError('Failed to get stage mappings: ' + error.message);
    }

    return data || [];
  }

  /**
   * Create or update stage mapping
   */
  async upsertStageMapping(mapping: Omit<PipedriveStageMapping, 'workspaceId'>): Promise<void> {
    const supabase = createServerClient(cookies());

    const { error } = await supabase
      .from('pipedrive_stage_mappings')
      .upsert({
        workspace_id: this.workspaceId,
        pipedrive_stage_id: mapping.pipedriveStageId,
        coldcopy_status: mapping.coldcopyStatus,
        trigger_actions: mapping.triggerActions,
        probability: mapping.probability,
      });

    if (error) {
      throw new PipedriveSyncError('Failed to save stage mapping: ' + error.message);
    }
  }

  /**
   * Get deal sync status
   */
  async getDealSyncStatus(): Promise<any[]> {
    const supabase = createServerClient(cookies());
    
    const { data, error } = await supabase
      .from('pipedrive_sync_status')
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .eq('entity_type', 'deal')
      .order('last_synced_at', { ascending: false });

    if (error) {
      throw new PipedriveSyncError('Failed to get deal sync status: ' + error.message);
    }

    return data || [];
  }

  /**
   * Get stage change history for analytics
   */
  async getStageHistory(dealId?: number, limit: number = 100): Promise<any[]> {
    const supabase = createServerClient(cookies());
    
    let query = supabase
      .from('pipedrive_stage_history')
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .order('changed_at', { ascending: false })
      .limit(limit);

    if (dealId) {
      query = query.eq('deal_id', dealId);
    }

    const { data, error } = await query;

    if (error) {
      throw new PipedriveSyncError('Failed to get stage history: ' + error.message);
    }

    return data || [];
  }
}