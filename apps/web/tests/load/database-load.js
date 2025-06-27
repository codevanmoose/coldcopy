/**
 * Database Performance Load Tests for ColdCopy
 * 
 * Tests the performance of database operations including:
 * - Row Level Security (RLS) policy performance
 * - Multi-tenant query performance
 * - Large dataset operations
 * - Connection pool limits
 * - Complex query performance
 * - Index effectiveness
 */

import { check, sleep } from 'k6';
import http from 'k6/http';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import {
  BASE_URL,
  LOAD_TEST_STAGES,
  PERFORMANCE_THRESHOLDS,
  TestData,
  authenticate,
  getAuthHeaders,
  checkResponse,
  thinkTime,
  PerformanceMonitor,
  getTestConfig,
  setup,
  teardown,
} from './k6-config.js';

// Database-specific metrics
const dbQueryTime = new Trend('db_query_duration');
const dbConnectionTime = new Trend('db_connection_duration');
const dbErrorRate = new Rate('db_error_rate');
const rlsPolicyTime = new Trend('rls_policy_duration');
const indexEffectiveness = new Rate('index_effectiveness');
const connectionPoolUsage = new Gauge('connection_pool_usage');
const concurrentQueries = new Counter('concurrent_db_queries');
const dataVolumeProcessed = new Counter('data_volume_processed');
const queryComplexityScore = new Trend('query_complexity_score');

// Test configuration
export let options = {
  ...getTestConfig('moderate'),
  scenarios: {
    // RLS policy performance test
    rls_performance: {
      executor: 'ramping-vus',
      stages: LOAD_TEST_STAGES.moderate,
      exec: 'rlsPerformanceTest',
      tags: { test_type: 'rls' },
    },
    
    // Multi-tenant workload test
    multi_tenant_workload: {
      executor: 'constant-vus',
      vus: 20,
      duration: '10m',
      exec: 'multiTenantTest',
      tags: { test_type: 'multi_tenant' },
    },
    
    // Large dataset operations
    large_dataset_ops: {
      executor: 'ramping-vus',
      stages: LOAD_TEST_STAGES.light,
      exec: 'largeDatasetTest',
      tags: { test_type: 'large_dataset' },
    },
    
    // Connection pool stress test
    connection_pool_stress: {
      executor: 'constant-arrival-rate',
      rate: 30,
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 50,
      exec: 'connectionPoolTest',
      tags: { test_type: 'connection_pool' },
    },
    
    // Complex query performance
    complex_queries: {
      executor: 'constant-vus',
      vus: 10,
      duration: '8m',
      exec: 'complexQueryTest',
      tags: { test_type: 'complex_queries' },
    },
    
    // Read/Write intensive workload
    read_write_intensive: {
      executor: 'ramping-vus',
      stages: LOAD_TEST_STAGES.heavy,
      exec: 'readWriteIntensiveTest',
      tags: { test_type: 'read_write_intensive' },
    }
  },
  
  thresholds: {
    ...PERFORMANCE_THRESHOLDS,
    db_query_duration: ['p(95)<2000'], // DB queries under 2s
    db_connection_duration: ['p(95)<500'], // Connection under 500ms
    db_error_rate: ['rate<0.02'], // Less than 2% DB errors
    rls_policy_duration: ['p(95)<100'], // RLS overhead under 100ms
    index_effectiveness: ['rate>0.9'], // 90% queries use indexes
  }
};

export { setup, teardown };

/**
 * RLS Performance Test
 * Tests Row Level Security policy performance across workspaces
 */
export function rlsPerformanceTest() {
  const token = authenticate();
  const headers = getAuthHeaders(token);
  
  concurrentQueries.add(1);
  
  // Test RLS policy with leads access
  const leadsRlsStartTime = Date.now();
  
  const leadsResponse = http.get(
    `${BASE_URL}/api/leads?limit=100&include_rls_stats=true`,
    {
      headers,
      tags: { rls_test: 'leads', operation: 'list_with_rls' }
    }
  );
  
  const leadsRlsDuration = Date.now() - leadsRlsStartTime;
  
  dbQueryTime.add(leadsRlsDuration, { table: 'leads', rls: 'enabled' });
  rlsPolicyTime.add(leadsRlsDuration, { policy: 'workspace_isolation' });
  PerformanceMonitor.trackDatabaseOperation('rls_leads_query', leadsRlsDuration);
  
  const leadsSuccess = checkResponse(leadsResponse, 200, {
    operation: 'rls_leads',
    endpoint: 'database'
  });
  
  if (leadsSuccess) {
    const rlsStats = leadsResponse.json('rls_stats');
    const queryPlan = leadsResponse.headers['X-Query-Plan'];
    
    if (rlsStats) {
      check(leadsResponse, {
        'RLS policy applied': () => rlsStats.rls_applied === true,
        'Workspace filter active': () => rlsStats.workspace_filter === true,
        'Index scan used': () => rlsStats.scan_type === 'index',
      });
      
      indexEffectiveness.add(rlsStats.scan_type === 'index' ? 1 : 0);
      queryComplexityScore.add(rlsStats.complexity_score || 1);
    }
    
    // Check for query performance indicators
    const dbExecTime = leadsResponse.headers['X-DB-Execution-Time'];
    if (dbExecTime) {
      dbQueryTime.add(parseInt(dbExecTime), { source: 'header', operation: 'rls' });
    }
  }
  
  // Test RLS policy with campaigns access
  const campaignsRlsStartTime = Date.now();
  
  const campaignsResponse = http.get(
    `${BASE_URL}/api/campaigns?include_leads=true&include_rls_stats=true`,
    {
      headers,
      tags: { rls_test: 'campaigns', operation: 'list_with_joins' }
    }
  );
  
  const campaignsRlsDuration = Date.now() - campaignsRlsStartTime;
  
  dbQueryTime.add(campaignsRlsDuration, { table: 'campaigns', rls: 'enabled', joins: 'true' });
  rlsPolicyTime.add(campaignsRlsDuration, { policy: 'campaign_workspace_isolation' });
  
  checkResponse(campaignsResponse, 200, {
    operation: 'rls_campaigns_with_joins',
    endpoint: 'database'
  });
  
  // Test cross-workspace data isolation
  const isolationTestStartTime = Date.now();
  
  const isolationResponse = http.get(
    `${BASE_URL}/api/admin/workspace-isolation-test`,
    {
      headers,
      tags: { rls_test: 'isolation', operation: 'cross_workspace' }
    }
  );
  
  const isolationDuration = Date.now() - isolationTestStartTime;
  
  dbQueryTime.add(isolationDuration, { table: 'multi', rls: 'isolation_test' });
  
  if (isolationResponse.status === 200) {
    const isolationResult = isolationResponse.json();
    
    check(isolationResponse, {
      'No cross-workspace data leak': () => isolationResult.leak_detected === false,
      'Proper workspace filtering': () => isolationResult.workspace_count === 1,
      'RLS policies enforced': () => isolationResult.rls_enforced === true,
    });
  }
  
  dataVolumeProcessed.add(300); // Estimated records processed
  thinkTime(2, 4);
}

/**
 * Multi-Tenant Workload Test
 * Simulates concurrent access from multiple workspaces
 */
export function multiTenantTest() {
  const token = authenticate();
  const headers = getAuthHeaders(token);
  
  // Simulate different workspace contexts
  const workspaceIds = [
    'workspace-1', 'workspace-2', 'workspace-3', 
    'workspace-4', 'workspace-5'
  ];
  const workspaceId = workspaceIds[Math.floor(Math.random() * workspaceIds.length)];
  
  // Override workspace in headers
  const workspaceHeaders = {
    ...headers,
    'X-Workspace-ID': workspaceId,
  };
  
  concurrentQueries.add(1);
  
  // Perform workspace-specific operations
  const operations = [
    () => testWorkspaceLeads(workspaceHeaders, workspaceId),
    () => testWorkspaceCampaigns(workspaceHeaders, workspaceId),
    () => testWorkspaceAnalytics(workspaceHeaders, workspaceId),
    () => testWorkspaceSettings(workspaceHeaders, workspaceId),
  ];
  
  // Execute 2-3 random operations
  const selectedOps = operations.sort(() => 0.5 - Math.random()).slice(0, 2 + Math.floor(Math.random() * 2));
  
  for (const operation of selectedOps) {
    operation();
    sleep(0.5); // Brief pause between operations
  }
  
  thinkTime(3, 6);
}

/**
 * Large Dataset Operations Test
 * Tests performance with large amounts of data
 */
export function largeDatasetTest() {
  const token = authenticate();
  const headers = getAuthHeaders(token);
  
  concurrentQueries.add(1);
  
  // Test large dataset queries
  const largeQueryStartTime = Date.now();
  
  const largeQueryResponse = http.get(
    `${BASE_URL}/api/leads?limit=1000&include_all=true&sort=created_at&time_range=all`,
    {
      headers,
      tags: { dataset_size: 'large', operation: 'full_scan' }
    }
  );
  
  const largeQueryDuration = Date.now() - largeQueryStartTime;
  
  dbQueryTime.add(largeQueryDuration, { dataset: 'large', operation: 'scan' });
  PerformanceMonitor.trackDatabaseOperation('large_dataset_query', largeQueryDuration);
  
  const largeQuerySuccess = checkResponse(largeQueryResponse, 200, {
    operation: 'large_dataset_query',
    endpoint: 'database'
  });
  
  if (largeQuerySuccess) {
    const results = largeQueryResponse.json('leads') || [];
    const pagination = largeQueryResponse.json('pagination');
    
    dataVolumeProcessed.add(results.length);
    
    check(largeQueryResponse, {
      'Large dataset query completed': () => results.length > 0,
      'Pagination handled correctly': () => pagination !== undefined,
      'Results within limit': () => results.length <= 1000,
    });
    
    // Check memory usage indicators
    const memoryUsage = largeQueryResponse.headers['X-Memory-Usage'];
    if (memoryUsage) {
      console.log(`Large query memory usage: ${memoryUsage}`);
    }
  }
  
  // Test aggregation queries on large datasets
  const aggregationStartTime = Date.now();
  
  const aggregationResponse = http.get(
    `${BASE_URL}/api/analytics/lead-statistics?granularity=daily&period=1year`,
    {
      headers,
      tags: { dataset_size: 'large', operation: 'aggregation' }
    }
  );
  
  const aggregationDuration = Date.now() - aggregationStartTime;
  
  dbQueryTime.add(aggregationDuration, { dataset: 'large', operation: 'aggregation' });
  queryComplexityScore.add(5); // High complexity for aggregations
  
  checkResponse(aggregationResponse, 200, {
    operation: 'large_dataset_aggregation',
    endpoint: 'database'
  });
  
  // Test bulk operations
  const bulkLeads = [];
  for (let i = 0; i < 100; i++) {
    bulkLeads.push(TestData.sampleLead());
  }
  
  const bulkInsertStartTime = Date.now();
  
  const bulkInsertResponse = http.post(
    `${BASE_URL}/api/leads/bulk-insert`,
    JSON.stringify({ leads: bulkLeads }),
    {
      headers,
      tags: { dataset_size: 'bulk', operation: 'insert' }
    }
  );
  
  const bulkInsertDuration = Date.now() - bulkInsertStartTime;
  
  dbQueryTime.add(bulkInsertDuration, { dataset: 'bulk', operation: 'insert' });
  dataVolumeProcessed.add(bulkLeads.length);
  
  checkResponse(bulkInsertResponse, 201, {
    operation: 'bulk_insert',
    endpoint: 'database'
  });
  
  thinkTime(10, 15); // Longer pause for large operations
}

/**
 * Connection Pool Stress Test
 * Tests database connection pool under high load
 */
export function connectionPoolTest() {
  const token = authenticate();
  const headers = getAuthHeaders(token);
  
  concurrentQueries.add(1);
  
  // Rapid-fire database queries to stress connection pool
  const connectionStartTime = Date.now();
  
  const response = http.get(
    `${BASE_URL}/api/health/database?connection_test=true`,
    {
      headers,
      tags: { stress_test: 'connection_pool', operation: 'rapid_query' }
    }
  );
  
  const connectionDuration = Date.now() - connectionStartTime;
  
  dbConnectionTime.add(connectionDuration);
  dbQueryTime.add(connectionDuration, { pool_test: 'true' });
  
  const success = check(response, {
    'Connection acquired successfully': (r) => r.status === 200,
    'Connection time acceptable': (r) => r.timings.duration < 2000,
    'No connection pool exhaustion': (r) => !r.body.includes('pool exhausted'),
  });
  
  if (!success) {
    dbErrorRate.add(1);
  }
  
  // Extract connection pool metrics if available
  const poolSize = response.headers['X-Pool-Size'];
  const poolActive = response.headers['X-Pool-Active'];
  const poolIdle = response.headers['X-Pool-Idle'];
  
  if (poolSize && poolActive) {
    const poolUsage = (parseInt(poolActive) / parseInt(poolSize)) * 100;
    connectionPoolUsage.add(poolUsage);
    
    check(response, {
      'Pool not over-utilized': () => poolUsage < 90,
      'Pool has idle connections': () => parseInt(poolIdle) > 0,
    });
  }
  
  // Check for connection timeouts
  if (response.status === 504 || response.body.includes('timeout')) {
    console.log('Database connection timeout detected');
    dbErrorRate.add(1);
  }
  
  // No think time - rapid-fire testing
}

/**
 * Complex Query Performance Test
 * Tests performance of complex analytical queries
 */
export function complexQueryTest() {
  const token = authenticate();
  const headers = getAuthHeaders(token);
  
  concurrentQueries.add(1);
  
  const complexQueries = [
    {
      name: 'multi_table_join_with_aggregation',
      url: `${BASE_URL}/api/analytics/conversion-funnel-detailed?include_cohorts=true&segment_by=source,campaign,lead_score`,
      complexity: 8,
    },
    {
      name: 'time_series_with_windowing',
      url: `${BASE_URL}/api/analytics/email-performance-trends?granularity=hour&period=30d&moving_average=7d`,
      complexity: 6,
    },
    {
      name: 'recursive_hierarchy_query',
      url: `${BASE_URL}/api/analytics/team-hierarchy-performance?include_nested=true&depth=unlimited`,
      complexity: 9,
    },
    {
      name: 'full_text_search_with_ranking',
      url: `${BASE_URL}/api/leads/search?q=marketing director&fuzzy=true&rank_by=relevance&include_similar=true`,
      complexity: 7,
    },
    {
      name: 'cross_workspace_analytics',
      url: `${BASE_URL}/api/admin/cross-workspace-analytics?metric=conversion_rates&compare_workspaces=true`,
      complexity: 10,
    }
  ];
  
  // Select a random complex query
  const query = complexQueries[Math.floor(Math.random() * complexQueries.length)];
  
  const startTime = Date.now();
  
  const response = http.get(query.url, {
    headers: {
      ...headers,
      'X-Query-Timeout': '30000', // 30 second timeout
    },
    tags: { 
      complexity: query.complexity,
      query_type: query.name,
      operation: 'complex_query'
    }
  });
  
  const duration = Date.now() - startTime;
  
  dbQueryTime.add(duration, { 
    complexity: query.complexity,
    query_type: query.name 
  });
  queryComplexityScore.add(query.complexity);
  PerformanceMonitor.trackDatabaseOperation(query.name, duration);
  
  const success = checkResponse(response, 200, {
    operation: 'complex_query',
    endpoint: 'database',
    query_type: query.name
  });
  
  if (success) {
    // Check query execution plan if available
    const executionPlan = response.headers['X-Execution-Plan'];
    const scanType = response.headers['X-Scan-Type'];
    
    if (scanType) {
      indexEffectiveness.add(scanType === 'index' ? 1 : 0, { query_type: query.name });
      
      check(response, {
        'Complex query uses indexes': () => scanType === 'index',
        'Query execution plan optimized': () => executionPlan && !executionPlan.includes('seq_scan'),
      });
    }
    
    // Check result quality
    const results = response.json();
    if (results) {
      dataVolumeProcessed.add(results.length || results.count || 1);
      
      check(response, {
        'Complex query returns data': () => results !== null,
        'Result structure is valid': () => typeof results === 'object',
      });
    }
  } else {
    dbErrorRate.add(1);
  }
  
  thinkTime(5, 10); // Longer pause after complex queries
}

/**
 * Read/Write Intensive Test
 * Tests mixed read/write workload performance
 */
export function readWriteIntensiveTest() {
  const token = authenticate();
  const headers = getAuthHeaders(token);
  
  concurrentQueries.add(1);
  
  // Mix of read and write operations
  const operations = [
    () => performRead(headers, 'leads', 'list'),
    () => performRead(headers, 'campaigns', 'list'),
    () => performWrite(headers, 'leads', 'create'),
    () => performWrite(headers, 'campaigns', 'update'),
    () => performRead(headers, 'analytics', 'dashboard'),
    () => performWrite(headers, 'leads', 'update_bulk'),
  ];
  
  // Execute 3-5 operations in sequence
  const numOps = 3 + Math.floor(Math.random() * 3);
  
  for (let i = 0; i < numOps; i++) {
    const operation = operations[Math.floor(Math.random() * operations.length)];
    operation();
    
    // Brief pause between operations
    sleep(0.2);
  }
  
  thinkTime(4, 8);
}

// Helper functions for workspace testing
function testWorkspaceLeads(headers, workspaceId) {
  const startTime = Date.now();
  const response = http.get(
    `${BASE_URL}/api/leads?workspace=${workspaceId}&limit=50`,
    {
      headers,
      tags: { workspace_test: 'leads', workspace_id: workspaceId }
    }
  );
  
  const duration = Date.now() - startTime;
  dbQueryTime.add(duration, { workspace: workspaceId, table: 'leads' });
  
  checkResponse(response, 200, { operation: 'workspace_leads' });
  dataVolumeProcessed.add(50);
}

function testWorkspaceCampaigns(headers, workspaceId) {
  const startTime = Date.now();
  const response = http.get(
    `${BASE_URL}/api/campaigns?workspace=${workspaceId}&include_stats=true`,
    {
      headers,
      tags: { workspace_test: 'campaigns', workspace_id: workspaceId }
    }
  );
  
  const duration = Date.now() - startTime;
  dbQueryTime.add(duration, { workspace: workspaceId, table: 'campaigns' });
  
  checkResponse(response, 200, { operation: 'workspace_campaigns' });
  queryComplexityScore.add(3); // Medium complexity with stats
}

function testWorkspaceAnalytics(headers, workspaceId) {
  const startTime = Date.now();
  const response = http.get(
    `${BASE_URL}/api/analytics/workspace-summary?workspace=${workspaceId}`,
    {
      headers,
      tags: { workspace_test: 'analytics', workspace_id: workspaceId }
    }
  );
  
  const duration = Date.now() - startTime;
  dbQueryTime.add(duration, { workspace: workspaceId, table: 'analytics' });
  queryComplexityScore.add(5); // High complexity for analytics
  
  checkResponse(response, 200, { operation: 'workspace_analytics' });
}

function testWorkspaceSettings(headers, workspaceId) {
  const startTime = Date.now();
  const response = http.get(
    `${BASE_URL}/api/workspaces/${workspaceId}/settings`,
    {
      headers,
      tags: { workspace_test: 'settings', workspace_id: workspaceId }
    }
  );
  
  const duration = Date.now() - startTime;
  dbQueryTime.add(duration, { workspace: workspaceId, table: 'workspace_settings' });
  
  checkResponse(response, 200, { operation: 'workspace_settings' });
}

// Helper functions for read/write operations
function performRead(headers, table, operation) {
  const endpoints = {
    'leads.list': '/api/leads?limit=20',
    'campaigns.list': '/api/campaigns?limit=20',
    'analytics.dashboard': '/api/analytics/dashboard',
  };
  
  const endpoint = endpoints[`${table}.${operation}`];
  if (!endpoint) return;
  
  const startTime = Date.now();
  const response = http.get(`${BASE_URL}${endpoint}`, {
    headers,
    tags: { operation: 'read', table, type: operation }
  });
  
  const duration = Date.now() - startTime;
  dbQueryTime.add(duration, { operation: 'read', table });
  
  checkResponse(response, 200, { operation: 'read' });
  dataVolumeProcessed.add(20);
}

function performWrite(headers, table, operation) {
  const startTime = Date.now();
  let response;
  
  if (table === 'leads' && operation === 'create') {
    response = http.post(
      `${BASE_URL}/api/leads`,
      JSON.stringify(TestData.sampleLead()),
      { headers, tags: { operation: 'write', table, type: operation } }
    );
  } else if (table === 'campaigns' && operation === 'update') {
    response = http.put(
      `${BASE_URL}/api/campaigns/test-campaign`,
      JSON.stringify({ name: `Updated ${TestData.randomString(6)}` }),
      { headers, tags: { operation: 'write', table, type: operation } }
    );
  } else if (table === 'leads' && operation === 'update_bulk') {
    const updates = [];
    for (let i = 0; i < 10; i++) {
      updates.push({
        id: `lead-${i}`,
        data: { lastContacted: new Date().toISOString() }
      });
    }
    
    response = http.put(
      `${BASE_URL}/api/leads/bulk-update`,
      JSON.stringify({ updates }),
      { headers, tags: { operation: 'write', table, type: operation } }
    );
  }
  
  if (response) {
    const duration = Date.now() - startTime;
    dbQueryTime.add(duration, { operation: 'write', table });
    
    checkResponse(response, [200, 201, 202], { operation: 'write' });
    dataVolumeProcessed.add(operation.includes('bulk') ? 10 : 1);
  }
}

// Export metrics for use in other tests
export {
  dbQueryTime,
  dbConnectionTime,
  dbErrorRate,
  rlsPolicyTime,
  indexEffectiveness,
  connectionPoolUsage,
  concurrentQueries,
  dataVolumeProcessed,
  queryComplexityScore,
};