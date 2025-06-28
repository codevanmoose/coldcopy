import * as Sentry from '@sentry/nextjs';
import { captureException } from '@sentry/nextjs';

interface ErrorContext {
  userId?: string;
  workspaceId?: string;
  feature?: string;
  action?: string;
  metadata?: Record<string, any>;
}

export class ErrorTracker {
  /**
   * Initialize Sentry error tracking
   */
  static init() {
    if (typeof window === 'undefined') {
      // Server-side initialization
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV,
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
        beforeSend(event) {
          // Filter out non-critical errors in production
          if (process.env.NODE_ENV === 'production') {
            // Don't send cancelled requests
            if (event.exception?.values?.[0]?.value?.includes('AbortError')) {
              return null;
            }
            
            // Don't send known browser extension errors
            if (event.exception?.values?.[0]?.value?.includes('extension')) {
              return null;
            }
          }
          
          return event;
        },
      });
    } else {
      // Client-side initialization
      Sentry.init({
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
        environment: process.env.NODE_ENV,
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
        integrations: [
          new Sentry.BrowserTracing({
            // Performance monitoring
            tracingOrigins: [
              'localhost',
              process.env.NEXT_PUBLIC_APP_URL || '',
              /^\//,
            ],
          }),
        ],
        beforeSend(event) {
          // Client-side filtering
          if (process.env.NODE_ENV === 'production') {
            // Don't send script loading errors
            if (event.exception?.values?.[0]?.value?.includes('Loading chunk')) {
              return null;
            }
            
            // Don't send network errors from ad blockers
            if (event.exception?.values?.[0]?.value?.includes('ERR_BLOCKED_BY_CLIENT')) {
              return null;
            }
          }
          
          return event;
        },
      });
    }
  }

  /**
   * Capture an error with context
   */
  static captureError(error: Error, context?: ErrorContext) {
    Sentry.withScope((scope) => {
      // Set user context
      if (context?.userId) {
        scope.setUser({ id: context.userId });
      }

      // Set tags
      if (context?.workspaceId) {
        scope.setTag('workspace_id', context.workspaceId);
      }
      
      if (context?.feature) {
        scope.setTag('feature', context.feature);
      }
      
      if (context?.action) {
        scope.setTag('action', context.action);
      }

      // Set extra context
      if (context?.metadata) {
        scope.setContext('metadata', context.metadata);
      }

      // Capture the exception
      captureException(error);
    });

    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error captured:', error, context);
    }
  }

  /**
   * Capture a message with severity
   */
  static captureMessage(
    message: string, 
    level: 'info' | 'warning' | 'error' | 'fatal' = 'info',
    context?: ErrorContext
  ) {
    Sentry.withScope((scope) => {
      scope.setLevel(level);
      
      if (context?.userId) {
        scope.setUser({ id: context.userId });
      }
      
      if (context?.workspaceId) {
        scope.setTag('workspace_id', context.workspaceId);
      }
      
      if (context?.feature) {
        scope.setTag('feature', context.feature);
      }
      
      if (context?.metadata) {
        scope.setContext('metadata', context.metadata);
      }

      Sentry.captureMessage(message);
    });
  }

  /**
   * Set user context for all subsequent events
   */
  static setUser(user: { id: string; email?: string; workspaceId?: string }) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      workspace_id: user.workspaceId,
    });
  }

  /**
   * Clear user context
   */
  static clearUser() {
    Sentry.setUser(null);
  }

  /**
   * Start a performance transaction
   */
  static startTransaction(name: string, operation: string) {
    return Sentry.startTransaction({
      name,
      op: operation,
    });
  }

  /**
   * Add breadcrumb for debugging
   */
  static addBreadcrumb(
    message: string,
    category: string,
    level: 'info' | 'warning' | 'error' = 'info',
    data?: Record<string, any>
  ) {
    Sentry.addBreadcrumb({
      message,
      category,
      level,
      data,
    });
  }
}

/**
 * Error handler for API routes
 */
export function withErrorHandling<T extends any[], R>(
  handler: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R> => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof Error) {
        ErrorTracker.captureError(error, {
          feature: 'api',
          action: 'request_handler',
          metadata: {
            args: args.length,
          },
        });
      }
      throw error;
    }
  };
}

/**
 * Error boundary component for React
 */
export class ErrorBoundary extends Error {
  constructor(
    message: string,
    public readonly component: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'ErrorBoundary';
  }
}

/**
 * Database error handler
 */
export function handleDatabaseError(error: any, operation: string, table?: string) {
  const context: ErrorContext = {
    feature: 'database',
    action: operation,
    metadata: {
      table,
      errorCode: error?.code,
      errorMessage: error?.message,
    },
  };

  // Categorize database errors
  if (error?.code === '23505') {
    // Unique constraint violation
    context.metadata!.errorType = 'unique_constraint';
  } else if (error?.code === '23503') {
    // Foreign key constraint violation
    context.metadata!.errorType = 'foreign_key_constraint';
  } else if (error?.code === '42P01') {
    // Table does not exist
    context.metadata!.errorType = 'table_not_found';
  } else if (error?.code === '42703') {
    // Column does not exist
    context.metadata!.errorType = 'column_not_found';
  } else {
    context.metadata!.errorType = 'unknown_database_error';
  }

  ErrorTracker.captureError(error, context);
}

/**
 * API error handler
 */
export function handleApiError(
  error: any,
  endpoint: string,
  method: string,
  userId?: string,
  workspaceId?: string
) {
  const context: ErrorContext = {
    userId,
    workspaceId,
    feature: 'api',
    action: `${method} ${endpoint}`,
    metadata: {
      endpoint,
      method,
      statusCode: error?.status || error?.statusCode,
      errorMessage: error?.message,
    },
  };

  ErrorTracker.captureError(error, context);
}

/**
 * Business logic error handler
 */
export function handleBusinessError(
  error: any,
  feature: string,
  action: string,
  userId?: string,
  workspaceId?: string
) {
  const context: ErrorContext = {
    userId,
    workspaceId,
    feature,
    action,
    metadata: {
      errorType: 'business_logic',
      errorMessage: error?.message,
    },
  };

  ErrorTracker.captureError(error, context);
}

/**
 * Integration error handler (for external APIs)
 */
export function handleIntegrationError(
  error: any,
  integration: string,
  operation: string,
  userId?: string,
  workspaceId?: string
) {
  const context: ErrorContext = {
    userId,
    workspaceId,
    feature: 'integration',
    action: `${integration}_${operation}`,
    metadata: {
      integration,
      operation,
      statusCode: error?.status || error?.statusCode,
      errorMessage: error?.message,
      responseData: error?.response?.data,
    },
  };

  ErrorTracker.captureError(error, context);
}

/**
 * Rate limiting error handler
 */
export function handleRateLimitError(
  endpoint: string,
  limit: number,
  window: number,
  userId?: string,
  workspaceId?: string
) {
  const context: ErrorContext = {
    userId,
    workspaceId,
    feature: 'rate_limiting',
    action: 'limit_exceeded',
    metadata: {
      endpoint,
      limit,
      window,
    },
  };

  ErrorTracker.captureMessage(
    `Rate limit exceeded for ${endpoint}`,
    'warning',
    context
  );
}

/**
 * Security event handler
 */
export function handleSecurityEvent(
  event: string,
  severity: 'info' | 'warning' | 'error' | 'fatal',
  metadata: Record<string, any>,
  userId?: string
) {
  const context: ErrorContext = {
    userId,
    feature: 'security',
    action: event,
    metadata,
  };

  ErrorTracker.captureMessage(
    `Security event: ${event}`,
    severity,
    context
  );
}

// Initialize Sentry on module load
ErrorTracker.init();