-- Growth Features: Referral Program & Retention
-- Create tables for referral system, user retention, and growth analytics

-- Referral Programs Table
CREATE TABLE IF NOT EXISTS referral_programs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Program details
  name VARCHAR(255) NOT NULL,
  description TEXT,
  program_type VARCHAR(50) DEFAULT 'standard', -- 'standard', 'tiered', 'custom'
  is_active BOOLEAN DEFAULT true,
  
  -- Reward configuration
  referrer_reward_type VARCHAR(50) DEFAULT 'credits', -- 'credits', 'cash', 'discount', 'subscription'
  referrer_reward_value DECIMAL(10, 2) DEFAULT 0,
  referrer_reward_unit VARCHAR(20) DEFAULT 'dollars', -- 'dollars', 'credits', 'percent', 'months'
  
  referee_reward_type VARCHAR(50) DEFAULT 'credits',
  referee_reward_value DECIMAL(10, 2) DEFAULT 0,
  referee_reward_unit VARCHAR(20) DEFAULT 'dollars',
  
  -- Limits and conditions
  max_referrals_per_user INTEGER,
  max_reward_per_user DECIMAL(10, 2),
  min_referee_spend DECIMAL(10, 2) DEFAULT 0,
  reward_trigger VARCHAR(50) DEFAULT 'signup', -- 'signup', 'first_payment', 'spend_threshold'
  
  -- Tracking
  total_referrals INTEGER DEFAULT 0,
  total_rewards_paid DECIMAL(10, 2) DEFAULT 0,
  
  -- Timestamps
  starts_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ends_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Referral Codes Table
CREATE TABLE IF NOT EXISTS referral_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES referral_programs(id) ON DELETE CASCADE,
  
  -- Code details
  code VARCHAR(50) NOT NULL UNIQUE,
  custom_landing_page TEXT, -- Custom URL or page content
  
  -- Usage tracking
  clicks_count INTEGER DEFAULT 0,
  signups_count INTEGER DEFAULT 0,
  conversions_count INTEGER DEFAULT 0,
  total_revenue DECIMAL(10, 2) DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE
);

-- Referrals Table
CREATE TABLE IF NOT EXISTS referrals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES referral_programs(id) ON DELETE CASCADE,
  referral_code_id UUID NOT NULL REFERENCES referral_codes(id) ON DELETE CASCADE,
  
  -- Participants
  referrer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referee_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  referee_workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  
  -- Referral details
  referee_email VARCHAR(255) NOT NULL,
  referee_name VARCHAR(255),
  referral_source VARCHAR(100), -- 'direct', 'email', 'social', 'widget'
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),
  
  -- Status tracking
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'signed_up', 'converted', 'rewarded', 'cancelled'
  conversion_value DECIMAL(10, 2) DEFAULT 0,
  
  -- Reward tracking
  referrer_reward_amount DECIMAL(10, 2) DEFAULT 0,
  referee_reward_amount DECIMAL(10, 2) DEFAULT 0,
  rewards_paid BOOLEAN DEFAULT false,
  
  -- Timestamps
  referred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  signed_up_at TIMESTAMP WITH TIME ZONE,
  converted_at TIMESTAMP WITH TIME ZONE,
  rewarded_at TIMESTAMP WITH TIME ZONE
);

-- Referral Rewards Table
CREATE TABLE IF NOT EXISTS referral_rewards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  referral_id UUID NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Reward details
  reward_type VARCHAR(50) NOT NULL, -- 'referrer', 'referee'
  reward_value_type VARCHAR(50) NOT NULL, -- 'credits', 'cash', 'discount', 'subscription'
  reward_amount DECIMAL(10, 2) NOT NULL,
  reward_unit VARCHAR(20) NOT NULL,
  
  -- Payment details
  payment_method VARCHAR(50), -- 'stripe', 'paypal', 'credits', 'discount_code'
  payment_reference VARCHAR(255),
  payment_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'paid', 'failed'
  
  -- Timestamps
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  paid_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE
);

-- User Retention Analytics Table
CREATE TABLE IF NOT EXISTS user_retention_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Cohort analysis
  cohort_month DATE NOT NULL, -- Month when user first signed up
  analysis_period DATE NOT NULL, -- Month being analyzed
  
  -- Activity metrics
  days_active INTEGER DEFAULT 0,
  sessions_count INTEGER DEFAULT 0,
  features_used JSONB DEFAULT '[]',
  
  -- Engagement metrics
  emails_sent INTEGER DEFAULT 0,
  campaigns_created INTEGER DEFAULT 0,
  leads_imported INTEGER DEFAULT 0,
  ai_tokens_used INTEGER DEFAULT 0,
  
  -- Retention status
  is_retained BOOLEAN DEFAULT false, -- Active in this period
  churn_risk_score DECIMAL(3, 2) DEFAULT 0, -- 0-1 score
  engagement_score DECIMAL(3, 2) DEFAULT 0, -- 0-1 score
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(workspace_id, user_id, analysis_period)
);

-- User Lifecycle Events Table
CREATE TABLE IF NOT EXISTS user_lifecycle_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Event details
  event_type VARCHAR(100) NOT NULL, -- 'onboard_started', 'first_campaign', 'churned', 'reactivated'
  event_category VARCHAR(50) NOT NULL, -- 'onboarding', 'engagement', 'retention', 'churn'
  event_data JSONB DEFAULT '{}',
  
  -- Context
  session_id VARCHAR(100),
  page_url TEXT,
  user_agent TEXT,
  
  -- Triggers
  triggered_by VARCHAR(50), -- 'user_action', 'system_event', 'scheduled_job'
  automation_id UUID, -- Reference to automation that triggered this
  
  -- Timestamps
  occurred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Retention Campaigns Table
CREATE TABLE IF NOT EXISTS retention_campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Campaign details
  name VARCHAR(255) NOT NULL,
  description TEXT,
  campaign_type VARCHAR(50) NOT NULL, -- 'winback', 'engagement', 'onboarding', 'milestone'
  
  -- Targeting
  target_audience JSONB NOT NULL, -- Conditions for targeting users
  churn_risk_threshold DECIMAL(3, 2), -- Target users above this churn risk
  days_inactive_threshold INTEGER, -- Target users inactive for X days
  
  -- Content
  email_template_id UUID,
  in_app_message TEXT,
  offer_type VARCHAR(50), -- 'discount', 'free_credits', 'feature_access', 'consultation'
  offer_value DECIMAL(10, 2),
  offer_duration_days INTEGER,
  
  -- Schedule
  trigger_condition VARCHAR(100) NOT NULL, -- 'churn_risk_increase', 'days_inactive', 'usage_drop'
  send_delay_hours INTEGER DEFAULT 0,
  max_sends_per_user INTEGER DEFAULT 1,
  
  -- Performance
  total_sent INTEGER DEFAULT 0,
  total_opened INTEGER DEFAULT 0,
  total_clicked INTEGER DEFAULT 0,
  total_converted INTEGER DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Retention Campaign Sends Table
CREATE TABLE IF NOT EXISTS retention_campaign_sends (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES retention_campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Send details
  channel VARCHAR(50) NOT NULL, -- 'email', 'in_app', 'push'
  recipient_email VARCHAR(255),
  subject_line VARCHAR(255),
  
  -- Personalization
  personalized_content JSONB DEFAULT '{}',
  offer_code VARCHAR(100),
  
  -- Tracking
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  converted_at TIMESTAMP WITH TIME ZONE,
  unsubscribed_at TIMESTAMP WITH TIME ZONE,
  
  -- Status
  status VARCHAR(50) DEFAULT 'sent', -- 'sent', 'delivered', 'opened', 'clicked', 'converted', 'failed'
  
  UNIQUE(campaign_id, user_id)
);

-- Growth Metrics Table
CREATE TABLE IF NOT EXISTS growth_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Time period
  metric_date DATE NOT NULL,
  metric_type VARCHAR(50) NOT NULL, -- 'daily', 'weekly', 'monthly'
  
  -- User metrics
  new_signups INTEGER DEFAULT 0,
  activated_users INTEGER DEFAULT 0, -- Users who completed onboarding
  active_users INTEGER DEFAULT 0,
  churned_users INTEGER DEFAULT 0,
  reactivated_users INTEGER DEFAULT 0,
  
  -- Referral metrics
  referral_signups INTEGER DEFAULT 0,
  referral_conversions INTEGER DEFAULT 0,
  referral_revenue DECIMAL(10, 2) DEFAULT 0,
  
  -- Revenue metrics
  mrr DECIMAL(10, 2) DEFAULT 0, -- Monthly Recurring Revenue
  arr DECIMAL(10, 2) DEFAULT 0, -- Annual Recurring Revenue
  customer_ltv DECIMAL(10, 2) DEFAULT 0, -- Customer Lifetime Value
  
  -- Engagement metrics
  avg_session_duration INTEGER DEFAULT 0, -- seconds
  avg_features_per_user DECIMAL(5, 2) DEFAULT 0,
  dau_mau_ratio DECIMAL(3, 2) DEFAULT 0, -- Daily/Monthly active users ratio
  
  -- Retention metrics
  day_1_retention DECIMAL(3, 2) DEFAULT 0,
  day_7_retention DECIMAL(3, 2) DEFAULT 0,
  day_30_retention DECIMAL(3, 2) DEFAULT 0,
  
  -- Timestamps
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(workspace_id, metric_date, metric_type)
);

-- Add indexes for performance
CREATE INDEX idx_referral_programs_workspace ON referral_programs(workspace_id);
CREATE INDEX idx_referral_programs_active ON referral_programs(is_active, starts_at, ends_at);

CREATE INDEX idx_referral_codes_workspace ON referral_codes(workspace_id);
CREATE INDEX idx_referral_codes_user ON referral_codes(user_id);
CREATE INDEX idx_referral_codes_code ON referral_codes(code);
CREATE INDEX idx_referral_codes_active ON referral_codes(is_active);

CREATE INDEX idx_referrals_workspace ON referrals(workspace_id);
CREATE INDEX idx_referrals_referrer ON referrals(referrer_user_id);
CREATE INDEX idx_referrals_referee ON referrals(referee_user_id);
CREATE INDEX idx_referrals_code ON referrals(referral_code_id);
CREATE INDEX idx_referrals_status ON referrals(status);
CREATE INDEX idx_referrals_referred_at ON referrals(referred_at);

CREATE INDEX idx_referral_rewards_workspace ON referral_rewards(workspace_id);
CREATE INDEX idx_referral_rewards_user ON referral_rewards(user_id);
CREATE INDEX idx_referral_rewards_status ON referral_rewards(payment_status);

CREATE INDEX idx_user_retention_workspace_period ON user_retention_analytics(workspace_id, analysis_period);
CREATE INDEX idx_user_retention_cohort ON user_retention_analytics(cohort_month);
CREATE INDEX idx_user_retention_user ON user_retention_analytics(user_id);

CREATE INDEX idx_user_lifecycle_workspace ON user_lifecycle_events(workspace_id);
CREATE INDEX idx_user_lifecycle_user ON user_lifecycle_events(user_id);
CREATE INDEX idx_user_lifecycle_type ON user_lifecycle_events(event_type, event_category);
CREATE INDEX idx_user_lifecycle_occurred_at ON user_lifecycle_events(occurred_at);

CREATE INDEX idx_retention_campaigns_workspace ON retention_campaigns(workspace_id);
CREATE INDEX idx_retention_campaigns_active ON retention_campaigns(is_active);
CREATE INDEX idx_retention_campaigns_type ON retention_campaigns(campaign_type);

CREATE INDEX idx_retention_campaign_sends_campaign ON retention_campaign_sends(campaign_id);
CREATE INDEX idx_retention_campaign_sends_user ON retention_campaign_sends(user_id);
CREATE INDEX idx_retention_campaign_sends_status ON retention_campaign_sends(status);

CREATE INDEX idx_growth_metrics_workspace_date ON growth_metrics(workspace_id, metric_date);
CREATE INDEX idx_growth_metrics_type ON growth_metrics(metric_type);

-- Enable RLS
ALTER TABLE referral_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_retention_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_lifecycle_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE retention_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE retention_campaign_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view referral programs for their workspace" ON referral_programs
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM user_profiles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace admins can manage referral programs" ON referral_programs
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM user_profiles 
      WHERE user_id = auth.uid() AND role IN ('workspace_admin', 'super_admin')
    )
  );

CREATE POLICY "Users can view referral codes for their workspace" ON referral_codes
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM user_profiles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their own referral codes" ON referral_codes
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can view referrals for their workspace" ON referrals
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM user_profiles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert referrals" ON referrals
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view their referral rewards" ON referral_rewards
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can view retention analytics for their workspace" ON user_retention_analytics
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM user_profiles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view lifecycle events for their workspace" ON user_lifecycle_events
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM user_profiles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view retention campaigns for their workspace" ON retention_campaigns
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM user_profiles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace admins can manage retention campaigns" ON retention_campaigns
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM user_profiles 
      WHERE user_id = auth.uid() AND role IN ('workspace_admin', 'super_admin')
    )
  );

CREATE POLICY "Users can view campaign sends for their workspace" ON retention_campaign_sends
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM user_profiles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view growth metrics for their workspace" ON growth_metrics
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM user_profiles 
      WHERE user_id = auth.uid()
    )
  );

-- Functions for referral tracking

-- Function to generate unique referral code
CREATE OR REPLACE FUNCTION generate_referral_code(
  p_workspace_id UUID,
  p_user_id UUID,
  p_program_id UUID,
  p_prefix VARCHAR(10) DEFAULT 'REF'
)
RETURNS VARCHAR(50) AS $$
DECLARE
  code VARCHAR(50);
  counter INTEGER := 0;
  max_attempts INTEGER := 100;
BEGIN
  LOOP
    -- Generate code with format: PREFIX-RANDOM6
    code := p_prefix || '-' || upper(substr(md5(random()::text), 1, 6));
    
    -- Check if code already exists
    IF NOT EXISTS (SELECT 1 FROM referral_codes WHERE code = code) THEN
      -- Insert the new referral code
      INSERT INTO referral_codes (
        workspace_id,
        user_id,
        program_id,
        code
      ) VALUES (
        p_workspace_id,
        p_user_id,
        p_program_id,
        code
      );
      
      RETURN code;
    END IF;
    
    counter := counter + 1;
    IF counter >= max_attempts THEN
      RAISE EXCEPTION 'Unable to generate unique referral code after % attempts', max_attempts;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to track referral click
CREATE OR REPLACE FUNCTION track_referral_click(
  p_referral_code VARCHAR(50),
  p_utm_source VARCHAR(100) DEFAULT NULL,
  p_utm_medium VARCHAR(100) DEFAULT NULL,
  p_utm_campaign VARCHAR(100) DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  code_record RECORD;
BEGIN
  -- Get referral code details
  SELECT * INTO code_record
  FROM referral_codes rc
  JOIN referral_programs rp ON rc.program_id = rp.id
  WHERE rc.code = p_referral_code
    AND rc.is_active = true
    AND rp.is_active = true
    AND (rp.ends_at IS NULL OR rp.ends_at > NOW());
  
  IF code_record.id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Update click count
  UPDATE referral_codes
  SET clicks_count = clicks_count + 1,
      last_used_at = NOW(),
      updated_at = NOW()
  WHERE id = code_record.id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process referral signup
CREATE OR REPLACE FUNCTION process_referral_signup(
  p_referral_code VARCHAR(50),
  p_referee_email VARCHAR(255),
  p_referee_name VARCHAR(255) DEFAULT NULL,
  p_referee_user_id UUID DEFAULT NULL,
  p_referee_workspace_id UUID DEFAULT NULL,
  p_referral_source VARCHAR(100) DEFAULT 'direct'
)
RETURNS UUID AS $$
DECLARE
  referral_id UUID;
  code_record RECORD;
  program_record RECORD;
BEGIN
  -- Get referral code and program details
  SELECT rc.*, rp.* INTO code_record
  FROM referral_codes rc
  JOIN referral_programs rp ON rc.program_id = rp.id
  WHERE rc.code = p_referral_code
    AND rc.is_active = true
    AND rp.is_active = true
    AND (rp.ends_at IS NULL OR rp.ends_at > NOW());
  
  IF code_record.id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Check if referee already exists
  IF EXISTS (
    SELECT 1 FROM referrals 
    WHERE referee_email = p_referee_email 
      AND referrer_user_id = code_record.user_id
  ) THEN
    RETURN NULL; -- Already referred
  END IF;
  
  -- Create referral record
  INSERT INTO referrals (
    workspace_id,
    program_id,
    referral_code_id,
    referrer_user_id,
    referee_user_id,
    referee_workspace_id,
    referee_email,
    referee_name,
    referral_source,
    status
  ) VALUES (
    code_record.workspace_id,
    code_record.program_id,
    code_record.id,
    code_record.user_id,
    p_referee_user_id,
    p_referee_workspace_id,
    p_referee_email,
    p_referee_name,
    p_referral_source,
    CASE WHEN p_referee_user_id IS NOT NULL THEN 'signed_up' ELSE 'pending' END
  ) RETURNING id INTO referral_id;
  
  -- Update counters
  UPDATE referral_codes
  SET signups_count = signups_count + 1,
      updated_at = NOW()
  WHERE id = code_record.id;
  
  UPDATE referral_programs
  SET total_referrals = total_referrals + 1,
      updated_at = NOW()
  WHERE id = code_record.program_id;
  
  -- Set signup timestamp if user already exists
  IF p_referee_user_id IS NOT NULL THEN
    UPDATE referrals
    SET signed_up_at = NOW()
    WHERE id = referral_id;
  END IF;
  
  RETURN referral_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate user retention
CREATE OR REPLACE FUNCTION calculate_user_retention(
  p_workspace_id UUID,
  p_analysis_period DATE DEFAULT CURRENT_DATE
)
RETURNS BOOLEAN AS $$
DECLARE
  user_record RECORD;
  cohort_date DATE;
  days_since_signup INTEGER;
  activity_data RECORD;
BEGIN
  -- Process each user in the workspace
  FOR user_record IN 
    SELECT up.user_id, up.created_at::date as signup_date
    FROM user_profiles up
    WHERE up.workspace_id = p_workspace_id
  LOOP
    cohort_date := date_trunc('month', user_record.signup_date)::date;
    days_since_signup := p_analysis_period - user_record.signup_date;
    
    -- Skip if user signed up after analysis period
    IF user_record.signup_date > p_analysis_period THEN
      CONTINUE;
    END IF;
    
    -- Get user activity for the analysis period
    SELECT 
      COALESCE(COUNT(DISTINCT DATE(created_at)), 0) as days_active,
      COALESCE(COUNT(*), 0) as total_events
    INTO activity_data
    FROM user_lifecycle_events
    WHERE user_id = user_record.user_id
      AND DATE(occurred_at) = p_analysis_period;
    
    -- Insert or update retention record
    INSERT INTO user_retention_analytics (
      workspace_id,
      user_id,
      cohort_month,
      analysis_period,
      days_active,
      is_retained,
      engagement_score
    ) VALUES (
      p_workspace_id,
      user_record.user_id,
      cohort_date,
      p_analysis_period,
      activity_data.days_active,
      activity_data.days_active > 0,
      LEAST(activity_data.total_events::decimal / 10, 1.0) -- Simple engagement score
    )
    ON CONFLICT (workspace_id, user_id, analysis_period)
    DO UPDATE SET
      days_active = EXCLUDED.days_active,
      is_retained = EXCLUDED.is_retained,
      engagement_score = EXCLUDED.engagement_score,
      updated_at = NOW();
  END LOOP;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to track lifecycle events
CREATE OR REPLACE FUNCTION track_lifecycle_event(
  p_workspace_id UUID,
  p_user_id UUID,
  p_event_type VARCHAR(100),
  p_event_category VARCHAR(50),
  p_event_data JSONB DEFAULT '{}',
  p_session_id VARCHAR(100) DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  event_id UUID;
BEGIN
  INSERT INTO user_lifecycle_events (
    workspace_id,
    user_id,
    event_type,
    event_category,
    event_data,
    session_id,
    triggered_by
  ) VALUES (
    p_workspace_id,
    p_user_id,
    p_event_type,
    p_event_category,
    p_event_data,
    p_session_id,
    'user_action'
  ) RETURNING id INTO event_id;
  
  RETURN event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers for updated_at fields
CREATE OR REPLACE FUNCTION update_growth_tables_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_referral_programs_updated_at
  BEFORE UPDATE ON referral_programs
  FOR EACH ROW
  EXECUTE FUNCTION update_growth_tables_updated_at();

CREATE TRIGGER trigger_referral_codes_updated_at
  BEFORE UPDATE ON referral_codes
  FOR EACH ROW
  EXECUTE FUNCTION update_growth_tables_updated_at();

CREATE TRIGGER trigger_retention_campaigns_updated_at
  BEFORE UPDATE ON retention_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_growth_tables_updated_at();

CREATE TRIGGER trigger_user_retention_analytics_updated_at
  BEFORE UPDATE ON user_retention_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_growth_tables_updated_at();

-- Insert default referral program
DO $$
DECLARE
  workspace_uuid UUID;
  program_uuid UUID;
BEGIN
  -- Get first workspace for demo data
  SELECT id INTO workspace_uuid FROM workspaces LIMIT 1;
  
  IF workspace_uuid IS NOT NULL THEN
    -- Create default referral program
    INSERT INTO referral_programs (
      workspace_id,
      name,
      description,
      referrer_reward_type,
      referrer_reward_value,
      referrer_reward_unit,
      referee_reward_type,
      referee_reward_value,
      referee_reward_unit,
      reward_trigger
    ) VALUES (
      workspace_uuid,
      'ColdCopy Referral Program',
      'Refer friends and earn credits for every successful signup!',
      'credits',
      50,
      'dollars',
      'credits',
      25,
      'dollars',
      'first_payment'
    ) RETURNING id INTO program_uuid;
    
    -- Create sample retention campaign
    INSERT INTO retention_campaigns (
      workspace_id,
      name,
      description,
      campaign_type,
      target_audience,
      churn_risk_threshold,
      days_inactive_threshold,
      trigger_condition,
      offer_type,
      offer_value,
      offer_duration_days
    ) VALUES (
      workspace_uuid,
      'Win-back Inactive Users',
      'Re-engage users who haven''t been active for 14+ days',
      'winback',
      '{"segment": "inactive_users", "conditions": {"days_inactive": {"gte": 14}}}',
      0.7,
      14,
      'days_inactive',
      'discount',
      30,
      30
    );
  END IF;
END $$;