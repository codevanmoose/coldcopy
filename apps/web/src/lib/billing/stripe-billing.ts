'use client'

import Stripe from 'stripe'

export interface StripeConfig {
  secretKey: string
  webhookSecret: string
}

export interface UsageRecord {
  subscriptionItemId: string
  quantity: number
  timestamp: number
  action?: 'increment' | 'set'
}

export interface BillingMetric {
  metricType: 'ai_tokens' | 'emails_sent' | 'leads_enriched'
  stripeMeterId: string
  subscriptionItemId?: string
}

export class StripeBillingService {
  private stripe: Stripe
  private webhookSecret: string

  constructor(config: StripeConfig) {
    this.stripe = new Stripe(config.secretKey, {
      apiVersion: '2023-10-16'
    })
    this.webhookSecret = config.webhookSecret
  }

  // Create a customer in Stripe
  async createCustomer(params: {
    email: string
    name: string
    workspaceId: string
    metadata?: Record<string, string>
  }): Promise<Stripe.Customer> {
    return this.stripe.customers.create({
      email: params.email,
      name: params.name,
      metadata: {
        workspace_id: params.workspaceId,
        ...params.metadata
      }
    })
  }

  // Create a subscription with usage-based pricing
  async createUsageBasedSubscription(params: {
    customerId: string
    priceIds: string[] // Array of Stripe price IDs for different metrics
    billingCycleAnchor?: number
    metadata?: Record<string, string>
  }): Promise<Stripe.Subscription> {
    const items = params.priceIds.map(priceId => ({
      price: priceId
    }))

    return this.stripe.subscriptions.create({
      customer: params.customerId,
      items,
      billing_cycle_anchor: params.billingCycleAnchor,
      proration_behavior: 'create_prorations',
      collection_method: 'charge_automatically',
      metadata: params.metadata
    })
  }

  // Record usage for a specific metric
  async recordUsage(params: {
    subscriptionItemId: string
    quantity: number
    timestamp?: number
    action?: 'increment' | 'set'
    idempotencyKey?: string
  }): Promise<Stripe.UsageRecord> {
    const usageRecord: Stripe.UsageRecordCreateParams = {
      quantity: params.quantity,
      timestamp: params.timestamp || Math.floor(Date.now() / 1000),
      action: params.action || 'increment'
    }

    const requestOptions: Stripe.RequestOptions = {}
    if (params.idempotencyKey) {
      requestOptions.idempotencyKey = params.idempotencyKey
    }

    return this.stripe.subscriptionItems.createUsageRecord(
      params.subscriptionItemId,
      usageRecord,
      requestOptions
    )
  }

  // Batch record multiple usage records
  async batchRecordUsage(records: UsageRecord[]): Promise<{
    successful: number
    failed: number
    errors: Array<{ record: UsageRecord; error: string }>
  }> {
    const results = {
      successful: 0,
      failed: 0,
      errors: [] as Array<{ record: UsageRecord; error: string }>
    }

    const promises = records.map(async (record) => {
      try {
        await this.recordUsage({
          subscriptionItemId: record.subscriptionItemId,
          quantity: record.quantity,
          timestamp: record.timestamp,
          action: record.action,
          idempotencyKey: `${record.subscriptionItemId}-${record.timestamp}-${record.quantity}`
        })
        results.successful++
      } catch (error: any) {
        results.failed++
        results.errors.push({
          record,
          error: error.message || 'Unknown error'
        })
      }
    })

    await Promise.allSettled(promises)
    return results
  }

  // Get usage summary for a subscription
  async getUsageSummary(params: {
    subscriptionItemId: string
    startDate: Date
    endDate: Date
    granularity?: 'daily' | 'monthly'
  }): Promise<Stripe.UsageRecordSummary[]> {
    const summaries = await this.stripe.subscriptionItems.listUsageRecordSummaries(
      params.subscriptionItemId,
      {
        starting_after: Math.floor(params.startDate.getTime() / 1000),
        ending_before: Math.floor(params.endDate.getTime() / 1000),
        granularity: params.granularity || 'daily'
      }
    )

    return summaries.data
  }

  // Get current subscription for customer
  async getActiveSubscription(customerId: string): Promise<Stripe.Subscription | null> {
    const subscriptions = await this.stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1
    })

    return subscriptions.data[0] || null
  }

  // Update subscription with new pricing or items
  async updateSubscription(params: {
    subscriptionId: string
    priceIds?: string[]
    metadata?: Record<string, string>
    prorationBehavior?: 'create_prorations' | 'none' | 'always_invoice'
  }): Promise<Stripe.Subscription> {
    const updateParams: Stripe.SubscriptionUpdateParams = {
      proration_behavior: params.prorationBehavior || 'create_prorations'
    }

    if (params.priceIds) {
      updateParams.items = params.priceIds.map(priceId => ({
        price: priceId
      }))
    }

    if (params.metadata) {
      updateParams.metadata = params.metadata
    }

    return this.stripe.subscriptions.update(params.subscriptionId, updateParams)
  }

  // Create a billing portal session
  async createBillingPortalSession(params: {
    customerId: string
    returnUrl: string
  }): Promise<Stripe.BillingPortal.Session> {
    return this.stripe.billingPortal.sessions.create({
      customer: params.customerId,
      return_url: params.returnUrl
    })
  }

  // Handle webhook events
  async handleWebhook(
    payload: string | Buffer,
    signature: string
  ): Promise<{
    event: Stripe.Event
    handled: boolean
    error?: string
  }> {
    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.webhookSecret
      )

      let handled = false

      switch (event.type) {
        case 'invoice.payment_succeeded':
          handled = await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice)
          break
        case 'invoice.payment_failed':
          handled = await this.handlePaymentFailed(event.data.object as Stripe.Invoice)
          break
        case 'customer.subscription.updated':
          handled = await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
          break
        case 'customer.subscription.deleted':
          handled = await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
          break
        default:
          console.log(`Unhandled event type: ${event.type}`)
      }

      return { event, handled }
    } catch (error: any) {
      return {
        event: {} as Stripe.Event,
        handled: false,
        error: error.message
      }
    }
  }

  // Webhook handlers
  private async handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<boolean> {
    console.log('Payment succeeded for invoice:', invoice.id)
    // Update subscription status in database
    // Send confirmation email
    return true
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<boolean> {
    console.log('Payment failed for invoice:', invoice.id)
    // Update subscription status
    // Send payment failure notification
    // Potentially restrict access
    return true
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<boolean> {
    console.log('Subscription updated:', subscription.id)
    // Update subscription details in database
    return true
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<boolean> {
    console.log('Subscription deleted:', subscription.id)
    // Handle subscription cancellation
    // Update workspace status
    return true
  }

  // Get upcoming invoice preview
  async getUpcomingInvoice(customerId: string): Promise<Stripe.Invoice> {
    return this.stripe.invoices.retrieveUpcoming({
      customer: customerId
    })
  }

  // Calculate estimated cost for usage
  async calculateEstimatedCost(params: {
    customerId: string
    usageRecords: Array<{
      subscriptionItemId: string
      quantity: number
    }>
  }): Promise<{
    subtotal: number
    tax: number
    total: number
    currency: string
  }> {
    // Create a preview invoice with the usage
    const invoice = await this.stripe.invoices.create({
      customer: params.customerId,
      collection_method: 'send_invoice',
      days_until_due: 1,
      auto_advance: false
    })

    // Add usage records to invoice
    for (const usage of params.usageRecords) {
      await this.stripe.invoiceItems.create({
        customer: params.customerId,
        invoice: invoice.id,
        quantity: usage.quantity,
        subscription_item: usage.subscriptionItemId
      })
    }

    // Finalize the invoice to calculate totals
    const finalizedInvoice = await this.stripe.invoices.finalizeInvoice(invoice.id)

    // Delete the preview invoice
    await this.stripe.invoices.del(invoice.id)

    return {
      subtotal: finalizedInvoice.subtotal / 100,
      tax: finalizedInvoice.tax || 0 / 100,
      total: finalizedInvoice.total / 100,
      currency: finalizedInvoice.currency
    }
  }

  // Retrieve all prices for usage-based billing
  async getUsageBasedPrices(): Promise<Stripe.Price[]> {
    const prices = await this.stripe.prices.list({
      type: 'usage_based',
      active: true,
      limit: 100
    })

    return prices.data
  }

  // Create a new usage-based price
  async createUsagePrice(params: {
    productId: string
    unitAmount: number
    currency: string
    billingScheme: 'per_unit' | 'tiered'
    usageType: 'metered' | 'licensed'
    aggregateUsage?: 'sum' | 'last_during_period' | 'last_ever' | 'max'
    nickname?: string
    metadata?: Record<string, string>
  }): Promise<Stripe.Price> {
    return this.stripe.prices.create({
      product: params.productId,
      unit_amount: params.unitAmount,
      currency: params.currency,
      recurring: {
        interval: 'month',
        usage_type: params.usageType,
        aggregate_usage: params.aggregateUsage
      },
      billing_scheme: params.billingScheme,
      nickname: params.nickname,
      metadata: params.metadata
    })
  }
}

// Export singleton instance
export const stripeBilling = new StripeBillingService({
  secretKey: process.env.STRIPE_SECRET_KEY!,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!
})