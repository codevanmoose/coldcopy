-- Usage-Based Billing System
-- Track AI token usage, feature usage, and implement metered billing

-- Usage Metrics Table
CREATE TABLE IF NOT EXISTS usage_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Metric details
  metric_type VARCHAR(50) NOT NULL, -- 'ai_tokens', 'emails_sent', 'leads_enriched', 'api_calls'
  provider VARCHAR(50), -- 'openai', 'anthropic', 'hunter', 'clearbit', etc.
  model_name VARCHAR(100), -- 'gpt-4', 'claude-3', etc.
  
  -- Usage amounts
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  units_used INTEGER DEFAULT 1, -- For non-token metrics
  
  -- Cost tracking
  cost_per_unit DECIMAL(10, 6) DEFAULT 0, -- Cost per token/unit in USD
  total_cost DECIMAL(10, 4) DEFAULT 0, -- Total cost in USD
  
  -- Context
  resource_type VARCHAR(50), -- 'campaign', 'lead', 'email', 'template'
  resource_id UUID,
  feature_name VARCHAR(100), -- 'email_generation', 'lead_enrichment', 'reply_detection'
  
  -- Metadata
  request_data JSONB DEFAULT '{}', -- Request parameters
  response_data JSONB DEFAULT '{}', -- Response metadata
  duration_ms INTEGER, -- Request duration
  
  -- Billing period
  billing_period DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE -- When included in billing
);

-- Usage Limits Table
CREATE TABLE IF NOT EXISTS usage_limits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  
  -- Limit configuration
  metric_type VARCHAR(50) NOT NULL,
  limit_type VARCHAR(20) NOT NULL, -- 'hard', 'soft', 'warning'
  
  -- Limits
  monthly_limit INTEGER,
  daily_limit INTEGER,
  burst_limit INTEGER, -- Short-term limit (per hour)
  
  -- Current usage
  current_monthly_usage INTEGER DEFAULT 0,
  current_daily_usage INTEGER DEFAULT 0,
  current_burst_usage INTEGER DEFAULT 0,
  
  -- Reset dates
  monthly_reset_date DATE DEFAULT CURRENT_DATE,
  daily_reset_date DATE DEFAULT CURRENT_DATE,
  burst_reset_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Notifications
  warning_threshold DECIMAL(3, 2) DEFAULT 0.8, -- 80%
  warning_sent_at TIMESTAMP WITH TIME ZONE,
  limit_reached_at TIMESTAMP WITH TIME ZONE,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI Model Pricing Table
CREATE TABLE IF NOT EXISTS ai_model_pricing (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Model details
  provider VARCHAR(50) NOT NULL, -- 'openai', 'anthropic'
  model_name VARCHAR(100) NOT NULL,
  model_version VARCHAR(50),
  
  -- Pricing (per 1000 tokens)
  input_price_per_1k DECIMAL(8, 6) NOT NULL, -- Input tokens cost
  output_price_per_1k DECIMAL(8, 6) NOT NULL, -- Output tokens cost
  
  -- Limits
  max_tokens INTEGER, -- Maximum tokens per request
  context_window INTEGER, -- Maximum context length
  
  -- Features
  supports_functions BOOLEAN DEFAULT false,
  supports_vision BOOLEAN DEFAULT false,
  supports_streaming BOOLEAN DEFAULT false,
  
  -- Metadata
  description TEXT,
  performance_tier VARCHAR(20), -- 'basic', 'advanced', 'premium'
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  deprecated_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(provider, model_name, model_version)
);

-- Usage Aggregations Table (for faster queries)
CREATE TABLE IF NOT EXISTS usage_aggregations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Aggregation details
  metric_type VARCHAR(50) NOT NULL,
  provider VARCHAR(50),
  aggregation_period VARCHAR(20) NOT NULL, -- 'daily', 'weekly', 'monthly'
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Aggregated values
  total_units INTEGER DEFAULT 0,
  total_input_tokens INTEGER DEFAULT 0,
  total_output_tokens INTEGER DEFAULT 0,
  total_cost DECIMAL(10, 4) DEFAULT 0,
  request_count INTEGER DEFAULT 0,
  
  -- Performance metrics
  avg_duration_ms INTEGER,
  success_rate DECIMAL(5, 4), -- Success percentage
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(workspace_id, metric_type, provider, aggregation_period, period_start)
);

-- Billing Events Table
CREATE TABLE IF NOT EXISTS billing_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id),
  
  -- Event details
  event_type VARCHAR(50) NOT NULL, -- 'usage_charged', 'limit_exceeded', 'warning_sent', 'overage_fee'
  metric_type VARCHAR(50) NOT NULL,
  
  -- Usage details
  units_charged INTEGER,
  cost_charged DECIMAL(10, 4),
  
  -- Billing period
  billing_period_start DATE,
  billing_period_end DATE,
  
  -- Metadata
  event_data JSONB DEFAULT '{}',
  stripe_invoice_id VARCHAR(255),
  stripe_invoice_item_id VARCHAR(255),
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processed', 'failed'
  processed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Feature Usage Tracking
CREATE TABLE IF NOT EXISTS feature_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Feature details
  feature_name VARCHAR(100) NOT NULL,
  feature_category VARCHAR(50), -- 'ai', 'enrichment', 'automation', 'export'
  
  -- Usage tracking
  usage_count INTEGER DEFAULT 1,
  session_id VARCHAR(100), -- Track feature usage in sessions
  
  -- Context
  metadata JSONB DEFAULT '{}',
  user_agent TEXT,
  ip_address INET,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  date_used DATE DEFAULT CURRENT_DATE
);

-- Stripe Subscription Items Mapping Table
CREATE TABLE IF NOT EXISTS stripe_subscription_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  stripe_subscription_id VARCHAR(255) NOT NULL,
  stripe_subscription_item_id VARCHAR(255) NOT NULL UNIQUE,
  stripe_price_id VARCHAR(255) NOT NULL,
  
  -- Metric mapping
  metric_type VARCHAR(50) NOT NULL, -- Maps to usage_metrics.metric_type
  description VARCHAR(255),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_usage_metrics_workspace_period ON usage_metrics(workspace_id, billing_period);
CREATE INDEX idx_usage_metrics_type_provider ON usage_metrics(metric_type, provider);
CREATE INDEX idx_usage_metrics_resource ON usage_metrics(resource_type, resource_id);
CREATE INDEX idx_usage_metrics_created_at ON usage_metrics(created_at DESC);

CREATE INDEX idx_usage_limits_workspace ON usage_limits(workspace_id);
CREATE INDEX idx_usage_limits_type ON usage_limits(metric_type, is_active);

CREATE INDEX idx_ai_model_pricing_provider_model ON ai_model_pricing(provider, model_name, is_active);

CREATE INDEX idx_usage_aggregations_workspace_period ON usage_aggregations(workspace_id, aggregation_period, period_start);
CREATE INDEX idx_usage_aggregations_type ON usage_aggregations(metric_type, provider);

CREATE INDEX idx_billing_events_workspace ON billing_events(workspace_id);
CREATE INDEX idx_billing_events_subscription ON billing_events(subscription_id);
CREATE INDEX idx_billing_events_period ON billing_events(billing_period_start, billing_period_end);
CREATE INDEX idx_billing_events_status ON billing_events(status);

CREATE INDEX idx_feature_usage_workspace_date ON feature_usage(workspace_id, date_used);
CREATE INDEX idx_feature_usage_feature ON feature_usage(feature_name, feature_category);
CREATE INDEX idx_feature_usage_user ON feature_usage(user_id, date_used);

CREATE INDEX idx_stripe_subscription_items_workspace ON stripe_subscription_items(workspace_id);
CREATE INDEX idx_stripe_subscription_items_metric ON stripe_subscription_items(metric_type);
CREATE INDEX idx_stripe_subscription_items_subscription ON stripe_subscription_items(stripe_subscription_id);

-- Enable RLS
ALTER TABLE usage_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_model_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_aggregations ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_subscription_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view usage metrics for their workspace" ON usage_metrics
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM user_profiles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert usage metrics" ON usage_metrics
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view usage limits for their workspace" ON usage_limits
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM user_profiles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace admins can manage usage limits" ON usage_limits
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM user_profiles 
      WHERE user_id = auth.uid() AND role IN ('workspace_admin', 'super_admin')
    )
  );

CREATE POLICY "AI model pricing is publicly readable" ON ai_model_pricing
  FOR SELECT USING (is_active = true);

CREATE POLICY "Users can view usage aggregations for their workspace" ON usage_aggregations
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM user_profiles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view billing events for their workspace" ON billing_events
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM user_profiles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view feature usage for their workspace" ON feature_usage
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM user_profiles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert feature usage" ON feature_usage
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view stripe subscription items for their workspace" ON stripe_subscription_items
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM user_profiles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can manage stripe subscription items" ON stripe_subscription_items
  FOR ALL WITH CHECK (true);

-- Functions for usage tracking

-- Function to track AI usage
CREATE OR REPLACE FUNCTION track_ai_usage(
  p_workspace_id UUID,
  p_user_id UUID,
  p_provider VARCHAR(50),
  p_model_name VARCHAR(100),
  p_input_tokens INTEGER,
  p_output_tokens INTEGER,
  p_feature_name VARCHAR(100),
  p_resource_type VARCHAR(50) DEFAULT NULL,
  p_resource_id UUID DEFAULT NULL,
  p_request_data JSONB DEFAULT '{}',
  p_response_data JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  usage_id UUID;
  total_tokens INTEGER;
  pricing_record RECORD;
  total_cost DECIMAL(10, 4);
BEGIN
  total_tokens := p_input_tokens + p_output_tokens;
  
  -- Get pricing for the model
  SELECT * INTO pricing_record
  FROM ai_model_pricing
  WHERE provider = p_provider 
    AND model_name = p_model_name 
    AND is_active = true
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Calculate cost
  IF pricing_record.id IS NOT NULL THEN
    total_cost := (p_input_tokens::DECIMAL / 1000 * pricing_record.input_price_per_1k) +
                  (p_output_tokens::DECIMAL / 1000 * pricing_record.output_price_per_1k);
  ELSE
    total_cost := 0;
  END IF;
  
  -- Insert usage record
  INSERT INTO usage_metrics (
    workspace_id,
    user_id,
    metric_type,
    provider,
    model_name,
    input_tokens,
    output_tokens,
    total_tokens,
    total_cost,
    resource_type,
    resource_id,
    feature_name,
    request_data,
    response_data
  ) VALUES (
    p_workspace_id,
    p_user_id,
    'ai_tokens',
    p_provider,
    p_model_name,
    p_input_tokens,
    p_output_tokens,
    total_tokens,
    total_cost,
    p_resource_type,
    p_resource_id,
    p_feature_name,
    p_request_data,
    p_response_data
  ) RETURNING id INTO usage_id;
  
  -- Update usage limits
  PERFORM update_usage_limits(p_workspace_id, 'ai_tokens', total_tokens);
  
  RETURN usage_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update usage limits
CREATE OR REPLACE FUNCTION update_usage_limits(
  p_workspace_id UUID,
  p_metric_type VARCHAR(50),
  p_units_used INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  limit_record RECORD;
  current_date DATE := CURRENT_DATE;
  current_time TIMESTAMP WITH TIME ZONE := NOW();
BEGIN
  -- Get or create usage limit record
  SELECT * INTO limit_record
  FROM usage_limits
  WHERE workspace_id = p_workspace_id
    AND metric_type = p_metric_type
    AND is_active = true
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF limit_record.id IS NULL THEN
    RETURN false; -- No limits configured
  END IF;
  
  -- Reset counters if needed
  IF limit_record.monthly_reset_date < current_date THEN
    UPDATE usage_limits
    SET current_monthly_usage = 0,
        monthly_reset_date = current_date
    WHERE id = limit_record.id;
    limit_record.current_monthly_usage := 0;
  END IF;
  
  IF limit_record.daily_reset_date < current_date THEN
    UPDATE usage_limits
    SET current_daily_usage = 0,
        daily_reset_date = current_date
    WHERE id = limit_record.id;
    limit_record.current_daily_usage := 0;
  END IF;
  
  IF limit_record.burst_reset_time < current_time - INTERVAL '1 hour' THEN
    UPDATE usage_limits
    SET current_burst_usage = 0,
        burst_reset_time = current_time
    WHERE id = limit_record.id;
    limit_record.current_burst_usage := 0;
  END IF;
  
  -- Update usage counters
  UPDATE usage_limits
  SET current_monthly_usage = current_monthly_usage + p_units_used,
      current_daily_usage = current_daily_usage + p_units_used,
      current_burst_usage = current_burst_usage + p_units_used,
      updated_at = current_time
  WHERE id = limit_record.id;
  
  -- Check for limit violations and send notifications
  PERFORM check_usage_limits(limit_record.id);
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check usage limits and send notifications
CREATE OR REPLACE FUNCTION check_usage_limits(p_limit_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  limit_record RECORD;
  warning_triggered BOOLEAN := false;
  limit_exceeded BOOLEAN := false;
BEGIN
  SELECT * INTO limit_record
  FROM usage_limits
  WHERE id = p_limit_id;
  
  IF limit_record.id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check monthly limit
  IF limit_record.monthly_limit IS NOT NULL THEN
    IF limit_record.current_monthly_usage >= limit_record.monthly_limit THEN
      limit_exceeded := true;
      
      IF limit_record.limit_reached_at IS NULL THEN
        UPDATE usage_limits
        SET limit_reached_at = NOW()
        WHERE id = p_limit_id;
        
        -- Create billing event
        INSERT INTO billing_events (
          workspace_id,
          event_type,
          metric_type,
          units_charged,
          event_data
        ) VALUES (
          limit_record.workspace_id,
          'limit_exceeded',
          limit_record.metric_type,
          limit_record.current_monthly_usage,
          jsonb_build_object(
            'limit_type', 'monthly',
            'limit_value', limit_record.monthly_limit,
            'current_usage', limit_record.current_monthly_usage
          )
        );
      END IF;
    ELSIF limit_record.current_monthly_usage >= limit_record.monthly_limit * limit_record.warning_threshold THEN
      warning_triggered := true;
      
      IF limit_record.warning_sent_at IS NULL OR 
         limit_record.warning_sent_at < CURRENT_DATE THEN
        UPDATE usage_limits
        SET warning_sent_at = NOW()
        WHERE id = p_limit_id;
        
        -- Create billing event
        INSERT INTO billing_events (
          workspace_id,
          event_type,
          metric_type,
          units_charged,
          event_data
        ) VALUES (
          limit_record.workspace_id,
          'warning_sent',
          limit_record.metric_type,
          limit_record.current_monthly_usage,
          jsonb_build_object(
            'limit_type', 'monthly',
            'limit_value', limit_record.monthly_limit,
            'current_usage', limit_record.current_monthly_usage,
            'threshold', limit_record.warning_threshold
          )
        );
      END IF;
    END IF;
  END IF;
  
  RETURN warning_triggered OR limit_exceeded;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to track feature usage
CREATE OR REPLACE FUNCTION track_feature_usage(
  p_workspace_id UUID,
  p_user_id UUID,
  p_feature_name VARCHAR(100),
  p_feature_category VARCHAR(50) DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}',
  p_session_id VARCHAR(100) DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  usage_id UUID;
BEGIN
  INSERT INTO feature_usage (
    workspace_id,
    user_id,
    feature_name,
    feature_category,
    metadata,
    session_id
  ) VALUES (
    p_workspace_id,
    p_user_id,
    p_feature_name,
    p_feature_category,
    p_metadata,
    p_session_id
  ) RETURNING id INTO usage_id;
  
  RETURN usage_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get usage summary
CREATE OR REPLACE FUNCTION get_usage_summary(
  p_workspace_id UUID,
  p_period_start DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_period_end DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  metric_type VARCHAR(50),
  provider VARCHAR(50),
  total_units BIGINT,
  total_cost DECIMAL(10, 4),
  request_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    um.metric_type,
    um.provider,
    SUM(COALESCE(um.total_tokens, um.units_used))::BIGINT as total_units,
    SUM(um.total_cost) as total_cost,
    COUNT(*)::BIGINT as request_count
  FROM usage_metrics um
  WHERE um.workspace_id = p_workspace_id
    AND um.billing_period BETWEEN p_period_start AND p_period_end
  GROUP BY um.metric_type, um.provider
  ORDER BY total_cost DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_usage_limits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_usage_limits_updated_at
  BEFORE UPDATE ON usage_limits
  FOR EACH ROW
  EXECUTE FUNCTION update_usage_limits_updated_at();

CREATE TRIGGER trigger_usage_aggregations_updated_at
  BEFORE UPDATE ON usage_aggregations
  FOR EACH ROW
  EXECUTE FUNCTION update_usage_limits_updated_at();

-- Insert default AI model pricing
INSERT INTO ai_model_pricing (provider, model_name, input_price_per_1k, output_price_per_1k, max_tokens, context_window, supports_functions, description, performance_tier) VALUES
-- OpenAI Models
('openai', 'gpt-4o', 0.00500, 0.01500, 4096, 128000, true, 'Latest GPT-4 Omni model with vision and function calling', 'premium'),
('openai', 'gpt-4o-mini', 0.00015, 0.00060, 16384, 128000, true, 'Efficient GPT-4 Omni model for cost-effective use', 'advanced'),
('openai', 'gpt-4-turbo', 0.01000, 0.03000, 4096, 128000, true, 'High-performance GPT-4 Turbo model', 'premium'),
('openai', 'gpt-3.5-turbo', 0.00050, 0.00150, 4096, 16385, true, 'Fast and efficient GPT-3.5 model', 'basic'),

-- Anthropic Models
('anthropic', 'claude-3-5-sonnet-20241022', 0.00300, 0.01500, 8192, 200000, true, 'Latest Claude 3.5 Sonnet with enhanced capabilities', 'premium'),
('anthropic', 'claude-3-sonnet-20240229', 0.00300, 0.01500, 4096, 200000, false, 'Balanced Claude 3 Sonnet model', 'advanced'),
('anthropic', 'claude-3-haiku-20240307', 0.00025, 0.00125, 4096, 200000, false, 'Fast and cost-effective Claude 3 Haiku', 'basic'),

-- Future models (disabled by default)
('openai', 'gpt-5', 0.02000, 0.06000, 8192, 200000, true, 'Next-generation GPT model (placeholder)', 'premium')
ON CONFLICT (provider, model_name, model_version) DO NOTHING;

-- Update the last model to be inactive (placeholder)
UPDATE ai_model_pricing SET is_active = false WHERE model_name = 'gpt-5';

-- Sample usage limits for different subscription tiers
DO $$
DECLARE
  workspace_uuid UUID;
BEGIN
  -- Get first workspace for demo data
  SELECT id INTO workspace_uuid FROM workspaces LIMIT 1;
  
  IF workspace_uuid IS NOT NULL THEN
    -- Starter tier limits
    INSERT INTO usage_limits (
      workspace_id,
      metric_type,
      limit_type,
      monthly_limit,
      daily_limit,
      burst_limit,
      warning_threshold
    ) VALUES 
    (workspace_uuid, 'ai_tokens', 'hard', 100000, 5000, 1000, 0.8),
    (workspace_uuid, 'emails_sent', 'hard', 1000, 50, 20, 0.9),
    (workspace_uuid, 'leads_enriched', 'hard', 500, 25, 10, 0.8);
  END IF;
END $$;