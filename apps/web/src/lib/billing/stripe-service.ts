import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { stripe } from '@/lib/stripe/client'

// Types
export interface SubscriptionPlan {
  id: string
  name: string
  slug: string
  description: string | null
  priceMonthly: number
  priceYearly: number
  currency: string
  features: string[]
  limits: {
    emails_sent?: number | null
    leads_enriched?: number | null
    ai_tokens?: number | null
  }
  isActive: boolean
  isPopular: boolean
  displayOrder: number
}

export interface Subscription {
  id: string
  workspaceId: string
  planId: string
  stripeSubscriptionId: string | null
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid'
  currentPeriodStart: Date | null
  currentPeriodEnd: Date | null
  trialStart: Date | null
  trialEnd: Date | null
  canceledAt: Date | null
  stripeCustomerId: string | null
}

export interface PaymentMethod {
  id: string
  workspaceId: string
  stripePaymentMethodId: string
  type: 'card' | 'bank_account'
  last4: string | null
  brand: string | null
  expMonth: number | null
  expYear: number | null
  isDefault: boolean
  billingDetails: Record<string, any>
}

export interface Invoice {
  id: string
  workspaceId: string
  subscriptionId: string | null
  stripeInvoiceId: string | null
  invoiceNumber: string
  amountDue: number
  amountPaid: number
  currency: string
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible'
  dueDate: Date | null
  paidAt: Date | null
  invoicePdf: string | null
  lineItems: any[]
  metadata: Record<string, any>
}

export interface UsageRecord {
  id: string
  workspaceId: string
  subscriptionId: string | null
  metricName: 'emails_sent' | 'leads_enriched' | 'ai_tokens'
  quantity: number
  unitPrice: number | null
  totalAmount: number | null
  periodStart: Date
  periodEnd: Date
  stripeUsageRecordId: string | null
}

export interface BillingError extends Error {
  code?: string
  statusCode?: number
  stripeError?: Stripe.StripeError
}

// Initialize Supabase client for server-side operations
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
)

/**
 * Main Stripe Billing Service Class
 */
export class StripeBillingService {
  private stripe: Stripe
  private webhookSecret: string

  constructor() {
    this.stripe = stripe
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!
  }

  // ==================== Subscription Management ====================

  /**
   * Create a new subscription for a workspace
   */
  async createSubscription({
    workspaceId,
    planSlug,
    paymentMethodId,
    trialDays = 0,
    isYearly = false,
  }: {
    workspaceId: string
    planSlug: string
    paymentMethodId?: string
    trialDays?: number
    isYearly?: boolean
  }): Promise<{ subscription: Subscription; clientSecret?: string }> {
    try {
      // Get the plan details
      const { data: plan, error: planError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('slug', planSlug)
        .single()

      if (planError || !plan) {
        throw this.createError('Plan not found', 'PLAN_NOT_FOUND', 404)
      }

      // Get or create Stripe customer
      const customerId = await this.getOrCreateStripeCustomer(workspaceId)

      // Create Stripe price if it doesn't exist
      const priceId = await this.getOrCreateStripePrice(plan, isYearly)

      // Set default payment method if provided
      if (paymentMethodId) {
        await this.stripe.paymentMethods.attach(paymentMethodId, {
          customer: customerId,
        })
        await this.stripe.customers.update(customerId, {
          invoice_settings: {
            default_payment_method: paymentMethodId,
          },
        })
      }

      // Create Stripe subscription
      const stripeSubscription = await this.stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        trial_period_days: trialDays,
        payment_behavior: 'default_incomplete',
        payment_settings: {
          save_default_payment_method: 'on_subscription',
        },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          workspaceId,
          planId: plan.id,
        },
      })

      // Save subscription to database
      const { data: subscription, error: subError } = await supabase
        .from('subscriptions')
        .insert({
          workspace_id: workspaceId,
          plan_id: plan.id,
          stripe_subscription_id: stripeSubscription.id,
          status: this.mapStripeStatus(stripeSubscription.status),
          current_period_start: new Date(stripeSubscription.current_period_start * 1000),
          current_period_end: new Date(stripeSubscription.current_period_end * 1000),
          trial_start: stripeSubscription.trial_start
            ? new Date(stripeSubscription.trial_start * 1000)
            : null,
          trial_end: stripeSubscription.trial_end
            ? new Date(stripeSubscription.trial_end * 1000)
            : null,
          stripe_customer_id: customerId,
        })
        .select()
        .single()

      if (subError || !subscription) {
        // Rollback Stripe subscription if database save fails
        await this.stripe.subscriptions.cancel(stripeSubscription.id)
        throw this.createError('Failed to save subscription', 'DATABASE_ERROR', 500)
      }

      // Get client secret for payment confirmation if needed
      let clientSecret: string | undefined
      const latestInvoice = stripeSubscription.latest_invoice as Stripe.Invoice
      if (latestInvoice?.payment_intent) {
        const paymentIntent = latestInvoice.payment_intent as Stripe.PaymentIntent
        clientSecret = paymentIntent.client_secret || undefined
      }

      return {
        subscription: this.transformSubscription(subscription),
        clientSecret,
      }
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Update an existing subscription (upgrade/downgrade)
   */
  async updateSubscription({
    subscriptionId,
    planSlug,
    isYearly = false,
    prorationBehavior = 'create_prorations',
  }: {
    subscriptionId: string
    planSlug: string
    isYearly?: boolean
    prorationBehavior?: 'create_prorations' | 'none' | 'always_invoice'
  }): Promise<Subscription> {
    try {
      // Get current subscription
      const { data: currentSub, error: subError } = await supabase
        .from('subscriptions')
        .select('*, subscription_plans(*)')
        .eq('id', subscriptionId)
        .single()

      if (subError || !currentSub) {
        throw this.createError('Subscription not found', 'SUBSCRIPTION_NOT_FOUND', 404)
      }

      // Get new plan details
      const { data: newPlan, error: planError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('slug', planSlug)
        .single()

      if (planError || !newPlan) {
        throw this.createError('Plan not found', 'PLAN_NOT_FOUND', 404)
      }

      // Get or create new price
      const newPriceId = await this.getOrCreateStripePrice(newPlan, isYearly)

      // Update Stripe subscription
      const stripeSubscription = await this.stripe.subscriptions.update(
        currentSub.stripe_subscription_id!,
        {
          items: [
            {
              id: (await this.stripe.subscriptions.retrieve(currentSub.stripe_subscription_id!))
                .items.data[0].id,
              price: newPriceId,
            },
          ],
          proration_behavior: prorationBehavior,
          metadata: {
            planId: newPlan.id,
          },
        }
      )

      // Update database
      const { data: updatedSub, error: updateError } = await supabase
        .from('subscriptions')
        .update({
          plan_id: newPlan.id,
          status: this.mapStripeStatus(stripeSubscription.status),
          current_period_start: new Date(stripeSubscription.current_period_start * 1000),
          current_period_end: new Date(stripeSubscription.current_period_end * 1000),
        })
        .eq('id', subscriptionId)
        .select()
        .single()

      if (updateError || !updatedSub) {
        throw this.createError('Failed to update subscription', 'DATABASE_ERROR', 500)
      }

      return this.transformSubscription(updatedSub)
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription({
    subscriptionId,
    cancelAtPeriodEnd = true,
    reason
  }: {
    subscriptionId: string
    cancelAtPeriodEnd?: boolean
    reason?: string
  }): Promise<Subscription> {
    try {
      // Get subscription
      const { data: subscription, error: subError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('id', subscriptionId)
        .single()

      if (subError || !subscription) {
        throw this.createError('Subscription not found', 'SUBSCRIPTION_NOT_FOUND', 404)
      }

      // Cancel in Stripe
      const stripeSubscription = await this.stripe.subscriptions.update(
        subscription.stripe_subscription_id!,
        {
          cancel_at_period_end: cancelAtPeriodEnd,
          cancellation_details: reason ? { comment: reason } : undefined,
        }
      )

      // Update database
      const { data: updatedSub, error: updateError } = await supabase
        .from('subscriptions')
        .update({
          status: this.mapStripeStatus(stripeSubscription.status),
          canceled_at: cancelAtPeriodEnd ? null : new Date(),
        })
        .eq('id', subscriptionId)
        .select()
        .single()

      if (updateError || !updatedSub) {
        throw this.createError('Failed to cancel subscription', 'DATABASE_ERROR', 500)
      }

      return this.transformSubscription(updatedSub)
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Resume a canceled subscription
   */
  async resumeSubscription(subscriptionId: string): Promise<Subscription> {
    try {
      // Get subscription
      const { data: subscription, error: subError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('id', subscriptionId)
        .single()

      if (subError || !subscription) {
        throw this.createError('Subscription not found', 'SUBSCRIPTION_NOT_FOUND', 404)
      }

      // Resume in Stripe
      const stripeSubscription = await this.stripe.subscriptions.update(
        subscription.stripe_subscription_id!,
        {
          cancel_at_period_end: false,
        }
      )

      // Update database
      const { data: updatedSub, error: updateError } = await supabase
        .from('subscriptions')
        .update({
          status: this.mapStripeStatus(stripeSubscription.status),
          canceled_at: null,
        })
        .eq('id', subscriptionId)
        .select()
        .single()

      if (updateError || !updatedSub) {
        throw this.createError('Failed to resume subscription', 'DATABASE_ERROR', 500)
      }

      return this.transformSubscription(updatedSub)
    } catch (error) {
      throw this.handleError(error)
    }
  }

  // ==================== Payment Methods ====================

  /**
   * Add a new payment method
   */
  async addPaymentMethod({
    workspaceId,
    paymentMethodId,
    setAsDefault = false,
  }: {
    workspaceId: string
    paymentMethodId: string
    setAsDefault?: boolean
  }): Promise<PaymentMethod> {
    try {
      // Get or create Stripe customer
      const customerId = await this.getOrCreateStripeCustomer(workspaceId)

      // Attach payment method to customer
      const stripePaymentMethod = await this.stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      })

      // Set as default if requested
      if (setAsDefault) {
        await this.stripe.customers.update(customerId, {
          invoice_settings: {
            default_payment_method: paymentMethodId,
          },
        })

        // Update other payment methods to not be default
        await supabase
          .from('payment_methods')
          .update({ is_default: false })
          .eq('workspace_id', workspaceId)
      }

      // Save to database
      const { data: paymentMethod, error } = await supabase
        .from('payment_methods')
        .insert({
          workspace_id: workspaceId,
          stripe_payment_method_id: stripePaymentMethod.id,
          type: stripePaymentMethod.type as 'card' | 'bank_account',
          last4: stripePaymentMethod.card?.last4 || null,
          brand: stripePaymentMethod.card?.brand || null,
          exp_month: stripePaymentMethod.card?.exp_month || null,
          exp_year: stripePaymentMethod.card?.exp_year || null,
          is_default: setAsDefault,
          billing_details: stripePaymentMethod.billing_details || {},
        })
        .select()
        .single()

      if (error || !paymentMethod) {
        throw this.createError('Failed to save payment method', 'DATABASE_ERROR', 500)
      }

      return this.transformPaymentMethod(paymentMethod)
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Update a payment method
   */
  async updatePaymentMethod({
    paymentMethodId,
    billingDetails,
    setAsDefault = false,
  }: {
    paymentMethodId: string
    billingDetails?: Stripe.PaymentMethodUpdateParams.BillingDetails
    setAsDefault?: boolean
  }): Promise<PaymentMethod> {
    try {
      // Get payment method from database
      const { data: paymentMethod, error } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('id', paymentMethodId)
        .single()

      if (error || !paymentMethod) {
        throw this.createError('Payment method not found', 'PAYMENT_METHOD_NOT_FOUND', 404)
      }

      // Update in Stripe if billing details provided
      if (billingDetails) {
        await this.stripe.paymentMethods.update(paymentMethod.stripe_payment_method_id, {
          billing_details: billingDetails,
        })
      }

      // Update default status
      if (setAsDefault) {
        // Get customer ID
        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('stripe_customer_id')
          .eq('workspace_id', paymentMethod.workspace_id)
          .single()

        if (subscription?.stripe_customer_id) {
          await this.stripe.customers.update(subscription.stripe_customer_id, {
            invoice_settings: {
              default_payment_method: paymentMethod.stripe_payment_method_id,
            },
          })
        }

        // Update other payment methods to not be default
        await supabase
          .from('payment_methods')
          .update({ is_default: false })
          .eq('workspace_id', paymentMethod.workspace_id)
      }

      // Update database
      const { data: updatedMethod, error: updateError } = await supabase
        .from('payment_methods')
        .update({
          is_default: setAsDefault,
          billing_details: billingDetails || paymentMethod.billing_details,
        })
        .eq('id', paymentMethodId)
        .select()
        .single()

      if (updateError || !updatedMethod) {
        throw this.createError('Failed to update payment method', 'DATABASE_ERROR', 500)
      }

      return this.transformPaymentMethod(updatedMethod)
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Delete a payment method
   */
  async deletePaymentMethod(paymentMethodId: string): Promise<void> {
    try {
      // Get payment method
      const { data: paymentMethod, error } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('id', paymentMethodId)
        .single()

      if (error || !paymentMethod) {
        throw this.createError('Payment method not found', 'PAYMENT_METHOD_NOT_FOUND', 404)
      }

      // Detach from Stripe
      await this.stripe.paymentMethods.detach(paymentMethod.stripe_payment_method_id)

      // Delete from database
      await supabase.from('payment_methods').delete().eq('id', paymentMethodId)
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * List payment methods for a workspace
   */
  async listPaymentMethods(workspaceId: string): Promise<PaymentMethod[]> {
    try {
      const { data: paymentMethods, error } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })

      if (error) {
        throw this.createError('Failed to list payment methods', 'DATABASE_ERROR', 500)
      }

      return (paymentMethods || []).map(this.transformPaymentMethod)
    } catch (error) {
      throw this.handleError(error)
    }
  }

  // ==================== Usage-Based Billing ====================

  /**
   * Report usage for metered billing
   */
  async reportUsage({
    workspaceId,
    metricName,
    quantity,
    timestamp = new Date(),
    idempotencyKey,
  }: {
    workspaceId: string
    metricName: 'emails_sent' | 'leads_enriched' | 'ai_tokens'
    quantity: number
    timestamp?: Date
    idempotencyKey?: string
  }): Promise<UsageRecord> {
    try {
      // Get active subscription
      const { data: subscription, error: subError } = await supabase
        .from('subscriptions')
        .select('*, subscription_plans(*)')
        .eq('workspace_id', workspaceId)
        .eq('status', 'active')
        .single()

      if (subError || !subscription) {
        throw this.createError('No active subscription found', 'NO_ACTIVE_SUBSCRIPTION', 404)
      }

      // Check if plan has usage-based pricing
      const plan = subscription.subscription_plans
      if (!plan || !this.isMeteredPlan(plan)) {
        // For non-metered plans, just track usage in database
        const { data: usageRecord, error } = await supabase
          .from('usage_records')
          .insert({
            workspace_id: workspaceId,
            subscription_id: subscription.id,
            metric_name: metricName,
            quantity,
            unit_price: 0,
            period_start: subscription.current_period_start,
            period_end: subscription.current_period_end,
          })
          .select()
          .single()

        if (error || !usageRecord) {
          throw this.createError('Failed to track usage', 'DATABASE_ERROR', 500)
        }

        return this.transformUsageRecord(usageRecord)
      }

      // Report to Stripe for metered billing
      const subscriptionItem = await this.getOrCreateSubscriptionItem(
        subscription.stripe_subscription_id!,
        metricName
      )

      const stripeUsageRecord = await this.stripe.subscriptionItems.createUsageRecord(
        subscriptionItem.id,
        {
          quantity: Math.round(quantity),
          timestamp: Math.floor(timestamp.getTime() / 1000),
          action: 'increment',
        },
        {
          idempotencyKey,
        }
      )

      // Save to database
      const unitPrice = this.getUnitPrice(plan, metricName)
      const { data: usageRecord, error } = await supabase
        .from('usage_records')
        .insert({
          workspace_id: workspaceId,
          subscription_id: subscription.id,
          metric_name: metricName,
          quantity,
          unit_price: unitPrice,
          period_start: subscription.current_period_start,
          period_end: subscription.current_period_end,
          stripe_usage_record_id: stripeUsageRecord.id,
        })
        .select()
        .single()

      if (error || !usageRecord) {
        throw this.createError('Failed to save usage record', 'DATABASE_ERROR', 500)
      }

      // Check usage limits and send alerts if needed
      await this.checkUsageLimits(workspaceId, metricName)

      return this.transformUsageRecord(usageRecord)
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Get usage summary for current billing period
   */
  async getUsageSummary(workspaceId: string): Promise<{
    period: { start: Date; end: Date }
    usage: Record<string, { quantity: number; cost: number; limit: number | null }>
    totalCost: number
  }> {
    try {
      // Get active subscription and plan
      const { data: subscription, error: subError } = await supabase
        .from('subscriptions')
        .select('*, subscription_plans(*)')
        .eq('workspace_id', workspaceId)
        .eq('status', 'active')
        .single()

      if (subError || !subscription) {
        throw this.createError('No active subscription found', 'NO_ACTIVE_SUBSCRIPTION', 404)
      }

      // Get usage records for current period
      const { data: usageRecords, error: usageError } = await supabase
        .from('usage_records')
        .select('*')
        .eq('workspace_id', workspaceId)
        .gte('period_start', subscription.current_period_start)
        .lte('period_end', subscription.current_period_end)

      if (usageError) {
        throw this.createError('Failed to get usage records', 'DATABASE_ERROR', 500)
      }

      // Aggregate usage by metric
      const usage: Record<string, { quantity: number; cost: number; limit: number | null }> = {}
      let totalCost = 0

      const metrics = ['emails_sent', 'leads_enriched', 'ai_tokens'] as const
      const plan = subscription.subscription_plans

      for (const metric of metrics) {
        const metricRecords = (usageRecords || []).filter((r) => r.metric_name === metric)
        const quantity = metricRecords.reduce((sum, r) => sum + Number(r.quantity), 0)
        const cost = metricRecords.reduce((sum, r) => sum + Number(r.total_amount || 0), 0)
        const limit = plan?.limits?.[metric] || null

        usage[metric] = { quantity, cost, limit }
        totalCost += cost
      }

      return {
        period: {
          start: new Date(subscription.current_period_start),
          end: new Date(subscription.current_period_end),
        },
        usage,
        totalCost,
      }
    } catch (error) {
      throw this.handleError(error)
    }
  }

  // ==================== Invoice Management ====================

  /**
   * Get invoices for a workspace
   */
  async getInvoices({
    workspaceId,
    status,
    limit = 10,
    startingAfter,
  }: {
    workspaceId: string
    status?: Invoice['status']
    limit?: number
    startingAfter?: string
  }): Promise<{ invoices: Invoice[]; hasMore: boolean }> {
    try {
      let query = supabase
        .from('invoices')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(limit + 1)

      if (status) {
        query = query.eq('status', status)
      }

      if (startingAfter) {
        query = query.lt('id', startingAfter)
      }

      const { data: invoices, error } = await query

      if (error) {
        throw this.createError('Failed to get invoices', 'DATABASE_ERROR', 500)
      }

      const hasMore = (invoices || []).length > limit
      const paginatedInvoices = (invoices || []).slice(0, limit)

      return {
        invoices: paginatedInvoices.map(this.transformInvoice),
        hasMore,
      }
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Get a specific invoice
   */
  async getInvoice(invoiceId: string): Promise<Invoice> {
    try {
      const { data: invoice, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', invoiceId)
        .single()

      if (error || !invoice) {
        throw this.createError('Invoice not found', 'INVOICE_NOT_FOUND', 404)
      }

      return this.transformInvoice(invoice)
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Send invoice by email
   */
  async sendInvoiceEmail(invoiceId: string): Promise<void> {
    try {
      const { data: invoice, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', invoiceId)
        .single()

      if (error || !invoice) {
        throw this.createError('Invoice not found', 'INVOICE_NOT_FOUND', 404)
      }

      if (!invoice.stripe_invoice_id) {
        throw this.createError('Invoice not synced with Stripe', 'INVALID_INVOICE', 400)
      }

      // Send through Stripe
      await this.stripe.invoices.sendInvoice(invoice.stripe_invoice_id)
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Apply a credit to an invoice
   */
  async applyCredit({
    invoiceId,
    amount,
    description,
  }: {
    invoiceId: string
    amount: number
    description?: string
  }): Promise<Invoice> {
    try {
      const { data: invoice, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', invoiceId)
        .single()

      if (error || !invoice) {
        throw this.createError('Invoice not found', 'INVOICE_NOT_FOUND', 404)
      }

      if (!invoice.stripe_invoice_id || invoice.status !== 'open') {
        throw this.createError('Cannot apply credit to this invoice', 'INVALID_INVOICE', 400)
      }

      // Create credit note in Stripe
      await this.stripe.creditNotes.create({
        invoice: invoice.stripe_invoice_id,
        amount: Math.round(amount * 100), // Convert to cents
        reason: 'goodwill',
        memo: description,
      })

      // Refresh invoice from Stripe
      const stripeInvoice = await this.stripe.invoices.retrieve(invoice.stripe_invoice_id)

      // Update database
      const { data: updatedInvoice, error: updateError } = await supabase
        .from('invoices')
        .update({
          amount_due: stripeInvoice.amount_due / 100,
          status: this.mapInvoiceStatus(stripeInvoice.status),
        })
        .eq('id', invoiceId)
        .select()
        .single()

      if (updateError || !updatedInvoice) {
        throw this.createError('Failed to update invoice', 'DATABASE_ERROR', 500)
      }

      return this.transformInvoice(updatedInvoice)
    } catch (error) {
      throw this.handleError(error)
    }
  }

  // ==================== Customer Portal ====================

  /**
   * Create a customer portal session
   */
  async createPortalSession({
    workspaceId,
    returnUrl,
  }: {
    workspaceId: string
    returnUrl: string
  }): Promise<{ url: string }> {
    try {
      // Get customer ID
      const customerId = await this.getOrCreateStripeCustomer(workspaceId)

      // Create portal session
      const session = await this.stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      })

      return { url: session.url }
    } catch (error) {
      throw this.handleError(error)
    }
  }

  // ==================== Webhook Processing ====================

  /**
   * Process Stripe webhook events
   */
  async processWebhook(payload: string, signature: string): Promise<void> {
    try {
      // Verify webhook signature
      const event = this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret)

      // Log event
      await supabase.from('billing_events').insert({
        event_type: this.mapEventType(event.type),
        stripe_event_id: event.id,
        data: event.data,
      })

      // Process event based on type
      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdate(event.data.object as Stripe.Subscription)
          break

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
          break

        case 'customer.subscription.trial_will_end':
          await this.handleTrialWillEnd(event.data.object as Stripe.Subscription)
          break

        case 'invoice.created':
        case 'invoice.finalized':
        case 'invoice.updated':
          await this.handleInvoiceUpdate(event.data.object as Stripe.Invoice)
          break

        case 'invoice.payment_succeeded':
          await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice)
          break

        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data.object as Stripe.Invoice)
          break

        case 'payment_method.attached':
          await this.handlePaymentMethodAttached(event.data.object as Stripe.PaymentMethod)
          break

        case 'payment_method.detached':
          await this.handlePaymentMethodDetached(event.data.object as Stripe.PaymentMethod)
          break

        default:
          console.log(`Unhandled webhook event type: ${event.type}`)
      }

      // Mark event as processed
      await supabase
        .from('billing_events')
        .update({ processed_at: new Date() })
        .eq('stripe_event_id', event.id)
    } catch (error) {
      throw this.handleError(error)
    }
  }

  // ==================== Helper Methods ====================

  /**
   * Get or create a Stripe customer for a workspace
   */
  private async getOrCreateStripeCustomer(workspaceId: string): Promise<string> {
    // Check if customer already exists
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('workspace_id', workspaceId)
      .not('stripe_customer_id', 'is', null)
      .single()

    if (subscription?.stripe_customer_id) {
      return subscription.stripe_customer_id
    }

    // Get workspace details
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('*, workspace_users!inner(user:auth.users(*))')
      .eq('id', workspaceId)
      .single()

    if (workspaceError || !workspace) {
      throw this.createError('Workspace not found', 'WORKSPACE_NOT_FOUND', 404)
    }

    // Create Stripe customer
    const customer = await this.stripe.customers.create({
      name: workspace.name,
      email: workspace.workspace_users[0]?.user?.email,
      metadata: {
        workspaceId,
      },
    })

    return customer.id
  }

  /**
   * Get or create a Stripe price for a plan
   */
  private async getOrCreateStripePrice(
    plan: any,
    isYearly: boolean
  ): Promise<string> {
    const amount = isYearly ? plan.price_yearly : plan.price_monthly
    const interval = isYearly ? 'year' : 'month'

    // Search for existing price
    const prices = await this.stripe.prices.list({
      product: plan.stripe_product_id,
      active: true,
      limit: 100,
    })

    const existingPrice = prices.data.find(
      (p) =>
        p.unit_amount === Math.round(amount * 100) &&
        p.recurring?.interval === interval
    )

    if (existingPrice) {
      return existingPrice.id
    }

    // Create product if needed
    let productId = plan.stripe_product_id
    if (!productId) {
      const product = await this.stripe.products.create({
        name: plan.name,
        description: plan.description || undefined,
        metadata: {
          planId: plan.id,
        },
      })
      productId = product.id

      // Update plan with product ID
      await supabase
        .from('subscription_plans')
        .update({ stripe_product_id: productId })
        .eq('id', plan.id)
    }

    // Create price
    const price = await this.stripe.prices.create({
      product: productId,
      unit_amount: Math.round(amount * 100),
      currency: plan.currency.toLowerCase(),
      recurring: {
        interval,
      },
    })

    return price.id
  }

  /**
   * Get or create a subscription item for usage reporting
   */
  private async getOrCreateSubscriptionItem(
    stripeSubscriptionId: string,
    metricName: string
  ): Promise<Stripe.SubscriptionItem> {
    const subscription = await this.stripe.subscriptions.retrieve(stripeSubscriptionId, {
      expand: ['items.data.price.product'],
    })

    // Find existing item for this metric
    const existingItem = subscription.items.data.find((item) => {
      const product = item.price.product as Stripe.Product
      return product.metadata?.metric === metricName
    })

    if (existingItem) {
      return existingItem
    }

    // Create new product and price for this metric
    const product = await this.stripe.products.create({
      name: `${metricName} usage`,
      metadata: { metric: metricName },
    })

    const price = await this.stripe.prices.create({
      product: product.id,
      unit_amount: this.getDefaultUnitPrice(metricName),
      currency: 'usd',
      recurring: {
        interval: 'month',
        usage_type: 'metered',
      },
    })

    // Add to subscription
    const item = await this.stripe.subscriptionItems.create({
      subscription: stripeSubscriptionId,
      price: price.id,
    })

    return item
  }

  /**
   * Check usage limits and send alerts
   */
  private async checkUsageLimits(workspaceId: string, metricName: string): Promise<void> {
    const usage = await this.getUsageSummary(workspaceId)
    const metric = usage.usage[metricName]

    if (!metric.limit) return

    const usagePercentage = (metric.quantity / metric.limit) * 100

    // Send alerts at 80%, 90%, and 100%
    const alertThresholds = [80, 90, 100]
    for (const threshold of alertThresholds) {
      if (usagePercentage >= threshold) {
        // TODO: Implement alert sending (email, in-app notification, etc.)
        console.log(`Usage alert: ${metricName} at ${usagePercentage.toFixed(1)}% for workspace ${workspaceId}`)
      }
    }
  }

  // ==================== Webhook Handlers ====================

  private async handleSubscriptionUpdate(subscription: Stripe.Subscription): Promise<void> {
    const workspaceId = subscription.metadata.workspaceId
    if (!workspaceId) return

    await supabase
      .from('subscriptions')
      .update({
        status: this.mapStripeStatus(subscription.status),
        current_period_start: new Date(subscription.current_period_start * 1000),
        current_period_end: new Date(subscription.current_period_end * 1000),
        trial_end: subscription.trial_end
          ? new Date(subscription.trial_end * 1000)
          : null,
      })
      .eq('stripe_subscription_id', subscription.id)
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    await supabase
      .from('subscriptions')
      .update({
        status: 'canceled',
        canceled_at: new Date(),
      })
      .eq('stripe_subscription_id', subscription.id)
  }

  private async handleTrialWillEnd(subscription: Stripe.Subscription): Promise<void> {
    // TODO: Send trial ending notification
    console.log(`Trial ending soon for subscription ${subscription.id}`)
  }

  private async handleInvoiceUpdate(invoice: Stripe.Invoice): Promise<void> {
    const workspaceId = invoice.metadata?.workspaceId || invoice.subscription_details?.metadata?.workspaceId
    if (!workspaceId) return

    const invoiceData = {
      workspace_id: workspaceId,
      subscription_id: invoice.subscription
        ? await this.getSubscriptionIdByStripeId(invoice.subscription as string)
        : null,
      stripe_invoice_id: invoice.id,
      invoice_number: invoice.number || invoice.id,
      amount_due: invoice.amount_due / 100,
      amount_paid: invoice.amount_paid / 100,
      currency: invoice.currency.toUpperCase(),
      status: this.mapInvoiceStatus(invoice.status),
      due_date: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
      invoice_pdf: invoice.invoice_pdf || null,
      line_items: invoice.lines.data.map((line) => ({
        description: line.description,
        amount: line.amount / 100,
        quantity: line.quantity,
      })),
    }

    await supabase
      .from('invoices')
      .upsert(invoiceData, { onConflict: 'stripe_invoice_id' })
  }

  private async handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    await supabase
      .from('invoices')
      .update({
        status: 'paid',
        paid_at: new Date(),
        amount_paid: invoice.amount_paid / 100,
      })
      .eq('stripe_invoice_id', invoice.id)
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    // TODO: Send payment failed notification
    console.log(`Payment failed for invoice ${invoice.id}`)
  }

  private async handlePaymentMethodAttached(paymentMethod: Stripe.PaymentMethod): Promise<void> {
    if (!paymentMethod.customer) return

    const customer = await this.stripe.customers.retrieve(paymentMethod.customer as string)
    const workspaceId = (customer as Stripe.Customer).metadata?.workspaceId
    if (!workspaceId) return

    await supabase.from('payment_methods').insert({
      workspace_id: workspaceId,
      stripe_payment_method_id: paymentMethod.id,
      type: paymentMethod.type as 'card' | 'bank_account',
      last4: paymentMethod.card?.last4 || null,
      brand: paymentMethod.card?.brand || null,
      exp_month: paymentMethod.card?.exp_month || null,
      exp_year: paymentMethod.card?.exp_year || null,
      billing_details: paymentMethod.billing_details || {},
    })
  }

  private async handlePaymentMethodDetached(paymentMethod: Stripe.PaymentMethod): Promise<void> {
    await supabase
      .from('payment_methods')
      .delete()
      .eq('stripe_payment_method_id', paymentMethod.id)
  }

  // ==================== Utility Methods ====================

  private mapStripeStatus(status: Stripe.Subscription.Status): Subscription['status'] {
    const statusMap: Record<Stripe.Subscription.Status, Subscription['status']> = {
      trialing: 'trialing',
      active: 'active',
      past_due: 'past_due',
      canceled: 'canceled',
      unpaid: 'unpaid',
      incomplete: 'unpaid',
      incomplete_expired: 'canceled',
      paused: 'canceled',
    }
    return statusMap[status] || 'unpaid'
  }

  private mapInvoiceStatus(status: Stripe.Invoice.Status | null): Invoice['status'] {
    if (!status) return 'draft'
    const statusMap: Record<Stripe.Invoice.Status, Invoice['status']> = {
      draft: 'draft',
      open: 'open',
      paid: 'paid',
      void: 'void',
      uncollectible: 'uncollectible',
    }
    return statusMap[status] || 'draft'
  }

  private mapEventType(stripeEventType: string): string {
    // Map Stripe event types to our enum values
    const eventMap: Record<string, string> = {
      'customer.subscription.created': 'subscription.created',
      'customer.subscription.updated': 'subscription.updated',
      'customer.subscription.deleted': 'subscription.deleted',
      'customer.subscription.trial_will_end': 'subscription.trial_will_end',
      'invoice.created': 'invoice.created',
      'invoice.payment_succeeded': 'invoice.payment_succeeded',
      'invoice.payment_failed': 'invoice.payment_failed',
      'payment_method.attached': 'payment_method.attached',
      'payment_method.detached': 'payment_method.detached',
      'customer.created': 'customer.created',
      'customer.updated': 'customer.updated',
    }
    return eventMap[stripeEventType] || stripeEventType
  }

  private isMeteredPlan(plan: any): boolean {
    // Enterprise plan or any plan with usage-based pricing
    return plan.slug === 'enterprise' || plan.has_usage_pricing === true
  }

  private getUnitPrice(plan: any, metricName: string): number {
    // Define default unit prices for each metric
    const defaultPrices: Record<string, number> = {
      emails_sent: 0.001, // $0.001 per email
      leads_enriched: 0.05, // $0.05 per lead
      ai_tokens: 0.00001, // $0.00001 per token
    }

    // Check if plan has custom pricing
    if (plan.unit_prices?.[metricName]) {
      return plan.unit_prices[metricName]
    }

    return defaultPrices[metricName] || 0
  }

  private getDefaultUnitPrice(metricName: string): number {
    const prices: Record<string, number> = {
      emails_sent: 100, // $0.001 in cents
      leads_enriched: 5000, // $0.05 in cents
      ai_tokens: 1, // $0.00001 in cents
    }
    return prices[metricName] || 0
  }

  private async getSubscriptionIdByStripeId(stripeSubscriptionId: string): Promise<string | null> {
    const { data } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('stripe_subscription_id', stripeSubscriptionId)
      .single()
    return data?.id || null
  }

  private transformSubscription(sub: any): Subscription {
    return {
      id: sub.id,
      workspaceId: sub.workspace_id,
      planId: sub.plan_id,
      stripeSubscriptionId: sub.stripe_subscription_id,
      status: sub.status,
      currentPeriodStart: sub.current_period_start ? new Date(sub.current_period_start) : null,
      currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end) : null,
      trialStart: sub.trial_start ? new Date(sub.trial_start) : null,
      trialEnd: sub.trial_end ? new Date(sub.trial_end) : null,
      canceledAt: sub.canceled_at ? new Date(sub.canceled_at) : null,
      stripeCustomerId: sub.stripe_customer_id,
    }
  }

  private transformPaymentMethod(pm: any): PaymentMethod {
    return {
      id: pm.id,
      workspaceId: pm.workspace_id,
      stripePaymentMethodId: pm.stripe_payment_method_id,
      type: pm.type,
      last4: pm.last4,
      brand: pm.brand,
      expMonth: pm.exp_month,
      expYear: pm.exp_year,
      isDefault: pm.is_default,
      billingDetails: pm.billing_details,
    }
  }

  private transformInvoice(inv: any): Invoice {
    return {
      id: inv.id,
      workspaceId: inv.workspace_id,
      subscriptionId: inv.subscription_id,
      stripeInvoiceId: inv.stripe_invoice_id,
      invoiceNumber: inv.invoice_number,
      amountDue: Number(inv.amount_due),
      amountPaid: Number(inv.amount_paid),
      currency: inv.currency,
      status: inv.status,
      dueDate: inv.due_date ? new Date(inv.due_date) : null,
      paidAt: inv.paid_at ? new Date(inv.paid_at) : null,
      invoicePdf: inv.invoice_pdf,
      lineItems: inv.line_items,
      metadata: inv.metadata,
    }
  }

  private transformUsageRecord(record: any): UsageRecord {
    return {
      id: record.id,
      workspaceId: record.workspace_id,
      subscriptionId: record.subscription_id,
      metricName: record.metric_name,
      quantity: Number(record.quantity),
      unitPrice: record.unit_price ? Number(record.unit_price) : null,
      totalAmount: record.total_amount ? Number(record.total_amount) : null,
      periodStart: new Date(record.period_start),
      periodEnd: new Date(record.period_end),
      stripeUsageRecordId: record.stripe_usage_record_id,
    }
  }

  private createError(message: string, code?: string, statusCode?: number): BillingError {
    const error = new Error(message) as BillingError
    error.code = code
    error.statusCode = statusCode
    return error
  }

  private handleError(error: any): BillingError {
    if (error instanceof Error) {
      const billingError = error as BillingError
      if (error.name === 'StripeError') {
        billingError.stripeError = error as Stripe.StripeError
        billingError.code = (error as any).code
        billingError.statusCode = (error as any).statusCode
      }
      return billingError
    }
    return this.createError('An unexpected error occurred', 'UNKNOWN_ERROR', 500)
  }
}

// ==================== Utility Functions ====================

/**
 * Format price for display
 */
export function formatPrice(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Format billing period
 */
export function formatBillingPeriod(start: Date, end: Date): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  return `${formatter.format(start)} - ${formatter.format(end)}`
}

/**
 * Calculate proration amount
 */
export function calculateProration({
  oldPrice,
  newPrice,
  daysRemaining,
  daysInPeriod,
}: {
  oldPrice: number
  newPrice: number
  daysRemaining: number
  daysInPeriod: number
}): number {
  const dailyOldPrice = oldPrice / daysInPeriod
  const dailyNewPrice = newPrice / daysInPeriod
  const credit = dailyOldPrice * daysRemaining
  const charge = dailyNewPrice * daysRemaining
  return charge - credit
}

/**
 * Get trial end date
 */
export function getTrialEndDate(trialDays: number): Date {
  const date = new Date()
  date.setDate(date.getDate() + trialDays)
  return date
}

/**
 * Check if subscription is in trial
 */
export function isInTrial(subscription: Subscription): boolean {
  return subscription.status === 'trialing' && 
    subscription.trialEnd !== null && 
    subscription.trialEnd > new Date()
}

/**
 * Get days until trial ends
 */
export function getDaysUntilTrialEnd(subscription: Subscription): number | null {
  if (!isInTrial(subscription) || !subscription.trialEnd) return null
  
  const now = new Date()
  const diffTime = subscription.trialEnd.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return Math.max(0, diffDays)
}

/**
 * Validate payment method
 */
export function validatePaymentMethod(paymentMethod: PaymentMethod): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  // Check expiration
  if (paymentMethod.expYear && paymentMethod.expMonth) {
    if (
      paymentMethod.expYear < currentYear ||
      (paymentMethod.expYear === currentYear && paymentMethod.expMonth < currentMonth)
    ) {
      errors.push('Payment method has expired')
    }
  }

  // Additional validation based on type
  if (paymentMethod.type === 'card' && !paymentMethod.last4) {
    errors.push('Invalid card details')
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Get usage percentage
 */
export function getUsagePercentage(used: number, limit: number | null): number | null {
  if (!limit || limit === 0) return null
  return Math.min(100, (used / limit) * 100)
}

/**
 * Format usage with units
 */
export function formatUsage(
  metricName: string,
  quantity: number,
  includeUnit = true
): string {
  const units: Record<string, string> = {
    emails_sent: 'emails',
    leads_enriched: 'leads',
    ai_tokens: 'tokens',
  }

  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(quantity)

  if (includeUnit) {
    return `${formatted} ${units[metricName] || metricName}`
  }

  return formatted
}

// Export singleton instance
export const stripeBillingService = new StripeBillingService()

// Export StripeService as an alias for backward compatibility
export const StripeService = StripeBillingService