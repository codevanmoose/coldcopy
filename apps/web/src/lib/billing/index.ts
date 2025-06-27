/**
 * Billing Module
 * 
 * Comprehensive Stripe billing integration for subscription management,
 * payment processing, usage tracking, and customer portal functionality.
 */

// Export main service
export { StripeBillingService, stripeBillingService } from './stripe-service'

// Export all types
export * from './types'

// Export error handling
export * from './errors'

// Export utilities
export * from './utils'

// Re-export commonly used items for convenience
export {
  // Service instance
  stripeBillingService as billingService,
  
  // Core functions from service
  formatPrice,
  formatBillingPeriod,
  calculateProration,
  getTrialEndDate,
  isInTrial,
  getDaysUntilTrialEnd,
  validatePaymentMethod,
  getUsagePercentage,
  formatUsage,
} from './stripe-service'

// Convenience type exports
export type {
  // Main entities
  SubscriptionPlan as Plan,
  Subscription,
  PaymentMethod,
  Invoice,
  UsageRecord,
  
  // Enums as types
  SubscriptionStatus,
  PaymentMethodType,
  InvoiceStatus,
  UsageMetric,
  BillingInterval,
  
  // Request/Response types
  CreateSubscriptionRequest,
  CreateSubscriptionResponse,
  UpdateSubscriptionRequest,
  CancelSubscriptionRequest,
  AddPaymentMethodRequest,
  ReportUsageRequest,
  CreatePortalSessionRequest,
  CreatePortalSessionResponse,
  
  // Summary types
  UsageSummary,
  BillingSummary,
  
  // Error types
  BillingError,
  BillingErrorCode,
} from './types'

// Convenience error exports
export {
  BillingServiceError,
  BillingErrors,
  handleStripeError,
  formatErrorResponse,
  isBillingError,
  isRetryableError,
  getUserFriendlyMessage,
} from './errors'

// Convenience utility exports
export {
  Currency,
  Period,
  SubscriptionUtils,
  PaymentMethodUtils,
  UsageUtils,
  InvoiceUtils,
  PlanUtils,
  Validation,
  Analytics,
  retry,
  processBatch,
} from './utils'