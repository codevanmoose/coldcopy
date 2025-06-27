import { PipedriveDealManager } from './deal-manager';
import { PipedriveClient } from './client';
import { PipedriveAuth } from './auth';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import {
  PipedriveDeal,
  PipedriveStage,
  PipedrivePipeline,
  PipedriveSyncError,
} from './types';

interface PipelineMetrics {
  totalDeals: number;
  totalValue: number;
  weightedValue: number;
  averageDealSize: number;
  averageSalesCycle: number;
  winRate: number;
  velocityByStage: Record<number, number>;
  conversionRates: Record<number, number>;
  lossReasons: Record<string, number>;
  dealsByStage: Record<number, DealStageMetrics>;
  monthlyTrends: MonthlyTrend[];
}

interface DealStageMetrics {
  stageId: number;
  stageName: string;
  dealsCount: number;
  totalValue: number;
  averageValue: number;
  averageTimeInStage: number;
  conversionRate: number;
  bottleneckRisk: 'low' | 'medium' | 'high';
}

interface MonthlyTrend {
  month: string;
  dealsCreated: number;
  dealsWon: number;
  dealsLost: number;
  totalValue: number;
  averageDealSize: number;
  winRate: number;
}

interface RevenueForecast {
  period: string;
  forecastType: 'conservative' | 'realistic' | 'optimistic';
  totalPipeline: number;
  weightedPipeline: number;
  projectedRevenue: number;
  confidence: number;
  breakdown: ForecastBreakdown[];
  assumptions: ForecastAssumption[];
  risks: ForecastRisk[];
}

interface ForecastBreakdown {
  category: string;
  deals: number;
  value: number;
  probability: number;
  weightedValue: number;
}

interface ForecastAssumption {
  type: 'historical' | 'seasonal' | 'market' | 'team';
  description: string;
  impact: number;
  confidence: number;
}

interface ForecastRisk {
  category: 'market' | 'competition' | 'team' | 'product' | 'economic';
  description: string;
  probability: number;
  impact: number;
  mitigation: string;
}

interface DealHealthMetrics {
  dealId: number;
  healthScore: number;
  riskFactors: RiskFactor[];
  opportunities: Opportunity[];
  nextBestActions: NextAction[];
  predictedOutcome: 'win' | 'loss' | 'stall';
  predictedCloseDate: Date;
  confidenceLevel: number;
}

interface RiskFactor {
  type: 'timeline' | 'engagement' | 'competition' | 'budget' | 'decision_maker';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: number;
  likelihood: number;
}

interface Opportunity {
  type: 'upsell' | 'cross_sell' | 'acceleration' | 'expansion';
  description: string;
  potential: number;
  effort: 'low' | 'medium' | 'high';
  timeline: string;
}

interface NextAction {
  priority: 'low' | 'medium' | 'high' | 'urgent';
  action: string;
  description: string;
  expectedImpact: string;
  timeframe: string;
}

interface TeamPerformance {
  userId: number;
  userName: string;
  dealsOwned: number;
  dealsWon: number;
  dealsLost: number;
  totalValue: number;
  winRate: number;
  averageDealSize: number;
  averageSalesCycle: number;
  activitiesCompleted: number;
  responseTime: number;
  score: number;
  ranking: number;
  strengths: string[];
  improvements: string[];
}

interface PipelineRecommendation {
  type: 'process' | 'training' | 'automation' | 'resource' | 'strategy';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  expectedImpact: string;
  effortRequired: 'low' | 'medium' | 'high';
  timeline: string;
  kpi: string;
  targetImprovement: string;
}

export class PipelineAnalyticsEngine {
  private dealManager: PipedriveDealManager;
  private client: PipedriveClient;
  private auth: PipedriveAuth;
  private workspaceId: string;

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
   * Generate comprehensive pipeline metrics
   */
  async generatePipelineMetrics(timeframe: '30d' | '90d' | '1y' = '90d'): Promise<PipelineMetrics> {
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
      .gte('add_time', startDate.toISOString());

    if (!deals) {
      throw new PipedriveSyncError('Failed to fetch deals for metrics');
    }

    // Get stages for analysis
    const stagesResponse = await this.dealManager.getStages();
    const stages = stagesResponse.success ? stagesResponse.data : [];

    // Basic metrics
    const totalDeals = deals.length;
    const totalValue = deals.reduce((sum, deal) => sum + (deal.value || 0), 0);
    
    const wonDeals = deals.filter(d => d.status === 'won');
    const lostDeals = deals.filter(d => d.status === 'lost');
    const openDeals = deals.filter(d => d.status === 'open');

    const weightedValue = wonDeals.reduce((sum, deal) => sum + (deal.value || 0), 0);
    const averageDealSize = wonDeals.length > 0 ? weightedValue / wonDeals.length : 0;
    const winRate = totalDeals > 0 ? wonDeals.length / (wonDeals.length + lostDeals.length) : 0;

    // Calculate average sales cycle
    const closedDeals = [...wonDeals, ...lostDeals];
    const averageSalesCycle = closedDeals.length > 0 
      ? closedDeals.reduce((sum, deal) => {
          const created = new Date(deal.add_time);
          const closed = new Date(deal.close_time || deal.won_time || deal.lost_time || deal.update_time);
          return sum + ((closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        }, 0) / closedDeals.length
      : 0;

    // Get stage history for velocity and conversion analysis
    const { data: stageHistory } = await supabase
      .from('pipedrive_stage_history')
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .gte('changed_at', startDate.toISOString())
      .order('changed_at', { ascending: true });

    // Calculate velocity by stage
    const velocityByStage: Record<number, number> = {};
    const conversionRates: Record<number, number> = {};
    
    if (stageHistory) {
      // Group by deal and calculate time in each stage
      const dealStageData = new Map<number, any[]>();
      for (const history of stageHistory) {
        if (!dealStageData.has(history.deal_id)) {
          dealStageData.set(history.deal_id, []);
        }
        dealStageData.get(history.deal_id)!.push(history);
      }

      // Calculate metrics for each stage
      for (const stage of stages) {
        const stageEntries: number[] = [];
        const stageProgression: number[] = [];

        for (const [dealId, dealHistory] of dealStageData) {
          dealHistory.sort((a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime());
          
          const stageEntry = dealHistory.find(h => h.stage_id === stage.id);
          if (stageEntry) {
            stageEntries.push(dealId);
            
            // Find when deal moved to next stage
            const entryIndex = dealHistory.indexOf(stageEntry);
            if (entryIndex < dealHistory.length - 1) {
              const nextStage = dealHistory[entryIndex + 1];
              const timeInStage = (new Date(nextStage.changed_at).getTime() - new Date(stageEntry.changed_at).getTime()) / (1000 * 60 * 60 * 24);
              stageProgression.push(timeInStage);
            }
          }
        }

        // Calculate average velocity (time in stage)
        velocityByStage[stage.id] = stageProgression.length > 0 
          ? stageProgression.reduce((sum, time) => sum + time, 0) / stageProgression.length 
          : 0;

        // Calculate conversion rate (progressed / entered)
        conversionRates[stage.id] = stageEntries.length > 0 
          ? stageProgression.length / stageEntries.length 
          : 0;
      }
    }

    // Analyze loss reasons
    const lossReasons: Record<string, number> = {};
    for (const deal of lostDeals) {
      const reason = deal.lost_reason || 'Unknown';
      lossReasons[reason] = (lossReasons[reason] || 0) + 1;
    }

    // Build deals by stage metrics
    const dealsByStage: Record<number, DealStageMetrics> = {};
    for (const stage of stages) {
      const stageDeals = openDeals.filter(d => d.stage_id === stage.id);
      const stageValue = stageDeals.reduce((sum, deal) => sum + (deal.value || 0), 0);
      
      dealsByStage[stage.id] = {
        stageId: stage.id,
        stageName: stage.name,
        dealsCount: stageDeals.length,
        totalValue: stageValue,
        averageValue: stageDeals.length > 0 ? stageValue / stageDeals.length : 0,
        averageTimeInStage: velocityByStage[stage.id] || 0,
        conversionRate: conversionRates[stage.id] || 0,
        bottleneckRisk: this.assessBottleneckRisk(velocityByStage[stage.id], conversionRates[stage.id]),
      };
    }

    // Generate monthly trends
    const monthlyTrends = await this.generateMonthlyTrends(startDate);

    return {
      totalDeals,
      totalValue,
      weightedValue,
      averageDealSize,
      averageSalesCycle,
      winRate,
      velocityByStage,
      conversionRates,
      lossReasons,
      dealsByStage,
      monthlyTrends,
    };
  }

  /**
   * Generate advanced revenue forecast
   */
  async generateAdvancedForecast(
    period: 'monthly' | 'quarterly' | 'yearly',
    forecastType: 'conservative' | 'realistic' | 'optimistic' = 'realistic'
  ): Promise<RevenueForecast> {
    await this.initializeClient();
    const supabase = createServerClient(cookies());

    const now = new Date();
    let endDate: Date;
    let periodLabel: string;

    switch (period) {
      case 'monthly':
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        periodLabel = `${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`;
        break;
      case 'quarterly':
        const quarter = Math.ceil((now.getMonth() + 1) / 3);
        endDate = new Date(now.getFullYear(), quarter * 3, 0);
        periodLabel = `Q${quarter} ${now.getFullYear()}`;
        break;
      case 'yearly':
        endDate = new Date(now.getFullYear(), 11, 31);
        periodLabel = now.getFullYear().toString();
        break;
    }

    // Get open deals expected to close in period
    const { data: forecastDeals } = await supabase
      .from('pipedrive_deals')
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .eq('status', 'open')
      .lte('expected_close_date', endDate.toISOString())
      .gte('expected_close_date', now.toISOString());

    if (!forecastDeals) {
      throw new PipedriveSyncError('Failed to fetch forecast deals');
    }

    // Get historical performance for confidence calculation
    const { data: historicalDeals } = await supabase
      .from('pipedrive_deals')
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .in('status', ['won', 'lost'])
      .gte('close_time', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString());

    // Calculate historical win rates by stage
    const historicalWinRates = this.calculateHistoricalWinRates(historicalDeals || []);

    // Get stages for breakdown
    const stagesResponse = await this.dealManager.getStages();
    const stages = stagesResponse.success ? stagesResponse.data : [];

    // Calculate base forecast
    const totalPipeline = forecastDeals.reduce((sum, deal) => sum + (deal.value || 0), 0);
    let weightedPipeline = 0;
    const breakdown: ForecastBreakdown[] = [];

    // Calculate weighted value by stage
    for (const stage of stages) {
      const stageDeals = forecastDeals.filter(d => d.stage_id === stage.id);
      const stageValue = stageDeals.reduce((sum, deal) => sum + (deal.value || 0), 0);
      
      let probability = stage.deal_probability ? stage.deal_probability / 100 : 0.5;
      
      // Adjust probability based on historical data
      const historicalRate = historicalWinRates[stage.id];
      if (historicalRate !== undefined) {
        probability = (probability + historicalRate) / 2; // Average of configured and historical
      }

      // Apply forecast type multiplier
      const multiplier = this.getForecastTypeMultiplier(forecastType, probability);
      const adjustedProbability = Math.min(0.95, Math.max(0.05, probability * multiplier));
      
      const weightedValue = stageValue * adjustedProbability;
      weightedPipeline += weightedValue;

      if (stageDeals.length > 0) {
        breakdown.push({
          category: stage.name,
          deals: stageDeals.length,
          value: stageValue,
          probability: adjustedProbability,
          weightedValue,
        });
      }
    }

    // Calculate projected revenue with seasonal adjustments
    const seasonalMultiplier = this.getSeasonalMultiplier(now.getMonth(), period);
    const projectedRevenue = weightedPipeline * seasonalMultiplier;

    // Calculate confidence based on historical accuracy
    const confidence = await this.calculateForecastConfidence(period, forecastType);

    // Generate assumptions
    const assumptions: ForecastAssumption[] = [
      {
        type: 'historical',
        description: `Based on last 12 months of historical win rates`,
        impact: 0.8,
        confidence: 0.7,
      },
      {
        type: 'seasonal',
        description: `Applied ${seasonalMultiplier}x seasonal adjustment for ${periodLabel}`,
        impact: seasonalMultiplier - 1,
        confidence: 0.6,
      },
      {
        type: 'team',
        description: `Current team capacity and performance trends`,
        impact: 0.1,
        confidence: 0.8,
      },
    ];

    // Identify risks
    const risks: ForecastRisk[] = [
      {
        category: 'market',
        description: 'Economic conditions may affect deal closure rates',
        probability: 0.3,
        impact: -0.15,
        mitigation: 'Focus on high-value, qualified opportunities',
      },
      {
        category: 'competition',
        description: 'Competitive pressure may extend sales cycles',
        probability: 0.4,
        impact: -0.1,
        mitigation: 'Strengthen value proposition and differentiation',
      },
      {
        category: 'team',
        description: 'Team capacity constraints during growth',
        probability: 0.2,
        impact: -0.2,
        mitigation: 'Consider additional hiring or process optimization',
      },
    ];

    // Store forecast for accuracy tracking
    await supabase
      .from('pipedrive_revenue_forecasts')
      .insert({
        workspace_id: this.workspaceId,
        period,
        forecast_type: forecastType,
        period_start: now.toISOString(),
        period_end: endDate.toISOString(),
        total_pipeline: totalPipeline,
        weighted_pipeline: weightedPipeline,
        projected_revenue: projectedRevenue,
        confidence,
        breakdown,
        assumptions,
        risks,
        created_at: new Date().toISOString(),
      });

    return {
      period: periodLabel,
      forecastType,
      totalPipeline,
      weightedPipeline,
      projectedRevenue,
      confidence,
      breakdown,
      assumptions,
      risks,
    };
  }

  /**
   * Analyze individual deal health
   */
  async analyzeDealHealth(dealId: number): Promise<DealHealthMetrics> {
    const healthScore = await this.dealManager.getDealHealthScore(dealId);
    const timeline = await this.dealManager.getDealTimeline(dealId);
    
    // Convert health score to our format
    const riskFactors: RiskFactor[] = healthScore.risks.map(risk => ({
      type: risk.category as any,
      severity: risk.type === 'high_risk' ? 'high' : risk.type === 'medium_risk' ? 'medium' : 'low',
      description: risk.description,
      impact: risk.impact / 10, // Convert to 0-1 scale
      likelihood: 0.5, // Default likelihood
    }));

    const opportunities: Opportunity[] = [
      {
        type: 'acceleration',
        description: 'Opportunity to accelerate deal closure',
        potential: healthScore.overall > 70 ? 0.3 : 0.1,
        effort: 'medium',
        timeline: '2-4 weeks',
      },
    ];

    const nextBestActions: NextAction[] = healthScore.recommendations.slice(0, 3).map(rec => ({
      priority: rec.priority as any,
      action: rec.title,
      description: rec.description,
      expectedImpact: rec.expectedImpact,
      timeframe: rec.timeline,
    }));

    // Predict outcome based on health score
    let predictedOutcome: 'win' | 'loss' | 'stall';
    if (healthScore.overall >= 70) predictedOutcome = 'win';
    else if (healthScore.overall <= 30) predictedOutcome = 'loss';
    else predictedOutcome = 'stall';

    return {
      dealId,
      healthScore: healthScore.overall,
      riskFactors,
      opportunities,
      nextBestActions,
      predictedOutcome,
      predictedCloseDate: timeline.projectedCloseDate,
      confidenceLevel: Math.min(95, Math.max(30, healthScore.overall + 10)),
    };
  }

  /**
   * Analyze team performance
   */
  async analyzeTeamPerformance(timeframe: '30d' | '90d' | '1y' = '90d'): Promise<TeamPerformance[]> {
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

    // Get team members
    const { data: teamMembers } = await supabase
      .from('workspace_users')
      .select('user_id, users(id, full_name)')
      .eq('workspace_id', this.workspaceId);

    if (!teamMembers) return [];

    const teamPerformance: TeamPerformance[] = [];

    for (const member of teamMembers) {
      const userId = (member as any).users.id;
      const userName = (member as any).users.full_name || 'Unknown';

      // Get deals owned by this user
      const { data: userDeals } = await supabase
        .from('pipedrive_deals')
        .select('*')
        .eq('workspace_id', this.workspaceId)
        .eq('owner_id', userId)
        .gte('add_time', startDate.toISOString());

      if (!userDeals) continue;

      const dealsOwned = userDeals.length;
      const dealsWon = userDeals.filter(d => d.status === 'won').length;
      const dealsLost = userDeals.filter(d => d.status === 'lost').length;
      const totalValue = userDeals.filter(d => d.status === 'won').reduce((sum, deal) => sum + (deal.value || 0), 0);
      const winRate = (dealsWon + dealsLost) > 0 ? dealsWon / (dealsWon + dealsLost) : 0;
      const averageDealSize = dealsWon > 0 ? totalValue / dealsWon : 0;

      // Calculate average sales cycle
      const closedDeals = userDeals.filter(d => d.status === 'won' || d.status === 'lost');
      const averageSalesCycle = closedDeals.length > 0 
        ? closedDeals.reduce((sum, deal) => {
            const created = new Date(deal.add_time);
            const closed = new Date(deal.close_time || deal.won_time || deal.lost_time || deal.update_time);
            return sum + ((closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
          }, 0) / closedDeals.length
        : 0;

      // Get activities completed
      const { data: activities } = await supabase
        .from('pipedrive_activities')
        .select('*')
        .eq('workspace_id', this.workspaceId)
        .eq('owner_id', userId)
        .eq('done', true)
        .gte('created_at', startDate.toISOString());

      const activitiesCompleted = activities?.length || 0;

      // Calculate response time (placeholder - would need email data)
      const responseTime = 24; // Default 24 hours

      // Calculate overall score
      const score = Math.round(
        (winRate * 30) +
        (Math.min(averageDealSize / 10000, 1) * 25) +
        (Math.min(activitiesCompleted / 50, 1) * 20) +
        (Math.max(0, 1 - averageSalesCycle / 60) * 25) // Shorter cycle is better
      );

      // Identify strengths and improvements
      const strengths: string[] = [];
      const improvements: string[] = [];

      if (winRate > 0.6) strengths.push('High win rate');
      else if (winRate < 0.3) improvements.push('Improve qualification and closing skills');

      if (averageDealSize > 15000) strengths.push('Large deal sizes');
      else if (averageDealSize < 5000) improvements.push('Focus on higher-value opportunities');

      if (activitiesCompleted > 30) strengths.push('High activity level');
      else if (activitiesCompleted < 10) improvements.push('Increase prospect engagement');

      if (averageSalesCycle < 30) strengths.push('Fast deal closure');
      else if (averageSalesCycle > 60) improvements.push('Accelerate sales process');

      teamPerformance.push({
        userId,
        userName,
        dealsOwned,
        dealsWon,
        dealsLost,
        totalValue,
        winRate,
        averageDealSize,
        averageSalesCycle,
        activitiesCompleted,
        responseTime,
        score,
        ranking: 0, // Will be set after sorting
        strengths,
        improvements,
      });
    }

    // Sort by score and assign rankings
    teamPerformance.sort((a, b) => b.score - a.score);
    teamPerformance.forEach((member, index) => {
      member.ranking = index + 1;
    });

    return teamPerformance;
  }

  /**
   * Generate pipeline optimization recommendations
   */
  async generatePipelineRecommendations(): Promise<PipelineRecommendation[]> {
    const metrics = await this.generatePipelineMetrics('90d');
    const recommendations: PipelineRecommendation[] = [];

    // Analyze bottlenecks
    const bottleneckStages = Object.entries(metrics.dealsByStage)
      .filter(([_, stage]) => stage.bottleneckRisk === 'high')
      .map(([stageId, stage]) => ({ stageId: parseInt(stageId), stage }));

    if (bottleneckStages.length > 0) {
      recommendations.push({
        type: 'process',
        priority: 'high',
        title: 'Optimize Pipeline Bottlenecks',
        description: `${bottleneckStages.length} stages showing bottleneck patterns with slow velocity or low conversion`,
        expectedImpact: 'Reduce sales cycle by 15-25%',
        effortRequired: 'medium',
        timeline: '4-6 weeks',
        kpi: 'Average time in stage',
        targetImprovement: '20% reduction',
      });
    }

    // Check win rate
    if (metrics.winRate < 0.25) {
      recommendations.push({
        type: 'training',
        priority: 'critical',
        title: 'Improve Lead Qualification',
        description: `Win rate of ${(metrics.winRate * 100).toFixed(1)}% is below industry average`,
        expectedImpact: 'Increase win rate to 30-40%',
        effortRequired: 'high',
        timeline: '8-12 weeks',
        kpi: 'Win rate',
        targetImprovement: '10+ percentage points',
      });
    }

    // Check average deal size
    const industryAverage = 15000; // Example industry average
    if (metrics.averageDealSize < industryAverage * 0.7) {
      recommendations.push({
        type: 'strategy',
        priority: 'medium',
        title: 'Increase Average Deal Size',
        description: 'Focus on larger opportunities and upselling existing clients',
        expectedImpact: 'Increase average deal size by 25-40%',
        effortRequired: 'medium',
        timeline: '6-8 weeks',
        kpi: 'Average deal size',
        targetImprovement: `Target $${industryAverage.toLocaleString()}`,
      });
    }

    // Check sales cycle
    if (metrics.averageSalesCycle > 45) {
      recommendations.push({
        type: 'automation',
        priority: 'medium',
        title: 'Accelerate Sales Process',
        description: 'Implement automation to reduce manual tasks and speed up deal progression',
        expectedImpact: 'Reduce sales cycle by 20-30%',
        effortRequired: 'medium',
        timeline: '4-6 weeks',
        kpi: 'Average sales cycle',
        targetImprovement: 'Target 30-35 days',
      });
    }

    // Check for low activity levels
    const totalActivities = await this.getTotalActivities('30d');
    const expectedActivities = metrics.totalDeals * 5; // Example: 5 activities per deal per month
    
    if (totalActivities < expectedActivities * 0.7) {
      recommendations.push({
        type: 'process',
        priority: 'medium',
        title: 'Increase Sales Activities',
        description: 'Team activity levels are below optimal for pipeline progression',
        expectedImpact: 'Improve deal progression by 15-20%',
        effortRequired: 'low',
        timeline: '2-4 weeks',
        kpi: 'Activities per deal',
        targetImprovement: 'Target 5+ activities per deal per month',
      });
    }

    return recommendations;
  }

  // Helper methods

  private assessBottleneckRisk(velocity: number, conversionRate: number): 'low' | 'medium' | 'high' {
    if (velocity > 21 || conversionRate < 0.3) return 'high';
    if (velocity > 14 || conversionRate < 0.5) return 'medium';
    return 'low';
  }

  private async generateMonthlyTrends(startDate: Date): Promise<MonthlyTrend[]> {
    const supabase = createServerClient(cookies());
    const trends: MonthlyTrend[] = [];

    const months = Math.ceil((Date.now() - startDate.getTime()) / (30 * 24 * 60 * 60 * 1000));
    
    for (let i = 0; i < months; i++) {
      const monthStart = new Date(startDate);
      monthStart.setMonth(monthStart.getMonth() + i);
      const monthEnd = new Date(monthStart);
      monthEnd.setMonth(monthEnd.getMonth() + 1);

      const { data: monthDeals } = await supabase
        .from('pipedrive_deals')
        .select('*')
        .eq('workspace_id', this.workspaceId)
        .gte('add_time', monthStart.toISOString())
        .lt('add_time', monthEnd.toISOString());

      if (monthDeals) {
        const dealsCreated = monthDeals.length;
        const dealsWon = monthDeals.filter(d => d.status === 'won').length;
        const dealsLost = monthDeals.filter(d => d.status === 'lost').length;
        const totalValue = monthDeals.filter(d => d.status === 'won').reduce((sum, deal) => sum + (deal.value || 0), 0);
        const averageDealSize = dealsWon > 0 ? totalValue / dealsWon : 0;
        const winRate = (dealsWon + dealsLost) > 0 ? dealsWon / (dealsWon + dealsLost) : 0;

        trends.push({
          month: monthStart.toISOString().slice(0, 7), // YYYY-MM format
          dealsCreated,
          dealsWon,
          dealsLost,
          totalValue,
          averageDealSize,
          winRate,
        });
      }
    }

    return trends;
  }

  private calculateHistoricalWinRates(historicalDeals: any[]): Record<number, number> {
    const stageWinRates: Record<number, number> = {};
    
    // Group deals by final stage before closing
    const stageGroups = new Map<number, { won: number; total: number }>();
    
    for (const deal of historicalDeals) {
      const stageId = deal.stage_id;
      const group = stageGroups.get(stageId) || { won: 0, total: 0 };
      
      group.total++;
      if (deal.status === 'won') {
        group.won++;
      }
      
      stageGroups.set(stageId, group);
    }

    // Calculate win rates
    for (const [stageId, group] of stageGroups) {
      stageWinRates[stageId] = group.total > 0 ? group.won / group.total : 0;
    }

    return stageWinRates;
  }

  private getForecastTypeMultiplier(forecastType: 'conservative' | 'realistic' | 'optimistic', baseProbability: number): number {
    switch (forecastType) {
      case 'conservative':
        return 0.8;
      case 'optimistic':
        return Math.min(1.3, 1 + (1 - baseProbability) * 0.5);
      default:
        return 1.0;
    }
  }

  private getSeasonalMultiplier(month: number, period: string): number {
    // Simple seasonal adjustments (would be more sophisticated in production)
    const seasonalFactors = {
      0: 0.85,  // January - post-holiday slow
      1: 0.95,  // February
      2: 1.1,   // March - Q1 end push
      3: 1.0,   // April
      4: 1.0,   // May
      5: 1.05,  // June - Q2 end
      6: 0.9,   // July - summer
      7: 0.85,  // August - summer
      8: 1.05,  // September - back to business
      9: 1.1,   // October
      10: 1.15, // November - Q4 push
      11: 1.2,  // December - year-end push
    };

    return seasonalFactors[month] || 1.0;
  }

  private async calculateForecastConfidence(period: string, forecastType: string): Promise<number> {
    const supabase = createServerClient(cookies());

    // Get historical forecast accuracy
    const { data: historicalForecasts } = await supabase
      .from('pipedrive_revenue_forecasts')
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .eq('period', period)
      .eq('forecast_type', forecastType)
      .not('actual_revenue', 'is', null)
      .order('created_at', { ascending: false })
      .limit(12);

    if (!historicalForecasts || historicalForecasts.length === 0) {
      return 65; // Default confidence for new forecasts
    }

    // Calculate accuracy scores
    const accuracyScores = historicalForecasts.map(forecast => {
      const predicted = forecast.projected_revenue || 0;
      const actual = forecast.actual_revenue || 0;
      const maxValue = Math.max(predicted, actual, 1);
      return Math.max(0, 100 - (Math.abs(predicted - actual) / maxValue) * 100);
    });

    const averageAccuracy = accuracyScores.reduce((sum, score) => sum + score, 0) / accuracyScores.length;
    
    // Adjust confidence based on forecast type
    const typeAdjustment = {
      conservative: 5,
      realistic: 0,
      optimistic: -10,
    };

    return Math.min(95, Math.max(30, averageAccuracy + (typeAdjustment[forecastType] || 0)));
  }

  private async getTotalActivities(timeframe: string): Promise<number> {
    const supabase = createServerClient(cookies());
    
    const startDate = new Date();
    if (timeframe === '30d') {
      startDate.setDate(startDate.getDate() - 30);
    }

    const { data: activities } = await supabase
      .from('pipedrive_activities')
      .select('id')
      .eq('workspace_id', this.workspaceId)
      .gte('created_at', startDate.toISOString());

    return activities?.length || 0;
  }
}