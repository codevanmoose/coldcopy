import { createClient } from '@/lib/supabase/server';
import { QueryOptimizer, ConnectionPoolMonitor } from './query-optimizer';

export interface PerformanceAlert {
  id: string;
  type: 'warning' | 'error' | 'critical';
  category: 'query' | 'connection' | 'storage' | 'memory' | 'rate_limit';
  message: string;
  details: Record<string, any>;
  threshold?: number;
  currentValue?: number;
  timestamp: Date;
  resolved?: boolean;
}

export interface PerformanceSnapshot {
  timestamp: Date;
  metrics: {
    // Database metrics
    connectionCount: number;
    activeQueries: number;
    slowQueries: number;
    cacheHitRatio: number;
    databaseSize: string;
    
    // Application metrics
    responseTime: number;
    errorRate: number;
    requestRate: number;
    
    // Resource metrics
    memoryUsage?: number;
    cpuUsage?: number;
    diskUsage?: number;
  };
  alerts: PerformanceAlert[];
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private alerts: PerformanceAlert[] = [];
  private snapshots: PerformanceSnapshot[] = [];
  private isRunning = false;
  private intervalId?: NodeJS.Timeout;

  // Configuration thresholds
  private readonly thresholds = {
    connectionUtilization: 80, // 80% of max connections
    slowQueryThreshold: 1000, // 1 second
    cacheHitRatio: 95, // 95% minimum
    responseTime: 2000, // 2 seconds
    errorRate: 5, // 5% maximum
    diskUsage: 85, // 85% maximum
  };

  private constructor() {}

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Start performance monitoring
   */
  start(intervalMs: number = 60000): void {
    if (this.isRunning) {
      console.warn('Performance monitor is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting performance monitoring...');

    // Initial snapshot
    this.captureSnapshot();

    // Schedule regular snapshots
    this.intervalId = setInterval(() => {
      this.captureSnapshot();
    }, intervalMs);
  }

  /**
   * Stop performance monitoring
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    console.log('Performance monitoring stopped');
  }

  /**
   * Capture a performance snapshot
   */
  private async captureSnapshot(): Promise<void> {
    try {
      const timestamp = new Date();
      console.log(`Capturing performance snapshot at ${timestamp.toISOString()}`);

      // Collect metrics
      const metrics = await this.collectMetrics();
      
      // Check for alerts
      const alerts = await this.checkAlerts(metrics);
      
      // Create snapshot
      const snapshot: PerformanceSnapshot = {
        timestamp,
        metrics,
        alerts,
      };

      // Store snapshot
      this.snapshots.push(snapshot);
      
      // Keep only last 100 snapshots
      if (this.snapshots.length > 100) {
        this.snapshots = this.snapshots.slice(-100);
      }

      // Store in database for persistence
      await this.persistSnapshot(snapshot);

      // Process alerts
      for (const alert of alerts) {
        await this.processAlert(alert);
      }

    } catch (error) {
      console.error('Failed to capture performance snapshot:', error);
    }
  }

  /**
   * Collect performance metrics
   */
  private async collectMetrics(): Promise<PerformanceSnapshot['metrics']> {
    const [
      connectionStats,
      slowQueries,
      databaseMetrics,
    ] = await Promise.all([
      ConnectionPoolMonitor.getPoolStats(),
      QueryOptimizer.findSlowQueries(this.thresholds.slowQueryThreshold),
      this.getDatabaseMetrics(),
    ]);

    return {
      connectionCount: connectionStats.totalConnections,
      activeQueries: connectionStats.activeConnections,
      slowQueries: slowQueries.length,
      cacheHitRatio: databaseMetrics.cacheHitRatio || 0,
      databaseSize: databaseMetrics.databaseSize || '0',
      responseTime: await this.getAverageResponseTime(),
      errorRate: await this.getErrorRate(),
      requestRate: await this.getRequestRate(),
    };
  }

  /**
   * Check for performance alerts
   */
  private async checkAlerts(metrics: PerformanceSnapshot['metrics']): Promise<PerformanceAlert[]> {
    const alerts: PerformanceAlert[] = [];

    // Connection utilization alert
    const connectionUtilization = (metrics.connectionCount / 100) * 100; // Assuming max 100 connections
    if (connectionUtilization > this.thresholds.connectionUtilization) {
      alerts.push({
        id: `connection-${Date.now()}`,
        type: connectionUtilization > 95 ? 'critical' : 'warning',
        category: 'connection',
        message: `High connection utilization: ${connectionUtilization.toFixed(1)}%`,
        details: {
          current: connectionUtilization,
          threshold: this.thresholds.connectionUtilization,
          totalConnections: metrics.connectionCount,
        },
        threshold: this.thresholds.connectionUtilization,
        currentValue: connectionUtilization,
        timestamp: new Date(),
      });
    }

    // Slow queries alert
    if (metrics.slowQueries > 0) {
      alerts.push({
        id: `slow-queries-${Date.now()}`,
        type: metrics.slowQueries > 10 ? 'critical' : 'warning',
        category: 'query',
        message: `${metrics.slowQueries} slow queries detected`,
        details: {
          count: metrics.slowQueries,
          threshold: this.thresholds.slowQueryThreshold,
        },
        threshold: 0,
        currentValue: metrics.slowQueries,
        timestamp: new Date(),
      });
    }

    // Cache hit ratio alert
    if (metrics.cacheHitRatio < this.thresholds.cacheHitRatio) {
      alerts.push({
        id: `cache-${Date.now()}`,
        type: metrics.cacheHitRatio < 90 ? 'critical' : 'warning',
        category: 'memory',
        message: `Low cache hit ratio: ${metrics.cacheHitRatio.toFixed(1)}%`,
        details: {
          current: metrics.cacheHitRatio,
          threshold: this.thresholds.cacheHitRatio,
        },
        threshold: this.thresholds.cacheHitRatio,
        currentValue: metrics.cacheHitRatio,
        timestamp: new Date(),
      });
    }

    // Response time alert
    if (metrics.responseTime > this.thresholds.responseTime) {
      alerts.push({
        id: `response-time-${Date.now()}`,
        type: metrics.responseTime > 5000 ? 'critical' : 'warning',
        category: 'query',
        message: `High response time: ${metrics.responseTime}ms`,
        details: {
          current: metrics.responseTime,
          threshold: this.thresholds.responseTime,
        },
        threshold: this.thresholds.responseTime,
        currentValue: metrics.responseTime,
        timestamp: new Date(),
      });
    }

    // Error rate alert
    if (metrics.errorRate > this.thresholds.errorRate) {
      alerts.push({
        id: `error-rate-${Date.now()}`,
        type: metrics.errorRate > 10 ? 'critical' : 'warning',
        category: 'rate_limit',
        message: `High error rate: ${metrics.errorRate.toFixed(1)}%`,
        details: {
          current: metrics.errorRate,
          threshold: this.thresholds.errorRate,
        },
        threshold: this.thresholds.errorRate,
        currentValue: metrics.errorRate,
        timestamp: new Date(),
      });
    }

    return alerts;
  }

  /**
   * Process an alert (send notifications, log, etc.)
   */
  private async processAlert(alert: PerformanceAlert): Promise<void> {
    console.warn(`Performance Alert [${alert.type.toUpperCase()}]:`, alert.message);
    
    // Add to internal alerts list
    this.alerts.push(alert);
    
    // Keep only last 50 alerts
    if (this.alerts.length > 50) {
      this.alerts = this.alerts.slice(-50);
    }

    // Store alert in database
    try {
      const supabase = createClient();
      await supabase.from('performance_alerts').insert({
        type: alert.type,
        category: alert.category,
        message: alert.message,
        details: alert.details,
        threshold: alert.threshold,
        current_value: alert.currentValue,
        created_at: alert.timestamp.toISOString(),
      });
    } catch (error) {
      console.error('Failed to store performance alert:', error);
    }

    // Send notifications for critical alerts
    if (alert.type === 'critical') {
      await this.sendCriticalAlertNotification(alert);
    }
  }

  /**
   * Send notification for critical alerts
   */
  private async sendCriticalAlertNotification(alert: PerformanceAlert): Promise<void> {
    // This would integrate with notification services like:
    // - Email alerts
    // - Slack notifications
    // - SMS alerts
    // - PagerDuty

    console.error(`CRITICAL ALERT: ${alert.message}`);
    
    // For now, just log the alert
    // In production, you would implement actual notification logic
  }

  /**
   * Get recent snapshots
   */
  getRecentSnapshots(count: number = 10): PerformanceSnapshot[] {
    return this.snapshots.slice(-count);
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): PerformanceAlert[] {
    return this.alerts.filter(alert => !alert.resolved);
  }

  /**
   * Get performance trends
   */
  getPerformanceTrends(hours: number = 24): {
    timestamps: string[];
    responseTime: number[];
    errorRate: number[];
    connectionCount: number[];
    cacheHitRatio: number[];
  } {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const recentSnapshots = this.snapshots.filter(s => s.timestamp > cutoff);

    return {
      timestamps: recentSnapshots.map(s => s.timestamp.toISOString()),
      responseTime: recentSnapshots.map(s => s.metrics.responseTime),
      errorRate: recentSnapshots.map(s => s.metrics.errorRate),
      connectionCount: recentSnapshots.map(s => s.metrics.connectionCount),
      cacheHitRatio: recentSnapshots.map(s => s.metrics.cacheHitRatio),
    };
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport(hours: number = 24): {
    summary: Record<string, any>;
    alerts: PerformanceAlert[];
    trends: ReturnType<typeof this.getPerformanceTrends>;
    recommendations: string[];
  } {
    const trends = this.getPerformanceTrends(hours);
    const recentAlerts = this.alerts.filter(
      alert => alert.timestamp > new Date(Date.now() - hours * 60 * 60 * 1000)
    );

    const summary = {
      avgResponseTime: trends.responseTime.reduce((a, b) => a + b, 0) / trends.responseTime.length || 0,
      avgErrorRate: trends.errorRate.reduce((a, b) => a + b, 0) / trends.errorRate.length || 0,
      avgConnectionCount: trends.connectionCount.reduce((a, b) => a + b, 0) / trends.connectionCount.length || 0,
      avgCacheHitRatio: trends.cacheHitRatio.reduce((a, b) => a + b, 0) / trends.cacheHitRatio.length || 0,
      totalAlerts: recentAlerts.length,
      criticalAlerts: recentAlerts.filter(a => a.type === 'critical').length,
    };

    const recommendations = this.generateRecommendations(summary, recentAlerts);

    return {
      summary,
      alerts: recentAlerts,
      trends,
      recommendations,
    };
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(summary: any, alerts: PerformanceAlert[]): string[] {
    const recommendations: string[] = [];

    if (summary.avgResponseTime > this.thresholds.responseTime) {
      recommendations.push('Consider optimizing slow queries and adding indexes');
    }

    if (summary.avgCacheHitRatio < this.thresholds.cacheHitRatio) {
      recommendations.push('Increase database buffer cache size or optimize query patterns');
    }

    if (summary.avgConnectionCount > 50) {
      recommendations.push('Consider implementing connection pooling or reducing connection overhead');
    }

    if (alerts.filter(a => a.category === 'query').length > 5) {
      recommendations.push('Review and optimize frequently executed slow queries');
    }

    if (summary.avgErrorRate > this.thresholds.errorRate) {
      recommendations.push('Investigate and fix sources of application errors');
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance is within acceptable thresholds');
    }

    return recommendations;
  }

  // Helper methods for metric collection

  private async getDatabaseMetrics() {
    const supabase = createClient();
    const { data } = await supabase.rpc('get_database_metrics');
    return data?.[0] || {};
  }

  private async getAverageResponseTime(): Promise<number> {
    // This would be collected from application metrics
    // For now, return a simulated value
    return Math.random() * 1000 + 500;
  }

  private async getErrorRate(): Promise<number> {
    // This would be collected from application logs
    // For now, return a simulated value
    return Math.random() * 5;
  }

  private async getRequestRate(): Promise<number> {
    // This would be collected from web server logs
    // For now, return a simulated value
    return Math.random() * 100 + 50;
  }

  private async persistSnapshot(snapshot: PerformanceSnapshot): Promise<void> {
    try {
      const supabase = createClient();
      await supabase.from('performance_snapshots').insert({
        timestamp: snapshot.timestamp.toISOString(),
        metrics: snapshot.metrics,
        alert_count: snapshot.alerts.length,
      });
    } catch (error) {
      console.error('Failed to persist performance snapshot:', error);
    }
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();