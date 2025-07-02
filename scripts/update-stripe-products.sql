-- Update Stripe Product IDs after creating them in Stripe Dashboard
-- Run this in Supabase SQL Editor after creating products in Stripe

-- Free Plan (no Stripe product needed for $0 plan)
UPDATE subscription_plans 
SET 
    stripe_product_id = NULL,
    stripe_price_id_monthly = NULL,
    stripe_price_id_yearly = NULL
WHERE slug = 'free';

-- Starter Plan - $29/month, $290/year
UPDATE subscription_plans 
SET 
    stripe_product_id = 'prod_XXXXX', -- Replace with your Stripe product ID
    stripe_price_id_monthly = 'price_XXXXX', -- Replace with monthly price ID
    stripe_price_id_yearly = 'price_XXXXX' -- Replace with yearly price ID
WHERE slug = 'starter';

-- Professional Plan - $99/month, $990/year
UPDATE subscription_plans 
SET 
    stripe_product_id = 'prod_XXXXX', -- Replace with your Stripe product ID
    stripe_price_id_monthly = 'price_XXXXX', -- Replace with monthly price ID
    stripe_price_id_yearly = 'price_XXXXX' -- Replace with yearly price ID
WHERE slug = 'professional';

-- Enterprise Plan - $299/month, $2990/year
UPDATE subscription_plans 
SET 
    stripe_product_id = 'prod_XXXXX', -- Replace with your Stripe product ID
    stripe_price_id_monthly = 'price_XXXXX', -- Replace with monthly price ID
    stripe_price_id_yearly = 'price_XXXXX' -- Replace with yearly price ID
WHERE slug = 'enterprise';

-- Verify the updates
SELECT 
    name,
    slug,
    price_monthly,
    price_yearly,
    stripe_product_id,
    stripe_price_id_monthly,
    stripe_price_id_yearly
FROM subscription_plans
ORDER BY display_order;