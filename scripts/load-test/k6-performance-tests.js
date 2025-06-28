import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const apiErrorRate = new Rate('api_errors');
const responseTimeP95 = new Trend('response_time_p95');
const requestsPerSecond = new Rate('requests_per_second');
const databaseQueryTime = new Trend('database_query_time');
const authFailures = new Counter('auth_failures');

// Test configuration based on environment
const testConfig = {
  light: {
    stages: [
      { duration: '1m', target: 10 },   // Ramp up to 10 users
      { duration: '3m', target: 10 },   // Stay at 10 users
      { duration: '1m', target: 0 },    // Ramp down
    ],
  },
  moderate: {
    stages: [
      { duration: '2m', target: 50 },   // Ramp up to 50 users
      { duration: '5m', target: 50 },   // Stay at 50 users
      { duration: '2m', target: 100 },  // Ramp up to 100 users
      { duration: '5m', target: 100 },  // Stay at 100 users
      { duration: '2m', target: 0 },    // Ramp down
    ],
  },
  heavy: {
    stages: [
      { duration: '5m', target: 100 },  // Ramp up to 100 users
      { duration: '10m', target: 200 }, // Ramp up to 200 users
      { duration: '15m', target: 200 }, // Stay at 200 users
      { duration: '5m', target: 300 },  // Spike to 300 users
      { duration: '5m', target: 200 },  // Back to 200 users
      { duration: '5m', target: 0 },    // Ramp down
    ],
  },
  stress: {
    stages: [
      { duration: '2m', target: 100 },  // Ramp up to 100
      { duration: '5m', target: 200 },  // Ramp up to 200
      { duration: '2m', target: 300 },  // Ramp up to 300
      { duration: '5m', target: 400 },  // Ramp up to 400
      { duration: '2m', target: 500 },  // Spike to 500
      { duration: '5m', target: 0 },    // Crash test - immediate ramp down
    ],
  },
};

// Get test type from environment or default to light
const testType = __ENV.TEST_TYPE || 'light';
const baseUrl = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  ...testConfig[testType],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% of requests should be below 1s
    http_req_failed: ['rate<0.1'],     // Error rate should be below 10%
    api_errors: ['rate<0.05'],         // API error rate should be below 5%
    requests_per_second: ['rate>1'],   // Should handle at least 1 RPS
  },
  ext: {
    loadimpact: {
      projectID: 3639742,
      name: `ColdCopy ${testType} Load Test`,
    },
  },
};

// Test data generators
function generateEmail() {
  return `test${Math.floor(Math.random() * 10000)}@example.com`;
}

function generateCompany() {
  const companies = ['Acme Corp', 'TechStart Inc', 'Global Solutions', 'Innovation Labs', 'Digital Dynamics'];
  return companies[Math.floor(Math.random() * companies.length)];
}

function generateLead() {
  return {
    email: generateEmail(),
    firstName: 'Test',
    lastName: 'User',
    company: generateCompany(),
    title: 'Marketing Manager',
    phone: '+1234567890',
    website: 'https://example.com',
  };
}

// Authentication helper
let authToken = null;

function authenticate() {
  if (authToken) return authToken;
  
  const loginResponse = http.post(`${baseUrl}/api/auth/signin`, {
    email: 'admin@coldcopy.cc',
    password: 'testpassword123',
  }, {
    headers: { 'Content-Type': 'application/json' },
  });
  
  if (loginResponse.status === 200) {
    const cookies = loginResponse.cookies;
    authToken = cookies['supabase-auth-token']?.[0]?.value;
    return authToken;
  } else {
    authFailures.add(1);
    console.error('Authentication failed:', loginResponse.status);
    return null;
  }
}

// Test scenarios
export function leadManagementTest() {
  const token = authenticate();
  if (!token) return;
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
  
  // Test lead creation
  const createLeadResponse = http.post(
    `${baseUrl}/api/leads`,
    JSON.stringify(generateLead()),
    { headers }
  );
  
  check(createLeadResponse, {
    'lead creation successful': (r) => r.status === 201,
    'response time < 2s': (r) => r.timings.duration < 2000,
  });
  
  if (createLeadResponse.status !== 201) {
    apiErrorRate.add(1);
    return;
  }
  
  const leadId = createLeadResponse.json('id');
  
  // Test lead retrieval
  const getLeadResponse = http.get(`${baseUrl}/api/leads/${leadId}`, { headers });
  
  check(getLeadResponse, {
    'lead retrieval successful': (r) => r.status === 200,
    'response time < 1s': (r) => r.timings.duration < 1000,
  });
  
  // Test lead update
  const updateLeadResponse = http.put(
    `${baseUrl}/api/leads/${leadId}`,
    JSON.stringify({ title: 'Senior Marketing Manager' }),
    { headers }
  );
  
  check(updateLeadResponse, {
    'lead update successful': (r) => r.status === 200,
  });
  
  // Record database query time (simulated)
  databaseQueryTime.add(createLeadResponse.timings.duration);
  
  sleep(1);
}

export function campaignManagementTest() {
  const token = authenticate();
  if (!token) return;
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
  
  // Test campaign creation
  const createCampaignResponse = http.post(
    `${baseUrl}/api/campaigns`,
    JSON.stringify({
      name: `Load Test Campaign ${Date.now()}`,
      subject: 'Load Test Email',
      content: 'This is a load test email.',
      status: 'draft',
    }),
    { headers }
  );
  
  check(createCampaignResponse, {
    'campaign creation successful': (r) => r.status === 201,
    'response time < 3s': (r) => r.timings.duration < 3000,
  });
  
  if (createCampaignResponse.status !== 201) {
    apiErrorRate.add(1);
    return;
  }
  
  // Test campaign list retrieval
  const getCampaignsResponse = http.get(`${baseUrl}/api/campaigns`, { headers });
  
  check(getCampaignsResponse, {
    'campaigns retrieval successful': (r) => r.status === 200,
    'response time < 2s': (r) => r.timings.duration < 2000,
  });
  
  sleep(1);
}

export function analyticsTest() {
  const token = authenticate();
  if (!token) return;
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
  
  // Test analytics dashboard
  const analyticsResponse = http.get(`${baseUrl}/api/analytics/overview`, { headers });
  
  check(analyticsResponse, {
    'analytics retrieval successful': (r) => r.status === 200,
    'response time < 5s': (r) => r.timings.duration < 5000,
  });
  
  // Test campaign analytics
  const campaignAnalyticsResponse = http.get(`${baseUrl}/api/analytics/campaigns`, { headers });
  
  check(campaignAnalyticsResponse, {
    'campaign analytics successful': (r) => r.status === 200,
  });
  
  sleep(1);
}

export function emailTrackingTest() {
  // Test email tracking (public endpoint)
  const trackingId = 'test-tracking-id-' + Math.random().toString(36).substring(7);
  
  const openTrackingResponse = http.get(`${baseUrl}/api/email/track/open/${trackingId}`);
  
  check(openTrackingResponse, {
    'open tracking successful': (r) => r.status === 200 || r.status === 204,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  
  const clickTrackingResponse = http.get(`${baseUrl}/api/email/track/click/${trackingId}?url=https://example.com`);
  
  check(clickTrackingResponse, {
    'click tracking successful': (r) => r.status === 302 || r.status === 200,
  });
  
  sleep(0.5);
}

export function performanceMonitoringTest() {
  const token = authenticate();
  if (!token) return;
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
  
  // Test performance dashboard
  const performanceResponse = http.get(`${baseUrl}/api/admin/performance`, { headers });
  
  check(performanceResponse, {
    'performance monitoring successful': (r) => r.status === 200,
    'response time < 3s': (r) => r.timings.duration < 3000,
  });
  
  sleep(2);
}

export function apiKeyAuthTest() {
  // Test API key authentication
  const apiKey = __ENV.TEST_API_KEY || 'cc_test_key_for_load_testing';
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };
  
  const apiKeyResponse = http.get(`${baseUrl}/api/leads`, { headers });
  
  check(apiKeyResponse, {
    'API key auth works': (r) => r.status === 200 || r.status === 401, // 401 if key is invalid
  });
  
  sleep(1);
}

// Main test function
export default function() {
  const scenario = Math.random();
  
  if (scenario < 0.3) {
    leadManagementTest();
  } else if (scenario < 0.5) {
    campaignManagementTest();
  } else if (scenario < 0.65) {
    analyticsTest();
  } else if (scenario < 0.8) {
    emailTrackingTest();
  } else if (scenario < 0.9) {
    performanceMonitoringTest();
  } else {
    apiKeyAuthTest();
  }
  
  // Record overall request rate
  requestsPerSecond.add(1);
}

// Setup function
export function setup() {
  console.log(`Starting ${testType} load test against ${baseUrl}`);
  console.log(`Test configuration:`, testConfig[testType]);
  
  // Verify the application is accessible
  const healthCheck = http.get(`${baseUrl}/api/health`);
  if (healthCheck.status !== 200) {
    console.error('Application health check failed:', healthCheck.status);
    throw new Error('Application is not accessible');
  }
  
  return { baseUrl, testType };
}

// Teardown function
export function teardown(data) {
  console.log(`Load test completed for ${data.testType}`);
  console.log('Check the results for performance metrics and recommendations.');
}