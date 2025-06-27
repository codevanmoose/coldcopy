/**
 * Scalability Analyzer for ColdCopy
 * 
 * Provides detailed scalability analysis and recommendations
 * based on load test results and system metrics
 */

import { Rate, Trend, Counter, Gauge } from 'k6/metrics';

// Scalability metrics
const scalabilityScore = new Gauge('scalability_score');
const capacityUtilization = new Gauge('capacity_utilization');
const bottleneckSeverity = new Gauge('bottleneck_severity');
const recommendationPriority = new Gauge('recommendation_priority');

/**
 * Scalability Analysis Engine
 */
export class ScalabilityAnalyzer {
  constructor() {
    this.analysisResults = new Map();
    this.recommendations = [];
    this.bottlenecks = [];
    this.capacityModel = new Map();
    
    this.setupCapacityBaselines();
  }

  /**
   * Setup capacity baselines for different components
   */
  setupCapacityBaselines() {
    this.capacityModel.set('api_server', {
      max_rps: 1000,
      max_concurrent_users: 500,
      max_cpu_usage: 80,
      max_memory_usage: 85,
    });

    this.capacityModel.set('database', {
      max_connections: 100,
      max_query_duration: 5000,
      max_transactions_per_second: 200,
      max_storage_iops: 3000,
    });

    this.capacityModel.set('email_service', {
      max_emails_per_hour: 10000,
      max_queue_depth: 1000,
      max_processing_time: 30000,
      max_bounce_rate: 0.05,
    });

    this.capacityModel.set('billing_service', {
      max_webhooks_per_second: 50,
      max_payment_processing_time: 10000,
      max_subscription_operations: 100,
      max_usage_tracking_latency: 1000,
    });

    this.capacityModel.set('gdpr_service', {
      max_export_size_mb: 1000,
      max_export_time_minutes: 30,
      max_deletion_records: 100000,
      max_audit_logs_per_second: 20,
    });
  }

  /**
   * Analyze scalability based on test results
   */
  analyzeScalability(testResults) {
    console.log('Running scalability analysis...');
    
    const analysis = {
      timestamp: new Date().toISOString(),
      overall_score: 0,
      component_scores: new Map(),
      bottlenecks: [],
      recommendations: [],
      capacity_analysis: new Map(),
      growth_projections: new Map(),
    };

    // Analyze each component
    this.analyzeAPIServerScalability(testResults, analysis);
    this.analyzeDatabaseScalability(testResults, analysis);
    this.analyzeEmailServiceScalability(testResults, analysis);
    this.analyzeBillingServiceScalability(testResults, analysis);
    this.analyzeGDPRServiceScalability(testResults, analysis);

    // Calculate overall scalability score
    analysis.overall_score = this.calculateOverallScore(analysis.component_scores);
    scalabilityScore.add(analysis.overall_score);

    // Generate growth projections
    this.generateGrowthProjections(testResults, analysis);

    // Identify critical bottlenecks
    this.identifyBottlenecks(analysis);

    // Generate actionable recommendations
    this.generateRecommendations(analysis);

    return analysis;
  }

  /**
   * Analyze API Server scalability
   */
  analyzeAPIServerScalability(testResults, analysis) {
    const apiMetrics = {
      current_rps: testResults.requests_per_second || 0,
      avg_response_time: testResults.api_response_time?.avg || 0,
      p95_response_time: testResults.api_response_time?.p95 || 0,
      error_rate: testResults.api_error_rate || 0,
      concurrent_users: testResults.virtual_users || 0,
      cpu_usage: testResults.cpu_usage || 0,
      memory_usage: testResults.memory_usage || 0,
    };

    const capacity = this.capacityModel.get('api_server');
    let score = 100;

    // Evaluate throughput capacity
    const throughputUtilization = apiMetrics.current_rps / capacity.max_rps;
    if (throughputUtilization > 0.8) {
      score -= 30;
      analysis.bottlenecks.push({
        component: 'api_server',
        type: 'throughput',
        severity: 'high',
        utilization: throughputUtilization,
        message: 'API server approaching throughput limits',
      });
    }

    // Evaluate response time degradation
    if (apiMetrics.p95_response_time > 3000) {
      score -= 25;
      analysis.bottlenecks.push({
        component: 'api_server',
        type: 'response_time',
        severity: 'medium',
        value: apiMetrics.p95_response_time,
        message: 'API response times degrading under load',
      });
    }

    // Evaluate error rate
    if (apiMetrics.error_rate > 0.05) {
      score -= 35;
      analysis.bottlenecks.push({
        component: 'api_server',
        type: 'error_rate',
        severity: 'critical',
        value: apiMetrics.error_rate,
        message: 'High error rate indicates scalability issues',
      });
    }

    // Evaluate resource utilization
    if (apiMetrics.cpu_usage > capacity.max_cpu_usage) {
      score -= 20;
      analysis.bottlenecks.push({
        component: 'api_server',
        type: 'cpu_usage',
        severity: 'high',
        value: apiMetrics.cpu_usage,
        message: 'CPU utilization too high for sustained load',
      });
    }

    analysis.component_scores.set('api_server', Math.max(0, score));
    analysis.capacity_analysis.set('api_server', {
      current_capacity: apiMetrics.current_rps,
      max_capacity: capacity.max_rps,
      utilization_percentage: throughputUtilization * 100,
      headroom_percentage: (1 - throughputUtilization) * 100,
      recommendations: this.generateAPIServerRecommendations(apiMetrics, capacity),
    });
  }

  /**
   * Analyze Database scalability
   */
  analyzeDatabaseScalability(testResults, analysis) {
    const dbMetrics = {
      avg_query_time: testResults.db_query_time?.avg || 0,
      p95_query_time: testResults.db_query_time?.p95 || 0,
      connection_time: testResults.db_connection_time?.avg || 0,
      error_rate: testResults.db_error_rate || 0,
      concurrent_queries: testResults.concurrent_queries || 0,
      rls_overhead: testResults.rls_policy_time?.avg || 0,
    };

    const capacity = this.capacityModel.get('database');
    let score = 100;

    // Evaluate query performance
    if (dbMetrics.p95_query_time > capacity.max_query_duration) {
      score -= 30;
      analysis.bottlenecks.push({
        component: 'database',
        type: 'query_performance',
        severity: 'high',
        value: dbMetrics.p95_query_time,
        message: 'Database query performance degrading',
      });
    }

    // Evaluate connection pool
    if (dbMetrics.connection_time > 1000) {
      score -= 25;
      analysis.bottlenecks.push({
        component: 'database',
        type: 'connection_pool',
        severity: 'medium',
        value: dbMetrics.connection_time,
        message: 'Database connection pool under stress',
      });
    }

    // Evaluate RLS overhead
    if (dbMetrics.rls_overhead > 100) {
      score -= 15;
      analysis.bottlenecks.push({
        component: 'database',
        type: 'rls_overhead',
        severity: 'medium',
        value: dbMetrics.rls_overhead,
        message: 'Row Level Security policies adding significant overhead',
      });
    }

    analysis.component_scores.set('database', Math.max(0, score));
    analysis.capacity_analysis.set('database', {
      current_performance: dbMetrics.p95_query_time,
      target_performance: capacity.max_query_duration,
      performance_ratio: dbMetrics.p95_query_time / capacity.max_query_duration,
      recommendations: this.generateDatabaseRecommendations(dbMetrics, capacity),
    });
  }

  /**
   * Analyze Email Service scalability
   */
  analyzeEmailServiceScalability(testResults, analysis) {
    const emailMetrics = {
      processing_time: testResults.email_processing_time?.p95 || 0,
      send_success_rate: testResults.email_send_success_rate || 1,
      queue_depth: testResults.email_queue_depth?.max || 0,
      throughput: testResults.email_throughput || 0,
      ses_rate_limits: testResults.ses_rate_limit_hits || 0,
    };

    const capacity = this.capacityModel.get('email_service');
    let score = 100;

    // Evaluate processing time
    if (emailMetrics.processing_time > capacity.max_processing_time) {
      score -= 25;
      analysis.bottlenecks.push({
        component: 'email_service',
        type: 'processing_time',
        severity: 'medium',
        value: emailMetrics.processing_time,
        message: 'Email processing time exceeding targets',
      });
    }

    // Evaluate success rate
    if (emailMetrics.send_success_rate < 0.95) {
      score -= 35;
      analysis.bottlenecks.push({
        component: 'email_service',
        type: 'success_rate',
        severity: 'high',
        value: emailMetrics.send_success_rate,
        message: 'Email send success rate below acceptable threshold',
      });
    }

    // Evaluate SES rate limiting
    if (emailMetrics.ses_rate_limits > 5) {
      score -= 20;
      analysis.bottlenecks.push({
        component: 'email_service',
        type: 'rate_limiting',
        severity: 'medium',
        value: emailMetrics.ses_rate_limits,
        message: 'Frequent SES rate limit hits indicate capacity constraints',
      });
    }

    analysis.component_scores.set('email_service', Math.max(0, score));
    analysis.capacity_analysis.set('email_service', {
      current_throughput: emailMetrics.throughput,
      max_throughput: capacity.max_emails_per_hour / 3600, // Convert to per second
      success_rate: emailMetrics.send_success_rate,
      recommendations: this.generateEmailServiceRecommendations(emailMetrics, capacity),
    });
  }

  /**
   * Analyze Billing Service scalability
   */
  analyzeBillingServiceScalability(testResults, analysis) {
    const billingMetrics = {
      webhook_processing_time: testResults.webhook_processing_time?.p95 || 0,
      payment_success_rate: testResults.payment_success_rate || 1,
      usage_tracking_latency: testResults.usage_tracking_latency?.p95 || 0,
      billing_error_rate: testResults.billing_error_rate || 0,
    };

    const capacity = this.capacityModel.get('billing_service');
    let score = 100;

    // Evaluate webhook processing
    if (billingMetrics.webhook_processing_time > capacity.max_payment_processing_time) {
      score -= 25;
      analysis.bottlenecks.push({
        component: 'billing_service',
        type: 'webhook_processing',
        severity: 'medium',
        value: billingMetrics.webhook_processing_time,
        message: 'Webhook processing time too high',
      });
    }

    // Evaluate usage tracking
    if (billingMetrics.usage_tracking_latency > capacity.max_usage_tracking_latency) {
      score -= 20;
      analysis.bottlenecks.push({
        component: 'billing_service',
        type: 'usage_tracking',
        severity: 'medium',
        value: billingMetrics.usage_tracking_latency,
        message: 'Usage tracking latency affecting user experience',
      });
    }

    analysis.component_scores.set('billing_service', Math.max(0, score));
    analysis.capacity_analysis.set('billing_service', {
      webhook_performance: billingMetrics.webhook_processing_time,
      payment_reliability: billingMetrics.payment_success_rate,
      usage_tracking_performance: billingMetrics.usage_tracking_latency,
      recommendations: this.generateBillingServiceRecommendations(billingMetrics, capacity),
    });
  }

  /**
   * Analyze GDPR Service scalability
   */
  analyzeGDPRServiceScalability(testResults, analysis) {
    const gdprMetrics = {
      export_time: testResults.data_export_time?.avg || 0,
      deletion_time: testResults.data_deletion_time?.avg || 0,
      consent_check_time: testResults.consent_check_time?.p95 || 0,
      audit_log_time: testResults.audit_log_time?.p95 || 0,
      data_volume: testResults.gdpr_data_volume_processed || 0,
    };

    const capacity = this.capacityModel.get('gdpr_service');
    let score = 100;

    // Evaluate export performance
    if (gdprMetrics.export_time > capacity.max_export_time_minutes * 60 * 1000) {
      score -= 20;
      analysis.bottlenecks.push({
        component: 'gdpr_service',
        type: 'export_time',
        severity: 'medium',
        value: gdprMetrics.export_time,
        message: 'Data export time exceeding acceptable limits',
      });
    }

    // Evaluate consent checking
    if (gdprMetrics.consent_check_time > 500) {
      score -= 15;
      analysis.bottlenecks.push({
        component: 'gdpr_service',
        type: 'consent_performance',
        severity: 'low',
        value: gdprMetrics.consent_check_time,
        message: 'Consent checking adding latency to user operations',
      });
    }

    analysis.component_scores.set('gdpr_service', Math.max(0, score));
    analysis.capacity_analysis.set('gdpr_service', {
      export_performance: gdprMetrics.export_time,
      consent_performance: gdprMetrics.consent_check_time,
      data_processing_capacity: gdprMetrics.data_volume,
      recommendations: this.generateGDPRServiceRecommendations(gdprMetrics, capacity),
    });
  }

  /**
   * Calculate overall scalability score
   */
  calculateOverallScore(componentScores) {
    const weights = {
      api_server: 0.35,
      database: 0.30,
      email_service: 0.20,
      billing_service: 0.10,
      gdpr_service: 0.05,
    };

    let weightedScore = 0;
    let totalWeight = 0;

    for (const [component, score] of componentScores.entries()) {
      const weight = weights[component] || 0;
      weightedScore += score * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedScore / totalWeight : 0;
  }

  /**
   * Generate growth projections
   */
  generateGrowthProjections(testResults, analysis) {
    const currentLoad = testResults.virtual_users || 1;
    const currentRPS = testResults.requests_per_second || 1;

    // Project capacity at different growth levels
    const growthScenarios = [2, 5, 10, 20]; // 2x, 5x, 10x, 20x growth

    for (const multiplier of growthScenarios) {
      const projectedUsers = currentLoad * multiplier;
      const projectedRPS = currentRPS * multiplier;

      const projection = {
        growth_multiplier: multiplier,
        projected_users: projectedUsers,
        projected_rps: projectedRPS,
        estimated_issues: [],
        required_improvements: [],
      };

      // Project issues for each component
      this.projectAPIServerIssues(projection, multiplier);
      this.projectDatabaseIssues(projection, multiplier);
      this.projectEmailServiceIssues(projection, multiplier);

      analysis.growth_projections.set(`${multiplier}x`, projection);
    }
  }

  /**
   * Project API server issues at scale
   */
  projectAPIServerIssues(projection, multiplier) {
    const capacity = this.capacityModel.get('api_server');
    
    if (projection.projected_rps > capacity.max_rps * 0.8) {
      projection.estimated_issues.push({
        component: 'api_server',
        issue: 'Throughput capacity exceeded',
        severity: 'critical',
        projected_value: projection.projected_rps,
        capacity_limit: capacity.max_rps,
      });

      projection.required_improvements.push({
        type: 'horizontal_scaling',
        description: `Scale API servers to ${Math.ceil(projection.projected_rps / capacity.max_rps)} instances`,
        priority: 'high',
      });
    }

    if (projection.projected_users > capacity.max_concurrent_users) {
      projection.estimated_issues.push({
        component: 'api_server',
        issue: 'Concurrent user limit exceeded',
        severity: 'high',
        projected_value: projection.projected_users,
        capacity_limit: capacity.max_concurrent_users,
      });
    }
  }

  /**
   * Project database issues at scale
   */
  projectDatabaseIssues(projection, multiplier) {
    const capacity = this.capacityModel.get('database');

    if (projection.projected_rps > capacity.max_transactions_per_second * 0.8) {
      projection.estimated_issues.push({
        component: 'database',
        issue: 'Transaction throughput limit approached',
        severity: 'high',
        projected_value: projection.projected_rps,
        capacity_limit: capacity.max_transactions_per_second,
      });

      projection.required_improvements.push({
        type: 'database_scaling',
        description: 'Consider read replicas, connection pooling, or database sharding',
        priority: 'high',
      });
    }

    // Estimate connection pool needs
    const estimatedConnections = Math.ceil(projection.projected_users / 10);
    if (estimatedConnections > capacity.max_connections * 0.8) {
      projection.estimated_issues.push({
        component: 'database',
        issue: 'Connection pool exhaustion',
        severity: 'critical',
        projected_value: estimatedConnections,
        capacity_limit: capacity.max_connections,
      });
    }
  }

  /**
   * Project email service issues at scale
   */
  projectEmailServiceIssues(projection, multiplier) {
    const capacity = this.capacityModel.get('email_service');
    const projectedEmailsPerHour = projection.projected_rps * 3600 * 0.1; // Assume 10% of requests are emails

    if (projectedEmailsPerHour > capacity.max_emails_per_hour * 0.8) {
      projection.estimated_issues.push({
        component: 'email_service',
        issue: 'Email sending capacity exceeded',
        severity: 'medium',
        projected_value: projectedEmailsPerHour,
        capacity_limit: capacity.max_emails_per_hour,
      });

      projection.required_improvements.push({
        type: 'email_scaling',
        description: 'Implement email queue sharding or multiple SES regions',
        priority: 'medium',
      });
    }
  }

  /**
   * Generate component-specific recommendations
   */
  generateAPIServerRecommendations(metrics, capacity) {
    const recommendations = [];

    if (metrics.current_rps > capacity.max_rps * 0.7) {
      recommendations.push({
        type: 'scaling',
        priority: 'high',
        description: 'Scale API servers horizontally - add load balancer and additional instances',
        implementation: 'Deploy additional API server instances behind load balancer',
        estimated_cost: 'Medium',
        timeline: '1-2 weeks',
      });
    }

    if (metrics.p95_response_time > 2000) {
      recommendations.push({
        type: 'optimization',
        priority: 'medium',
        description: 'Optimize API response times through caching and query optimization',
        implementation: 'Implement Redis caching for frequently accessed data',
        estimated_cost: 'Low',
        timeline: '1 week',
      });
    }

    if (metrics.cpu_usage > 70) {
      recommendations.push({
        type: 'resources',
        priority: 'medium',
        description: 'Upgrade CPU resources or optimize CPU-intensive operations',
        implementation: 'Upgrade to higher CPU instance types or optimize algorithms',
        estimated_cost: 'Medium',
        timeline: '1 week',
      });
    }

    return recommendations;
  }

  generateDatabaseRecommendations(metrics, capacity) {
    const recommendations = [];

    if (metrics.p95_query_time > capacity.max_query_duration * 0.7) {
      recommendations.push({
        type: 'optimization',
        priority: 'high',
        description: 'Optimize database queries and add appropriate indexes',
        implementation: 'Analyze slow queries, add indexes, optimize RLS policies',
        estimated_cost: 'Low',
        timeline: '2 weeks',
      });
    }

    if (metrics.connection_time > 500) {
      recommendations.push({
        type: 'scaling',
        priority: 'medium',
        description: 'Implement connection pooling optimization',
        implementation: 'Configure PgBouncer or increase connection pool size',
        estimated_cost: 'Low',
        timeline: '1 week',
      });
    }

    if (metrics.rls_overhead > 50) {
      recommendations.push({
        type: 'optimization',
        priority: 'medium',
        description: 'Optimize Row Level Security policies',
        implementation: 'Review and optimize RLS policies, consider policy caching',
        estimated_cost: 'Low',
        timeline: '1-2 weeks',
      });
    }

    return recommendations;
  }

  generateEmailServiceRecommendations(metrics, capacity) {
    const recommendations = [];

    if (metrics.processing_time > capacity.max_processing_time * 0.7) {
      recommendations.push({
        type: 'optimization',
        priority: 'medium',
        description: 'Optimize email processing pipeline',
        implementation: 'Implement email queue batching and parallel processing',
        estimated_cost: 'Medium',
        timeline: '2 weeks',
      });
    }

    if (metrics.ses_rate_limits > 2) {
      recommendations.push({
        type: 'scaling',
        priority: 'high',
        description: 'Implement SES rate limiting and backoff strategies',
        implementation: 'Add intelligent rate limiting and exponential backoff',
        estimated_cost: 'Low',
        timeline: '1 week',
      });
    }

    return recommendations;
  }

  generateBillingServiceRecommendations(metrics, capacity) {
    const recommendations = [];

    if (metrics.webhook_processing_time > capacity.max_payment_processing_time * 0.7) {
      recommendations.push({
        type: 'optimization',
        priority: 'medium',
        description: 'Optimize webhook processing pipeline',
        implementation: 'Implement async webhook processing with queue system',
        estimated_cost: 'Medium',
        timeline: '2 weeks',
      });
    }

    if (metrics.usage_tracking_latency > capacity.max_usage_tracking_latency * 0.7) {
      recommendations.push({
        type: 'optimization',
        priority: 'medium',
        description: 'Optimize usage tracking for real-time performance',
        implementation: 'Implement usage tracking cache and batch updates',
        estimated_cost: 'Low',
        timeline: '1 week',
      });
    }

    return recommendations;
  }

  generateGDPRServiceRecommendations(metrics, capacity) {
    const recommendations = [];

    if (metrics.export_time > capacity.max_export_time_minutes * 60 * 1000 * 0.7) {
      recommendations.push({
        type: 'optimization',
        priority: 'low',
        description: 'Optimize data export performance',
        implementation: 'Implement streaming exports and parallel processing',
        estimated_cost: 'Medium',
        timeline: '3 weeks',
      });
    }

    if (metrics.consent_check_time > 300) {
      recommendations.push({
        type: 'optimization',
        priority: 'low',
        description: 'Cache consent status for better performance',
        implementation: 'Implement consent caching with TTL',
        estimated_cost: 'Low',
        timeline: '1 week',
      });
    }

    return recommendations;
  }

  /**
   * Identify critical bottlenecks
   */
  identifyBottlenecks(analysis) {
    // Sort bottlenecks by severity
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    
    analysis.bottlenecks.sort((a, b) => {
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    // Calculate bottleneck severity score
    const criticalCount = analysis.bottlenecks.filter(b => b.severity === 'critical').length;
    const highCount = analysis.bottlenecks.filter(b => b.severity === 'high').length;
    
    const severityScore = Math.max(0, 100 - (criticalCount * 40 + highCount * 25));
    bottleneckSeverity.add(severityScore);
  }

  /**
   * Generate actionable recommendations
   */
  generateRecommendations(analysis) {
    const allRecommendations = [];

    // Collect recommendations from all components
    for (const [component, capacityAnalysis] of analysis.capacity_analysis.entries()) {
      if (capacityAnalysis.recommendations) {
        capacityAnalysis.recommendations.forEach(rec => {
          allRecommendations.push({
            ...rec,
            component,
          });
        });
      }
    }

    // Sort by priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    allRecommendations.sort((a, b) => {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    analysis.recommendations = allRecommendations;

    // Calculate recommendation priority score
    const highPriorityCount = allRecommendations.filter(r => r.priority === 'high').length;
    const priorityScore = Math.max(0, 100 - (highPriorityCount * 20));
    recommendationPriority.add(priorityScore);
  }

  /**
   * Generate scalability report
   */
  generateScalabilityReport(analysis) {
    const report = {
      summary: {
        overall_score: analysis.overall_score,
        critical_bottlenecks: analysis.bottlenecks.filter(b => b.severity === 'critical').length,
        high_priority_recommendations: analysis.recommendations.filter(r => r.priority === 'high').length,
        ready_for_scale: analysis.overall_score > 70,
      },
      
      component_analysis: Object.fromEntries(analysis.component_scores),
      
      bottlenecks: analysis.bottlenecks.slice(0, 10), // Top 10 bottlenecks
      
      recommendations: analysis.recommendations.slice(0, 15), // Top 15 recommendations
      
      growth_projections: Object.fromEntries(analysis.growth_projections),
      
      capacity_analysis: Object.fromEntries(analysis.capacity_analysis),
      
      action_plan: this.generateActionPlan(analysis),
    };

    return report;
  }

  /**
   * Generate prioritized action plan
   */
  generateActionPlan(analysis) {
    const actionPlan = {
      immediate_actions: [],
      short_term_actions: [],
      long_term_actions: [],
    };

    // Categorize recommendations by timeline
    analysis.recommendations.forEach(rec => {
      if (rec.priority === 'critical' || rec.priority === 'high') {
        if (rec.timeline?.includes('week') || rec.timeline?.includes('1')) {
          actionPlan.immediate_actions.push(rec);
        } else {
          actionPlan.short_term_actions.push(rec);
        }
      } else {
        actionPlan.long_term_actions.push(rec);
      }
    });

    return actionPlan;
  }
}

/**
 * Main function to run scalability analysis
 */
export function analyzeScalability(testResults) {
  const analyzer = new ScalabilityAnalyzer();
  const analysis = analyzer.analyzeScalability(testResults);
  const report = analyzer.generateScalabilityReport(analysis);
  
  console.log('\n=== SCALABILITY ANALYSIS SUMMARY ===');
  console.log(`Overall Scalability Score: ${analysis.overall_score.toFixed(1)}/100`);
  console.log(`Critical Bottlenecks: ${report.summary.critical_bottlenecks}`);
  console.log(`High Priority Recommendations: ${report.summary.high_priority_recommendations}`);
  console.log(`Ready for Scale: ${report.summary.ready_for_scale ? 'YES' : 'NO'}`);
  
  if (report.summary.critical_bottlenecks > 0) {
    console.log('\n🚨 CRITICAL BOTTLENECKS:');
    analysis.bottlenecks
      .filter(b => b.severity === 'critical')
      .forEach(bottleneck => {
        console.log(`- ${bottleneck.component}: ${bottleneck.message}`);
      });
  }
  
  if (report.summary.high_priority_recommendations > 0) {
    console.log('\n⚡ HIGH PRIORITY ACTIONS:');
    analysis.recommendations
      .filter(r => r.priority === 'high')
      .slice(0, 5)
      .forEach(rec => {
        console.log(`- ${rec.component}: ${rec.description}`);
      });
  }
  
  return report;
}

export default {
  ScalabilityAnalyzer,
  analyzeScalability,
  scalabilityScore,
  capacityUtilization,
  bottleneckSeverity,
  recommendationPriority,
};