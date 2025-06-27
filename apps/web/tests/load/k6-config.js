/**
 * K6 Load Testing Configuration for ColdCopy
 * 
 * This file contains common configuration, utilities, and test scenarios
 * for all load tests in the ColdCopy application.
 */

import { check, sleep } from 'k6';
import http from 'k6/http';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
export const errorRate = new Rate('errors');
export const responseTrend = new Trend('response_time', true);
export const requestsCounter = new Counter('total_requests');

// Environment configuration
export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
export const TEST_USER_EMAIL = __ENV.TEST_USER_EMAIL || 'test@coldcopy.test';
export const TEST_USER_PASSWORD = __ENV.TEST_USER_PASSWORD || 'TestPassword123!';
export const WORKSPACE_ID = __ENV.WORKSPACE_ID || 'test-workspace-id';
export const API_KEY = __ENV.API_KEY || 'test-api-key';

// Test stages configuration
export const LOAD_TEST_STAGES = {
  // Light load test - for CI/CD
  light: [
    { duration: '1m', target: 5 },   // Ramp-up to 5 users
    { duration: '2m', target: 5 },   // Stay at 5 users
    { duration: '1m', target: 0 },   // Ramp-down to 0 users
  ],
  
  // Moderate load test - for regular testing
  moderate: [
    { duration: '2m', target: 20 },  // Ramp-up to 20 users
    { duration: '5m', target: 20 },  // Stay at 20 users
    { duration: '2m', target: 50 },  // Ramp-up to 50 users
    { duration: '5m', target: 50 },  // Stay at 50 users
    { duration: '2m', target: 0 },   // Ramp-down to 0 users
  ],
  
  // Heavy load test - for stress testing
  heavy: [
    { duration: '3m', target: 50 },  // Ramp-up to 50 users
    { duration: '5m', target: 50 },  // Stay at 50 users
    { duration: '3m', target: 100 }, // Ramp-up to 100 users
    { duration: '10m', target: 100 }, // Stay at 100 users
    { duration: '3m', target: 200 }, // Spike to 200 users
    { duration: '2m', target: 200 }, // Stay at 200 users
    { duration: '3m', target: 0 },   // Ramp-down to 0 users
  ],
  
  // Spike test - for sudden traffic spikes
  spike: [
    { duration: '1m', target: 10 },  // Normal load
    { duration: '30s', target: 500 }, // Spike
    { duration: '1m', target: 10 },  // Back to normal
    { duration: '30s', target: 1000 }, // Bigger spike
    { duration: '1m', target: 10 },  // Back to normal
    { duration: '1m', target: 0 },   // Ramp-down
  ],
  
  // Soak test - for long-running stability
  soak: [
    { duration: '5m', target: 30 },  // Ramp-up
    { duration: '60m', target: 30 }, // Soak for 1 hour
    { duration: '5m', target: 0 },   // Ramp-down
  ]
};

// Performance thresholds
export const PERFORMANCE_THRESHOLDS = {
  // Response time thresholds
  http_req_duration: ['p(50)<500', 'p(95)<2000', 'p(99)<5000'],
  
  // Error rate thresholds
  http_req_failed: ['rate<0.05'], // Less than 5% errors
  errors: ['rate<0.05'],
  
  // Throughput thresholds
  http_reqs: ['rate>10'], // At least 10 requests per second
  
  // Database response time
  'http_req_duration{endpoint:database}': ['p(95)<1000'],
  
  // API response time
  'http_req_duration{endpoint:api}': ['p(95)<1500'],
  
  // Email processing time
  'http_req_duration{endpoint:email}': ['p(95)<3000'],
  
  // Authentication response time
  'http_req_duration{endpoint:auth}': ['p(95)<1000'],
};

// Test scenarios
export const TEST_SCENARIOS = {
  // Regular user browsing
  user_browsing: {
    executor: 'ramping-vus',
    stages: LOAD_TEST_STAGES.moderate,
    exec: 'userBrowsingScenario',
  },
  
  // API usage
  api_usage: {
    executor: 'constant-vus',
    vus: 10,
    duration: '5m',
    exec: 'apiUsageScenario',
  },
  
  // Email sending
  email_sending: {
    executor: 'ramping-vus',
    stages: LOAD_TEST_STAGES.light,
    exec: 'emailSendingScenario',
  },
  
  // Database operations
  database_ops: {
    executor: 'constant-vus',
    vus: 5,
    duration: '3m',
    exec: 'databaseOperationsScenario',
  }
};

/**
 * Authentication helper
 */
export function authenticate() {
  const loginResponse = http.post(`${BASE_URL}/api/auth/login`, {
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
  }, {
    headers: { 'Content-Type': 'application/json' },
  });
  
  check(loginResponse, {
    'login successful': (r) => r.status === 200,
    'received auth token': (r) => r.json('token') !== undefined,
  });
  
  return loginResponse.json('token');
}

/**
 * Helper to create authenticated headers
 */
export function getAuthHeaders(token) {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'X-Workspace-ID': WORKSPACE_ID,
  };
}

/**
 * Helper to check response
 */
export function checkResponse(response, expectedStatus = 200, tags = {}) {
  const success = check(response, {
    [`status is ${expectedStatus}`]: (r) => r.status === expectedStatus,
    'response time < 5s': (r) => r.timings.duration < 5000,
  });
  
  // Record metrics
  errorRate.add(!success, tags);
  responseTrend.add(response.timings.duration, tags);
  requestsCounter.add(1, tags);
  
  return success;
}

/**
 * Helper to simulate user think time
 */
export function thinkTime(min = 1, max = 3) {
  sleep(Math.random() * (max - min) + min);
}

/**
 * Generate random test data
 */
export const TestData = {
  randomEmail: () => `test-${Math.random().toString(36).substr(2, 9)}@coldcopy.test`,
  randomString: (length = 10) => Math.random().toString(36).substr(2, length),
  randomNumber: (min = 1, max = 1000) => Math.floor(Math.random() * (max - min + 1)) + min,
  
  // Sample lead data
  sampleLead: () => ({
    email: TestData.randomEmail(),
    firstName: TestData.randomString(8),
    lastName: TestData.randomString(10),
    company: `${TestData.randomString(6)} Corp`,
    title: 'Marketing Director',
    phone: '+1-555-' + TestData.randomNumber(1000000, 9999999),
  }),
  
  // Sample campaign data
  sampleCampaign: () => ({
    name: `Test Campaign ${TestData.randomString(6)}`,
    subject: `Testing Subject ${TestData.randomString(4)}`,
    content: `Hello {{firstName}}, this is a test email for load testing. Random: ${TestData.randomString(20)}`,
    fromEmail: 'test@coldcopy.test',
    fromName: 'Test Sender',
  }),
};

/**
 * Rate limiting helper
 */
export function respectRateLimit(response) {
  const rateLimitRemaining = response.headers['X-RateLimit-Remaining'];
  const rateLimitReset = response.headers['X-RateLimit-Reset'];
  
  if (rateLimitRemaining && parseInt(rateLimitRemaining) < 5) {
    const resetTime = new Date(parseInt(rateLimitReset) * 1000);
    const waitTime = Math.max(0, resetTime.getTime() - Date.now());
    console.log(`Rate limit approaching, waiting ${waitTime}ms`);
    sleep(waitTime / 1000);
  }
}

/**
 * Circuit breaker pattern for resilient testing
 */
export class CircuitBreaker {
  constructor(threshold = 5, timeout = 30000) {
    this.failureThreshold = threshold;
    this.timeout = timeout;
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
  }
  
  call(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }
    
    try {
      const result = fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }
  
  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }
}

// Export common circuit breaker instance
export const apiCircuitBreaker = new CircuitBreaker();

/**
 * Performance monitoring utilities
 */
export const PerformanceMonitor = {
  // Track database performance
  trackDatabaseOperation: (operation, duration) => {
    responseTrend.add(duration, { operation: 'database', type: operation });
  },
  
  // Track API performance
  trackApiOperation: (endpoint, duration, status) => {
    responseTrend.add(duration, { operation: 'api', endpoint, status });
  },
  
  // Track email performance
  trackEmailOperation: (operation, duration, count = 1) => {
    responseTrend.add(duration, { operation: 'email', type: operation });
    requestsCounter.add(count, { operation: 'email', type: operation });
  },
  
  // Memory usage tracking (if available)
  trackMemoryUsage: () => {
    if (typeof __VU !== 'undefined') {
      // VU-specific memory tracking
      console.log(`VU ${__VU}: Memory usage tracking`);
    }
  }
};

/**
 * Load test configuration based on test type
 */
export function getTestConfig(testType = 'moderate') {
  const testStage = LOAD_TEST_STAGES[testType] || LOAD_TEST_STAGES.moderate;
  
  return {
    stages: testStage,
    thresholds: PERFORMANCE_THRESHOLDS,
    setupTimeout: '30s',
    teardownTimeout: '30s',
    noConnectionReuse: false,
    userAgent: 'ColdCopy-LoadTest/1.0',
    tags: {
      test_type: testType,
      environment: __ENV.ENVIRONMENT || 'test',
    },
  };
}

/**
 * Common setup function for all tests
 */
export function setup() {
  console.log('Starting ColdCopy load test setup...');
  
  // Verify the application is accessible
  const healthCheck = http.get(`${BASE_URL}/api/health`);
  if (healthCheck.status !== 200) {
    throw new Error(`Application health check failed: ${healthCheck.status}`);
  }
  
  // Setup test data
  const authToken = authenticate();
  
  return {
    authToken,
    startTime: new Date(),
  };
}

/**
 * Common teardown function for all tests
 */
export function teardown(data) {
  console.log('Load test completed');
  console.log(`Test duration: ${Date.now() - data.startTime.getTime()}ms`);
  
  // Cleanup test data if needed
  // This would be implemented based on your cleanup requirements
}

export default {
  BASE_URL,
  LOAD_TEST_STAGES,
  PERFORMANCE_THRESHOLDS,
  TEST_SCENARIOS,
  TestData,
  PerformanceMonitor,
  getTestConfig,
  setup,
  teardown,
};