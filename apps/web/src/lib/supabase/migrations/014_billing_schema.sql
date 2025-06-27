-- Billing Schema Migration
-- This migration creates a comprehensive billing system with subscription management,
-- payment tracking, usage monitoring, and Stripe integration

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types for better data integrity
CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'unpaid');
CREATE TYPE payment_method_type AS ENUM ('card', 'bank_account');
CREATE TYPE invoice_status AS ENUM ('draft', 'open', 'paid', 'void', 'uncollectible');
CREATE TYPE billing_event_type AS ENUM (
  'subscription.created',
  'subscription.updated',
  'subscription.deleted',
  'subscription.trial_will_end',
  'invoice.created',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
  'payment_method.attached',
  'payment_method.detached',
  'payment_method.updated',
  'customer.created',
  'customer.updated',
  'usage_record.created'
);

-- 1. Subscription Plans Table
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  price_monthly DECIMAL(10, 2) NOT NULL,
  price_yearly DECIMAL(10, 2) NOT NULL,
  currency CHAR(3) DEFAULT 'USD' NOT NULL,
  features JSONB DEFAULT '[]'::jsonb,
  limits JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  is_popular BOOLEAN DEFAULT false,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Subscriptions Table
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  stripe_subscription_id VARCHAR(255) UNIQUE,
  status subscription_status NOT NULL DEFAULT 'trialing',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  payment_method_id UUID REFERENCES payment_methods(id),
  stripe_customer_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT one_active_subscription_per_workspace UNIQUE (workspace_id) 
    DEFERRABLE INITIALLY DEFERRED
);

-- 3. Payment Methods Table
CREATE TABLE payment_methods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  stripe_payment_method_id VARCHAR(255) UNIQUE NOT NULL,
  type payment_method_type NOT NULL,
  last4 VARCHAR(4),
  brand VARCHAR(50),
  exp_month INT CHECK (exp_month >= 1 AND exp_month <= 12),
  exp_year INT CHECK (exp_year >= EXTRACT(YEAR FROM CURRENT_DATE)),
  is_default BOOLEAN DEFAULT false,
  billing_details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. Invoices Table
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id),
  stripe_invoice_id VARCHAR(255) UNIQUE,
  invoice_number VARCHAR(255) UNIQUE NOT NULL,
  amount_due DECIMAL(10, 2) NOT NULL,
  amount_paid DECIMAL(10, 2) DEFAULT 0,
  currency CHAR(3) DEFAULT 'USD' NOT NULL,
  status invoice_status NOT NULL DEFAULT 'draft',
  due_date TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  invoice_pdf TEXT,
  line_items JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. Usage Records Table
CREATE TABLE usage_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id),
  metric_name VARCHAR(100) NOT NULL CHECK (metric_name IN ('emails_sent', 'leads_enriched', 'ai_tokens')),
  quantity DECIMAL(15, 4) NOT NULL CHECK (quantity >= 0),
  unit_price DECIMAL(10, 6),
  total_amount DECIMAL(10, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  stripe_usage_record_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_period CHECK (period_end > period_start)
);

-- 6. Billing Events Table
CREATE TABLE billing_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  event_type billing_event_type NOT NULL,
  stripe_event_id VARCHAR(255) UNIQUE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_subscriptions_workspace_id ON subscriptions(workspace_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_current_period_end ON subscriptions(current_period_end);

CREATE INDEX idx_payment_methods_workspace_id ON payment_methods(workspace_id);
CREATE INDEX idx_payment_methods_is_default ON payment_methods(is_default);

CREATE INDEX idx_invoices_workspace_id ON invoices(workspace_id);
CREATE INDEX idx_invoices_subscription_id ON invoices(subscription_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);

CREATE INDEX idx_usage_records_workspace_id ON usage_records(workspace_id);
CREATE INDEX idx_usage_records_subscription_id ON usage_records(subscription_id);
CREATE INDEX idx_usage_records_metric_name ON usage_records(metric_name);
CREATE INDEX idx_usage_records_period_start ON usage_records(period_start);
CREATE INDEX idx_usage_records_period_end ON usage_records(period_end);

CREATE INDEX idx_billing_events_workspace_id ON billing_events(workspace_id);
CREATE INDEX idx_billing_events_event_type ON billing_events(event_type);
CREATE INDEX idx_billing_events_stripe_event_id ON billing_events(stripe_event_id);
CREATE INDEX idx_billing_events_created_at ON billing_events(created_at);

-- Create update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update timestamp triggers
CREATE TRIGGER update_subscription_plans_updated_at BEFORE UPDATE ON subscription_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_methods_updated_at BEFORE UPDATE ON payment_methods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to track usage
CREATE OR REPLACE FUNCTION track_usage(
  p_workspace_id UUID,
  p_metric_name VARCHAR(100),
  p_quantity DECIMAL(15, 4),
  p_unit_price DECIMAL(10, 6) DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_subscription_id UUID;
  v_usage_record_id UUID;
  v_current_period_start TIMESTAMPTZ;
  v_current_period_end TIMESTAMPTZ;
BEGIN
  -- Get active subscription and billing period
  SELECT id, current_period_start, current_period_end
  INTO v_subscription_id, v_current_period_start, v_current_period_end
  FROM subscriptions
  WHERE workspace_id = p_workspace_id
    AND status = 'active'
  LIMIT 1;

  -- Insert usage record
  INSERT INTO usage_records (
    workspace_id,
    subscription_id,
    metric_name,
    quantity,
    unit_price,
    period_start,
    period_end
  ) VALUES (
    p_workspace_id,
    v_subscription_id,
    p_metric_name,
    p_quantity,
    COALESCE(p_unit_price, 0),
    COALESCE(v_current_period_start, CURRENT_TIMESTAMP),
    COALESCE(v_current_period_end, CURRENT_TIMESTAMP + INTERVAL '1 month')
  ) RETURNING id INTO v_usage_record_id;

  RETURN v_usage_record_id;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate current period usage
CREATE OR REPLACE FUNCTION calculate_period_usage(
  p_workspace_id UUID,
  p_metric_name VARCHAR(100) DEFAULT NULL
)
RETURNS TABLE (
  metric_name VARCHAR(100),
  total_quantity DECIMAL,
  total_amount DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  WITH active_subscription AS (
    SELECT id, current_period_start, current_period_end
    FROM subscriptions
    WHERE workspace_id = p_workspace_id
      AND status = 'active'
    LIMIT 1
  )
  SELECT 
    ur.metric_name,
    SUM(ur.quantity) as total_quantity,
    SUM(ur.total_amount) as total_amount
  FROM usage_records ur
  JOIN active_subscription s ON ur.subscription_id = s.id
  WHERE ur.workspace_id = p_workspace_id
    AND ur.period_start >= s.current_period_start
    AND ur.period_end <= s.current_period_end
    AND (p_metric_name IS NULL OR ur.metric_name = p_metric_name)
  GROUP BY ur.metric_name;
END;
$$ LANGUAGE plpgsql;

-- Function to get subscription limits
CREATE OR REPLACE FUNCTION get_subscription_limits(p_workspace_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_limits JSONB;
BEGIN
  SELECT sp.limits
  INTO v_limits
  FROM subscriptions s
  JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE s.workspace_id = p_workspace_id
    AND s.status IN ('active', 'trialing')
  LIMIT 1;

  RETURN COALESCE(v_limits, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- Function to check if usage limit exceeded
CREATE OR REPLACE FUNCTION check_usage_limit(
  p_workspace_id UUID,
  p_metric_name VARCHAR(100)
)
RETURNS BOOLEAN AS $$
DECLARE
  v_limits JSONB;
  v_limit DECIMAL;
  v_current_usage DECIMAL;
BEGIN
  -- Get subscription limits
  v_limits := get_subscription_limits(p_workspace_id);
  
  -- Extract limit for specific metric
  v_limit := (v_limits->p_metric_name)::decimal;
  
  IF v_limit IS NULL THEN
    RETURN FALSE; -- No limit set
  END IF;

  -- Get current usage
  SELECT total_quantity
  INTO v_current_usage
  FROM calculate_period_usage(p_workspace_id, p_metric_name);

  RETURN COALESCE(v_current_usage, 0) >= v_limit;
END;
$$ LANGUAGE plpgsql;

-- Trigger for subscription lifecycle management
CREATE OR REPLACE FUNCTION handle_subscription_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Log status change as billing event
  INSERT INTO billing_events (
    workspace_id,
    event_type,
    data
  ) VALUES (
    NEW.workspace_id,
    'subscription.updated',
    jsonb_build_object(
      'subscription_id', NEW.id,
      'old_status', OLD.status,
      'new_status', NEW.status,
      'plan_id', NEW.plan_id
    )
  );

  -- Handle trial ending
  IF OLD.status = 'trialing' AND NEW.status != 'trialing' THEN
    -- Perform any necessary trial-end logic
    NULL;
  END IF;

  -- Handle cancellation
  IF NEW.status = 'canceled' AND OLD.status != 'canceled' THEN
    NEW.canceled_at = CURRENT_TIMESTAMP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER subscription_status_change
  AFTER UPDATE OF status ON subscriptions
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION handle_subscription_status_change();

-- RLS (Row Level Security) Policies
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;

-- Subscription plans are readable by everyone
CREATE POLICY "Anyone can view active subscription plans" ON subscription_plans
  FOR SELECT USING (is_active = true);

-- Workspace isolation policies
CREATE POLICY "Users can view their workspace subscriptions" ON subscriptions
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their workspace payment methods" ON payment_methods
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their workspace invoices" ON invoices
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their workspace usage records" ON usage_records
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their workspace billing events" ON billing_events
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users 
      WHERE user_id = auth.uid()
    )
  );

-- Service role policies for backend operations
CREATE POLICY "Service role can manage subscriptions" ON subscriptions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage payment methods" ON payment_methods
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage invoices" ON invoices
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage usage records" ON usage_records
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage billing events" ON billing_events
  FOR ALL USING (auth.role() = 'service_role');

-- Insert default subscription plans
INSERT INTO subscription_plans (name, slug, description, price_monthly, price_yearly, features, limits, is_active, is_popular, display_order) VALUES
  (
    'Free',
    'free',
    'Perfect for trying out ColdCopy',
    0,
    0,
    '["100 emails per month", "Basic email templates", "1 workspace user", "Community support"]'::jsonb,
    '{"emails_sent": 100, "leads_enriched": 10, "ai_tokens": 1000}'::jsonb,
    true,
    false,
    1
  ),
  (
    'Starter',
    'starter',
    'For individuals and small teams',
    29,
    290,
    '["1,000 emails per month", "Advanced email templates", "Email tracking & analytics", "5 workspace users", "Email support", "Basic AI features"]'::jsonb,
    '{"emails_sent": 1000, "leads_enriched": 100, "ai_tokens": 10000}'::jsonb,
    true,
    false,
    2
  ),
  (
    'Professional',
    'professional',
    'For growing teams and businesses',
    99,
    990,
    '["10,000 emails per month", "All email templates", "Advanced analytics", "A/B testing", "25 workspace users", "Priority support", "Advanced AI features", "CRM integrations"]'::jsonb,
    '{"emails_sent": 10000, "leads_enriched": 1000, "ai_tokens": 100000}'::jsonb,
    true,
    true,
    3
  ),
  (
    'Enterprise',
    'enterprise',
    'For large organizations with custom needs',
    299,
    2990,
    '["Unlimited emails", "Custom email templates", "Advanced analytics & reporting", "Unlimited A/B testing", "Unlimited workspace users", "24/7 phone support", "Custom AI training", "All integrations", "SSO & advanced security", "Dedicated account manager"]'::jsonb,
    '{"emails_sent": null, "leads_enriched": null, "ai_tokens": null}'::jsonb,
    true,
    false,
    4
  );

-- Create function to initialize trial subscription for new workspaces
CREATE OR REPLACE FUNCTION create_trial_subscription_for_workspace()
RETURNS TRIGGER AS $$
DECLARE
  v_professional_plan_id UUID;
  v_trial_duration INT := 14; -- 14 days trial
BEGIN
  -- Get the professional plan ID for trial
  SELECT id INTO v_professional_plan_id
  FROM subscription_plans
  WHERE slug = 'professional'
  LIMIT 1;

  IF v_professional_plan_id IS NOT NULL THEN
    -- Create a trial subscription for the new workspace
    INSERT INTO subscriptions (
      workspace_id,
      plan_id,
      status,
      current_period_start,
      current_period_end,
      trial_start,
      trial_end
    ) VALUES (
      NEW.id,
      v_professional_plan_id,
      'trialing',
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP + INTERVAL '14 days',
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP + INTERVAL '14 days'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-create trial subscription for new workspaces
CREATE TRIGGER auto_create_trial_subscription
  AFTER INSERT ON workspaces
  FOR EACH ROW
  EXECUTE FUNCTION create_trial_subscription_for_workspace();

-- Add helpful views
CREATE OR REPLACE VIEW workspace_billing_summary AS
SELECT 
  w.id as workspace_id,
  w.name as workspace_name,
  sp.name as plan_name,
  sp.slug as plan_slug,
  s.status as subscription_status,
  s.current_period_start,
  s.current_period_end,
  s.trial_end,
  sp.price_monthly,
  sp.price_yearly,
  sp.limits,
  COALESCE(
    (
      SELECT jsonb_object_agg(metric_name, total_quantity)
      FROM calculate_period_usage(w.id)
    ),
    '{}'::jsonb
  ) as current_usage
FROM workspaces w
LEFT JOIN subscriptions s ON w.id = s.workspace_id AND s.status IN ('active', 'trialing')
LEFT JOIN subscription_plans sp ON s.plan_id = sp.id;

-- Grant permissions on views
GRANT SELECT ON workspace_billing_summary TO authenticated;

-- Create indexes on the view's underlying tables for performance
CREATE INDEX idx_workspace_users_user_workspace ON workspace_users(user_id, workspace_id);