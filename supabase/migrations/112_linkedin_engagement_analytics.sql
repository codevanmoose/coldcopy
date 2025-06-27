-- LinkedIn Engagement Tracking and Analytics
-- Comprehensive tracking of all LinkedIn interactions and performance metrics

-- LinkedIn engagement events
CREATE TABLE IF NOT EXISTS linkedin_engagement_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES linkedin_profiles(id) ON DELETE CASCADE,
    message_id UUID REFERENCES linkedin_messages(id) ON DELETE CASCADE,
    
    -- Event details
    event_type TEXT CHECK (event_type IN (
        'profile_view', 'message_sent', 'message_opened', 'message_replied',
        'connection_request_sent', 'connection_accepted', 'connection_rejected',
        'profile_liked', 'post_liked', 'post_commented', 'post_shared',
        'inmailed', 'profile_followed', 'skill_endorsed', 'recommendation_sent'
    )) NOT NULL,
    
    -- Event metadata
    event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    event_source TEXT CHECK (event_source IN ('manual', 'automated', 'webhook', 'api')) DEFAULT 'manual',
    
    -- Related entities
    related_post_id TEXT, -- LinkedIn post ID if applicable
    related_post_url TEXT,
    campaign_id UUID REFERENCES campaigns(id),
    
    -- Engagement value
    engagement_score INTEGER DEFAULT 1, -- Weight of this engagement type
    
    -- Response tracking
    response_time_minutes INTEGER, -- Time to respond (for replies)
    
    -- Additional context
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Prevent duplicate events
    CONSTRAINT unique_linkedin_engagement_event UNIQUE (workspace_id, profile_id, event_type, event_timestamp)
);

-- LinkedIn profile engagement summary
CREATE TABLE IF NOT EXISTS linkedin_profile_engagement (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES linkedin_profiles(id) ON DELETE CASCADE,
    
    -- Engagement metrics
    total_messages_sent INTEGER DEFAULT 0,
    total_messages_opened INTEGER DEFAULT 0,
    total_messages_replied INTEGER DEFAULT 0,
    
    -- Connection metrics
    connection_requests_sent INTEGER DEFAULT 0,
    connections_accepted INTEGER DEFAULT 0,
    connection_acceptance_rate DECIMAL(5,2),
    
    -- Activity metrics
    profile_views INTEGER DEFAULT 0,
    posts_liked INTEGER DEFAULT 0,
    posts_commented INTEGER DEFAULT 0,
    posts_shared INTEGER DEFAULT 0,
    
    -- Response metrics
    avg_response_time_minutes DECIMAL(10,2),
    first_response_time_minutes INTEGER,
    
    -- Engagement scoring
    engagement_score INTEGER DEFAULT 0,
    engagement_level TEXT CHECK (engagement_level IN ('cold', 'warm', 'hot', 'champion')),
    last_engagement_at TIMESTAMP WITH TIME ZONE,
    
    -- Conversion tracking
    converted_to_opportunity BOOLEAN DEFAULT false,
    converted_to_customer BOOLEAN DEFAULT false,
    conversion_value DECIMAL(10,2),
    
    -- Analysis
    most_effective_message_type TEXT,
    best_engagement_time TEXT,
    engagement_trend TEXT CHECK (engagement_trend IN ('increasing', 'stable', 'decreasing')),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_linkedin_profile_engagement UNIQUE (workspace_id, profile_id)
);

-- LinkedIn campaign performance
CREATE TABLE IF NOT EXISTS linkedin_campaign_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    
    -- Outreach metrics
    total_profiles_targeted INTEGER DEFAULT 0,
    total_messages_sent INTEGER DEFAULT 0,
    total_inmails_sent INTEGER DEFAULT 0,
    total_connection_requests INTEGER DEFAULT 0,
    
    -- Engagement metrics
    messages_opened INTEGER DEFAULT 0,
    messages_replied INTEGER DEFAULT 0,
    connections_accepted INTEGER DEFAULT 0,
    profile_views_generated INTEGER DEFAULT 0,
    
    -- Performance rates
    open_rate DECIMAL(5,2),
    reply_rate DECIMAL(5,2),
    connection_acceptance_rate DECIMAL(5,2),
    
    -- Time-based metrics
    avg_time_to_open_hours DECIMAL(10,2),
    avg_time_to_reply_hours DECIMAL(10,2),
    
    -- Conversion metrics
    leads_generated INTEGER DEFAULT 0,
    opportunities_created INTEGER DEFAULT 0,
    revenue_attributed DECIMAL(10,2),
    roi DECIMAL(10,2),
    
    -- Best performing
    best_performing_message_template TEXT,
    best_performing_time_slot TEXT,
    best_performing_day TEXT,
    
    -- Cost tracking
    inmails_used INTEGER DEFAULT 0,
    estimated_cost DECIMAL(10,2),
    cost_per_lead DECIMAL(10,2),
    
    last_calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_linkedin_campaign_analytics UNIQUE (workspace_id, campaign_id)
);

-- LinkedIn workspace analytics
CREATE TABLE IF NOT EXISTS linkedin_workspace_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    analysis_date DATE NOT NULL,
    
    -- Daily metrics
    daily_messages_sent INTEGER DEFAULT 0,
    daily_connections_sent INTEGER DEFAULT 0,
    daily_messages_opened INTEGER DEFAULT 0,
    daily_messages_replied INTEGER DEFAULT 0,
    daily_connections_accepted INTEGER DEFAULT 0,
    
    -- Cumulative metrics
    total_profiles_imported INTEGER DEFAULT 0,
    total_active_conversations INTEGER DEFAULT 0,
    total_connections_made INTEGER DEFAULT 0,
    
    -- Performance metrics
    overall_open_rate DECIMAL(5,2),
    overall_reply_rate DECIMAL(5,2),
    overall_connection_rate DECIMAL(5,2),
    
    -- Limits and usage
    daily_message_limit INTEGER DEFAULT 100,
    daily_connection_limit INTEGER DEFAULT 100,
    messages_remaining INTEGER,
    connections_remaining INTEGER,
    
    -- Top performers
    top_performing_profiles JSONB DEFAULT '[]', -- Array of {profile_id, name, metric}
    top_performing_messages JSONB DEFAULT '[]', -- Array of {message_id, template, metric}
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_linkedin_workspace_date UNIQUE (workspace_id, analysis_date)
);

-- LinkedIn engagement patterns
CREATE TABLE IF NOT EXISTS linkedin_engagement_patterns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Pattern identification
    pattern_type TEXT CHECK (pattern_type IN (
        'optimal_send_time', 'effective_message_length', 'successful_sequence',
        'high_response_industry', 'engagement_trigger', 'conversion_path'
    )) NOT NULL,
    
    -- Pattern details
    pattern_name TEXT NOT NULL,
    pattern_description TEXT,
    pattern_data JSONB NOT NULL,
    
    -- Performance metrics
    success_rate DECIMAL(5,2),
    sample_size INTEGER,
    confidence_level DECIMAL(5,2),
    
    -- Recommendations
    recommended_action TEXT,
    expected_improvement DECIMAL(5,2),
    
    -- Validity
    discovered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_validated_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_linkedin_engagement_events_workspace ON linkedin_engagement_events(workspace_id, event_timestamp DESC);
CREATE INDEX idx_linkedin_engagement_events_profile ON linkedin_engagement_events(profile_id, event_type);
CREATE INDEX idx_linkedin_engagement_events_campaign ON linkedin_engagement_events(campaign_id);
CREATE INDEX idx_linkedin_profile_engagement_workspace ON linkedin_profile_engagement(workspace_id);
CREATE INDEX idx_linkedin_profile_engagement_score ON linkedin_profile_engagement(workspace_id, engagement_score DESC);
CREATE INDEX idx_linkedin_campaign_analytics_workspace ON linkedin_campaign_analytics(workspace_id);
CREATE INDEX idx_linkedin_workspace_analytics_date ON linkedin_workspace_analytics(workspace_id, analysis_date DESC);

-- Functions
CREATE OR REPLACE FUNCTION calculate_linkedin_engagement_score(
    profile_id UUID
) RETURNS INTEGER AS $$
DECLARE
    score INTEGER := 0;
    events RECORD;
BEGIN
    -- Calculate weighted engagement score
    SELECT 
        COUNT(*) FILTER (WHERE event_type = 'message_replied') * 10 +
        COUNT(*) FILTER (WHERE event_type = 'connection_accepted') * 8 +
        COUNT(*) FILTER (WHERE event_type = 'message_opened') * 3 +
        COUNT(*) FILTER (WHERE event_type = 'profile_view') * 2 +
        COUNT(*) FILTER (WHERE event_type IN ('post_liked', 'post_commented')) * 5
    INTO score
    FROM linkedin_engagement_events
    WHERE linkedin_engagement_events.profile_id = $1
    AND event_timestamp > NOW() - INTERVAL '30 days';
    
    RETURN score;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION determine_engagement_level(
    score INTEGER
) RETURNS TEXT AS $$
BEGIN
    IF score >= 50 THEN
        RETURN 'champion';
    ELSIF score >= 30 THEN
        RETURN 'hot';
    ELSIF score >= 10 THEN
        RETURN 'warm';
    ELSE
        RETURN 'cold';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update profile engagement summary
CREATE OR REPLACE FUNCTION update_linkedin_profile_engagement()
RETURNS TRIGGER AS $$
DECLARE
    engagement_rec RECORD;
    new_score INTEGER;
BEGIN
    -- Get or create engagement record
    INSERT INTO linkedin_profile_engagement (workspace_id, profile_id)
    VALUES (NEW.workspace_id, NEW.profile_id)
    ON CONFLICT (workspace_id, profile_id) DO NOTHING;
    
    -- Update metrics based on event type
    UPDATE linkedin_profile_engagement
    SET 
        total_messages_sent = total_messages_sent + CASE WHEN NEW.event_type = 'message_sent' THEN 1 ELSE 0 END,
        total_messages_opened = total_messages_opened + CASE WHEN NEW.event_type = 'message_opened' THEN 1 ELSE 0 END,
        total_messages_replied = total_messages_replied + CASE WHEN NEW.event_type = 'message_replied' THEN 1 ELSE 0 END,
        connection_requests_sent = connection_requests_sent + CASE WHEN NEW.event_type = 'connection_request_sent' THEN 1 ELSE 0 END,
        connections_accepted = connections_accepted + CASE WHEN NEW.event_type = 'connection_accepted' THEN 1 ELSE 0 END,
        profile_views = profile_views + CASE WHEN NEW.event_type = 'profile_view' THEN 1 ELSE 0 END,
        posts_liked = posts_liked + CASE WHEN NEW.event_type = 'post_liked' THEN 1 ELSE 0 END,
        posts_commented = posts_commented + CASE WHEN NEW.event_type = 'post_commented' THEN 1 ELSE 0 END,
        posts_shared = posts_shared + CASE WHEN NEW.event_type = 'post_shared' THEN 1 ELSE 0 END,
        last_engagement_at = NEW.event_timestamp,
        updated_at = NOW()
    WHERE workspace_id = NEW.workspace_id AND profile_id = NEW.profile_id;
    
    -- Calculate new engagement score
    new_score := calculate_linkedin_engagement_score(NEW.profile_id);
    
    -- Update engagement score and level
    UPDATE linkedin_profile_engagement
    SET 
        engagement_score = new_score,
        engagement_level = determine_engagement_level(new_score),
        connection_acceptance_rate = CASE 
            WHEN connection_requests_sent > 0 
            THEN (connections_accepted::DECIMAL / connection_requests_sent) * 100
            ELSE 0 
        END
    WHERE workspace_id = NEW.workspace_id AND profile_id = NEW.profile_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_linkedin_engagement
AFTER INSERT ON linkedin_engagement_events
FOR EACH ROW
EXECUTE FUNCTION update_linkedin_profile_engagement();

-- Function to calculate daily analytics
CREATE OR REPLACE FUNCTION calculate_linkedin_daily_analytics(
    p_workspace_id UUID,
    p_date DATE DEFAULT CURRENT_DATE
) RETURNS void AS $$
DECLARE
    daily_stats RECORD;
BEGIN
    -- Calculate daily metrics
    WITH daily_metrics AS (
        SELECT 
            COUNT(*) FILTER (WHERE event_type = 'message_sent') as messages_sent,
            COUNT(*) FILTER (WHERE event_type = 'connection_request_sent') as connections_sent,
            COUNT(*) FILTER (WHERE event_type = 'message_opened') as messages_opened,
            COUNT(*) FILTER (WHERE event_type = 'message_replied') as messages_replied,
            COUNT(*) FILTER (WHERE event_type = 'connection_accepted') as connections_accepted
        FROM linkedin_engagement_events
        WHERE workspace_id = p_workspace_id
        AND DATE(event_timestamp) = p_date
    ),
    cumulative_metrics AS (
        SELECT 
            COUNT(DISTINCT id) as total_profiles,
            COUNT(DISTINCT CASE WHEN last_message_sent_at IS NOT NULL THEN id END) as active_conversations,
            COUNT(DISTINCT CASE WHEN connection_status = 'connected' THEN id END) as total_connections
        FROM linkedin_profiles
        WHERE workspace_id = p_workspace_id
    )
    INSERT INTO linkedin_workspace_analytics (
        workspace_id,
        analysis_date,
        daily_messages_sent,
        daily_connections_sent,
        daily_messages_opened,
        daily_messages_replied,
        daily_connections_accepted,
        total_profiles_imported,
        total_active_conversations,
        total_connections_made
    )
    SELECT 
        p_workspace_id,
        p_date,
        dm.messages_sent,
        dm.connections_sent,
        dm.messages_opened,
        dm.messages_replied,
        dm.connections_accepted,
        cm.total_profiles,
        cm.active_conversations,
        cm.total_connections
    FROM daily_metrics dm, cumulative_metrics cm
    ON CONFLICT (workspace_id, analysis_date) 
    DO UPDATE SET
        daily_messages_sent = EXCLUDED.daily_messages_sent,
        daily_connections_sent = EXCLUDED.daily_connections_sent,
        daily_messages_opened = EXCLUDED.daily_messages_opened,
        daily_messages_replied = EXCLUDED.daily_messages_replied,
        daily_connections_accepted = EXCLUDED.daily_connections_accepted,
        total_profiles_imported = EXCLUDED.total_profiles_imported,
        total_active_conversations = EXCLUDED.total_active_conversations,
        total_connections_made = EXCLUDED.total_connections_made;
END;
$$ LANGUAGE plpgsql;

-- Materialized view for real-time analytics dashboard
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_linkedin_engagement_overview AS
SELECT 
    w.id as workspace_id,
    w.name as workspace_name,
    COUNT(DISTINCT lp.id) as total_profiles,
    COUNT(DISTINCT CASE WHEN lpe.engagement_level IN ('warm', 'hot', 'champion') THEN lp.id END) as engaged_profiles,
    COUNT(DISTINCT CASE WHEN lp.connection_status = 'connected' THEN lp.id END) as connections,
    AVG(lpe.engagement_score) as avg_engagement_score,
    SUM(CASE WHEN lee.event_type = 'message_sent' THEN 1 ELSE 0 END) as total_messages_sent,
    SUM(CASE WHEN lee.event_type = 'message_replied' THEN 1 ELSE 0 END) as total_replies,
    CASE 
        WHEN SUM(CASE WHEN lee.event_type = 'message_sent' THEN 1 ELSE 0 END) > 0
        THEN (SUM(CASE WHEN lee.event_type = 'message_replied' THEN 1 ELSE 0 END)::DECIMAL / 
              SUM(CASE WHEN lee.event_type = 'message_sent' THEN 1 ELSE 0 END)) * 100
        ELSE 0
    END as reply_rate,
    MAX(lee.event_timestamp) as last_activity
FROM workspaces w
LEFT JOIN linkedin_profiles lp ON w.id = lp.workspace_id
LEFT JOIN linkedin_profile_engagement lpe ON lp.id = lpe.profile_id
LEFT JOIN linkedin_engagement_events lee ON lp.id = lee.profile_id
GROUP BY w.id, w.name;

CREATE UNIQUE INDEX idx_mv_linkedin_engagement_overview ON mv_linkedin_engagement_overview(workspace_id);

-- RLS policies
ALTER TABLE linkedin_engagement_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_profile_engagement ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_campaign_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_workspace_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_engagement_patterns ENABLE ROW LEVEL SECURITY;

-- RLS policies for linkedin_engagement_events
CREATE POLICY "Users can manage their workspace's LinkedIn engagement events"
ON linkedin_engagement_events FOR ALL
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

-- Similar policies for other tables
CREATE POLICY "Users can view their workspace's LinkedIn profile engagement"
ON linkedin_profile_engagement FOR SELECT
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can view their workspace's LinkedIn analytics"
ON linkedin_campaign_analytics FOR SELECT
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can view their workspace's LinkedIn workspace analytics"
ON linkedin_workspace_analytics FOR SELECT
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

-- Triggers
CREATE TRIGGER update_linkedin_profile_engagement_updated_at
    BEFORE UPDATE ON linkedin_profile_engagement
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();