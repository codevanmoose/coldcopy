-- LinkedIn Integration Schema
-- Follows the established OAuth pattern from HubSpot and Pipedrive integrations

-- LinkedIn integrations table
CREATE TABLE IF NOT EXISTS linkedin_integrations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- OAuth tokens (encrypted)
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- LinkedIn account info
    linkedin_user_id TEXT NOT NULL,
    profile_url TEXT,
    full_name TEXT,
    email TEXT,
    
    -- Integration settings
    is_active BOOLEAN DEFAULT true,
    sync_enabled BOOLEAN DEFAULT true,
    daily_connection_limit INTEGER DEFAULT 100,
    daily_message_limit INTEGER DEFAULT 50,
    
    -- Permissions granted
    scopes TEXT[] DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    
    -- Unique constraint
    CONSTRAINT unique_workspace_linkedin UNIQUE (workspace_id)
);

-- LinkedIn profiles for enrichment and outreach
CREATE TABLE IF NOT EXISTS linkedin_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    
    -- LinkedIn identifiers
    linkedin_user_id TEXT NOT NULL,
    profile_url TEXT NOT NULL,
    public_identifier TEXT, -- vanity URL identifier
    
    -- Profile data
    full_name TEXT,
    first_name TEXT,
    last_name TEXT,
    headline TEXT,
    summary TEXT,
    location_name TEXT,
    location_country TEXT,
    industry TEXT,
    
    -- Current position
    current_company TEXT,
    current_title TEXT,
    current_company_linkedin_url TEXT,
    
    -- Connection info
    connection_degree INTEGER, -- 1st, 2nd, 3rd degree
    is_connected BOOLEAN DEFAULT false,
    connected_at TIMESTAMP WITH TIME ZONE,
    
    -- Engagement data
    last_message_sent_at TIMESTAMP WITH TIME ZONE,
    last_message_received_at TIMESTAMP WITH TIME ZONE,
    connection_request_sent_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    profile_data JSONB DEFAULT '{}', -- Full profile data from API
    last_enriched_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    CONSTRAINT unique_workspace_linkedin_user UNIQUE (workspace_id, linkedin_user_id)
);

-- LinkedIn messages for outreach tracking
CREATE TABLE IF NOT EXISTS linkedin_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES linkedin_profiles(id) ON DELETE CASCADE,
    
    -- Message details
    message_type TEXT CHECK (message_type IN ('connection_request', 'inmail', 'message')) NOT NULL,
    subject TEXT, -- For InMails
    content TEXT NOT NULL,
    
    -- LinkedIn message ID for tracking
    linkedin_message_id TEXT,
    linkedin_conversation_id TEXT,
    
    -- Status tracking
    status TEXT CHECK (status IN ('draft', 'scheduled', 'sent', 'delivered', 'read', 'replied', 'failed')) DEFAULT 'draft',
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    replied_at TIMESTAMP WITH TIME ZONE,
    
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

-- LinkedIn sync jobs for tracking bulk operations
CREATE TABLE IF NOT EXISTS linkedin_sync_jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    job_type TEXT CHECK (job_type IN ('profile_sync', 'message_sync', 'connection_sync')) NOT NULL,
    status TEXT CHECK (status IN ('pending', 'running', 'completed', 'failed')) DEFAULT 'pending',
    
    -- Progress tracking
    total_items INTEGER DEFAULT 0,
    processed_items INTEGER DEFAULT 0,
    successful_items INTEGER DEFAULT 0,
    failed_items INTEGER DEFAULT 0,
    
    -- Metadata
    config JSONB DEFAULT '{}',
    errors JSONB DEFAULT '[]',
    
    -- Timestamps
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- LinkedIn webhook events
CREATE TABLE IF NOT EXISTS linkedin_webhook_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    event_type TEXT NOT NULL,
    event_id TEXT NOT NULL,
    payload JSONB NOT NULL,
    
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_linkedin_event UNIQUE (event_id)
);

-- Indexes for performance
CREATE INDEX idx_linkedin_integrations_workspace ON linkedin_integrations(workspace_id);
CREATE INDEX idx_linkedin_profiles_workspace ON linkedin_profiles(workspace_id);
CREATE INDEX idx_linkedin_profiles_lead ON linkedin_profiles(lead_id);
CREATE INDEX idx_linkedin_profiles_enriched ON linkedin_profiles(workspace_id, last_enriched_at);
CREATE INDEX idx_linkedin_messages_workspace_campaign ON linkedin_messages(workspace_id, campaign_id);
CREATE INDEX idx_linkedin_messages_status ON linkedin_messages(workspace_id, status);
CREATE INDEX idx_linkedin_messages_sent ON linkedin_messages(workspace_id, sent_at);
CREATE INDEX idx_linkedin_sync_jobs_workspace_status ON linkedin_sync_jobs(workspace_id, status);
CREATE INDEX idx_linkedin_webhook_events_processed ON linkedin_webhook_events(workspace_id, processed);

-- RLS policies
ALTER TABLE linkedin_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_webhook_events ENABLE ROW LEVEL SECURITY;

-- RLS policies for linkedin_integrations
CREATE POLICY "Users can view their workspace's LinkedIn integration"
ON linkedin_integrations FOR SELECT
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Workspace admins can manage LinkedIn integration"
ON linkedin_integrations FOR ALL
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid() 
        AND role IN ('workspace_admin', 'super_admin')
    )
);

-- RLS policies for linkedin_profiles
CREATE POLICY "Users can view their workspace's LinkedIn profiles"
ON linkedin_profiles FOR SELECT
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can manage their workspace's LinkedIn profiles"
ON linkedin_profiles FOR ALL
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

-- RLS policies for linkedin_messages
CREATE POLICY "Users can view their workspace's LinkedIn messages"
ON linkedin_messages FOR SELECT
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can manage their workspace's LinkedIn messages"
ON linkedin_messages FOR ALL
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

-- Similar policies for sync_jobs and webhook_events
CREATE POLICY "Users can view their workspace's LinkedIn sync jobs"
ON linkedin_sync_jobs FOR SELECT
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can view their workspace's LinkedIn webhook events"
ON linkedin_webhook_events FOR SELECT
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

-- Functions
CREATE OR REPLACE FUNCTION update_linkedin_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER update_linkedin_integrations_updated_at
    BEFORE UPDATE ON linkedin_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_linkedin_profile_updated_at();

CREATE TRIGGER update_linkedin_profiles_updated_at
    BEFORE UPDATE ON linkedin_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_linkedin_profile_updated_at();

CREATE TRIGGER update_linkedin_messages_updated_at
    BEFORE UPDATE ON linkedin_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_linkedin_profile_updated_at();

CREATE TRIGGER update_linkedin_sync_jobs_updated_at
    BEFORE UPDATE ON linkedin_sync_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_linkedin_profile_updated_at();