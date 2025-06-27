-- Salesforce CRM Integration
-- Comprehensive integration for two-way sync with Salesforce

-- Salesforce integration credentials
CREATE TABLE IF NOT EXISTS salesforce_integrations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- OAuth credentials
    instance_url TEXT NOT NULL, -- e.g., https://company.my.salesforce.com
    access_token TEXT NOT NULL, -- Encrypted
    refresh_token TEXT NOT NULL, -- Encrypted
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Salesforce user info
    salesforce_user_id TEXT NOT NULL,
    salesforce_org_id TEXT NOT NULL,
    salesforce_username TEXT,
    salesforce_email TEXT,
    
    -- Integration settings
    is_active BOOLEAN DEFAULT true,
    sync_enabled BOOLEAN DEFAULT true,
    sync_direction TEXT CHECK (sync_direction IN ('to_salesforce', 'from_salesforce', 'bidirectional')) DEFAULT 'bidirectional',
    
    -- Sync configuration
    sync_leads BOOLEAN DEFAULT true,
    sync_contacts BOOLEAN DEFAULT true,
    sync_accounts BOOLEAN DEFAULT true,
    sync_opportunities BOOLEAN DEFAULT true,
    sync_activities BOOLEAN DEFAULT true,
    sync_campaigns BOOLEAN DEFAULT true,
    
    -- Field mappings
    lead_field_mappings JSONB DEFAULT '{}',
    contact_field_mappings JSONB DEFAULT '{}',
    account_field_mappings JSONB DEFAULT '{}',
    opportunity_field_mappings JSONB DEFAULT '{}',
    
    -- Sync frequency
    sync_frequency_minutes INTEGER DEFAULT 15,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    last_successful_sync_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    api_version TEXT DEFAULT 'v59.0',
    scopes TEXT[] DEFAULT ARRAY['api', 'refresh_token', 'offline_access'],
    webhook_secret TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_salesforce_workspace UNIQUE (workspace_id)
);

-- Salesforce object mappings
CREATE TABLE IF NOT EXISTS salesforce_object_mappings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Object mapping
    local_object_type TEXT CHECK (local_object_type IN ('lead', 'campaign', 'campaign_email', 'email_event')) NOT NULL,
    local_object_id UUID NOT NULL,
    salesforce_object_type TEXT CHECK (salesforce_object_type IN ('Lead', 'Contact', 'Account', 'Opportunity', 'Campaign', 'Task', 'Event')) NOT NULL,
    salesforce_object_id TEXT NOT NULL,
    
    -- Sync status
    last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    sync_status TEXT CHECK (sync_status IN ('synced', 'pending', 'error', 'conflict')) DEFAULT 'synced',
    sync_error TEXT,
    
    -- Version tracking
    local_version INTEGER DEFAULT 1,
    salesforce_version INTEGER DEFAULT 1,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_salesforce_mapping UNIQUE (workspace_id, local_object_type, local_object_id),
    CONSTRAINT unique_salesforce_object UNIQUE (workspace_id, salesforce_object_type, salesforce_object_id)
);

-- Salesforce sync queue
CREATE TABLE IF NOT EXISTS salesforce_sync_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Operation details
    operation TEXT CHECK (operation IN ('create', 'update', 'delete', 'upsert')) NOT NULL,
    object_type TEXT CHECK (object_type IN ('Lead', 'Contact', 'Account', 'Opportunity', 'Campaign', 'Task', 'Event')) NOT NULL,
    salesforce_id TEXT,
    local_id UUID,
    
    -- Payload
    payload JSONB NOT NULL,
    
    -- Processing status
    status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')) DEFAULT 'pending',
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    
    -- Error handling
    error_message TEXT,
    error_code TEXT,
    
    -- Scheduling
    scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Priority
    priority INTEGER DEFAULT 5, -- 1-10, lower is higher priority
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Salesforce sync logs
CREATE TABLE IF NOT EXISTS salesforce_sync_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Sync details
    sync_type TEXT CHECK (sync_type IN ('full', 'incremental', 'manual', 'webhook')) NOT NULL,
    sync_direction TEXT CHECK (sync_direction IN ('to_salesforce', 'from_salesforce', 'bidirectional')) NOT NULL,
    
    -- Objects synced
    objects_synced TEXT[],
    
    -- Metrics
    total_records INTEGER DEFAULT 0,
    created_records INTEGER DEFAULT 0,
    updated_records INTEGER DEFAULT 0,
    deleted_records INTEGER DEFAULT 0,
    failed_records INTEGER DEFAULT 0,
    
    -- Performance
    duration_seconds INTEGER,
    api_calls_made INTEGER DEFAULT 0,
    api_calls_remaining INTEGER,
    
    -- Status
    status TEXT CHECK (status IN ('started', 'completed', 'failed', 'cancelled')) DEFAULT 'started',
    error_message TEXT,
    warnings JSONB DEFAULT '[]',
    
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Salesforce field mappings configuration
CREATE TABLE IF NOT EXISTS salesforce_field_mappings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Mapping details
    mapping_name TEXT NOT NULL,
    salesforce_object TEXT NOT NULL,
    local_object TEXT NOT NULL,
    
    -- Field mappings
    field_mappings JSONB NOT NULL, -- Array of {local_field, salesforce_field, transform}
    
    -- Configuration
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    sync_direction TEXT CHECK (sync_direction IN ('to_salesforce', 'from_salesforce', 'bidirectional')) DEFAULT 'bidirectional',
    
    -- Conflict resolution
    conflict_resolution TEXT CHECK (conflict_resolution IN ('salesforce_wins', 'local_wins', 'newest_wins', 'manual')) DEFAULT 'newest_wins',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_salesforce_mapping_name UNIQUE (workspace_id, mapping_name)
);

-- Salesforce webhook events
CREATE TABLE IF NOT EXISTS salesforce_webhook_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Event details
    event_type TEXT NOT NULL,
    object_type TEXT NOT NULL,
    salesforce_id TEXT NOT NULL,
    change_type TEXT CHECK (change_type IN ('created', 'updated', 'deleted', 'undeleted')) NOT NULL,
    
    -- Payload
    payload JSONB NOT NULL,
    changed_fields TEXT[],
    
    -- Processing
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMP WITH TIME ZONE,
    processing_error TEXT,
    
    -- Metadata
    replay_id TEXT,
    event_date TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Salesforce custom objects
CREATE TABLE IF NOT EXISTS salesforce_custom_objects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Object details
    api_name TEXT NOT NULL, -- e.g., Custom_Lead_Score__c
    label TEXT NOT NULL,
    plural_label TEXT,
    
    -- Fields
    fields JSONB NOT NULL, -- Array of field definitions
    
    -- Configuration
    sync_enabled BOOLEAN DEFAULT false,
    field_mappings JSONB DEFAULT '{}',
    
    -- Metadata
    is_custom BOOLEAN DEFAULT true,
    created_by_id TEXT,
    last_modified_date TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_salesforce_custom_object UNIQUE (workspace_id, api_name)
);

-- Salesforce campaign member sync
CREATE TABLE IF NOT EXISTS salesforce_campaign_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Local references
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    
    -- Salesforce references
    salesforce_campaign_id TEXT NOT NULL,
    salesforce_lead_id TEXT,
    salesforce_contact_id TEXT,
    salesforce_campaign_member_id TEXT,
    
    -- Member status
    status TEXT,
    has_responded BOOLEAN DEFAULT false,
    
    -- Dates
    first_responded_date TIMESTAMP WITH TIME ZONE,
    
    -- Sync status
    last_synced_at TIMESTAMP WITH TIME ZONE,
    sync_status TEXT CHECK (sync_status IN ('synced', 'pending', 'error')) DEFAULT 'pending',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_salesforce_campaign_member UNIQUE (workspace_id, campaign_id, lead_id)
);

-- Indexes for performance
CREATE INDEX idx_salesforce_integrations_workspace ON salesforce_integrations(workspace_id);
CREATE INDEX idx_salesforce_object_mappings_workspace ON salesforce_object_mappings(workspace_id, local_object_type);
CREATE INDEX idx_salesforce_object_mappings_salesforce ON salesforce_object_mappings(workspace_id, salesforce_object_type);
CREATE INDEX idx_salesforce_sync_queue_status ON salesforce_sync_queue(workspace_id, status, scheduled_for);
CREATE INDEX idx_salesforce_sync_queue_priority ON salesforce_sync_queue(workspace_id, status, priority);
CREATE INDEX idx_salesforce_sync_logs_workspace ON salesforce_sync_logs(workspace_id, started_at DESC);
CREATE INDEX idx_salesforce_webhook_events_processed ON salesforce_webhook_events(workspace_id, processed, created_at);
CREATE INDEX idx_salesforce_campaign_members_campaign ON salesforce_campaign_members(workspace_id, campaign_id);

-- Functions
CREATE OR REPLACE FUNCTION add_to_salesforce_sync_queue(
    p_workspace_id UUID,
    p_operation TEXT,
    p_object_type TEXT,
    p_payload JSONB,
    p_local_id UUID DEFAULT NULL,
    p_salesforce_id TEXT DEFAULT NULL,
    p_priority INTEGER DEFAULT 5
) RETURNS UUID AS $$
DECLARE
    queue_id UUID;
BEGIN
    INSERT INTO salesforce_sync_queue (
        workspace_id,
        operation,
        object_type,
        payload,
        local_id,
        salesforce_id,
        priority
    ) VALUES (
        p_workspace_id,
        p_operation,
        p_object_type,
        p_payload,
        p_local_id,
        p_salesforce_id,
        p_priority
    ) RETURNING id INTO queue_id;
    
    RETURN queue_id;
END;
$$ LANGUAGE plpgsql;

-- Function to handle Salesforce webhook
CREATE OR REPLACE FUNCTION process_salesforce_webhook(
    p_workspace_id UUID,
    p_event_type TEXT,
    p_object_type TEXT,
    p_salesforce_id TEXT,
    p_change_type TEXT,
    p_payload JSONB
) RETURNS UUID AS $$
DECLARE
    event_id UUID;
    local_id UUID;
BEGIN
    -- Insert webhook event
    INSERT INTO salesforce_webhook_events (
        workspace_id,
        event_type,
        object_type,
        salesforce_id,
        change_type,
        payload
    ) VALUES (
        p_workspace_id,
        p_event_type,
        p_object_type,
        p_salesforce_id,
        p_change_type,
        p_payload
    ) RETURNING id INTO event_id;
    
    -- Find local object mapping
    SELECT local_object_id INTO local_id
    FROM salesforce_object_mappings
    WHERE workspace_id = p_workspace_id
    AND salesforce_object_type = p_object_type
    AND salesforce_object_id = p_salesforce_id;
    
    -- Add to sync queue if mapping exists
    IF local_id IS NOT NULL THEN
        PERFORM add_to_salesforce_sync_queue(
            p_workspace_id,
            'update',
            p_object_type,
            p_payload,
            local_id,
            p_salesforce_id,
            3 -- Higher priority for webhook events
        );
    END IF;
    
    RETURN event_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to sync leads to Salesforce
CREATE OR REPLACE FUNCTION sync_lead_to_salesforce()
RETURNS TRIGGER AS $$
DECLARE
    sf_integration RECORD;
BEGIN
    -- Check if Salesforce integration is active
    SELECT * INTO sf_integration
    FROM salesforce_integrations
    WHERE workspace_id = NEW.workspace_id
    AND is_active = true
    AND sync_enabled = true
    AND sync_leads = true;
    
    IF sf_integration.id IS NOT NULL THEN
        -- Add to sync queue
        PERFORM add_to_salesforce_sync_queue(
            NEW.workspace_id,
            CASE 
                WHEN TG_OP = 'INSERT' THEN 'create'
                WHEN TG_OP = 'UPDATE' THEN 'update'
                ELSE 'delete'
            END,
            'Lead',
            to_jsonb(NEW),
            NEW.id,
            NULL,
            5
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_lead_to_salesforce
AFTER INSERT OR UPDATE ON leads
FOR EACH ROW
EXECUTE FUNCTION sync_lead_to_salesforce();

-- Trigger to sync campaigns to Salesforce
CREATE OR REPLACE FUNCTION sync_campaign_to_salesforce()
RETURNS TRIGGER AS $$
DECLARE
    sf_integration RECORD;
BEGIN
    -- Check if Salesforce integration is active
    SELECT * INTO sf_integration
    FROM salesforce_integrations
    WHERE workspace_id = NEW.workspace_id
    AND is_active = true
    AND sync_enabled = true
    AND sync_campaigns = true;
    
    IF sf_integration.id IS NOT NULL THEN
        -- Add to sync queue
        PERFORM add_to_salesforce_sync_queue(
            NEW.workspace_id,
            CASE 
                WHEN TG_OP = 'INSERT' THEN 'create'
                WHEN TG_OP = 'UPDATE' THEN 'update'
                ELSE 'delete'
            END,
            'Campaign',
            to_jsonb(NEW),
            NEW.id,
            NULL,
            5
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_campaign_to_salesforce
AFTER INSERT OR UPDATE ON campaigns
FOR EACH ROW
EXECUTE FUNCTION sync_campaign_to_salesforce();

-- Function to calculate sync metrics
CREATE OR REPLACE FUNCTION calculate_salesforce_sync_metrics(
    p_workspace_id UUID,
    p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '24 hours',
    p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
) RETURNS TABLE (
    total_syncs INTEGER,
    successful_syncs INTEGER,
    failed_syncs INTEGER,
    average_duration_seconds INTEGER,
    total_records_synced INTEGER,
    api_calls_made INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_syncs,
        COUNT(*) FILTER (WHERE status = 'completed')::INTEGER as successful_syncs,
        COUNT(*) FILTER (WHERE status = 'failed')::INTEGER as failed_syncs,
        AVG(duration_seconds)::INTEGER as average_duration_seconds,
        SUM(total_records)::INTEGER as total_records_synced,
        SUM(api_calls_made)::INTEGER as api_calls_made
    FROM salesforce_sync_logs
    WHERE workspace_id = p_workspace_id
    AND started_at BETWEEN p_start_date AND p_end_date;
END;
$$ LANGUAGE plpgsql;

-- RLS policies
ALTER TABLE salesforce_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE salesforce_object_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE salesforce_sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE salesforce_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE salesforce_field_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE salesforce_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE salesforce_custom_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE salesforce_campaign_members ENABLE ROW LEVEL SECURITY;

-- RLS policies for salesforce_integrations
CREATE POLICY "Users can manage their workspace's Salesforce integration"
ON salesforce_integrations FOR ALL
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
        AND role IN ('workspace_admin', 'super_admin')
    )
);

-- Similar policies for other tables
CREATE POLICY "Users can view their workspace's Salesforce data"
ON salesforce_object_mappings FOR SELECT
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can view their workspace's Salesforce sync queue"
ON salesforce_sync_queue FOR SELECT
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can view their workspace's Salesforce sync logs"
ON salesforce_sync_logs FOR SELECT
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

-- Triggers
CREATE TRIGGER update_salesforce_integrations_updated_at
    BEFORE UPDATE ON salesforce_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_salesforce_object_mappings_updated_at
    BEFORE UPDATE ON salesforce_object_mappings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_salesforce_sync_queue_updated_at
    BEFORE UPDATE ON salesforce_sync_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_salesforce_field_mappings_updated_at
    BEFORE UPDATE ON salesforce_field_mappings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_salesforce_custom_objects_updated_at
    BEFORE UPDATE ON salesforce_custom_objects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_salesforce_campaign_members_updated_at
    BEFORE UPDATE ON salesforce_campaign_members
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();