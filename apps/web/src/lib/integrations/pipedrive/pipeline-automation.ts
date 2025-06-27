import { PipedriveDealManager } from './deal-manager';
import { PipedriveClient } from './client';
import { PipedriveAuth } from './auth';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import {
  PipedriveDeal,
  PipedriveStage,
  PipedriveActivity,
  PipedriveApiResponse,
  PipelineAction,
  PipedriveSyncError,
  PipedriveValidationError,
} from './types';

interface PipelineRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  conditions: PipelineCondition[];
  actions: PipelineActionConfig[];
  triggers: PipelineTrigger[];
  schedule?: PipelineSchedule;
}

interface PipelineCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'not_contains' | 'in' | 'not_in' | 'exists' | 'not_exists';
  value: any;
  dataType: 'string' | 'number' | 'boolean' | 'date' | 'array';
}

interface PipelineActionConfig {
  type: 'move_stage' | 'update_field' | 'create_activity' | 'send_notification' | 'start_campaign' | 'stop_campaign' | 'assign_user' | 'add_note' | 'send_email';
  config: Record<string, any>;
  delay?: number; // Delay in minutes
  conditions?: PipelineCondition[]; // Additional conditions for this action
}

interface PipelineTrigger {
  event: 'deal_created' | 'deal_updated' | 'stage_changed' | 'activity_completed' | 'email_replied' | 'time_elapsed' | 'field_changed';
  conditions?: PipelineCondition[];
}

interface PipelineSchedule {
  type: 'interval' | 'cron';
  value: string; // Cron expression or interval in minutes
  timezone?: string;
}

interface AutomationExecution {
  id: string;
  ruleId: string;
  dealId: number;
  triggeredBy: string;
  executedAt: Date;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  actions: ActionExecution[];
  error?: string;
}

interface ActionExecution {
  actionType: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  executedAt?: Date;
  result?: any;
  error?: string;
}

interface StageProgressionRule {
  fromStageId: number;
  toStageId: number;
  autoProgress: boolean;
  conditions: PipelineCondition[];
  delayHours?: number;
  requiresApproval: boolean;
  approvalUsers?: number[];
}

interface DealScoringRule {
  field: string;
  weight: number;
  scoreMapping: Record<string, number>;
  condition?: PipelineCondition;
}

interface PipelineInsight {
  type: 'bottleneck' | 'opportunity' | 'risk' | 'trend';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  affectedDeals: number[];
  recommendation: string;
  impact: string;
  data: Record<string, any>;
}

export class PipelineAutomationEngine {
  private dealManager: PipedriveDealManager;
  private client: PipedriveClient;
  private auth: PipedriveAuth;
  private workspaceId: string;
  private executionQueue: Map<string, AutomationExecution> = new Map();

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
    this.auth = new PipedriveAuth();
    this.dealManager = new PipedriveDealManager(workspaceId);
  }

  private async initializeClient(): Promise<void> {
    if (!this.client) {
      const accessToken = await this.auth.getValidAccessToken(this.workspaceId);
      const integration = await this.auth.getIntegration(this.workspaceId);
      this.client = new PipedriveClient(accessToken, integration?.companyDomain);
    }
  }

  /**
   * Create or update a pipeline automation rule
   */
  async createPipelineRule(rule: Omit<PipelineRule, 'id'>): Promise<PipelineRule> {
    const supabase = createServerClient(cookies());

    const ruleId = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullRule: PipelineRule = {
      id: ruleId,
      ...rule,
    };

    // Validate rule
    await this.validatePipelineRule(fullRule);

    // Store rule in database
    const { error } = await supabase
      .from('pipedrive_automation_rules')
      .insert({
        id: ruleId,
        workspace_id: this.workspaceId,
        name: rule.name,
        description: rule.description,
        enabled: rule.enabled,
        priority: rule.priority,
        conditions: rule.conditions,
        actions: rule.actions,
        triggers: rule.triggers,
        schedule: rule.schedule,
        created_at: new Date().toISOString(),
      });

    if (error) {
      throw new PipedriveSyncError(`Failed to create pipeline rule: ${error.message}`);
    }

    return fullRule;
  }

  /**
   * Process deal events and trigger appropriate automations
   */
  async processDealEvent(
    dealId: number,
    eventType: 'deal_created' | 'deal_updated' | 'stage_changed' | 'activity_completed' | 'email_replied' | 'field_changed',
    eventData: Record<string, any> = {}
  ): Promise<void> {
    const supabase = createServerClient(cookies());

    try {
      // Get active rules for this event type
      const { data: rules } = await supabase
        .from('pipedrive_automation_rules')
        .select('*')
        .eq('workspace_id', this.workspaceId)
        .eq('enabled', true)
        .order('priority', { ascending: false });

      if (!rules || rules.length === 0) return;

      // Get deal data
      const dealResponse = await this.dealManager.getDeal(dealId);
      if (!dealResponse.success) return;

      const deal = dealResponse.data;

      // Process each rule
      for (const rule of rules) {
        // Check if rule is triggered by this event
        const isTriggered = rule.triggers.some((trigger: PipelineTrigger) => {
          if (trigger.event !== eventType) return false;
          
          // Check trigger conditions if any
          if (trigger.conditions && trigger.conditions.length > 0) {
            return this.evaluateConditions(trigger.conditions, deal, eventData);
          }
          
          return true;
        });

        if (isTriggered) {
          // Check rule conditions
          if (rule.conditions && rule.conditions.length > 0) {
            const conditionsMet = this.evaluateConditions(rule.conditions, deal, eventData);
            if (!conditionsMet) continue;
          }

          // Execute rule
          await this.executeAutomationRule(rule, deal, eventType, eventData);
        }
      }
    } catch (error) {
      console.error('Error processing deal event:', error);
      
      // Log error
      await supabase
        .from('pipedrive_automation_logs')
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
   * Execute an automation rule
   */
  private async executeAutomationRule(
    rule: PipelineRule,
    deal: PipedriveDeal,
    eventType: string,
    eventData: Record<string, any>
  ): Promise<void> {
    const supabase = createServerClient(cookies());

    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const execution: AutomationExecution = {
      id: executionId,
      ruleId: rule.id,
      dealId: deal.id,
      triggeredBy: eventType,
      executedAt: new Date(),
      status: 'running',
      actions: rule.actions.map(action => ({
        actionType: action.type,
        status: 'pending',
      })),
    };

    this.executionQueue.set(executionId, execution);

    try {
      // Log execution start
      await supabase
        .from('pipedrive_automation_executions')
        .insert({
          id: executionId,
          workspace_id: this.workspaceId,
          rule_id: rule.id,
          deal_id: deal.id,
          triggered_by: eventType,
          status: 'running',
          started_at: new Date().toISOString(),
        });

      // Execute actions sequentially
      for (let i = 0; i < rule.actions.length; i++) {
        const action = rule.actions[i];
        const actionExecution = execution.actions[i];

        // Apply delay if specified
        if (action.delay && action.delay > 0) {
          await new Promise(resolve => setTimeout(resolve, action.delay * 60 * 1000));
        }

        // Check action-specific conditions
        if (action.conditions && action.conditions.length > 0) {
          const conditionsMet = this.evaluateConditions(action.conditions, deal, eventData);
          if (!conditionsMet) {
            actionExecution.status = 'skipped';
            continue;
          }
        }

        actionExecution.status = 'running';
        actionExecution.executedAt = new Date();

        try {
          const result = await this.executeAction(action, deal, eventData);
          actionExecution.status = 'completed';
          actionExecution.result = result;
        } catch (error) {
          actionExecution.status = 'failed';
          actionExecution.error = (error as Error).message;
          console.error(`Action ${action.type} failed:`, error);
        }
      }

      execution.status = execution.actions.every(a => a.status === 'completed' || a.status === 'skipped') 
        ? 'completed' 
        : 'failed';

      // Update execution status
      await supabase
        .from('pipedrive_automation_executions')
        .update({
          status: execution.status,
          completed_at: new Date().toISOString(),
          actions_results: execution.actions,
        })
        .eq('id', executionId);

    } catch (error) {
      execution.status = 'failed';
      execution.error = (error as Error).message;

      await supabase
        .from('pipedrive_automation_executions')
        .update({
          status: 'failed',
          error_message: execution.error,
          completed_at: new Date().toISOString(),
        })
        .eq('id', executionId);
    } finally {
      this.executionQueue.delete(executionId);
    }
  }

  /**
   * Execute individual action
   */
  private async executeAction(
    action: PipelineActionConfig,
    deal: PipedriveDeal,
    eventData: Record<string, any>
  ): Promise<any> {
    await this.initializeClient();

    switch (action.type) {
      case 'move_stage':
        return this.executeMoveStageAction(action, deal);
      
      case 'update_field':
        return this.executeUpdateFieldAction(action, deal);
      
      case 'create_activity':
        return this.executeCreateActivityAction(action, deal);
      
      case 'send_notification':
        return this.executeSendNotificationAction(action, deal);
      
      case 'start_campaign':
        return this.executeStartCampaignAction(action, deal);
      
      case 'stop_campaign':
        return this.executeStopCampaignAction(action, deal);
      
      case 'assign_user':
        return this.executeAssignUserAction(action, deal);
      
      case 'add_note':
        return this.executeAddNoteAction(action, deal);
      
      case 'send_email':
        return this.executeSendEmailAction(action, deal);
      
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  private async executeMoveStageAction(action: PipelineActionConfig, deal: PipedriveDeal): Promise<any> {
    const targetStageId = action.config.stageId;
    if (!targetStageId) {
      throw new Error('Target stage ID is required for move_stage action');
    }

    return this.dealManager.moveDealToStage(deal.id, targetStageId);
  }

  private async executeUpdateFieldAction(action: PipelineActionConfig, deal: PipedriveDeal): Promise<any> {
    const updates = action.config.updates || {};
    if (Object.keys(updates).length === 0) {
      throw new Error('Updates are required for update_field action');
    }

    return this.dealManager.updateDeal(deal.id, updates);
  }

  private async executeCreateActivityAction(action: PipelineActionConfig, deal: PipedriveDeal): Promise<any> {
    const activityData = {
      deal_id: deal.id,
      subject: action.config.subject || 'Automated Activity',
      type: action.config.type || 'task',
      due_date: action.config.dueDate || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      note: action.config.note || '',
      owner_id: action.config.ownerId || deal.owner_id,
    };

    return this.client.post<PipedriveActivity>('/activities', activityData);
  }

  private async executeSendNotificationAction(action: PipelineActionConfig, deal: PipedriveDeal): Promise<any> {
    const supabase = createServerClient(cookies());

    return supabase
      .from('notifications')
      .insert({
        workspace_id: this.workspaceId,
        type: 'pipeline_automation',
        title: action.config.title || 'Pipeline Automation',
        message: action.config.message || `Automated action triggered for deal: ${deal.title}`,
        deal_id: deal.id,
        user_id: action.config.userId || deal.owner_id,
        data: {
          dealId: deal.id,
          dealTitle: deal.title,
          actionType: 'send_notification',
        },
      });
  }

  private async executeStartCampaignAction(action: PipelineActionConfig, deal: PipedriveDeal): Promise<any> {
    const supabase = createServerClient(cookies());

    // Get lead associated with this deal
    const { data: syncStatus } = await supabase
      .from('pipedrive_sync_status')
      .select('entity_id')
      .eq('workspace_id', this.workspaceId)
      .eq('entity_type', 'deal')
      .eq('pipedrive_id', deal.id)
      .single();

    if (!syncStatus?.entity_id) {
      throw new Error('No associated lead found for deal');
    }

    const campaignId = action.config.campaignId;
    if (!campaignId) {
      throw new Error('Campaign ID is required for start_campaign action');
    }

    // Add lead to campaign
    return supabase
      .from('campaign_leads')
      .insert({
        campaign_id: campaignId,
        lead_id: syncStatus.entity_id,
        workspace_id: this.workspaceId,
        status: 'active',
        added_at: new Date().toISOString(),
        added_by_automation: true,
      });
  }

  private async executeStopCampaignAction(action: PipelineActionConfig, deal: PipedriveDeal): Promise<any> {
    const supabase = createServerClient(cookies());

    // Get lead associated with this deal
    const { data: syncStatus } = await supabase
      .from('pipedrive_sync_status')
      .select('entity_id')
      .eq('workspace_id', this.workspaceId)
      .eq('entity_type', 'deal')
      .eq('pipedrive_id', deal.id)
      .single();

    if (!syncStatus?.entity_id) {
      throw new Error('No associated lead found for deal');
    }

    const campaignId = action.config.campaignId;
    if (campaignId) {
      // Stop specific campaign
      return supabase
        .from('campaign_leads')
        .update({ status: 'paused', paused_at: new Date().toISOString() })
        .eq('campaign_id', campaignId)
        .eq('lead_id', syncStatus.entity_id)
        .eq('workspace_id', this.workspaceId);
    } else {
      // Stop all active campaigns for this lead
      return supabase
        .from('campaign_leads')
        .update({ status: 'paused', paused_at: new Date().toISOString() })
        .eq('lead_id', syncStatus.entity_id)
        .eq('workspace_id', this.workspaceId)
        .eq('status', 'active');
    }
  }

  private async executeAssignUserAction(action: PipelineActionConfig, deal: PipedriveDeal): Promise<any> {
    const userId = action.config.userId;
    if (!userId) {
      throw new Error('User ID is required for assign_user action');
    }

    return this.dealManager.updateDeal(deal.id, { owner_id: userId });
  }

  private async executeAddNoteAction(action: PipelineActionConfig, deal: PipedriveDeal): Promise<any> {
    const noteContent = action.config.content || 'Automated note';
    
    return this.client.post('/notes', {
      deal_id: deal.id,
      content: noteContent,
      add_time: new Date().toISOString(),
    });
  }

  private async executeSendEmailAction(action: PipelineActionConfig, deal: PipedriveDeal): Promise<any> {
    // This would integrate with your email service
    // For now, just log the action
    console.log(`Sending automated email for deal ${deal.id}:`, action.config);
    
    return {
      status: 'queued',
      dealId: deal.id,
      emailConfig: action.config,
    };
  }

  /**
   * Evaluate conditions against deal data
   */
  private evaluateConditions(
    conditions: PipelineCondition[],
    deal: PipedriveDeal,
    eventData: Record<string, any> = {}
  ): boolean {
    return conditions.every(condition => {
      const fieldValue = this.getFieldValue(condition.field, deal, eventData);
      
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
        
        case 'not_contains':
          return !String(fieldValue).toLowerCase().includes(String(condition.value).toLowerCase());
        
        case 'in':
          return Array.isArray(condition.value) && condition.value.includes(fieldValue);
        
        case 'not_in':
          return !Array.isArray(condition.value) || !condition.value.includes(fieldValue);
        
        case 'exists':
          return fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
        
        case 'not_exists':
          return fieldValue === null || fieldValue === undefined || fieldValue === '';
        
        default:
          return false;
      }
    });
  }

  /**
   * Get field value from deal or event data
   */
  private getFieldValue(field: string, deal: PipedriveDeal, eventData: Record<string, any>): any {
    // Check event data first
    if (eventData.hasOwnProperty(field)) {
      return eventData[field];
    }

    // Check deal data
    if (field.includes('.')) {
      // Handle nested fields like 'custom_fields.lead_score'
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

  /**
   * Setup stage progression rules
   */
  async setupStageProgressionRules(rules: StageProgressionRule[]): Promise<void> {
    const supabase = createServerClient(cookies());

    for (const rule of rules) {
      await supabase
        .from('pipedrive_stage_progression_rules')
        .upsert({
          workspace_id: this.workspaceId,
          from_stage_id: rule.fromStageId,
          to_stage_id: rule.toStageId,
          auto_progress: rule.autoProgress,
          conditions: rule.conditions,
          delay_hours: rule.delayHours,
          requires_approval: rule.requiresApproval,
          approval_users: rule.approvalUsers,
        });
    }
  }

  /**
   * Process automatic stage progression
   */
  async processStageProgression(dealId: number): Promise<void> {
    const supabase = createServerClient(cookies());

    // Get current deal
    const dealResponse = await this.dealManager.getDeal(dealId);
    if (!dealResponse.success) return;

    const deal = dealResponse.data;

    // Get progression rules for current stage
    const { data: rules } = await supabase
      .from('pipedrive_stage_progression_rules')
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .eq('from_stage_id', deal.stage_id)
      .eq('auto_progress', true);

    if (!rules || rules.length === 0) return;

    for (const rule of rules) {
      // Check conditions
      if (rule.conditions && rule.conditions.length > 0) {
        const conditionsMet = this.evaluateConditions(rule.conditions, deal);
        if (!conditionsMet) continue;
      }

      // Check if enough time has passed
      if (rule.delay_hours && rule.delay_hours > 0) {
        const stageChangeTime = new Date(deal.stage_change_time || deal.update_time);
        const requiredTime = new Date(stageChangeTime.getTime() + (rule.delay_hours * 60 * 60 * 1000));
        if (new Date() < requiredTime) continue;
      }

      // Check if approval is required
      if (rule.requires_approval) {
        const { data: approval } = await supabase
          .from('pipedrive_stage_approvals')
          .select('*')
          .eq('workspace_id', this.workspaceId)
          .eq('deal_id', dealId)
          .eq('from_stage_id', rule.from_stage_id)
          .eq('to_stage_id', rule.to_stage_id)
          .eq('status', 'approved')
          .single();

        if (!approval) continue;
      }

      // Progress the deal
      await this.dealManager.moveDealToStage(dealId, rule.to_stage_id);
      
      // Log the progression
      await supabase
        .from('pipedrive_automation_logs')
        .insert({
          workspace_id: this.workspaceId,
          deal_id: dealId,
          action_type: 'auto_stage_progression',
          data: {
            fromStageId: rule.from_stage_id,
            toStageId: rule.to_stage_id,
            ruleId: rule.id,
          },
          created_at: new Date().toISOString(),
        });

      break; // Only progress one stage at a time
    }
  }

  /**
   * Generate pipeline insights and recommendations
   */
  async generatePipelineInsights(): Promise<PipelineInsight[]> {
    const supabase = createServerClient(cookies());
    const insights: PipelineInsight[] = [];

    // Get pipeline analytics
    const analytics = await this.dealManager.getPipelineAnalytics('90d');
    
    // Identify bottlenecks (stages with slow velocity)
    const slowStages = Object.entries(analytics.stageVelocity)
      .filter(([_, velocity]) => velocity > 21) // More than 3 weeks
      .map(([stageId, velocity]) => ({ stageId: parseInt(stageId), velocity }));

    if (slowStages.length > 0) {
      const affectedDeals = await this.getDealsInStages(slowStages.map(s => s.stageId));
      
      insights.push({
        type: 'bottleneck',
        severity: 'high',
        title: 'Pipeline Bottleneck Detected',
        description: `${slowStages.length} stage(s) have deals staying longer than 3 weeks on average`,
        affectedDeals: affectedDeals.map(d => d.id),
        recommendation: 'Review qualification criteria and add automation to move deals forward',
        impact: 'Could accelerate deal closure by 15-30%',
        data: {
          slowStages,
          averageDelay: slowStages.reduce((sum, s) => sum + s.velocity, 0) / slowStages.length,
        },
      });
    }

    // Identify low conversion rates
    const lowConversionStages = Object.entries(analytics.conversionRates)
      .filter(([_, rate]) => rate < 0.3) // Less than 30% conversion
      .map(([stageId, rate]) => ({ stageId: parseInt(stageId), rate }));

    if (lowConversionStages.length > 0) {
      insights.push({
        type: 'risk',
        severity: 'medium',
        title: 'Low Conversion Rates',
        description: `${lowConversionStages.length} stage(s) have conversion rates below 30%`,
        affectedDeals: [],
        recommendation: 'Improve qualification criteria and add training for these stages',
        impact: 'Could improve overall pipeline conversion by 10-20%',
        data: {
          lowConversionStages,
        },
      });
    }

    // Identify stale deals
    const { data: staleDeals } = await supabase
      .from('pipedrive_deals')
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .eq('status', 'open')
      .lt('updated_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    if (staleDeals && staleDeals.length > 0) {
      insights.push({
        type: 'risk',
        severity: 'medium',
        title: 'Stale Deals Detected',
        description: `${staleDeals.length} deals haven't been updated in over 30 days`,
        affectedDeals: staleDeals.map(d => d.id),
        recommendation: 'Set up automated follow-up reminders and review deal status',
        impact: 'Could recover 10-15% of stale deals',
        data: {
          staleDealsCount: staleDeals.length,
          totalValue: staleDeals.reduce((sum, d) => sum + (d.value || 0), 0),
        },
      });
    }

    // Identify opportunities for automation
    const manualActivities = await this.identifyManualActivities();
    if (manualActivities.length > 0) {
      insights.push({
        type: 'opportunity',
        severity: 'low',
        title: 'Automation Opportunities',
        description: `${manualActivities.length} repetitive activities could be automated`,
        affectedDeals: [],
        recommendation: 'Set up workflow automation for repetitive tasks',
        impact: 'Could save 5-10 hours per week',
        data: {
          manualActivities,
        },
      });
    }

    return insights;
  }

  /**
   * Get deals in specific stages
   */
  private async getDealsInStages(stageIds: number[]): Promise<PipedriveDeal[]> {
    const allDeals: PipedriveDeal[] = [];
    
    for (const stageId of stageIds) {
      const response = await this.dealManager.getDeals({ stage_id: stageId, status: 'open' });
      if (response.success) {
        allDeals.push(...response.data);
      }
    }
    
    return allDeals;
  }

  /**
   * Identify manual activities that could be automated
   */
  private async identifyManualActivities(): Promise<string[]> {
    const supabase = createServerClient(cookies());
    
    // Get activity patterns from last 90 days
    const { data: activities } = await supabase
      .from('pipedrive_activities')
      .select('type, subject')
      .eq('workspace_id', this.workspaceId)
      .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

    if (!activities) return [];

    // Group by type and subject to find patterns
    const activityCounts = new Map<string, number>();
    
    for (const activity of activities) {
      const key = `${activity.type}:${activity.subject}`;
      activityCounts.set(key, (activityCounts.get(key) || 0) + 1);
    }

    // Find activities that occur frequently (could be automated)
    return Array.from(activityCounts.entries())
      .filter(([_, count]) => count >= 10) // Occurs 10+ times
      .map(([key, _]) => key);
  }

  /**
   * Validate pipeline rule configuration
   */
  private async validatePipelineRule(rule: PipelineRule): Promise<void> {
    // Check if rule name is unique
    const supabase = createServerClient(cookies());
    
    const { data: existingRule } = await supabase
      .from('pipedrive_automation_rules')
      .select('id')
      .eq('workspace_id', this.workspaceId)
      .eq('name', rule.name)
      .neq('id', rule.id)
      .single();

    if (existingRule) {
      throw new PipedriveValidationError(`Rule name '${rule.name}' already exists`);
    }

    // Validate conditions
    for (const condition of rule.conditions) {
      if (!condition.field || !condition.operator) {
        throw new PipedriveValidationError('Condition must have field and operator');
      }
    }

    // Validate actions
    for (const action of rule.actions) {
      if (!action.type) {
        throw new PipedriveValidationError('Action must have type');
      }

      // Validate action-specific requirements
      switch (action.type) {
        case 'move_stage':
          if (!action.config.stageId) {
            throw new PipedriveValidationError('move_stage action requires stageId');
          }
          break;
        case 'update_field':
          if (!action.config.updates || Object.keys(action.config.updates).length === 0) {
            throw new PipedriveValidationError('update_field action requires updates');
          }
          break;
        case 'assign_user':
          if (!action.config.userId) {
            throw new PipedriveValidationError('assign_user action requires userId');
          }
          break;
      }
    }

    // Validate triggers
    for (const trigger of rule.triggers) {
      if (!trigger.event) {
        throw new PipedriveValidationError('Trigger must have event type');
      }
    }
  }

  /**
   * Get automation execution history
   */
  async getExecutionHistory(limit: number = 100): Promise<any[]> {
    const supabase = createServerClient(cookies());
    
    const { data, error } = await supabase
      .from('pipedrive_automation_executions')
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new PipedriveSyncError(`Failed to get execution history: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get automation rules
   */
  async getAutomationRules(): Promise<PipelineRule[]> {
    const supabase = createServerClient(cookies());
    
    const { data, error } = await supabase
      .from('pipedrive_automation_rules')
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .order('priority', { ascending: false });

    if (error) {
      throw new PipedriveSyncError(`Failed to get automation rules: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Enable or disable automation rule
   */
  async toggleAutomationRule(ruleId: string, enabled: boolean): Promise<void> {
    const supabase = createServerClient(cookies());
    
    const { error } = await supabase
      .from('pipedrive_automation_rules')
      .update({ enabled })
      .eq('id', ruleId)
      .eq('workspace_id', this.workspaceId);

    if (error) {
      throw new PipedriveSyncError(`Failed to toggle automation rule: ${error.message}`);
    }
  }
}