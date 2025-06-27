import { PipedriveDealManager } from './deal-manager';
import { PipelineAutomationEngine } from './pipeline-automation';
import { PipedriveClient } from './client';
import { PipedriveAuth } from './auth';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import {
  PipedriveDeal,
  PipedriveActivity,
  PipedriveSyncError,
  PipedriveValidationError,
} from './types';

interface CampaignTrigger {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  triggerType: 'stage_change' | 'deal_created' | 'deal_won' | 'deal_lost' | 'activity_completed' | 'time_based';
  conditions: CampaignCondition[];
  campaignActions: CampaignAction[];
  schedule?: CampaignSchedule;
}

interface CampaignCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'in_range';
  value: any;
  valueType: 'static' | 'dynamic' | 'field_reference';
}

interface CampaignAction {
  type: 'start_sequence' | 'stop_sequence' | 'add_to_campaign' | 'remove_from_campaign' | 'update_lead_status' | 'tag_lead' | 'create_task';
  campaignId?: string;
  sequenceId?: string;
  config: Record<string, any>;
  delay?: number; // Minutes
}

interface CampaignSchedule {
  type: 'immediate' | 'delayed' | 'scheduled';
  delayMinutes?: number;
  scheduledAt?: Date;
  timezone?: string;
}

interface DealCampaignSync {
  dealId: number;
  leadId: string;
  activeCampaigns: string[];
  activeSequences: string[];
  lastSyncedAt: Date;
  syncStatus: 'active' | 'paused' | 'completed' | 'error';
  metadata: Record<string, any>;
}

interface CampaignPerformance {
  campaignId: string;
  campaignName: string;
  dealsGenerated: number;
  totalDealValue: number;
  averageDealSize: number;
  conversionRate: number;
  roi: number;
  leadsToDealConversion: number;
  averageTimeToConvert: number;
  stageBreakdown: Record<string, number>;
  revenueAttribution: RevenueAttribution[];
}

interface RevenueAttribution {
  dealId: number;
  dealValue: number;
  dealStatus: 'open' | 'won' | 'lost';
  attributionPercentage: number;
  firstTouch: boolean;
  lastTouch: boolean;
  touchPoints: TouchPoint[];
}

interface TouchPoint {
  campaignId: string;
  touchDate: Date;
  touchType: 'email' | 'call' | 'meeting' | 'demo';
  engagement: 'high' | 'medium' | 'low';
  dealStageAtTouch: number;
}

interface CampaignOptimization {
  campaignId: string;
  recommendations: OptimizationRecommendation[];
  aTestSuggestions: ATestSuggestion[];
  segmentationOpportunities: SegmentationOpportunity[];
  contentOptimizations: ContentOptimization[];
}

interface OptimizationRecommendation {
  type: 'timing' | 'content' | 'segmentation' | 'sequence' | 'targeting';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  expectedImpact: string;
  implementation: string;
  effort: 'low' | 'medium' | 'high';
}

interface ATestSuggestion {
  element: 'subject_line' | 'email_content' | 'send_time' | 'call_to_action' | 'sender_name';
  hypothesis: string;
  testVariations: string[];
  successMetric: string;
  expectedLift: string;
  duration: string;
}

interface SegmentationOpportunity {
  segment: string;
  criteria: Record<string, any>;
  expectedImprovement: string;
  currentPerformance: number;
  projectedPerformance: number;
}

interface ContentOptimization {
  contentType: 'email_template' | 'subject_line' | 'call_script' | 'landing_page';
  currentPerformance: number;
  suggestions: string[];
  benchmarkData: Record<string, number>;
}

export class PipedriveCampaignIntegration {
  private dealManager: PipedriveDealManager;
  private automationEngine: PipelineAutomationEngine;
  private client: PipedriveClient;
  private auth: PipedriveAuth;
  private workspaceId: string;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
    this.auth = new PipedriveAuth();
    this.dealManager = new PipedriveDealManager(workspaceId);
    this.automationEngine = new PipelineAutomationEngine(workspaceId);
  }

  private async initializeClient(): Promise<void> {
    if (!this.client) {
      const accessToken = await this.auth.getValidAccessToken(this.workspaceId);
      const integration = await this.auth.getIntegration(this.workspaceId);
      this.client = new PipedriveClient(accessToken, integration?.companyDomain);
    }
  }

  /**
   * Create campaign trigger based on Pipedrive events
   */
  async createCampaignTrigger(trigger: Omit<CampaignTrigger, 'id'>): Promise<CampaignTrigger> {
    const supabase = createServerClient(cookies());

    const triggerId = `trigger_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullTrigger: CampaignTrigger = {
      id: triggerId,
      ...trigger,
    };

    // Validate trigger
    await this.validateCampaignTrigger(fullTrigger);

    // Store trigger in database
    const { error } = await supabase
      .from('pipedrive_campaign_triggers')
      .insert({
        id: triggerId,
        workspace_id: this.workspaceId,
        name: trigger.name,
        description: trigger.description,
        enabled: trigger.enabled,
        trigger_type: trigger.triggerType,
        conditions: trigger.conditions,
        campaign_actions: trigger.campaignActions,
        schedule: trigger.schedule,
        created_at: new Date().toISOString(),
      });

    if (error) {
      throw new PipedriveSyncError(`Failed to create campaign trigger: ${error.message}`);
    }

    return fullTrigger;
  }

  /**
   * Process deal event and trigger campaign actions
   */
  async processDealCampaignEvent(
    dealId: number,
    eventType: 'deal_created' | 'deal_updated' | 'stage_changed' | 'deal_won' | 'deal_lost' | 'activity_completed',
    eventData: Record<string, any> = {}
  ): Promise<void> {
    const supabase = createServerClient(cookies());

    try {
      // Get active campaign triggers for this event type
      const { data: triggers } = await supabase
        .from('pipedrive_campaign_triggers')
        .select('*')
        .eq('workspace_id', this.workspaceId)
        .eq('trigger_type', eventType)
        .eq('enabled', true);

      if (!triggers || triggers.length === 0) return;

      // Get deal data
      const dealResponse = await this.dealManager.getDeal(dealId);
      if (!dealResponse.success) return;

      const deal = dealResponse.data;

      // Get associated lead
      const { data: syncStatus } = await supabase
        .from('pipedrive_sync_status')
        .select('entity_id')
        .eq('workspace_id', this.workspaceId)
        .eq('entity_type', 'deal')
        .eq('pipedrive_id', dealId)
        .single();

      if (!syncStatus?.entity_id) return;

      const leadId = syncStatus.entity_id;

      // Process each trigger
      for (const trigger of triggers) {
        // Check trigger conditions
        if (trigger.conditions && trigger.conditions.length > 0) {
          const conditionsMet = this.evaluateCampaignConditions(trigger.conditions, deal, eventData);
          if (!conditionsMet) continue;
        }

        // Execute campaign actions
        await this.executeCampaignActions(trigger.campaign_actions, dealId, leadId, trigger);
      }
    } catch (error) {
      console.error('Error processing deal campaign event:', error);
      
      // Log error
      await supabase
        .from('pipedrive_campaign_logs')
        .insert({
          workspace_id: this.workspaceId,
          deal_id: dealId,
          event_type: eventType,
          status: 'error',
          error_message: (error as Error).message,
          created_at: new Date().toISOString(),
        });
    }
  }

  /**
   * Execute campaign actions
   */
  private async executeCampaignActions(
    actions: CampaignAction[],
    dealId: number,
    leadId: string,
    trigger: any
  ): Promise<void> {
    const supabase = createServerClient(cookies());

    for (const action of actions) {
      try {
        // Apply delay if specified
        if (action.delay && action.delay > 0) {
          await new Promise(resolve => setTimeout(resolve, action.delay * 60 * 1000));
        }

        let result: any;
        switch (action.type) {
          case 'start_sequence':
            result = await this.startEmailSequence(leadId, action.sequenceId!, action.config);
            break;
          
          case 'stop_sequence':
            result = await this.stopEmailSequence(leadId, action.sequenceId, action.config);
            break;
          
          case 'add_to_campaign':
            result = await this.addToCampaign(leadId, action.campaignId!, action.config);
            break;
          
          case 'remove_from_campaign':
            result = await this.removeFromCampaign(leadId, action.campaignId!, action.config);
            break;
          
          case 'update_lead_status':
            result = await this.updateLeadStatus(leadId, action.config);
            break;
          
          case 'tag_lead':
            result = await this.tagLead(leadId, action.config);
            break;
          
          case 'create_task':
            result = await this.createTask(dealId, action.config);
            break;
        }

        // Log successful action
        await supabase
          .from('pipedrive_campaign_action_logs')
          .insert({
            workspace_id: this.workspaceId,
            trigger_id: trigger.id,
            deal_id: dealId,
            lead_id: leadId,
            action_type: action.type,
            action_config: action.config,
            result,
            status: 'completed',
            executed_at: new Date().toISOString(),
          });

      } catch (error) {
        console.error(`Failed to execute campaign action ${action.type}:`, error);
        
        // Log failed action
        await supabase
          .from('pipedrive_campaign_action_logs')
          .insert({
            workspace_id: this.workspaceId,
            trigger_id: trigger.id,
            deal_id: dealId,
            lead_id: leadId,
            action_type: action.type,
            action_config: action.config,
            status: 'failed',
            error_message: (error as Error).message,
            executed_at: new Date().toISOString(),
          });
      }
    }
  }

  /**
   * Start email sequence for lead
   */
  private async startEmailSequence(leadId: string, sequenceId: string, config: Record<string, any>): Promise<any> {
    const supabase = createServerClient(cookies());

    // Check if lead is already in this sequence
    const { data: existingSequence } = await supabase
      .from('sequence_leads')
      .select('*')
      .eq('sequence_id', sequenceId)
      .eq('lead_id', leadId)
      .eq('workspace_id', this.workspaceId)
      .eq('status', 'active')
      .single();

    if (existingSequence) {
      return { status: 'already_active', sequenceId, leadId };
    }

    // Add lead to sequence
    const { error } = await supabase
      .from('sequence_leads')
      .insert({
        sequence_id: sequenceId,
        lead_id: leadId,
        workspace_id: this.workspaceId,
        status: 'active',
        current_step: 1,
        started_at: new Date().toISOString(),
        added_by_automation: true,
        automation_source: 'pipedrive_trigger',
      });

    if (error) {
      throw new Error(`Failed to add lead to sequence: ${error.message}`);
    }

    return { status: 'started', sequenceId, leadId };
  }

  /**
   * Stop email sequence for lead
   */
  private async stopEmailSequence(leadId: string, sequenceId?: string, config: Record<string, any> = {}): Promise<any> {
    const supabase = createServerClient(cookies());

    let query = supabase
      .from('sequence_leads')
      .update({ 
        status: 'paused', 
        paused_at: new Date().toISOString(),
        pause_reason: config.reason || 'pipedrive_automation'
      })
      .eq('lead_id', leadId)
      .eq('workspace_id', this.workspaceId)
      .eq('status', 'active');

    if (sequenceId) {
      query = query.eq('sequence_id', sequenceId);
    }

    const { error } = await query;

    if (error) {
      throw new Error(`Failed to stop sequence: ${error.message}`);
    }

    return { status: 'stopped', sequenceId, leadId };
  }

  /**
   * Add lead to campaign
   */
  private async addToCampaign(leadId: string, campaignId: string, config: Record<string, any>): Promise<any> {
    const supabase = createServerClient(cookies());

    // Check if lead is already in campaign
    const { data: existingCampaign } = await supabase
      .from('campaign_leads')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('lead_id', leadId)
      .eq('workspace_id', this.workspaceId)
      .single();

    if (existingCampaign && existingCampaign.status === 'active') {
      return { status: 'already_active', campaignId, leadId };
    }

    // Add or reactivate lead in campaign
    const { error } = await supabase
      .from('campaign_leads')
      .upsert({
        campaign_id: campaignId,
        lead_id: leadId,
        workspace_id: this.workspaceId,
        status: 'active',
        added_at: new Date().toISOString(),
        added_by_automation: true,
        automation_source: 'pipedrive_trigger',
      });

    if (error) {
      throw new Error(`Failed to add lead to campaign: ${error.message}`);
    }

    return { status: 'added', campaignId, leadId };
  }

  /**
   * Remove lead from campaign
   */
  private async removeFromCampaign(leadId: string, campaignId: string, config: Record<string, any>): Promise<any> {
    const supabase = createServerClient(cookies());

    const { error } = await supabase
      .from('campaign_leads')
      .update({ 
        status: 'paused', 
        paused_at: new Date().toISOString(),
        pause_reason: config.reason || 'pipedrive_automation'
      })
      .eq('campaign_id', campaignId)
      .eq('lead_id', leadId)
      .eq('workspace_id', this.workspaceId)
      .eq('status', 'active');

    if (error) {
      throw new Error(`Failed to remove lead from campaign: ${error.message}`);
    }

    return { status: 'removed', campaignId, leadId };
  }

  /**
   * Update lead status
   */
  private async updateLeadStatus(leadId: string, config: Record<string, any>): Promise<any> {
    const supabase = createServerClient(cookies());

    const updates: Record<string, any> = {};
    
    if (config.status) updates.status = config.status;
    if (config.score) updates.score = config.score;
    if (config.priority) updates.priority = config.priority;
    if (config.tags) updates.tags = config.tags;

    const { error } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', leadId)
      .eq('workspace_id', this.workspaceId);

    if (error) {
      throw new Error(`Failed to update lead status: ${error.message}`);
    }

    return { status: 'updated', leadId, updates };
  }

  /**
   * Tag lead
   */
  private async tagLead(leadId: string, config: Record<string, any>): Promise<any> {
    const supabase = createServerClient(cookies());

    const tags = Array.isArray(config.tags) ? config.tags : [config.tags];
    
    // Get current lead tags
    const { data: lead } = await supabase
      .from('leads')
      .select('tags')
      .eq('id', leadId)
      .eq('workspace_id', this.workspaceId)
      .single();

    if (!lead) {
      throw new Error('Lead not found');
    }

    const currentTags = Array.isArray(lead.tags) ? lead.tags : [];
    const newTags = [...new Set([...currentTags, ...tags])]; // Merge and deduplicate

    const { error } = await supabase
      .from('leads')
      .update({ tags: newTags })
      .eq('id', leadId)
      .eq('workspace_id', this.workspaceId);

    if (error) {
      throw new Error(`Failed to tag lead: ${error.message}`);
    }

    return { status: 'tagged', leadId, addedTags: tags };
  }

  /**
   * Create task in Pipedrive
   */
  private async createTask(dealId: number, config: Record<string, any>): Promise<any> {
    await this.initializeClient();

    const taskData = {
      deal_id: dealId,
      subject: config.subject || 'Automated Task',
      type: config.type || 'task',
      due_date: config.dueDate || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      note: config.note || '',
      owner_id: config.ownerId,
    };

    const response = await this.client.post<PipedriveActivity>('/activities', taskData);
    
    if (!response.success) {
      throw new Error('Failed to create task in Pipedrive');
    }

    return { status: 'created', taskId: response.data.id, dealId };
  }

  /**
   * Get campaign performance metrics
   */
  async getCampaignPerformance(campaignId: string, timeframe: '30d' | '90d' | '1y' = '90d'): Promise<CampaignPerformance> {
    const supabase = createServerClient(cookies());

    const startDate = new Date();
    switch (timeframe) {
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
    }

    // Get campaign info
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('name')
      .eq('id', campaignId)
      .eq('workspace_id', this.workspaceId)
      .single();

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    // Get leads in campaign
    const { data: campaignLeads } = await supabase
      .from('campaign_leads')
      .select('lead_id, added_at')
      .eq('campaign_id', campaignId)
      .eq('workspace_id', this.workspaceId)
      .gte('added_at', startDate.toISOString());

    if (!campaignLeads) {
      throw new Error('No campaign leads found');
    }

    const leadIds = campaignLeads.map(cl => cl.lead_id);

    // Get deals associated with these leads
    const { data: dealSyncStatuses } = await supabase
      .from('pipedrive_sync_status')
      .select('entity_id, pipedrive_id')
      .eq('workspace_id', this.workspaceId)
      .eq('entity_type', 'deal')
      .in('entity_id', leadIds);

    if (!dealSyncStatuses) {
      return this.createEmptyCampaignPerformance(campaignId, campaign.name);
    }

    const dealIds = dealSyncStatuses.map(ds => ds.pipedrive_id);

    // Get deal data
    const { data: deals } = await supabase
      .from('pipedrive_deals')
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .in('id', dealIds);

    if (!deals || deals.length === 0) {
      return this.createEmptyCampaignPerformance(campaignId, campaign.name);
    }

    // Calculate metrics
    const dealsGenerated = deals.length;
    const totalDealValue = deals.reduce((sum, deal) => sum + (deal.value || 0), 0);
    const averageDealSize = dealsGenerated > 0 ? totalDealValue / dealsGenerated : 0;
    
    const wonDeals = deals.filter(d => d.status === 'won');
    const conversionRate = leadIds.length > 0 ? wonDeals.length / leadIds.length : 0;
    const leadsToDealConversion = leadIds.length > 0 ? dealsGenerated / leadIds.length : 0;

    // Calculate ROI (would need campaign cost data)
    const campaignCost = 1000; // Placeholder - would get from campaign data
    const revenue = wonDeals.reduce((sum, deal) => sum + (deal.value || 0), 0);
    const roi = campaignCost > 0 ? (revenue - campaignCost) / campaignCost : 0;

    // Calculate average time to convert
    const conversionTimes = wonDeals.map(deal => {
      const leadData = dealSyncStatuses.find(ds => ds.pipedrive_id === deal.id);
      const campaignLead = campaignLeads.find(cl => cl.lead_id === leadData?.entity_id);
      if (campaignLead && deal.won_time) {
        return (new Date(deal.won_time).getTime() - new Date(campaignLead.added_at).getTime()) / (1000 * 60 * 60 * 24);
      }
      return 0;
    }).filter(time => time > 0);

    const averageTimeToConvert = conversionTimes.length > 0 
      ? conversionTimes.reduce((sum, time) => sum + time, 0) / conversionTimes.length 
      : 0;

    // Stage breakdown
    const stageBreakdown: Record<string, number> = {};
    const { data: stages } = await supabase
      .from('pipedrive_stages')
      .select('id, name')
      .eq('workspace_id', this.workspaceId);

    if (stages) {
      for (const stage of stages) {
        const stageDeals = deals.filter(d => d.stage_id === stage.id).length;
        stageBreakdown[stage.name] = stageDeals;
      }
    }

    // Revenue attribution (simplified)
    const revenueAttribution: RevenueAttribution[] = wonDeals.map(deal => ({
      dealId: deal.id,
      dealValue: deal.value || 0,
      dealStatus: 'won',
      attributionPercentage: 100, // Full attribution for simplicity
      firstTouch: true,
      lastTouch: true,
      touchPoints: [{
        campaignId,
        touchDate: new Date(deal.add_time),
        touchType: 'email',
        engagement: 'medium',
        dealStageAtTouch: deal.stage_id,
      }],
    }));

    return {
      campaignId,
      campaignName: campaign.name,
      dealsGenerated,
      totalDealValue,
      averageDealSize,
      conversionRate,
      roi,
      leadsToDealConversion,
      averageTimeToConvert,
      stageBreakdown,
      revenueAttribution,
    };
  }

  /**
   * Generate campaign optimization recommendations
   */
  async generateCampaignOptimizations(campaignId: string): Promise<CampaignOptimization> {
    const performance = await this.getCampaignPerformance(campaignId, '90d');
    
    const recommendations: OptimizationRecommendation[] = [];
    const aTestSuggestions: ATestSuggestion[] = [];
    const segmentationOpportunities: SegmentationOpportunity[] = [];
    const contentOptimizations: ContentOptimization[] = [];

    // Analyze performance and generate recommendations
    if (performance.conversionRate < 0.05) {
      recommendations.push({
        type: 'targeting',
        priority: 'high',
        title: 'Improve Lead Targeting',
        description: `Conversion rate of ${(performance.conversionRate * 100).toFixed(1)}% is below benchmark`,
        expectedImpact: 'Increase conversion rate by 2-3x',
        implementation: 'Review ICP and qualification criteria',
        effort: 'medium',
      });
    }

    if (performance.averageTimeToConvert > 60) {
      recommendations.push({
        type: 'sequence',
        priority: 'medium',
        title: 'Accelerate Conversion Process',
        description: `Average time to convert (${Math.round(performance.averageTimeToConvert)} days) is lengthy`,
        expectedImpact: 'Reduce conversion time by 25-40%',
        implementation: 'Optimize email sequence timing and add urgency',
        effort: 'low',
      });
    }

    if (performance.averageDealSize < 10000) {
      recommendations.push({
        type: 'targeting',
        priority: 'medium',
        title: 'Target Higher-Value Prospects',
        description: 'Focus on larger companies and enterprise segments',
        expectedImpact: 'Increase average deal size by 50-100%',
        implementation: 'Adjust targeting criteria and messaging',
        effort: 'medium',
      });
    }

    // A/B test suggestions
    aTestSuggestions.push({
      element: 'subject_line',
      hypothesis: 'Personalized subject lines will improve open rates',
      testVariations: ['Generic subject', 'Company name personalization', 'Role-based personalization'],
      successMetric: 'Open rate',
      expectedLift: '15-25%',
      duration: '2 weeks',
    });

    aTestSuggestions.push({
      element: 'send_time',
      hypothesis: 'Different send times may improve engagement',
      testVariations: ['9 AM', '2 PM', '5 PM'],
      successMetric: 'Reply rate',
      expectedLift: '10-20%',
      duration: '3 weeks',
    });

    // Segmentation opportunities
    segmentationOpportunities.push({
      segment: 'Company Size',
      criteria: { employeeCount: '>100' },
      expectedImprovement: 'Higher conversion rates for enterprise',
      currentPerformance: performance.conversionRate,
      projectedPerformance: performance.conversionRate * 1.5,
    });

    // Content optimizations
    contentOptimizations.push({
      contentType: 'email_template',
      currentPerformance: 0.15, // Example open rate
      suggestions: [
        'Add more social proof and case studies',
        'Include industry-specific pain points',
        'Simplify call-to-action',
        'Add urgency elements',
      ],
      benchmarkData: {
        industry_average: 0.21,
        top_quartile: 0.35,
      },
    });

    return {
      campaignId,
      recommendations,
      aTestSuggestions,
      segmentationOpportunities,
      contentOptimizations,
    };
  }

  /**
   * Sync deal and campaign status
   */
  async syncDealCampaignStatus(dealId: number): Promise<DealCampaignSync> {
    const supabase = createServerClient(cookies());

    // Get lead associated with deal
    const { data: syncStatus } = await supabase
      .from('pipedrive_sync_status')
      .select('entity_id')
      .eq('workspace_id', this.workspaceId)
      .eq('entity_type', 'deal')
      .eq('pipedrive_id', dealId)
      .single();

    if (!syncStatus?.entity_id) {
      throw new Error('No associated lead found for deal');
    }

    const leadId = syncStatus.entity_id;

    // Get active campaigns for this lead
    const { data: campaignLeads } = await supabase
      .from('campaign_leads')
      .select('campaign_id, campaigns(name)')
      .eq('lead_id', leadId)
      .eq('workspace_id', this.workspaceId)
      .eq('status', 'active');

    // Get active sequences for this lead
    const { data: sequenceLeads } = await supabase
      .from('sequence_leads')
      .select('sequence_id, sequences(name)')
      .eq('lead_id', leadId)
      .eq('workspace_id', this.workspaceId)
      .eq('status', 'active');

    const activeCampaigns = campaignLeads?.map(cl => cl.campaign_id) || [];
    const activeSequences = sequenceLeads?.map(sl => sl.sequence_id) || [];

    // Update sync record
    const { error } = await supabase
      .from('pipedrive_deal_campaign_sync')
      .upsert({
        workspace_id: this.workspaceId,
        deal_id: dealId,
        lead_id: leadId,
        active_campaigns: activeCampaigns,
        active_sequences: activeSequences,
        last_synced_at: new Date().toISOString(),
        sync_status: 'active',
        metadata: {
          campaignCount: activeCampaigns.length,
          sequenceCount: activeSequences.length,
        },
      });

    if (error) {
      throw new PipedriveSyncError(`Failed to sync deal campaign status: ${error.message}`);
    }

    return {
      dealId,
      leadId,
      activeCampaigns,
      activeSequences,
      lastSyncedAt: new Date(),
      syncStatus: 'active',
      metadata: {
        campaignCount: activeCampaigns.length,
        sequenceCount: activeSequences.length,
      },
    };
  }

  // Helper methods

  private evaluateCampaignConditions(
    conditions: CampaignCondition[],
    deal: PipedriveDeal,
    eventData: Record<string, any> = {}
  ): boolean {
    return conditions.every(condition => {
      const fieldValue = this.getCampaignFieldValue(condition.field, deal, eventData);
      
      switch (condition.operator) {
        case 'equals':
          return fieldValue === condition.value;
        case 'not_equals':
          return fieldValue !== condition.value;
        case 'greater_than':
          return Number(fieldValue) > Number(condition.value);
        case 'less_than':
          return Number(fieldValue) < Number(condition.value);
        case 'contains':
          return String(fieldValue).toLowerCase().includes(String(condition.value).toLowerCase());
        case 'in_range':
          const [min, max] = condition.value;
          const numValue = Number(fieldValue);
          return numValue >= min && numValue <= max;
        default:
          return false;
      }
    });
  }

  private getCampaignFieldValue(field: string, deal: PipedriveDeal, eventData: Record<string, any>): any {
    // Check event data first
    if (eventData.hasOwnProperty(field)) {
      return eventData[field];
    }

    // Check deal data
    if (field.includes('.')) {
      const parts = field.split('.');
      let value: any = deal;
      for (const part of parts) {
        value = value?.[part];
        if (value === undefined) break;
      }
      return value;
    }

    return (deal as any)[field];
  }

  private async validateCampaignTrigger(trigger: CampaignTrigger): Promise<void> {
    const supabase = createServerClient(cookies());

    // Check if trigger name is unique
    const { data: existingTrigger } = await supabase
      .from('pipedrive_campaign_triggers')
      .select('id')
      .eq('workspace_id', this.workspaceId)
      .eq('name', trigger.name)
      .neq('id', trigger.id)
      .single();

    if (existingTrigger) {
      throw new PipedriveValidationError(`Trigger name '${trigger.name}' already exists`);
    }

    // Validate campaign actions
    for (const action of trigger.campaignActions) {
      switch (action.type) {
        case 'start_sequence':
        case 'stop_sequence':
          if (!action.sequenceId && action.type === 'start_sequence') {
            throw new PipedriveValidationError('Sequence ID is required for start_sequence action');
          }
          break;
        case 'add_to_campaign':
        case 'remove_from_campaign':
          if (!action.campaignId) {
            throw new PipedriveValidationError('Campaign ID is required for campaign actions');
          }
          break;
      }
    }
  }

  private createEmptyCampaignPerformance(campaignId: string, campaignName: string): CampaignPerformance {
    return {
      campaignId,
      campaignName,
      dealsGenerated: 0,
      totalDealValue: 0,
      averageDealSize: 0,
      conversionRate: 0,
      roi: 0,
      leadsToDealConversion: 0,
      averageTimeToConvert: 0,
      stageBreakdown: {},
      revenueAttribution: [],
    };
  }
}