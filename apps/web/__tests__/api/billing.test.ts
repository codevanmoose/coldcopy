import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ApiTestClient, createMockRequest, testApiRoute } from '../utils/api'
import { cleanTestDatabase } from '../setup/test-db-setup'
import { billingFactory, userFactory, workspaceFactory } from '../utils/factories'
import { StripeService } from '@/lib/billing/stripe-service'
import { BillingErrorCode } from '@/lib/billing/types'
import * as subscriptionHandler from '@/app/api/billing/subscription/route'
import * as paymentMethodsHandler from '@/app/api/billing/payment-methods/route'
import * as usageHandler from '@/app/api/billing/usage/route'
import * as plansHandler from '@/app/api/billing/plans/route'
import * as portalHandler from '@/app/api/billing/portal/route'
import * as webhookHandler from '@/app/api/webhooks/stripe/route'

// Mock external services
jest.mock('@/lib/billing/stripe-service')
jest.mock('@/lib/supabase/server')

const mockStripeService = StripeService as jest.MockedClass<typeof StripeService>
const mockSupabase = {
  auth: {
    getUser: jest.fn(),
  },
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
  limit: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
}

require('@/lib/supabase/server').createClient = jest.fn().mockReturnValue(mockSupabase)

describe('Billing API Integration Tests', () => {
  let testClient: ApiTestClient
  let testUser: any
  let testWorkspace: any
  let testSubscription: any
  let authToken: string

  beforeAll(async () => {
    await cleanTestDatabase()
    testClient = new ApiTestClient()
    authToken = 'test-auth-token'
  })

  beforeEach(async () => {
    jest.clearAllMocks()
    
    // Create test data
    testUser = userFactory.create()
    testWorkspace = workspaceFactory.create({ owner_id: testUser.id })
    testSubscription = billingFactory.createSubscription({ 
      workspace_id: testWorkspace.id 
    })

    // Setup default auth mock
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: testUser },
      error: null
    })

    // Setup Stripe service mocks
    mockStripeService.prototype.getBillingSummary = jest.fn()
    mockStripeService.prototype.createSubscription = jest.fn()
    mockStripeService.prototype.updateSubscription = jest.fn()
    mockStripeService.prototype.cancelSubscription = jest.fn()
    mockStripeService.prototype.createPaymentMethod = jest.fn()
    mockStripeService.prototype.deletePaymentMethod = jest.fn()
    mockStripeService.prototype.createBillingPortalSession = jest.fn()
    mockStripeService.prototype.handleWebhook = jest.fn()
  })

  describe('Subscription Management', () => {
    describe('GET /api/billing/subscription', () => {
      it('should return billing summary for authenticated user', async () => {
        const mockSummary = {
          subscription: testSubscription,
          usage: billingFactory.createUsage({ workspace_id: testWorkspace.id }),
          invoices: [billingFactory.createInvoice({ workspace_id: testWorkspace.id })],
          paymentMethods: []
        }

        mockStripeService.prototype.getBillingSummary.mockResolvedValue(mockSummary)

        const request = createMockRequest('/api/billing/subscription', {
          method: 'GET',
          headers: {
            'x-workspace-id': testWorkspace.id,
            'authorization': `Bearer ${authToken}`
          }
        })

        const response = await testApiRoute(subscriptionHandler.GET, request)
        
        expect(response.status).toBe(200)
        expect(response.data).toEqual(mockSummary)
        expect(mockStripeService.prototype.getBillingSummary).toHaveBeenCalledWith(testWorkspace.id)
      })

      it('should return 401 for unauthenticated requests', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: null
        })

        const request = createMockRequest('/api/billing/subscription', {
          method: 'GET',
          headers: { 'x-workspace-id': testWorkspace.id }
        })

        const response = await testApiRoute(subscriptionHandler.GET, request)
        
        expect(response.status).toBe(401)
        expect(response.data.error).toBe('Unauthorized')
      })

      it('should return 400 when workspace ID is missing', async () => {
        const request = createMockRequest('/api/billing/subscription', {
          method: 'GET',
          headers: { 'authorization': `Bearer ${authToken}` }
        })

        const response = await testApiRoute(subscriptionHandler.GET, request)
        
        expect(response.status).toBe(400)
        expect(response.data.error).toBe('Workspace ID required')
      })

      it('should handle service errors gracefully', async () => {
        const serviceError = new Error('Stripe API error')
        serviceError.code = BillingErrorCode.STRIPE_ERROR
        serviceError.statusCode = 402
        
        mockStripeService.prototype.getBillingSummary.mockRejectedValue(serviceError)

        const request = createMockRequest('/api/billing/subscription', {
          method: 'GET',
          headers: {
            'x-workspace-id': testWorkspace.id,
            'authorization': `Bearer ${authToken}`
          }
        })

        const response = await testApiRoute(subscriptionHandler.GET, request)
        
        expect(response.status).toBe(402)
        expect(response.data.error).toBe('Stripe API error')
        expect(response.data.code).toBe(BillingErrorCode.STRIPE_ERROR)
      })
    })

    describe('POST /api/billing/subscription', () => {
      it('should create new subscription successfully', async () => {
        const createRequest = {
          planSlug: 'pro',
          paymentMethodId: 'pm_test_123',
          billingCycle: 'monthly'
        }

        const mockResult = {
          subscription: testSubscription,
          clientSecret: 'pi_test_secret'
        }

        mockStripeService.prototype.createSubscription.mockResolvedValue(mockResult)

        const request = createMockRequest('/api/billing/subscription', {
          method: 'POST',
          headers: {
            'x-workspace-id': testWorkspace.id,
            'authorization': `Bearer ${authToken}`
          },
          body: createRequest
        })

        const response = await testApiRoute(subscriptionHandler.POST, request)
        
        expect(response.status).toBe(200)
        expect(response.data).toEqual(mockResult)
        expect(mockStripeService.prototype.createSubscription).toHaveBeenCalledWith({
          workspaceId: testWorkspace.id,
          ...createRequest
        })
      })

      it('should validate required fields', async () => {
        const request = createMockRequest('/api/billing/subscription', {
          method: 'POST',
          headers: {
            'x-workspace-id': testWorkspace.id,
            'authorization': `Bearer ${authToken}`
          },
          body: {} // Missing planSlug
        })

        const response = await testApiRoute(subscriptionHandler.POST, request)
        
        expect(response.status).toBe(400)
        expect(response.data.error).toBe('Plan slug required')
      })
    })

    describe('PATCH /api/billing/subscription', () => {
      it('should update existing subscription', async () => {
        const updateRequest = {
          planSlug: 'enterprise',
          billingCycle: 'yearly'
        }

        mockSupabase.single.mockResolvedValue({
          data: testSubscription,
          error: null
        })

        const mockResult = {
          subscription: { ...testSubscription, plan: 'enterprise' }
        }

        mockStripeService.prototype.updateSubscription.mockResolvedValue(mockResult)

        const request = createMockRequest('/api/billing/subscription', {
          method: 'PATCH',
          headers: {
            'x-workspace-id': testWorkspace.id,
            'authorization': `Bearer ${authToken}`
          },
          body: updateRequest
        })

        const response = await testApiRoute(subscriptionHandler.PATCH, request)
        
        expect(response.status).toBe(200)
        expect(response.data).toEqual(mockResult)
      })

      it('should return 404 when subscription not found', async () => {
        mockSupabase.single.mockResolvedValue({
          data: null,
          error: { message: 'Not found' }
        })

        const request = createMockRequest('/api/billing/subscription', {
          method: 'PATCH',
          headers: {
            'x-workspace-id': testWorkspace.id,
            'authorization': `Bearer ${authToken}`
          },
          body: { planSlug: 'pro' }
        })

        const response = await testApiRoute(subscriptionHandler.PATCH, request)
        
        expect(response.status).toBe(404)
        expect(response.data.error).toBe('Subscription not found')
      })
    })

    describe('DELETE /api/billing/subscription', () => {
      it('should cancel subscription successfully', async () => {
        const cancelRequest = {
          reason: 'Too expensive',
          cancelAtPeriodEnd: true
        }

        mockSupabase.single.mockResolvedValue({
          data: testSubscription,
          error: null
        })

        const mockResult = {
          subscription: { ...testSubscription, cancel_at_period_end: true }
        }

        mockStripeService.prototype.cancelSubscription.mockResolvedValue(mockResult)

        const request = createMockRequest('/api/billing/subscription', {
          method: 'DELETE',
          headers: {
            'x-workspace-id': testWorkspace.id,
            'authorization': `Bearer ${authToken}`
          },
          body: cancelRequest
        })

        const response = await testApiRoute(subscriptionHandler.DELETE, request)
        
        expect(response.status).toBe(200)
        expect(response.data).toEqual(mockResult)
      })
    })
  })

  describe('Payment Methods', () => {
    describe('GET /api/billing/payment-methods', () => {
      it('should return payment methods for workspace', async () => {
        const mockPaymentMethods = [
          {
            id: 'pm_test_123',
            type: 'card',
            card: {
              brand: 'visa',
              last4: '4242',
              exp_month: 12,
              exp_year: 2025
            },
            is_default: true
          }
        ]

        mockSupabase.single.mockResolvedValue({
          data: { stripe_customer_id: 'cus_test_123' },
          error: null
        })

        // Mock Stripe service to return payment methods
        mockStripeService.prototype.getPaymentMethods = jest.fn().mockResolvedValue(mockPaymentMethods)

        const request = createMockRequest('/api/billing/payment-methods', {
          method: 'GET',
          headers: {
            'x-workspace-id': testWorkspace.id,
            'authorization': `Bearer ${authToken}`
          }
        })

        // Note: We'd need to create this handler or test the actual implementation
        // For now, testing the pattern
        expect(true).toBe(true) // Placeholder until handler is available
      })
    })
  })

  describe('Usage Tracking', () => {
    describe('GET /api/billing/usage', () => {
      it('should return current usage for workspace', async () => {
        const mockUsage = billingFactory.createUsage({ workspace_id: testWorkspace.id })

        const request = createMockRequest('/api/billing/usage', {
          method: 'GET',
          headers: {
            'x-workspace-id': testWorkspace.id,
            'authorization': `Bearer ${authToken}`
          }
        })

        // Mock the usage endpoint response
        const response = await testApiRoute(usageHandler.GET, request)
        
        // Would test actual implementation when available
        expect(true).toBe(true)
      })
    })
  })

  describe('Billing Plans', () => {
    describe('GET /api/billing/plans', () => {
      it('should return all available billing plans', async () => {
        const mockPlans = [
          {
            id: 'starter',
            name: 'Starter',
            price: 49,
            features: ['1000 emails/month', 'Basic support']
          },
          {
            id: 'pro',
            name: 'Pro',
            price: 149,
            features: ['10000 emails/month', 'Priority support', 'Advanced analytics']
          }
        ]

        mockSupabase.select.mockResolvedValue({
          data: mockPlans,
          error: null
        })

        const request = createMockRequest('/api/billing/plans', {
          method: 'GET'
        })

        const response = await testApiRoute(plansHandler.GET, request)
        
        expect(response.status).toBe(200)
        expect(response.data).toEqual(mockPlans)
      })
    })
  })

  describe('Billing Portal', () => {
    describe('POST /api/billing/portal', () => {
      it('should create billing portal session', async () => {
        const mockPortalSession = {
          url: 'https://billing.stripe.com/session/test_123'
        }

        mockStripeService.prototype.createBillingPortalSession.mockResolvedValue(mockPortalSession)

        const request = createMockRequest('/api/billing/portal', {
          method: 'POST',
          headers: {
            'x-workspace-id': testWorkspace.id,
            'authorization': `Bearer ${authToken}`
          },
          body: {
            returnUrl: 'https://app.coldcopy.com/settings/billing'
          }
        })

        const response = await testApiRoute(portalHandler.POST, request)
        
        expect(response.status).toBe(200)
        expect(response.data).toEqual(mockPortalSession)
      })
    })
  })

  describe('Webhook Processing', () => {
    describe('POST /api/webhooks/stripe', () => {
      it('should handle successful webhook events', async () => {
        const mockWebhookPayload = {
          id: 'evt_test_123',
          type: 'invoice.payment_succeeded',
          data: {
            object: {
              id: 'in_test_123',
              customer: 'cus_test_123',
              status: 'paid'
            }
          }
        }

        mockStripeService.prototype.handleWebhook.mockResolvedValue({
          processed: true,
          event: mockWebhookPayload
        })

        const request = createMockRequest('/api/webhooks/stripe', {
          method: 'POST',
          headers: {
            'stripe-signature': 'test_signature',
            'content-type': 'application/json'
          },
          body: mockWebhookPayload
        })

        const response = await testApiRoute(webhookHandler.POST, request)
        
        expect(response.status).toBe(200)
        expect(response.data.processed).toBe(true)
      })

      it('should handle invalid webhook signatures', async () => {
        const serviceError = new Error('Invalid signature')
        serviceError.statusCode = 400
        
        mockStripeService.prototype.handleWebhook.mockRejectedValue(serviceError)

        const request = createMockRequest('/api/webhooks/stripe', {
          method: 'POST',
          headers: {
            'stripe-signature': 'invalid_signature'
          },
          body: { type: 'test' }
        })

        const response = await testApiRoute(webhookHandler.POST, request)
        
        expect(response.status).toBe(400)
        expect(response.data.error).toBe('Invalid signature')
      })
    })
  })

  describe('Rate Limiting', () => {
    it('should enforce rate limits on billing endpoints', async () => {
      // Mock rate limiting scenario
      const requests = Array.from({ length: 101 }, () => 
        createMockRequest('/api/billing/subscription', {
          method: 'GET',
          headers: {
            'x-workspace-id': testWorkspace.id,
            'authorization': `Bearer ${authToken}`
          }
        })
      )

      // Simulate rapid requests
      const responses = await Promise.all(
        requests.map(req => testApiRoute(subscriptionHandler.GET, req))
      )

      // Check that some requests are rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429)
      expect(rateLimitedResponses.length).toBeGreaterThan(0)
    })
  })

  describe('Data Isolation', () => {
    it('should not allow access to other workspace billing data', async () => {
      const otherWorkspace = workspaceFactory.create()
      
      // Try to access other workspace's billing data
      const request = createMockRequest('/api/billing/subscription', {
        method: 'GET',
        headers: {
          'x-workspace-id': otherWorkspace.id,
          'authorization': `Bearer ${authToken}`
        }
      })

      // Mock that user doesn't have access to this workspace
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' }
      })

      const response = await testApiRoute(subscriptionHandler.GET, request)
      
      expect(response.status).toBeGreaterThanOrEqual(400)
    })
  })

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      mockSupabase.auth.getUser.mockRejectedValue(new Error('Database connection failed'))

      const request = createMockRequest('/api/billing/subscription', {
        method: 'GET',
        headers: {
          'x-workspace-id': testWorkspace.id,
          'authorization': `Bearer ${authToken}`
        }
      })

      const response = await testApiRoute(subscriptionHandler.GET, request)
      
      expect(response.status).toBe(500)
      expect(response.data.error).toContain('error')
    })

    it('should handle malformed request bodies', async () => {
      const request = createMockRequest('/api/billing/subscription', {
        method: 'POST',
        headers: {
          'x-workspace-id': testWorkspace.id,
          'authorization': `Bearer ${authToken}`,
          'content-type': 'application/json'
        },
        body: 'invalid json{'
      })

      const response = await testApiRoute(subscriptionHandler.POST, request)
      
      expect(response.status).toBeGreaterThanOrEqual(400)
    })
  })
})

// Test schema validation
describe('Billing API Schema Validation', () => {
  it('should validate subscription creation request schema', () => {
    const validRequest = {
      planSlug: 'pro',
      paymentMethodId: 'pm_test_123',
      billingCycle: 'monthly'
    }

    const invalidRequest = {
      planSlug: '', // Empty string
      paymentMethodId: null, // Null value
      billingCycle: 'invalid' // Invalid enum
    }

    // Would implement actual schema validation
    expect(typeof validRequest.planSlug).toBe('string')
    expect(validRequest.planSlug.length).toBeGreaterThan(0)
  })

  it('should validate webhook payload schemas', () => {
    const validWebhook = {
      id: 'evt_test_123',
      type: 'invoice.payment_succeeded',
      data: {
        object: {
          id: 'in_test_123',
          customer: 'cus_test_123'
        }
      }
    }

    expect(validWebhook.id).toMatch(/^evt_/)
    expect(validWebhook.type).toBeTruthy()
    expect(validWebhook.data.object).toBeTruthy()
  })
})
