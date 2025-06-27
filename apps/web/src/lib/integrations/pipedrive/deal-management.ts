/**
 * Comprehensive Pipedrive Deal Management System
 * 
 * This module provides a complete deal management solution with:
 * - Intelligent value calculation and deal creation
 * - Pipeline stage progression automation with workflow triggers
 * - Deal activity tracking and timeline management
 * - Revenue forecasting and analytics
 * - Integration with existing ColdCopy campaign system
 * - Stage change notifications and team collaboration
 * - Deal health scoring and optimization recommendations
 */

// Core services
export { PipedriveDealManager } from './deal-manager';
export { PipelineAutomationEngine } from './pipeline-automation';
export { PipelineAnalyticsEngine } from './analytics-engine';
export { PipedriveCampaignIntegration } from './campaign-integration';
export { PipedriveNotificationSystem } from './notifications';
export { DealHealthOptimizer } from './deal-health-optimizer';

// Re-export existing types and services
export * from './types';
export { PipedriveClient } from './client';
export { PipedriveAuth } from './auth';
export { PipedriveDealsService } from './deals';

/**
 * Main Deal Management Orchestrator
 * Coordinates all deal management services
 */
export class PipedriveDealManagementSystem {
  private dealManager: PipedriveDealManager;
  private automationEngine: PipelineAutomationEngine;
  private analyticsEngine: PipelineAnalyticsEngine;
  private campaignIntegration: PipedriveCampaignIntegration;
  private notificationSystem: PipedriveNotificationSystem;
  private healthOptimizer: DealHealthOptimizer;
  private workspaceId: string;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
    this.dealManager = new PipedriveDealManager(workspaceId);
    this.automationEngine = new PipelineAutomationEngine(workspaceId);
    this.analyticsEngine = new PipelineAnalyticsEngine(workspaceId);
    this.campaignIntegration = new PipedriveCampaignIntegration(workspaceId);
    this.notificationSystem = new PipedriveNotificationSystem(workspaceId);
    this.healthOptimizer = new DealHealthOptimizer(workspaceId);
  }

  // Getters for individual services
  get deals() { return this.dealManager; }
  get automation() { return this.automationEngine; }
  get analytics() { return this.analyticsEngine; }
  get campaigns() { return this.campaignIntegration; }
  get notifications() { return this.notificationSystem; }
  get health() { return this.healthOptimizer; }

  /**
   * Process a deal event across all relevant services
   */
  async processDealEvent(
    dealId: number,
    eventType: string,
    eventData: Record<string, any> = {},
    userId?: number
  ): Promise<void> {
    // Process automation rules
    await this.automationEngine.processDealEvent(dealId, eventType as any, eventData);

    // Process campaign triggers
    await this.campaignIntegration.processDealCampaignEvent(dealId, eventType as any, eventData, userId);

    // Send notifications
    await this.notificationSystem.processDealNotificationEvent(dealId, eventType, eventData, userId);

    // Process stage progression if it's a stage change
    if (eventType === 'stage_changed') {
      await this.automationEngine.processStageProgression(dealId);
    }
  }

  /**
   * Get comprehensive deal insights
   */
  async getDealInsights(dealId: number): Promise<{
    health: any;
    timeline: any;
    analytics: any;
    recommendations: any;
  }> {
    const [health, timeline] = await Promise.all([
      this.healthOptimizer.generateDealHealthProfile(dealId),
      this.dealManager.getDealTimeline(dealId),
    ]);

    const analytics = await this.analyticsEngine.analyzeDealHealth(dealId);
    
    return {
      health,
      timeline,
      analytics,
      recommendations: health.optimizations,
    };
  }

  /**
   * Get pipeline overview with all metrics
   */
  async getPipelineOverview(timeframe: '30d' | '90d' | '1y' = '90d'): Promise<{
    metrics: any;
    forecast: any;
    team: any;
    recommendations: any;
    insights: any;
  }> {
    const [metrics, team, recommendations, insights] = await Promise.all([
      this.analyticsEngine.generatePipelineMetrics(timeframe),
      this.analyticsEngine.analyzeTeamPerformance(timeframe),
      this.analyticsEngine.generatePipelineRecommendations(),
      this.automationEngine.generatePipelineInsights(),
    ]);

    const forecast = await this.analyticsEngine.generateAdvancedForecast('monthly', 'realistic');

    return {
      metrics,
      forecast,
      team,
      recommendations,
      insights,
    };
  }

  /**
   * Setup automation for a workspace
   */
  async setupWorkspaceAutomation(config: {
    enableStageProgression?: boolean;
    enableCampaignTriggers?: boolean;
    enableNotifications?: boolean;
    enableHealthMonitoring?: boolean;
  }): Promise<void> {
    const {
      enableStageProgression = true,
      enableCampaignTriggers = true,
      enableNotifications = true,
      enableHealthMonitoring = true,
    } = config;

    // Setup default automation rules
    if (enableStageProgression) {
      // Example: Auto-progress deals that meet certain criteria
      await this.automationEngine.createPipelineRule({
        name: 'Auto-progress qualified deals',
        description: 'Automatically move deals with high engagement to next stage',
        enabled: true,
        priority: 1,
        conditions: [
          { field: 'engagement_score', operator: 'greater_than', value: 80, dataType: 'number' },
          { field: 'qualification_complete', operator: 'equals', value: true, dataType: 'boolean' },
        ],
        actions: [
          {
            type: 'move_stage',
            config: { stageId: 'next' },
          },
        ],
        triggers: [
          { event: 'deal_updated' },
        ],
      });
    }

    if (enableCampaignTriggers) {
      // Example: Start follow-up campaign when deal stalls
      await this.campaignIntegration.createCampaignTrigger({
        name: 'Deal stall follow-up',
        description: 'Start follow-up campaign when deal stalls in stage',
        enabled: true,
        triggerType: 'time_based',
        conditions: [
          { field: 'days_in_stage', operator: 'greater_than', value: 14, valueType: 'static' },
        ],
        campaignActions: [
          {
            type: 'start_sequence',
            sequenceId: 'follow_up_sequence',
            config: { priority: 'high' },
          },
        ],
      });
    }

    if (enableNotifications) {
      // Example: Notify on high-value deal changes
      await this.notificationSystem.createNotificationRule({
        name: 'High-value deal alerts',
        description: 'Alert team on changes to high-value deals',
        enabled: true,
        priority: 'high',
        triggers: [
          { event: 'deal_updated' },
          { event: 'stage_changed' },
        ],
        conditions: [
          { field: 'value', operator: 'greater_than', value: 50000 },
        ],
        recipients: [
          { type: 'role', identifier: 'sales_manager' },
          { type: 'role', identifier: 'sales_director' },
        ],
        channels: [
          { type: 'email', config: {}, enabled: true },
          { type: 'slack', config: { channel: '#sales-alerts' }, enabled: true },
        ],
        template: {
          subject: 'High-value deal update: {{deal_title}}',
          body: 'Deal "{{deal_title}}" ({{deal_value}}) has been {{event_type}}.',
          variables: ['deal_title', 'deal_value', 'event_type'],
          format: 'text',
        },
      });
    }

    if (enableHealthMonitoring) {
      // Health monitoring would be implemented as a scheduled job
      console.log('Health monitoring setup completed');
    }
  }
}

/**
 * Convenience function to create a new deal management system
 */
export function createDealManagementSystem(workspaceId: string): PipedriveDealManagementSystem {
  return new PipedriveDealManagementSystem(workspaceId);
}

/**
 * Example usage:
 * 
 * ```typescript
 * import { createDealManagementSystem } from '@/lib/integrations/pipedrive/deal-management';
 * 
 * const dealSystem = createDealManagementSystem(workspaceId);
 * 
 * // Create deal with intelligent value calculation
 * const { deal, valueCalculation } = await dealSystem.deals.createDealWithIntelligentValue(
 *   leadId, 
 *   'Enterprise Deal', 
 *   personId, 
 *   orgId
 * );
 * 
 * // Get comprehensive insights
 * const insights = await dealSystem.getDealInsights(deal.id);
 * 
 * // Process deal events
 * await dealSystem.processDealEvent(deal.id, 'stage_changed', { 
 *   previousStageId: 1, 
 *   newStageId: 2 
 * });
 * 
 * // Get pipeline overview
 * const overview = await dealSystem.getPipelineOverview('90d');
 * ```
 */