# 🚀 Stripe Quick Setup (10 minutes)

## Step 1: Get Production Keys (2 min)
1. Go to: https://dashboard.stripe.com
2. Switch to **Live Mode** (top right)
3. Go to: **Developers → API keys**
4. Copy these:
   - Publishable key: `pk_live_...`
   - Secret key: `sk_live_...`

## Step 2: Create Products in Stripe (5 min)

### In Stripe Dashboard → Products:

1. **Starter Plan**
   - Name: "ColdCopy Starter"
   - Monthly: $29.00
   - Yearly: $290.00
   - Save product ID: `prod_...`
   - Save price IDs: `price_...` (monthly), `price_...` (yearly)

2. **Professional Plan** ⭐
   - Name: "ColdCopy Professional"
   - Monthly: $99.00
   - Yearly: $990.00
   - Save product ID: `prod_...`
   - Save price IDs: `price_...` (monthly), `price_...` (yearly)

3. **Enterprise Plan**
   - Name: "ColdCopy Enterprise"
   - Monthly: $299.00
   - Yearly: $2,990.00
   - Save product ID: `prod_...`
   - Save price IDs: `price_...` (monthly), `price_...` (yearly)

## Step 3: Create Webhook (2 min)
1. Go to: **Developers → Webhooks**
2. Click **Add endpoint**
3. URL: `https://www.coldcopy.cc/api/webhooks/stripe`
4. Select: **All events** (or choose specific ones)
5. Copy webhook secret: `whsec_...`

## Step 4: Update Vercel (1 min)
Go to: https://vercel.com/vanmooseprojects/coldcopy/settings/environment-variables

Update these 3 variables:
```
STRIPE_SECRET_KEY=sk_live_YOUR_KEY_HERE
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET_HERE
```

Click **Save** and Vercel will auto-redeploy.

## Step 5: Update Database
Run this SQL in Supabase SQL Editor:

```sql
-- Update Starter Plan
UPDATE subscription_plans 
SET 
    stripe_product_id = 'prod_YOUR_ID',
    stripe_price_id_monthly = 'price_YOUR_MONTHLY_ID',
    stripe_price_id_yearly = 'price_YOUR_YEARLY_ID'
WHERE slug = 'starter';

-- Update Professional Plan
UPDATE subscription_plans 
SET 
    stripe_product_id = 'prod_YOUR_ID',
    stripe_price_id_monthly = 'price_YOUR_MONTHLY_ID',
    stripe_price_id_yearly = 'price_YOUR_YEARLY_ID'
WHERE slug = 'professional';

-- Update Enterprise Plan
UPDATE subscription_plans 
SET 
    stripe_product_id = 'prod_YOUR_ID',
    stripe_price_id_monthly = 'price_YOUR_MONTHLY_ID',
    stripe_price_id_yearly = 'price_YOUR_YEARLY_ID'
WHERE slug = 'enterprise';
```

## ✅ Test It Works
1. Check config: https://www.coldcopy.cc/api/test-stripe-config
   - Should show "LIVE" mode
2. Go to Settings → Billing
3. Try upgrading to a plan
4. Use test card: 4242 4242 4242 4242

## 🎉 Done!
Your platform can now accept real payments!