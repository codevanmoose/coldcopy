# Production Keys Setup - Quick Guide

## 1. Google Analytics (5 minutes)

### Get your Measurement ID:
1. Go to https://analytics.google.com/
2. Create a new property for "ColdCopy"
3. Choose "Web" platform
4. Enter website URL: https://coldcopy.cc
5. Copy the Measurement ID (format: G-XXXXXXXXXX)

### Add to Vercel:
```bash
vercel env add NEXT_PUBLIC_GA_MEASUREMENT_ID production
# Paste your G-XXXXXXXXXX when prompted
```

### Verify it's working:
1. Visit https://coldcopy.cc
2. Check Google Analytics Real-Time view
3. You should see your visit

## 2. Sentry Error Monitoring (10 minutes)

### Create Sentry Project:
1. Go to https://sentry.io/
2. Create new project → Next.js
3. Project name: "coldcopy-production"
4. Get your DSN from project settings

### Get Auth Token:
1. Go to Settings → Account → API → Auth Tokens
2. Create token with scopes: project:releases, org:read

### Add to Vercel:
```bash
# Add all Sentry variables
vercel env add NEXT_PUBLIC_SENTRY_DSN production
vercel env add SENTRY_ORG production
vercel env add SENTRY_PROJECT production
vercel env add SENTRY_AUTH_TOKEN production
```

### Deploy to activate:
```bash
vercel --prod
```

## 3. Stripe Production Keys (When Ready)

### Prerequisites:
- Complete Stripe identity verification
- Add bank account for payouts
- Review and accept Stripe terms

### Get Production Keys:
1. Login to https://dashboard.stripe.com/
2. Toggle from "Test mode" to "Live mode"
3. Go to Developers → API keys
4. Copy publishable and secret keys

### Create Webhook:
1. Go to Developers → Webhooks
2. Add endpoint: https://coldcopy.cc/api/stripe/webhook
3. Select events: All events in: checkout, customer, subscription
4. Copy webhook signing secret

### Update Vercel:
```bash
# Remove test keys
vercel env rm STRIPE_SECRET_KEY production
vercel env rm NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY production
vercel env rm STRIPE_WEBHOOK_SECRET production

# Add production keys
vercel env add STRIPE_SECRET_KEY production
vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY production
vercel env add STRIPE_WEBHOOK_SECRET production
```

## Quick Verification Commands

### Check all environment variables:
```bash
vercel env ls production
```

### Test integrations:
```bash
# Test GA tracking
curl https://coldcopy.cc

# Check Sentry (trigger test error)
curl https://coldcopy.cc/api/test-sentry

# Verify Stripe webhook
stripe listen --forward-to https://coldcopy.cc/api/stripe/webhook
```

## Priority Order:
1. **AWS SES** - Do this NOW (blocking email sends)
2. **Google Analytics** - Do this TODAY (track users from day 1)
3. **Sentry** - Do this TODAY (catch errors early)
4. **Stripe** - Do this WHEN you're ready to charge customers

---

Remember: After adding keys, deploy with `vercel --prod` to activate changes!