import { Queue } from 'bull';
import { createHash } from 'crypto';
import pLimit from 'p-limit';
import { LRUCache } from 'lru-cache';
import { 
  ConflictDetectionResult, 
  ConflictResolutionResult,
  ConflictResolver,
  ConflictContext,
  ConflictHistory
} from './conflict-resolution';
import { supabase } from '@/lib/supabase/client';

interface BatchConflictResult {
  entityId: string;
  entityType: string;
  conflict?: ConflictDetectionResult;
  resolution?: ConflictResolutionResult;
  error?: Error;
  processedAt: Date;
}

interface ConflictBatch {
  id: string;
  workspaceId: string;
  entities: Array<{
    type: string;
    id: string;
    local: any;
    remote: any;
    lastSynced?: any;
  }>;
  priority: 'low' | 'medium' | 'high';
  createdAt: Date;
}

interface PerformanceMetrics {
  totalProcessed: number;
  conflictsDetected: number;
  conflictsResolved: number;
  averageDetectionTime: number;
  averageResolutionTime: number;
  cacheHitRate: number;
  errorRate: number;
  throughput: number;
}

export class ConflictResolutionPerformanceOptimizer {
  private conflictResolver: ConflictResolver;
  private conflictQueue: Queue<ConflictBatch>;
  private resultCache: LRUCache<string, ConflictDetectionResult>;
  private hashCache: LRUCache<string, string>;
  private concurrencyLimit: pLimit.Limit;
  private metrics: PerformanceMetrics;
  private metricsInterval: NodeJS.Timeout | null = null;

  constructor(
    conflictResolver: ConflictResolver,
    options: {
      maxConcurrency?: number;
      cacheSize?: number;
      hashCacheSize?: number;
      queueName?: string;
      redisUrl?: string;
    } = {}
  ) {
    this.conflictResolver = conflictResolver;
    
    // Initialize queue
    this.conflictQueue = new Queue(options.queueName || 'conflict-resolution', {
      redis: options.redisUrl || process.env.REDIS_URL
    });

    // Initialize caches
    this.resultCache = new LRUCache<string, ConflictDetectionResult>({
      max: options.cacheSize || 10000,
      ttl: 1000 * 60 * 15, // 15 minutes
      updateAgeOnGet: true
    });

    this.hashCache = new LRUCache<string, string>({
      max: options.hashCacheSize || 50000,
      ttl: 1000 * 60 * 60, // 1 hour
    });

    // Initialize concurrency limiter
    this.concurrencyLimit = pLimit(options.maxConcurrency || 10);

    // Initialize metrics
    this.metrics = {
      totalProcessed: 0,
      conflictsDetected: 0,
      conflictsResolved: 0,
      averageDetectionTime: 0,
      averageResolutionTime: 0,
      cacheHitRate: 0,
      errorRate: 0,
      throughput: 0
    };

    this.setupQueueHandlers();
    this.startMetricsCollection();
  }

  private setupQueueHandlers() {
    // Process conflict batches
    this.conflictQueue.process(async (job) => {
      const batch = job.data;
      const results = await this.processBatch(batch);
      
      // Store results
      await this.storeBatchResults(batch.id, results);
      
      return results;
    });

    // Handle failures
    this.conflictQueue.on('failed', (job, err) => {
      console.error(`Conflict batch ${job.id} failed:`, err);
      this.metrics.errorRate++;
    });

    // Handle completion
    this.conflictQueue.on('completed', (job, result) => {
      console.log(`Conflict batch ${job.id} completed with ${result.length} entities processed`);
    });
  }

  private startMetricsCollection() {
    this.metricsInterval = setInterval(() => {
      this.publishMetrics();
    }, 60000); // Every minute
  }

  async processBatch(batch: ConflictBatch): Promise<BatchConflictResult[]> {
    const startTime = Date.now();
    const results: BatchConflictResult[] = [];

    // Process entities in parallel with concurrency limit
    const processPromises = batch.entities.map(entity =>
      this.concurrencyLimit(async () => {
        try {
          const result = await this.processEntity(
            entity,
            batch.workspaceId
          );
          return result;
        } catch (error) {
          return {
            entityId: entity.id,
            entityType: entity.type,
            error: error as Error,
            processedAt: new Date()
          };
        }
      })
    );

    const processedResults = await Promise.all(processPromises);
    results.push(...processedResults);

    // Update metrics
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    this.updateMetrics(results, processingTime);

    return results;
  }

  private async processEntity(
    entity: {
      type: string;
      id: string;
      local: any;
      remote: any;
      lastSynced?: any;
    },
    workspaceId: string
  ): Promise<BatchConflictResult> {
    const cacheKey = this.generateCacheKey(entity);
    
    // Check cache first
    const cachedResult = this.resultCache.get(cacheKey);
    if (cachedResult) {
      this.metrics.cacheHitRate++;
      return {
        entityId: entity.id,
        entityType: entity.type,
        conflict: cachedResult,
        processedAt: new Date()
      };
    }

    // Fast hash comparison
    const localHash = await this.getOrComputeHash(entity.local);
    const remoteHash = await this.getOrComputeHash(entity.remote);

    if (localHash === remoteHash) {
      // No conflict
      return {
        entityId: entity.id,
        entityType: entity.type,
        processedAt: new Date()
      };
    }

    // Detect conflicts
    const detectionStart = Date.now();
    const conflict = await this.conflictResolver.detectConflicts(
      entity.local,
      entity.remote,
      entity.lastSynced
    );
    const detectionTime = Date.now() - detectionStart;

    // Cache the result
    this.resultCache.set(cacheKey, conflict);

    // If no conflict or low severity, skip resolution
    if (!conflict.hasConflict || conflict.conflictSeverity === 'low') {
      return {
        entityId: entity.id,
        entityType: entity.type,
        conflict,
        processedAt: new Date()
      };
    }

    // Resolve conflict based on strategy
    const resolutionStart = Date.now();
    const context: ConflictContext = {
      entityType: entity.type as any,
      entityId: entity.id,
      workspaceId,
      userId: 'system',
      syncDirection: 'bidirectional'
    };

    const resolution = await this.conflictResolver.resolveConflict(
      conflict,
      entity.local,
      entity.remote,
      'latest_wins', // Default strategy, should be configurable
      context
    );
    const resolutionTime = Date.now() - resolutionStart;

    // Update timing metrics
    this.metrics.averageDetectionTime = 
      (this.metrics.averageDetectionTime * this.metrics.totalProcessed + detectionTime) / 
      (this.metrics.totalProcessed + 1);
    
    this.metrics.averageResolutionTime = 
      (this.metrics.averageResolutionTime * this.metrics.conflictsResolved + resolutionTime) / 
      (this.metrics.conflictsResolved + 1);

    return {
      entityId: entity.id,
      entityType: entity.type,
      conflict,
      resolution,
      processedAt: new Date()
    };
  }

  private async getOrComputeHash(data: any): Promise<string> {
    const normalized = this.normalizeForHashing(data);
    const key = JSON.stringify(normalized);
    
    let hash = this.hashCache.get(key);
    if (!hash) {
      hash = createHash('sha256').update(key).digest('hex');
      this.hashCache.set(key, hash);
    }
    
    return hash;
  }

  private normalizeForHashing(obj: any): any {
    if (obj === null || obj === undefined) return null;
    if (typeof obj !== 'object') return obj;
    if (obj instanceof Date) return obj.toISOString();
    if (Array.isArray(obj)) return obj.map(item => this.normalizeForHashing(item)).sort();

    const normalized: any = {};
    const keys = Object.keys(obj).sort();
    for (const key of keys) {
      // Skip metadata fields
      if (['created_at', 'updated_at', 'last_synced_at', 'sync_hash'].includes(key)) continue;
      normalized[key] = this.normalizeForHashing(obj[key]);
    }
    return normalized;
  }

  private generateCacheKey(entity: any): string {
    return `${entity.type}:${entity.id}:${Date.now() / 60000 | 0}`; // 1-minute buckets
  }

  private updateMetrics(results: BatchConflictResult[], processingTime: number) {
    this.metrics.totalProcessed += results.length;
    this.metrics.conflictsDetected += results.filter(r => r.conflict?.hasConflict).length;
    this.metrics.conflictsResolved += results.filter(r => r.resolution?.resolved).length;
    this.metrics.errorRate = results.filter(r => r.error).length / results.length;
    this.metrics.throughput = results.length / (processingTime / 1000); // entities per second
  }

  private async storeBatchResults(batchId: string, results: BatchConflictResult[]) {
    // Store results in database for audit trail
    const records = results.map(result => ({
      batch_id: batchId,
      entity_id: result.entityId,
      entity_type: result.entityType,
      has_conflict: result.conflict?.hasConflict || false,
      conflict_type: result.conflict?.conflictType,
      conflict_severity: result.conflict?.conflictSeverity,
      resolved: result.resolution?.resolved || false,
      resolution_strategy: result.resolution?.strategy,
      resolution_confidence: result.resolution?.confidence,
      error: result.error?.message,
      processed_at: result.processedAt
    }));

    await supabase
      .from('pipedrive_conflict_batch_results')
      .insert(records);
  }

  private async publishMetrics() {
    const metrics = {
      ...this.metrics,
      timestamp: new Date(),
      cacheSize: this.resultCache.size,
      hashCacheSize: this.hashCache.size,
      queueSize: await this.conflictQueue.count()
    };

    // Publish to monitoring system
    console.log('Conflict Resolution Metrics:', metrics);

    // Store in database for historical analysis
    await supabase
      .from('pipedrive_conflict_resolution_performance_metrics')
      .insert(metrics);
  }

  async queueBatch(
    workspaceId: string,
    entities: Array<{
      type: string;
      id: string;
      local: any;
      remote: any;
      lastSynced?: any;
    }>,
    priority: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<string> {
    const batch: ConflictBatch = {
      id: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      workspaceId,
      entities,
      priority,
      createdAt: new Date()
    };

    const job = await this.conflictQueue.add(batch, {
      priority: priority === 'high' ? 1 : priority === 'medium' ? 5 : 10,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    });

    return job.id.toString();
  }

  async getBatchStatus(batchId: string): Promise<{
    status: 'waiting' | 'active' | 'completed' | 'failed';
    progress: number;
    results?: BatchConflictResult[];
    error?: string;
  }> {
    const job = await this.conflictQueue.getJob(batchId);
    
    if (!job) {
      throw new Error('Batch not found');
    }

    const state = await job.getState();
    const progress = job.progress();

    if (state === 'completed') {
      const results = job.returnvalue as BatchConflictResult[];
      return {
        status: 'completed',
        progress: 100,
        results
      };
    }

    if (state === 'failed') {
      return {
        status: 'failed',
        progress: progress as number,
        error: job.failedReason
      };
    }

    return {
      status: state as any,
      progress: progress as number
    };
  }

  async optimizeBatchProcessing(
    entities: Array<any>,
    options: {
      batchSize?: number;
      sortBy?: 'priority' | 'size' | 'type';
      deduplication?: boolean;
    } = {}
  ): Promise<Array<Array<any>>> {
    const {
      batchSize = 100,
      sortBy = 'priority',
      deduplication = true
    } = options;

    let processedEntities = [...entities];

    // Deduplication
    if (deduplication) {
      const seen = new Set<string>();
      processedEntities = processedEntities.filter(entity => {
        const key = `${entity.type}:${entity.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    // Sorting
    if (sortBy === 'priority') {
      // Sort by conflict likelihood (based on field count, update time, etc.)
      processedEntities.sort((a, b) => {
        const aScore = this.calculateConflictLikelihood(a);
        const bScore = this.calculateConflictLikelihood(b);
        return bScore - aScore;
      });
    } else if (sortBy === 'size') {
      processedEntities.sort((a, b) => {
        const aSize = JSON.stringify(a).length;
        const bSize = JSON.stringify(b).length;
        return aSize - bSize;
      });
    } else if (sortBy === 'type') {
      processedEntities.sort((a, b) => a.type.localeCompare(b.type));
    }

    // Create optimized batches
    const batches: Array<Array<any>> = [];
    for (let i = 0; i < processedEntities.length; i += batchSize) {
      batches.push(processedEntities.slice(i, i + batchSize));
    }

    return batches;
  }

  private calculateConflictLikelihood(entity: any): number {
    let score = 0;

    // More fields = higher likelihood of conflicts
    score += Object.keys(entity.local || {}).length * 0.1;
    score += Object.keys(entity.remote || {}).length * 0.1;

    // Recent updates = higher likelihood
    const localUpdate = new Date(entity.local?.update_time || 0).getTime();
    const remoteUpdate = new Date(entity.remote?.update_time || 0).getTime();
    const timeDiff = Math.abs(localUpdate - remoteUpdate);
    if (timeDiff < 3600000) score += 5; // Within 1 hour

    // Certain entity types have higher conflict rates
    if (entity.type === 'deal') score += 3;
    if (entity.type === 'person') score += 2;

    return score;
  }

  async preloadCache(workspaceId: string, entityTypes?: string[]): Promise<void> {
    // Preload frequently conflicted entities into cache
    const { data: recentConflicts } = await supabase
      .from('pipedrive_conflict_history')
      .select('entity_type, entity_id, local_snapshot, remote_snapshot')
      .eq('workspace_id', workspaceId)
      .gte('detected_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
      .limit(1000);

    if (recentConflicts) {
      for (const conflict of recentConflicts) {
        const cacheKey = `${conflict.entity_type}:${conflict.entity_id}:${Date.now() / 60000 | 0}`;
        
        // Simulate conflict detection to populate cache
        const detection = await this.conflictResolver.detectConflicts(
          conflict.local_snapshot,
          conflict.remote_snapshot
        );
        
        this.resultCache.set(cacheKey, detection);
      }
    }
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  clearCache(): void {
    this.resultCache.clear();
    this.hashCache.clear();
  }

  async cleanup(): Promise<void> {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    
    await this.conflictQueue.close();
  }
}

// Export singleton instance
export const conflictPerformanceOptimizer = new ConflictResolutionPerformanceOptimizer(
  new ConflictResolver(),
  {
    maxConcurrency: 20,
    cacheSize: 20000,
    hashCacheSize: 100000
  }
);