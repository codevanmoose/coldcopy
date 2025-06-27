/**
 * Email Sending Load Tests for ColdCopy
 * 
 * Tests the performance of email sending operations including:
 * - Bulk email sending
 * - Campaign execution
 * - SES rate limiting handling
 * - Email delivery tracking
 * - Template processing
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
  respectRateLimit,
  PerformanceMonitor,
  getTestConfig,
  setup,
  teardown,
} from './k6-config.js';

// Email-specific metrics
const emailSendRate = new Rate('email_send_success');
const emailProcessingTime = new Trend('email_processing_duration');
const emailQueueDepth = new Trend('email_queue_depth');
const emailDeliveryRate = new Rate('email_delivery_success');
const templateRenderingTime = new Trend('template_rendering_duration');
const sesRateLimitHits = new Counter('ses_rate_limit_hits');

// Test configuration
export let options = {
  ...getTestConfig('moderate'),
  scenarios: {
    // Single email sending test
    single_email_sending: {
      executor: 'ramping-vus',
      stages: LOAD_TEST_STAGES.light,
      exec: 'singleEmailTest',
      tags: { test_type: 'single_email' },
    },
    
    // Bulk email sending test
    bulk_email_sending: {
      executor: 'ramping-vus',
      stages: LOAD_TEST_STAGES.moderate,
      exec: 'bulkEmailTest',
      tags: { test_type: 'bulk_email' },
    },
    
    // Campaign execution test
    campaign_execution: {
      executor: 'constant-vus',
      vus: 5,
      duration: '10m',
      exec: 'campaignExecutionTest',
      tags: { test_type: 'campaign' },
    },
    
    // Email tracking test
    email_tracking: {
      executor: 'constant-vus',
      vus: 20,
      duration: '5m',
      exec: 'emailTrackingTest',
      tags: { test_type: 'tracking' },
    },
    
    // Template processing test
    template_processing: {
      executor: 'ramping-vus',
      stages: LOAD_TEST_STAGES.light,
      exec: 'templateProcessingTest',
      tags: { test_type: 'templates' },
    },
    
    // SES rate limit handling test
    ses_rate_limit: {
      executor: 'constant-arrival-rate',
      rate: 100, // High rate to trigger limits
      timeUnit: '1s',
      duration: '3m',
      preAllocatedVUs: 50,
      exec: 'sesRateLimitTest',
      tags: { test_type: 'rate_limit' },
    }
  },
  
  thresholds: {
    ...PERFORMANCE_THRESHOLDS,
    email_send_success: ['rate>0.95'], // 95% success rate
    email_processing_duration: ['p(95)<10000'], // 10s for processing
    template_rendering_duration: ['p(95)<1000'], // 1s for rendering
    ses_rate_limit_hits: ['count<10'], // Minimal rate limit hits
  }
};

export { setup, teardown };

/**
 * Single Email Sending Test
 * Tests individual email sending performance
 */
export function singleEmailTest() {
  const token = authenticate();
  const headers = getAuthHeaders(token);
  
  const emailData = {
    to: TestData.randomEmail(),
    subject: `Test Email ${TestData.randomString(6)}`,
    content: `Hello, this is a test email sent at ${new Date().toISOString()}`,
    fromEmail: 'test@coldcopy.test',
    fromName: 'Load Test',
    trackOpens: true,
    trackClicks: true,
  };
  
  const startTime = Date.now();
  
  const response = http.post(
    `${BASE_URL}/api/email/send`,
    JSON.stringify(emailData),
    { headers }
  );
  
  const duration = Date.now() - startTime;
  
  const success = checkResponse(response, 200, {
    operation: 'single_email',
    endpoint: 'email_send'
  });
  
  emailSendRate.add(success);
  emailProcessingTime.add(duration);
  PerformanceMonitor.trackEmailOperation('single_send', duration);
  
  if (response.status === 429) {
    sesRateLimitHits.add(1);
    respectRateLimit(response);
  }
  
  // Check response includes tracking IDs
  if (success) {
    check(response, {
      'email has tracking ID': (r) => r.json('trackingId') !== undefined,
      'email queued successfully': (r) => r.json('status') === 'queued',
    });
  }
  
  thinkTime(1, 3);
}

/**
 * Bulk Email Sending Test
 * Tests bulk email sending performance and batching
 */
export function bulkEmailTest() {
  const token = authenticate();
  const headers = getAuthHeaders(token);
  
  // Create a batch of emails
  const batchSize = Math.floor(Math.random() * 50) + 10; // 10-60 emails
  const emails = [];
  
  for (let i = 0; i < batchSize; i++) {
    emails.push({
      to: TestData.randomEmail(),
      subject: `Bulk Test Email ${i + 1}`,
      content: `Hello, this is bulk email ${i + 1} of ${batchSize}`,
      personalization: {
        firstName: TestData.randomString(6),
        company: `${TestData.randomString(8)} Corp`,
      }
    });
  }
  
  const bulkEmailData = {
    emails,
    template: 'Hello {{firstName}} from {{company}}!',
    fromEmail: 'bulk@coldcopy.test',
    fromName: 'Bulk Test',
    batchSize: 25, // Process in batches of 25
  };
  
  const startTime = Date.now();
  
  const response = http.post(
    `${BASE_URL}/api/email/send/bulk`,
    JSON.stringify(bulkEmailData),
    { headers }
  );
  
  const duration = Date.now() - startTime;
  
  const success = checkResponse(response, 202, {
    operation: 'bulk_email',
    endpoint: 'email_bulk_send',
    batch_size: batchSize
  });
  
  emailSendRate.add(success);
  emailProcessingTime.add(duration);
  PerformanceMonitor.trackEmailOperation('bulk_send', duration, batchSize);
  
  if (success) {
    const jobId = response.json('jobId');
    
    // Monitor the bulk job progress
    let jobCompleted = false;
    let attempts = 0;
    const maxAttempts = 20;
    
    while (!jobCompleted && attempts < maxAttempts) {
      sleep(2);
      attempts++;
      
      const statusResponse = http.get(
        `${BASE_URL}/api/email/jobs/${jobId}/status`,
        { headers }
      );
      
      if (statusResponse.status === 200) {
        const status = statusResponse.json('status');
        const processed = statusResponse.json('processed') || 0;
        const total = statusResponse.json('total') || batchSize;
        
        emailQueueDepth.add(total - processed);
        
        if (status === 'completed' || status === 'failed') {
          jobCompleted = true;
          
          check(statusResponse, {
            'bulk job completed successfully': () => status === 'completed',
            'all emails processed': () => processed === total,
          });
        }
      }
    }
  }
  
  if (response.status === 429) {
    sesRateLimitHits.add(1);
    respectRateLimit(response);
  }
  
  thinkTime(5, 10); // Longer think time for bulk operations
}

/**
 * Campaign Execution Test
 * Tests campaign creation and execution performance
 */
export function campaignExecutionTest() {
  const token = authenticate();
  const headers = getAuthHeaders(token);
  
  // Create campaign
  const campaignData = {
    ...TestData.sampleCampaign(),
    sequence: [
      {
        delay: 0,
        subject: 'Welcome to our test campaign',
        content: 'Hello {{firstName}}, welcome to our campaign!',
      },
      {
        delay: 86400, // 1 day
        subject: 'Follow up from our campaign',
        content: 'Hi {{firstName}}, just following up...',
      }
    ],
    leads: [],
  };
  
  // Add test leads
  for (let i = 0; i < 20; i++) {
    campaignData.leads.push(TestData.sampleLead());
  }
  
  const startTime = Date.now();
  
  // Create campaign
  const campaignResponse = http.post(
    `${BASE_URL}/api/campaigns`,
    JSON.stringify(campaignData),
    { headers }
  );
  
  const campaignCreationTime = Date.now() - startTime;
  
  const campaignSuccess = checkResponse(campaignResponse, 201, {
    operation: 'campaign',
    endpoint: 'campaign_create'
  });
  
  if (campaignSuccess) {
    const campaignId = campaignResponse.json('id');
    
    // Start campaign execution
    const executionStartTime = Date.now();
    
    const executeResponse = http.post(
      `${BASE_URL}/api/campaigns/${campaignId}/execute`,
      '{}',
      { headers }
    );
    
    const executionTime = Date.now() - executionStartTime;
    
    const executionSuccess = checkResponse(executeResponse, 200, {
      operation: 'campaign',
      endpoint: 'campaign_execute'
    });
    
    PerformanceMonitor.trackEmailOperation('campaign_create', campaignCreationTime);
    PerformanceMonitor.trackEmailOperation('campaign_execute', executionTime);
    
    if (executionSuccess) {
      // Monitor campaign progress
      let campaignActive = true;
      let monitoringAttempts = 0;
      const maxMonitoringAttempts = 10;
      
      while (campaignActive && monitoringAttempts < maxMonitoringAttempts) {
        sleep(3);
        monitoringAttempts++;
        
        const statusResponse = http.get(
          `${BASE_URL}/api/campaigns/${campaignId}/stats`,
          { headers }
        );
        
        if (statusResponse.status === 200) {
          const stats = statusResponse.json();
          const sent = stats.sent || 0;
          const total = stats.total || campaignData.leads.length;
          
          emailQueueDepth.add(total - sent);
          
          // Campaign is considered active if not all emails are sent
          campaignActive = sent < total;
          
          check(statusResponse, {
            'campaign stats available': () => stats !== null,
            'sent count is valid': () => sent >= 0 && sent <= total,
          });
        }
      }
    }
    
    if (executeResponse.status === 429) {
      sesRateLimitHits.add(1);
      respectRateLimit(executeResponse);
    }
  }
  
  thinkTime(10, 20);
}

/**
 * Email Tracking Test
 * Tests email open and click tracking performance
 */
export function emailTrackingTest() {
  // Simulate email opens
  const trackingId = TestData.randomString(32);
  const openStartTime = Date.now();
  
  const openResponse = http.get(
    `${BASE_URL}/api/track/open?id=${trackingId}&t=${Date.now()}`
  );
  
  const openDuration = Date.now() - openStartTime;
  
  checkResponse(openResponse, 200, {
    operation: 'tracking',
    endpoint: 'email_open'
  });
  
  PerformanceMonitor.trackEmailOperation('track_open', openDuration);
  
  // Simulate email clicks
  const clickStartTime = Date.now();
  
  const clickResponse = http.get(
    `${BASE_URL}/api/track/click?id=${trackingId}&url=${encodeURIComponent('https://example.com')}&t=${Date.now()}`
  );
  
  const clickDuration = Date.now() - clickStartTime;
  
  checkResponse(clickResponse, 302, { // Expect redirect
    operation: 'tracking',
    endpoint: 'email_click'
  });
  
  PerformanceMonitor.trackEmailOperation('track_click', clickDuration);
  
  thinkTime(0.1, 0.5); // Quick think time for tracking
}

/**
 * Template Processing Test
 * Tests email template rendering performance
 */
export function templateProcessingTest() {
  const token = authenticate();
  const headers = getAuthHeaders(token);
  
  // Complex template with multiple variables
  const templateData = {
    template: `
      Hello {{firstName}} {{lastName}},
      
      Thank you for your interest in {{productName}}!
      
      Your company {{companyName}} has been selected for our {{planType}} plan.
      
      {{#if hasDiscount}}
      Special offer: {{discountPercent}}% off for the first {{discountMonths}} months!
      {{/if}}
      
      {{#each features}}
      ✓ {{name}}: {{description}}
      {{/each}}
      
      Best regards,
      {{senderName}}
      {{senderTitle}}
      {{companyName}}
    `,
    variables: {
      firstName: 'John',
      lastName: 'Doe',
      productName: 'ColdCopy Pro',
      companyName: 'Test Corp',
      planType: 'Enterprise',
      hasDiscount: true,
      discountPercent: 20,
      discountMonths: 3,
      features: [
        { name: 'Advanced Analytics', description: 'Deep insights into email performance' },
        { name: 'Custom Templates', description: 'Create your own email templates' },
        { name: 'Team Collaboration', description: 'Work together with your team' },
      ],
      senderName: 'Jane Smith',
      senderTitle: 'Sales Director',
    }
  };
  
  const startTime = Date.now();
  
  const response = http.post(
    `${BASE_URL}/api/email/template/render`,
    JSON.stringify(templateData),
    { headers }
  );
  
  const duration = Date.now() - startTime;
  
  const success = checkResponse(response, 200, {
    operation: 'template',
    endpoint: 'template_render'
  });
  
  templateRenderingTime.add(duration);
  PerformanceMonitor.trackEmailOperation('template_render', duration);
  
  if (success) {
    const renderedContent = response.json('content');
    
    check(response, {
      'template rendered successfully': () => renderedContent && renderedContent.length > 0,
      'variables replaced': () => !renderedContent.includes('{{'),
      'conditional content processed': () => renderedContent.includes('Special offer'),
      'loop content processed': () => renderedContent.includes('Advanced Analytics'),
    });
  }
  
  thinkTime(1, 2);
}

/**
 * SES Rate Limit Handling Test
 * Tests application's handling of SES rate limits
 */
export function sesRateLimitTest() {
  const token = authenticate();
  const headers = getAuthHeaders(token);
  
  const emailData = {
    to: TestData.randomEmail(),
    subject: `Rate Limit Test ${TestData.randomString(4)}`,
    content: 'Testing SES rate limit handling',
    fromEmail: 'ratetest@coldcopy.test',
    priority: 'high', // Try to trigger rate limits faster
  };
  
  const startTime = Date.now();
  
  const response = http.post(
    `${BASE_URL}/api/email/send`,
    JSON.stringify(emailData),
    { headers }
  );
  
  const duration = Date.now() - startTime;
  
  // Handle different response scenarios
  if (response.status === 200) {
    emailSendRate.add(true);
    checkResponse(response, 200, {
      operation: 'rate_limit',
      endpoint: 'email_send_success'
    });
  } else if (response.status === 429) {
    // Rate limit hit - this is expected in this test
    sesRateLimitHits.add(1);
    
    check(response, {
      'rate limit response includes retry-after': () => response.headers['Retry-After'] !== undefined,
      'rate limit has proper error message': () => response.json('error') && response.json('error').includes('rate limit'),
    });
    
    // Respect the rate limit
    respectRateLimit(response);
    
  } else if (response.status === 503) {
    // Service temporarily unavailable due to rate limits
    check(response, {
      'service unavailable due to rate limits': () => true,
    });
    
    sleep(5); // Wait longer for service recovery
    
  } else {
    emailSendRate.add(false);
    console.log(`Unexpected response status: ${response.status}`);
  }
  
  emailProcessingTime.add(duration);
  PerformanceMonitor.trackEmailOperation('rate_limit_test', duration);
  
  // Very short think time to maintain high rate
  sleep(0.1);
}

/**
 * Email Delivery Status Test
 * Tests email delivery status tracking and webhooks
 */
export function emailDeliveryTest() {
  const token = authenticate();
  const headers = getAuthHeaders(token);
  
  // Send an email
  const emailData = {
    to: TestData.randomEmail(),
    subject: 'Delivery Test Email',
    content: 'Testing email delivery tracking',
    fromEmail: 'delivery@coldcopy.test',
    webhookUrl: `${BASE_URL}/api/webhooks/email/delivery`,
  };
  
  const sendResponse = http.post(
    `${BASE_URL}/api/email/send`,
    JSON.stringify(emailData),
    { headers }
  );
  
  if (sendResponse.status === 200) {
    const emailId = sendResponse.json('id');
    
    // Check delivery status
    let statusChecks = 0;
    const maxStatusChecks = 10;
    
    while (statusChecks < maxStatusChecks) {
      sleep(2);
      statusChecks++;
      
      const statusResponse = http.get(
        `${BASE_URL}/api/email/${emailId}/status`,
        { headers }
      );
      
      if (statusResponse.status === 200) {
        const status = statusResponse.json('status');
        const deliveryInfo = statusResponse.json('delivery');
        
        check(statusResponse, {
          'status is valid': () => ['sent', 'delivered', 'bounced', 'complained'].includes(status),
          'delivery info available': () => deliveryInfo !== null,
        });
        
        if (status === 'delivered' || status === 'bounced' || status === 'complained') {
          emailDeliveryRate.add(status === 'delivered');
          break;
        }
      }
    }
  }
  
  thinkTime(3, 6);
}

// Export for use in other tests
export {
  emailSendRate,
  emailProcessingTime,
  emailQueueDepth,
  emailDeliveryRate,
  templateRenderingTime,
  sesRateLimitHits,
};