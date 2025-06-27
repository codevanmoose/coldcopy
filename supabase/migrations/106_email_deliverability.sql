-- Email Deliverability Suite Schema
-- Ensure emails reach the inbox, not the spam folder

-- Domain reputation tracking
CREATE TABLE IF NOT EXISTS domain_reputation (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    
    -- Authentication status
    spf_record TEXT,
    spf_valid BOOLEAN DEFAULT false,
    dkim_record TEXT,
    dkim_valid BOOLEAN DEFAULT false,
    dmarc_record TEXT,
    dmarc_valid BOOLEAN DEFAULT false,
    
    -- Reputation scores
    overall_score INTEGER CHECK (overall_score BETWEEN 0 AND 100) DEFAULT 50,
    sender_score INTEGER CHECK (sender_score BETWEEN 0 AND 100),
    domain_age_days INTEGER,
    
    -- Blacklist status
    blacklisted BOOLEAN DEFAULT false,
    blacklist_details JSONB DEFAULT '[]',
    
    -- Sending statistics
    total_sent INTEGER DEFAULT 0,
    total_delivered INTEGER DEFAULT 0,
    total_bounced INTEGER DEFAULT 0,
    total_complained INTEGER DEFAULT 0,
    delivery_rate DECIMAL(5,2),
    bounce_rate DECIMAL(5,2),
    complaint_rate DECIMAL(5,2),
    
    -- Timestamps
    last_checked TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint
    CONSTRAINT unique_workspace_domain UNIQUE (workspace_id, domain)
);

-- Email spam analysis
CREATE TABLE IF NOT EXISTS spam_analysis (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    email_template_id UUID REFERENCES email_templates(id) ON DELETE CASCADE,
    
    -- Content being analyzed
    subject TEXT NOT NULL,
    preview_text TEXT,
    body_html TEXT,
    body_text TEXT,
    from_name TEXT,
    from_email TEXT,
    
    -- Spam scores
    overall_spam_score DECIMAL(4,2) CHECK (overall_spam_score BETWEEN 0 AND 10),
    spamassassin_score DECIMAL(4,2),
    
    -- Detailed analysis
    spam_triggers JSONB DEFAULT '[]', -- Array of triggered spam rules
    content_analysis JSONB DEFAULT '{}', -- Detailed content metrics
    
    -- Key metrics
    word_count INTEGER,
    link_count INTEGER,
    image_count INTEGER,
    caps_percentage DECIMAL(5,2),
    exclamation_count INTEGER,
    spam_word_count INTEGER,
    
    -- Recommendations
    recommendations JSONB DEFAULT '[]',
    risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    
    -- Inbox placement prediction
    gmail_placement TEXT CHECK (gmail_placement IN ('inbox', 'promotions', 'spam', 'unknown')),
    outlook_placement TEXT CHECK (outlook_placement IN ('inbox', 'junk', 'focused', 'other', 'unknown')),
    yahoo_placement TEXT CHECK (yahoo_placement IN ('inbox', 'spam', 'unknown')),
    
    analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_spam_analysis_workspace_campaign (workspace_id, campaign_id),
    INDEX idx_spam_analysis_score (workspace_id, overall_spam_score)
);

-- Inbox placement tests
CREATE TABLE IF NOT EXISTS inbox_placement_tests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    
    -- Test configuration
    test_name TEXT NOT NULL,
    from_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    
    -- Test seeds (email addresses at different providers)
    seed_emails JSONB NOT NULL DEFAULT '[]',
    
    -- Results
    status TEXT CHECK (status IN ('pending', 'running', 'completed', 'failed')) DEFAULT 'pending',
    
    -- Placement results by provider
    gmail_results JSONB DEFAULT '{}', -- {inbox: 5, promotions: 2, spam: 1}
    outlook_results JSONB DEFAULT '{}',
    yahoo_results JSONB DEFAULT '{}',
    apple_results JSONB DEFAULT '{}',
    other_results JSONB DEFAULT '{}',
    
    -- Overall metrics
    inbox_rate DECIMAL(5,2),
    spam_rate DECIMAL(5,2),
    missing_rate DECIMAL(5,2),
    
    -- Timing
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Email authentication monitoring
CREATE TABLE IF NOT EXISTS email_authentication_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    message_id TEXT NOT NULL,
    
    -- Authentication results
    spf_result TEXT CHECK (spf_result IN ('pass', 'fail', 'softfail', 'neutral', 'none', 'temperror', 'permerror')),
    dkim_result TEXT CHECK (dkim_result IN ('pass', 'fail', 'neutral', 'none', 'temperror', 'permerror')),
    dmarc_result TEXT CHECK (dmarc_result IN ('pass', 'fail', 'none')),
    
    -- Additional details
    spf_details JSONB,
    dkim_details JSONB,
    dmarc_details JSONB,
    
    -- Source
    from_domain TEXT,
    return_path TEXT,
    received_from_ip INET,
    
    logged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_auth_logs_workspace_time (workspace_id, logged_at DESC),
    INDEX idx_auth_logs_results (workspace_id, spf_result, dkim_result, dmarc_result)
);

-- Deliverability recommendations
CREATE TABLE IF NOT EXISTS deliverability_recommendations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Recommendation details
    category TEXT CHECK (category IN ('authentication', 'content', 'reputation', 'technical', 'behavior')) NOT NULL,
    priority TEXT CHECK (priority IN ('critical', 'high', 'medium', 'low')) NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    
    -- Action items
    action_items JSONB DEFAULT '[]',
    
    -- Impact
    impact_score INTEGER CHECK (impact_score BETWEEN 1 AND 10),
    estimated_improvement TEXT,
    
    -- Status
    status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'dismissed')) DEFAULT 'pending',
    completed_at TIMESTAMP WITH TIME ZONE,
    dismissed_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Sending patterns analysis
CREATE TABLE IF NOT EXISTS sending_patterns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    analysis_date DATE NOT NULL,
    
    -- Volume patterns
    total_emails_sent INTEGER DEFAULT 0,
    unique_recipients INTEGER DEFAULT 0,
    unique_domains INTEGER DEFAULT 0,
    
    -- Time patterns
    sends_by_hour JSONB DEFAULT '{}', -- {0: 100, 1: 50, ...}
    sends_by_day JSONB DEFAULT '{}', -- {monday: 500, tuesday: 300, ...}
    
    -- Engagement patterns
    avg_open_rate DECIMAL(5,2),
    avg_click_rate DECIMAL(5,2),
    avg_reply_rate DECIMAL(5,2),
    avg_bounce_rate DECIMAL(5,2),
    avg_complaint_rate DECIMAL(5,2),
    
    -- Risk indicators
    volume_spike_detected BOOLEAN DEFAULT false,
    pattern_anomaly_detected BOOLEAN DEFAULT false,
    risk_score INTEGER CHECK (risk_score BETWEEN 0 AND 100) DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint
    CONSTRAINT unique_workspace_analysis_date UNIQUE (workspace_id, analysis_date)
);

-- Functions
CREATE OR REPLACE FUNCTION calculate_spam_score(
    p_subject TEXT,
    p_body_html TEXT,
    p_body_text TEXT
) RETURNS TABLE (
    spam_score DECIMAL(4,2),
    spam_triggers JSONB,
    recommendations JSONB
) AS $$
DECLARE
    v_spam_score DECIMAL(4,2) := 0;
    v_spam_triggers JSONB := '[]'::JSONB;
    v_recommendations JSONB := '[]'::JSONB;
    v_body_content TEXT;
    v_caps_percentage DECIMAL(5,2);
    v_exclamation_count INTEGER;
    v_link_count INTEGER;
BEGIN
    -- Use text body or strip HTML
    v_body_content := COALESCE(p_body_text, regexp_replace(p_body_html, '<[^>]+>', '', 'g'));
    
    -- Check subject line
    IF p_subject ~* '(free|guarantee|limited time|act now|urgent|winner|congratulations)' THEN
        v_spam_score := v_spam_score + 1.5;
        v_spam_triggers := v_spam_triggers || '["Spam words in subject"]'::JSONB;
    END IF;
    
    IF p_subject ~ '[A-Z]{5,}' THEN
        v_spam_score := v_spam_score + 1.0;
        v_spam_triggers := v_spam_triggers || '["Excessive caps in subject"]'::JSONB;
    END IF;
    
    IF p_subject ~ '!!+' THEN
        v_spam_score := v_spam_score + 0.5;
        v_spam_triggers := v_spam_triggers || '["Multiple exclamation marks in subject"]'::JSONB;
    END IF;
    
    -- Check body content
    IF v_body_content ~* '(click here|buy now|order now|limited offer|100% free|risk-free)' THEN
        v_spam_score := v_spam_score + 2.0;
        v_spam_triggers := v_spam_triggers || '["Spam phrases in body"]'::JSONB;
    END IF;
    
    -- Calculate caps percentage
    v_caps_percentage := (
        LENGTH(v_body_content) - LENGTH(LOWER(v_body_content))
    )::DECIMAL / NULLIF(LENGTH(v_body_content), 0) * 100;
    
    IF v_caps_percentage > 30 THEN
        v_spam_score := v_spam_score + 1.5;
        v_spam_triggers := v_spam_triggers || '["High percentage of caps"]'::JSONB;
    END IF;
    
    -- Count exclamation marks
    v_exclamation_count := LENGTH(v_body_content) - LENGTH(REPLACE(v_body_content, '!', ''));
    IF v_exclamation_count > 3 THEN
        v_spam_score := v_spam_score + 0.5;
        v_spam_triggers := v_spam_triggers || '["Too many exclamation marks"]'::JSONB;
    END IF;
    
    -- Count links
    v_link_count := (
        SELECT COUNT(*)
        FROM regexp_split_to_table(p_body_html, 'href=') AS links
    ) - 1;
    
    IF v_link_count > 5 THEN
        v_spam_score := v_spam_score + 1.0;
        v_spam_triggers := v_spam_triggers || '["Too many links"]'::JSONB;
    END IF;
    
    -- Generate recommendations
    IF v_spam_score < 3 THEN
        v_recommendations := '["Email looks good! Low spam risk."]'::JSONB;
    ELSIF v_spam_score < 5 THEN
        v_recommendations := '[
            "Consider reducing promotional language",
            "Avoid excessive capitalization",
            "Limit the number of links"
        ]'::JSONB;
    ELSE
        v_recommendations := '[
            "High spam risk - significant rewrite recommended",
            "Remove spam trigger words",
            "Use more conversational tone",
            "Reduce links and promotional content"
        ]'::JSONB;
    END IF;
    
    RETURN QUERY SELECT v_spam_score, v_spam_triggers, v_recommendations;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update reputation metrics
CREATE OR REPLACE FUNCTION update_domain_reputation()
RETURNS TRIGGER AS $$
BEGIN
    -- Update domain reputation based on email events
    UPDATE domain_reputation
    SET 
        total_sent = (
            SELECT COUNT(*) 
            FROM email_events 
            WHERE workspace_id = NEW.workspace_id 
            AND from_email LIKE '%@' || domain_reputation.domain
        ),
        total_delivered = (
            SELECT COUNT(*) 
            FROM email_events 
            WHERE workspace_id = NEW.workspace_id 
            AND from_email LIKE '%@' || domain_reputation.domain
            AND event_type = 'delivered'
        ),
        total_bounced = (
            SELECT COUNT(*) 
            FROM email_events 
            WHERE workspace_id = NEW.workspace_id 
            AND from_email LIKE '%@' || domain_reputation.domain
            AND event_type IN ('bounce', 'hard_bounce', 'soft_bounce')
        ),
        total_complained = (
            SELECT COUNT(*) 
            FROM email_events 
            WHERE workspace_id = NEW.workspace_id 
            AND from_email LIKE '%@' || domain_reputation.domain
            AND event_type = 'complaint'
        ),
        updated_at = CURRENT_TIMESTAMP
    WHERE workspace_id = NEW.workspace_id
    AND domain = SPLIT_PART(NEW.from_email, '@', 2);
    
    -- Update rates
    UPDATE domain_reputation
    SET 
        delivery_rate = CASE 
            WHEN total_sent > 0 THEN (total_delivered::DECIMAL / total_sent * 100)
            ELSE 0 
        END,
        bounce_rate = CASE 
            WHEN total_sent > 0 THEN (total_bounced::DECIMAL / total_sent * 100)
            ELSE 0 
        END,
        complaint_rate = CASE 
            WHEN total_sent > 0 THEN (total_complained::DECIMAL / total_sent * 100)
            ELSE 0 
        END
    WHERE workspace_id = NEW.workspace_id
    AND domain = SPLIT_PART(NEW.from_email, '@', 2);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on email_events
CREATE TRIGGER trigger_update_domain_reputation
AFTER INSERT ON email_events
FOR EACH ROW
EXECUTE FUNCTION update_domain_reputation();

-- RLS Policies
ALTER TABLE domain_reputation ENABLE ROW LEVEL SECURITY;
ALTER TABLE spam_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_placement_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_authentication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliverability_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sending_patterns ENABLE ROW LEVEL SECURITY;

-- Domain reputation policies
CREATE POLICY "Users can view their workspace's domain reputation"
ON domain_reputation FOR SELECT
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can manage their workspace's domain reputation"
ON domain_reputation FOR ALL
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

-- Similar policies for other tables
CREATE POLICY "Users can view their workspace's spam analysis"
ON spam_analysis FOR SELECT
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can create spam analysis for their workspace"
ON spam_analysis FOR INSERT
TO authenticated
WITH CHECK (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

-- Sample deliverability recommendations
INSERT INTO deliverability_recommendations (workspace_id, category, priority, title, description, action_items, impact_score, estimated_improvement)
SELECT 
    w.id,
    'authentication',
    'critical',
    'Set up SPF, DKIM, and DMARC',
    'Email authentication is crucial for deliverability. Without proper authentication, your emails are likely to land in spam.',
    '[
        "Add SPF record to your DNS",
        "Configure DKIM signing",
        "Set up DMARC policy",
        "Verify all records are valid"
    ]'::JSONB,
    10,
    '30-50% better inbox placement'
FROM workspaces w
WHERE NOT EXISTS (
    SELECT 1 FROM deliverability_recommendations dr 
    WHERE dr.workspace_id = w.id 
    AND dr.title = 'Set up SPF, DKIM, and DMARC'
);