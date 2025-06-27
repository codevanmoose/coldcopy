/**
 * Billing Types
 * Central type definitions for all billing-related entities
 */

// ==================== Enums ====================

export enum SubscriptionStatus {
  TRIALING = 'trialing',
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  CANCELED = 'canceled',
  UNPAID = 'unpaid',
}

export enum PaymentMethodType {
  CARD = 'card',
  BANK_ACCOUNT = 'bank_account',
}

export enum InvoiceStatus {
  DRAFT = 'draft',
  OPEN = 'open',
  PAID = 'paid',
  VOID = 'void',
  UNCOLLECTIBLE = 'uncollectible',
}

export enum BillingEventType {
  SUBSCRIPTION_CREATED = 'subscription.created',
  SUBSCRIPTION_UPDATED = 'subscription.updated',
  SUBSCRIPTION_DELETED = 'subscription.deleted',
  SUBSCRIPTION_TRIAL_WILL_END = 'subscription.trial_will_end',
  INVOICE_CREATED = 'invoice.created',
  INVOICE_PAYMENT_SUCCEEDED = 'invoice.payment_succeeded',
  INVOICE_PAYMENT_FAILED = 'invoice.payment_failed',
  PAYMENT_METHOD_ATTACHED = 'payment_method.attached',
  PAYMENT_METHOD_DETACHED = 'payment_method.detached',
  PAYMENT_METHOD_UPDATED = 'payment_method.updated',
  CUSTOMER_CREATED = 'customer.created',
  CUSTOMER_UPDATED = 'customer.updated',
  USAGE_RECORD_CREATED = 'usage_record.created',
}

export enum UsageMetric {
  EMAILS_SENT = 'emails_sent',
  LEADS_ENRICHED = 'leads_enriched',
  AI_TOKENS = 'ai_tokens',
}

export enum BillingInterval {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

// ==================== Core Entities ====================

export interface SubscriptionPlan {
  id: string
  name: string
  slug: string
  description: string | null
  priceMonthly: number
  priceYearly: number
  currency: string
  features: string[]
  limits: PlanLimits
  isActive: boolean
  isPopular: boolean
  displayOrder: number
  stripePriceIdMonthly?: string
  stripePriceIdYearly?: string
  stripeProductId?: string
  createdAt: Date
  updatedAt: Date
}

export interface PlanLimits {
  emails_sent: number | null
  leads_enriched: number | null
  ai_tokens: number | null
  [key: string]: number | null // Allow for future metrics
}

export interface Subscription {
  id: string
  workspaceId: string
  planId: string
  plan?: SubscriptionPlan
  stripeSubscriptionId: string | null
  status: SubscriptionStatus
  currentPeriodStart: Date | null
  currentPeriodEnd: Date | null
  trialStart: Date | null
  trialEnd: Date | null
  canceledAt: Date | null
  cancelAtPeriodEnd: boolean
  paymentMethodId: string | null
  stripeCustomerId: string | null
  createdAt: Date
  updatedAt: Date
}

export interface PaymentMethod {
  id: string
  workspaceId: string
  stripePaymentMethodId: string
  type: PaymentMethodType
  last4: string | null
  brand: string | null
  expMonth: number | null
  expYear: number | null
  isDefault: boolean
  billingDetails: BillingDetails
  createdAt: Date
  updatedAt: Date
}

export interface BillingDetails {
  name?: string | null
  email?: string | null
  phone?: string | null
  address?: {
    line1?: string | null
    line2?: string | null
    city?: string | null
    state?: string | null
    postal_code?: string | null
    country?: string | null
  } | null
}

export interface Invoice {
  id: string
  workspaceId: string
  subscriptionId: string | null
  subscription?: Subscription
  stripeInvoiceId: string | null
  invoiceNumber: string
  amountDue: number
  amountPaid: number
  amountRemaining: number
  currency: string
  status: InvoiceStatus
  dueDate: Date | null
  paidAt: Date | null
  attemptCount: number
  invoicePdf: string | null
  hostedInvoiceUrl: string | null
  lineItems: InvoiceLineItem[]
  metadata: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export interface InvoiceLineItem {
  id: string
  description: string | null
  amount: number
  quantity: number
  unitAmount: number | null
  currency: string
  proration: boolean
  period?: {
    start: Date
    end: Date
  }
  metadata?: Record<string, any>
}

export interface UsageRecord {
  id: string
  workspaceId: string
  subscriptionId: string | null
  metricName: UsageMetric
  quantity: number
  unitPrice: number | null
  totalAmount: number | null
  periodStart: Date
  periodEnd: Date
  stripeUsageRecordId: string | null
  metadata?: Record<string, any>
  createdAt: Date
}

export interface BillingEvent {
  id: string
  workspaceId: string | null
  eventType: BillingEventType
  stripeEventId: string | null
  data: Record<string, any>
  processedAt: Date | null
  error?: string | null
  createdAt: Date
}

// ==================== API Request/Response Types ====================

export interface CreateSubscriptionRequest {
  workspaceId: string
  planSlug: string
  paymentMethodId?: string
  trialDays?: number
  isYearly?: boolean
  couponCode?: string
}

export interface CreateSubscriptionResponse {
  subscription: Subscription
  clientSecret?: string
  requiresAction: boolean
}

export interface UpdateSubscriptionRequest {
  subscriptionId: string
  planSlug?: string
  isYearly?: boolean
  paymentMethodId?: string
  prorationBehavior?: 'create_prorations' | 'none' | 'always_invoice'
}

export interface CancelSubscriptionRequest {
  subscriptionId: string
  cancelAtPeriodEnd?: boolean
  reason?: string
  feedback?: string
}

export interface AddPaymentMethodRequest {
  workspaceId: string
  paymentMethodId: string
  setAsDefault?: boolean
}

export interface UpdatePaymentMethodRequest {
  paymentMethodId: string
  billingDetails?: BillingDetails
  setAsDefault?: boolean
}

export interface ReportUsageRequest {
  workspaceId: string
  metricName: UsageMetric
  quantity: number
  timestamp?: Date
  idempotencyKey?: string
  metadata?: Record<string, any>
}

export interface CreatePortalSessionRequest {
  workspaceId: string
  returnUrl: string
  configuration?: string
}

export interface CreatePortalSessionResponse {
  url: string
  expiresAt: Date
}

export interface ListInvoicesRequest {
  workspaceId: string
  status?: InvoiceStatus
  limit?: number
  startingAfter?: string
  endingBefore?: string
}

export interface ListInvoicesResponse {
  invoices: Invoice[]
  hasMore: boolean
  totalCount?: number
}

// ==================== Analytics & Summary Types ====================

export interface UsageSummary {
  period: {
    start: Date
    end: Date
  }
  usage: {
    [K in UsageMetric]: {
      quantity: number
      cost: number
      limit: number | null
      percentageUsed: number | null
    }
  }
  totalCost: number
  projectedCost?: number
}

export interface BillingSummary {
  workspace: {
    id: string
    name: string
  }
  subscription: Subscription | null
  currentPlan: SubscriptionPlan | null
  paymentMethods: PaymentMethod[]
  defaultPaymentMethod: PaymentMethod | null
  upcomingInvoice: Invoice | null
  currentUsage: UsageSummary | null
  credits: number
  balance: number
}

export interface SubscriptionMetrics {
  mrr: number // Monthly Recurring Revenue
  arr: number // Annual Recurring Revenue
  churnRate: number
  retentionRate: number
  averageLifetimeValue: number
  trialConversionRate: number
}

// ==================== Error Types ====================

export interface BillingError extends Error {
  code?: BillingErrorCode
  statusCode?: number
  stripeError?: any
  details?: Record<string, any>
}

export enum BillingErrorCode {
  // Subscription errors
  SUBSCRIPTION_NOT_FOUND = 'SUBSCRIPTION_NOT_FOUND',
  SUBSCRIPTION_ALREADY_EXISTS = 'SUBSCRIPTION_ALREADY_EXISTS',
  INVALID_SUBSCRIPTION_STATUS = 'INVALID_SUBSCRIPTION_STATUS',
  CANNOT_UPDATE_CANCELED_SUBSCRIPTION = 'CANNOT_UPDATE_CANCELED_SUBSCRIPTION',
  
  // Plan errors
  PLAN_NOT_FOUND = 'PLAN_NOT_FOUND',
  INVALID_PLAN = 'INVALID_PLAN',
  DOWNGRADE_NOT_ALLOWED = 'DOWNGRADE_NOT_ALLOWED',
  
  // Payment errors
  PAYMENT_METHOD_NOT_FOUND = 'PAYMENT_METHOD_NOT_FOUND',
  PAYMENT_METHOD_REQUIRED = 'PAYMENT_METHOD_REQUIRED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  INVALID_PAYMENT_METHOD = 'INVALID_PAYMENT_METHOD',
  CARD_DECLINED = 'CARD_DECLINED',
  
  // Invoice errors
  INVOICE_NOT_FOUND = 'INVOICE_NOT_FOUND',
  INVOICE_ALREADY_PAID = 'INVOICE_ALREADY_PAID',
  INVALID_INVOICE_STATUS = 'INVALID_INVOICE_STATUS',
  
  // Usage errors
  USAGE_LIMIT_EXCEEDED = 'USAGE_LIMIT_EXCEEDED',
  INVALID_USAGE_METRIC = 'INVALID_USAGE_METRIC',
  
  // Workspace errors
  WORKSPACE_NOT_FOUND = 'WORKSPACE_NOT_FOUND',
  WORKSPACE_SUSPENDED = 'WORKSPACE_SUSPENDED',
  
  // Stripe errors
  STRIPE_API_ERROR = 'STRIPE_API_ERROR',
  STRIPE_WEBHOOK_ERROR = 'STRIPE_WEBHOOK_ERROR',
  INVALID_STRIPE_SIGNATURE = 'INVALID_STRIPE_SIGNATURE',
  
  // Generic errors
  DATABASE_ERROR = 'DATABASE_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

// ==================== Webhook Types ====================

export interface WebhookEvent {
  id: string
  type: string
  data: {
    object: any
    previous_attributes?: any
  }
  created: number
  livemode: boolean
  pending_webhooks: number
  request: {
    id: string | null
    idempotency_key: string | null
  }
}

export interface WebhookHandlerResult {
  success: boolean
  message?: string
  error?: BillingError
}

// ==================== Configuration Types ====================

export interface BillingConfig {
  stripe: {
    publishableKey: string
    secretKey: string
    webhookSecret: string
    apiVersion: string
  }
  trial: {
    defaultDays: number
    reminderDays: number[]
  }
  usage: {
    reportingInterval: number // in minutes
    alertThresholds: number[] // percentages
  }
  invoice: {
    dueDays: number
    retrySchedule: number[] // days
  }
  portal: {
    features: {
      customerUpdate: boolean
      invoiceHistory: boolean
      paymentMethodUpdate: boolean
      subscriptionCancel: boolean
      subscriptionPause: boolean
      subscriptionUpdate: boolean
    }
  }
}

// ==================== Utility Types ====================

export interface PaginationParams {
  limit?: number
  startingAfter?: string
  endingBefore?: string
}

export interface SortParams {
  field: string
  direction: 'asc' | 'desc'
}

export interface DateRange {
  start: Date
  end: Date
}

export interface Money {
  amount: number
  currency: string
}

// ==================== Feature Flag Types ====================

export interface BillingFeatures {
  subscriptions: boolean
  usageBasedBilling: boolean
  multiCurrency: boolean
  taxCalculation: boolean
  dunning: boolean
  customerPortal: boolean
  webhooks: boolean
  invoicing: boolean
  coupons: boolean
  trials: boolean
}

// ==================== Notification Types ====================

export interface BillingNotification {
  id: string
  workspaceId: string
  type: BillingNotificationType
  title: string
  message: string
  data?: Record<string, any>
  read: boolean
  createdAt: Date
}

export enum BillingNotificationType {
  SUBSCRIPTION_CREATED = 'subscription_created',
  SUBSCRIPTION_UPDATED = 'subscription_updated',
  SUBSCRIPTION_CANCELED = 'subscription_canceled',
  TRIAL_ENDING = 'trial_ending',
  TRIAL_ENDED = 'trial_ended',
  PAYMENT_SUCCEEDED = 'payment_succeeded',
  PAYMENT_FAILED = 'payment_failed',
  PAYMENT_METHOD_EXPIRING = 'payment_method_expiring',
  USAGE_LIMIT_APPROACHING = 'usage_limit_approaching',
  USAGE_LIMIT_EXCEEDED = 'usage_limit_exceeded',
  INVOICE_CREATED = 'invoice_created',
  INVOICE_PAID = 'invoice_paid',
  INVOICE_OVERDUE = 'invoice_overdue',
}