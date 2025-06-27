import { PipedriveDealManager } from './deal-manager';
import { PipelineAnalyticsEngine } from './analytics-engine';
import { PipedriveClient } from './client';
import { PipedriveAuth } from './auth';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import {
  PipedriveDeal,
  PipedriveStage,
  PipedriveActivity,
  PipedriveSyncError,
} from './types';

interface DealHealthProfile {
  dealId: number;
  overallHealth: number;
  healthTrend: 'improving' | 'declining' | 'stable';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  predictedOutcome: DealOutcomePrediction;
  healthFactors: HealthFactor[];
  actionItems: ActionItem[];
  optimizations: OptimizationRecommendation[];
  benchmarkComparison: BenchmarkComparison;
  lastUpdated: Date;
}

interface DealOutcomePrediction {
  mostLikelyOutcome: 'win' | 'loss' | 'stall';
  winProbability: number;
  lossProbability: number;
  stallProbability: number;
  projectedCloseDate: Date;
  projectedValue: number;
  confidenceLevel: number;
  keyFactors: string[];
}

interface HealthFactor {
  category: 'engagement' | 'timeline' | 'qualification' | 'competition' | 'budget' | 'stakeholders';
  name: string;
  score: number;
  weight: number;
  trend: 'improving' | 'declining' | 'stable';
  impact: 'positive' | 'negative' | 'neutral';
  details: string;
  data: Record<string, any>;
}

interface ActionItem {
  id: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  category: 'communication' | 'qualification' | 'process' | 'follow_up' | 'closing';
  title: string;
  description: string;
  expectedImpact: string;
  effort: 'low' | 'medium' | 'high';
  dueDate: Date;
  assignedTo?: number;
  status: 'pending' | 'in_progress' | 'completed' | 'dismissed';
  dependencies?: string[];
}

interface OptimizationRecommendation {
  type: 'process' | 'content' | 'timing' | 'strategy' | 'resource';
  title: string;
  description: string;
  rationale: string;
  expectedOutcome: string;
  implementation: Implementation;
  metrics: string[];
  timeline: string;
  riskLevel: 'low' | 'medium' | 'high';
}

interface Implementation {
  steps: string[];
  resources: string[];
  tools: string[];
  stakeholders: string[];
  cost: 'low' | 'medium' | 'high';
  duration: string;
}

interface BenchmarkComparison {
  industry: string;
  company: string;
  stage: string;
  metrics: BenchmarkMetric[];
  positioning: 'above_average' | 'average' | 'below_average';
  percentile: number;
}

interface BenchmarkMetric {
  name: string;
  yourValue: number;
  benchmarkValue: number;
  unit: string;
  variance: number;
  interpretation: string;
}

interface DealRiskAssessment {
  dealId: number;
  overallRisk: number;
  riskFactors: RiskFactor[];
  mitigationStrategies: MitigationStrategy[];
  contingencyPlans: ContingencyPlan[];
  monitoringAlerts: MonitoringAlert[];
}

interface RiskFactor {
  id: string;
  type: 'timeline' | 'budget' | 'authority' | 'need' | 'competition' | 'technical' | 'economic';
  severity: 'low' | 'medium' | 'high' | 'critical';
  probability: number;
  impact: number;
  riskScore: number;
  description: string;
  indicators: string[];
  firstDetected: Date;
  trend: 'increasing' | 'stable' | 'decreasing';
}

interface MitigationStrategy {
  riskFactorId: string;
  strategy: string;
  actions: string[];
  timeline: string;
  responsibleParty: string;
  successCriteria: string[];
  cost: 'low' | 'medium' | 'high';
  effectiveness: number;
}

interface ContingencyPlan {
  scenario: string;
  triggers: string[];
  actions: string[];
  timeline: string;
  resources: string[];
  successMetrics: string[];
}

interface MonitoringAlert {
  metric: string;
  threshold: number;
  condition: 'greater_than' | 'less_than' | 'equals' | 'changed';
  severity: 'info' | 'warning' | 'critical';
  actions: string[];
  frequency: 'real_time' | 'daily' | 'weekly';
}

interface DealOptimizationPlan {
  dealId: number;
  currentState: DealStateSnapshot;
  targetState: DealStateSnapshot;
  optimizationActions: OptimizationAction[];
  timeline: OptimizationTimeline;
  expectedOutcomes: ExpectedOutcome[];
  resources: Resource[];
  risks: OptimizationRisk[];
}

interface DealStateSnapshot {
  healthScore: number;
  stage: string;
  velocity: number;
  engagement: number;
  qualification: number;
  competition: number;
  timeline: number;
}

interface OptimizationAction {
  id: string;
  phase: 'immediate' | 'short_term' | 'medium_term' | 'long_term';
  category: string;
  action: string;
  description: string;
  priority: number;
  effort: number;
  impact: number;
  dependencies: string[];
  assignee?: number;
  dueDate: Date;
}

interface OptimizationTimeline {
  phases: TimelinePhase[];
  milestones: Milestone[];
  checkpoints: Checkpoint[];
  totalDuration: number;
}

interface TimelinePhase {
  name: string;
  startDate: Date;
  endDate: Date;
  actions: string[];
  deliverables: string[];
  successCriteria: string[];
}

interface Milestone {
  name: string;
  date: Date;
  criteria: string[];
  importance: 'low' | 'medium' | 'high' | 'critical';
}

interface Checkpoint {
  date: Date;
  metrics: string[];
  thresholds: Record<string, number>;
  actions: string[];
}

interface ExpectedOutcome {
  metric: string;
  currentValue: number;
  targetValue: number;
  improvement: number;
  confidence: number;
  timeframe: string;
}

interface Resource {
  type: 'personnel' | 'tools' | 'content' | 'budget' | 'training';
  name: string;
  description: string;
  cost: number;
  availability: 'available' | 'limited' | 'unavailable';
  alternatives?: string[];
}

interface OptimizationRisk {
  description: string;
  probability: number;
  impact: number;
  mitigation: string;
  contingency: string;
}

export class DealHealthOptimizer {
  private dealManager: PipedriveDealManager;
  private analyticsEngine: PipelineAnalyticsEngine;
  private client: PipedriveClient;
  private auth: PipedriveAuth;
  private workspaceId: string;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
    this.auth = new PipedriveAuth();
    this.dealManager = new PipedriveDealManager(workspaceId);
    this.analyticsEngine = new PipelineAnalyticsEngine(workspaceId);
  }

  private async initializeClient(): Promise<void> {
    if (!this.client) {
      const accessToken = await this.auth.getValidAccessToken(this.workspaceId);
      const integration = await this.auth.getIntegration(this.workspaceId);
      this.client = new PipedriveClient(accessToken, integration?.companyDomain);
    }
  }

  /**
   * Generate comprehensive deal health profile
   */
  async generateDealHealthProfile(dealId: number): Promise<DealHealthProfile> {
    await this.initializeClient();
    const supabase = createServerClient(cookies());

    // Get base health score
    const baseHealthScore = await this.dealManager.getDealHealthScore(dealId);

    // Get deal data
    const dealResponse = await this.dealManager.getDeal(dealId);
    if (!dealResponse.success) {
      throw new PipedriveSyncError('Deal not found');
    }
    const deal = dealResponse.data;

    // Calculate detailed health factors
    const healthFactors = await this.calculateDetailedHealthFactors(dealId, deal);

    // Calculate overall health with weighted factors
    const overallHealth = this.calculateWeightedHealth(healthFactors);

    // Determine health trend
    const healthTrend = await this.calculateHealthTrend(dealId);

    // Assess risk level
    const riskLevel = this.assessRiskLevel(overallHealth, healthFactors);

    // Generate outcome prediction
    const predictedOutcome = await this.generateOutcomePrediction(dealId, deal, healthFactors);

    // Generate action items
    const actionItems = await this.generateActionItems(dealId, deal, healthFactors);

    // Generate optimization recommendations
    const optimizations = await this.generateOptimizationRecommendations(dealId, deal, healthFactors);

    // Generate benchmark comparison
    const benchmarkComparison = await this.generateBenchmarkComparison(deal, healthFactors);

    return {
      dealId,
      overallHealth,
      healthTrend,
      riskLevel,
      predictedOutcome,
      healthFactors,
      actionItems,
      optimizations,
      benchmarkComparison,
      lastUpdated: new Date(),
    };
  }

  /**
   * Calculate detailed health factors
   */
  private async calculateDetailedHealthFactors(dealId: number, deal: PipedriveDeal): Promise<HealthFactor[]> {
    const supabase = createServerClient(cookies());
    const factors: HealthFactor[] = [];

    // Engagement factor
    const engagementScore = await this.calculateEngagementScore(dealId);
    factors.push({
      category: 'engagement',
      name: 'Prospect Engagement',
      score: engagementScore.score,
      weight: 0.25,
      trend: engagementScore.trend,
      impact: engagementScore.score > 70 ? 'positive' : engagementScore.score < 30 ? 'negative' : 'neutral',
      details: `Based on email opens (${engagementScore.data.opens}), clicks (${engagementScore.data.clicks}), and replies (${engagementScore.data.replies})`,
      data: engagementScore.data,
    });

    // Timeline factor
    const timelineScore = await this.calculateTimelineScore(dealId, deal);
    factors.push({
      category: 'timeline',
      name: 'Timeline Progress',
      score: timelineScore.score,
      weight: 0.2,
      trend: timelineScore.trend,
      impact: timelineScore.score > 70 ? 'positive' : timelineScore.score < 30 ? 'negative' : 'neutral',
      details: `Deal has been in current stage for ${timelineScore.data.daysInStage} days (avg: ${timelineScore.data.avgStageTime} days)`,
      data: timelineScore.data,
    });

    // Qualification factor
    const qualificationScore = await this.calculateQualificationScore(deal);
    factors.push({
      category: 'qualification',
      name: 'Deal Qualification',
      score: qualificationScore.score,
      weight: 0.2,
      trend: 'stable', // Qualification doesn't typically change much
      impact: qualificationScore.score > 70 ? 'positive' : qualificationScore.score < 50 ? 'negative' : 'neutral',
      details: `${qualificationScore.data.completedFields}/${qualificationScore.data.totalFields} qualification fields completed`,
      data: qualificationScore.data,
    });

    // Competition factor
    const competitionScore = await this.calculateCompetitionScore(dealId, deal);
    factors.push({
      category: 'competition',
      name: 'Competitive Position',
      score: competitionScore.score,
      weight: 0.15,
      trend: competitionScore.trend,
      impact: competitionScore.score > 70 ? 'positive' : competitionScore.score < 40 ? 'negative' : 'neutral',
      details: competitionScore.data.analysis,
      data: competitionScore.data,
    });

    // Budget factor
    const budgetScore = await this.calculateBudgetScore(deal);
    factors.push({
      category: 'budget',
      name: 'Budget Alignment',
      score: budgetScore.score,
      weight: 0.1,
      trend: 'stable',
      impact: budgetScore.score > 70 ? 'positive' : budgetScore.score < 50 ? 'negative' : 'neutral',
      details: budgetScore.data.analysis,
      data: budgetScore.data,
    });

    // Stakeholders factor
    const stakeholdersScore = await this.calculateStakeholdersScore(dealId, deal);
    factors.push({
      category: 'stakeholders',
      name: 'Stakeholder Engagement',
      score: stakeholdersScore.score,
      weight: 0.1,
      trend: stakeholdersScore.trend,
      impact: stakeholdersScore.score > 70 ? 'positive' : stakeholdersScore.score < 40 ? 'negative' : 'neutral',
      details: stakeholdersScore.data.analysis,
      data: stakeholdersScore.data,
    });

    return factors;
  }

  /**
   * Calculate engagement score
   */
  private async calculateEngagementScore(dealId: number): Promise<{ score: number; trend: 'improving' | 'declining' | 'stable'; data: any }> {
    const supabase = createServerClient(cookies());

    // Get email events for this deal
    const { data: recentEvents } = await supabase
      .from('email_events')
      .select('event_type, created_at')
      .eq('workspace_id', this.workspaceId)
      .eq('deal_id', dealId)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
      .order('created_at', { ascending: false });

    const events = recentEvents || [];
    const opens = events.filter(e => e.event_type === 'open').length;
    const clicks = events.filter(e => e.event_type === 'click').length;
    const replies = events.filter(e => e.event_type === 'reply').length;

    // Calculate engagement score
    let score = 0;
    if (events.length > 0) {
      score = Math.min(100, (opens * 2 + clicks * 5 + replies * 10) / Math.max(1, events.length / 5));
    }

    // Calculate trend by comparing with previous 30 days
    const { data: previousEvents } = await supabase
      .from('email_events')
      .select('event_type')
      .eq('workspace_id', this.workspaceId)
      .eq('deal_id', dealId)
      .gte('created_at', new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString())
      .lt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    const prevEvents = previousEvents || [];
    const prevOpens = prevEvents.filter(e => e.event_type === 'open').length;
    const prevClicks = prevEvents.filter(e => e.event_type === 'click').length;
    const prevReplies = prevEvents.filter(e => e.event_type === 'reply').length;

    const prevScore = prevEvents.length > 0 
      ? Math.min(100, (prevOpens * 2 + prevClicks * 5 + prevReplies * 10) / Math.max(1, prevEvents.length / 5))
      : 0;

    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (score > prevScore * 1.1) trend = 'improving';
    else if (score < prevScore * 0.9) trend = 'declining';

    return {
      score: Math.round(score),
      trend,
      data: {
        opens,
        clicks,
        replies,
        totalEvents: events.length,
        recentScore: score,
        previousScore: prevScore,
      },
    };
  }

  /**
   * Calculate timeline score
   */
  private async calculateTimelineScore(dealId: number, deal: PipedriveDeal): Promise<{ score: number; trend: 'improving' | 'declining' | 'stable'; data: any }> {
    const supabase = createServerClient(cookies());

    // Get stage history
    const { data: stageHistory } = await supabase
      .from('pipedrive_stage_history')
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .eq('deal_id', dealId)
      .order('changed_at', { ascending: true });

    // Calculate days in current stage
    const lastStageChange = stageHistory && stageHistory.length > 0 
      ? new Date(stageHistory[stageHistory.length - 1].changed_at)
      : new Date(deal.add_time);
    
    const daysInStage = (Date.now() - lastStageChange.getTime()) / (1000 * 60 * 60 * 24);

    // Get average stage time for comparison
    const analytics = await this.analyticsEngine.getPipelineAnalytics('90d');
    const avgStageTime = analytics.stageVelocity[deal.stage_id] || 14;

    // Calculate score based on stage velocity
    let score = 100;
    if (daysInStage > avgStageTime * 2) score = 20;
    else if (daysInStage > avgStageTime * 1.5) score = 40;
    else if (daysInStage > avgStageTime) score = 70;
    else score = 90;

    // Determine trend
    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (daysInStage > avgStageTime * 1.5) trend = 'declining';
    else if (daysInStage < avgStageTime * 0.5) trend = 'improving';

    return {
      score,
      trend,
      data: {
        daysInStage: Math.round(daysInStage),
        avgStageTime: Math.round(avgStageTime),
        stageChanges: stageHistory?.length || 0,
        velocity: daysInStage / avgStageTime,
      },
    };
  }

  /**
   * Calculate qualification score
   */
  private async calculateQualificationScore(deal: PipedriveDeal): Promise<{ score: number; data: any }> {
    const requiredFields = ['person_id', 'org_id', 'value', 'expected_close_date'];
    const optionalFields = ['probability', 'custom_fields'];

    let completedFields = 0;
    let totalFields = requiredFields.length;

    // Check required fields
    for (const field of requiredFields) {
      if ((deal as any)[field] !== null && (deal as any)[field] !== undefined) {
        completedFields++;
      }
    }

    // Check optional fields (weighted less)
    for (const field of optionalFields) {
      totalFields += 0.5;
      if ((deal as any)[field] !== null && (deal as any)[field] !== undefined) {
        completedFields += 0.5;
      }
    }

    const score = Math.round((completedFields / totalFields) * 100);

    return {
      score,
      data: {
        completedFields: Math.round(completedFields),
        totalFields: Math.round(totalFields),
        missingFields: requiredFields.filter(field => !(deal as any)[field]),
        completionRate: completedFields / totalFields,
      },
    };
  }

  /**
   * Calculate competition score
   */
  private async calculateCompetitionScore(dealId: number, deal: PipedriveDeal): Promise<{ score: number; trend: 'improving' | 'declining' | 'stable'; data: any }> {
    // This is a simplified implementation
    // In a real scenario, you'd analyze notes, activities, and custom fields for competitive intelligence
    
    let score = 70; // Default neutral score
    let competitorCount = 0;
    let competitiveStrength = 'unknown';

    // Analyze deal notes and activities for competitor mentions
    const competitorKeywords = ['competitor', 'alternative', 'comparison', 'versus', 'vs'];
    
    // Get deal notes/activities (simplified)
    // In reality, you'd search through notes and activities for competitive intelligence
    
    const analysis = `Competitive analysis based on deal value ($${deal.value || 0}) and stage progression`;

    return {
      score,
      trend: 'stable',
      data: {
        competitorCount,
        competitiveStrength,
        analysis,
        riskLevel: score > 70 ? 'low' : score > 40 ? 'medium' : 'high',
      },
    };
  }

  /**
   * Calculate budget score
   */
  private async calculateBudgetScore(deal: PipedriveDeal): Promise<{ score: number; data: any }> {
    let score = 50; // Default neutral score

    // Factors that influence budget score
    if (deal.value && deal.value > 0) {
      score += 30; // Has defined budget
    }

    // Additional budget qualification would come from custom fields or notes
    // This is a simplified implementation

    const analysis = deal.value 
      ? `Budget of $${deal.value.toLocaleString()} is defined`
      : 'Budget not yet qualified';

    return {
      score,
      data: {
        budgetDefined: !!deal.value,
        budgetAmount: deal.value || 0,
        analysis,
        qualificationLevel: score > 70 ? 'high' : score > 40 ? 'medium' : 'low',
      },
    };
  }

  /**
   * Calculate stakeholders score
   */
  private async calculateStakeholdersScore(dealId: number, deal: PipedriveDeal): Promise<{ score: number; trend: 'improving' | 'declining' | 'stable'; data: any }> {
    let score = 40; // Default low score

    // Check if decision maker is identified
    if (deal.person_id) {
      score += 30;
    }

    // Check if organization is identified
    if (deal.org_id) {
      score += 20;
    }

    // Additional stakeholder analysis would come from activities and notes
    // This is a simplified implementation

    const stakeholderCount = (deal.person_id ? 1 : 0) + (deal.org_id ? 1 : 0);
    const analysis = `${stakeholderCount} stakeholder${stakeholderCount !== 1 ? 's' : ''} identified`;

    return {
      score,
      trend: 'stable',
      data: {
        stakeholderCount,
        decisionMakerIdentified: !!deal.person_id,
        organizationIdentified: !!deal.org_id,
        analysis,
        engagementLevel: score > 70 ? 'high' : score > 40 ? 'medium' : 'low',
      },
    };
  }

  /**
   * Calculate weighted health score
   */
  private calculateWeightedHealth(factors: HealthFactor[]): number {
    let totalScore = 0;
    let totalWeight = 0;

    for (const factor of factors) {
      totalScore += factor.score * factor.weight;
      totalWeight += factor.weight;
    }

    return totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
  }

  /**
   * Calculate health trend
   */
  private async calculateHealthTrend(dealId: number): Promise<'improving' | 'declining' | 'stable'> {
    const supabase = createServerClient(cookies());

    // Get historical health scores (if stored)
    const { data: healthHistory } = await supabase
      .from('pipedrive_deal_health_history')
      .select('health_score, created_at')
      .eq('workspace_id', this.workspaceId)
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (!healthHistory || healthHistory.length < 2) {
      return 'stable';
    }

    const recent = healthHistory[0].health_score;
    const previous = healthHistory[1].health_score;

    if (recent > previous * 1.1) return 'improving';
    if (recent < previous * 0.9) return 'declining';
    return 'stable';
  }

  /**
   * Assess risk level
   */
  private assessRiskLevel(overallHealth: number, factors: HealthFactor[]): 'low' | 'medium' | 'high' | 'critical' {
    // Check for critical factors
    const criticalFactors = factors.filter(f => f.score < 30 && f.weight > 0.15);
    if (criticalFactors.length > 0 || overallHealth < 30) {
      return 'critical';
    }

    if (overallHealth < 50) return 'high';
    if (overallHealth < 70) return 'medium';
    return 'low';
  }

  /**
   * Generate outcome prediction
   */
  private async generateOutcomePrediction(dealId: number, deal: PipedriveDeal, factors: HealthFactor[]): Promise<DealOutcomePrediction> {
    const overallHealth = this.calculateWeightedHealth(factors);
    
    // Simple prediction model based on health score
    let winProbability = Math.max(0.1, Math.min(0.9, overallHealth / 100));
    let lossProbability = Math.max(0.05, Math.min(0.4, (100 - overallHealth) / 200));
    let stallProbability = 1 - winProbability - lossProbability;

    // Adjust based on specific factors
    const timelineFactor = factors.find(f => f.category === 'timeline');
    if (timelineFactor && timelineFactor.score < 40) {
      stallProbability += 0.2;
      winProbability -= 0.1;
    }

    const engagementFactor = factors.find(f => f.category === 'engagement');
    if (engagementFactor && engagementFactor.score < 30) {
      lossProbability += 0.15;
      winProbability -= 0.1;
    }

    // Normalize probabilities
    const total = winProbability + lossProbability + stallProbability;
    winProbability /= total;
    lossProbability /= total;
    stallProbability /= total;

    const mostLikelyOutcome = winProbability > 0.5 ? 'win' : stallProbability > lossProbability ? 'stall' : 'loss';

    // Project close date based on stage velocity
    const timeline = await this.dealManager.getDealTimeline(dealId);
    const projectedCloseDate = timeline.projectedCloseDate;

    // Project value (could be adjusted based on health)
    const projectedValue = deal.value || 0;

    // Confidence based on data quality
    const dataQuality = factors.reduce((sum, f) => sum + (f.data ? 1 : 0), 0) / factors.length;
    const confidenceLevel = Math.round(dataQuality * 85 + 15);

    const keyFactors = factors
      .filter(f => f.weight > 0.15 && (f.score < 40 || f.score > 80))
      .map(f => `${f.name}: ${f.score}`)
      .slice(0, 3);

    return {
      mostLikelyOutcome,
      winProbability: Math.round(winProbability * 100) / 100,
      lossProbability: Math.round(lossProbability * 100) / 100,
      stallProbability: Math.round(stallProbability * 100) / 100,
      projectedCloseDate,
      projectedValue,
      confidenceLevel,
      keyFactors,
    };
  }

  /**
   * Generate action items
   */
  private async generateActionItems(dealId: number, deal: PipedriveDeal, factors: HealthFactor[]): Promise<ActionItem[]> {
    const actionItems: ActionItem[] = [];

    // Generate actions based on low-scoring factors
    for (const factor of factors) {
      if (factor.score < 50) {
        const actionItem = this.generateActionItemForFactor(factor, deal);
        if (actionItem) {
          actionItems.push(actionItem);
        }
      }
    }

    // Sort by priority and impact
    actionItems.sort((a, b) => {
      const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    return actionItems.slice(0, 5); // Return top 5 actions
  }

  /**
   * Generate action item for specific factor
   */
  private generateActionItemForFactor(factor: HealthFactor, deal: PipedriveDeal): ActionItem | null {
    const actionId = `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const baseDate = new Date();

    switch (factor.category) {
      case 'engagement':
        if (factor.score < 30) {
          return {
            id: actionId,
            priority: 'high',
            category: 'communication',
            title: 'Increase Prospect Engagement',
            description: 'Low engagement indicates prospect may be losing interest. Schedule a call or send personalized content.',
            expectedImpact: 'Improve engagement score by 20-30 points',
            effort: 'medium',
            dueDate: new Date(baseDate.getTime() + 2 * 24 * 60 * 60 * 1000), // 2 days
            status: 'pending',
          };
        }
        break;

      case 'timeline':
        if (factor.score < 40) {
          return {
            id: actionId,
            priority: 'high',
            category: 'process',
            title: 'Accelerate Deal Progress',
            description: 'Deal has been stagnant. Identify blockers and create urgency.',
            expectedImpact: 'Move deal to next stage within 1 week',
            effort: 'medium',
            dueDate: new Date(baseDate.getTime() + 3 * 24 * 60 * 60 * 1000), // 3 days
            status: 'pending',
          };
        }
        break;

      case 'qualification':
        if (factor.score < 60) {
          return {
            id: actionId,
            priority: 'medium',
            category: 'qualification',
            title: 'Complete Deal Qualification',
            description: 'Missing key qualification information. Complete BANT/MEDDIC qualification.',
            expectedImpact: 'Improve deal predictability and close rate',
            effort: 'low',
            dueDate: new Date(baseDate.getTime() + 5 * 24 * 60 * 60 * 1000), // 5 days
            status: 'pending',
          };
        }
        break;

      case 'competition':
        if (factor.score < 50) {
          return {
            id: actionId,
            priority: 'medium',
            category: 'strategy',
            title: 'Strengthen Competitive Position',
            description: 'Address competitive threats and reinforce value proposition.',
            expectedImpact: 'Improve win probability by 15-25%',
            effort: 'high',
            dueDate: new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000), // 1 week
            status: 'pending',
          };
        }
        break;

      default:
        return null;
    }

    return null;
  }

  /**
   * Generate optimization recommendations
   */
  private async generateOptimizationRecommendations(dealId: number, deal: PipedriveDeal, factors: HealthFactor[]): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];

    // Analyze overall health and generate recommendations
    const overallHealth = this.calculateWeightedHealth(factors);

    if (overallHealth < 50) {
      recommendations.push({
        type: 'strategy',
        title: 'Deal Recovery Strategy',
        description: 'Implement comprehensive deal recovery plan to address multiple risk factors.',
        rationale: 'Low overall health score indicates need for immediate intervention.',
        expectedOutcome: 'Improve health score by 25-40 points and increase win probability',
        implementation: {
          steps: [
            'Conduct stakeholder analysis',
            'Schedule executive alignment call',
            'Create value realization plan',
            'Address competitive concerns',
            'Establish clear next steps',
          ],
          resources: ['Senior sales rep', 'Solution consultant', 'Executive sponsor'],
          tools: ['CRM', 'Presentation software', 'ROI calculator'],
          stakeholders: ['Deal owner', 'Sales manager', 'Customer champion'],
          cost: 'medium',
          duration: '2-3 weeks',
        },
        metrics: ['Health score', 'Engagement level', 'Stage progression'],
        timeline: '2-3 weeks',
        riskLevel: 'low',
      });
    }

    // Factor-specific recommendations
    const lowEngagement = factors.find(f => f.category === 'engagement' && f.score < 40);
    if (lowEngagement) {
      recommendations.push({
        type: 'content',
        title: 'Engagement Revival Campaign',
        description: 'Deploy targeted content and personalized outreach to re-engage prospect.',
        rationale: 'Low engagement suggests prospect interest is waning.',
        expectedOutcome: 'Increase engagement by 30-50% within 2 weeks',
        implementation: {
          steps: [
            'Analyze prospect interests and pain points',
            'Create personalized content assets',
            'Design multi-touch engagement sequence',
            'Implement tracking and optimization',
          ],
          resources: ['Marketing support', 'Content library', 'Sales rep time'],
          tools: ['Email platform', 'Content management', 'Analytics'],
          stakeholders: ['Sales rep', 'Marketing team'],
          cost: 'low',
          duration: '1-2 weeks',
        },
        metrics: ['Email open rates', 'Content engagement', 'Response rates'],
        timeline: '1-2 weeks',
        riskLevel: 'low',
      });
    }

    return recommendations;
  }

  /**
   * Generate benchmark comparison
   */
  private async generateBenchmarkComparison(deal: PipedriveDeal, factors: HealthFactor[]): Promise<BenchmarkComparison> {
    // This would typically compare against industry benchmarks
    // For now, we'll use simplified internal benchmarks

    const overallHealth = this.calculateWeightedHealth(factors);
    const industryAverage = 65; // Example industry average
    
    const metrics: BenchmarkMetric[] = [
      {
        name: 'Overall Health Score',
        yourValue: overallHealth,
        benchmarkValue: industryAverage,
        unit: 'points',
        variance: ((overallHealth - industryAverage) / industryAverage) * 100,
        interpretation: overallHealth > industryAverage ? 'Above industry average' : 'Below industry average',
      },
      {
        name: 'Deal Value',
        yourValue: deal.value || 0,
        benchmarkValue: 15000, // Example benchmark
        unit: 'USD',
        variance: ((deal.value || 0) - 15000) / 15000 * 100,
        interpretation: (deal.value || 0) > 15000 ? 'Above average deal size' : 'Below average deal size',
      },
    ];

    const positioning: 'above_average' | 'average' | 'below_average' = 
      overallHealth > industryAverage * 1.1 ? 'above_average' :
      overallHealth < industryAverage * 0.9 ? 'below_average' : 'average';

    const percentile = Math.min(95, Math.max(5, Math.round(overallHealth)));

    return {
      industry: 'Technology', // Would be dynamic based on deal data
      company: 'Similar sized companies',
      stage: `Stage ${deal.stage_id}`,
      metrics,
      positioning,
      percentile,
    };
  }

  /**
   * Store health profile for historical tracking
   */
  async storeHealthProfile(profile: DealHealthProfile): Promise<void> {
    const supabase = createServerClient(cookies());

    const { error } = await supabase
      .from('pipedrive_deal_health_history')
      .insert({
        workspace_id: this.workspaceId,
        deal_id: profile.dealId,
        health_score: profile.overallHealth,
        health_trend: profile.healthTrend,
        risk_level: profile.riskLevel,
        predicted_outcome: profile.predictedOutcome.mostLikelyOutcome,
        win_probability: profile.predictedOutcome.winProbability,
        factors: profile.healthFactors,
        action_items: profile.actionItems,
        optimizations: profile.optimizations,
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Failed to store health profile:', error);
    }
  }

  /**
   * Get health profile history
   */
  async getHealthProfileHistory(dealId: number, limit: number = 10): Promise<any[]> {
    const supabase = createServerClient(cookies());

    const { data, error } = await supabase
      .from('pipedrive_deal_health_history')
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new PipedriveSyncError(`Failed to get health history: ${error.message}`);
    }

    return data || [];
  }
}