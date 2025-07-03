# Stripe Code Configuration Checklist

## Files to Update When Switching to Production

### 1. Environment Variables
**File**: `.env.local` (local) and Vercel Dashboard (production)
```env
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 2. Stripe Configuration
**File**: `/apps/web/src/lib/stripe/config.ts`
```typescript
// Update price IDs from test to production
export const STRIPE_PRICE_IDS = {
  free: 'price_live_...',
  starter: 'price_live_...',
  professional: 'price_live_...',
  enterprise: 'price_live_...'
}

// Update product IDs if using them
export const STRIPE_PRODUCT_IDS = {
  free: 'prod_live_...',
  starter: 'prod_live_...',
  professional: 'prod_live_...',
  enterprise: 'prod_live_...'
}
```

### 3. Webhook Handler
**File**: `/apps/web/src/app/api/stripe/webhook/route.ts`
- No code changes needed
- Just ensure webhook secret is updated in env vars

### 4. Checkout Session
**File**: `/apps/web/src/app/api/stripe/create-checkout-session/route.ts`
- Verify success/cancel URLs use production domain
- Check metadata includes all necessary fields

### 5. Customer Portal
**File**: `/apps/web/src/app/api/stripe/create-portal-session/route.ts`
- Verify return URL uses production domain

### 6. Subscription Management
**File**: `/apps/web/src/lib/stripe/subscriptions.ts`
- Review subscription status handling
- Ensure grace period logic is correct

## Testing Checklist

### Local Testing with Production Keys
```bash
# Set production keys in .env.local
# Run local server
npm run dev

# Test the following:
- [ ] Checkout flow completes
- [ ] Webhook receives events
- [ ] Subscription activates in database
- [ ] Customer portal loads
- [ ] Plan changes work
- [ ] Cancellation works
```

### Production Testing
```bash
# After deployment with production keys
- [ ] Create test account
- [ ] Purchase lowest tier plan
- [ ] Verify email receipts
- [ ] Test customer portal
- [ ] Cancel subscription
- [ ] Verify refund (if applicable)
```

## Database Verification

### Check Subscriptions Table
```sql
-- Verify subscription records
SELECT * FROM subscriptions 
WHERE stripe_subscription_id LIKE 'sub_live_%'
ORDER BY created_at DESC;

-- Check for proper status updates
SELECT status, COUNT(*) 
FROM subscriptions 
WHERE stripe_subscription_id LIKE 'sub_live_%'
GROUP BY status;
```

### Check Payment Methods
```sql
-- Verify payment methods are stored
SELECT * FROM payment_methods
WHERE stripe_payment_method_id LIKE 'pm_live_%';
```

## Monitoring Queries

### Daily Revenue Check
```sql
-- Today's new subscriptions
SELECT COUNT(*), SUM(price) 
FROM subscriptions 
WHERE created_at >= CURRENT_DATE
AND status = 'active';
```

### Failed Payments
```sql
-- Recent failed payments
SELECT * FROM billing_events
WHERE event_type = 'payment_failed'
AND created_at >= CURRENT_DATE - INTERVAL '7 days';
```

## Common Production Issues

### 1. Webhook Signature Validation Fails
```typescript
// Debug webhook signature
console.log('Webhook Secret:', process.env.STRIPE_WEBHOOK_SECRET)
console.log('Signature Header:', request.headers.get('stripe-signature'))
```

### 2. Price ID Mismatch
```typescript
// Add logging to identify mismatches
console.log('Requested Price ID:', priceId)
console.log('Available Price IDs:', STRIPE_PRICE_IDS)
```

### 3. Customer Portal Not Loading
```typescript
// Verify configuration
const configuration = await stripe.billingPortal.configurations.list()
console.log('Portal Configurations:', configuration)
```

## Emergency Procedures

### Rollback to Test Mode
```bash
# In Vercel Dashboard
# 1. Go to Environment Variables
# 2. Update all STRIPE_* variables back to test keys
# 3. Redeploy

# Or via CLI
vercel env pull
# Edit .env.local with test keys
vercel env push
```

### Pause New Subscriptions
```typescript
// Add to checkout endpoint
if (process.env.PAUSE_SUBSCRIPTIONS === 'true') {
  return NextResponse.json(
    { error: 'Subscriptions temporarily unavailable' },
    { status: 503 }
  )
}
```

### Debug Mode
```typescript
// Add to stripe client initialization
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
  telemetry: process.env.NODE_ENV === 'development',
  maxNetworkRetries: 3,
})
```

## Final Review

Before going live:
- [ ] All test transactions are cleared
- [ ] Stripe dashboard is in production mode
- [ ] Team has access to Stripe dashboard
- [ ] Monitoring alerts are configured
- [ ] Support team knows how to handle billing issues
- [ ] Refund policy is documented
- [ ] Terms of service include billing terms

---

*Remember: Test everything in test mode first, then do a small production test before full launch.*