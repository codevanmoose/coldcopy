/**
 * Performance Monitoring and CI/CD Integration for ColdCopy Load Tests
 * 
 * Provides:
 * - Performance metrics collection and analysis
 * - CI/CD pipeline integration
 * - Performance regression detection
 * - Automated alerting and reporting
 * - Scalability recommendations
 */

import { check, sleep } from 'k6';
import http from 'k6/http';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import {
  BASE_URL,
  TestData,
  PerformanceMonitor,
} from './k6-config.js';

// Performance monitoring metrics
const performanceScore = new Gauge('performance_score');
const regressionDetected = new Rate('performance_regression_detected');
const scalabilityIndex = new Gauge('scalability_index');
const resourceUtilization = new Gauge('resource_utilization');
const performanceBaseline = new Gauge('performance_baseline');
const alertsTriggered = new Counter('alerts_triggered');

/**
 * Performance Monitoring Class
 * Handles collection, analysis, and reporting of performance data
 */
export class PerformanceMonitoringService {
  constructor() {
    this.metrics = new Map();
    this.baselines = new Map();
    this.thresholds = new Map();
    this.alerts = [];
    this.regressionThreshold = 0.2; // 20% degradation threshold
    this.setupBaselines();
  }

  /**
   * Setup performance baselines
   */
  setupBaselines() {
    this.baselines.set('api_response_time_p95', 2000); // 2s
    this.baselines.set('db_query_time_p95', 1000); // 1s
    this.baselines.set('email_processing_time_p95', 10000); // 10s
    this.baselines.set('webhook_processing_time_p95', 2000); // 2s
    this.baselines.set('gdpr_processing_time_p95', 10000); // 10s
    this.baselines.set('error_rate', 0.05); // 5%
    this.baselines.set('throughput_rps', 10); // 10 requests per second
  }

  /**
   * Collect metrics from various test components
   */
  collectMetrics(testResults) {
    const metrics = {
      timestamp: new Date().toISOString(),
      test_type: testResults.test_type,
      duration: testResults.duration,
      virtual_users: testResults.virtual_users,
      
      // Response time metrics
      api_response_time_avg: testResults.api_response_time?.avg || 0,
      api_response_time_p95: testResults.api_response_time?.p95 || 0,
      api_response_time_p99: testResults.api_response_time?.p99 || 0,
      
      // Database metrics
      db_query_time_avg: testResults.db_query_time?.avg || 0,
      db_query_time_p95: testResults.db_query_time?.p95 || 0,
      db_connection_time_avg: testResults.db_connection_time?.avg || 0,
      
      // Email processing metrics
      email_processing_time_avg: testResults.email_processing_time?.avg || 0,
      email_processing_time_p95: testResults.email_processing_time?.p95 || 0,
      email_send_success_rate: testResults.email_send_success_rate || 0,
      
      // Billing metrics
      billing_processing_time_avg: testResults.billing_processing_time?.avg || 0,
      webhook_processing_time_p95: testResults.webhook_processing_time?.p95 || 0,
      payment_success_rate: testResults.payment_success_rate || 0,
      
      // GDPR metrics
      gdpr_processing_time_p95: testResults.gdpr_processing_time?.p95 || 0,
      data_export_time_avg: testResults.data_export_time?.avg || 0,
      
      // Error rates
      api_error_rate: testResults.api_error_rate || 0,
      db_error_rate: testResults.db_error_rate || 0,
      billing_error_rate: testResults.billing_error_rate || 0,
      
      // Throughput
      total_requests: testResults.total_requests || 0,
      requests_per_second: testResults.requests_per_second || 0,
      
      // Resource utilization (if available)
      cpu_usage: testResults.cpu_usage || 0,
      memory_usage: testResults.memory_usage || 0,
      disk_io: testResults.disk_io || 0,
      network_io: testResults.network_io || 0,
    };

    this.metrics.set(metrics.timestamp, metrics);
    return metrics;
  }

  /**
   * Detect performance regressions
   */
  detectRegressions(currentMetrics) {
    const regressions = [];
    
    for (const [metricName, baseline] of this.baselines.entries()) {
      const currentValue = currentMetrics[metricName];
      
      if (currentValue !== undefined) {
        let regressionDetected = false;
        let severity = 'info';
        
        // For time-based metrics (lower is better)
        if (metricName.includes('time') || metricName.includes('duration')) {
          const degradation = (currentValue - baseline) / baseline;
          if (degradation > this.regressionThreshold) {
            regressionDetected = true;
            severity = degradation > 0.5 ? 'critical' : 'warning';
          }
        }
        
        // For rate-based metrics (higher is better for success rates, lower for error rates)
        else if (metricName.includes('success_rate') || metricName.includes('throughput')) {
          const degradation = (baseline - currentValue) / baseline;
          if (degradation > this.regressionThreshold) {
            regressionDetected = true;
            severity = degradation > 0.5 ? 'critical' : 'warning';
          }
        }
        
        // For error rates (lower is better)
        else if (metricName.includes('error_rate')) {
          const increase = (currentValue - baseline) / baseline;
          if (increase > this.regressionThreshold && currentValue > baseline) {
            regressionDetected = true;
            severity = increase > 1.0 ? 'critical' : 'warning';
          }
        }
        
        if (regressionDetected) {
          regressions.push({
            metric: metricName,
            baseline: baseline,
            current: currentValue,
            degradation: Math.abs((currentValue - baseline) / baseline * 100),
            severity: severity,
            timestamp: new Date().toISOString(),
          });
          
          regressionDetected.add(1);
        }
      }
    }
    
    return regressions;
  }

  /**
   * Calculate performance score
   */
  calculatePerformanceScore(metrics) {
    const weights = {
      api_response_time_p95: 0.25,
      db_query_time_p95: 0.20,
      email_processing_time_p95: 0.15,
      api_error_rate: 0.15,
      requests_per_second: 0.10,
      payment_success_rate: 0.10,
      gdpr_processing_time_p95: 0.05,
    };
    
    let score = 100;
    
    for (const [metric, weight] of Object.entries(weights)) {
      const baseline = this.baselines.get(metric);
      const current = metrics[metric];
      
      if (baseline && current !== undefined) {
        let metricScore = 100;
        
        // Calculate metric score based on performance vs baseline
        if (metric.includes('time') || metric.includes('duration')) {
          metricScore = Math.max(0, 100 - ((current - baseline) / baseline * 100));
        } else if (metric.includes('success_rate') || metric.includes('throughput')) {
          metricScore = Math.min(100, (current / baseline) * 100);
        } else if (metric.includes('error_rate')) {
          metricScore = Math.max(0, 100 - (current / baseline * 100));
        }
        
        score -= (100 - metricScore) * weight;
      }
    }
    
    performanceScore.add(Math.max(0, score));
    return Math.max(0, score);
  }

  /**
   * Generate scalability recommendations
   */
  generateScalabilityRecommendations(metrics) {
    const recommendations = [];
    
    // Database performance recommendations
    if (metrics.db_query_time_p95 > 2000) {
      recommendations.push({
        category: 'database',
        severity: 'high',
        issue: 'Database query performance degradation',
        recommendation: 'Consider query optimization, index tuning, or database scaling',
        metric_value: metrics.db_query_time_p95,
        threshold: 2000,
      });
    }
    
    if (metrics.db_connection_time_avg > 1000) {
      recommendations.push({
        category: 'database',
        severity: 'medium',
        issue: 'Database connection pool exhaustion',
        recommendation: 'Increase connection pool size or implement connection pooling optimization',
        metric_value: metrics.db_connection_time_avg,
        threshold: 1000,
      });
    }
    
    // API performance recommendations
    if (metrics.api_response_time_p95 > 3000) {
      recommendations.push({
        category: 'api',
        severity: 'high',
        issue: 'API response time degradation',
        recommendation: 'Implement caching, optimize business logic, or scale API servers',
        metric_value: metrics.api_response_time_p95,
        threshold: 3000,
      });
    }
    
    // Email processing recommendations
    if (metrics.email_processing_time_p95 > 15000) {
      recommendations.push({
        category: 'email',
        severity: 'medium',
        issue: 'Email processing bottleneck',
        recommendation: 'Implement email queue optimization or scale email processing workers',
        metric_value: metrics.email_processing_time_p95,
        threshold: 15000,
      });
    }
    
    // Error rate recommendations
    if (metrics.api_error_rate > 0.1) {
      recommendations.push({
        category: 'reliability',
        severity: 'critical',
        issue: 'High error rate detected',
        recommendation: 'Investigate error causes, implement circuit breakers, and improve error handling',
        metric_value: metrics.api_error_rate,
        threshold: 0.1,
      });
    }
    
    // Throughput recommendations
    if (metrics.requests_per_second < 5) {
      recommendations.push({
        category: 'scalability',
        severity: 'medium',
        issue: 'Low throughput capacity',
        recommendation: 'Scale application servers, optimize resource allocation, or implement load balancing',
        metric_value: metrics.requests_per_second,
        threshold: 5,
      });
    }
    
    // Resource utilization recommendations
    if (metrics.cpu_usage > 80) {
      recommendations.push({
        category: 'resources',
        severity: 'high',
        issue: 'High CPU utilization',
        recommendation: 'Scale CPU resources or optimize CPU-intensive operations',
        metric_value: metrics.cpu_usage,
        threshold: 80,
      });
    }
    
    if (metrics.memory_usage > 85) {
      recommendations.push({
        category: 'resources',
        severity: 'high',
        issue: 'High memory utilization',
        recommendation: 'Scale memory resources or optimize memory usage patterns',
        metric_value: metrics.memory_usage,
        threshold: 85,
      });
    }
    
    return recommendations;
  }

  /**
   * Generate performance report
   */
  generateReport(metrics, regressions, recommendations) {
    const score = this.calculatePerformanceScore(metrics);
    
    const report = {
      summary: {
        timestamp: new Date().toISOString(),
        performance_score: score,
        test_type: metrics.test_type,
        duration: metrics.duration,
        virtual_users: metrics.virtual_users,
        regressions_count: regressions.length,
        recommendations_count: recommendations.length,
      },
      
      key_metrics: {
        api_response_time_p95: metrics.api_response_time_p95,
        db_query_time_p95: metrics.db_query_time_p95,
        email_processing_time_p95: metrics.email_processing_time_p95,
        api_error_rate: metrics.api_error_rate,
        requests_per_second: metrics.requests_per_second,
        payment_success_rate: metrics.payment_success_rate,
      },
      
      regressions: regressions,
      recommendations: recommendations,
      
      detailed_metrics: metrics,
    };
    
    return report;
  }

  /**
   * Send alerts based on performance issues
   */
  sendAlerts(regressions, recommendations) {
    const criticalIssues = [
      ...regressions.filter(r => r.severity === 'critical'),
      ...recommendations.filter(r => r.severity === 'critical')
    ];
    
    if (criticalIssues.length > 0) {
      alertsTriggered.add(criticalIssues.length);
      
      // In a real implementation, this would send alerts via:
      // - Slack/Teams notifications
      // - Email alerts
      // - PagerDuty/incident management
      // - Dashboard notifications
      
      console.log(`CRITICAL PERFORMANCE ALERT: ${criticalIssues.length} critical issues detected`);
      criticalIssues.forEach(issue => {
        console.log(`- ${issue.issue || issue.metric}: ${issue.recommendation || 'Performance degradation detected'}`);
      });
    }
  }
}

/**
 * CI/CD Integration utilities
 */
export class CICDIntegration {
  constructor() {
    this.buildId = __ENV.BUILD_ID || 'local';
    this.branch = __ENV.GIT_BRANCH || 'main';
    this.commitSha = __ENV.GIT_COMMIT || 'unknown';
    this.environment = __ENV.ENVIRONMENT || 'test';
  }

  /**
   * Determine if performance test should fail the build
   */
  shouldFailBuild(performanceReport) {
    const { summary, regressions, recommendations } = performanceReport;
    
    // Fail if performance score is too low
    if (summary.performance_score < 70) {
      return {
        should_fail: true,
        reason: `Performance score ${summary.performance_score} is below threshold (70)`,
      };
    }
    
    // Fail if critical regressions detected
    const criticalRegressions = regressions.filter(r => r.severity === 'critical');
    if (criticalRegressions.length > 0) {
      return {
        should_fail: true,
        reason: `${criticalRegressions.length} critical performance regressions detected`,
        details: criticalRegressions,
      };
    }
    
    // Fail if too many critical recommendations
    const criticalRecommendations = recommendations.filter(r => r.severity === 'critical');
    if (criticalRecommendations.length > 2) {
      return {
        should_fail: true,
        reason: `${criticalRecommendations.length} critical performance issues require immediate attention`,
        details: criticalRecommendations,
      };
    }
    
    return { should_fail: false };
  }

  /**
   * Upload test results to external systems
   */
  uploadResults(performanceReport) {
    const uploadTargets = [
      () => this.uploadToDatadog(performanceReport),
      () => this.uploadToElastic(performanceReport),
      () => this.uploadToCustomDashboard(performanceReport),
      () => this.uploadToArtifacts(performanceReport),
    ];
    
    uploadTargets.forEach(upload => {
      try {
        upload();
      } catch (error) {
        console.log(`Failed to upload results: ${error.message}`);
      }
    });
  }

  uploadToDatadog(report) {
    // Example Datadog integration
    const metrics = {
      'coldcopy.performance.score': report.summary.performance_score,
      'coldcopy.performance.api_response_time': report.key_metrics.api_response_time_p95,
      'coldcopy.performance.db_query_time': report.key_metrics.db_query_time_p95,
      'coldcopy.performance.error_rate': report.key_metrics.api_error_rate,
      'coldcopy.performance.throughput': report.key_metrics.requests_per_second,
    };
    
    // In real implementation, use Datadog API
    console.log('Uploading metrics to Datadog:', Object.keys(metrics).length);
  }

  uploadToElastic(report) {
    // Example Elasticsearch integration
    const document = {
      '@timestamp': report.summary.timestamp,
      build_id: this.buildId,
      branch: this.branch,
      commit_sha: this.commitSha,
      environment: this.environment,
      performance_report: report,
    };
    
    // In real implementation, use Elasticsearch API
    console.log('Uploading document to Elasticsearch');
  }

  uploadToCustomDashboard(report) {
    // Upload to custom performance dashboard
    console.log('Uploading to custom performance dashboard');
  }

  uploadToArtifacts(report) {
    // Save as CI/CD artifacts
    const reportJson = JSON.stringify(report, null, 2);
    console.log(`Performance report size: ${reportJson.length} characters`);
    
    // In real implementation, save to artifacts directory
    // fs.writeFileSync(`performance-report-${this.buildId}.json`, reportJson);
  }

  /**
   * Generate CI/CD summary comment
   */
  generateCISummary(performanceReport, buildDecision) {
    const { summary, regressions, recommendations } = performanceReport;
    
    let status = '✅ PASSED';
    if (buildDecision.should_fail) {
      status = '❌ FAILED';
    } else if (regressions.length > 0 || recommendations.length > 0) {
      status = '⚠️ PASSED WITH WARNINGS';
    }
    
    return `
## Performance Test Results ${status}

**Performance Score:** ${summary.performance_score.toFixed(1)}/100

**Key Metrics:**
- API Response Time (P95): ${summary.key_metrics?.api_response_time_p95 || 'N/A'}ms
- Database Query Time (P95): ${summary.key_metrics?.db_query_time_p95 || 'N/A'}ms
- Error Rate: ${((summary.key_metrics?.api_error_rate || 0) * 100).toFixed(2)}%
- Throughput: ${summary.key_metrics?.requests_per_second || 'N/A'} req/s

**Issues Found:**
- ${regressions.length} performance regressions
- ${recommendations.length} scalability recommendations

${buildDecision.should_fail ? `**Build Failed:** ${buildDecision.reason}` : ''}

**Build Info:**
- Branch: ${this.branch}
- Commit: ${this.commitSha}
- Environment: ${this.environment}
    `.trim();
  }
}

/**
 * Main performance monitoring function
 * Call this at the end of your load tests
 */
export function runPerformanceMonitoring(testResults) {
  const monitor = new PerformanceMonitoringService();
  const cicd = new CICDIntegration();
  
  // Collect and analyze metrics
  const metrics = monitor.collectMetrics(testResults);
  const regressions = monitor.detectRegressions(metrics);
  const recommendations = monitor.generateScalabilityRecommendations(metrics);
  
  // Generate comprehensive report
  const report = monitor.generateReport(metrics, regressions, recommendations);
  
  // Send alerts if necessary
  monitor.sendAlerts(regressions, recommendations);
  
  // CI/CD integration
  const buildDecision = cicd.shouldFailBuild(report);
  cicd.uploadResults(report);
  
  const summary = cicd.generateCISummary(report, buildDecision);
  console.log(summary);
  
  // Update K6 metrics for dashboard display
  performanceScore.add(report.summary.performance_score);
  scalabilityIndex.add(Math.max(0, 100 - recommendations.length * 10));
  
  return {
    report,
    buildDecision,
    summary,
  };
}

// Export the classes and utilities
export default {
  PerformanceMonitoringService,
  CICDIntegration,
  runPerformanceMonitoring,
  performanceScore,
  regressionDetected,
  scalabilityIndex,
  resourceUtilization,
  performanceBaseline,
  alertsTriggered,
};