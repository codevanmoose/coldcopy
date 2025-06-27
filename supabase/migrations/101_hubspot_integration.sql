-- HubSpot Integration Schema

-- Create enum for sync status
CREATE TYPE sync_status AS ENUM ('pending', 'syncing', 'completed', 'failed', 'paused');

-- Create enum for sync direction
CREATE TYPE sync_direction AS ENUM ('to_hubspot', 'from_hubspot', 'bidirectional');

-- HubSpot connections table
CREATE TABLE hubspot_connections (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    portal_id BIGINT NOT NULL,
    hub_domain VARCHAR(255),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    scopes TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id) -- One connection per workspace
);

-- Sync configurations table
CREATE TABLE hubspot_sync_configs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    object_type VARCHAR(50) NOT NULL, -- contacts, companies, deals, activities
    direction sync_direction NOT NULL DEFAULT 'bidirectional',
    is_enabled BOOLEAN DEFAULT TRUE,
    field_mappings JSONB DEFAULT '{}',
    sync_frequency_minutes INTEGER DEFAULT 30,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, object_type)
);

-- Sync jobs table for tracking sync operations
CREATE TABLE hubspot_sync_jobs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    object_type VARCHAR(50) NOT NULL,
    direction sync_direction NOT NULL,
    status sync_status DEFAULT 'pending',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    records_processed INTEGER DEFAULT 0,
    records_success INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_by UUID REFERENCES auth.users(id)
);

-- Object mappings table for tracking synced records
CREATE TABLE hubspot_object_mappings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    object_type VARCHAR(50) NOT NULL, -- contacts, companies, deals, activities
    coldcopy_id UUID NOT NULL,
    hubspot_id VARCHAR(255) NOT NULL,
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    sync_direction sync_direction NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, object_type, coldcopy_id),
    UNIQUE(workspace_id, object_type, hubspot_id)
);

-- Sync errors table for detailed error tracking
CREATE TABLE hubspot_sync_errors (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    sync_job_id UUID REFERENCES hubspot_sync_jobs(id) ON DELETE CASCADE,
    object_type VARCHAR(50) NOT NULL,
    coldcopy_id UUID,
    hubspot_id VARCHAR(255),
    error_code VARCHAR(100),
    error_message TEXT NOT NULL,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    next_retry_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook events table for HubSpot webhook processing
CREATE TABLE hubspot_webhook_events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    object_type VARCHAR(50) NOT NULL,
    object_id VARCHAR(255) NOT NULL,
    portal_id BIGINT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    processed_at TIMESTAMPTZ,
    payload JSONB NOT NULL,
    processing_status VARCHAR(50) DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_hubspot_connections_workspace ON hubspot_connections(workspace_id);
CREATE INDEX idx_hubspot_connections_portal ON hubspot_connections(portal_id);
CREATE INDEX idx_hubspot_sync_configs_workspace ON hubspot_sync_configs(workspace_id);
CREATE INDEX idx_hubspot_sync_jobs_workspace ON hubspot_sync_jobs(workspace_id);
CREATE INDEX idx_hubspot_sync_jobs_status ON hubspot_sync_jobs(status);
CREATE INDEX idx_hubspot_sync_jobs_created ON hubspot_sync_jobs(created_at DESC);
CREATE INDEX idx_hubspot_object_mappings_workspace ON hubspot_object_mappings(workspace_id);
CREATE INDEX idx_hubspot_object_mappings_coldcopy ON hubspot_object_mappings(coldcopy_id);
CREATE INDEX idx_hubspot_object_mappings_hubspot ON hubspot_object_mappings(hubspot_id);
CREATE INDEX idx_hubspot_sync_errors_workspace ON hubspot_sync_errors(workspace_id);
CREATE INDEX idx_hubspot_sync_errors_retry ON hubspot_sync_errors(next_retry_at) WHERE resolved_at IS NULL;
CREATE INDEX idx_hubspot_webhook_events_workspace ON hubspot_webhook_events(workspace_id);
CREATE INDEX idx_hubspot_webhook_events_processing ON hubspot_webhook_events(processing_status);
CREATE INDEX idx_hubspot_webhook_events_occurred ON hubspot_webhook_events(occurred_at DESC);

-- Create triggers for updated_at
CREATE TRIGGER update_hubspot_connections_updated_at
    BEFORE UPDATE ON hubspot_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hubspot_sync_configs_updated_at
    BEFORE UPDATE ON hubspot_sync_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hubspot_object_mappings_updated_at
    BEFORE UPDATE ON hubspot_object_mappings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE hubspot_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE hubspot_sync_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE hubspot_sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE hubspot_object_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE hubspot_sync_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE hubspot_webhook_events ENABLE ROW LEVEL SECURITY;

-- Connections policies
CREATE POLICY "Users can view connections for their workspaces"
    ON hubspot_connections FOR SELECT
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Workspace admins can manage connections"
    ON hubspot_connections FOR ALL
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid() AND role IN ('workspace_admin', 'super_admin')
    ));

-- Sync configs policies
CREATE POLICY "Users can view sync configs for their workspaces"
    ON hubspot_sync_configs FOR SELECT
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Workspace admins can manage sync configs"
    ON hubspot_sync_configs FOR ALL
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid() AND role IN ('workspace_admin', 'super_admin')
    ));

-- Sync jobs policies
CREATE POLICY "Users can view sync jobs for their workspaces"
    ON hubspot_sync_jobs FOR SELECT
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "System can insert sync jobs"
    ON hubspot_sync_jobs FOR INSERT
    WITH CHECK (true);

CREATE POLICY "System can update sync jobs"
    ON hubspot_sync_jobs FOR UPDATE
    USING (true);

-- Object mappings policies
CREATE POLICY "Users can view object mappings for their workspaces"
    ON hubspot_object_mappings FOR SELECT
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "System can manage object mappings"
    ON hubspot_object_mappings FOR ALL
    USING (true);

-- Sync errors policies
CREATE POLICY "Users can view sync errors for their workspaces"
    ON hubspot_sync_errors FOR SELECT
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "System can manage sync errors"
    ON hubspot_sync_errors FOR ALL
    USING (true);

-- Webhook events policies
CREATE POLICY "Users can view webhook events for their workspaces"
    ON hubspot_webhook_events FOR SELECT
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "System can manage webhook events"
    ON hubspot_webhook_events FOR ALL
    USING (true);

-- Helper functions

-- Get HubSpot connection for workspace
CREATE OR REPLACE FUNCTION get_hubspot_connection(p_workspace_id UUID)
RETURNS TABLE (
    id UUID,
    access_token TEXT,
    refresh_token TEXT,
    expires_at TIMESTAMPTZ,
    portal_id BIGINT,
    hub_domain VARCHAR(255),
    is_active BOOLEAN,
    last_sync_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        hc.id,
        hc.access_token,
        hc.refresh_token,
        hc.expires_at,
        hc.portal_id,
        hc.hub_domain,
        hc.is_active,
        hc.last_sync_at
    FROM hubspot_connections hc
    WHERE hc.workspace_id = p_workspace_id
    AND hc.is_active = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if object is mapped to HubSpot
CREATE OR REPLACE FUNCTION is_hubspot_mapped(
    p_workspace_id UUID,
    p_object_type VARCHAR(50),
    p_coldcopy_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    mapping_exists BOOLEAN := FALSE;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM hubspot_object_mappings
        WHERE workspace_id = p_workspace_id
        AND object_type = p_object_type
        AND coldcopy_id = p_coldcopy_id
    ) INTO mapping_exists;
    
    RETURN mapping_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;