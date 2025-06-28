import { createClient } from '@/lib/supabase/server';

export interface QueryMetrics {
  query: string;
  executionTime: number;
  rowCount: number;
  planningTime?: number;
  bufferHits?: number;
  bufferMisses?: number;
  tempBlocks?: number;
  cost?: number;
  indexUsed?: boolean;
  suggestions?: string[];
}

export interface TableStats {
  tableName: string;
  rowCount: number;
  tableSize: string;
  indexSize: string;
  totalSize: string;
  lastVacuum?: string;
  lastAnalyze?: string;
  deadTuples?: number;
  liveTuples?: number;
}

export interface IndexStats {
  indexName: string;
  tableName: string;
  indexSize: string;
  indexScans: number;
  indexReads: number;
  indexHitRate: number;
  isUnique: boolean;
  isPrimary: boolean;
  columns: string[];
}

export class QueryOptimizer {
  /**
   * Analyze query performance using EXPLAIN ANALYZE
   */
  static async analyzeQuery(query: string): Promise<QueryMetrics> {
    const supabase = createClient();
    const startTime = Date.now();
    
    try {
      // Run EXPLAIN ANALYZE
      const { data: explainData } = await supabase.rpc('analyze_query', {
        query_text: `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`
      });
      
      const executionTime = Date.now() - startTime;
      const plan = explainData?.[0]?.['QUERY PLAN']?.[0];
      
      if (!plan) {
        throw new Error('Failed to get query plan');
      }
      
      // Extract metrics from plan
      const metrics: QueryMetrics = {
        query,
        executionTime,
        rowCount: plan['Actual Rows'] || 0,
        planningTime: plan['Planning Time'],
        bufferHits: plan['Shared Hit Blocks'],
        bufferMisses: plan['Shared Read Blocks'],
        tempBlocks: plan['Temp Written Blocks'],
        cost: plan['Total Cost'],
        indexUsed: this.checkIndexUsage(plan),
        suggestions: this.generateSuggestions(plan, query),
      };
      
      return metrics;
    } catch (error) {
      console.error('Query analysis failed:', error);
      throw error;
    }
  }

  /**
   * Get statistics for all tables
   */
  static async getTableStats(): Promise<TableStats[]> {
    const supabase = createClient();
    
    const { data, error } = await supabase.rpc('get_table_stats');
    
    if (error) {
      throw new Error(`Failed to get table stats: ${error.message}`);
    }
    
    return data || [];
  }

  /**
   * Get index usage statistics
   */
  static async getIndexStats(): Promise<IndexStats[]> {
    const supabase = createClient();
    
    const { data, error } = await supabase.rpc('get_index_stats');
    
    if (error) {
      throw new Error(`Failed to get index stats: ${error.message}`);
    }
    
    return data || [];
  }

  /**
   * Find slow queries from pg_stat_statements
   */
  static async findSlowQueries(thresholdMs: number = 1000): Promise<QueryMetrics[]> {
    const supabase = createClient();
    
    const { data, error } = await supabase.rpc('get_slow_queries', {
      threshold_ms: thresholdMs
    });
    
    if (error) {
      throw new Error(`Failed to get slow queries: ${error.message}`);
    }
    
    return data || [];
  }

  /**
   * Suggest missing indexes based on query patterns
   */
  static async suggestIndexes(): Promise<Array<{
    table: string;
    columns: string[];
    reason: string;
    estimatedImprovement: string;
  }>> {
    const supabase = createClient();
    
    const { data, error } = await supabase.rpc('suggest_indexes');
    
    if (error) {
      throw new Error(`Failed to get index suggestions: ${error.message}`);
    }
    
    return data || [];
  }

  /**
   * Check if query uses indexes
   */
  private static checkIndexUsage(plan: any): boolean {
    const nodeType = plan['Node Type'];
    return nodeType?.includes('Index') || false;
  }

  /**
   * Generate optimization suggestions based on query plan
   */
  private static generateSuggestions(plan: any, query: string): string[] {
    const suggestions: string[] = [];
    
    // Check for sequential scans on large tables
    if (plan['Node Type'] === 'Seq Scan' && plan['Actual Rows'] > 10000) {
      suggestions.push(`Consider adding an index on the WHERE clause columns for table ${plan['Relation Name']}`);
    }
    
    // Check for missing joins
    if (plan['Join Type'] === 'Nested Loop' && plan['Actual Rows'] > 1000) {
      suggestions.push('Consider using a hash join or merge join for better performance on large datasets');
    }
    
    // Check for sort operations
    if (plan['Node Type'] === 'Sort' && plan['Sort Space Used'] > 1024) {
      suggestions.push('Consider adding an index on the ORDER BY columns to avoid sorting');
    }
    
    // Check buffer misses
    if (plan['Shared Read Blocks'] > plan['Shared Hit Blocks']) {
      suggestions.push('Low buffer cache hit rate. Consider increasing shared_buffers or warming the cache');
    }
    
    // Check for DISTINCT operations
    if (query.toLowerCase().includes('distinct') && plan['Actual Rows'] > 1000) {
      suggestions.push('DISTINCT on large result sets is expensive. Consider using GROUP BY or rethinking the query');
    }
    
    // Check for subqueries
    if (plan['Node Type'] === 'SubPlan' || query.toLowerCase().includes('in (select')) {
      suggestions.push('Consider rewriting subqueries as JOINs for better performance');
    }
    
    return suggestions;
  }
}

/**
 * Performance monitoring utilities
 */
export class PerformanceMonitor {
  private static timers = new Map<string, number>();
  private static metrics = new Map<string, number[]>();

  /**
   * Start timing an operation
   */
  static startTimer(name: string): void {
    this.timers.set(name, performance.now());
  }

  /**
   * End timing and record the duration
   */
  static endTimer(name: string): number {
    const startTime = this.timers.get(name);
    if (!startTime) {
      console.warn(`Timer ${name} was not started`);
      return 0;
    }
    
    const duration = performance.now() - startTime;
    this.timers.delete(name);
    
    // Record metric
    const metrics = this.metrics.get(name) || [];
    metrics.push(duration);
    this.metrics.set(name, metrics);
    
    return duration;
  }

  /**
   * Get performance statistics for a metric
   */
  static getStats(name: string): {
    count: number;
    min: number;
    max: number;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  } | null {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) {
      return null;
    }
    
    const sorted = [...values].sort((a, b) => a - b);
    const count = sorted.length;
    
    return {
      count,
      min: sorted[0],
      max: sorted[count - 1],
      avg: values.reduce((a, b) => a + b, 0) / count,
      p50: sorted[Math.floor(count * 0.5)],
      p95: sorted[Math.floor(count * 0.95)],
      p99: sorted[Math.floor(count * 0.99)],
    };
  }

  /**
   * Clear all metrics
   */
  static clearMetrics(): void {
    this.metrics.clear();
  }

  /**
   * Export metrics for analysis
   */
  static exportMetrics(): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const [name, values] of this.metrics.entries()) {
      result[name] = {
        raw: values,
        stats: this.getStats(name),
      };
    }
    
    return result;
  }
}

/**
 * Database connection pool monitor
 */
export class ConnectionPoolMonitor {
  /**
   * Get connection pool statistics
   */
  static async getPoolStats(): Promise<{
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    waitingClients: number;
    maxConnections: number;
  }> {
    const supabase = createClient();
    
    const { data, error } = await supabase.rpc('get_connection_pool_stats');
    
    if (error) {
      throw new Error(`Failed to get pool stats: ${error.message}`);
    }
    
    return data?.[0] || {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingClients: 0,
      maxConnections: 0,
    };
  }

  /**
   * Check for connection leaks
   */
  static async checkConnectionLeaks(): Promise<{
    potentialLeaks: Array<{
      pid: number;
      duration: string;
      state: string;
      query: string;
    }>;
  }> {
    const supabase = createClient();
    
    // Find connections idle for more than 5 minutes
    const { data, error } = await supabase.rpc('find_idle_connections', {
      idle_threshold_minutes: 5
    });
    
    if (error) {
      throw new Error(`Failed to check connection leaks: ${error.message}`);
    }
    
    return {
      potentialLeaks: data || [],
    };
  }
}

/**
 * Cache performance utilities
 */
export class CachePerformance {
  /**
   * Calculate cache hit rate
   */
  static calculateHitRate(hits: number, misses: number): number {
    const total = hits + misses;
    if (total === 0) return 0;
    return (hits / total) * 100;
  }

  /**
   * Get Redis cache statistics
   */
  static async getRedisCacheStats(): Promise<{
    hitRate: number;
    memoryUsed: string;
    evictedKeys: number;
    connectedClients: number;
    commandsProcessed: number;
  }> {
    // This would connect to Redis and get INFO stats
    // Placeholder implementation
    return {
      hitRate: 0,
      memoryUsed: '0MB',
      evictedKeys: 0,
      connectedClients: 0,
      commandsProcessed: 0,
    };
  }
}