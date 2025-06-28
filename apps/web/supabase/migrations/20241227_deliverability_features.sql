-- Spam Check Logs Table
CREATE TABLE IF NOT EXISTS spam_check_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Email content analyzed
  subject VARCHAR(255) NOT NULL,
  
  -- Spam analysis results
  spam_score INTEGER NOT NULL CHECK (spam_score >= 0 AND spam_score <= 100),
  spam_level VARCHAR(10) NOT NULL CHECK (spam_level IN ('low', 'medium', 'high')),
  issues_count INTEGER DEFAULT 0,
  word_count INTEGER DEFAULT 0,
  readability_score INTEGER DEFAULT 0,
  
  -- Metadata
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DNS Check Logs Table
CREATE TABLE IF NOT EXISTS dns_check_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Domain checked
  domain VARCHAR(255) NOT NULL,
  
  -- DNS authentication scores
  overall_score INTEGER NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  spf_score INTEGER NOT NULL CHECK (spf_score >= 0 AND spf_score <= 100),
  dkim_score INTEGER NOT NULL CHECK (dkim_score >= 0 AND dkim_score <= 100),
  dmarc_score INTEGER NOT NULL CHECK (dmarc_score >= 0 AND dmarc_score <= 100),
  
  -- Validation status
  spf_valid BOOLEAN DEFAULT false,
  dkim_valid BOOLEAN DEFAULT false,
  dmarc_valid BOOLEAN DEFAULT false,
  
  -- Recommendations
  recommendations_count INTEGER DEFAULT 0,
  
  -- Metadata
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email Bounces Table
CREATE TABLE IF NOT EXISTS email_bounces (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Message identification
  message_id VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  
  -- Bounce details
  bounce_type VARCHAR(20) NOT NULL CHECK (bounce_type IN ('hard', 'soft', 'complaint', 'delivery_delay')),
  bounce_subtype VARCHAR(50),
  diagnostic_code TEXT,
  description TEXT,
  
  -- Campaign relation
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  
  -- Timestamps
  bounce_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Suppression List Table
CREATE TABLE IF NOT EXISTS suppression_list (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Email being suppressed
  email VARCHAR(255) NOT NULL,
  
  -- Suppression details
  reason VARCHAR(20) NOT NULL CHECK (reason IN ('hard_bounce', 'soft_bounce', 'complaint', 'unsubscribe', 'manual')),
  bounce_count INTEGER DEFAULT 0,
  last_bounce_date TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  added_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint per workspace
  UNIQUE(workspace_id, email)
);

-- Domain Reputation Table
CREATE TABLE IF NOT EXISTS domain_reputation (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Domain being tracked
  domain VARCHAR(255) NOT NULL,
  
  -- Reputation metrics
  reputation VARCHAR(20) NOT NULL DEFAULT 'fair' CHECK (reputation IN ('excellent', 'good', 'fair', 'poor', 'blacklisted')),
  bounce_rate DECIMAL(5,2) DEFAULT 0.0,
  complaint_rate DECIMAL(5,2) DEFAULT 0.0,
  delivery_rate DECIMAL(5,2) DEFAULT 100.0,
  
  -- Email statistics
  total_sent INTEGER DEFAULT 0,
  total_bounced INTEGER DEFAULT 0,
  total_complaints INTEGER DEFAULT 0,
  total_delivered INTEGER DEFAULT 0,
  
  -- Timestamps
  last_checked TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint per workspace
  UNIQUE(workspace_id, domain)
);

-- Deliverability Insights Table (for storing aggregated metrics)
CREATE TABLE IF NOT EXISTS deliverability_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Time period
  date DATE NOT NULL,
  
  -- Aggregate metrics
  emails_sent INTEGER DEFAULT 0,
  emails_delivered INTEGER DEFAULT 0,
  emails_bounced INTEGER DEFAULT 0,
  emails_complained INTEGER DEFAULT 0,
  
  -- Calculated rates
  delivery_rate DECIMAL(5,2) DEFAULT 0.0,
  bounce_rate DECIMAL(5,2) DEFAULT 0.0,
  complaint_rate DECIMAL(5,2) DEFAULT 0.0,
  
  -- Reputation score
  overall_score INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint per workspace per date
  UNIQUE(workspace_id, date)
);

-- Add indexes for performance
CREATE INDEX idx_spam_check_logs_workspace_id ON spam_check_logs(workspace_id);
CREATE INDEX idx_spam_check_logs_checked_at ON spam_check_logs(checked_at DESC);

CREATE INDEX idx_dns_check_logs_workspace_id ON dns_check_logs(workspace_id);
CREATE INDEX idx_dns_check_logs_domain ON dns_check_logs(domain);
CREATE INDEX idx_dns_check_logs_checked_at ON dns_check_logs(checked_at DESC);

CREATE INDEX idx_email_bounces_workspace_id ON email_bounces(workspace_id);
CREATE INDEX idx_email_bounces_message_id ON email_bounces(message_id);
CREATE INDEX idx_email_bounces_email ON email_bounces(email);
CREATE INDEX idx_email_bounces_bounce_type ON email_bounces(bounce_type);
CREATE INDEX idx_email_bounces_timestamp ON email_bounces(bounce_timestamp DESC);

CREATE INDEX idx_suppression_list_workspace_id ON suppression_list(workspace_id);
CREATE INDEX idx_suppression_list_email ON suppression_list(email);
CREATE INDEX idx_suppression_list_active ON suppression_list(is_active) WHERE is_active = true;

CREATE INDEX idx_domain_reputation_workspace_id ON domain_reputation(workspace_id);
CREATE INDEX idx_domain_reputation_domain ON domain_reputation(domain);
CREATE INDEX idx_domain_reputation_reputation ON domain_reputation(reputation);

CREATE INDEX idx_deliverability_insights_workspace_id ON deliverability_insights(workspace_id);
CREATE INDEX idx_deliverability_insights_date ON deliverability_insights(date DESC);

-- Enable RLS
ALTER TABLE spam_check_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE dns_check_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_bounces ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppression_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_reputation ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliverability_insights ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view spam checks in their workspace" ON spam_check_logs
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM user_profiles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert spam checks in their workspace" ON spam_check_logs
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM user_profiles 
      WHERE user_id = auth.uid()
    ) AND user_id = auth.uid()
  );

CREATE POLICY "Users can view DNS checks in their workspace" ON dns_check_logs
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM user_profiles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert DNS checks in their workspace" ON dns_check_logs
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM user_profiles 
      WHERE user_id = auth.uid()
    ) AND user_id = auth.uid()
  );

CREATE POLICY "Users can view bounces in their workspace" ON email_bounces
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM user_profiles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert bounces" ON email_bounces
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can manage suppression list in their workspace" ON suppression_list
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM user_profiles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view domain reputation in their workspace" ON domain_reputation
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM user_profiles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can manage domain reputation" ON domain_reputation
  FOR ALL USING (true);

CREATE POLICY "Users can view deliverability insights in their workspace" ON deliverability_insights
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM user_profiles 
      WHERE user_id = auth.uid()
    )
  );

-- Functions for updating timestamps
CREATE OR REPLACE FUNCTION update_suppression_list_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_domain_reputation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_deliverability_insights_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER trigger_suppression_list_updated_at
  BEFORE UPDATE ON suppression_list
  FOR EACH ROW
  EXECUTE FUNCTION update_suppression_list_updated_at();

CREATE TRIGGER trigger_domain_reputation_updated_at
  BEFORE UPDATE ON domain_reputation
  FOR EACH ROW
  EXECUTE FUNCTION update_domain_reputation_updated_at();

CREATE TRIGGER trigger_deliverability_insights_updated_at
  BEFORE UPDATE ON deliverability_insights
  FOR EACH ROW
  EXECUTE FUNCTION update_deliverability_insights_updated_at();

-- Function to check if email is suppressed
CREATE OR REPLACE FUNCTION is_email_suppressed(
  p_workspace_id UUID,
  p_email VARCHAR(255)
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM suppression_list 
    WHERE workspace_id = p_workspace_id 
    AND email = LOWER(p_email)
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add email to suppression list
CREATE OR REPLACE FUNCTION add_to_suppression_list(
  p_workspace_id UUID,
  p_email VARCHAR(255),
  p_reason VARCHAR(20),
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  suppression_id UUID;
BEGIN
  INSERT INTO suppression_list (
    workspace_id,
    email,
    reason,
    notes,
    bounce_count,
    is_active,
    added_date
  ) VALUES (
    p_workspace_id,
    LOWER(p_email),
    p_reason,
    p_notes,
    CASE WHEN p_reason IN ('hard_bounce', 'soft_bounce') THEN 1 ELSE 0 END,
    true,
    NOW()
  )
  ON CONFLICT (workspace_id, email) 
  DO UPDATE SET
    reason = EXCLUDED.reason,
    notes = EXCLUDED.notes,
    bounce_count = suppression_list.bounce_count + 1,
    last_bounce_date = NOW(),
    updated_at = NOW()
  RETURNING id INTO suppression_id;
  
  RETURN suppression_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get deliverability stats for workspace
CREATE OR REPLACE FUNCTION get_deliverability_stats(
  p_workspace_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  WITH stats AS (
    SELECT 
      COALESCE(SUM(emails_sent), 0) as total_sent,
      COALESCE(SUM(emails_delivered), 0) as total_delivered,
      COALESCE(SUM(emails_bounced), 0) as total_bounced,
      COALESCE(SUM(emails_complained), 0) as total_complained,
      CASE 
        WHEN SUM(emails_sent) > 0 THEN 
          ROUND((SUM(emails_delivered)::DECIMAL / SUM(emails_sent) * 100), 2)
        ELSE 0 
      END as delivery_rate,
      CASE 
        WHEN SUM(emails_sent) > 0 THEN 
          ROUND((SUM(emails_bounced)::DECIMAL / SUM(emails_sent) * 100), 2)
        ELSE 0 
      END as bounce_rate,
      CASE 
        WHEN SUM(emails_sent) > 0 THEN 
          ROUND((SUM(emails_complained)::DECIMAL / SUM(emails_sent) * 100), 2)
        ELSE 0 
      END as complaint_rate
    FROM deliverability_insights 
    WHERE workspace_id = p_workspace_id 
    AND date >= CURRENT_DATE - INTERVAL '1 day' * p_days
  )
  SELECT json_build_object(
    'totalSent', total_sent,
    'totalDelivered', total_delivered,
    'totalBounced', total_bounced,
    'totalComplaints', total_complained,
    'deliveryRate', delivery_rate,
    'bounceRate', bounce_rate,
    'complaintRate', complaint_rate,
    'reputation', CASE 
      WHEN complaint_rate > 0.5 OR bounce_rate > 10 THEN 'poor'
      WHEN complaint_rate > 0.3 OR bounce_rate > 7 THEN 'fair'
      WHEN complaint_rate > 0.1 OR bounce_rate > 5 THEN 'good'
      ELSE 'excellent'
    END
  ) INTO result
  FROM stats;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Sample data for testing
DO $$
DECLARE
  workspace_uuid UUID;
  user_uuid UUID;
BEGIN
  -- Get first workspace and user for demo data
  SELECT id INTO workspace_uuid FROM workspaces LIMIT 1;
  SELECT id INTO user_uuid FROM auth.users LIMIT 1;
  
  IF workspace_uuid IS NOT NULL AND user_uuid IS NOT NULL THEN
    -- Insert sample deliverability insights for the last 30 days
    INSERT INTO deliverability_insights (workspace_id, date, emails_sent, emails_delivered, emails_bounced, emails_complained)
    SELECT 
      workspace_uuid,
      CURRENT_DATE - INTERVAL '1 day' * generate_series(0, 29),
      (RANDOM() * 100 + 50)::INTEGER,
      (RANDOM() * 95 + 45)::INTEGER,
      (RANDOM() * 5 + 1)::INTEGER,
      (RANDOM() * 2)::INTEGER;
    
    -- Update calculated rates
    UPDATE deliverability_insights 
    SET 
      delivery_rate = CASE WHEN emails_sent > 0 THEN ROUND((emails_delivered::DECIMAL / emails_sent * 100), 2) ELSE 0 END,
      bounce_rate = CASE WHEN emails_sent > 0 THEN ROUND((emails_bounced::DECIMAL / emails_sent * 100), 2) ELSE 0 END,
      complaint_rate = CASE WHEN emails_sent > 0 THEN ROUND((emails_complained::DECIMAL / emails_sent * 100), 2) ELSE 0 END,
      overall_score = CASE 
        WHEN emails_sent > 0 THEN 
          GREATEST(0, 100 - (emails_bounced::DECIMAL / emails_sent * 100) * 5 - (emails_complained::DECIMAL / emails_sent * 100) * 20)
        ELSE 85 
      END
    WHERE workspace_id = workspace_uuid;
    
    -- Insert sample domain reputation data
    INSERT INTO domain_reputation (workspace_id, domain, reputation, bounce_rate, complaint_rate, delivery_rate, total_sent, total_bounced, total_complaints, total_delivered)
    VALUES 
      (workspace_uuid, 'gmail.com', 'excellent', 1.2, 0.05, 98.75, 5000, 60, 3, 4937),
      (workspace_uuid, 'outlook.com', 'good', 2.8, 0.1, 97.1, 3200, 90, 3, 3107),
      (workspace_uuid, 'yahoo.com', 'fair', 4.5, 0.2, 95.3, 2100, 95, 4, 2001),
      (workspace_uuid, 'corporate.com', 'good', 2.1, 0.0, 97.9, 800, 17, 0, 783);
    
    -- Insert sample suppression list entries
    INSERT INTO suppression_list (workspace_id, email, reason, bounce_count, is_active)
    VALUES 
      (workspace_uuid, 'bounced@example.com', 'hard_bounce', 1, true),
      (workspace_uuid, 'complainer@test.com', 'complaint', 0, true),
      (workspace_uuid, 'unsubscribed@demo.com', 'unsubscribe', 0, true),
      (workspace_uuid, 'manual@blocked.com', 'manual', 0, true);
  END IF;
END $$;