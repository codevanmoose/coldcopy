import { PipedriveClient } from './client';
import { PipedriveAuth } from './auth';
import { PipedriveDealsService } from './deals';
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
  PipedriveActivity,
  PipedrivePerson,
  PipedriveOrganization,
} from './types';

// Enhanced interfaces for deal management
interface DealValueCalculation {
  baseValue: number;
  leadScore: number;
  companySize: number;
  industryMultiplier: number;
  engagementScore: number;
  historicalConversionRate: number;
  calculatedValue: number;
  confidence: number;
  factors: DealValueFactor[];
}

interface DealValueFactor {
  name: string;
  value: number;
  weight: number;
  impact: 'positive' | 'negative' | 'neutral';
  description: string;
}

interface DealHealthScore {
  overall: number;
  factors: {
    stageVelocity: number;
    engagement: number;
    communication: number;
    qualification: number;
    competition: number;
  };
  risks: DealRisk[];
  recommendations: DealRecommendation[];
  lastUpdated: Date;
}

interface DealRisk {
  type: 'high_risk' | 'medium_risk' | 'low_risk';
  category: 'timeline' | 'communication' | 'qualification' | 'competition' | 'budget';
  description: string;
  impact: number;
  mitigation: string;
}

interface DealRecommendation {
  priority: 'high' | 'medium' | 'low';
  type: 'action' | 'follow_up' | 'qualification' | 'nurture';
  title: string;
  description: string;
  expectedImpact: string;
  timeline: string;
}

interface DealTimeline {
  dealId: number;
  events: DealTimelineEvent[];
  milestones: DealMilestone[];
  nextActions: DealAction[];
  averageStageTime: number;
  projectedCloseDate: Date;
}

interface DealTimelineEvent {
  id: string;
  type: 'stage_change' | 'activity' | 'email' | 'meeting' | 'note' | 'file' | 'call';
  timestamp: Date;
  title: string;
  description: string;
  userId?: number;
  userName?: string;
  metadata?: Record<string, any>;
}

interface DealMilestone {
  id: string;
  name: string;
  stageId: number;
  expectedDate: Date;
  actualDate?: Date;
  status: 'pending' | 'completed' | 'overdue';
  criteria: string[];
}

interface DealAction {
  id: string;
  type: 'follow_up' | 'qualification' | 'proposal' | 'negotiation' | 'close';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  dueDate: Date;
  assignedTo?: number;
  status: 'pending' | 'in_progress' | 'completed';
}

interface PipelineAnalytics {
  totalValue: number;
  weightedValue: number;
  averageDealSize: number;
  averageSalesCycle: number;
  conversionRates: Record<number, number>; // stage_id -> conversion rate
  stageVelocity: Record<number, number>; // stage_id -> average days
  forecastAccuracy: number;
  trends: PipelineTrend[];
}

interface PipelineTrend {
  period: string;
  metric: string;
  value: number;
  change: number;
  direction: 'up' | 'down' | 'stable';
}

interface WorkflowTrigger {
  id: string;
  name: string;
  stageId: number;
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
  enabled: boolean;
}

interface WorkflowCondition {
  field: string;
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains' | 'not_empty';
  value: any;
}

interface WorkflowAction {
  type: 'create_activity' | 'send_email' | 'update_deal' | 'assign_user' | 'create_notification';
  config: Record<string, any>;
}

interface DealForecast {
  period: 'monthly' | 'quarterly' | 'yearly';
  startDate: Date;
  endDate: Date;
  totalValue: number;
  weightedValue: number;
  dealsCount: number;
  confidence: number;
  breakdown: ForecastBreakdown[];
}

interface ForecastBreakdown {
  stageId: number;
  stageName: string;
  dealsCount: number;
  totalValue: number;
  probability: number;
  weightedValue: number;
}

export class PipedriveDealManager {
  private client: PipedriveClient;
  private auth: PipedriveAuth;
  private dealsService: PipedriveDealsService;
  private workspaceId: string;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
    this.auth = new PipedriveAuth();
    this.dealsService = new PipedriveDealsService(workspaceId);
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
   * Create deal with intelligent value calculation
   */
  async createDealWithIntelligentValue(
    leadId: string,
    title: string,
    personId?: number,
    orgId?: number,
    stageId?: number
  ): Promise<{ deal: PipedriveDeal; valueCalculation: DealValueCalculation }> {
    await this.initializeClient();
    const supabase = createServerClient(cookies());

    // Get lead data for value calculation
    const { data: lead } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .eq('workspace_id', this.workspaceId)
      .single();

    if (!lead) {
      throw new PipedriveValidationError('Lead not found');
    }

    // Calculate intelligent deal value
    const valueCalculation = await this.calculateDealValue(lead);

    // Get default stage if not provided
    if (!stageId) {
      const stages = await this.dealsService.getStages();
      if (stages.success && stages.data.length > 0) {
        stageId = stages.data[0].id;
      }
    }

    // Create the deal
    const dealData = {
      title,
      value: Math.round(valueCalculation.calculatedValue),
      currency: 'USD',
      person_id: personId,
      org_id: orgId,
      stage_id: stageId,
      probability: valueCalculation.confidence,
      custom_fields: {
        lead_score: lead.score,
        coldcopy_lead_id: leadId,
        value_calculation_confidence: valueCalculation.confidence,
        calculated_by_ai: true,
      },
    };

    const dealResponse = await this.dealsService.createDeal(dealData);

    if (!dealResponse.success) {
      throw new PipedriveSyncError('Failed to create deal');
    }

    // Store value calculation details
    await supabase
      .from('pipedrive_deal_value_calculations')
      .insert({
        workspace_id: this.workspaceId,
        deal_id: dealResponse.data.id,
        lead_id: leadId,
        base_value: valueCalculation.baseValue,
        calculated_value: valueCalculation.calculatedValue,
        confidence: valueCalculation.confidence,
        factors: valueCalculation.factors,
        calculation_date: new Date().toISOString(),
      });

    // Initialize deal timeline
    await this.initializeDealTimeline(dealResponse.data.id, leadId);

    return {
      deal: dealResponse.data,
      valueCalculation,
    };
  }

  /**
   * Calculate intelligent deal value based on lead data and historical patterns
   */
  async calculateDealValue(lead: any): Promise<DealValueCalculation> {
    const supabase = createServerClient(cookies());
    
    // Base value from lead or default
    const baseValue = lead.estimated_value || 5000;
    
    // Factors for calculation
    const factors: DealValueFactor[] = [];
    let multiplier = 1.0;

    // Lead score factor (0-100 scale)
    if (lead.score) {
      const scoreMultiplier = (lead.score / 100) * 0.5 + 0.75; // 0.75 to 1.25
      multiplier *= scoreMultiplier;
      factors.push({
        name: 'Lead Score',
        value: lead.score,
        weight: 0.25,
        impact: lead.score > 70 ? 'positive' : lead.score < 30 ? 'negative' : 'neutral',
        description: `Lead score of ${lead.score} indicates ${lead.score > 70 ? 'high' : lead.score < 30 ? 'low' : 'medium'} qualification`,
      });
    }

    // Company size factor (if available from enrichment)
    if (lead.enrichment_data?.company?.employee_count) {
      const employeeCount = lead.enrichment_data.company.employee_count;
      let sizeMultiplier = 1.0;
      
      if (employeeCount < 10) sizeMultiplier = 0.7;
      else if (employeeCount < 50) sizeMultiplier = 0.9;
      else if (employeeCount < 200) sizeMultiplier = 1.1;
      else if (employeeCount < 1000) sizeMultiplier = 1.3;
      else sizeMultiplier = 1.5;

      multiplier *= sizeMultiplier;
      factors.push({
        name: 'Company Size',
        value: employeeCount,
        weight: 0.2,
        impact: sizeMultiplier > 1 ? 'positive' : 'negative',
        description: `Company with ${employeeCount} employees suggests ${sizeMultiplier > 1 ? 'higher' : 'lower'} deal value`,
      });
    }

    // Industry factor
    if (lead.enrichment_data?.company?.industry) {
      const industry = lead.enrichment_data.company.industry.toLowerCase();
      let industryMultiplier = 1.0;

      // High-value industries
      if (['technology', 'finance', 'healthcare', 'consulting'].some(i => industry.includes(i))) {
        industryMultiplier = 1.2;
      }
      // Medium-value industries
      else if (['manufacturing', 'retail', 'education'].some(i => industry.includes(i))) {
        industryMultiplier = 1.0;
      }
      // Lower-value industries
      else if (['non-profit', 'government'].some(i => industry.includes(i))) {
        industryMultiplier = 0.8;
      }

      multiplier *= industryMultiplier;
      factors.push({
        name: 'Industry',
        value: industry,
        weight: 0.15,
        impact: industryMultiplier > 1 ? 'positive' : industryMultiplier < 1 ? 'negative' : 'neutral',
        description: `${industry} industry typically has ${industryMultiplier > 1 ? 'higher' : industryMultiplier < 1 ? 'lower' : 'average'} deal values`,
      });
    }

    // Engagement score (based on email interactions, etc.)
    const { data: engagementData } = await supabase
      .from('email_events')
      .select('event_type')
      .eq('lead_id', lead.id)
      .eq('workspace_id', this.workspaceId);

    if (engagementData && engagementData.length > 0) {
      const opens = engagementData.filter(e => e.event_type === 'open').length;
      const clicks = engagementData.filter(e => e.event_type === 'click').length;
      const replies = engagementData.filter(e => e.event_type === 'reply').length;
      
      const engagementScore = (opens * 1 + clicks * 3 + replies * 5) / engagementData.length;
      const engagementMultiplier = Math.min(1.3, 0.8 + (engagementScore / 10));
      
      multiplier *= engagementMultiplier;
      factors.push({
        name: 'Engagement Score',
        value: engagementScore,
        weight: 0.2,
        impact: engagementMultiplier > 1 ? 'positive' : 'negative',
        description: `High engagement (${opens} opens, ${clicks} clicks, ${replies} replies) indicates strong interest`,
      });
    }

    // Historical conversion rate for similar leads
    const { data: historicalData } = await supabase
      .from('pipedrive_deals')
      .select('value, status')
      .eq('workspace_id', this.workspaceId)
      .eq('status', 'won')
      .limit(100);

    let historicalMultiplier = 1.0;
    if (historicalData && historicalData.length > 0) {
      const avgHistoricalValue = historicalData.reduce((sum, deal) => sum + (deal.value || 0), 0) / historicalData.length;
      if (avgHistoricalValue > 0) {
        historicalMultiplier = Math.min(1.2, Math.max(0.8, avgHistoricalValue / baseValue));
        factors.push({
          name: 'Historical Average',
          value: avgHistoricalValue,
          weight: 0.1,
          impact: historicalMultiplier > 1 ? 'positive' : 'negative',
          description: `Historical average deal size of $${avgHistoricalValue.toFixed(0)} influences prediction`,
        });
      }
    }
    multiplier *= historicalMultiplier;

    // Calculate final value
    const calculatedValue = baseValue * multiplier;
    const confidence = Math.min(95, Math.max(30, factors.length * 15 + 40)); // 30-95% confidence

    return {
      baseValue,
      leadScore: lead.score || 0,
      companySize: lead.enrichment_data?.company?.employee_count || 0,
      industryMultiplier: factors.find(f => f.name === 'Industry')?.weight || 1,
      engagementScore: factors.find(f => f.name === 'Engagement Score')?.value || 0,
      historicalConversionRate: historicalData?.length || 0,
      calculatedValue: Math.round(calculatedValue),
      confidence,
      factors,
    };
  }

  /**
   * Get comprehensive deal health score with recommendations
   */
  async getDealHealthScore(dealId: number): Promise<DealHealthScore> {
    await this.initializeClient();
    const supabase = createServerClient(cookies());

    // Get deal data
    const dealResponse = await this.dealsService.getDeal(dealId);
    if (!dealResponse.success) {
      throw new PipedriveSyncError('Deal not found');
    }

    const deal = dealResponse.data;
    const risks: DealRisk[] = [];
    const recommendations: DealRecommendation[] = [];

    // Calculate stage velocity score
    const { data: stageHistory } = await supabase
      .from('pipedrive_stage_history')
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .eq('deal_id', dealId)
      .order('changed_at', { ascending: true });

    let stageVelocity = 50; // Default neutral score
    if (stageHistory && stageHistory.length > 1) {
      const stageChanges = stageHistory.slice(1);
      const avgTimePerStage = stageChanges.reduce((sum, change, index) => {
        const prevChange = stageHistory[index];
        const timeDiff = new Date(change.changed_at).getTime() - new Date(prevChange.changed_at).getTime();
        return sum + (timeDiff / (1000 * 60 * 60 * 24)); // Days
      }, 0) / stageChanges.length;

      // Score based on average time per stage (shorter is better, up to a point)
      if (avgTimePerStage < 3) stageVelocity = 30; // Too fast, might be rushed
      else if (avgTimePerStage < 7) stageVelocity = 85; // Good pace
      else if (avgTimePerStage < 14) stageVelocity = 70; // Reasonable pace
      else if (avgTimePerStage < 30) stageVelocity = 40; // Slow
      else stageVelocity = 20; // Very slow

      if (avgTimePerStage > 21) {
        risks.push({
          type: 'high_risk',
          category: 'timeline',
          description: 'Deal is progressing very slowly through pipeline stages',
          impact: 8,
          mitigation: 'Schedule regular check-ins and identify blockers',
        });
        recommendations.push({
          priority: 'high',
          type: 'action',
          title: 'Accelerate Deal Progress',
          description: 'This deal has been stagnant. Schedule a discovery call to identify blockers.',
          expectedImpact: 'Increase close probability by 15-25%',
          timeline: 'Within 3 days',
        });
      }
    }

    // Calculate engagement score
    const { data: activities } = await supabase
      .from('pipedrive_activities')
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .eq('deal_id', dealId)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Last 30 days

    let engagement = 50;
    if (activities) {
      const recentActivities = activities.length;
      const completedActivities = activities.filter(a => a.done).length;
      const completionRate = recentActivities > 0 ? completedActivities / recentActivities : 0;

      engagement = Math.min(100, (recentActivities * 10) + (completionRate * 40));

      if (recentActivities < 2) {
        risks.push({
          type: 'medium_risk',
          category: 'communication',
          description: 'Low activity level in the last 30 days',
          impact: 6,
          mitigation: 'Increase touchpoints and engagement activities',
        });
      }
    }

    // Communication score (based on recent contact)
    const { data: emailEvents } = await supabase
      .from('email_events')
      .select('event_type, created_at')
      .eq('workspace_id', this.workspaceId)
      .eq('deal_id', dealId)
      .gte('created_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    let communication = 50;
    if (emailEvents && emailEvents.length > 0) {
      const replies = emailEvents.filter(e => e.event_type === 'reply').length;
      const opens = emailEvents.filter(e => e.event_type === 'open').length;
      const clicks = emailEvents.filter(e => e.event_type === 'click').length;

      communication = Math.min(100, (replies * 25) + (opens * 5) + (clicks * 15));
      
      const lastCommunication = new Date(emailEvents[0].created_at);
      const daysSinceLastContact = (Date.now() - lastCommunication.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceLastContact > 7) {
        risks.push({
          type: 'medium_risk',
          category: 'communication',
          description: `No communication for ${Math.round(daysSinceLastContact)} days`,
          impact: 5,
          mitigation: 'Send a check-in message or schedule a call',
        });
      }
    } else {
      risks.push({
        type: 'high_risk',
        category: 'communication',
        description: 'No recent communication activity',
        impact: 7,
        mitigation: 'Immediate follow-up required',
      });
    }

    // Qualification score (based on deal data completeness and value)
    let qualification = 30;
    if (deal.person_id) qualification += 20;
    if (deal.org_id) qualification += 20;
    if (deal.value && deal.value > 0) qualification += 15;
    if (deal.expected_close_date) qualification += 15;

    if (qualification < 60) {
      recommendations.push({
        priority: 'medium',
        type: 'qualification',
        title: 'Complete Deal Qualification',
        description: 'Fill in missing deal information to improve accuracy and tracking.',
        expectedImpact: 'Better forecasting and deal management',
        timeline: 'This week',
      });
    }

    // Competition assessment (placeholder - would need actual data)
    const competition = 60; // Default neutral score

    const overall = Math.round(
      (stageVelocity * 0.25) +
      (engagement * 0.25) +
      (communication * 0.25) +
      (qualification * 0.15) +
      (competition * 0.1)
    );

    // Add general recommendations based on overall score
    if (overall < 40) {
      recommendations.push({
        priority: 'high',
        type: 'action',
        title: 'Deal Requires Immediate Attention',
        description: 'This deal shows multiple risk factors and needs urgent intervention.',
        expectedImpact: 'Prevent deal loss and improve close probability',
        timeline: 'Immediate',
      });
    } else if (overall > 80) {
      recommendations.push({
        priority: 'low',
        type: 'nurture',
        title: 'Maintain Momentum',
        description: 'Deal is progressing well. Continue current engagement strategy.',
        expectedImpact: 'Maintain high close probability',
        timeline: 'Ongoing',
      });
    }

    return {
      overall,
      factors: {
        stageVelocity,
        engagement,
        communication,
        qualification,
        competition,
      },
      risks,
      recommendations,
      lastUpdated: new Date(),
    };
  }

  /**
   * Get comprehensive deal timeline with events and milestones
   */
  async getDealTimeline(dealId: number): Promise<DealTimeline> {
    await this.initializeClient();
    const supabase = createServerClient(cookies());

    const events: DealTimelineEvent[] = [];
    const milestones: DealMilestone[] = [];
    const nextActions: DealAction[] = [];

    // Get stage history
    const { data: stageHistory } = await supabase
      .from('pipedrive_stage_history')
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .eq('deal_id', dealId)
      .order('changed_at', { ascending: false });

    if (stageHistory) {
      for (const stage of stageHistory) {
        events.push({
          id: `stage-${stage.id}`,
          type: 'stage_change',
          timestamp: new Date(stage.changed_at),
          title: `Moved to Stage ${stage.stage_id}`,
          description: `Deal progressed from stage ${stage.previous_stage_id} to ${stage.stage_id}`,
          userId: stage.changed_by_user_id,
          metadata: {
            previousStageId: stage.previous_stage_id,
            newStageId: stage.stage_id,
            dealValue: stage.deal_value,
            probability: stage.probability,
          },
        });
      }
    }

    // Get activities
    const activitiesResponse = await this.client.get<PipedriveActivity[]>(`/deals/${dealId}/activities`);
    if (activitiesResponse.success) {
      for (const activity of activitiesResponse.data) {
        events.push({
          id: `activity-${activity.id}`,
          type: 'activity',
          timestamp: new Date(activity.add_time),
          title: activity.subject,
          description: activity.note || '',
          userId: activity.owner_id,
          metadata: {
            activityType: activity.type,
            done: activity.done,
            dueDate: activity.due_date,
          },
        });
      }
    }

    // Get email events
    const { data: emailEvents } = await supabase
      .from('email_events')
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (emailEvents) {
      for (const event of emailEvents) {
        events.push({
          id: `email-${event.id}`,
          type: 'email',
          timestamp: new Date(event.created_at),
          title: `Email ${event.event_type}`,
          description: `Email ${event.event_type} event`,
          metadata: {
            eventType: event.event_type,
            emailSubject: event.email_subject,
          },
        });
      }
    }

    // Sort events by timestamp
    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Generate milestones based on stages
    const stagesResponse = await this.dealsService.getStages();
    if (stagesResponse.success) {
      for (const stage of stagesResponse.data) {
        const stageReached = stageHistory?.find(sh => sh.stage_id === stage.id);
        milestones.push({
          id: `milestone-${stage.id}`,
          name: stage.name,
          stageId: stage.id,
          expectedDate: new Date(Date.now() + (stage.order_nr * 7 * 24 * 60 * 60 * 1000)), // Estimate
          actualDate: stageReached ? new Date(stageReached.changed_at) : undefined,
          status: stageReached ? 'completed' : 'pending',
          criteria: [`Complete ${stage.name} requirements`],
        });
      }
    }

    // Generate next actions based on current stage and health
    const dealResponse = await this.dealsService.getDeal(dealId);
    if (dealResponse.success) {
      const healthScore = await this.getDealHealthScore(dealId);
      
      // Add actions based on recommendations
      for (const rec of healthScore.recommendations.slice(0, 3)) {
        nextActions.push({
          id: `action-${Date.now()}-${Math.random()}`,
          type: rec.type as any,
          priority: rec.priority,
          title: rec.title,
          description: rec.description,
          dueDate: new Date(Date.now() + (rec.priority === 'high' ? 1 : rec.priority === 'medium' ? 3 : 7) * 24 * 60 * 60 * 1000),
          status: 'pending',
        });
      }
    }

    // Calculate average stage time
    let averageStageTime = 14; // Default 14 days
    if (stageHistory && stageHistory.length > 1) {
      const stageTimes = [];
      for (let i = 1; i < stageHistory.length; i++) {
        const timeDiff = new Date(stageHistory[i-1].changed_at).getTime() - new Date(stageHistory[i].changed_at).getTime();
        stageTimes.push(timeDiff / (1000 * 60 * 60 * 24)); // Convert to days
      }
      averageStageTime = stageTimes.reduce((sum, time) => sum + time, 0) / stageTimes.length;
    }

    // Project close date
    const currentStageOrder = stagesResponse.success ? 
      stagesResponse.data.find(s => s.id === dealResponse.data?.stage_id)?.order_nr || 0 : 0;
    const remainingStages = stagesResponse.success ? 
      stagesResponse.data.filter(s => s.order_nr > currentStageOrder).length : 3;
    
    const projectedCloseDate = new Date(Date.now() + (remainingStages * averageStageTime * 24 * 60 * 60 * 1000));

    return {
      dealId,
      events,
      milestones,
      nextActions,
      averageStageTime,
      projectedCloseDate,
    };
  }

  /**
   * Generate revenue forecast based on pipeline data
   */
  async generateRevenueForecast(
    period: 'monthly' | 'quarterly' | 'yearly',
    startDate?: Date
  ): Promise<DealForecast> {
    await this.initializeClient();
    const supabase = createServerClient(cookies());

    const start = startDate || new Date();
    let endDate: Date;

    switch (period) {
      case 'monthly':
        endDate = new Date(start.getFullYear(), start.getMonth() + 1, 0);
        break;
      case 'quarterly':
        const quarterEnd = Math.ceil((start.getMonth() + 1) / 3) * 3;
        endDate = new Date(start.getFullYear(), quarterEnd, 0);
        break;
      case 'yearly':
        endDate = new Date(start.getFullYear(), 11, 31);
        break;
    }

    // Get all open deals
    const dealsResponse = await this.dealsService.getDeals({
      status: 'open',
      limit: 1000,
    });

    if (!dealsResponse.success) {
      throw new PipedriveSyncError('Failed to fetch deals for forecast');
    }

    const deals = dealsResponse.data.filter(deal => {
      const expectedClose = deal.expected_close_date ? new Date(deal.expected_close_date) : null;
      return expectedClose && expectedClose >= start && expectedClose <= endDate;
    });

    let totalValue = 0;
    let weightedValue = 0;
    const breakdown: ForecastBreakdown[] = [];

    // Get stages for breakdown
    const stagesResponse = await this.dealsService.getStages();
    const stages = stagesResponse.success ? stagesResponse.data : [];

    // Group deals by stage
    const dealsByStage = new Map<number, typeof deals>();
    for (const deal of deals) {
      if (!dealsByStage.has(deal.stage_id)) {
        dealsByStage.set(deal.stage_id, []);
      }
      dealsByStage.get(deal.stage_id)!.push(deal);
    }

    // Calculate breakdown by stage
    for (const stage of stages) {
      const stageDeals = dealsByStage.get(stage.id) || [];
      const stageValue = stageDeals.reduce((sum, deal) => sum + (deal.value || 0), 0);
      const probability = stage.deal_probability ? stage.deal_probability / 100 : 0.5;
      const stageWeightedValue = stageValue * probability;

      totalValue += stageValue;
      weightedValue += stageWeightedValue;

      breakdown.push({
        stageId: stage.id,
        stageName: stage.name,
        dealsCount: stageDeals.length,
        totalValue: stageValue,
        probability,
        weightedValue: stageWeightedValue,
      });
    }

    // Calculate forecast confidence based on historical accuracy
    const { data: historicalForecasts } = await supabase
      .from('pipedrive_forecast_history')
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .gte('period_end', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString())
      .order('period_end', { ascending: false })
      .limit(12);

    let confidence = 70; // Default confidence
    if (historicalForecasts && historicalForecasts.length > 0) {
      const accuracyScores = historicalForecasts.map(forecast => {
        const predicted = forecast.weighted_value || 0;
        const actual = forecast.actual_value || 0;
        return Math.max(0, 100 - Math.abs((predicted - actual) / Math.max(predicted, actual, 1)) * 100);
      });
      confidence = Math.round(accuracyScores.reduce((sum, score) => sum + score, 0) / accuracyScores.length);
    }

    // Store forecast for future accuracy tracking
    await supabase
      .from('pipedrive_forecast_history')
      .insert({
        workspace_id: this.workspaceId,
        period,
        period_start: start.toISOString(),
        period_end: endDate.toISOString(),
        total_value: totalValue,
        weighted_value: weightedValue,
        deals_count: deals.length,
        confidence,
        forecast_date: new Date().toISOString(),
        breakdown,
      });

    return {
      period,
      startDate: start,
      endDate,
      totalValue,
      weightedValue,
      dealsCount: deals.length,
      confidence,
      breakdown,
    };
  }

  /**
   * Initialize deal timeline when deal is created
   */
  private async initializeDealTimeline(dealId: number, leadId: string): Promise<void> {
    const supabase = createServerClient(cookies());

    // Create initial timeline entry
    await supabase
      .from('pipedrive_deal_timeline')
      .insert({
        workspace_id: this.workspaceId,
        deal_id: dealId,
        lead_id: leadId,
        event_type: 'deal_created',
        event_data: {
          title: 'Deal Created',
          description: 'Deal was created from ColdCopy lead',
        },
        created_at: new Date().toISOString(),
      });
  }

  /**
   * Get pipeline analytics and performance metrics
   */
  async getPipelineAnalytics(timeframe: '30d' | '90d' | '1y' = '90d'): Promise<PipelineAnalytics> {
    await this.initializeClient();
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

    // Get all deals in timeframe
    const { data: deals } = await supabase
      .from('pipedrive_deals')
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .gte('created_at', startDate.toISOString());

    // Get stage history for velocity analysis
    const { data: stageHistory } = await supabase
      .from('pipedrive_stage_history')
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .gte('changed_at', startDate.toISOString())
      .order('changed_at', { ascending: true });

    // Calculate metrics
    const totalValue = deals?.reduce((sum, deal) => sum + (deal.value || 0), 0) || 0;
    const wonDeals = deals?.filter(d => d.status === 'won') || [];
    const weightedValue = wonDeals.reduce((sum, deal) => sum + (deal.value || 0), 0);
    const averageDealSize = wonDeals.length > 0 ? weightedValue / wonDeals.length : 0;

    // Calculate conversion rates by stage
    const conversionRates: Record<number, number> = {};
    const stageVelocity: Record<number, number> = {};

    if (stageHistory) {
      // Group by stage
      const stageGroups = new Map<number, typeof stageHistory>();
      for (const history of stageHistory) {
        if (!stageGroups.has(history.stage_id)) {
          stageGroups.set(history.stage_id, []);
        }
        stageGroups.get(history.stage_id)!.push(history);
      }

      // Calculate conversion rates and velocity
      for (const [stageId, histories] of stageGroups) {
        const entered = histories.length;
        const progressed = histories.filter(h => {
          const nextStage = stageHistory.find(sh => 
            sh.deal_id === h.deal_id && 
            new Date(sh.changed_at) > new Date(h.changed_at)
          );
          return nextStage !== undefined;
        }).length;

        conversionRates[stageId] = entered > 0 ? progressed / entered : 0;

        // Calculate average time in stage
        const stageTimes = histories.map(h => {
          const nextChange = stageHistory.find(sh => 
            sh.deal_id === h.deal_id && 
            new Date(sh.changed_at) > new Date(h.changed_at)
          );
          if (nextChange) {
            return (new Date(nextChange.changed_at).getTime() - new Date(h.changed_at).getTime()) / (1000 * 60 * 60 * 24);
          }
          return null;
        }).filter(t => t !== null) as number[];

        stageVelocity[stageId] = stageTimes.length > 0 
          ? stageTimes.reduce((sum, time) => sum + time, 0) / stageTimes.length 
          : 14; // Default 14 days
      }
    }

    // Calculate average sales cycle
    const closedDeals = deals?.filter(d => d.status === 'won' || d.status === 'lost') || [];
    const avgSalesCycle = closedDeals.length > 0 
      ? closedDeals.reduce((sum, deal) => {
          const created = new Date(deal.created_at);
          const closed = new Date(deal.close_time || deal.updated_at);
          return sum + ((closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        }, 0) / closedDeals.length
      : 30; // Default 30 days

    // Placeholder for forecast accuracy (would need historical forecast data)
    const forecastAccuracy = 75;

    // Generate trends (simplified)
    const trends: PipelineTrend[] = [
      {
        period: timeframe,
        metric: 'Total Pipeline Value',
        value: totalValue,
        change: 0, // Would need historical comparison
        direction: 'stable',
      },
      {
        period: timeframe,
        metric: 'Average Deal Size',
        value: averageDealSize,
        change: 0,
        direction: 'stable',
      },
    ];

    return {
      totalValue,
      weightedValue,
      averageDealSize,
      averageSalesCycle: avgSalesCycle,
      conversionRates,
      stageVelocity,
      forecastAccuracy,
      trends,
    };
  }

  /**
   * Setup workflow triggers for pipeline automation
   */
  async setupWorkflowTriggers(triggers: WorkflowTrigger[]): Promise<void> {
    const supabase = createServerClient(cookies());

    for (const trigger of triggers) {
      await supabase
        .from('pipedrive_workflow_triggers')
        .upsert({
          id: trigger.id,
          workspace_id: this.workspaceId,
          name: trigger.name,
          stage_id: trigger.stageId,
          conditions: trigger.conditions,
          actions: trigger.actions,
          enabled: trigger.enabled,
        });
    }
  }

  /**
   * Execute workflow actions when triggers are met
   */
  async executeWorkflowActions(dealId: number, stageId: number): Promise<void> {
    const supabase = createServerClient(cookies());

    // Get active triggers for this stage
    const { data: triggers } = await supabase
      .from('pipedrive_workflow_triggers')
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .eq('stage_id', stageId)
      .eq('enabled', true);

    if (!triggers) return;

    // Get deal data for condition evaluation
    const dealResponse = await this.dealsService.getDeal(dealId);
    if (!dealResponse.success) return;

    const deal = dealResponse.data;

    for (const trigger of triggers) {
      // Evaluate conditions
      const conditionsMet = trigger.conditions.every((condition: WorkflowCondition) => {
        const fieldValue = (deal as any)[condition.field];
        
        switch (condition.operator) {
          case 'equals':
            return fieldValue === condition.value;
          case 'greater_than':
            return Number(fieldValue) > Number(condition.value);
          case 'less_than':
            return Number(fieldValue) < Number(condition.value);
          case 'contains':
            return String(fieldValue).includes(String(condition.value));
          case 'not_empty':
            return fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
          default:
            return false;
        }
      });

      if (conditionsMet) {
        // Execute actions
        for (const action of trigger.actions) {
          await this.executeWorkflowAction(dealId, action);
        }
      }
    }
  }

  /**
   * Execute individual workflow action
   */
  private async executeWorkflowAction(dealId: number, action: WorkflowAction): Promise<void> {
    const supabase = createServerClient(cookies());

    try {
      switch (action.type) {
        case 'create_activity':
          await this.client.post('/activities', {
            deal_id: dealId,
            subject: action.config.subject || 'Automated Follow-up',
            type: action.config.type || 'task',
            due_date: action.config.due_date || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            note: action.config.note,
          });
          break;

        case 'send_email':
          // Would integrate with your email system
          console.log(`Sending automated email for deal ${dealId}`);
          break;

        case 'update_deal':
          await this.dealsService.updateDeal(dealId, action.config);
          break;

        case 'create_notification':
          await supabase
            .from('notifications')
            .insert({
              workspace_id: this.workspaceId,
              type: 'deal_automation',
              title: action.config.title || 'Deal Update',
              message: action.config.message || `Automated action triggered for deal ${dealId}`,
              deal_id: dealId,
            });
          break;
      }

      // Log action execution
      await supabase
        .from('pipedrive_workflow_executions')
        .insert({
          workspace_id: this.workspaceId,
          deal_id: dealId,
          action_type: action.type,
          action_config: action.config,
          executed_at: new Date().toISOString(),
          status: 'completed',
        });

    } catch (error) {
      console.error(`Failed to execute workflow action ${action.type}:`, error);
      
      await supabase
        .from('pipedrive_workflow_executions')
        .insert({
          workspace_id: this.workspaceId,
          deal_id: dealId,
          action_type: action.type,
          action_config: action.config,
          executed_at: new Date().toISOString(),
          status: 'failed',
          error_message: (error as Error).message,
        });
    }
  }
}