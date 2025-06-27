import { BillingError, BillingErrorCode } from './types'

/**
 * Custom Billing Error Class
 */
export class BillingServiceError extends Error implements BillingError {
  code?: BillingErrorCode
  statusCode?: number
  stripeError?: any
  details?: Record<string, any>

  constructor(
    message: string,
    code?: BillingErrorCode,
    statusCode?: number,
    details?: Record<string, any>
  ) {
    super(message)
    this.name = 'BillingServiceError'
    this.code = code
    this.statusCode = statusCode
    this.details = details
    
    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, BillingServiceError)
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
    }
  }
}

/**
 * Error factory functions
 */
export const BillingErrors = {
  // Subscription errors
  subscriptionNotFound: (subscriptionId: string) =>
    new BillingServiceError(
      `Subscription ${subscriptionId} not found`,
      BillingErrorCode.SUBSCRIPTION_NOT_FOUND,
      404
    ),

  subscriptionAlreadyExists: (workspaceId: string) =>
    new BillingServiceError(
      `Workspace ${workspaceId} already has an active subscription`,
      BillingErrorCode.SUBSCRIPTION_ALREADY_EXISTS,
      409
    ),

  invalidSubscriptionStatus: (status: string) =>
    new BillingServiceError(
      `Invalid subscription status: ${status}`,
      BillingErrorCode.INVALID_SUBSCRIPTION_STATUS,
      400
    ),

  cannotUpdateCanceledSubscription: () =>
    new BillingServiceError(
      'Cannot update a canceled subscription',
      BillingErrorCode.CANNOT_UPDATE_CANCELED_SUBSCRIPTION,
      400
    ),

  // Plan errors
  planNotFound: (planSlug: string) =>
    new BillingServiceError(
      `Plan "${planSlug}" not found`,
      BillingErrorCode.PLAN_NOT_FOUND,
      404
    ),

  invalidPlan: (reason: string) =>
    new BillingServiceError(
      `Invalid plan: ${reason}`,
      BillingErrorCode.INVALID_PLAN,
      400
    ),

  downgradeNotAllowed: (reason: string) =>
    new BillingServiceError(
      `Downgrade not allowed: ${reason}`,
      BillingErrorCode.DOWNGRADE_NOT_ALLOWED,
      400
    ),

  // Payment errors
  paymentMethodNotFound: (paymentMethodId: string) =>
    new BillingServiceError(
      `Payment method ${paymentMethodId} not found`,
      BillingErrorCode.PAYMENT_METHOD_NOT_FOUND,
      404
    ),

  paymentMethodRequired: () =>
    new BillingServiceError(
      'Payment method is required for this operation',
      BillingErrorCode.PAYMENT_METHOD_REQUIRED,
      400
    ),

  paymentFailed: (reason: string) =>
    new BillingServiceError(
      `Payment failed: ${reason}`,
      BillingErrorCode.PAYMENT_FAILED,
      402
    ),

  invalidPaymentMethod: (reason: string) =>
    new BillingServiceError(
      `Invalid payment method: ${reason}`,
      BillingErrorCode.INVALID_PAYMENT_METHOD,
      400
    ),

  cardDeclined: (declineCode?: string) =>
    new BillingServiceError(
      `Card declined${declineCode ? `: ${declineCode}` : ''}`,
      BillingErrorCode.CARD_DECLINED,
      402,
      { declineCode }
    ),

  // Invoice errors
  invoiceNotFound: (invoiceId: string) =>
    new BillingServiceError(
      `Invoice ${invoiceId} not found`,
      BillingErrorCode.INVOICE_NOT_FOUND,
      404
    ),

  invoiceAlreadyPaid: (invoiceId: string) =>
    new BillingServiceError(
      `Invoice ${invoiceId} is already paid`,
      BillingErrorCode.INVOICE_ALREADY_PAID,
      400
    ),

  invalidInvoiceStatus: (status: string) =>
    new BillingServiceError(
      `Invalid invoice status: ${status}`,
      BillingErrorCode.INVALID_INVOICE_STATUS,
      400
    ),

  // Usage errors
  usageLimitExceeded: (metric: string, limit: number, current: number) =>
    new BillingServiceError(
      `Usage limit exceeded for ${metric}: ${current}/${limit}`,
      BillingErrorCode.USAGE_LIMIT_EXCEEDED,
      429,
      { metric, limit, current }
    ),

  invalidUsageMetric: (metric: string) =>
    new BillingServiceError(
      `Invalid usage metric: ${metric}`,
      BillingErrorCode.INVALID_USAGE_METRIC,
      400
    ),

  // Workspace errors
  workspaceNotFound: (workspaceId: string) =>
    new BillingServiceError(
      `Workspace ${workspaceId} not found`,
      BillingErrorCode.WORKSPACE_NOT_FOUND,
      404
    ),

  workspaceSuspended: (workspaceId: string, reason?: string) =>
    new BillingServiceError(
      `Workspace ${workspaceId} is suspended${reason ? `: ${reason}` : ''}`,
      BillingErrorCode.WORKSPACE_SUSPENDED,
      403,
      { reason }
    ),

  // Stripe errors
  stripeApiError: (error: any) =>
    new BillingServiceError(
      error.message || 'Stripe API error',
      BillingErrorCode.STRIPE_API_ERROR,
      error.statusCode || 500,
      { stripeError: error }
    ),

  stripeWebhookError: (error: any) =>
    new BillingServiceError(
      'Stripe webhook error',
      BillingErrorCode.STRIPE_WEBHOOK_ERROR,
      400,
      { stripeError: error }
    ),

  invalidStripeSignature: () =>
    new BillingServiceError(
      'Invalid Stripe webhook signature',
      BillingErrorCode.INVALID_STRIPE_SIGNATURE,
      401
    ),

  // Generic errors
  databaseError: (operation: string, error?: any) =>
    new BillingServiceError(
      `Database error during ${operation}`,
      BillingErrorCode.DATABASE_ERROR,
      500,
      { operation, originalError: error }
    ),

  validationError: (field: string, reason: string) =>
    new BillingServiceError(
      `Validation error for ${field}: ${reason}`,
      BillingErrorCode.VALIDATION_ERROR,
      400,
      { field, reason }
    ),

  unauthorized: (reason?: string) =>
    new BillingServiceError(
      reason || 'Unauthorized',
      BillingErrorCode.UNAUTHORIZED,
      401
    ),

  forbidden: (reason?: string) =>
    new BillingServiceError(
      reason || 'Forbidden',
      BillingErrorCode.FORBIDDEN,
      403
    ),

  unknownError: (error?: any) =>
    new BillingServiceError(
      'An unknown error occurred',
      BillingErrorCode.UNKNOWN_ERROR,
      500,
      { originalError: error }
    ),
}

/**
 * Error handler for Stripe errors
 */
export function handleStripeError(error: any): BillingServiceError {
  if (!error.type) {
    return BillingErrors.stripeApiError(error)
  }

  switch (error.type) {
    case 'StripeCardError':
      // Card errors are the most common type
      switch (error.code) {
        case 'card_declined':
          return BillingErrors.cardDeclined(error.decline_code)
        case 'expired_card':
          return BillingErrors.invalidPaymentMethod('Card has expired')
        case 'incorrect_cvc':
          return BillingErrors.invalidPaymentMethod('Incorrect CVC')
        case 'insufficient_funds':
          return BillingErrors.paymentFailed('Insufficient funds')
        case 'processing_error':
          return BillingErrors.paymentFailed('Processing error')
        default:
          return BillingErrors.paymentFailed(error.message)
      }

    case 'StripeRateLimitError':
      return new BillingServiceError(
        'Too many requests to payment provider',
        BillingErrorCode.STRIPE_API_ERROR,
        429
      )

    case 'StripeInvalidRequestError':
      return new BillingServiceError(
        `Invalid request: ${error.message}`,
        BillingErrorCode.VALIDATION_ERROR,
        400
      )

    case 'StripeAPIError':
      return new BillingServiceError(
        'Payment provider API error',
        BillingErrorCode.STRIPE_API_ERROR,
        500
      )

    case 'StripeConnectionError':
      return new BillingServiceError(
        'Network error connecting to payment provider',
        BillingErrorCode.STRIPE_API_ERROR,
        503
      )

    case 'StripeAuthenticationError':
      return new BillingServiceError(
        'Authentication with payment provider failed',
        BillingErrorCode.STRIPE_API_ERROR,
        401
      )

    default:
      return BillingErrors.stripeApiError(error)
  }
}

/**
 * Error response formatter for API responses
 */
export function formatErrorResponse(error: BillingServiceError) {
  return {
    error: {
      message: error.message,
      code: error.code,
      details: error.details,
    },
    status: error.statusCode || 500,
  }
}

/**
 * Check if error is a specific billing error
 */
export function isBillingError(
  error: any,
  code?: BillingErrorCode
): error is BillingServiceError {
  if (!(error instanceof BillingServiceError)) {
    return false
  }
  if (code) {
    return error.code === code
  }
  return true
}

/**
 * Retry-able error checker
 */
export function isRetryableError(error: any): boolean {
  if (error instanceof BillingServiceError) {
    // Retry on temporary failures
    if (error.statusCode && error.statusCode >= 500) {
      return true
    }
    // Retry on rate limits
    if (error.statusCode === 429) {
      return true
    }
    // Retry on specific error codes
    if (
      error.code === BillingErrorCode.STRIPE_API_ERROR ||
      error.code === BillingErrorCode.DATABASE_ERROR
    ) {
      return true
    }
  }
  return false
}

/**
 * User-friendly error messages
 */
export function getUserFriendlyMessage(error: BillingServiceError): string {
  switch (error.code) {
    case BillingErrorCode.CARD_DECLINED:
      return 'Your card was declined. Please check your card details or try a different payment method.'
    
    case BillingErrorCode.PAYMENT_METHOD_REQUIRED:
      return 'Please add a payment method to continue.'
    
    case BillingErrorCode.SUBSCRIPTION_ALREADY_EXISTS:
      return 'You already have an active subscription.'
    
    case BillingErrorCode.USAGE_LIMIT_EXCEEDED:
      return 'You have exceeded your usage limit. Please upgrade your plan to continue.'
    
    case BillingErrorCode.PAYMENT_FAILED:
      return 'Payment failed. Please check your payment method and try again.'
    
    case BillingErrorCode.INVALID_PAYMENT_METHOD:
      return 'The payment method is invalid or has expired. Please update your payment information.'
    
    case BillingErrorCode.WORKSPACE_SUSPENDED:
      return 'Your workspace has been suspended. Please contact support for assistance.'
    
    case BillingErrorCode.DOWNGRADE_NOT_ALLOWED:
      return 'You cannot downgrade to this plan due to current usage. Please contact support.'
    
    case BillingErrorCode.TRIAL_ENDED:
      return 'Your trial has ended. Please subscribe to continue using the service.'
    
    case BillingErrorCode.INVOICE_OVERDUE:
      return 'You have an overdue invoice. Please make a payment to continue.'
    
    default:
      return error.message || 'An error occurred. Please try again or contact support.'
  }
}

/**
 * Log billing errors with context
 */
export function logBillingError(
  error: BillingServiceError,
  context?: Record<string, any>
): void {
  const errorLog = {
    timestamp: new Date().toISOString(),
    error: {
      name: error.name,
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      stack: error.stack,
      details: error.details,
    },
    context,
  }

  // In production, send to error tracking service
  if (process.env.NODE_ENV === 'production') {
    // Send to Sentry, LogRocket, etc.
    console.error('[BillingError]', JSON.stringify(errorLog))
  } else {
    console.error('[BillingError]', errorLog)
  }
}