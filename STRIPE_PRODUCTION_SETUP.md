# 💳 Stripe Production Setup Guide

## Current Status
- ✅ Stripe integration complete with test keys
- ⚠️ Using test mode (sk_test_..., pk_test_...)
- 🎯 Need to replace with production keys

## Pricing Plans Configured
1. **Free** - $0/month
   - 100 emails per month
   - Basic features
   
2. **Starter** - $29/month ($290/year)
   - 1,000 emails per month
   - 5 workspace users
   - Basic AI features
   
3. **Professional** - $99/month ($990/year) ⭐ Popular
   - 10,000 emails per month
   - 25 workspace users
   - Advanced AI features
   - CRM integrations
   
4. **Enterprise** - $299/month ($2,990/year)
   - Unlimited emails
   - Unlimited users
   - Custom AI training
   - Dedicated support

## Steps to Configure Production Keys

### 1. Get Your Stripe Production Keys
1. Log in to [Stripe Dashboard](https://dashboard.stripe.com)
2. Ensure you're in **Live Mode** (toggle in top right)
3. Go to **Developers → API keys**
4. Copy these keys:
   - **Publishable key**: `pk_live_...`
   - **Secret key**: `sk_live_...`

### 2. Create Products and Prices in Stripe
You need to create the following products:

#### Free Plan
- Product Name: "ColdCopy Free"
- Price: $0/month

#### Starter Plan
- Product Name: "ColdCopy Starter"
- Monthly Price: $29
- Yearly Price: $290
- Metadata: `plan_slug: starter`

#### Professional Plan
- Product Name: "ColdCopy Professional"
- Monthly Price: $99
- Yearly Price: $990
- Metadata: `plan_slug: professional`

#### Enterprise Plan
- Product Name: "ColdCopy Enterprise"
- Monthly Price: $299
- Yearly Price: $2,990
- Metadata: `plan_slug: enterprise`

### 3. Set Up Webhook
1. In Stripe Dashboard, go to **Developers → Webhooks**
2. Click **Add endpoint**
3. Endpoint URL: `https://www.coldcopy.cc/api/webhooks/stripe`
4. Select events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `payment_method.attached`
   - `payment_method.detached`
5. Copy the **Signing secret**: `whsec_...`

### 4. Update Environment Variables in Vercel

Go to: https://vercel.com/vanmooseprojects/coldcopy/settings/environment-variables

Update these variables:
```
STRIPE_SECRET_KEY=sk_live_YOUR_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET
```

### 5. Update Stripe Product IDs
After creating products in Stripe, you need to update the price IDs in the database or configuration:

```sql
-- Example: Update subscription_plans table with Stripe IDs
UPDATE subscription_plans 
SET stripe_price_id_monthly = 'price_xxx',
    stripe_price_id_yearly = 'price_yyy',
    stripe_product_id = 'prod_zzz'
WHERE slug = 'starter';
```

## Testing Production Setup

1. **Verify Configuration**:
   ```bash
   curl https://www.coldcopy.cc/api/test-stripe-config
   ```
   Should show: "✅ Stripe is configured with LIVE keys"

2. **Test Subscription Flow**:
   - Sign up for a new account
   - Go to Settings → Billing
   - Upgrade to a paid plan
   - Enter real credit card
   - Verify subscription created in Stripe Dashboard

3. **Test Webhook**:
   - Check Stripe webhook logs
   - Verify events are being received
   - Check database for subscription updates

## Important Notes

⚠️ **Before Going Live**:
- Test with small amounts first
- Ensure refund policy is in place
- Set up proper error handling
- Configure tax settings if needed
- Set up fraud prevention rules

💡 **Best Practices**:
- Use Stripe's test cards in test mode
- Monitor failed payments
- Set up payment retry logic
- Configure dunning emails
- Enable 3D Secure for European customers

## Stripe Features to Enable

- [ ] **Payment Methods**: Card, Bank transfers (if needed)
- [ ] **3D Secure**: For European compliance
- [ ] **Tax**: Stripe Tax for automatic calculation
- [ ] **Invoicing**: Automatic invoice generation
- [ ] **Customer Portal**: Self-service subscription management

## Support

- Stripe Support: https://support.stripe.com
- Stripe API Docs: https://stripe.com/docs/api
- Webhook Testing: https://stripe.com/docs/webhooks/test