import * as Sentry from '@sentry/nextjs'
import { User } from '@supabase/supabase-js'

/**
 * Set user context in Sentry for better error tracking
 */
export function setSentryUser(user: User | null) {
  if (user) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.user_metadata?.full_name || user.email?.split('@')[0],
    })
  } else {
    Sentry.setUser(null)
  }
}

/**
 * Track custom events in Sentry
 */
export function trackSentryEvent(eventName: string, data?: Record<string, any>) {
  Sentry.addBreadcrumb({
    message: eventName,
    category: 'custom',
    level: 'info',
    data,
    timestamp: Date.now() / 1000,
  })
}

/**
 * Capture exception with additional context
 */
export function captureException(
  error: Error,
  context?: {
    tags?: Record<string, string>
    extra?: Record<string, any>
    level?: Sentry.SeverityLevel
    user?: User
  }
) {
  Sentry.withScope((scope) => {
    if (context?.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        scope.setTag(key, value)
      })
    }

    if (context?.extra) {
      Object.entries(context.extra).forEach(([key, value]) => {
        scope.setExtra(key, value)
      })
    }

    if (context?.level) {
      scope.setLevel(context.level)
    }

    if (context?.user) {
      setSentryUser(context.user)
    }

    Sentry.captureException(error)
  })
}

/**
 * Track API errors with consistent formatting
 */
export function captureAPIError(
  endpoint: string,
  error: any,
  requestData?: any
) {
  const apiError = new Error(`API Error: ${endpoint}`)
  
  captureException(apiError, {
    tags: {
      type: 'api_error',
      endpoint,
      status: error.status || 'unknown',
    },
    extra: {
      message: error.message,
      response: error.response,
      requestData: sanitizeData(requestData),
    },
    level: error.status >= 500 ? 'error' : 'warning',
  })
}

/**
 * Track performance metrics
 */
export function trackPerformance(
  operation: string,
  duration: number,
  tags?: Record<string, string>
) {
  // Only track in production to avoid noise
  if (process.env.NODE_ENV !== 'production') return

  // Use breadcrumb for performance tracking instead of transactions
  Sentry.addBreadcrumb({
    message: `Performance: ${operation}`,
    category: 'performance',
    level: 'info',
    data: {
      duration_ms: duration,
      ...tags,
    },
    timestamp: Date.now() / 1000,
  })
}

/**
 * Sanitize sensitive data before sending to Sentry
 */
function sanitizeData(data: any): any {
  if (!data) return data

  const sensitiveKeys = [
    'password',
    'token',
    'api_key',
    'apiKey',
    'secret',
    'authorization',
    'credit_card',
    'creditCard',
    'ssn',
    'email', // Optionally include email
  ]

  if (typeof data === 'object') {
    const sanitized = Array.isArray(data) ? [...data] : { ...data }
    
    Object.keys(sanitized).forEach((key) => {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
        sanitized[key] = '[REDACTED]'
      } else if (typeof sanitized[key] === 'object') {
        sanitized[key] = sanitizeData(sanitized[key])
      }
    })
    
    return sanitized
  }

  return data
}

/**
 * Create a Sentry breadcrumb for monitoring (replacement for deprecated transactions)
 */
export function trackOperation(
  name: string,
  op: string,
  data?: Record<string, any>
) {
  Sentry.addBreadcrumb({
    message: `Operation: ${name}`,
    category: op,
    level: 'info',
    data,
    timestamp: Date.now() / 1000,
  })
}

/**
 * Wrapper for async functions with automatic error capture
 */
export async function withSentry<T>(
  fn: () => Promise<T>,
  context?: Parameters<typeof captureException>[1]
): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    captureException(error as Error, context)
    throw error
  }
}

/**
 * Track business metrics using breadcrumbs (replacement for deprecated metrics API)
 */
export const metrics = {
  // Revenue metrics
  trackRevenue: (amount: number, currency: string = 'USD', plan?: string) => {
    if (process.env.NODE_ENV !== 'production') return
    
    Sentry.addBreadcrumb({
      message: 'Revenue tracked',
      category: 'business',
      level: 'info',
      data: {
        amount,
        currency,
        plan: plan || 'unknown',
      },
      timestamp: Date.now() / 1000,
    })
  },

  // User activity metrics
  trackUserAction: (action: string, metadata?: Record<string, any>) => {
    if (process.env.NODE_ENV !== 'production') return
    
    Sentry.addBreadcrumb({
      message: `User action: ${action}`,
      category: 'user_action',
      level: 'info',
      data: metadata,
      timestamp: Date.now() / 1000,
    })
  },

  // Performance metrics
  trackDuration: (metric: string, duration: number, tags?: Record<string, string>) => {
    if (process.env.NODE_ENV !== 'production') return
    
    Sentry.addBreadcrumb({
      message: `Performance: ${metric}`,
      category: 'performance',
      level: 'info',
      data: {
        duration,
        unit: 'millisecond',
        ...tags,
      },
      timestamp: Date.now() / 1000,
    })
  },

  // Feature usage
  trackFeatureUsage: (feature: string, metadata?: Record<string, any>) => {
    if (process.env.NODE_ENV !== 'production') return
    
    Sentry.addBreadcrumb({
      message: `Feature used: ${feature}`,
      category: 'feature_usage',
      level: 'info',
      data: metadata,
      timestamp: Date.now() / 1000,
    })
  },
}