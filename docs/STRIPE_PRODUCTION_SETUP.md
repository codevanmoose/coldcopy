# Stripe Production Setup Guide

## Current Status
ColdCopy is currently using **Stripe Test Mode** with test API keys. This guide explains how to switch to production mode when ready to accept real payments.

## Prerequisites
- Verified Stripe account
- Business bank account connected
- Tax information submitted
- Business details verified

## Production Setup Steps

### 1. Get Production API Keys
1. Log into [Stripe Dashboard](https://dashboard.stripe.com)
2. Toggle from "Test mode" to "Production mode" (top right)
3. Go to Developers → API keys
4. Copy your production keys:
   - **Publishable key**: `pk_live_...`
   - **Secret key**: `sk_live_...`

### 2. Set Up Webhook Endpoint
1. In Stripe Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. Enter endpoint URL: `https://coldcopy.cc/api/stripe/webhook`
4. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy the webhook signing secret: `whsec_...`

### 3. Update Environment Variables

#### Local Development (.env.local)
```env
# Replace test keys with production keys
STRIPE_SECRET_KEY=sk_live_YOUR_PRODUCTION_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_PRODUCTION_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SIGNING_SECRET
```

#### Vercel Production
```bash
# Remove old test keys
vercel env rm STRIPE_SECRET_KEY production
vercel env rm NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY production
vercel env rm STRIPE_WEBHOOK_SECRET production

# Add production keys
vercel env add STRIPE_SECRET_KEY production
vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY production
vercel env add STRIPE_WEBHOOK_SECRET production
```

### 4. Update Product and Price IDs

Production products have different IDs than test products. Update these in your code:

#### Create Products in Production
1. Go to Stripe Dashboard → Products
2. Create your subscription products:
   - **Free Plan**: $0/month
   - **Starter Plan**: $29/month
   - **Professional Plan**: $99/month
   - **Enterprise Plan**: $299/month

3. Copy the price IDs for each plan

#### Update Price IDs in Code
Location: `/apps/web/src/lib/stripe/config.ts`

```typescript
export const STRIPE_PRICE_IDS = {
  free: 'price_live_free_plan_id',
  starter: 'price_live_starter_plan_id',
  professional: 'price_live_professional_plan_id',
  enterprise: 'price_live_enterprise_plan_id'
}
```

### 5. Configure Customer Portal
1. Go to Stripe Dashboard → Settings → Billing → Customer portal
2. Configure:
   - Allow customers to cancel subscriptions
   - Allow switching plans
   - Show invoice history
   - Update payment methods
3. Save configuration

### 6. Set Up Tax Collection (Optional)
1. Go to Settings → Tax
2. Enable Stripe Tax
3. Add tax registrations for your jurisdictions
4. Configure product tax codes

### 7. Configure Payment Methods
1. Go to Settings → Payment methods
2. Enable desired payment methods:
   - Cards (default)
   - ACH Direct Debit
   - SEPA Direct Debit
   - etc.

## Testing Production Setup

### 1. Test Webhook
```bash
# Use Stripe CLI to test webhook
stripe listen --forward-to https://coldcopy.cc/api/stripe/webhook

# In another terminal, trigger test event
stripe trigger checkout.session.completed
```

### 2. Test Checkout Flow
1. Create a test customer account
2. Go through subscription flow
3. Use real credit card (small amount)
4. Verify:
   - Payment processes correctly
   - Subscription activates
   - Customer portal works
   - Emails are sent

### 3. Verify Database Updates
Check that subscriptions table is updated with:
- Correct subscription ID
- Proper status
- Accurate pricing
- Next billing date

## Security Checklist

- [ ] Production keys are only in production environment
- [ ] Test keys are removed from production
- [ ] Webhook endpoint uses signing secret verification
- [ ] API keys are not exposed in client-side code
- [ ] HTTPS is enforced on all payment pages
- [ ] PCI compliance requirements are met

## Monitoring and Alerts

### Set Up Stripe Notifications
1. Go to Settings → Team and security → Notifications
2. Enable alerts for:
   - Failed payments
   - Disputes
   - Unusual activity
   - Large transactions

### Create Monitoring Dashboard
1. Use Stripe Sigma for custom reports
2. Monitor key metrics:
   - MRR (Monthly Recurring Revenue)
   - Churn rate
   - Failed payment rate
   - Average revenue per user

### Set Up Slack Integration
1. Install Stripe Slack app
2. Configure notifications for:
   - New subscriptions
   - Cancellations
   - Failed payments

## Common Issues and Solutions

### Issue: Webhook 400 errors
**Solution**: Verify webhook signing secret is correct

### Issue: Subscription not activating
**Solution**: Check webhook events are being processed

### Issue: Customer can't access portal
**Solution**: Ensure portal is configured in production mode

### Issue: Tax not calculating
**Solution**: Verify Stripe Tax is enabled and configured

## Rollback Plan

If issues occur after switching to production:

1. **Immediate**: Switch environment variables back to test keys
2. **Notify**: Email customers about temporary issue
3. **Fix**: Debug and resolve issues in staging
4. **Retry**: Re-deploy with fixes

## Final Checklist

- [ ] Production API keys are set in Vercel
- [ ] Webhook endpoint is configured
- [ ] Products and prices are created
- [ ] Customer portal is configured
- [ ] Payment methods are enabled
- [ ] Test transaction completed successfully
- [ ] Monitoring alerts are set up
- [ ] Team is notified of go-live
- [ ] Backup payment processing plan exists

## Support Resources

- **Stripe Support**: support@stripe.com
- **API Reference**: https://stripe.com/docs/api
- **Integration Guide**: https://stripe.com/docs/billing/quickstart
- **Status Page**: https://status.stripe.com

---

*Note: Keep test mode active until you've thoroughly tested the entire payment flow. Once you switch to production, real money will be processed.*