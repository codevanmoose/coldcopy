import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripeBillingService } from './stripe-service'
import { BillingErrors, formatErrorResponse, logBillingError } from './errors'
import { WebhookEvent, WebhookHandlerResult } from './types'

/**
 * Stripe Webhook Handler
 * 
 * This module provides a Next.js API route handler for processing
 * Stripe webhook events. It handles signature verification, event
 * processing, and error handling.
 * 
 * Usage:
 * Create an API route at /app/api/webhooks/stripe/route.ts:
 * 
 * ```typescript
 * import { createStripeWebhookHandler } from '@/lib/billing/webhook-handler'
 * 
 * export const POST = createStripeWebhookHandler()
 * ```
 */

/**
 * Create a Stripe webhook handler for Next.js API routes
 */
export function createStripeWebhookHandler(options?: {
  onSuccess?: (event: WebhookEvent) => Promise<void>
  onError?: (error: any, event?: WebhookEvent) => Promise<void>
  enableLogging?: boolean
}) {
  const { onSuccess, onError, enableLogging = true } = options || {}

  return async function POST(request: NextRequest) {
    try {
      // Get the webhook signature from headers
      const signature = headers().get('stripe-signature')
      
      if (!signature) {
        const error = BillingErrors.invalidStripeSignature()
        if (enableLogging) {
          logBillingError(error, { headers: Object.fromEntries(headers()) })
        }
        return NextResponse.json(
          formatErrorResponse(error),
          { status: error.statusCode }
        )
      }

      // Get the raw body
      const body = await request.text()

      // Process the webhook
      try {
        await stripeBillingService.processWebhook(body, signature)

        // Call success callback if provided
        if (onSuccess) {
          try {
            // Parse the event for the callback
            const event = JSON.parse(body) as WebhookEvent
            await onSuccess(event)
          } catch (callbackError) {
            // Log callback errors but don't fail the webhook
            if (enableLogging) {
              console.error('Webhook success callback error:', callbackError)
            }
          }
        }

        return NextResponse.json({ received: true }, { status: 200 })
      } catch (error: any) {
        // Call error callback if provided
        if (onError) {
          try {
            const event = body ? JSON.parse(body) : undefined
            await onError(error, event)
          } catch (callbackError) {
            // Log callback errors
            if (enableLogging) {
              console.error('Webhook error callback error:', callbackError)
            }
          }
        }

        // Log the error
        if (enableLogging) {
          logBillingError(error, {
            signature,
            bodyLength: body.length,
          })
        }

        // Return appropriate error response
        if (error.name === 'StripeSignatureVerificationError') {
          const verificationError = BillingErrors.invalidStripeSignature()
          return NextResponse.json(
            formatErrorResponse(verificationError),
            { status: verificationError.statusCode }
          )
        }

        const webhookError = BillingErrors.stripeWebhookError(error)
        return NextResponse.json(
          formatErrorResponse(webhookError),
          { status: webhookError.statusCode }
        )
      }
    } catch (error: any) {
      // Handle unexpected errors
      if (enableLogging) {
        console.error('Unexpected webhook error:', error)
      }

      const unknownError = BillingErrors.unknownError(error)
      return NextResponse.json(
        formatErrorResponse(unknownError),
        { status: unknownError.statusCode }
      )
    }
  }
}

/**
 * Webhook event handlers for specific event types
 */
export const WebhookHandlers = {
  /**
   * Handle subscription created event
   */
  async onSubscriptionCreated(event: WebhookEvent): Promise<WebhookHandlerResult> {
    try {
      // Custom logic for subscription creation
      console.log('Subscription created:', event.data.object.id)
      
      // Send welcome email, update analytics, etc.
      
      return { success: true }
    } catch (error) {
      return { 
        success: false, 
        error: BillingErrors.unknownError(error) 
      }
    }
  },

  /**
   * Handle subscription updated event
   */
  async onSubscriptionUpdated(event: WebhookEvent): Promise<WebhookHandlerResult> {
    try {
      const subscription = event.data.object
      const previousAttributes = event.data.previous_attributes || {}
      
      // Check for plan changes
      if (previousAttributes.items) {
        console.log('Subscription plan changed:', subscription.id)
        // Handle plan change logic
      }
      
      // Check for status changes
      if (previousAttributes.status) {
        console.log('Subscription status changed:', {
          id: subscription.id,
          from: previousAttributes.status,
          to: subscription.status,
        })
        // Handle status change logic
      }
      
      return { success: true }
    } catch (error) {
      return { 
        success: false, 
        error: BillingErrors.unknownError(error) 
      }
    }
  },

  /**
   * Handle subscription deleted event
   */
  async onSubscriptionDeleted(event: WebhookEvent): Promise<WebhookHandlerResult> {
    try {
      const subscription = event.data.object
      console.log('Subscription deleted:', subscription.id)
      
      // Clean up resources, send cancellation email, etc.
      
      return { success: true }
    } catch (error) {
      return { 
        success: false, 
        error: BillingErrors.unknownError(error) 
      }
    }
  },

  /**
   * Handle trial ending soon event
   */
  async onTrialWillEnd(event: WebhookEvent): Promise<WebhookHandlerResult> {
    try {
      const subscription = event.data.object
      console.log('Trial ending soon:', subscription.id)
      
      // Send trial ending reminder email
      // Create in-app notification
      
      return { success: true }
    } catch (error) {
      return { 
        success: false, 
        error: BillingErrors.unknownError(error) 
      }
    }
  },

  /**
   * Handle payment succeeded event
   */
  async onPaymentSucceeded(event: WebhookEvent): Promise<WebhookHandlerResult> {
    try {
      const invoice = event.data.object
      console.log('Payment succeeded for invoice:', invoice.id)
      
      // Update payment status, send receipt, etc.
      
      return { success: true }
    } catch (error) {
      return { 
        success: false, 
        error: BillingErrors.unknownError(error) 
      }
    }
  },

  /**
   * Handle payment failed event
   */
  async onPaymentFailed(event: WebhookEvent): Promise<WebhookHandlerResult> {
    try {
      const invoice = event.data.object
      console.log('Payment failed for invoice:', invoice.id)
      
      // Send payment failure notification
      // Update subscription status if needed
      // Schedule retry or dunning process
      
      return { success: true }
    } catch (error) {
      return { 
        success: false, 
        error: BillingErrors.unknownError(error) 
      }
    }
  },

  /**
   * Handle customer updated event
   */
  async onCustomerUpdated(event: WebhookEvent): Promise<WebhookHandlerResult> {
    try {
      const customer = event.data.object
      console.log('Customer updated:', customer.id)
      
      // Sync customer data with database
      
      return { success: true }
    } catch (error) {
      return { 
        success: false, 
        error: BillingErrors.unknownError(error) 
      }
    }
  },
}

/**
 * Create a custom webhook handler with specific event handlers
 */
export function createCustomWebhookHandler(
  handlers: Partial<Record<string, (event: WebhookEvent) => Promise<WebhookHandlerResult>>>
) {
  return createStripeWebhookHandler({
    onSuccess: async (event) => {
      const handler = handlers[event.type]
      if (handler) {
        const result = await handler(event)
        if (!result.success && result.error) {
          logBillingError(result.error, { event })
        }
      }
    },
    enableLogging: true,
  })
}

/**
 * Example usage with custom handlers:
 * 
 * ```typescript
 * export const POST = createCustomWebhookHandler({
 *   'customer.subscription.created': WebhookHandlers.onSubscriptionCreated,
 *   'customer.subscription.updated': WebhookHandlers.onSubscriptionUpdated,
 *   'customer.subscription.deleted': WebhookHandlers.onSubscriptionDeleted,
 *   'customer.subscription.trial_will_end': WebhookHandlers.onTrialWillEnd,
 *   'invoice.payment_succeeded': WebhookHandlers.onPaymentSucceeded,
 *   'invoice.payment_failed': WebhookHandlers.onPaymentFailed,
 *   'customer.updated': WebhookHandlers.onCustomerUpdated,
 * })
 * ```
 */

/**
 * Process a Stripe webhook event and return a result
 * This is for internal processing without HTTP response handling
 */
export async function handleBillingWebhook(event: WebhookEvent): Promise<WebhookHandlerResult> {
  try {
    // Process the webhook event based on type
    const handler = WebhookHandlers[event.type as keyof typeof WebhookHandlers]
    if (handler) {
      return await handler(event)
    }
    
    // Log unhandled event types
    console.log(`Unhandled webhook event type: ${event.type}`)
    return { success: true }
  } catch (error: any) {
    return {
      success: false,
      error: BillingErrors.stripeWebhookError(error)
    }
  }
}

/**
 * Webhook testing utilities for development
 */
export const WebhookTesting = {
  /**
   * Create a test webhook event
   */
  createTestEvent(type: string, data: any): WebhookEvent {
    return {
      id: `evt_test_${Date.now()}`,
      type,
      data: {
        object: data,
      },
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      pending_webhooks: 1,
      request: {
        id: null,
        idempotency_key: null,
      },
    }
  },

  /**
   * Test webhook signature (for development only)
   */
  createTestSignature(): string {
    // This is for testing only - in production, signatures must come from Stripe
    return 'test_signature'
  },

  /**
   * Simulate webhook event locally
   */
  async simulateWebhook(
    type: string,
    data: any,
    handler: (event: WebhookEvent) => Promise<WebhookHandlerResult>
  ): Promise<WebhookHandlerResult> {
    const event = this.createTestEvent(type, data)
    return handler(event)
  },
}