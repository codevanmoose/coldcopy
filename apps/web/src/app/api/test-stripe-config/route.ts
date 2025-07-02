import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY
    const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET

    // Check if keys are configured
    if (!stripeSecretKey || !stripePublishableKey) {
      return NextResponse.json({
        error: 'Missing Stripe environment variables',
        config: {
          secret_key: !!stripeSecretKey,
          publishable_key: !!stripePublishableKey,
          webhook_secret: !!stripeWebhookSecret,
        }
      }, { status: 500 })
    }

    // Determine if using test or live keys
    const isTestMode = stripeSecretKey.startsWith('sk_test_')
    const publishableIsTest = stripePublishableKey.startsWith('pk_test_')

    // Basic validation
    const keysMatch = (isTestMode && publishableIsTest) || (!isTestMode && !publishableIsTest)

    return NextResponse.json({
      status: 'Stripe Configuration Check',
      config: {
        secret_key_configured: !!stripeSecretKey,
        publishable_key_configured: !!stripePublishableKey,
        webhook_secret_configured: !!stripeWebhookSecret,
        mode: isTestMode ? 'test' : 'live',
        keys_match: keysMatch,
        secret_key_preview: stripeSecretKey?.substring(0, 10) + '...',
        publishable_key_preview: stripePublishableKey?.substring(0, 10) + '...',
      },
      message: isTestMode ? 
        '⚠️ Stripe is configured with TEST keys. Replace with LIVE keys for production.' :
        '✅ Stripe is configured with LIVE keys for production.',
      warnings: !keysMatch ? ['Secret and publishable keys do not match (one is test, one is live)'] : []
    })
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to check Stripe configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}