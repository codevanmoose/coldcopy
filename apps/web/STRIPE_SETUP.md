# Stripe Billing Setup Guide for ColdCopy

## 🚀 Current Status

The ColdCopy billing infrastructure has been successfully implemented with comprehensive Stripe integration. Here's what's been completed:

### ✅ Completed Features

1. **Stripe Integration**
   - Full Stripe client setup with payment processing
   - Customer management and payment method storage
   - Setup intents for saving payment methods
   - Payment intent creation for one-time payments

2. **Subscription Management**
   - Complete subscription lifecycle management
   - Multiple pricing tiers with monthly/yearly options
   - Trial periods and grace periods
   - Subscription upgrades/downgrades
   - Cancel at period end functionality

3. **Billing API Endpoints**
   - `/api/billing/subscription` - Full subscription CRUD
   - `/api/billing/plans` - Available subscription plans
   - `/api/billing/payment-methods` - Payment method management
   - `/api/billing/usage` - Usage tracking and metering
   - `/api/billing/portal` - Stripe Customer Portal integration
   - `/api/billing/trial` - Trial management
   - `/api/webhooks/stripe` - Webhook event processing

4. **Billing UI Components**
   - Comprehensive billing settings page at `/settings/billing`
   - **Stripe Setup Guide** - Step-by-step configuration wizard
   - Subscription upgrade/downgrade modals
   - Payment method management interface
   - Usage tracking and limits display
   - Trial status and conversion tracking

5. **Advanced Features**
   - **Usage-based billing** - Track emails sent, leads enriched, AI tokens
   - **GDPR compliance** - Data handling and privacy
   - **Webhook handling** - Real-time subscription updates
   - **Customer portal** - Self-service billing management
   - **Trial management** - 14-day free trials with conversion tracking

## 📋 Environment Variables Required

Add these to your `.env.local` file:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Application URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 🔧 Stripe Setup Steps

### 1. Create Stripe Account
1. Sign up at [dashboard.stripe.com/register](https://dashboard.stripe.com/register)
2. Complete business verification (for live payments)
3. Note: You can start with test mode for development

### 2. Get API Keys
1. Go to **Developers** → **API keys**
2. Copy your **Publishable key** (starts with `pk_test_`)
3. Copy your **Secret key** (starts with `sk_test_`)
4. Add both to your `.env.local` file

### 3. Create Products & Prices

#### Recommended Pricing Structure:

```bash
# Free Plan (Built-in)
- 500 emails/month
- 100 leads
- Basic features

# Starter Plan - $29/month
- 5,000 emails/month  
- 1,000 leads
- Basic analytics
- Email templates

# Professional Plan - $99/month
- 25,000 emails/month
- 10,000 leads  
- Advanced analytics
- A/B testing
- CRM integrations

# Enterprise Plan - $299/month
- 100,000 emails/month
- Unlimited leads
- White-label features
- Priority support
- Custom integrations
```

#### Steps to Create in Stripe:
1. **Products** → **Add product**
2. Create one product for each plan (Starter, Professional, Enterprise)
3. For each product, add **two prices**:
   - Monthly price (e.g., $29/month)
   - Yearly price (e.g., $290/year - 17% discount)
4. Copy the **Price IDs** from each price

### 4. Configure Database Plans

Update your `subscription_plans` table with Stripe Price IDs:

```sql
-- Example for Starter plan
UPDATE subscription_plans 
SET 
  stripe_price_id_monthly = 'price_1234567890abcdef',
  stripe_price_id_yearly = 'price_0987654321fedcba',
  stripe_product_id = 'prod_1234567890abcdef'
WHERE slug = 'starter';
```

### 5. Set Up Webhooks

#### Create Webhook Endpoint:
1. **Developers** → **Webhooks** → **Add endpoint**
2. **Endpoint URL**: `https://yourdomain.com/api/webhooks/stripe`
3. **Events to send**:
   ```
   customer.created
   customer.updated
   customer.deleted
   customer.subscription.created
   customer.subscription.updated
   customer.subscription.deleted
   customer.subscription.trial_will_end
   invoice.created
   invoice.finalized
   invoice.payment_succeeded
   invoice.payment_failed
   invoice.payment_action_required
   payment_method.attached
   payment_method.detached
   payment_method.updated
   payment_intent.succeeded
   payment_intent.payment_failed
   charge.refunded
   ```

4. Copy the **Webhook secret** (starts with `whsec_`)
5. Add to `.env.local` as `STRIPE_WEBHOOK_SECRET`

### 6. Test Integration

#### Using Test Cards:
```bash
# Successful payment
4242 4242 4242 4242

# Declined payment  
4000 0000 0000 0002

# Requires authentication (3D Secure)
4000 0025 0000 3155

# Insufficient funds
4000 0000 0000 9995
```

#### Test Flow:
1. Go to `/settings/billing`
2. Click "Upgrade Plan" 
3. Select a plan and payment frequency
4. Enter test card details
5. Complete subscription creation
6. Verify webhook delivery in Stripe Dashboard

## 💳 Subscription Plans Configuration

### Default Plans Structure:

```typescript
const plans = [
  {
    name: 'Free',
    slug: 'free',
    priceMonthly: 0,
    priceYearly: 0,
    features: [
      '500 emails/month',
      '100 leads',
      'Basic templates',
      'Email tracking'
    ],
    limits: {
      emails_sent: 500,
      leads_enriched: 100,
      ai_tokens: 1000
    }
  },
  {
    name: 'Starter', 
    slug: 'starter',
    priceMonthly: 2900, // $29.00 in cents
    priceYearly: 29000, // $290.00 in cents (17% discount)
    features: [
      '5,000 emails/month',
      '1,000 leads', 
      'Advanced templates',
      'Basic analytics',
      'Email scheduling'
    ],
    limits: {
      emails_sent: 5000,
      leads_enriched: 1000, 
      ai_tokens: 10000
    }
  },
  {
    name: 'Professional',
    slug: 'professional',
    priceMonthly: 9900, // $99.00 in cents
    priceYearly: 99000, // $990.00 in cents (17% discount)
    features: [
      '25,000 emails/month',
      '10,000 leads',
      'A/B testing',
      'Advanced analytics', 
      'CRM integrations',
      'Priority support'
    ],
    limits: {
      emails_sent: 25000,
      leads_enriched: 10000,
      ai_tokens: 50000
    }
  },
  {
    name: 'Enterprise',
    slug: 'enterprise', 
    priceMonthly: 29900, // $299.00 in cents
    priceYearly: 299000, // $2990.00 in cents (17% discount)
    features: [
      '100,000 emails/month',
      'Unlimited leads',
      'White-label features',
      'Custom integrations',
      'Dedicated support',
      'SLA guarantees'
    ],
    limits: {
      emails_sent: 100000,
      leads_enriched: null, // Unlimited
      ai_tokens: 200000
    }
  }
]
```

## 🔄 Usage-Based Billing

### Metered Usage Tracking:

The system tracks usage for:

1. **Emails Sent** - Per email sent via campaigns
2. **Leads Enriched** - Per lead data enrichment request  
3. **AI Tokens** - Per AI-generated content token

### Usage Implementation:

```typescript
// Track email usage
await recordUsage({
  workspaceId,
  metricName: 'emails_sent',
  quantity: 1,
  periodStart: new Date(),
  periodEnd: new Date()
})

// Track lead enrichment  
await recordUsage({
  workspaceId,
  metricName: 'leads_enriched', 
  quantity: 1,
  periodStart: new Date(),
  periodEnd: new Date()
})

// Track AI token usage
await recordUsage({
  workspaceId,
  metricName: 'ai_tokens',
  quantity: tokensUsed,
  periodStart: new Date(), 
  periodEnd: new Date()
})
```

## 🎯 Customer Portal Integration

### Features Available:
- Update payment methods
- Download invoices
- View subscription history
- Update billing address
- Cancel subscription

### Implementation:
```typescript
// Create portal session
const portalUrl = await api.billing.portal.create()
window.location.href = portalUrl
```

## 🔒 Security & Compliance

### Stripe Security Features:
- **PCI DSS Level 1** - Highest level of compliance
- **3D Secure** - Enhanced authentication for cards
- **Radar** - AI-powered fraud detection
- **Strong Customer Authentication** - EU SCA compliance

### ColdCopy Security:
- **Webhook signature verification** - Verify events from Stripe
- **Encrypted sensitive data** - Customer data protection
- **Audit logging** - Track all billing events
- **GDPR compliance** - Data handling and privacy

## 📊 Analytics & Reporting

### Billing Metrics Tracked:
- Monthly recurring revenue (MRR)
- Customer lifetime value (CLV)
- Churn rate and retention
- Trial to paid conversion rate
- Usage patterns and overages

### Available Reports:
- Subscription analytics dashboard
- Usage tracking by workspace
- Revenue forecasting
- Customer segmentation

## 🚀 Production Deployment

### Before Going Live:
1. ✅ Complete Stripe account verification
2. ✅ Test all subscription flows
3. ✅ Verify webhook delivery  
4. ✅ Set up business information
5. ✅ Configure tax settings (if applicable)
6. ✅ Review pricing strategy

### Production Configuration:
```bash
# Replace with live keys
STRIPE_SECRET_KEY=sk_live_your_live_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your_live_publishable_key  
STRIPE_WEBHOOK_SECRET=whsec_your_live_webhook_secret
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

### Go-Live Checklist:
- [ ] Update API keys to live mode
- [ ] Update webhook endpoint URL
- [ ] Test live payment with small amount
- [ ] Monitor webhook delivery
- [ ] Set up billing alerts
- [ ] Configure customer support for billing issues

## 🛠️ Troubleshooting

### Common Issues:

1. **"No such customer" error**
   - Customer not created in Stripe
   - Check customer creation in webhook handler

2. **"No such price" error**  
   - Price IDs not updated in database
   - Verify price IDs match Stripe dashboard

3. **Webhook signature verification failed**
   - Wrong webhook secret
   - Check STRIPE_WEBHOOK_SECRET environment variable

4. **Payment requires authentication**
   - Card requires 3D Secure
   - Handle payment_intent.requires_action events

### Monitoring & Alerts:

1. **Set up Stripe alerts** for failed payments
2. **Monitor webhook delivery** success rates  
3. **Track subscription metrics** for business insights
4. **Set up error logging** for billing failures

## 📈 Revenue Optimization

### Conversion Strategies:
- **14-day free trial** with email nurturing
- **Annual billing discount** (17% off)
- **Usage-based upgrades** when limits exceeded
- **Feature gating** to encourage upgrades
- **Customer success** outreach for trial users

### Pricing Strategy:
- **Value-based pricing** tied to business outcomes
- **Clear feature differentiation** between tiers
- **Usage-based overages** for growth accommodation
- **Enterprise custom pricing** for large customers

With this comprehensive Stripe billing integration, ColdCopy now has enterprise-grade subscription management, usage tracking, and revenue optimization capabilities ready for scale.