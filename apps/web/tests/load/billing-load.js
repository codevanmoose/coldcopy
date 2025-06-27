/**
 * Billing System Load Tests for ColdCopy
 * 
 * Tests the performance of billing operations including:
 * - Stripe webhook processing under load
 * - Subscription creation and updates
 * - Usage tracking performance
 * - Payment processing throughput
 * - Token purchases and credits
 * - Billing event handling
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
  PerformanceMonitor,
  getTestConfig,
  setup,
  teardown,
} from './k6-config.js';

// Billing-specific metrics
const billingProcessingTime = new Trend('billing_processing_duration');
const webhookProcessingTime = new Trend('webhook_processing_duration');
const subscriptionOperationTime = new Trend('subscription_operation_duration');
const paymentSuccessRate = new Rate('payment_success_rate');
const webhookSuccessRate = new Rate('webhook_success_rate');
const usageTrackingLatency = new Trend('usage_tracking_latency');
const billingErrorRate = new Rate('billing_error_rate');
const stripeApiLatency = new Trend('stripe_api_latency');
const concurrentBillingOps = new Counter('concurrent_billing_operations');
const tokenTransactionVolume = new Counter('token_transaction_volume');

// Test configuration
export let options = {
  ...getTestConfig('moderate'),
  scenarios: {
    // Stripe webhook load test
    stripe_webhook_load: {
      executor: 'constant-arrival-rate',
      rate: 20,
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 30,
      exec: 'stripeWebhookTest',
      tags: { test_type: 'webhooks' },
    },
    
    // Subscription management test
    subscription_management: {
      executor: 'ramping-vus',
      stages: LOAD_TEST_STAGES.moderate,
      exec: 'subscriptionManagementTest',
      tags: { test_type: 'subscriptions' },
    },
    
    // Usage tracking performance
    usage_tracking: {
      executor: 'constant-vus',
      vus: 25,
      duration: '8m',
      exec: 'usageTrackingTest',
      tags: { test_type: 'usage_tracking' },
    },
    
    // Payment processing test
    payment_processing: {
      executor: 'ramping-vus',
      stages: LOAD_TEST_STAGES.light,
      exec: 'paymentProcessingTest',
      tags: { test_type: 'payments' },
    },
    
    // Token purchase simulation
    token_purchases: {
      executor: 'constant-vus',
      vus: 10,
      duration: '10m',
      exec: 'tokenPurchaseTest',
      tags: { test_type: 'tokens' },
    },
    
    // Billing analytics test
    billing_analytics: {
      executor: 'constant-vus',
      vus: 15,
      duration: '6m',
      exec: 'billingAnalyticsTest',
      tags: { test_type: 'analytics' },
    }
  },
  
  thresholds: {
    ...PERFORMANCE_THRESHOLDS,
    billing_processing_duration: ['p(95)<5000'], // Billing ops under 5s
    webhook_processing_duration: ['p(95)<2000'], // Webhooks under 2s
    payment_success_rate: ['rate>0.95'], // 95% payment success
    webhook_success_rate: ['rate>0.98'], // 98% webhook success
    usage_tracking_latency: ['p(95)<500'], // Usage tracking under 500ms
    stripe_api_latency: ['p(95)<3000'], // Stripe API under 3s
  }
};

export { setup, teardown };

/**
 * Stripe Webhook Processing Test
 * Tests handling of high-volume Stripe webhook events
 */
export function stripeWebhookTest() {
  concurrentBillingOps.add(1);
  
  // Simulate different Stripe webhook events
  const webhookEvents = [
    {
      type: 'invoice.payment_succeeded',
      data: {
        object: {
          id: `in_${TestData.randomString(24)}`,
          customer: `cus_${TestData.randomString(14)}`,
          amount_paid: TestData.randomNumber(1000, 10000),
          currency: 'usd',
          subscription: `sub_${TestData.randomString(14)}`,
        }
      }
    },
    {
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: `sub_${TestData.randomString(14)}`,
          customer: `cus_${TestData.randomString(14)}`,
          status: 'active',
          current_period_end: Math.floor(Date.now() / 1000) + 2592000,
        }
      }
    },
    {
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: `pi_${TestData.randomString(24)}`,
          amount: TestData.randomNumber(500, 5000),
          currency: 'usd',
          customer: `cus_${TestData.randomString(14)}`,
        }
      }
    },
    {
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: `sub_${TestData.randomString(14)}`,
          customer: `cus_${TestData.randomString(14)}`,
          status: 'canceled',
        }
      }
    }
  ];
  
  const webhookEvent = webhookEvents[Math.floor(Math.random() * webhookEvents.length)];
  
  // Generate Stripe signature (simplified for testing)
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = JSON.stringify(webhookEvent);
  const signature = `t=${timestamp},v1=${TestData.randomString(64)}`;
  
  const startTime = Date.now();
  
  const response = http.post(
    `${BASE_URL}/api/webhooks/stripe`,
    payload,
    {
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': signature,
      },
      tags: { 
        webhook_type: webhookEvent.type,
        operation: 'webhook_processing'
      }
    }
  );
  
  const duration = Date.now() - startTime;
  
  webhookProcessingTime.add(duration, { event_type: webhookEvent.type });
  billingProcessingTime.add(duration, { operation: 'webhook' });
  PerformanceMonitor.trackApiOperation('stripe/webhook', duration, response.status);
  
  const success = checkResponse(response, 200, {
    operation: 'stripe_webhook',
    endpoint: 'billing',
    event_type: webhookEvent.type
  });
  
  webhookSuccessRate.add(success);
  
  if (success) {
    check(response, {
      'Webhook processed successfully': (r) => r.json('received') === true,
      'Event handled correctly': (r) => r.json('processed') === true,
      'Response time acceptable': (r) => r.timings.duration < 5000,
    });
  } else {
    billingErrorRate.add(1);
  }
  
  // Check for idempotency (webhooks might be retried)
  if (Math.random() < 0.1) { // 10% chance of retry
    sleep(1);
    
    const retryResponse = http.post(
      `${BASE_URL}/api/webhooks/stripe`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Stripe-Signature': signature,
          'Idempotency-Key': `retry_${TestData.randomString(16)}`,
        },
        tags: { webhook_type: webhookEvent.type, operation: 'webhook_retry' }
      }
    );
    
    check(retryResponse, {
      'Webhook retry handled': (r) => r.status === 200,
      'Idempotency respected': (r) => r.json('duplicate') === true || r.json('processed') === true,
    });
  }
  
  // No think time for webhook stress test
}

/**
 * Subscription Management Test
 * Tests subscription creation, updates, and cancellations
 */
export function subscriptionManagementTest() {
  const token = authenticate();
  const headers = getAuthHeaders(token);
  
  concurrentBillingOps.add(1);
  
  const subscriptionFlow = Math.random();
  
  if (subscriptionFlow < 0.4) {
    // Create new subscription
    testSubscriptionCreation(headers);
  } else if (subscriptionFlow < 0.7) {
    // Update existing subscription
    testSubscriptionUpdate(headers);
  } else if (subscriptionFlow < 0.9) {
    // Cancel subscription
    testSubscriptionCancellation(headers);
  } else {
    // Reactivate subscription
    testSubscriptionReactivation(headers);
  }
  
  thinkTime(3, 6);
}

/**
 * Usage Tracking Performance Test
 * Tests real-time usage tracking and metering
 */
export function usageTrackingTest() {
  const token = authenticate();
  const headers = getAuthHeaders(token);
  
  concurrentBillingOps.add(1);
  
  // Simulate various usage events
  const usageEvents = [
    { type: 'email_sent', quantity: 1, metadata: { campaign_id: TestData.randomString(10) } },
    { type: 'lead_enriched', quantity: 1, metadata: { provider: 'clearbit' } },
    { type: 'ai_generation', quantity: 1, metadata: { model: 'gpt-4', tokens: TestData.randomNumber(100, 1000) } },
    { type: 'data_export', quantity: 1, metadata: { records: TestData.randomNumber(100, 10000) } },
    { type: 'bulk_operation', quantity: TestData.randomNumber(10, 100), metadata: { operation: 'import' } },
  ];
  
  // Track multiple usage events rapidly
  for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) {
    const event = usageEvents[Math.floor(Math.random() * usageEvents.length)];
    
    const trackingStartTime = Date.now();
    
    const trackingResponse = http.post(
      `${BASE_URL}/api/billing/usage/track`,
      JSON.stringify({
        event_type: event.type,
        quantity: event.quantity,
        timestamp: new Date().toISOString(),
        metadata: event.metadata,
      }),
      {
        headers,
        tags: { usage_type: event.type, operation: 'usage_tracking' }
      }
    );
    
    const trackingDuration = Date.now() - trackingStartTime;
    
    usageTrackingLatency.add(trackingDuration, { event_type: event.type });
    billingProcessingTime.add(trackingDuration, { operation: 'usage_tracking' });
    
    const trackingSuccess = checkResponse(trackingResponse, 200, {
      operation: 'usage_tracking',
      endpoint: 'billing',
      event_type: event.type
    });
    
    if (trackingSuccess) {
      check(trackingResponse, {
        'Usage tracked successfully': (r) => r.json('tracked') === true,
        'Usage recorded with timestamp': (r) => r.json('timestamp') !== undefined,
        'Current usage returned': (r) => r.json('current_usage') !== undefined,
      });
      
      tokenTransactionVolume.add(event.quantity);
    } else {
      billingErrorRate.add(1);
    }
    
    // Brief pause between usage events
    sleep(0.1);
  }
  
  // Check current usage limits
  const limitsStartTime = Date.now();
  
  const limitsResponse = http.get(
    `${BASE_URL}/api/billing/usage/current`,
    {
      headers,
      tags: { operation: 'usage_limits_check' }
    }
  );
  
  const limitsDuration = Date.now() - limitsStartTime;
  
  usageTrackingLatency.add(limitsDuration, { operation: 'limits_check' });
  
  checkResponse(limitsResponse, 200, {
    operation: 'usage_limits',
    endpoint: 'billing'
  });
  
  thinkTime(2, 4);
}

/**
 * Payment Processing Test
 * Tests payment method management and processing
 */
export function paymentProcessingTest() {
  const token = authenticate();
  const headers = getAuthHeaders(token);
  
  concurrentBillingOps.add(1);
  
  // Test payment method operations
  const paymentOperations = [
    () => testPaymentMethodRetrieval(headers),
    () => testPaymentIntentCreation(headers),
    () => testPaymentConfirmation(headers),
    () => testRefundProcessing(headers),
  ];
  
  // Execute 1-2 payment operations
  const numOps = 1 + Math.floor(Math.random() * 2);
  for (let i = 0; i < numOps; i++) {
    const operation = paymentOperations[Math.floor(Math.random() * paymentOperations.length)];
    operation();
    sleep(1);
  }
  
  thinkTime(5, 10);
}

/**
 * Token Purchase Test
 * Tests token/credit purchase workflows
 */
export function tokenPurchaseTest() {
  const token = authenticate();
  const headers = getAuthHeaders(token);
  
  concurrentBillingOps.add(1);
  
  const tokenPackages = [
    { amount: 1000, price: 1000 }, // $10 for 1000 tokens
    { amount: 5000, price: 4500 }, // $45 for 5000 tokens
    { amount: 10000, price: 8000 }, // $80 for 10000 tokens
  ];
  
  const selectedPackage = tokenPackages[Math.floor(Math.random() * tokenPackages.length)];
  
  // Create token purchase intent
  const purchaseStartTime = Date.now();
  
  const purchaseIntentResponse = http.post(
    `${BASE_URL}/api/tokens/purchase`,
    JSON.stringify({
      token_amount: selectedPackage.amount,
      payment_method: 'pm_card_visa', // Test payment method
    }),
    {
      headers,
      tags: { 
        operation: 'token_purchase',
        package_size: selectedPackage.amount 
      }
    }
  );
  
  const purchaseDuration = Date.now() - purchaseStartTime;
  
  billingProcessingTime.add(purchaseDuration, { operation: 'token_purchase' });
  stripeApiLatency.add(purchaseDuration, { operation: 'payment_intent' });
  PerformanceMonitor.trackApiOperation('tokens/purchase', purchaseDuration, purchaseIntentResponse.status);
  
  const purchaseSuccess = checkResponse(purchaseIntentResponse, 200, {
    operation: 'token_purchase',
    endpoint: 'billing'
  });
  
  paymentSuccessRate.add(purchaseSuccess);
  
  if (purchaseSuccess) {
    const intentId = purchaseIntentResponse.json('payment_intent_id');
    
    check(purchaseIntentResponse, {
      'Payment intent created': () => intentId !== undefined,
      'Token amount correct': (r) => r.json('token_amount') === selectedPackage.amount,
      'Price calculated correctly': (r) => r.json('total_amount') === selectedPackage.price,
    });
    
    // Simulate payment confirmation
    sleep(2); // Simulate payment processing time
    
    const confirmStartTime = Date.now();
    
    const confirmResponse = http.post(
      `${BASE_URL}/api/tokens/confirm`,
      JSON.stringify({
        payment_intent_id: intentId,
        payment_method: 'pm_card_visa',
      }),
      {
        headers,
        tags: { operation: 'payment_confirmation' }
      }
    );
    
    const confirmDuration = Date.now() - confirmStartTime;
    
    billingProcessingTime.add(confirmDuration, { operation: 'payment_confirmation' });
    stripeApiLatency.add(confirmDuration, { operation: 'payment_confirm' });
    
    const confirmSuccess = checkResponse(confirmResponse, 200, {
      operation: 'payment_confirmation',
      endpoint: 'billing'
    });
    
    if (confirmSuccess) {
      check(confirmResponse, {
        'Payment confirmed': (r) => r.json('status') === 'succeeded',
        'Tokens credited': (r) => r.json('tokens_added') === selectedPackage.amount,
        'Transaction recorded': (r) => r.json('transaction_id') !== undefined,
      });
      
      tokenTransactionVolume.add(selectedPackage.amount);
    }
  } else {
    billingErrorRate.add(1);
  }
  
  thinkTime(8, 15);
}

/**
 * Billing Analytics Test
 * Tests billing reporting and analytics performance
 */
export function billingAnalyticsTest() {
  const token = authenticate();
  const headers = getAuthHeaders(token);
  
  concurrentBillingOps.add(1);
  
  const analyticsQueries = [
    {
      name: 'revenue_dashboard',
      url: '/api/billing/analytics/revenue?period=30d',
    },
    {
      name: 'usage_trends',
      url: '/api/billing/analytics/usage-trends?granularity=daily&period=90d',
    },
    {
      name: 'subscription_metrics',
      url: '/api/billing/analytics/subscriptions?include_churn=true',
    },
    {
      name: 'payment_analytics',
      url: '/api/billing/analytics/payments?status=all&period=quarter',
    },
    {
      name: 'token_usage_report',
      url: '/api/billing/analytics/token-usage?breakdown=by_feature&period=month',
    }
  ];
  
  // Execute 2-3 analytics queries
  const selectedQueries = analyticsQueries.sort(() => 0.5 - Math.random()).slice(0, 2 + Math.floor(Math.random() * 2));
  
  for (const query of selectedQueries) {
    const startTime = Date.now();
    
    const response = http.get(
      `${BASE_URL}${query.url}`,
      {
        headers,
        tags: { 
          operation: 'billing_analytics',
          query_type: query.name 
        }
      }
    );
    
    const duration = Date.now() - startTime;
    
    billingProcessingTime.add(duration, { operation: 'analytics', query_type: query.name });
    PerformanceMonitor.trackApiOperation(`billing/analytics/${query.name}`, duration, response.status);
    
    const success = checkResponse(response, 200, {
      operation: 'billing_analytics',
      endpoint: 'billing',
      query_type: query.name
    });
    
    if (success) {
      const data = response.json();
      
      check(response, {
        'Analytics data returned': () => data !== null,
        'Data structure valid': () => typeof data === 'object',
        'Performance acceptable': (r) => r.timings.duration < 10000,
      });
    }
    
    sleep(1); // Pause between queries
  }
  
  thinkTime(4, 8);
}

// Helper functions for subscription operations
function testSubscriptionCreation(headers) {
  const subscriptionData = {
    price_id: `price_${TestData.randomString(24)}`,
    payment_method: 'pm_card_visa',
    trial_period_days: Math.random() > 0.5 ? 14 : null,
  };
  
  const startTime = Date.now();
  
  const response = http.post(
    `${BASE_URL}/api/billing/subscription`,
    JSON.stringify(subscriptionData),
    {
      headers,
      tags: { operation: 'subscription_create' }
    }
  );
  
  const duration = Date.now() - startTime;
  
  subscriptionOperationTime.add(duration, { operation: 'create' });
  stripeApiLatency.add(duration, { operation: 'subscription_create' });
  
  checkResponse(response, 201, { operation: 'subscription_create' });
}

function testSubscriptionUpdate(headers) {
  const updateData = {
    price_id: `price_${TestData.randomString(24)}`,
    proration_behavior: 'always_invoice',
  };
  
  const startTime = Date.now();
  
  const response = http.put(
    `${BASE_URL}/api/billing/subscription`,
    JSON.stringify(updateData),
    {
      headers,
      tags: { operation: 'subscription_update' }
    }
  );
  
  const duration = Date.now() - startTime;
  
  subscriptionOperationTime.add(duration, { operation: 'update' });
  stripeApiLatency.add(duration, { operation: 'subscription_update' });
  
  checkResponse(response, 200, { operation: 'subscription_update' });
}

function testSubscriptionCancellation(headers) {
  const startTime = Date.now();
  
  const response = http.delete(
    `${BASE_URL}/api/billing/subscription?at_period_end=true`,
    null,
    {
      headers,
      tags: { operation: 'subscription_cancel' }
    }
  );
  
  const duration = Date.now() - startTime;
  
  subscriptionOperationTime.add(duration, { operation: 'cancel' });
  stripeApiLatency.add(duration, { operation: 'subscription_cancel' });
  
  checkResponse(response, 200, { operation: 'subscription_cancel' });
}

function testSubscriptionReactivation(headers) {
  const startTime = Date.now();
  
  const response = http.post(
    `${BASE_URL}/api/billing/subscription/reactivate`,
    '{}',
    {
      headers,
      tags: { operation: 'subscription_reactivate' }
    }
  );
  
  const duration = Date.now() - startTime;
  
  subscriptionOperationTime.add(duration, { operation: 'reactivate' });
  stripeApiLatency.add(duration, { operation: 'subscription_reactivate' });
  
  checkResponse(response, 200, { operation: 'subscription_reactivate' });
}

// Helper functions for payment operations
function testPaymentMethodRetrieval(headers) {
  const startTime = Date.now();
  
  const response = http.get(
    `${BASE_URL}/api/billing/payment-methods`,
    {
      headers,
      tags: { operation: 'payment_methods_list' }
    }
  );
  
  const duration = Date.now() - startTime;
  
  billingProcessingTime.add(duration, { operation: 'payment_methods' });
  
  checkResponse(response, 200, { operation: 'payment_methods' });
}

function testPaymentIntentCreation(headers) {
  const intentData = {
    amount: TestData.randomNumber(1000, 10000),
    currency: 'usd',
    automatic_payment_methods: { enabled: true },
  };
  
  const startTime = Date.now();
  
  const response = http.post(
    `${BASE_URL}/api/billing/payment-intent`,
    JSON.stringify(intentData),
    {
      headers,
      tags: { operation: 'payment_intent_create' }
    }
  );
  
  const duration = Date.now() - startTime;
  
  billingProcessingTime.add(duration, { operation: 'payment_intent' });
  stripeApiLatency.add(duration, { operation: 'payment_intent_create' });
  
  checkResponse(response, 200, { operation: 'payment_intent' });
}

function testPaymentConfirmation(headers) {
  const confirmData = {
    payment_intent_id: `pi_${TestData.randomString(24)}`,
    payment_method: 'pm_card_visa',
  };
  
  const startTime = Date.now();
  
  const response = http.post(
    `${BASE_URL}/api/billing/payment-intent/confirm`,
    JSON.stringify(confirmData),
    {
      headers,
      tags: { operation: 'payment_confirm' }
    }
  );
  
  const duration = Date.now() - startTime;
  
  billingProcessingTime.add(duration, { operation: 'payment_confirm' });
  stripeApiLatency.add(duration, { operation: 'payment_confirm' });
  
  checkResponse(response, 200, { operation: 'payment_confirm' });
}

function testRefundProcessing(headers) {
  const refundData = {
    payment_intent_id: `pi_${TestData.randomString(24)}`,
    amount: TestData.randomNumber(500, 5000),
    reason: 'requested_by_customer',
  };
  
  const startTime = Date.now();
  
  const response = http.post(
    `${BASE_URL}/api/billing/refund`,
    JSON.stringify(refundData),
    {
      headers,
      tags: { operation: 'refund_create' }
    }
  );
  
  const duration = Date.now() - startTime;
  
  billingProcessingTime.add(duration, { operation: 'refund' });
  stripeApiLatency.add(duration, { operation: 'refund_create' });
  
  checkResponse(response, 200, { operation: 'refund' });
}

// Export metrics for use in other tests
export {
  billingProcessingTime,
  webhookProcessingTime,
  subscriptionOperationTime,
  paymentSuccessRate,
  webhookSuccessRate,
  usageTrackingLatency,
  billingErrorRate,
  stripeApiLatency,
  concurrentBillingOps,
  tokenTransactionVolume,
};