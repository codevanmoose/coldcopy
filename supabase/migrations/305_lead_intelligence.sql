-- Lead Intelligence & Scoring Tables
-- This migration adds comprehensive lead scoring and intelligence capabilities

-- Lead scores table
CREATE TABLE lead_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Core scores (0-100)
  total_score INTEGER NOT NULL DEFAULT 0 CHECK (total_score >= 0 AND total_score <= 100),
  engagement_score INTEGER NOT NULL DEFAULT 0 CHECK (engagement_score >= 0 AND engagement_score <= 100),
  profile_score INTEGER NOT NULL DEFAULT 0 CHECK (profile_score >= 0 AND profile_score <= 100),
  behavior_score INTEGER NOT NULL DEFAULT 0 CHECK (behavior_score >= 0 AND behavior_score <= 100),
  intent_score INTEGER NOT NULL DEFAULT 0 CHECK (intent_score >= 0 AND intent_score <= 100),
  fit_score INTEGER NOT NULL DEFAULT 0 CHECK (fit_score >= 0 AND fit_score <= 100),
  
  -- Score breakdown
  score_breakdown JSONB NOT NULL DEFAULT '{}',
  
  -- Predictive scores
  predictive_scores JSONB DEFAULT '{}',
  
  -- Lead status flags
  is_hot BOOLEAN DEFAULT false,
  is_qualified BOOLEAN DEFAULT false,
  is_engaged BOOLEAN DEFAULT false,
  requires_nurturing BOOLEAN DEFAULT false,
  
  -- Score factors
  positive_factors JSONB DEFAULT '[]',
  negative_factors JSONB DEFAULT '[]',
  
  -- Intelligence insights
  insights JSONB DEFAULT '[]',
  recommendations TEXT[] DEFAULT '{}',
  
  -- Metadata
  scoring_model TEXT DEFAULT 'v2.0',
  scoring_version TEXT DEFAULT '2.0.0',
  last_calculated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one score per lead
  UNIQUE(lead_id)
);

-- Lead score history table
CREATE TABLE lead_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Score snapshot
  score INTEGER NOT NULL,
  change INTEGER DEFAULT 0,
  reason TEXT,
  
  -- Score components at this time
  score_components JSONB DEFAULT '{}',
  
  -- Timestamp
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lead activities table
CREATE TABLE lead_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Activity details
  activity_type TEXT NOT NULL,
  activity_channel TEXT NOT NULL,
  activity_data JSONB DEFAULT '{}',
  score_impact INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Buying signals table
CREATE TABLE buying_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Signal details
  signal_type TEXT NOT NULL CHECK (signal_type IN ('high_intent', 'medium_intent', 'low_intent', 'negative')),
  signal_name TEXT NOT NULL,
  description TEXT,
  confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  
  -- Signal source
  source TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Scoring rules table
CREATE TABLE scoring_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Rule definition
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  condition JSONB NOT NULL,
  score_impact INTEGER NOT NULL,
  
  -- Rule status
  is_active BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT false,
  
  -- Metadata
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lead segments table
CREATE TABLE lead_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Segment definition
  name TEXT NOT NULL,
  description TEXT,
  criteria JSONB NOT NULL,
  
  -- Segment stats
  lead_count INTEGER DEFAULT 0,
  average_score DECIMAL(5,2) DEFAULT 0,
  last_calculated TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lead segment members table
CREATE TABLE lead_segment_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id UUID NOT NULL REFERENCES lead_segments(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  
  -- Membership details
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  score_at_addition INTEGER,
  
  -- Ensure unique membership
  UNIQUE(segment_id, lead_id)
);

-- Score alerts table
CREATE TABLE score_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Alert definition
  name TEXT NOT NULL,
  condition JSONB NOT NULL,
  channels TEXT[] NOT NULL DEFAULT '{}',
  recipients TEXT[] NOT NULL DEFAULT '{}',
  
  -- Alert status
  is_active BOOLEAN DEFAULT true,
  last_triggered TIMESTAMP WITH TIME ZONE,
  trigger_count INTEGER DEFAULT 0,
  
  -- Metadata
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_lead_scores_lead_id ON lead_scores(lead_id);
CREATE INDEX idx_lead_scores_workspace_id ON lead_scores(workspace_id);
CREATE INDEX idx_lead_scores_total_score ON lead_scores(total_score DESC);
CREATE INDEX idx_lead_scores_is_hot ON lead_scores(is_hot) WHERE is_hot = true;
CREATE INDEX idx_lead_scores_last_calculated ON lead_scores(last_calculated);

CREATE INDEX idx_lead_score_history_lead_id ON lead_score_history(lead_id);
CREATE INDEX idx_lead_score_history_created_at ON lead_score_history(created_at);

CREATE INDEX idx_lead_activities_lead_id ON lead_activities(lead_id);
CREATE INDEX idx_lead_activities_activity_type ON lead_activities(activity_type);
CREATE INDEX idx_lead_activities_created_at ON lead_activities(created_at);

CREATE INDEX idx_buying_signals_lead_id ON buying_signals(lead_id);
CREATE INDEX idx_buying_signals_workspace_id ON buying_signals(workspace_id);
CREATE INDEX idx_buying_signals_signal_type ON buying_signals(signal_type);
CREATE INDEX idx_buying_signals_detected_at ON buying_signals(detected_at);

CREATE INDEX idx_scoring_rules_workspace_id ON scoring_rules(workspace_id);
CREATE INDEX idx_scoring_rules_category ON scoring_rules(category);
CREATE INDEX idx_scoring_rules_is_active ON scoring_rules(is_active);

CREATE INDEX idx_lead_segments_workspace_id ON lead_segments(workspace_id);
CREATE INDEX idx_lead_segment_members_segment_id ON lead_segment_members(segment_id);
CREATE INDEX idx_lead_segment_members_lead_id ON lead_segment_members(lead_id);

-- RLS Policies

-- Lead scores
ALTER TABLE lead_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view lead scores in their workspace" ON lead_scores
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can manage lead scores" ON lead_scores
  FOR ALL USING (true);

-- Lead score history
ALTER TABLE lead_score_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view score history in their workspace" ON lead_score_history
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

-- Lead activities
ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view activities in their workspace" ON lead_activities
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

-- Buying signals
ALTER TABLE buying_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view buying signals in their workspace" ON buying_signals
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

-- Scoring rules
ALTER TABLE scoring_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view scoring rules in their workspace" ON scoring_rules
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage scoring rules" ON scoring_rules
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid() 
      AND role IN ('workspace_admin', 'campaign_manager')
    )
  );

-- Lead segments
ALTER TABLE lead_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view segments in their workspace" ON lead_segments
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Campaign managers can manage segments" ON lead_segments
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid() 
      AND role IN ('workspace_admin', 'campaign_manager')
    )
  );

-- Functions for lead scoring

-- Function to calculate lead score
CREATE OR REPLACE FUNCTION calculate_lead_score(p_lead_id UUID)
RETURNS INTEGER AS $$
DECLARE
  lead_record leads%ROWTYPE;
  profile_score INTEGER := 0;
  engagement_score INTEGER := 0;
  behavior_score INTEGER := 0;
  intent_score INTEGER := 0;
  fit_score INTEGER := 0;
  total_score INTEGER := 0;
BEGIN
  -- Get lead record
  SELECT * INTO lead_record FROM leads WHERE id = p_lead_id;
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  
  -- Calculate profile score (simplified)
  profile_score := 50; -- Base score
  IF lead_record.title IS NOT NULL THEN profile_score := profile_score + 10; END IF;
  IF lead_record.company IS NOT NULL THEN profile_score := profile_score + 10; END IF;
  IF lead_record.phone IS NOT NULL THEN profile_score := profile_score + 5; END IF;
  IF lead_record.linkedin_url IS NOT NULL THEN profile_score := profile_score + 5; END IF;
  
  -- Calculate engagement score (simplified)
  SELECT COUNT(*) * 5 INTO engagement_score
  FROM email_events
  WHERE lead_id = p_lead_id
  AND event_type IN ('opened', 'clicked')
  AND created_at > NOW() - INTERVAL '30 days';
  
  engagement_score := LEAST(engagement_score, 100);
  
  -- Set default scores for other components
  behavior_score := 60;
  intent_score := 70;
  fit_score := 65;
  
  -- Calculate total score (weighted average)
  total_score := (
    profile_score * 0.2 +
    engagement_score * 0.25 +
    behavior_score * 0.2 +
    intent_score * 0.25 +
    fit_score * 0.1
  )::INTEGER;
  
  -- Update or insert score
  INSERT INTO lead_scores (
    lead_id,
    workspace_id,
    total_score,
    profile_score,
    engagement_score,
    behavior_score,
    intent_score,
    fit_score,
    is_hot,
    is_qualified,
    is_engaged,
    requires_nurturing
  ) VALUES (
    p_lead_id,
    lead_record.workspace_id,
    total_score,
    profile_score,
    engagement_score,
    behavior_score,
    intent_score,
    fit_score,
    total_score >= 80,
    total_score >= 60 AND fit_score >= 70,
    engagement_score >= 70,
    total_score < 60 OR engagement_score < 50
  )
  ON CONFLICT (lead_id) DO UPDATE SET
    total_score = EXCLUDED.total_score,
    profile_score = EXCLUDED.profile_score,
    engagement_score = EXCLUDED.engagement_score,
    behavior_score = EXCLUDED.behavior_score,
    intent_score = EXCLUDED.intent_score,
    fit_score = EXCLUDED.fit_score,
    is_hot = EXCLUDED.is_hot,
    is_qualified = EXCLUDED.is_qualified,
    is_engaged = EXCLUDED.is_engaged,
    requires_nurturing = EXCLUDED.requires_nurturing,
    last_calculated = NOW();
  
  -- Add to history
  INSERT INTO lead_score_history (
    lead_id,
    workspace_id,
    score,
    change,
    reason
  ) VALUES (
    p_lead_id,
    lead_record.workspace_id,
    total_score,
    0, -- Calculate change in application
    'Scheduled recalculation'
  );
  
  RETURN total_score;
END;
$$ LANGUAGE plpgsql;

-- Function to track lead activity
CREATE OR REPLACE FUNCTION track_lead_activity(
  p_lead_id UUID,
  p_activity_type TEXT,
  p_activity_channel TEXT,
  p_activity_data JSONB DEFAULT '{}'
)
RETURNS VOID AS $$
DECLARE
  workspace_id UUID;
  score_impact INTEGER := 0;
BEGIN
  -- Get workspace_id
  SELECT l.workspace_id INTO workspace_id
  FROM leads l
  WHERE l.id = p_lead_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Calculate score impact based on activity type
  CASE p_activity_type
    WHEN 'email_opened' THEN score_impact := 2;
    WHEN 'email_clicked' THEN score_impact := 5;
    WHEN 'email_replied' THEN score_impact := 10;
    WHEN 'form_submitted' THEN score_impact := 15;
    WHEN 'demo_requested' THEN score_impact := 20;
    WHEN 'pricing_viewed' THEN score_impact := 15;
    ELSE score_impact := 1;
  END CASE;
  
  -- Insert activity
  INSERT INTO lead_activities (
    lead_id,
    workspace_id,
    activity_type,
    activity_channel,
    activity_data,
    score_impact
  ) VALUES (
    p_lead_id,
    workspace_id,
    p_activity_type,
    p_activity_channel,
    p_activity_data,
    score_impact
  );
  
  -- Trigger score recalculation
  PERFORM calculate_lead_score(p_lead_id);
END;
$$ LANGUAGE plpgsql;

-- Function to detect buying signals
CREATE OR REPLACE FUNCTION detect_buying_signals(p_lead_id UUID)
RETURNS INTEGER AS $$
DECLARE
  workspace_id UUID;
  signal_count INTEGER := 0;
BEGIN
  -- Get workspace_id
  SELECT l.workspace_id INTO workspace_id
  FROM leads l
  WHERE l.id = p_lead_id;
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  
  -- Delete existing signals older than 30 days
  DELETE FROM buying_signals
  WHERE lead_id = p_lead_id
  AND detected_at < NOW() - INTERVAL '30 days';
  
  -- Check for high email engagement
  IF EXISTS (
    SELECT 1
    FROM email_events
    WHERE lead_id = p_lead_id
    AND event_type = 'clicked'
    AND created_at > NOW() - INTERVAL '14 days'
    GROUP BY lead_id
    HAVING COUNT(*) >= 5
  ) THEN
    INSERT INTO buying_signals (
      lead_id,
      workspace_id,
      signal_type,
      signal_name,
      description,
      confidence,
      source
    ) VALUES (
      p_lead_id,
      workspace_id,
      'high_intent',
      'High Email Engagement',
      'Multiple email clicks in recent period',
      0.85,
      'email_tracking'
    ) ON CONFLICT DO NOTHING;
    
    signal_count := signal_count + 1;
  END IF;
  
  -- Check for pricing page visits
  IF EXISTS (
    SELECT 1
    FROM email_events
    WHERE lead_id = p_lead_id
    AND event_type = 'clicked'
    AND metadata->>'link_url' LIKE '%pricing%'
    AND created_at > NOW() - INTERVAL '7 days'
  ) THEN
    INSERT INTO buying_signals (
      lead_id,
      workspace_id,
      signal_type,
      signal_name,
      description,
      confidence,
      source
    ) VALUES (
      p_lead_id,
      workspace_id,
      'high_intent',
      'Pricing Interest',
      'Visited pricing page',
      0.9,
      'email_tracking'
    ) ON CONFLICT DO NOTHING;
    
    signal_count := signal_count + 1;
  END IF;
  
  RETURN signal_count;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_lead_scores_updated_at 
  BEFORE UPDATE ON lead_scores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scoring_rules_updated_at 
  BEFORE UPDATE ON scoring_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lead_segments_updated_at 
  BEFORE UPDATE ON lead_segments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_score_alerts_updated_at 
  BEFORE UPDATE ON score_alerts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default scoring rules
INSERT INTO scoring_rules (workspace_id, name, category, condition, score_impact, is_system) VALUES
-- Note: These would need to be inserted per workspace in practice
(gen_random_uuid(), 'Email Open', 'engagement', '{"field": "email_opened", "value": true}', 2, true),
(gen_random_uuid(), 'Email Click', 'engagement', '{"field": "email_clicked", "value": true}', 5, true),
(gen_random_uuid(), 'Email Reply', 'engagement', '{"field": "email_replied", "value": true}', 10, true),
(gen_random_uuid(), 'Senior Title', 'profile', '{"field": "title", "contains": ["director", "vp", "chief"]}', 20, true),
(gen_random_uuid(), 'Target Industry', 'firmographic', '{"field": "industry", "in": ["technology", "software", "saas"]}', 15, true);

-- Create indexes on JSONB fields for better performance
CREATE INDEX idx_lead_scores_score_breakdown_gin ON lead_scores USING gin(score_breakdown);
CREATE INDEX idx_buying_signals_metadata_gin ON buying_signals USING gin(metadata);
CREATE INDEX idx_scoring_rules_condition_gin ON scoring_rules USING gin(condition);
CREATE INDEX idx_lead_segments_criteria_gin ON lead_segments USING gin(criteria);