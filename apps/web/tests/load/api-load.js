/**
 * API Performance Load Tests for ColdCopy
 * 
 * Tests the performance of critical API endpoints including:
 * - Authentication and authorization
 * - Lead management operations
 * - Campaign management
 * - Analytics and reporting
 * - Workspace operations
 * - File uploads and downloads
 */

import { check, sleep } from 'k6';
import http from 'k6/http';
import { Rate, Trend, Counter } from 'k6/metrics';
import {
  BASE_URL,
  LOAD_TEST_STAGES,
  PERFORMANCE_THRESHOLDS,
  TestData,
  authenticate,
  getAuthHeaders,
  checkResponse,
  thinkTime,
  apiCircuitBreaker,
  PerformanceMonitor,
  getTestConfig,
  setup,
  teardown,
} from './k6-config.js';

// API-specific metrics
const apiResponseTime = new Trend('api_response_time');
const apiErrorRate = new Rate('api_error_rate');
const authSuccessRate = new Rate('auth_success_rate');
const concurrentUsers = new Counter('concurrent_api_users');
const apiThroughput = new Rate('api_throughput');
const databaseQueryTime = new Trend('database_query_time');

// Test configuration
export let options = {
  ...getTestConfig('moderate'),
  scenarios: {
    // Authentication performance test
    authentication_load: {
      executor: 'ramping-vus',
      stages: LOAD_TEST_STAGES.moderate,
      exec: 'authenticationTest',
      tags: { test_type: 'auth' },
    },
    
    // CRUD operations test
    crud_operations: {
      executor: 'constant-vus',
      vus: 15,
      duration: '10m',
      exec: 'crudOperationsTest',
      tags: { test_type: 'crud' },
    },
    
    // Read-heavy workload (analytics, reporting)
    read_heavy_workload: {
      executor: 'ramping-vus',
      stages: LOAD_TEST_STAGES.heavy,
      exec: 'readHeavyTest',
      tags: { test_type: 'read_heavy' },
    },
    
    // Write-heavy workload (data imports, bulk operations)
    write_heavy_workload: {
      executor: 'constant-vus',
      vus: 10,
      duration: '8m',
      exec: 'writeHeavyTest',
      tags: { test_type: 'write_heavy' },
    },
    
    // Mixed workload simulation
    mixed_workload: {
      executor: 'ramping-vus',
      stages: LOAD_TEST_STAGES.moderate,
      exec: 'mixedWorkloadTest',
      tags: { test_type: 'mixed' },
    },
    
    // API endpoint stress test
    endpoint_stress: {
      executor: 'constant-arrival-rate',
      rate: 50,
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 30,
      exec: 'endpointStressTest',
      tags: { test_type: 'stress' },
    }
  },
  
  thresholds: {
    ...PERFORMANCE_THRESHOLDS,
    api_response_time: ['p(95)<2000'], // 95% under 2s
    api_error_rate: ['rate<0.05'], // Less than 5% errors
    auth_success_rate: ['rate>0.98'], // 98% auth success
    database_query_time: ['p(95)<1000'], // DB queries under 1s
  }
};

export { setup, teardown };

/**
 * Authentication Performance Test
 * Tests login, token refresh, and session management
 */
export function authenticationTest() {
  concurrentUsers.add(1);
  
  // Test login
  const loginStartTime = Date.now();
  const loginData = {
    email: TestData.randomEmail(),
    password: 'TestPassword123!',
  };
  
  const loginResponse = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify(loginData),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { endpoint: 'auth', operation: 'login' }
    }
  );
  
  const loginDuration = Date.now() - loginStartTime;
  
  const loginSuccess = check(loginResponse, {
    'login status is 200 or 401': (r) => [200, 401].includes(r.status),
    'login response time < 3s': (r) => r.timings.duration < 3000,
  });
  
  apiResponseTime.add(loginDuration, { endpoint: 'auth_login' });
  authSuccessRate.add(loginResponse.status === 200);
  PerformanceMonitor.trackApiOperation('auth/login', loginDuration, loginResponse.status);
  
  if (loginResponse.status === 200) {
    const token = loginResponse.json('token');
    const refreshToken = loginResponse.json('refreshToken');
    
    // Test authenticated endpoint
    const profileStartTime = Date.now();
    const profileResponse = http.get(
      `${BASE_URL}/api/auth/profile`,
      {
        headers: getAuthHeaders(token),
        tags: { endpoint: 'auth', operation: 'profile' }
      }
    );
    
    const profileDuration = Date.now() - profileStartTime;
    apiResponseTime.add(profileDuration, { endpoint: 'auth_profile' });
    
    checkResponse(profileResponse, 200, {
      endpoint: 'auth',
      operation: 'profile'
    });
    
    // Test token refresh
    if (refreshToken) {
      const refreshStartTime = Date.now();
      const refreshResponse = http.post(
        `${BASE_URL}/api/auth/refresh`,
        JSON.stringify({ refreshToken }),
        {
          headers: { 'Content-Type': 'application/json' },
          tags: { endpoint: 'auth', operation: 'refresh' }
        }
      );
      
      const refreshDuration = Date.now() - refreshStartTime;
      apiResponseTime.add(refreshDuration, { endpoint: 'auth_refresh' });
      
      check(refreshResponse, {
        'token refresh successful': (r) => r.status === 200,
        'new token received': (r) => r.json('token') !== undefined,
      });
    }
    
    // Test logout
    const logoutResponse = http.post(
      `${BASE_URL}/api/auth/logout`,
      '{}',
      {
        headers: getAuthHeaders(token),
        tags: { endpoint: 'auth', operation: 'logout' }
      }
    );
    
    checkResponse(logoutResponse, 200, {
      endpoint: 'auth',
      operation: 'logout'
    });
  }
  
  apiErrorRate.add(!loginSuccess);
  thinkTime(1, 3);
}

/**
 * CRUD Operations Test
 * Tests Create, Read, Update, Delete operations on leads and campaigns
 */
export function crudOperationsTest() {
  const token = authenticate();
  const headers = getAuthHeaders(token);
  
  concurrentUsers.add(1);
  
  // CREATE: Add a new lead
  const leadData = TestData.sampleLead();
  const createStartTime = Date.now();
  
  const createResponse = http.post(
    `${BASE_URL}/api/leads`,
    JSON.stringify(leadData),
    {
      headers,
      tags: { endpoint: 'leads', operation: 'create' }
    }
  );
  
  const createDuration = Date.now() - createStartTime;
  apiResponseTime.add(createDuration, { endpoint: 'leads_create' });
  PerformanceMonitor.trackApiOperation('leads/create', createDuration, createResponse.status);
  
  const createSuccess = checkResponse(createResponse, 201, {
    endpoint: 'leads',
    operation: 'create'
  });
  
  if (createSuccess) {
    const leadId = createResponse.json('id');
    
    // READ: Get the lead
    const readStartTime = Date.now();
    const readResponse = http.get(
      `${BASE_URL}/api/leads/${leadId}`,
      {
        headers,
        tags: { endpoint: 'leads', operation: 'read' }
      }
    );
    
    const readDuration = Date.now() - readStartTime;
    apiResponseTime.add(readDuration, { endpoint: 'leads_read' });
    
    checkResponse(readResponse, 200, {
      endpoint: 'leads',
      operation: 'read'
    });
    
    // UPDATE: Modify the lead
    const updateData = {
      ...leadData,
      firstName: TestData.randomString(8),
      lastContacted: new Date().toISOString(),
    };
    
    const updateStartTime = Date.now();
    const updateResponse = http.put(
      `${BASE_URL}/api/leads/${leadId}`,
      JSON.stringify(updateData),
      {
        headers,
        tags: { endpoint: 'leads', operation: 'update' }
      }
    );
    
    const updateDuration = Date.now() - updateStartTime;
    apiResponseTime.add(updateDuration, { endpoint: 'leads_update' });
    
    checkResponse(updateResponse, 200, {
      endpoint: 'leads',
      operation: 'update'
    });
    
    // LIST: Get leads with pagination
    const listStartTime = Date.now();
    const listResponse = http.get(
      `${BASE_URL}/api/leads?page=1&limit=20&sort=createdAt&order=desc`,
      {
        headers,
        tags: { endpoint: 'leads', operation: 'list' }
      }
    );
    
    const listDuration = Date.now() - listStartTime;
    apiResponseTime.add(listDuration, { endpoint: 'leads_list' });
    
    const listSuccess = checkResponse(listResponse, 200, {
      endpoint: 'leads',
      operation: 'list'
    });
    
    if (listSuccess) {
      check(listResponse, {
        'list has pagination info': (r) => r.json('pagination') !== undefined,
        'list has leads array': (r) => Array.isArray(r.json('leads')),
        'list respects limit': (r) => r.json('leads').length <= 20,
      });
    }
    
    // DELETE: Remove the lead
    const deleteStartTime = Date.now();
    const deleteResponse = http.del(
      `${BASE_URL}/api/leads/${leadId}`,
      null,
      {
        headers,
        tags: { endpoint: 'leads', operation: 'delete' }
      }
    );
    
    const deleteDuration = Date.now() - deleteStartTime;
    apiResponseTime.add(deleteDuration, { endpoint: 'leads_delete' });
    
    checkResponse(deleteResponse, 204, {
      endpoint: 'leads',
      operation: 'delete'
    });
  }
  
  apiThroughput.add(1);
  thinkTime(2, 5);
}

/**
 * Read-Heavy Workload Test
 * Simulates analytics and reporting workloads
 */
export function readHeavyTest() {
  const token = authenticate();
  const headers = getAuthHeaders(token);
  
  concurrentUsers.add(1);
  
  const readOperations = [
    // Analytics endpoints
    {
      url: `${BASE_URL}/api/analytics/dashboard`,
      name: 'dashboard_analytics',
      expectedStatus: 200,
    },
    {
      url: `${BASE_URL}/api/analytics/email-performance?days=30`,
      name: 'email_performance',
      expectedStatus: 200,
    },
    {
      url: `${BASE_URL}/api/analytics/conversion-funnel?campaignId=all&days=30`,
      name: 'conversion_funnel',
      expectedStatus: 200,
    },
    
    // Campaign stats
    {
      url: `${BASE_URL}/api/campaigns?status=active&include=stats`,
      name: 'active_campaigns',
      expectedStatus: 200,
    },
    
    // Lead analytics
    {
      url: `${BASE_URL}/api/leads/analytics?timeframe=30d&groupBy=source`,
      name: 'lead_analytics',
      expectedStatus: 200,
    },
    
    // Team performance
    {
      url: `${BASE_URL}/api/analytics/team-performance?period=month`,
      name: 'team_performance',
      expectedStatus: 200,
    }
  ];
  
  // Perform multiple read operations
  for (const operation of readOperations) {
    const startTime = Date.now();
    
    const response = apiCircuitBreaker.call(() => 
      http.get(operation.url, {
        headers,
        tags: { endpoint: 'analytics', operation: operation.name }
      })
    );
    
    const duration = Date.now() - startTime;
    
    apiResponseTime.add(duration, { endpoint: operation.name });
    databaseQueryTime.add(duration, { operation: operation.name });
    PerformanceMonitor.trackApiOperation(operation.name, duration, response.status);
    
    checkResponse(response, operation.expectedStatus, {
      endpoint: 'analytics',
      operation: operation.name
    });
    
    // Check for database performance indicators
    const dbTime = response.headers['X-Database-Time'];
    if (dbTime) {
      databaseQueryTime.add(parseInt(dbTime), { source: 'header' });
    }
    
    // Short pause between operations
    sleep(0.5);
  }
  
  apiThroughput.add(readOperations.length);
  thinkTime(3, 7);
}

/**
 * Write-Heavy Workload Test
 * Simulates bulk operations and data imports
 */
export function writeHeavyTest() {
  const token = authenticate();
  const headers = getAuthHeaders(token);
  
  concurrentUsers.add(1);
  
  // Bulk lead import
  const bulkLeads = [];
  for (let i = 0; i < 50; i++) {
    bulkLeads.push(TestData.sampleLead());
  }
  
  const bulkImportStartTime = Date.now();
  const bulkImportResponse = http.post(
    `${BASE_URL}/api/leads/bulk-import`,
    JSON.stringify({ leads: bulkLeads }),
    {
      headers,
      tags: { endpoint: 'leads', operation: 'bulk_import' }
    }
  );
  
  const bulkImportDuration = Date.now() - bulkImportStartTime;
  apiResponseTime.add(bulkImportDuration, { endpoint: 'bulk_import' });
  PerformanceMonitor.trackApiOperation('leads/bulk-import', bulkImportDuration, bulkImportResponse.status);
  
  checkResponse(bulkImportResponse, 202, {
    endpoint: 'leads',
    operation: 'bulk_import'
  });
  
  // Campaign creation with sequence
  const campaignData = {
    ...TestData.sampleCampaign(),
    sequence: [
      {
        delay: 0,
        subject: 'Welcome Email',
        content: 'Welcome to our service, {{firstName}}!',
      },
      {
        delay: 86400,
        subject: 'Follow Up',
        content: 'Just following up, {{firstName}}...',
      },
      {
        delay: 259200,
        subject: 'Final Follow Up',
        content: 'Last chance, {{firstName}}!',
      }
    ]
  };
  
  const campaignCreateStartTime = Date.now();
  const campaignResponse = http.post(
    `${BASE_URL}/api/campaigns`,
    JSON.stringify(campaignData),
    {
      headers,
      tags: { endpoint: 'campaigns', operation: 'create' }
    }
  );
  
  const campaignCreateDuration = Date.now() - campaignCreateStartTime;
  apiResponseTime.add(campaignCreateDuration, { endpoint: 'campaign_create' });
  
  checkResponse(campaignResponse, 201, {
    endpoint: 'campaigns',
    operation: 'create'
  });
  
  // Multiple lead updates
  for (let i = 0; i < 10; i++) {
    const leadUpdateData = {
      ...TestData.sampleLead(),
      tags: [`tag-${i}`, 'load-test'],
      customFields: {
        testField: TestData.randomString(10),
        updateIndex: i,
      }
    };
    
    const updateStartTime = Date.now();
    const updateResponse = http.post(
      `${BASE_URL}/api/leads`,
      JSON.stringify(leadUpdateData),
      {
        headers,
        tags: { endpoint: 'leads', operation: 'rapid_create' }
      }
    );
    
    const updateDuration = Date.now() - updateStartTime;
    apiResponseTime.add(updateDuration, { endpoint: 'rapid_create' });
    
    if (updateResponse.status !== 201) {
      apiErrorRate.add(1);
    }
    
    // Very short pause
    sleep(0.1);
  }
  
  apiThroughput.add(12); // bulk + campaign + 10 leads
  thinkTime(5, 10);
}

/**
 * Mixed Workload Test
 * Simulates realistic user behavior with mixed operations
 */
export function mixedWorkloadTest() {
  const token = authenticate();
  const headers = getAuthHeaders(token);
  
  concurrentUsers.add(1);
  
  // User workflow simulation
  const workflows = [
    () => checkDashboard(headers),
    () => browseCampaigns(headers),
    () => manageLeads(headers),
    () => viewAnalytics(headers),
    () => updateSettings(headers),
  ];
  
  // Randomly execute workflows
  const selectedWorkflows = workflows.sort(() => 0.5 - Math.random()).slice(0, 3);
  
  for (const workflow of selectedWorkflows) {
    try {
      workflow();
      thinkTime(2, 4);
    } catch (error) {
      apiErrorRate.add(1);
      console.log(`Workflow error: ${error.message}`);
    }
  }
  
  apiThroughput.add(selectedWorkflows.length);
}

/**
 * Endpoint Stress Test
 * High-frequency requests to critical endpoints
 */
export function endpointStressTest() {
  const token = authenticate();
  const headers = getAuthHeaders(token);
  
  const criticalEndpoints = [
    `${BASE_URL}/api/leads?limit=10`,
    `${BASE_URL}/api/campaigns?status=active`,
    `${BASE_URL}/api/analytics/dashboard`,
    `${BASE_URL}/api/auth/profile`,
  ];
  
  const endpoint = criticalEndpoints[Math.floor(Math.random() * criticalEndpoints.length)];
  
  const startTime = Date.now();
  const response = http.get(endpoint, {
    headers,
    tags: { endpoint: 'stress_test', operation: 'high_frequency' }
  });
  
  const duration = Date.now() - startTime;
  
  apiResponseTime.add(duration, { endpoint: 'stress_test' });
  PerformanceMonitor.trackApiOperation('stress_test', duration, response.status);
  
  check(response, {
    'stress test response ok': (r) => r.status < 500,
    'stress test response fast': (r) => r.timings.duration < 5000,
  });
  
  if (response.status >= 400) {
    apiErrorRate.add(1);
  }
  
  apiThroughput.add(1);
  
  // No think time for stress test
}

// Helper functions for workflows
function checkDashboard(headers) {
  const startTime = Date.now();
  const response = http.get(`${BASE_URL}/api/analytics/dashboard`, {
    headers,
    tags: { workflow: 'dashboard' }
  });
  
  const duration = Date.now() - startTime;
  apiResponseTime.add(duration, { endpoint: 'dashboard' });
  
  return checkResponse(response, 200, { workflow: 'dashboard' });
}

function browseCampaigns(headers) {
  const startTime = Date.now();
  const response = http.get(`${BASE_URL}/api/campaigns?include=stats&limit=20`, {
    headers,
    tags: { workflow: 'campaigns' }
  });
  
  const duration = Date.now() - startTime;
  apiResponseTime.add(duration, { endpoint: 'campaigns_browse' });
  
  return checkResponse(response, 200, { workflow: 'campaigns' });
}

function manageLeads(headers) {
  // Get leads list
  const listStartTime = Date.now();
  const listResponse = http.get(`${BASE_URL}/api/leads?limit=50`, {
    headers,
    tags: { workflow: 'leads_list' }
  });
  
  const listDuration = Date.now() - listStartTime;
  apiResponseTime.add(listDuration, { endpoint: 'leads_manage' });
  
  checkResponse(listResponse, 200, { workflow: 'leads' });
  
  // Add a new lead
  const leadData = TestData.sampleLead();
  const createStartTime = Date.now();
  const createResponse = http.post(
    `${BASE_URL}/api/leads`,
    JSON.stringify(leadData),
    {
      headers,
      tags: { workflow: 'leads_create' }
    }
  );
  
  const createDuration = Date.now() - createStartTime;
  apiResponseTime.add(createDuration, { endpoint: 'leads_create' });
  
  return checkResponse(createResponse, 201, { workflow: 'leads' });
}

function viewAnalytics(headers) {
  const endpoints = [
    '/api/analytics/email-performance?days=7',
    '/api/analytics/conversion-rates?period=week',
    '/api/analytics/lead-sources?timeframe=30d',
  ];
  
  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  
  const startTime = Date.now();
  const response = http.get(`${BASE_URL}${endpoint}`, {
    headers,
    tags: { workflow: 'analytics' }
  });
  
  const duration = Date.now() - startTime;
  apiResponseTime.add(duration, { endpoint: 'analytics_view' });
  
  return checkResponse(response, 200, { workflow: 'analytics' });
}

function updateSettings(headers) {
  const settingsData = {
    emailSignature: `Best regards,\n${TestData.randomString(10)}`,
    timezone: 'UTC',
    notifications: {
      emailReplies: true,
      campaignUpdates: Math.random() > 0.5,
    }
  };
  
  const startTime = Date.now();
  const response = http.put(
    `${BASE_URL}/api/settings/profile`,
    JSON.stringify(settingsData),
    {
      headers,
      tags: { workflow: 'settings' }
    }
  );
  
  const duration = Date.now() - startTime;
  apiResponseTime.add(duration, { endpoint: 'settings_update' });
  
  return checkResponse(response, 200, { workflow: 'settings' });
}

// Export metrics for use in other tests
export {
  apiResponseTime,
  apiErrorRate,
  authSuccessRate,
  concurrentUsers,
  apiThroughput,
  databaseQueryTime,
};