import Stripe from 'stripe'

// Initialize Stripe
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
  typescript: true,
})

export interface CreatePaymentIntentOptions {
  amount: number // in cents
  currency?: string
  metadata?: Record<string, string>
  customerId?: string
  description?: string
}

export async function createPaymentIntent(options: CreatePaymentIntentOptions) {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: options.amount,
      currency: options.currency || 'usd',
      metadata: options.metadata,
      customer: options.customerId,
      description: options.description,
      automatic_payment_methods: {
        enabled: true,
      },
    })

    return {
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    }
  } catch (error) {
    console.error('Stripe payment intent error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create payment intent',
    }
  }
}

export async function createOrUpdateCustomer(
  email: string,
  metadata?: Record<string, string>
) {
  try {
    // Check if customer exists
    const existingCustomers = await stripe.customers.list({
      email,
      limit: 1,
    })

    if (existingCustomers.data.length > 0) {
      // Update existing customer
      const customer = await stripe.customers.update(
        existingCustomers.data[0].id,
        { metadata }
      )
      return { success: true, customerId: customer.id }
    }

    // Create new customer
    const customer = await stripe.customers.create({
      email,
      metadata,
    })

    return { success: true, customerId: customer.id }
  } catch (error) {
    console.error('Stripe customer error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to manage customer',
    }
  }
}

export async function retrievePaymentIntent(paymentIntentId: string) {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
    return { success: true, paymentIntent }
  } catch (error) {
    console.error('Stripe retrieve error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retrieve payment intent',
    }
  }
}

export async function createSetupIntent(customerId: string) {
  try {
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      automatic_payment_methods: {
        enabled: true,
      },
    })

    return {
      success: true,
      clientSecret: setupIntent.client_secret,
      setupIntentId: setupIntent.id,
    }
  } catch (error) {
    console.error('Stripe setup intent error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create setup intent',
    }
  }
}

export async function listPaymentMethods(customerId: string) {
  try {
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    })

    return {
      success: true,
      paymentMethods: paymentMethods.data,
    }
  } catch (error) {
    console.error('Stripe list payment methods error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list payment methods',
    }
  }
}

export async function detachPaymentMethod(paymentMethodId: string) {
  try {
    await stripe.paymentMethods.detach(paymentMethodId)
    return { success: true }
  } catch (error) {
    console.error('Stripe detach payment method error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to detach payment method',
    }
  }
}