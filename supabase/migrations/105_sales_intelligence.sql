-- Sales Intelligence & Intent Data Schema
-- Transform cold outreach into warm conversations with buying signals

-- Intent data providers configuration
CREATE TABLE IF NOT EXISTS intent_providers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    provider_type TEXT CHECK (provider_type IN ('website_tracking', 'intent_data', 'news_monitoring', 'funding_data', 'technographics', 'social_signals')) NOT NULL,
    api_endpoint TEXT,
    is_active BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}', -- Provider-specific configuration
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Intent signals tracking
CREATE TABLE IF NOT EXISTS intent_signals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    company_domain TEXT,
    
    -- Signal details
    signal_type TEXT CHECK (signal_type IN (
        'website_visit',
        'content_download',
        'competitor_research',
        'funding_announced',
        'leadership_change',
        'tech_stack_change',
        'hiring_surge',
        'expansion_news',
        'partnership_announcement',
        'product_launch',
        'social_engagement',
        'search_intent'
    )) NOT NULL,
    signal_source TEXT NOT NULL, -- Which provider/source
    signal_strength INTEGER CHECK (signal_strength BETWEEN 1 AND 100) DEFAULT 50,
    
    -- Signal metadata
    title TEXT,
    description TEXT,
    url TEXT,
    metadata JSONB DEFAULT '{}', -- Source-specific data
    
    -- Timestamps
    signal_date TIMESTAMP WITH TIME ZONE NOT NULL,
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE, -- Some signals have expiration
    
    -- Processing
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMP WITH TIME ZONE,
    campaign_triggered BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Prevent duplicate signals
    CONSTRAINT unique_signal UNIQUE (workspace_id, lead_id, signal_type, signal_source, signal_date)
);

-- Buying intent scores
CREATE TABLE IF NOT EXISTS intent_scores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    
    -- Composite scores
    overall_score INTEGER CHECK (overall_score BETWEEN 0 AND 100) DEFAULT 0,
    engagement_score INTEGER CHECK (engagement_score BETWEEN 0 AND 100) DEFAULT 0,
    fit_score INTEGER CHECK (fit_score BETWEEN 0 AND 100) DEFAULT 0,
    timing_score INTEGER CHECK (timing_score BETWEEN 0 AND 100) DEFAULT 0,
    
    -- Score components
    signal_count INTEGER DEFAULT 0,
    recent_signal_count INTEGER DEFAULT 0, -- Last 7 days
    strongest_signal_type TEXT,
    strongest_signal_strength INTEGER,
    
    -- Trend analysis
    score_trend TEXT CHECK (score_trend IN ('rising', 'stable', 'falling')),
    previous_score INTEGER,
    score_change INTEGER,
    
    -- Recommendations
    recommended_action TEXT CHECK (recommended_action IN ('reach_out_now', 'nurture', 'monitor', 'disqualify')),
    recommended_channel TEXT CHECK (recommended_channel IN ('email', 'linkedin', 'phone', 'multi_channel')),
    recommended_message_type TEXT,
    
    -- Timestamps
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint
    CONSTRAINT unique_lead_score UNIQUE (workspace_id, lead_id)
);

-- Website visitor tracking
CREATE TABLE IF NOT EXISTS website_visitors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Visitor identification
    visitor_id TEXT NOT NULL, -- Anonymous ID from tracking pixel
    ip_address INET,
    company_domain TEXT,
    company_name TEXT,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL, -- Linked if identified
    
    -- Visit details
    page_url TEXT NOT NULL,
    page_title TEXT,
    referrer_url TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    
    -- Behavior
    time_on_page INTEGER, -- Seconds
    scroll_depth INTEGER, -- Percentage
    clicks JSONB DEFAULT '[]', -- Array of clicked elements
    
    -- Device/Location
    user_agent TEXT,
    device_type TEXT,
    browser TEXT,
    country TEXT,
    region TEXT,
    city TEXT,
    
    -- Session
    session_id TEXT NOT NULL,
    is_new_visitor BOOLEAN DEFAULT true,
    
    visited_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes for performance
    INDEX idx_website_visitors_session (workspace_id, session_id),
    INDEX idx_website_visitors_company (workspace_id, company_domain),
    INDEX idx_website_visitors_time (workspace_id, visited_at DESC)
);

-- Technology stack tracking (technographics)
CREATE TABLE IF NOT EXISTS company_tech_stack (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    company_domain TEXT NOT NULL,
    
    -- Technology details
    technology_name TEXT NOT NULL,
    category TEXT NOT NULL, -- CRM, Marketing, Analytics, etc.
    subcategory TEXT,
    
    -- Detection details
    detected_via TEXT, -- How we found it
    confidence_score INTEGER CHECK (confidence_score BETWEEN 0 AND 100),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    first_detected TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_verified TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    removed_at TIMESTAMP WITH TIME ZONE, -- If technology was removed
    
    -- Change tracking
    is_new BOOLEAN DEFAULT true, -- New in last 30 days
    is_removed BOOLEAN DEFAULT false, -- Removed in last 30 days
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint
    CONSTRAINT unique_company_tech UNIQUE (workspace_id, company_domain, technology_name)
);

-- Funding and news tracking
CREATE TABLE IF NOT EXISTS company_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    company_domain TEXT NOT NULL,
    
    -- Event details
    event_type TEXT CHECK (event_type IN (
        'funding_round',
        'acquisition',
        'ipo',
        'leadership_change',
        'product_launch',
        'partnership',
        'expansion',
        'award',
        'earnings_report',
        'layoffs',
        'other'
    )) NOT NULL,
    
    title TEXT NOT NULL,
    description TEXT,
    url TEXT,
    source TEXT NOT NULL,
    
    -- Event metadata
    event_date DATE NOT NULL,
    amount DECIMAL(15,2), -- For funding rounds
    metadata JSONB DEFAULT '{}', -- Additional event-specific data
    
    -- Signal strength
    relevance_score INTEGER CHECK (relevance_score BETWEEN 0 AND 100) DEFAULT 50,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Prevent duplicates
    CONSTRAINT unique_company_event UNIQUE (company_domain, event_type, event_date, title)
);

-- Intent-based campaign triggers
CREATE TABLE IF NOT EXISTS intent_triggers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Trigger configuration
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    
    -- Trigger conditions (ALL must be met)
    conditions JSONB NOT NULL DEFAULT '[]',
    /* Example conditions:
    [
        {"field": "overall_score", "operator": ">=", "value": 80},
        {"field": "signal_type", "operator": "in", "value": ["funding_announced", "leadership_change"]},
        {"field": "company_size", "operator": ">", "value": 50}
    ]
    */
    
    -- Actions
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    assign_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    add_tags TEXT[],
    send_notification BOOLEAN DEFAULT true,
    
    -- Limits
    max_triggers_per_day INTEGER DEFAULT 100,
    triggers_today INTEGER DEFAULT 0,
    last_reset_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Triggered campaigns tracking
CREATE TABLE IF NOT EXISTS intent_triggered_campaigns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    trigger_id UUID NOT NULL REFERENCES intent_triggers(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    
    -- Trigger details
    triggered_by_signal_id UUID REFERENCES intent_signals(id),
    trigger_score INTEGER,
    trigger_conditions_met JSONB,
    
    -- Status
    status TEXT CHECK (status IN ('pending', 'started', 'completed', 'cancelled')) DEFAULT 'pending',
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Prevent duplicate triggers
    CONSTRAINT unique_triggered_campaign UNIQUE (workspace_id, trigger_id, lead_id, campaign_id)
);

-- Indexes for performance
CREATE INDEX idx_intent_signals_workspace_lead ON intent_signals(workspace_id, lead_id);
CREATE INDEX idx_intent_signals_type ON intent_signals(workspace_id, signal_type);
CREATE INDEX idx_intent_signals_date ON intent_signals(workspace_id, signal_date DESC);
CREATE INDEX idx_intent_signals_unprocessed ON intent_signals(workspace_id, processed) WHERE processed = false;

CREATE INDEX idx_intent_scores_workspace ON intent_scores(workspace_id, overall_score DESC);
CREATE INDEX idx_intent_scores_action ON intent_scores(workspace_id, recommended_action);
CREATE INDEX idx_intent_scores_updated ON intent_scores(workspace_id, updated_at DESC);

CREATE INDEX idx_website_visitors_recent ON website_visitors(workspace_id, visited_at DESC);
CREATE INDEX idx_company_tech_changes ON company_tech_stack(workspace_id, is_new, is_removed);
CREATE INDEX idx_company_events_recent ON company_events(workspace_id, event_date DESC);

-- Functions for intent scoring
CREATE OR REPLACE FUNCTION calculate_intent_score(p_workspace_id UUID, p_lead_id UUID)
RETURNS TABLE (
    overall_score INTEGER,
    engagement_score INTEGER,
    fit_score INTEGER,
    timing_score INTEGER,
    recommended_action TEXT,
    recommended_channel TEXT
) AS $$
DECLARE
    v_signal_count INTEGER;
    v_recent_signals INTEGER;
    v_max_signal_strength INTEGER;
    v_has_funding BOOLEAN;
    v_has_tech_change BOOLEAN;
    v_website_visits INTEGER;
    v_overall_score INTEGER;
    v_engagement_score INTEGER;
    v_fit_score INTEGER;
    v_timing_score INTEGER;
    v_recommended_action TEXT;
    v_recommended_channel TEXT;
BEGIN
    -- Count signals
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE signal_date > CURRENT_TIMESTAMP - INTERVAL '7 days'),
        MAX(signal_strength),
        bool_or(signal_type = 'funding_announced'),
        bool_or(signal_type = 'tech_stack_change')
    INTO v_signal_count, v_recent_signals, v_max_signal_strength, v_has_funding, v_has_tech_change
    FROM intent_signals
    WHERE workspace_id = p_workspace_id AND lead_id = p_lead_id;
    
    -- Count website visits
    SELECT COUNT(DISTINCT session_id)
    INTO v_website_visits
    FROM website_visitors
    WHERE workspace_id = p_workspace_id AND lead_id = p_lead_id
    AND visited_at > CURRENT_TIMESTAMP - INTERVAL '30 days';
    
    -- Calculate engagement score (based on activity)
    v_engagement_score := LEAST(100, 
        (v_website_visits * 10) + 
        (v_recent_signals * 15) +
        CASE WHEN v_max_signal_strength > 80 THEN 20 ELSE 0 END
    );
    
    -- Calculate fit score (based on signal types)
    v_fit_score := LEAST(100,
        CASE WHEN v_has_funding THEN 30 ELSE 0 END +
        CASE WHEN v_has_tech_change THEN 25 ELSE 0 END +
        CASE WHEN v_signal_count > 5 THEN 20 ELSE v_signal_count * 4 END +
        CASE WHEN v_website_visits > 3 THEN 25 ELSE v_website_visits * 8 END
    );
    
    -- Calculate timing score (recency and frequency)
    v_timing_score := LEAST(100,
        (v_recent_signals * 20) +
        CASE 
            WHEN v_recent_signals >= 3 THEN 40
            WHEN v_recent_signals >= 2 THEN 25
            WHEN v_recent_signals >= 1 THEN 15
            ELSE 0
        END +
        CASE WHEN v_max_signal_strength > 70 AND v_recent_signals > 0 THEN 20 ELSE 0 END
    );
    
    -- Calculate overall score
    v_overall_score := (v_engagement_score * 0.3 + v_fit_score * 0.4 + v_timing_score * 0.3)::INTEGER;
    
    -- Determine recommended action
    v_recommended_action := CASE
        WHEN v_overall_score >= 80 AND v_timing_score >= 70 THEN 'reach_out_now'
        WHEN v_overall_score >= 60 THEN 'nurture'
        WHEN v_overall_score >= 30 THEN 'monitor'
        ELSE 'disqualify'
    END;
    
    -- Determine recommended channel
    v_recommended_channel := CASE
        WHEN v_has_funding OR v_overall_score >= 85 THEN 'multi_channel'
        WHEN v_website_visits > 5 THEN 'email'
        WHEN v_recent_signals >= 2 THEN 'linkedin'
        ELSE 'email'
    END;
    
    RETURN QUERY SELECT 
        v_overall_score,
        v_engagement_score,
        v_fit_score,
        v_timing_score,
        v_recommended_action,
        v_recommended_channel;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update intent scores when new signals arrive
CREATE OR REPLACE FUNCTION update_intent_score_on_signal()
RETURNS TRIGGER AS $$
BEGIN
    -- Recalculate score for the affected lead
    INSERT INTO intent_scores (
        workspace_id,
        lead_id,
        overall_score,
        engagement_score,
        fit_score,
        timing_score,
        recommended_action,
        recommended_channel,
        signal_count,
        recent_signal_count,
        strongest_signal_type,
        strongest_signal_strength
    )
    SELECT 
        NEW.workspace_id,
        NEW.lead_id,
        scores.overall_score,
        scores.engagement_score,
        scores.fit_score,
        scores.timing_score,
        scores.recommended_action,
        scores.recommended_channel,
        (SELECT COUNT(*) FROM intent_signals WHERE workspace_id = NEW.workspace_id AND lead_id = NEW.lead_id),
        (SELECT COUNT(*) FROM intent_signals WHERE workspace_id = NEW.workspace_id AND lead_id = NEW.lead_id AND signal_date > CURRENT_TIMESTAMP - INTERVAL '7 days'),
        NEW.signal_type,
        NEW.signal_strength
    FROM calculate_intent_score(NEW.workspace_id, NEW.lead_id) AS scores
    ON CONFLICT (workspace_id, lead_id) DO UPDATE SET
        overall_score = EXCLUDED.overall_score,
        engagement_score = EXCLUDED.engagement_score,
        fit_score = EXCLUDED.fit_score,
        timing_score = EXCLUDED.timing_score,
        recommended_action = EXCLUDED.recommended_action,
        recommended_channel = EXCLUDED.recommended_channel,
        signal_count = EXCLUDED.signal_count,
        recent_signal_count = EXCLUDED.recent_signal_count,
        strongest_signal_type = CASE 
            WHEN EXCLUDED.strongest_signal_strength > intent_scores.strongest_signal_strength 
            THEN EXCLUDED.strongest_signal_type 
            ELSE intent_scores.strongest_signal_type 
        END,
        strongest_signal_strength = GREATEST(intent_scores.strongest_signal_strength, EXCLUDED.strongest_signal_strength),
        previous_score = intent_scores.overall_score,
        score_change = EXCLUDED.overall_score - intent_scores.overall_score,
        score_trend = CASE
            WHEN EXCLUDED.overall_score > intent_scores.overall_score THEN 'rising'
            WHEN EXCLUDED.overall_score < intent_scores.overall_score THEN 'falling'
            ELSE 'stable'
        END,
        updated_at = CURRENT_TIMESTAMP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_intent_score
AFTER INSERT OR UPDATE ON intent_signals
FOR EACH ROW
EXECUTE FUNCTION update_intent_score_on_signal();

-- RLS Policies
ALTER TABLE intent_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE intent_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE intent_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_tech_stack ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE intent_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE intent_triggered_campaigns ENABLE ROW LEVEL SECURITY;

-- Intent signals policies
CREATE POLICY "Users can view their workspace's intent signals"
ON intent_signals FOR SELECT
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can manage their workspace's intent signals"
ON intent_signals FOR ALL
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

-- Similar policies for other tables
CREATE POLICY "Users can view their workspace's intent scores"
ON intent_scores FOR SELECT
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can view their workspace's website visitors"
ON website_visitors FOR SELECT
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can view their workspace's company tech stack"
ON company_tech_stack FOR SELECT
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can view their workspace's company events"
ON company_events FOR SELECT
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

-- Intent triggers - admin only
CREATE POLICY "Admins can manage intent triggers"
ON intent_triggers FOR ALL
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid() 
        AND role IN ('workspace_admin', 'super_admin')
    )
);

-- Sample data for intent providers
INSERT INTO intent_providers (name, provider_type, api_endpoint, config) VALUES
    ('Clearbit Reveal', 'website_tracking', 'https://reveal.clearbit.com/v1/companies', '{"requires_api_key": true}'),
    ('6sense', 'intent_data', 'https://api.6sense.com/v2/accounts', '{"requires_oauth": true}'),
    ('Crunchbase', 'funding_data', 'https://api.crunchbase.com/v4/entities', '{"requires_api_key": true}'),
    ('BuiltWith', 'technographics', 'https://api.builtwith.com/v20/api.json', '{"requires_api_key": true}'),
    ('Google News', 'news_monitoring', 'https://newsapi.org/v2/everything', '{"requires_api_key": true}')
ON CONFLICT (name) DO NOTHING;