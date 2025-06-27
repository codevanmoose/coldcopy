-- Twitter/X Integration Schema
-- Complete the social selling trifecta with Twitter outreach

-- Twitter integrations table
CREATE TABLE IF NOT EXISTS twitter_integrations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- OAuth tokens (encrypted)
    access_token TEXT NOT NULL,
    access_token_secret TEXT NOT NULL,
    
    -- Twitter account info
    twitter_user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    display_name TEXT,
    profile_image_url TEXT,
    verified BOOLEAN DEFAULT false,
    followers_count INTEGER DEFAULT 0,
    
    -- Integration settings
    is_active BOOLEAN DEFAULT true,
    daily_dm_limit INTEGER DEFAULT 50,
    daily_tweet_limit INTEGER DEFAULT 100,
    daily_follow_limit INTEGER DEFAULT 100,
    auto_follow_back BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    
    -- Unique constraint
    CONSTRAINT unique_workspace_twitter UNIQUE (workspace_id)
);

-- Twitter profiles for outreach
CREATE TABLE IF NOT EXISTS twitter_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    
    -- Twitter identifiers
    twitter_user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    
    -- Profile data
    display_name TEXT,
    bio TEXT,
    location TEXT,
    website TEXT,
    profile_image_url TEXT,
    banner_url TEXT,
    
    -- Metrics
    followers_count INTEGER DEFAULT 0,
    following_count INTEGER DEFAULT 0,
    tweet_count INTEGER DEFAULT 0,
    listed_count INTEGER DEFAULT 0,
    verified BOOLEAN DEFAULT false,
    
    -- Engagement data
    is_following BOOLEAN DEFAULT false,
    follows_us BOOLEAN DEFAULT false,
    dm_conversation_id TEXT,
    last_dm_sent_at TIMESTAMP WITH TIME ZONE,
    last_dm_received_at TIMESTAMP WITH TIME ZONE,
    last_tweet_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    profile_data JSONB DEFAULT '{}', -- Full profile data from API
    topics JSONB DEFAULT '[]', -- Extracted topics/interests
    
    -- Timestamps
    last_enriched_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    CONSTRAINT unique_workspace_twitter_user UNIQUE (workspace_id, twitter_user_id)
);

-- Twitter direct messages
CREATE TABLE IF NOT EXISTS twitter_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES twitter_profiles(id) ON DELETE CASCADE,
    
    -- Message details
    message_type TEXT CHECK (message_type IN ('dm', 'tweet', 'reply', 'quote')) NOT NULL,
    content TEXT NOT NULL,
    
    -- Twitter message ID for tracking
    twitter_message_id TEXT,
    twitter_conversation_id TEXT,
    in_reply_to_id TEXT, -- For replies and quotes
    
    -- Status tracking
    status TEXT CHECK (status IN ('draft', 'scheduled', 'sent', 'delivered', 'read', 'failed')) DEFAULT 'draft',
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    
    -- Error handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- AI generation tracking
    ai_generated BOOLEAN DEFAULT false,
    ai_model TEXT,
    ai_tokens_used INTEGER,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Twitter engagement tracking
CREATE TABLE IF NOT EXISTS twitter_engagements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES twitter_profiles(id) ON DELETE CASCADE,
    
    -- Engagement details
    engagement_type TEXT CHECK (engagement_type IN (
        'follow', 'unfollow', 'like', 'retweet', 'reply', 
        'quote', 'dm_open', 'profile_view', 'link_click'
    )) NOT NULL,
    
    -- Related content
    tweet_id TEXT,
    tweet_url TEXT,
    content TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    engaged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Prevent duplicate tracking
    CONSTRAINT unique_engagement UNIQUE (workspace_id, profile_id, engagement_type, tweet_id)
);

-- Twitter search monitoring
CREATE TABLE IF NOT EXISTS twitter_searches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Search configuration
    name TEXT NOT NULL,
    search_query TEXT NOT NULL, -- Twitter search syntax
    is_active BOOLEAN DEFAULT true,
    
    -- Search filters
    filters JSONB DEFAULT '{}', -- {min_followers: 100, verified_only: true, etc.}
    
    -- Actions
    auto_follow BOOLEAN DEFAULT false,
    auto_like BOOLEAN DEFAULT false,
    auto_dm BOOLEAN DEFAULT false,
    dm_template TEXT,
    
    -- Limits
    daily_action_limit INTEGER DEFAULT 50,
    actions_today INTEGER DEFAULT 0,
    last_reset_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Results
    total_results_found INTEGER DEFAULT 0,
    total_actions_taken INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Twitter webhook events
CREATE TABLE IF NOT EXISTS twitter_webhook_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    event_type TEXT NOT NULL,
    event_id TEXT NOT NULL,
    payload JSONB NOT NULL,
    
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_twitter_event UNIQUE (event_id)
);

-- Twitter analytics
CREATE TABLE IF NOT EXISTS twitter_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    analysis_date DATE NOT NULL,
    
    -- Engagement metrics
    total_dms_sent INTEGER DEFAULT 0,
    total_dms_delivered INTEGER DEFAULT 0,
    total_dms_read INTEGER DEFAULT 0,
    total_replies_received INTEGER DEFAULT 0,
    
    -- Growth metrics
    new_followers INTEGER DEFAULT 0,
    lost_followers INTEGER DEFAULT 0,
    net_follower_growth INTEGER DEFAULT 0,
    
    -- Activity metrics
    tweets_sent INTEGER DEFAULT 0,
    likes_given INTEGER DEFAULT 0,
    retweets_made INTEGER DEFAULT 0,
    
    -- Performance rates
    dm_open_rate DECIMAL(5,2),
    dm_response_rate DECIMAL(5,2),
    follower_conversion_rate DECIMAL(5,2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint
    CONSTRAINT unique_workspace_twitter_analytics_date UNIQUE (workspace_id, analysis_date)
);

-- Indexes for performance
CREATE INDEX idx_twitter_integrations_workspace ON twitter_integrations(workspace_id);
CREATE INDEX idx_twitter_profiles_workspace ON twitter_profiles(workspace_id);
CREATE INDEX idx_twitter_profiles_lead ON twitter_profiles(lead_id);
CREATE INDEX idx_twitter_messages_workspace_campaign ON twitter_messages(workspace_id, campaign_id);
CREATE INDEX idx_twitter_messages_status ON twitter_messages(workspace_id, status);
CREATE INDEX idx_twitter_engagements_profile ON twitter_engagements(workspace_id, profile_id);
CREATE INDEX idx_twitter_searches_active ON twitter_searches(workspace_id, is_active);

-- Functions
CREATE OR REPLACE FUNCTION update_twitter_daily_limits()
RETURNS void AS $$
BEGIN
    -- Reset daily limits for Twitter integrations
    UPDATE twitter_integrations
    SET daily_action_count = 0
    WHERE last_reset_at < CURRENT_DATE;
    
    -- Reset search action counts
    UPDATE twitter_searches
    SET actions_today = 0,
        last_reset_at = CURRENT_TIMESTAMP
    WHERE last_reset_at < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- RLS policies
ALTER TABLE twitter_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE twitter_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE twitter_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE twitter_engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE twitter_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE twitter_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE twitter_analytics ENABLE ROW LEVEL SECURITY;

-- RLS policies for twitter_integrations
CREATE POLICY "Users can view their workspace's Twitter integration"
ON twitter_integrations FOR SELECT
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Workspace admins can manage Twitter integration"
ON twitter_integrations FOR ALL
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid() 
        AND role IN ('workspace_admin', 'super_admin')
    )
);

-- RLS policies for twitter_profiles
CREATE POLICY "Users can view their workspace's Twitter profiles"
ON twitter_profiles FOR SELECT
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can manage their workspace's Twitter profiles"
ON twitter_profiles FOR ALL
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

-- Similar policies for other tables
CREATE POLICY "Users can manage their workspace's Twitter messages"
ON twitter_messages FOR ALL
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can view their workspace's Twitter engagements"
ON twitter_engagements FOR SELECT
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can manage their workspace's Twitter searches"
ON twitter_searches FOR ALL
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

-- Triggers
CREATE TRIGGER update_twitter_integrations_updated_at
    BEFORE UPDATE ON twitter_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_twitter_profiles_updated_at
    BEFORE UPDATE ON twitter_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_twitter_messages_updated_at
    BEFORE UPDATE ON twitter_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();