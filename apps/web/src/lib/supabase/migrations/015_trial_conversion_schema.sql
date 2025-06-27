-- Trial and Conversion Tracking Schema
-- This migration adds tables and functions for tracking trial usage and conversions

-- 1. Conversion Events Table
CREATE TABLE conversion_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event VARCHAR(100) NOT NULL,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  properties JSONB DEFAULT '{}'::jsonb,
  revenue DECIMAL(10, 2),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Billing Notifications Table
CREATE TABLE billing_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Trial Settings Table
CREATE TABLE trial_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  duration_days INT DEFAULT 14,
  grace_period_days INT DEFAULT 3,
  warning_days INT[] DEFAULT ARRAY[7, 3, 1],
  features JSONB DEFAULT '{
    "emails_per_month": 1000,
    "leads_enriched": 100,
    "ai_generations": 50,
    "team_members": 3
  }'::jsonb,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. Feature Usage Tracking Table
CREATE TABLE feature_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  feature_name VARCHAR(100) NOT NULL,
  first_used_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  usage_count INT DEFAULT 1,
  UNIQUE(workspace_id, feature_name)
);

-- Create indexes
CREATE INDEX idx_conversion_events_workspace_id ON conversion_events(workspace_id);
CREATE INDEX idx_conversion_events_event ON conversion_events(event);
CREATE INDEX idx_conversion_events_created_at ON conversion_events(created_at);
CREATE INDEX idx_conversion_events_user_id ON conversion_events(user_id);

CREATE INDEX idx_billing_notifications_workspace_id ON billing_notifications(workspace_id);
CREATE INDEX idx_billing_notifications_type ON billing_notifications(type);
CREATE INDEX idx_billing_notifications_read ON billing_notifications(read);
CREATE INDEX idx_billing_notifications_created_at ON billing_notifications(created_at);

CREATE INDEX idx_feature_usage_workspace_id ON feature_usage(workspace_id);
CREATE INDEX idx_feature_usage_feature_name ON feature_usage(feature_name);
CREATE INDEX idx_feature_usage_first_used_at ON feature_usage(first_used_at);

-- Function to track feature usage
CREATE OR REPLACE FUNCTION track_feature_usage(
  p_workspace_id UUID,
  p_feature_name VARCHAR(100)
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO feature_usage (workspace_id, feature_name, first_used_at, last_used_at, usage_count)
  VALUES (p_workspace_id, p_feature_name, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1)
  ON CONFLICT (workspace_id, feature_name)
  DO UPDATE SET
    last_used_at = CURRENT_TIMESTAMP,
    usage_count = feature_usage.usage_count + 1;
END;
$$ LANGUAGE plpgsql;

-- Function to get trial status
CREATE OR REPLACE FUNCTION get_trial_status(p_workspace_id UUID)
RETURNS TABLE (
  is_trial BOOLEAN,
  trial_days_remaining INT,
  trial_end_date TIMESTAMPTZ,
  is_expired BOOLEAN,
  in_grace_period BOOLEAN,
  grace_days_remaining INT
) AS $$
DECLARE
  v_subscription RECORD;
  v_trial_settings RECORD;
  v_now TIMESTAMPTZ := CURRENT_TIMESTAMP;
BEGIN
  -- Get subscription
  SELECT * INTO v_subscription
  FROM subscriptions
  WHERE workspace_id = p_workspace_id
    AND status IN ('trialing', 'active')
  ORDER BY created_at DESC
  LIMIT 1;

  -- Get trial settings
  SELECT * INTO v_trial_settings
  FROM trial_settings
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_subscription IS NULL OR v_subscription.status != 'trialing' THEN
    RETURN QUERY
    SELECT 
      FALSE::BOOLEAN as is_trial,
      0::INT as trial_days_remaining,
      NULL::TIMESTAMPTZ as trial_end_date,
      FALSE::BOOLEAN as is_expired,
      FALSE::BOOLEAN as in_grace_period,
      0::INT as grace_days_remaining;
  ELSE
    RETURN QUERY
    SELECT 
      TRUE::BOOLEAN as is_trial,
      GREATEST(0, EXTRACT(DAY FROM v_subscription.trial_end - v_now)::INT) as trial_days_remaining,
      v_subscription.trial_end as trial_end_date,
      (v_now > v_subscription.trial_end)::BOOLEAN as is_expired,
      (v_now > v_subscription.trial_end AND 
       v_now <= v_subscription.trial_end + INTERVAL '1 day' * COALESCE(v_trial_settings.grace_period_days, 3))::BOOLEAN as in_grace_period,
      CASE 
        WHEN v_now > v_subscription.trial_end THEN
          GREATEST(0, EXTRACT(DAY FROM 
            (v_subscription.trial_end + INTERVAL '1 day' * COALESCE(v_trial_settings.grace_period_days, 3)) - v_now
          )::INT)
        ELSE 0
      END as grace_days_remaining;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to check if usage limit is exceeded with trial considerations
CREATE OR REPLACE FUNCTION check_trial_usage_limit(
  p_workspace_id UUID,
  p_metric_name VARCHAR(100)
)
RETURNS TABLE (
  allowed BOOLEAN,
  current_usage DECIMAL,
  usage_limit DECIMAL,
  is_trial BOOLEAN,
  message TEXT
) AS $$
DECLARE
  v_trial_status RECORD;
  v_limits JSONB;
  v_limit DECIMAL;
  v_current_usage DECIMAL;
  v_subscription RECORD;
BEGIN
  -- Get trial status
  SELECT * INTO v_trial_status
  FROM get_trial_status(p_workspace_id);

  -- Get subscription and limits
  SELECT s.*, sp.limits
  INTO v_subscription
  FROM subscriptions s
  JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE s.workspace_id = p_workspace_id
    AND s.status IN ('active', 'trialing')
  LIMIT 1;

  -- Get limits based on trial status
  IF v_trial_status.is_trial THEN
    -- Use trial limits
    SELECT features->p_metric_name INTO v_limit
    FROM trial_settings
    ORDER BY created_at DESC
    LIMIT 1;
  ELSE
    -- Use plan limits
    v_limit := (v_subscription.limits->p_metric_name)::decimal;
  END IF;

  -- Get current usage
  SELECT total_quantity INTO v_current_usage
  FROM calculate_period_usage(p_workspace_id, p_metric_name);

  v_current_usage := COALESCE(v_current_usage, 0);

  -- Check if allowed
  IF v_limit IS NULL THEN
    -- No limit
    RETURN QUERY
    SELECT 
      TRUE::BOOLEAN,
      v_current_usage,
      NULL::DECIMAL,
      v_trial_status.is_trial,
      NULL::TEXT;
  ELSIF v_current_usage >= v_limit THEN
    -- Limit exceeded
    RETURN QUERY
    SELECT 
      FALSE::BOOLEAN,
      v_current_usage,
      v_limit,
      v_trial_status.is_trial,
      CASE 
        WHEN v_trial_status.is_trial THEN
          'Trial limit reached. Upgrade to continue using this feature.'
        ELSE
          'Usage limit reached. Please upgrade your plan.'
      END::TEXT;
  ELSE
    -- Under limit
    RETURN QUERY
    SELECT 
      TRUE::BOOLEAN,
      v_current_usage,
      v_limit,
      v_trial_status.is_trial,
      NULL::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to create trial subscription
CREATE OR REPLACE FUNCTION create_trial_subscription(
  p_workspace_id UUID,
  p_plan_id UUID DEFAULT NULL,
  p_duration_days INT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_subscription_id UUID;
  v_trial_settings RECORD;
  v_plan_id UUID;
BEGIN
  -- Get trial settings
  SELECT * INTO v_trial_settings
  FROM trial_settings
  ORDER BY created_at DESC
  LIMIT 1;

  -- Use default plan if not specified
  IF p_plan_id IS NULL THEN
    SELECT id INTO v_plan_id
    FROM subscription_plans
    WHERE slug = 'professional' -- Default to professional plan for trials
    LIMIT 1;
  ELSE
    v_plan_id := p_plan_id;
  END IF;

  -- Create trial subscription
  INSERT INTO subscriptions (
    workspace_id,
    plan_id,
    status,
    trial_start,
    trial_end,
    current_period_start,
    current_period_end
  ) VALUES (
    p_workspace_id,
    v_plan_id,
    'trialing',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP + INTERVAL '1 day' * COALESCE(p_duration_days, v_trial_settings.duration_days, 14),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP + INTERVAL '1 day' * COALESCE(p_duration_days, v_trial_settings.duration_days, 14)
  ) RETURNING id INTO v_subscription_id;

  -- Track trial start event
  INSERT INTO conversion_events (
    event,
    workspace_id,
    properties
  ) VALUES (
    'trial_started',
    p_workspace_id,
    jsonb_build_object(
      'plan_id', v_plan_id,
      'duration_days', COALESCE(p_duration_days, v_trial_settings.duration_days, 14)
    )
  );

  RETURN v_subscription_id;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE conversion_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_usage ENABLE ROW LEVEL SECURITY;

-- Users can view their workspace's conversion events
CREATE POLICY "Users can view their workspace conversion events" ON conversion_events
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users 
      WHERE user_id = auth.uid()
    )
  );

-- Users can view and update their workspace's billing notifications
CREATE POLICY "Users can view their workspace billing notifications" ON billing_notifications
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their workspace billing notifications" ON billing_notifications
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users 
      WHERE user_id = auth.uid()
    )
  );

-- Users can view their workspace's feature usage
CREATE POLICY "Users can view their workspace feature usage" ON feature_usage
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users 
      WHERE user_id = auth.uid()
    )
  );

-- Service role policies
CREATE POLICY "Service role can manage conversion events" ON conversion_events
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage billing notifications" ON billing_notifications
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage feature usage" ON feature_usage
  FOR ALL USING (auth.role() = 'service_role');

-- Insert default trial settings
INSERT INTO trial_settings (duration_days, grace_period_days, warning_days, features)
VALUES (
  14,
  3,
  ARRAY[7, 3, 1],
  '{
    "emails_sent": 1000,
    "leads_enriched": 100,
    "ai_tokens": 10000,
    "team_members": 3,
    "campaigns": 5,
    "email_accounts": 2
  }'::jsonb
);

-- Update existing workspaces to have trial subscriptions if they don't have any subscription
DO $$
DECLARE
  v_workspace RECORD;
BEGIN
  FOR v_workspace IN 
    SELECT w.id
    FROM workspaces w
    LEFT JOIN subscriptions s ON w.id = s.workspace_id
    WHERE s.id IS NULL
  LOOP
    PERFORM create_trial_subscription(v_workspace.id);
  END LOOP;
END;
$$;