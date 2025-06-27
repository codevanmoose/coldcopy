/**
 * Main Load Test Runner for ColdCopy
 * 
 * Orchestrates all load tests and provides comprehensive reporting
 */

import { check } from 'k6';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

import {
  BASE_URL,
  LOAD_TEST_STAGES,
  getTestConfig,
  setup,
  teardown,
} from './k6-config.js';

// Import all test modules
import * as EmailTests from './email-load.js';
import * as APITests from './api-load.js';
import * as DatabaseTests from './database-load.js';
import * as BillingTests from './billing-load.js';
import * as GDPRTests from './gdpr-load.js';

import { runPerformanceMonitoring } from './performance-monitor.js';

// Test configuration
export let options = {
  ...getTestConfig(__ENV.TEST_TYPE || 'moderate'),
  
  scenarios: {
    // Email system tests
    email_single: {
      executor: 'ramping-vus',
      stages: LOAD_TEST_STAGES.light,
      exec: 'emailSingleTest',
      tags: { component: 'email', test_type: 'single' },
    },
    
    email_bulk: {
      executor: 'ramping-vus',
      stages: LOAD_TEST_STAGES.moderate,
      exec: 'emailBulkTest',
      tags: { component: 'email', test_type: 'bulk' },
    },
    
    // API tests
    api_crud: {
      executor: 'constant-vus',
      vus: 15,
      duration: '8m',
      exec: 'apiCrudTest',
      tags: { component: 'api', test_type: 'crud' },
    },
    
    api_auth: {
      executor: 'ramping-vus',
      stages: LOAD_TEST_STAGES.moderate,
      exec: 'apiAuthTest',
      tags: { component: 'api', test_type: 'auth' },
    },
    
    // Database tests
    database_rls: {
      executor: 'constant-vus',
      vus: 20,
      duration: '10m',
      exec: 'databaseRlsTest',
      tags: { component: 'database', test_type: 'rls' },
    },
    
    database_queries: {
      executor: 'ramping-vus',
      stages: LOAD_TEST_STAGES.moderate,
      exec: 'databaseQueriesTest',
      tags: { component: 'database', test_type: 'queries' },
    },
    
    // Billing tests
    billing_webhooks: {
      executor: 'constant-arrival-rate',
      rate: 10,
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 20,
      exec: 'billingWebhooksTest',
      tags: { component: 'billing', test_type: 'webhooks' },
    },
    
    billing_subscriptions: {
      executor: 'ramping-vus',
      stages: LOAD_TEST_STAGES.light,
      exec: 'billingSubscriptionsTest',
      tags: { component: 'billing', test_type: 'subscriptions' },
    },
    
    // GDPR tests
    gdpr_export: {
      executor: 'ramping-vus',
      stages: LOAD_TEST_STAGES.light,
      exec: 'gdprExportTest',
      tags: { component: 'gdpr', test_type: 'export' },
    },
    
    gdpr_consent: {
      executor: 'constant-vus',
      vus: 15,
      duration: '6m',
      exec: 'gdprConsentTest',
      tags: { component: 'gdpr', test_type: 'consent' },
    },
  },
  
  thresholds: {
    // Global thresholds
    http_req_duration: ['p(50)<1000', 'p(95)<3000', 'p(99)<10000'],
    http_req_failed: ['rate<0.05'],
    http_reqs: ['rate>5'],
    
    // Component-specific thresholds
    'http_req_duration{component:email}': ['p(95)<10000'],
    'http_req_duration{component:api}': ['p(95)<2000'],
    'http_req_duration{component:database}': ['p(95)<2000'],
    'http_req_duration{component:billing}': ['p(95)<5000'],
    'http_req_duration{component:gdpr}': ['p(95)<10000'],
    
    // Error rate thresholds by component
    'http_req_failed{component:email}': ['rate<0.02'],
    'http_req_failed{component:api}': ['rate<0.03'],
    'http_req_failed{component:database}': ['rate<0.01'],
    'http_req_failed{component:billing}': ['rate<0.02'],
    'http_req_failed{component:gdpr}': ['rate<0.02'],
  },
};

export { setup, teardown };

// Test execution functions
export function emailSingleTest() {
  return EmailTests.singleEmailTest();
}

export function emailBulkTest() {
  return EmailTests.bulkEmailTest();
}

export function apiCrudTest() {
  return APITests.crudOperationsTest();
}

export function apiAuthTest() {
  return APITests.authenticationTest();
}

export function databaseRlsTest() {
  return DatabaseTests.rlsPerformanceTest();
}

export function databaseQueriesTest() {
  return DatabaseTests.complexQueryTest();
}

export function billingWebhooksTest() {
  return BillingTests.stripeWebhookTest();
}

export function billingSubscriptionsTest() {
  return BillingTests.subscriptionManagementTest();
}

export function gdprExportTest() {
  return GDPRTests.dataExportTest();
}

export function gdprConsentTest() {
  return GDPRTests.consentManagementTest();
}

/**
 * Custom summary handler for comprehensive reporting
 */
export function handleSummary(data) {
  // Extract metrics for performance monitoring
  const testResults = {
    test_type: __ENV.TEST_TYPE || 'comprehensive',
    duration: data.state.testRunDurationMs,
    virtual_users: data.metrics.vus?.values?.max || 0,
    
    // API metrics
    api_response_time: data.metrics.http_req_duration ? {
      avg: data.metrics.http_req_duration.values.avg,
      p95: data.metrics.http_req_duration.values['p(95)'],
      p99: data.metrics.http_req_duration.values['p(99)'],
    } : null,
    
    // Database metrics
    db_query_time: data.metrics.db_query_duration ? {
      avg: data.metrics.db_query_duration.values.avg,
      p95: data.metrics.db_query_duration.values['p(95)'],
    } : null,
    
    db_connection_time: data.metrics.db_connection_duration ? {
      avg: data.metrics.db_connection_duration.values.avg,
    } : null,
    
    // Email metrics
    email_processing_time: data.metrics.email_processing_duration ? {
      avg: data.metrics.email_processing_duration.values.avg,
      p95: data.metrics.email_processing_duration.values['p(95)'],
    } : null,
    
    email_send_success_rate: data.metrics.email_send_success?.values?.rate || 0,
    
    // Billing metrics
    billing_processing_time: data.metrics.billing_processing_duration ? {
      avg: data.metrics.billing_processing_duration.values.avg,
      p95: data.metrics.billing_processing_duration.values['p(95)'],
    } : null,
    
    webhook_processing_time: data.metrics.webhook_processing_duration ? {
      p95: data.metrics.webhook_processing_duration.values['p(95)'],
    } : null,
    
    payment_success_rate: data.metrics.payment_success_rate?.values?.rate || 0,
    
    // GDPR metrics
    gdpr_processing_time: data.metrics.gdpr_processing_duration ? {
      p95: data.metrics.gdpr_processing_duration.values['p(95)'],
    } : null,
    
    data_export_time: data.metrics.data_export_duration ? {
      avg: data.metrics.data_export_duration.values.avg,
    } : null,
    
    // Error rates
    api_error_rate: data.metrics.api_error_rate?.values?.rate || 0,
    db_error_rate: data.metrics.db_error_rate?.values?.rate || 0,
    billing_error_rate: data.metrics.billing_error_rate?.values?.rate || 0,
    
    // Overall metrics
    total_requests: data.metrics.http_reqs?.values?.count || 0,
    requests_per_second: data.metrics.http_reqs?.values?.rate || 0,
    
    // Extract resource utilization if available
    cpu_usage: data.metrics.cpu_usage?.values?.value || 0,
    memory_usage: data.metrics.memory_usage?.values?.value || 0,
    disk_io: data.metrics.disk_io?.values?.rate || 0,
    network_io: data.metrics.network_io?.values?.rate || 0,
  };
  
  // Run performance monitoring and analysis
  const performanceAnalysis = runPerformanceMonitoring(testResults);
  
  // Generate reports
  const reports = {
    // Text summary for console output
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    
    // HTML report for detailed analysis
    'performance-report.html': htmlReport(data, { 
      title: 'ColdCopy Load Test Performance Report',
      description: `Comprehensive performance test results for ${testResults.test_type} test`,
    }),
    
    // JSON report for CI/CD integration
    'performance-results.json': JSON.stringify({
      summary: data,
      performance_analysis: performanceAnalysis,
      timestamp: new Date().toISOString(),
      environment: {
        base_url: BASE_URL,
        test_type: __ENV.TEST_TYPE || 'comprehensive',
        git_branch: __ENV.GIT_BRANCH || 'unknown',
        git_commit: __ENV.GIT_COMMIT || 'unknown',
        build_id: __ENV.BUILD_ID || 'local',
      },
    }, null, 2),
    
    // CSV export for analysis tools
    'performance-metrics.csv': generateCSVReport(data, testResults),
  };
  
  // Add performance summary to stdout
  reports.stdout += '\n\n' + performanceAnalysis.summary;
  
  // Log key findings
  console.log('\n=== PERFORMANCE TEST SUMMARY ===');
  console.log(`Performance Score: ${performanceAnalysis.report.summary.performance_score.toFixed(1)}/100`);
  console.log(`Regressions Detected: ${performanceAnalysis.report.regressions.length}`);
  console.log(`Recommendations: ${performanceAnalysis.report.recommendations.length}`);
  
  if (performanceAnalysis.buildDecision.should_fail) {
    console.log(`❌ BUILD SHOULD FAIL: ${performanceAnalysis.buildDecision.reason}`);
  } else {
    console.log('✅ BUILD PASSES PERFORMANCE CRITERIA');
  }
  
  return reports;
}

/**
 * Generate CSV report for external analysis
 */
function generateCSVReport(data, testResults) {
  const csvLines = [
    'metric,value,unit,threshold_met',
    `api_response_time_p95,${testResults.api_response_time?.p95 || 0},ms,${(testResults.api_response_time?.p95 || 0) < 3000}`,
    `db_query_time_p95,${testResults.db_query_time?.p95 || 0},ms,${(testResults.db_query_time?.p95 || 0) < 2000}`,
    `email_processing_time_p95,${testResults.email_processing_time?.p95 || 0},ms,${(testResults.email_processing_time?.p95 || 0) < 10000}`,
    `billing_processing_time_p95,${testResults.billing_processing_time?.p95 || 0},ms,${(testResults.billing_processing_time?.p95 || 0) < 5000}`,
    `gdpr_processing_time_p95,${testResults.gdpr_processing_time?.p95 || 0},ms,${(testResults.gdpr_processing_time?.p95 || 0) < 10000}`,
    `api_error_rate,${testResults.api_error_rate},rate,${testResults.api_error_rate < 0.05}`,
    `email_send_success_rate,${testResults.email_send_success_rate},rate,${testResults.email_send_success_rate > 0.95}`,
    `payment_success_rate,${testResults.payment_success_rate},rate,${testResults.payment_success_rate > 0.95}`,
    `requests_per_second,${testResults.requests_per_second},rps,${testResults.requests_per_second > 5}`,
    `total_requests,${testResults.total_requests},count,true`,
    `virtual_users_max,${testResults.virtual_users},count,true`,
  ];
  
  return csvLines.join('\n');
}

/**
 * Validation function to check test environment
 */
export function validateTestEnvironment() {
  console.log('Validating test environment...');
  
  const requiredEnvVars = ['BASE_URL'];
  const missingVars = requiredEnvVars.filter(varName => !__ENV[varName]);
  
  if (missingVars.length > 0) {
    console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
    return false;
  }
  
  console.log(`✓ Base URL: ${BASE_URL}`);
  console.log(`✓ Test Type: ${__ENV.TEST_TYPE || 'moderate'}`);
  console.log(`✓ Environment: ${__ENV.ENVIRONMENT || 'test'}`);
  
  return true;
}

// Pre-test validation
if (!validateTestEnvironment()) {
  throw new Error('Test environment validation failed');
}