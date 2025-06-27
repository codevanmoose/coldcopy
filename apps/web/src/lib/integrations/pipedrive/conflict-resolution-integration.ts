import { 
  ConflictResolver,
  ConflictDetectionResult,
  ConflictResolutionResult,
  ConflictContext,
  ConflictHistory,
  ConflictType,
  ConflictSeverity,
  ResolutionSuggestion
} from './conflict-resolution';
import { 
  ConflictResolutionPerformanceOptimizer,
  conflictPerformanceOptimizer 
} from './conflict-resolution-performance';
import { PipedriveClient } from './client';
import { supabase } from '@/lib/supabase/client';
import { AIService } from '@/lib/ai';

interface ConflictResolutionConfig {
  workspaceId: string;
  userId: string;
  syncDirection: 'to_pipedrive' | 'from_pipedrive' | 'bidirectional';
  defaultStrategy: string;
  enableAI: boolean;
  enableOptimisticLocking: boolean;
  batchSize: number;
  maxRetries: number;
}

export class PipedriveConflictResolutionService {
  private conflictResolver: ConflictResolver;
  private performanceOptimizer: ConflictResolutionPerformanceOptimizer;
  private pipedriveClient: PipedriveClient;
  private aiService: AIService;
  private config: ConflictResolutionConfig;

  constructor(
    pipedriveClient: PipedriveClient,
    config: ConflictResolutionConfig
  ) {
    this.pipedriveClient = pipedriveClient;
    this.config = config;
    this.conflictResolver = new ConflictResolver();
    this.performanceOptimizer = conflictPerformanceOptimizer;
    this.aiService = new AIService();
  }

  /**
   * Process a single entity for conflicts
   */
  async processEntity(
    entityType: 'person' | 'organization' | 'deal' | 'activity',
    entityId: string,
    localData: any,
    remoteData: any
  ): Promise<{
    conflict?: ConflictDetectionResult;
    resolution?: ConflictResolutionResult;
    finalData?: any;
  }> {
    try {
      // Acquire optimistic lock if enabled
      let lock;
      if (this.config.enableOptimisticLocking) {
        lock = await this.conflictResolver.acquireOptimisticLock(
          entityType,
          entityId,
          this.config.userId
        );
      }

      // Detect conflicts
      const conflict = await this.conflictResolver.detectConflicts(
        localData,
        remoteData,
        await this.getLastSyncedVersion(entityType, entityId)
      );

      if (!conflict.hasConflict) {
        // No conflict, proceed with sync
        if (lock) await this.conflictResolver.releaseLock(lock.lockToken);
        return { finalData: remoteData };
      }

      // Get resolution strategy
      const strategy = await this.determineResolutionStrategy(
        conflict,
        entityType,
        entityId
      );

      // Create context
      const context: ConflictContext = {
        entityType,
        entityId,
        workspaceId: this.config.workspaceId,
        userId: this.config.userId,
        syncDirection: this.config.syncDirection,
        lastSyncTimestamp: await this.getLastSyncTimestamp(entityType, entityId)
      };

      // Resolve conflict
      const resolution = await this.conflictResolver.resolveConflict(
        conflict,
        localData,
        remoteData,
        strategy,
        context
      );

      // Apply resolution if successful
      if (resolution.resolved && resolution.resolvedData) {
        await this.applyResolution(
          entityType,
          entityId,
          resolution.resolvedData,
          conflict,
          resolution
        );
      }

      // Release lock
      if (lock) await this.conflictResolver.releaseLock(lock.lockToken);

      return {
        conflict,
        resolution,
        finalData: resolution.resolvedData
      };
    } catch (error) {
      console.error('Error processing entity:', error);
      throw error;
    }
  }

  /**
   * Process multiple entities in batch
   */
  async processBatch(
    entities: Array<{
      type: 'person' | 'organization' | 'deal' | 'activity';
      id: string;
      local: any;
      remote: any;
    }>
  ): Promise<Array<{
    entityId: string;
    success: boolean;
    conflict?: ConflictDetectionResult;
    resolution?: ConflictResolutionResult;
    error?: Error;
  }>> {
    // Optimize batch processing
    const optimizedBatches = await this.performanceOptimizer.optimizeBatchProcessing(
      entities,
      {
        batchSize: this.config.batchSize,
        sortBy: 'priority',
        deduplication: true
      }
    );

    const results = [];

    for (const batch of optimizedBatches) {
      // Queue batch for processing
      const batchId = await this.performanceOptimizer.queueBatch(
        this.config.workspaceId,
        batch,
        'medium'
      );

      // Wait for batch completion
      let status;
      do {
        await new Promise(resolve => setTimeout(resolve, 1000));
        status = await this.performanceOptimizer.getBatchStatus(batchId);
      } while (status.status === 'waiting' || status.status === 'active');

      if (status.results) {
        results.push(...status.results.map(r => ({
          entityId: r.entityId,
          success: !r.error,
          conflict: r.conflict,
          resolution: r.resolution,
          error: r.error
        })));
      }
    }

    return results;
  }

  /**
   * Determine the best resolution strategy
   */
  private async determineResolutionStrategy(
    conflict: ConflictDetectionResult,
    entityType: string,
    entityId: string
  ): Promise<string> {
    // Check for custom rules
    const rules = await this.getConflictRules(entityType, conflict.conflictType);
    
    if (rules.length > 0) {
      // Apply first matching rule
      for (const rule of rules) {
        if (this.matchesRule(conflict, rule)) {
          return rule.resolutionStrategy;
        }
      }
    }

    // Check severity-based strategy
    if (conflict.conflictSeverity === ConflictSeverity.CRITICAL) {
      return 'manual';
    }

    if (conflict.conflictSeverity === ConflictSeverity.HIGH && this.config.enableAI) {
      return 'ai_resolution';
    }

    // Use default strategy
    return this.config.defaultStrategy;
  }

  /**
   * Apply the resolved data
   */
  private async applyResolution(
    entityType: string,
    entityId: string,
    resolvedData: any,
    conflict: ConflictDetectionResult,
    resolution: ConflictResolutionResult
  ): Promise<void> {
    try {
      // Update local database
      await this.updateLocalEntity(entityType, entityId, resolvedData);

      // Sync to Pipedrive if needed
      if (this.config.syncDirection === 'to_pipedrive' || 
          this.config.syncDirection === 'bidirectional') {
        await this.syncToPipedrive(entityType, entityId, resolvedData);
      }

      // Log successful resolution
      await this.logResolution(entityType, entityId, conflict, resolution, 'success');
    } catch (error) {
      // Log failed resolution
      await this.logResolution(entityType, entityId, conflict, resolution, 'failed', error);
      throw error;
    }
  }

  /**
   * Get AI-powered conflict analysis
   */
  async analyzeConflict(
    conflict: ConflictDetectionResult,
    localData: any,
    remoteData: any
  ): Promise<{
    analysis: string;
    recommendations: string[];
    riskAssessment: {
      level: 'low' | 'medium' | 'high';
      factors: string[];
    };
    suggestedResolution: ResolutionSuggestion[];
  }> {
    if (!this.config.enableAI) {
      throw new Error('AI analysis is not enabled');
    }

    const prompt = `
      Analyze the following data conflict and provide recommendations:

      Conflict Type: ${conflict.conflictType}
      Severity: ${conflict.conflictSeverity}
      Fields in Conflict: ${conflict.conflictedFields.map(f => f.fieldName).join(', ')}

      Local Data: ${JSON.stringify(localData, null, 2)}
      Remote Data: ${JSON.stringify(remoteData, null, 2)}

      Please provide:
      1. A detailed analysis of the conflict
      2. Recommendations for resolution
      3. Risk assessment
      4. Suggested field-level resolutions
    `;

    const response = await this.aiService.generateCompletion(prompt, {
      temperature: 0.3,
      maxTokens: 1500
    });

    // Parse AI response
    return this.parseAIAnalysis(response);
  }

  /**
   * Get conflict prevention recommendations
   */
  async getPreventionRecommendations(
    workspaceId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<{
    recommendations: Array<{
      type: 'rule' | 'process' | 'technical';
      priority: 'low' | 'medium' | 'high';
      title: string;
      description: string;
      impact: string;
      implementation: string[];
    }>;
    patterns: Array<{
      pattern: string;
      frequency: number;
      entities: string[];
      suggestedAction: string;
    }>;
  }> {
    // Analyze historical conflicts
    const { patterns, recommendations } = await this.conflictResolver.analyzeConflictPatterns(
      workspaceId,
      timeRange
    );

    // Generate prevention recommendations
    const preventionRecs = [];

    // Rule-based recommendations
    if (patterns.some(p => p.frequency > 100)) {
      preventionRecs.push({
        type: 'rule' as const,
        priority: 'high' as const,
        title: 'Implement Automatic Conflict Resolution Rules',
        description: 'High-frequency conflicts can be automatically resolved with predefined rules',
        impact: 'Reduce manual intervention by up to 70%',
        implementation: [
          'Identify patterns in recurring conflicts',
          'Create field-specific resolution rules',
          'Set up approval workflows for critical fields',
          'Monitor rule effectiveness'
        ]
      });
    }

    // Process recommendations
    if (patterns.some(p => p.averageResolutionTime > 3600000)) {
      preventionRecs.push({
        type: 'process' as const,
        priority: 'medium' as const,
        title: 'Optimize Sync Frequency',
        description: 'Reduce conflict likelihood by adjusting synchronization intervals',
        impact: 'Decrease conflict rate by 30-40%',
        implementation: [
          'Analyze peak update times',
          'Implement real-time sync for critical entities',
          'Use incremental sync for large datasets',
          'Set up sync windows for batch operations'
        ]
      });
    }

    // Technical recommendations
    if (patterns.some(p => p.conflictType === ConflictType.SCHEMA_CONFLICT)) {
      preventionRecs.push({
        type: 'technical' as const,
        priority: 'high' as const,
        title: 'Standardize Data Schemas',
        description: 'Align data structures between ColdCopy and Pipedrive',
        impact: 'Eliminate schema-related conflicts',
        implementation: [
          'Map all custom fields',
          'Implement data validation',
          'Use consistent data types',
          'Create migration scripts for schema changes'
        ]
      });
    }

    return {
      recommendations: preventionRecs,
      patterns: patterns.map(p => ({
        pattern: `${p.entityType} - ${p.conflictType}`,
        frequency: p.frequency,
        entities: p.commonFields,
        suggestedAction: this.getSuggestedAction(p)
      }))
    };
  }

  /**
   * Generate conflict resolution report
   */
  async generateReport(
    workspaceId: string,
    timeRange: { start: Date; end: Date },
    format: 'json' | 'csv' | 'pdf' = 'json'
  ): Promise<{
    reportId: string;
    data?: any;
    downloadUrl?: string;
  }> {
    // Gather data
    const history = await this.conflictResolver.getConflictHistory(workspaceId);
    const metrics = this.performanceOptimizer.getMetrics();
    const patterns = await this.conflictResolver.analyzeConflictPatterns(workspaceId, timeRange);

    const reportData = {
      summary: {
        totalConflicts: history.length,
        resolvedConflicts: history.filter(h => h.resolvedAt).length,
        pendingConflicts: history.filter(h => !h.resolvedAt).length,
        averageResolutionTime: this.calculateAverageTime(history),
        successRate: this.calculateSuccessRate(history)
      },
      performance: metrics,
      patterns: patterns.patterns,
      recommendations: patterns.recommendations,
      detailedHistory: history
    };

    // Generate report based on format
    if (format === 'json') {
      return {
        reportId: `report-${Date.now()}`,
        data: reportData
      };
    }

    // For CSV/PDF, generate file and upload
    const file = await this.generateReportFile(reportData, format);
    const downloadUrl = await this.uploadReportFile(file);

    return {
      reportId: `report-${Date.now()}`,
      downloadUrl
    };
  }

  // Helper methods
  private async getLastSyncedVersion(entityType: string, entityId: string): Promise<any> {
    const { data } = await supabase
      .from('pipedrive_sync_status')
      .select('sync_hash')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .single();
    
    return data?.sync_hash;
  }

  private async getLastSyncTimestamp(entityType: string, entityId: string): Promise<Date | undefined> {
    const { data } = await supabase
      .from('pipedrive_sync_status')
      .select('last_synced_at')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .single();
    
    return data?.last_synced_at ? new Date(data.last_synced_at) : undefined;
  }

  private async getConflictRules(entityType: string, conflictType: ConflictType): Promise<any[]> {
    const { data } = await supabase
      .from('pipedrive_conflict_resolution_rules')
      .select('*')
      .eq('workspace_id', this.config.workspaceId)
      .eq('enabled', true)
      .or(`entity_type.eq.${entityType},entity_type.eq.all`)
      .or(`conflict_type.eq.${conflictType},conflict_type.eq.all`)
      .order('priority', { ascending: true });
    
    return data || [];
  }

  private matchesRule(conflict: ConflictDetectionResult, rule: any): boolean {
    // Check field patterns
    if (rule.field_patterns?.length > 0) {
      const conflictedFieldNames = conflict.conflictedFields.map(f => f.fieldName);
      const matchesPattern = rule.field_patterns.some((pattern: string) => {
        const regex = new RegExp(pattern.replace('*', '.*'));
        return conflictedFieldNames.some(field => regex.test(field));
      });
      if (!matchesPattern) return false;
    }

    // Check conditions
    if (rule.conditions?.length > 0) {
      // Implement condition matching logic
      return true; // Simplified for now
    }

    return true;
  }

  private async updateLocalEntity(entityType: string, entityId: string, data: any): Promise<void> {
    const table = `${entityType}s`; // Simplified table name mapping
    await supabase
      .from(table)
      .update(data)
      .eq('id', entityId);
  }

  private async syncToPipedrive(entityType: string, entityId: string, data: any): Promise<void> {
    switch (entityType) {
      case 'person':
        await this.pipedriveClient.updatePerson(parseInt(entityId), data);
        break;
      case 'organization':
        await this.pipedriveClient.updateOrganization(parseInt(entityId), data);
        break;
      case 'deal':
        await this.pipedriveClient.updateDeal(parseInt(entityId), data);
        break;
      case 'activity':
        await this.pipedriveClient.updateActivity(parseInt(entityId), data);
        break;
    }
  }

  private async logResolution(
    entityType: string,
    entityId: string,
    conflict: ConflictDetectionResult,
    resolution: ConflictResolutionResult,
    status: 'success' | 'failed',
    error?: any
  ): Promise<void> {
    await supabase
      .from('pipedrive_conflict_resolution_logs')
      .insert({
        workspace_id: this.config.workspaceId,
        entity_type: entityType,
        entity_id: entityId,
        conflict_type: conflict.conflictType,
        conflict_severity: conflict.conflictSeverity,
        resolution_strategy: resolution.strategy,
        resolution_confidence: resolution.confidence,
        status,
        error_message: error?.message,
        resolved_at: new Date()
      });
  }

  private parseAIAnalysis(response: string): any {
    // Parse AI response - implementation depends on AI response format
    return {
      analysis: '',
      recommendations: [],
      riskAssessment: {
        level: 'medium' as const,
        factors: []
      },
      suggestedResolution: []
    };
  }

  private getSuggestedAction(pattern: any): string {
    // Generate suggested action based on pattern
    if (pattern.frequency > 100) {
      return 'Create automatic resolution rule';
    }
    if (pattern.averageResolutionTime > 3600000) {
      return 'Implement real-time synchronization';
    }
    if (pattern.successRate < 70) {
      return 'Review and update resolution strategies';
    }
    return 'Monitor and optimize';
  }

  private calculateAverageTime(history: ConflictHistory[]): number {
    const resolved = history.filter(h => h.resolvedAt);
    if (resolved.length === 0) return 0;
    
    const totalTime = resolved.reduce((sum, h) => {
      const time = new Date(h.resolvedAt!).getTime() - new Date(h.detectedAt).getTime();
      return sum + time;
    }, 0);
    
    return totalTime / resolved.length;
  }

  private calculateSuccessRate(history: ConflictHistory[]): number {
    if (history.length === 0) return 0;
    const resolved = history.filter(h => h.resolution?.resolved).length;
    return (resolved / history.length) * 100;
  }

  private async generateReportFile(data: any, format: 'csv' | 'pdf'): Promise<Blob> {
    // Implementation for file generation
    return new Blob();
  }

  private async uploadReportFile(file: Blob): Promise<string> {
    // Implementation for file upload
    return '';
  }
}

// Export factory function
export function createConflictResolutionService(
  pipedriveClient: PipedriveClient,
  config: Partial<ConflictResolutionConfig>
): PipedriveConflictResolutionService {
  const defaultConfig: ConflictResolutionConfig = {
    workspaceId: '',
    userId: '',
    syncDirection: 'bidirectional',
    defaultStrategy: 'latest_wins',
    enableAI: true,
    enableOptimisticLocking: true,
    batchSize: 100,
    maxRetries: 3,
    ...config
  };

  return new PipedriveConflictResolutionService(pipedriveClient, defaultConfig);
}