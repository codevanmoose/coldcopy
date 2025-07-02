-- Add Stripe price IDs to subscription_plans table
-- These are needed to link ColdCopy plans with Stripe products

ALTER TABLE subscription_plans
ADD COLUMN IF NOT EXISTS stripe_product_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS stripe_price_id_monthly VARCHAR(255),
ADD COLUMN IF NOT EXISTS stripe_price_id_yearly VARCHAR(255);

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_subscription_plans_stripe_product_id 
ON subscription_plans(stripe_product_id);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_stripe_price_monthly 
ON subscription_plans(stripe_price_id_monthly);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_stripe_price_yearly 
ON subscription_plans(stripe_price_id_yearly);

-- Add comments for documentation
COMMENT ON COLUMN subscription_plans.stripe_product_id IS 'Stripe Product ID (prod_xxx)';
COMMENT ON COLUMN subscription_plans.stripe_price_id_monthly IS 'Stripe Price ID for monthly billing (price_xxx)';
COMMENT ON COLUMN subscription_plans.stripe_price_id_yearly IS 'Stripe Price ID for yearly billing (price_xxx)';