import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

// Create a registry for metrics
export const register = new Registry();

// Collect default metrics (CPU, memory, etc.)
collectDefaultMetrics({ register });

// HTTP request metrics
export const httpRequestsTotal = new Counter({
  name: 'coldcopy_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'workspace_id'],
  registers: [register],
});

export const httpRequestDuration = new Histogram({
  name: 'coldcopy_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

// Database metrics
export const databaseConnectionsActive = new Gauge({
  name: 'coldcopy_database_connections_active',
  help: 'Number of active database connections',
  registers: [register],
});

export const databaseQueryDuration = new Histogram({
  name: 'coldcopy_database_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

export const databaseConnectionPoolSize = new Gauge({
  name: 'coldcopy_database_connection_pool_size',
  help: 'Size of database connection pool',
  labelNames: ['pool_type'],
  registers: [register],
});

// Email metrics
export const emailsSentTotal = new Counter({
  name: 'coldcopy_emails_sent_total',
  help: 'Total number of emails sent',
  labelNames: ['workspace_id', 'campaign_id', 'status'],
  registers: [register],
});

export const emailDeliveryTime = new Histogram({
  name: 'coldcopy_email_delivery_time_seconds',
  help: 'Time taken to deliver emails',
  labelNames: ['provider'],
  buckets: [1, 5, 10, 30, 60, 300],
  registers: [register],
});

export const emailQueueSize = new Gauge({
  name: 'coldcopy_email_queue_size',
  help: 'Number of emails in queue',
  labelNames: ['priority'],
  registers: [register],
});

// API usage metrics
export const apiRequestsByEndpoint = new Counter({
  name: 'coldcopy_api_requests_by_endpoint_total',
  help: 'API requests by endpoint',
  labelNames: ['endpoint', 'method', 'workspace_id'],
  registers: [register],
});

export const apiKeyUsage = new Counter({
  name: 'coldcopy_api_key_usage_total',
  help: 'API key usage count',
  labelNames: ['api_key_id', 'workspace_id'],
  registers: [register],
});

export const rateLimitHits = new Counter({
  name: 'coldcopy_rate_limit_hits_total',
  help: 'Number of rate limit hits',
  labelNames: ['endpoint', 'user_type'],
  registers: [register],
});

// Business metrics
export const activeWorkspaces = new Gauge({
  name: 'coldcopy_active_workspaces',
  help: 'Number of active workspaces',
  registers: [register],
});

export const leadsTotal = new Counter({
  name: 'coldcopy_leads_total',
  help: 'Total number of leads created',
  labelNames: ['workspace_id', 'source'],
  registers: [register],
});

export const campaignsActive = new Gauge({
  name: 'coldcopy_campaigns_active',
  help: 'Number of active campaigns',
  registers: [register],
});

export const subscriptionsByPlan = new Gauge({
  name: 'coldcopy_subscriptions_by_plan',
  help: 'Number of subscriptions by plan',
  labelNames: ['plan'],
  registers: [register],
});

// AI metrics
export const aiRequestsTotal = new Counter({
  name: 'coldcopy_ai_requests_total',
  help: 'Total AI requests',
  labelNames: ['provider', 'model', 'workspace_id'],
  registers: [register],
});

export const aiTokensUsed = new Counter({
  name: 'coldcopy_ai_tokens_used_total',
  help: 'Total AI tokens consumed',
  labelNames: ['provider', 'model', 'workspace_id'],
  registers: [register],
});

export const aiRequestDuration = new Histogram({
  name: 'coldcopy_ai_request_duration_seconds',
  help: 'Duration of AI requests',
  labelNames: ['provider', 'model'],
  buckets: [0.5, 1, 2, 5, 10, 30, 60],
  registers: [register],
});

// Cache metrics
export const cacheHits = new Counter({
  name: 'coldcopy_cache_hits_total',
  help: 'Cache hits',
  labelNames: ['cache_type'],
  registers: [register],
});

export const cacheMisses = new Counter({
  name: 'coldcopy_cache_misses_total',
  help: 'Cache misses',
  labelNames: ['cache_type'],
  registers: [register],
});

export const cacheSize = new Gauge({
  name: 'coldcopy_cache_size_bytes',
  help: 'Cache size in bytes',
  labelNames: ['cache_type'],
  registers: [register],
});

// Error metrics
export const errorsTotal = new Counter({
  name: 'coldcopy_errors_total',
  help: 'Total number of errors',
  labelNames: ['error_type', 'endpoint', 'severity'],
  registers: [register],
});

export const unhandledExceptions = new Counter({
  name: 'coldcopy_unhandled_exceptions_total',
  help: 'Unhandled exceptions',
  labelNames: ['error_class'],
  registers: [register],
});

// File upload metrics
export const fileUploadsTotal = new Counter({
  name: 'coldcopy_file_uploads_total',
  help: 'Total file uploads',
  labelNames: ['file_type', 'workspace_id'],
  registers: [register],
});

export const fileUploadSize = new Histogram({
  name: 'coldcopy_file_upload_size_bytes',
  help: 'File upload sizes',
  labelNames: ['file_type'],
  buckets: [1024, 10240, 102400, 1048576, 10485760, 104857600], // 1KB to 100MB
  registers: [register],
});

export const storageUsed = new Gauge({
  name: 'coldcopy_storage_used_bytes',
  help: 'Storage used by workspace',
  labelNames: ['workspace_id', 'storage_type'],
  registers: [register],
});

// Security metrics
export const authenticationAttempts = new Counter({
  name: 'coldcopy_authentication_attempts_total',
  help: 'Authentication attempts',
  labelNames: ['method', 'status'],
  registers: [register],
});

export const suspiciousActivity = new Counter({
  name: 'coldcopy_suspicious_activity_total',
  help: 'Suspicious activity detected',
  labelNames: ['activity_type', 'source_ip'],
  registers: [register],
});

// Utility functions for metrics collection
export class MetricsCollector {
  /**
   * Record HTTP request metrics
   */
  static recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    duration: number,
    workspaceId?: string
  ) {
    httpRequestsTotal
      .labels(method, route, statusCode.toString(), workspaceId || 'unknown')
      .inc();
    
    httpRequestDuration
      .labels(method, route, statusCode.toString())
      .observe(duration / 1000);
  }

  /**
   * Record database query metrics
   */
  static recordDatabaseQuery(
    operation: string,
    table: string,
    duration: number
  ) {
    databaseQueryDuration
      .labels(operation, table)
      .observe(duration / 1000);
  }

  /**
   * Record email metrics
   */
  static recordEmailSent(
    workspaceId: string,
    campaignId: string,
    status: string,
    deliveryTime?: number
  ) {
    emailsSentTotal
      .labels(workspaceId, campaignId, status)
      .inc();
    
    if (deliveryTime) {
      emailDeliveryTime
        .labels('ses') // or whatever provider
        .observe(deliveryTime / 1000);
    }
  }

  /**
   * Record API usage
   */
  static recordApiUsage(
    endpoint: string,
    method: string,
    workspaceId?: string,
    apiKeyId?: string
  ) {
    apiRequestsByEndpoint
      .labels(endpoint, method, workspaceId || 'unknown')
      .inc();
    
    if (apiKeyId) {
      apiKeyUsage
        .labels(apiKeyId, workspaceId || 'unknown')
        .inc();
    }
  }

  /**
   * Record AI usage
   */
  static recordAiUsage(
    provider: string,
    model: string,
    workspaceId: string,
    tokens: number,
    duration: number
  ) {
    aiRequestsTotal
      .labels(provider, model, workspaceId)
      .inc();
    
    aiTokensUsed
      .labels(provider, model, workspaceId)
      .inc(tokens);
    
    aiRequestDuration
      .labels(provider, model)
      .observe(duration / 1000);
  }

  /**
   * Record cache metrics
   */
  static recordCacheHit(cacheType: string) {
    cacheHits.labels(cacheType).inc();
  }

  static recordCacheMiss(cacheType: string) {
    cacheMisses.labels(cacheType).inc();
  }

  /**
   * Record errors
   */
  static recordError(
    errorType: string,
    endpoint: string,
    severity: string = 'error'
  ) {
    errorsTotal
      .labels(errorType, endpoint, severity)
      .inc();
  }

  /**
   * Update gauge metrics
   */
  static updateGaugeMetrics(metrics: {
    activeWorkspaces?: number;
    campaignsActive?: number;
    databaseConnections?: number;
    emailQueueSize?: number;
  }) {
    if (metrics.activeWorkspaces !== undefined) {
      activeWorkspaces.set(metrics.activeWorkspaces);
    }
    
    if (metrics.campaignsActive !== undefined) {
      campaignsActive.set(metrics.campaignsActive);
    }
    
    if (metrics.databaseConnections !== undefined) {
      databaseConnectionsActive.set(metrics.databaseConnections);
    }
    
    if (metrics.emailQueueSize !== undefined) {
      emailQueueSize.labels('default').set(metrics.emailQueueSize);
    }
  }

  /**
   * Get metrics for export
   */
  static async getMetrics(): Promise<string> {
    return register.metrics();
  }

  /**
   * Clear all metrics (useful for testing)
   */
  static clearMetrics() {
    register.clear();
  }
}