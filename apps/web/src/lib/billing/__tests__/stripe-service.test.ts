import { StripeBillingService } from '../stripe-service'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

// Mock dependencies
jest.mock('stripe')
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}))
jest.mock('@/lib/stripe/client', () => ({
  stripe: {},
}))

describe('StripeBillingService', () => {
  let service: StripeBillingService
  let mockStripe: jest.Mocked<Stripe>
  let mockSupabase: any

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()

    // Mock Stripe
    mockStripe = {
      customers: {
        create: jest.fn(),
        update: jest.fn(),
        retrieve: jest.fn(),
      },
      subscriptions: {
        create: jest.fn(),
        update: jest.fn(),
        cancel: jest.fn(),
        retrieve: jest.fn(),
      },
      prices: {
        create: jest.fn(),
        list: jest.fn(),
      },
      products: {
        create: jest.fn(),
      },
      paymentMethods: {
        attach: jest.fn(),
        detach: jest.fn(),
        update: jest.fn(),
      },
      subscriptionItems: {
        create: jest.fn(),
        createUsageRecord: jest.fn(),
      },
      invoices: {
        sendInvoice: jest.fn(),
        retrieve: jest.fn(),
      },
      creditNotes: {
        create: jest.fn(),
      },
      billingPortal: {
        sessions: {
          create: jest.fn(),
        },
      },
      webhooks: {
        constructEvent: jest.fn(),
      },
    } as any

    // Mock Supabase
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      rpc: jest.fn(),
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }),
      },
    };

    (createClient as jest.Mock).mockReturnValue(mockSupabase)

    // Create service instance
    service = new StripeBillingService()
    ;(service as any).stripe = mockStripe
  })

  describe('Subscription Management', () => {
    describe('createSubscription', () => {
      it('should create a subscription successfully', async () => {
        // Arrange
        const planData = {
          id: 'plan-123',
          name: 'Pro Plan',
          slug: 'pro',
          price_monthly: 49,
          price_yearly: 490,
          currency: 'USD',
          stripe_product_id: 'prod-123',
        }

        const stripeSubscription = {
          id: 'sub-123',
          status: 'active',
          current_period_start: 1234567890,
          current_period_end: 1234567890,
          trial_start: null,
          trial_end: null,
          latest_invoice: {
            payment_intent: {
              client_secret: 'pi_secret_123',
            },
          },
        }

        mockSupabase.single.mockResolvedValueOnce({ data: planData, error: null })
        mockSupabase.single.mockResolvedValueOnce({ data: null, error: null })
        mockSupabase.single.mockResolvedValueOnce({ 
          data: { name: 'Test Workspace', workspace_users: [{ user: { email: 'test@example.com' } }] }, 
          error: null 
        })
        mockSupabase.single.mockResolvedValueOnce({
          data: {
            id: 'sub-db-123',
            workspace_id: 'workspace-123',
            plan_id: 'plan-123',
            stripe_subscription_id: 'sub-123',
            status: 'active',
          },
          error: null,
        })

        mockStripe.customers.create.mockResolvedValue({ id: 'cus-123' } as any)
        mockStripe.prices.list.mockResolvedValue({ data: [] } as any)
        mockStripe.prices.create.mockResolvedValue({ id: 'price-123' } as any)
        mockStripe.paymentMethods.attach.mockResolvedValue({} as any)
        mockStripe.customers.update.mockResolvedValue({} as any)
        mockStripe.subscriptions.create.mockResolvedValue(stripeSubscription as any)

        // Act
        const result = await service.createSubscription({
          workspaceId: 'workspace-123',
          planSlug: 'pro',
          paymentMethodId: 'pm-123',
          trialDays: 14,
          isYearly: false,
        })

        // Assert
        expect(result.subscription).toBeDefined()
        expect(result.subscription.id).toBe('sub-db-123')
        expect(result.clientSecret).toBe('pi_secret_123')
        expect(mockStripe.subscriptions.create).toHaveBeenCalledWith(
          expect.objectContaining({
            customer: 'cus-123',
            items: [{ price: 'price-123' }],
            trial_period_days: 14,
            payment_behavior: 'default_incomplete',
            metadata: {
              workspaceId: 'workspace-123',
              planId: 'plan-123',
            },
          })
        )
      })

      it('should handle plan not found error', async () => {
        // Arrange
        mockSupabase.single.mockResolvedValue({ data: null, error: { message: 'Not found' } })

        // Act & Assert
        await expect(
          service.createSubscription({
            workspaceId: 'workspace-123',
            planSlug: 'invalid-plan',
          })
        ).rejects.toThrow('Plan not found')
      })

      it('should rollback Stripe subscription on database error', async () => {
        // Arrange
        const planData = { id: 'plan-123', slug: 'pro' }
        const stripeSubscription = { id: 'sub-123', status: 'active' }

        mockSupabase.single.mockResolvedValueOnce({ data: planData, error: null })
        mockSupabase.single.mockResolvedValueOnce({ data: null, error: null })
        mockSupabase.single.mockResolvedValueOnce({ 
          data: { name: 'Test', workspace_users: [{ user: { email: 'test@example.com' } }] }, 
          error: null 
        })
        mockSupabase.single.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } })

        mockStripe.customers.create.mockResolvedValue({ id: 'cus-123' } as any)
        mockStripe.prices.list.mockResolvedValue({ data: [] } as any)
        mockStripe.prices.create.mockResolvedValue({ id: 'price-123' } as any)
        mockStripe.subscriptions.create.mockResolvedValue(stripeSubscription as any)
        mockStripe.subscriptions.cancel.mockResolvedValue({} as any)

        // Act & Assert
        await expect(
          service.createSubscription({
            workspaceId: 'workspace-123',
            planSlug: 'pro',
          })
        ).rejects.toThrow('Failed to save subscription')

        expect(mockStripe.subscriptions.cancel).toHaveBeenCalledWith('sub-123')
      })
    })

    describe('updateSubscription', () => {
      it('should update subscription successfully', async () => {
        // Arrange
        const currentSub = {
          id: 'sub-123',
          stripe_subscription_id: 'stripe-sub-123',
          subscription_plans: { id: 'old-plan' },
        }
        const newPlan = { id: 'new-plan', slug: 'enterprise' }
        const stripeSubscription = {
          id: 'stripe-sub-123',
          status: 'active',
          current_period_start: 1234567890,
          current_period_end: 1234567890,
          items: { data: [{ id: 'si-123' }] },
        }

        mockSupabase.single.mockResolvedValueOnce({ data: currentSub, error: null })
        mockSupabase.single.mockResolvedValueOnce({ data: newPlan, error: null })
        mockSupabase.single.mockResolvedValueOnce({ data: { id: 'sub-123', plan_id: 'new-plan' }, error: null })

        mockStripe.prices.list.mockResolvedValue({ data: [] } as any)
        mockStripe.prices.create.mockResolvedValue({ id: 'price-new' } as any)
        mockStripe.subscriptions.retrieve.mockResolvedValue(stripeSubscription as any)
        mockStripe.subscriptions.update.mockResolvedValue({
          ...stripeSubscription,
          status: 'active',
        } as any)

        // Act
        const result = await service.updateSubscription({
          subscriptionId: 'sub-123',
          planSlug: 'enterprise',
          prorationBehavior: 'create_prorations',
        })

        // Assert
        expect(result.planId).toBe('new-plan')
        expect(mockStripe.subscriptions.update).toHaveBeenCalledWith(
          'stripe-sub-123',
          expect.objectContaining({
            items: [{ id: 'si-123', price: 'price-new' }],
            proration_behavior: 'create_prorations',
            metadata: { planId: 'new-plan' },
          })
        )
      })

      it('should handle proration calculations', async () => {
        // Arrange
        const currentSub = {
          id: 'sub-123',
          stripe_subscription_id: 'stripe-sub-123',
          subscription_plans: { id: 'old-plan', price_monthly: 29 },
        }
        const newPlan = { id: 'new-plan', slug: 'pro', price_monthly: 49 }

        mockSupabase.single.mockResolvedValueOnce({ data: currentSub, error: null })
        mockSupabase.single.mockResolvedValueOnce({ data: newPlan, error: null })
        mockSupabase.single.mockResolvedValueOnce({ data: {}, error: null })

        mockStripe.prices.list.mockResolvedValue({ data: [] } as any)
        mockStripe.prices.create.mockResolvedValue({ id: 'price-new' } as any)
        mockStripe.subscriptions.retrieve.mockResolvedValue({ items: { data: [{ id: 'si-123' }] } } as any)
        mockStripe.subscriptions.update.mockResolvedValue({ status: 'active' } as any)

        // Act
        await service.updateSubscription({
          subscriptionId: 'sub-123',
          planSlug: 'pro',
          prorationBehavior: 'always_invoice',
        })

        // Assert
        expect(mockStripe.subscriptions.update).toHaveBeenCalledWith(
          'stripe-sub-123',
          expect.objectContaining({
            proration_behavior: 'always_invoice',
          })
        )
      })
    })

    describe('cancelSubscription', () => {
      it('should cancel subscription at period end', async () => {
        // Arrange
        const subscription = {
          id: 'sub-123',
          stripe_subscription_id: 'stripe-sub-123',
        }

        mockSupabase.single.mockResolvedValueOnce({ data: subscription, error: null })
        mockSupabase.single.mockResolvedValueOnce({ data: { status: 'active' }, error: null })

        mockStripe.subscriptions.update.mockResolvedValue({
          status: 'active',
          cancel_at_period_end: true,
        } as any)

        // Act
        const result = await service.cancelSubscription({
          subscriptionId: 'sub-123',
          cancelAtPeriodEnd: true,
          reason: 'Too expensive',
        })

        // Assert
        expect(result.status).toBe('active')
        expect(mockStripe.subscriptions.update).toHaveBeenCalledWith(
          'stripe-sub-123',
          {
            cancel_at_period_end: true,
            cancellation_details: { comment: 'Too expensive' },
          }
        )
      })

      it('should cancel subscription immediately', async () => {
        // Arrange
        const subscription = {
          id: 'sub-123',
          stripe_subscription_id: 'stripe-sub-123',
        }

        mockSupabase.single.mockResolvedValueOnce({ data: subscription, error: null })
        mockSupabase.single.mockResolvedValueOnce({ data: { status: 'canceled' }, error: null })

        mockStripe.subscriptions.update.mockResolvedValue({
          status: 'canceled',
          cancel_at_period_end: false,
        } as any)

        // Act
        const result = await service.cancelSubscription({
          subscriptionId: 'sub-123',
          cancelAtPeriodEnd: false,
        })

        // Assert
        expect(result.status).toBe('canceled')
        expect(mockSupabase.update).toHaveBeenCalledWith(
          expect.objectContaining({
            canceled_at: expect.any(Date),
          })
        )
      })
    })
  })

  describe('Payment Methods', () => {
    describe('addPaymentMethod', () => {
      it('should add payment method successfully', async () => {
        // Arrange
        const stripePaymentMethod = {
          id: 'pm-123',
          type: 'card',
          card: {
            last4: '4242',
            brand: 'visa',
            exp_month: 12,
            exp_year: 2025,
          },
          billing_details: { name: 'John Doe' },
        }

        mockSupabase.single.mockResolvedValueOnce({ data: null, error: null })
        mockSupabase.single.mockResolvedValueOnce({ 
          data: { name: 'Test', workspace_users: [{ user: { email: 'test@example.com' } }] }, 
          error: null 
        })
        mockSupabase.single.mockResolvedValueOnce({
          data: {
            id: 'pm-db-123',
            workspace_id: 'workspace-123',
            stripe_payment_method_id: 'pm-123',
            type: 'card',
            last4: '4242',
            brand: 'visa',
            is_default: true,
          },
          error: null,
        })

        mockStripe.customers.create.mockResolvedValue({ id: 'cus-123' } as any)
        mockStripe.paymentMethods.attach.mockResolvedValue(stripePaymentMethod as any)
        mockStripe.customers.update.mockResolvedValue({} as any)

        // Act
        const result = await service.addPaymentMethod({
          workspaceId: 'workspace-123',
          paymentMethodId: 'pm-123',
          setAsDefault: true,
        })

        // Assert
        expect(result.id).toBe('pm-db-123')
        expect(result.last4).toBe('4242')
        expect(result.isDefault).toBe(true)
        expect(mockStripe.paymentMethods.attach).toHaveBeenCalledWith('pm-123', {
          customer: 'cus-123',
        })
        expect(mockStripe.customers.update).toHaveBeenCalledWith('cus-123', {
          invoice_settings: { default_payment_method: 'pm-123' },
        })
      })

      it('should update existing default payment methods', async () => {
        // Arrange
        mockSupabase.single.mockResolvedValueOnce({ data: { stripe_customer_id: 'cus-123' }, error: null })
        mockSupabase.single.mockResolvedValueOnce({ data: {}, error: null })

        mockStripe.paymentMethods.attach.mockResolvedValue({
          id: 'pm-123',
          type: 'card',
          card: { last4: '4242' },
        } as any)

        // Act
        await service.addPaymentMethod({
          workspaceId: 'workspace-123',
          paymentMethodId: 'pm-123',
          setAsDefault: true,
        })

        // Assert
        expect(mockSupabase.update).toHaveBeenCalledWith({ is_default: false })
      })
    })

    describe('deletePaymentMethod', () => {
      it('should delete payment method successfully', async () => {
        // Arrange
        const paymentMethod = {
          id: 'pm-db-123',
          stripe_payment_method_id: 'pm-123',
        }

        mockSupabase.single.mockResolvedValue({ data: paymentMethod, error: null })
        mockStripe.paymentMethods.detach.mockResolvedValue({} as any)

        // Act
        await service.deletePaymentMethod('pm-db-123')

        // Assert
        expect(mockStripe.paymentMethods.detach).toHaveBeenCalledWith('pm-123')
        expect(mockSupabase.delete).toHaveBeenCalled()
      })

      it('should handle payment method not found', async () => {
        // Arrange
        mockSupabase.single.mockResolvedValue({ data: null, error: { message: 'Not found' } })

        // Act & Assert
        await expect(service.deletePaymentMethod('invalid-id')).rejects.toThrow(
          'Payment method not found'
        )
      })
    })
  })

  describe('Usage Tracking', () => {
    describe('reportUsage', () => {
      it('should report usage for metered billing', async () => {
        // Arrange
        const subscription = {
          id: 'sub-123',
          stripe_subscription_id: 'stripe-sub-123',
          subscription_plans: {
            id: 'plan-123',
            slug: 'enterprise',
            has_usage_pricing: true,
          },
          current_period_start: new Date('2024-01-01'),
          current_period_end: new Date('2024-02-01'),
        }

        const usageRecord = {
          id: 'usage-123',
          workspace_id: 'workspace-123',
          subscription_id: 'sub-123',
          metric_name: 'emails_sent',
          quantity: 1000,
          stripe_usage_record_id: 'stripe-usage-123',
        }

        mockSupabase.single.mockResolvedValueOnce({ data: subscription, error: null })
        mockSupabase.single.mockResolvedValueOnce({ data: usageRecord, error: null })

        mockStripe.subscriptions.retrieve.mockResolvedValue({
          items: { data: [] },
        } as any)
        mockStripe.products.create.mockResolvedValue({ id: 'prod-usage' } as any)
        mockStripe.prices.create.mockResolvedValue({ id: 'price-usage' } as any)
        mockStripe.subscriptionItems.create.mockResolvedValue({ id: 'si-usage' } as any)
        mockStripe.subscriptionItems.createUsageRecord.mockResolvedValue({
          id: 'stripe-usage-123',
        } as any)

        // Act
        const result = await service.reportUsage({
          workspaceId: 'workspace-123',
          metricName: 'emails_sent',
          quantity: 1000,
          idempotencyKey: 'idem-123',
        })

        // Assert
        expect(result.quantity).toBe(1000)
        expect(result.stripeUsageRecordId).toBe('stripe-usage-123')
        expect(mockStripe.subscriptionItems.createUsageRecord).toHaveBeenCalledWith(
          'si-usage',
          {
            quantity: 1000,
            timestamp: expect.any(Number),
            action: 'increment',
          },
          { idempotencyKey: 'idem-123' }
        )
      })

      it('should track usage without Stripe for non-metered plans', async () => {
        // Arrange
        const subscription = {
          id: 'sub-123',
          subscription_plans: {
            id: 'plan-123',
            slug: 'starter',
            has_usage_pricing: false,
          },
          current_period_start: new Date('2024-01-01'),
          current_period_end: new Date('2024-02-01'),
        }

        mockSupabase.single.mockResolvedValueOnce({ data: subscription, error: null })
        mockSupabase.single.mockResolvedValueOnce({
          data: {
            id: 'usage-123',
            quantity: 100,
            unit_price: 0,
          },
          error: null,
        })

        // Act
        const result = await service.reportUsage({
          workspaceId: 'workspace-123',
          metricName: 'emails_sent',
          quantity: 100,
        })

        // Assert
        expect(result.quantity).toBe(100)
        expect(result.unitPrice).toBe(0)
        expect(mockStripe.subscriptionItems.createUsageRecord).not.toHaveBeenCalled()
      })

      it('should check usage limits and send alerts', async () => {
        // Arrange
        const subscription = {
          id: 'sub-123',
          subscription_plans: {
            id: 'plan-123',
            limits: { emails_sent: 1000 },
          },
          current_period_start: new Date('2024-01-01'),
          current_period_end: new Date('2024-02-01'),
        }

        const usageRecords = [
          { metric_name: 'emails_sent', quantity: 900, total_amount: 0 },
        ]

        mockSupabase.single.mockResolvedValueOnce({ data: subscription, error: null })
        mockSupabase.single.mockResolvedValueOnce({ data: {}, error: null })
        mockSupabase.single.mockResolvedValueOnce({ data: subscription, error: null })
        mockSupabase.order.mockResolvedValueOnce({ data: usageRecords, error: null })

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

        // Act
        await service.reportUsage({
          workspaceId: 'workspace-123',
          metricName: 'emails_sent',
          quantity: 100,
        })

        // Assert
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Usage alert: emails_sent at 90.0%')
        )

        consoleSpy.mockRestore()
      })
    })

    describe('getUsageSummary', () => {
      it('should return usage summary for current period', async () => {
        // Arrange
        const subscription = {
          id: 'sub-123',
          current_period_start: '2024-01-01',
          current_period_end: '2024-02-01',
          subscription_plans: {
            limits: {
              emails_sent: 10000,
              leads_enriched: 1000,
              ai_tokens: 100000,
            },
          },
        }

        const usageRecords = [
          { metric_name: 'emails_sent', quantity: 5000, total_amount: 5 },
          { metric_name: 'emails_sent', quantity: 2000, total_amount: 2 },
          { metric_name: 'leads_enriched', quantity: 500, total_amount: 25 },
        ]

        mockSupabase.single.mockResolvedValueOnce({ data: subscription, error: null })
        mockSupabase.lte.mockResolvedValueOnce({ data: usageRecords, error: null })

        // Act
        const result = await service.getUsageSummary('workspace-123')

        // Assert
        expect(result.usage.emails_sent).toEqual({
          quantity: 7000,
          cost: 7,
          limit: 10000,
        })
        expect(result.usage.leads_enriched).toEqual({
          quantity: 500,
          cost: 25,
          limit: 1000,
        })
        expect(result.totalCost).toBe(32)
      })
    })
  })

  describe('Webhook Processing', () => {
    describe('processWebhook', () => {
      beforeEach(() => {
        process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
      })

      it('should process subscription created event', async () => {
        // Arrange
        const event = {
          id: 'evt-123',
          type: 'customer.subscription.created',
          data: {
            object: {
              id: 'sub-123',
              status: 'active',
              current_period_start: 1234567890,
              current_period_end: 1234567890,
              metadata: { workspaceId: 'workspace-123' },
            },
          },
        }

        mockStripe.webhooks.constructEvent.mockReturnValue(event as any)
        mockSupabase.insert.mockResolvedValue({ error: null })
        mockSupabase.eq.mockResolvedValue({ error: null })

        // Act
        await service.processWebhook('payload', 'signature')

        // Assert
        expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
          'payload',
          'signature',
          'whsec_test'
        )
        expect(mockSupabase.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            event_type: 'subscription.created',
            stripe_event_id: 'evt-123',
            data: event.data,
          })
        )
        expect(mockSupabase.update).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'active',
          })
        )
      })

      it('should handle trial ending event', async () => {
        // Arrange
        const event = {
          id: 'evt-123',
          type: 'customer.subscription.trial_will_end',
          data: {
            object: {
              id: 'sub-123',
              trial_end: 1234567890,
            },
          },
        }

        mockStripe.webhooks.constructEvent.mockReturnValue(event as any)
        mockSupabase.insert.mockResolvedValue({ error: null })

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

        // Act
        await service.processWebhook('payload', 'signature')

        // Assert
        expect(consoleSpy).toHaveBeenCalledWith(
          'Trial ending soon for subscription sub-123'
        )

        consoleSpy.mockRestore()
      })

      it('should handle payment failed event', async () => {
        // Arrange
        const event = {
          id: 'evt-123',
          type: 'invoice.payment_failed',
          data: {
            object: {
              id: 'in-123',
              amount_paid: 0,
            },
          },
        }

        mockStripe.webhooks.constructEvent.mockReturnValue(event as any)
        mockSupabase.insert.mockResolvedValue({ error: null })

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

        // Act
        await service.processWebhook('payload', 'signature')

        // Assert
        expect(consoleSpy).toHaveBeenCalledWith('Payment failed for invoice in-123')

        consoleSpy.mockRestore()
      })

      it('should verify webhook signature', async () => {
        // Arrange
        mockStripe.webhooks.constructEvent.mockImplementation(() => {
          throw new Error('Invalid signature')
        })

        // Act & Assert
        await expect(
          service.processWebhook('invalid-payload', 'invalid-signature')
        ).rejects.toThrow('Invalid signature')
      })
    })
  })

  describe('Invoice Management', () => {
    describe('getInvoices', () => {
      it('should retrieve paginated invoices', async () => {
        // Arrange
        const invoices = [
          { id: 'inv-1', amount_due: 100, status: 'paid' },
          { id: 'inv-2', amount_due: 200, status: 'open' },
          { id: 'inv-3', amount_due: 300, status: 'paid' },
        ]

        mockSupabase.limit.mockResolvedValue({ data: invoices, error: null })

        // Act
        const result = await service.getInvoices({
          workspaceId: 'workspace-123',
          status: 'paid',
          limit: 2,
        })

        // Assert
        expect(result.invoices).toHaveLength(2)
        expect(result.hasMore).toBe(true)
        expect(mockSupabase.eq).toHaveBeenCalledWith('status', 'paid')
      })
    })

    describe('applyCredit', () => {
      it('should apply credit to an open invoice', async () => {
        // Arrange
        const invoice = {
          id: 'inv-123',
          stripe_invoice_id: 'stripe-inv-123',
          status: 'open',
        }

        mockSupabase.single.mockResolvedValueOnce({ data: invoice, error: null })
        mockSupabase.single.mockResolvedValueOnce({ data: { amount_due: 50 }, error: null })

        mockStripe.creditNotes.create.mockResolvedValue({} as any)
        mockStripe.invoices.retrieve.mockResolvedValue({
          amount_due: 5000,
          status: 'open',
        } as any)

        // Act
        const result = await service.applyCredit({
          invoiceId: 'inv-123',
          amount: 50,
          description: 'Goodwill credit',
        })

        // Assert
        expect(mockStripe.creditNotes.create).toHaveBeenCalledWith({
          invoice: 'stripe-inv-123',
          amount: 5000,
          reason: 'goodwill',
          memo: 'Goodwill credit',
        })
        expect(result.amountDue).toBe(50)
      })

      it('should reject credit for non-open invoices', async () => {
        // Arrange
        const invoice = {
          id: 'inv-123',
          stripe_invoice_id: 'stripe-inv-123',
          status: 'paid',
        }

        mockSupabase.single.mockResolvedValue({ data: invoice, error: null })

        // Act & Assert
        await expect(
          service.applyCredit({
            invoiceId: 'inv-123',
            amount: 50,
          })
        ).rejects.toThrow('Cannot apply credit to this invoice')
      })
    })
  })

  describe('Customer Portal', () => {
    describe('createPortalSession', () => {
      it('should create a customer portal session', async () => {
        // Arrange
        mockSupabase.single.mockResolvedValueOnce({ data: { stripe_customer_id: 'cus-123' }, error: null })
        mockStripe.billingPortal.sessions.create.mockResolvedValue({
          url: 'https://billing.stripe.com/session/xyz',
        } as any)

        // Act
        const result = await service.createPortalSession({
          workspaceId: 'workspace-123',
          returnUrl: 'https://app.example.com/settings',
        })

        // Assert
        expect(result.url).toBe('https://billing.stripe.com/session/xyz')
        expect(mockStripe.billingPortal.sessions.create).toHaveBeenCalledWith({
          customer: 'cus-123',
          return_url: 'https://app.example.com/settings',
        })
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle Stripe errors properly', async () => {
      // Arrange
      const stripeError = new Error('Card declined') as any
      stripeError.name = 'StripeError'
      stripeError.code = 'card_declined'
      stripeError.statusCode = 402

      mockSupabase.single.mockResolvedValue({ data: { id: 'plan-123' }, error: null })
      mockStripe.subscriptions.create.mockRejectedValue(stripeError)

      // Act & Assert
      try {
        await service.createSubscription({
          workspaceId: 'workspace-123',
          planSlug: 'pro',
        })
      } catch (error: any) {
        expect(error.message).toBe('Card declined')
        expect(error.code).toBe('card_declined')
        expect(error.statusCode).toBe(402)
        expect(error.stripeError).toBeDefined()
      }
    })

    it('should handle database errors properly', async () => {
      // Arrange
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      })

      // Act & Assert
      await expect(
        service.createSubscription({
          workspaceId: 'workspace-123',
          planSlug: 'pro',
        })
      ).rejects.toThrow('Plan not found')
    })
  })

  describe('Proration Calculations', () => {
    it('should calculate proration correctly', async () => {
      const { calculateProration } = await import('../stripe-service')

      const result = calculateProration({
        oldPrice: 29,
        newPrice: 49,
        daysRemaining: 15,
        daysInPeriod: 30,
      })

      // Credit: (29/30) * 15 = 14.50
      // Charge: (49/30) * 15 = 24.50
      // Total: 24.50 - 14.50 = 10.00
      expect(result).toBeCloseTo(10, 2)
    })
  })

  describe('Usage Limits', () => {
    it('should calculate usage percentage correctly', async () => {
      const { getUsagePercentage } = await import('../stripe-service')

      expect(getUsagePercentage(750, 1000)).toBe(75)
      expect(getUsagePercentage(1200, 1000)).toBe(100)
      expect(getUsagePercentage(500, null)).toBeNull()
      expect(getUsagePercentage(500, 0)).toBeNull()
    })
  })
})