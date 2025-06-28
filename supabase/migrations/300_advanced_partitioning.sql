-- Advanced Partitioning Strategy for ColdCopy
-- This migration implements comprehensive table partitioning for optimal performance at scale

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_partman;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- 1. Partition email_events by month with automatic management
-- Drop existing table if it exists
DROP TABLE IF EXISTS email_events CASCADE;

-- Create partitioned email_events table
CREATE TABLE email_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    campaign_email_id UUID REFERENCES campaign_emails(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed', 'replied')),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    email_address TEXT NOT NULL,
    subject TEXT,
    tracking_id UUID,
    user_agent TEXT,
    ip_address INET,
    location JSONB,
    link_url TEXT,
    bounce_reason TEXT,
    complaint_type TEXT,
    reply_content TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Create initial partitions (3 months back, current month, 12 months forward)
SELECT partman.create_parent(
    p_parent_table => 'public.email_events',
    p_control => 'created_at',
    p_type => 'range',
    p_interval => 'monthly',
    p_premake => 12,
    p_automatic_maintenance => 'on'
);

-- Configure partition management
UPDATE partman.part_config 
SET 
    retention = '12 months',
    retention_keep_table = false,
    retention_keep_index = false,
    optimize_constraint = 30,
    inherit_privileges = true
WHERE parent_table = 'public.email_events';

-- 2. Partition email_messages by month
DROP TABLE IF EXISTS email_messages CASCADE;

CREATE TABLE email_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    thread_id UUID NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    from_email TEXT NOT NULL,
    from_name TEXT,
    to_emails TEXT[] NOT NULL,
    cc_emails TEXT[],
    bcc_emails TEXT[],
    subject TEXT NOT NULL,
    body_text TEXT,
    body_html TEXT,
    attachments JSONB DEFAULT '[]',
    message_id TEXT,
    in_reply_to TEXT,
    references TEXT[],
    is_read BOOLEAN DEFAULT false,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

SELECT partman.create_parent(
    p_parent_table => 'public.email_messages',
    p_control => 'created_at',
    p_type => 'range',
    p_interval => 'monthly',
    p_premake => 12,
    p_automatic_maintenance => 'on'
);

UPDATE partman.part_config 
SET 
    retention = '24 months',
    retention_keep_table = false,
    retention_keep_index = false,
    optimize_constraint = 30,
    inherit_privileges = true
WHERE parent_table = 'public.email_messages';

-- 3. Partition audit_logs by month
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

SELECT partman.create_parent(
    p_parent_table => 'public.audit_logs',
    p_control => 'created_at',
    p_type => 'range',
    p_interval => 'monthly',
    p_premake => 3,
    p_automatic_maintenance => 'on'
);

UPDATE partman.part_config 
SET 
    retention = '36 months',
    retention_keep_table = true,
    retention_keep_index = false,
    optimize_constraint = 30,
    inherit_privileges => true
WHERE parent_table = 'public.audit_logs';

-- 4. Create composite indexes for multi-tenant queries
-- Email events indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_events_workspace_timestamp 
ON email_events (workspace_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_events_workspace_event_type 
ON email_events (workspace_id, event_type, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_events_campaign_timestamp 
ON email_events (campaign_id, created_at DESC) WHERE campaign_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_events_lead_timestamp 
ON email_events (lead_id, created_at DESC) WHERE lead_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_events_tracking_id 
ON email_events (tracking_id) WHERE tracking_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_events_email_workspace 
ON email_events (email_address, workspace_id);

-- Email messages indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_messages_workspace_timestamp 
ON email_messages (workspace_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_messages_thread_timestamp 
ON email_messages (thread_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_messages_from_email 
ON email_messages (from_email, workspace_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_messages_unread 
ON email_messages (workspace_id, is_read) WHERE is_read = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_messages_direction_workspace 
ON email_messages (direction, workspace_id, created_at DESC);

-- Leads indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_workspace_email 
ON leads (workspace_id, email);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_workspace_status 
ON leads (workspace_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_workspace_created 
ON leads (workspace_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_workspace_updated 
ON leads (workspace_id, updated_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_source_workspace 
ON leads (lead_source, workspace_id);

-- Campaigns indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_workspace_status 
ON campaigns (workspace_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_workspace_created 
ON campaigns (workspace_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_workspace_scheduled 
ON campaigns (workspace_id, scheduled_start_date) WHERE scheduled_start_date IS NOT NULL;

-- Campaign emails indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaign_emails_campaign_status 
ON campaign_emails (campaign_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaign_emails_lead_campaign 
ON campaign_emails (lead_id, campaign_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaign_emails_scheduled 
ON campaign_emails (scheduled_at) WHERE scheduled_at IS NOT NULL;

-- Audit logs indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_workspace_timestamp 
ON audit_logs (workspace_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user_timestamp 
ON audit_logs (user_id, created_at DESC) WHERE user_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_action_workspace 
ON audit_logs (action, workspace_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_resource 
ON audit_logs (resource_type, resource_id) WHERE resource_id IS NOT NULL;

-- 5. Create partial indexes for hot data
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_events_recent_opens 
ON email_events (workspace_id, created_at DESC) 
WHERE event_type = 'opened' AND created_at >= NOW() - INTERVAL '7 days';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_events_recent_clicks 
ON email_events (workspace_id, created_at DESC) 
WHERE event_type = 'clicked' AND created_at >= NOW() - INTERVAL '7 days';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_active 
ON campaigns (workspace_id, status, created_at DESC) 
WHERE status IN ('active', 'scheduled');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_hot 
ON leads (workspace_id, updated_at DESC) 
WHERE status = 'active' AND updated_at >= NOW() - INTERVAL '30 days';

-- 6. Create expression indexes for common queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_events_date_trunc_day 
ON email_events (workspace_id, date_trunc('day', created_at));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_events_date_trunc_hour 
ON email_events (workspace_id, date_trunc('hour', created_at));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_name_lower 
ON leads (workspace_id, lower(name)) WHERE name IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_company_lower 
ON leads (workspace_id, lower(company)) WHERE company IS NOT NULL;

-- 7. Create GIN indexes for JSONB fields
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_enrichment_data_gin 
ON leads USING GIN (enrichment_data);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_events_metadata_gin 
ON email_events USING GIN (metadata);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_settings_gin 
ON campaigns USING GIN (settings);

-- 8. Add database functions for partition management
CREATE OR REPLACE FUNCTION maintain_partitions()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- Run partition maintenance
    PERFORM partman.run_maintenance();
    
    -- Update table statistics
    ANALYZE email_events;
    ANALYZE email_messages;
    ANALYZE audit_logs;
    
    -- Log maintenance run
    INSERT INTO audit_logs (action, resource_type, metadata)
    VALUES (
        'partition_maintenance_run',
        'system',
        jsonb_build_object(
            'timestamp', NOW(),
            'maintenance_type', 'automated'
        )
    );
END;
$$;

-- 9. Create function to get partition information
CREATE OR REPLACE FUNCTION get_partition_info()
RETURNS TABLE (
    table_name text,
    partition_count bigint,
    total_size text,
    retention_period text
)
LANGUAGE sql
AS $$
    SELECT 
        pc.parent_table::text,
        COUNT(p.partition_table)::bigint,
        pg_size_pretty(SUM(pg_total_relation_size(p.partition_table::regclass)))::text,
        pc.retention::text
    FROM partman.part_config pc
    LEFT JOIN partman.show_partitions(pc.parent_table) p ON true
    GROUP BY pc.parent_table, pc.retention;
$$;

-- 10. Schedule automatic partition maintenance
SELECT cron.schedule(
    'partition-maintenance',
    '0 2 * * *', -- Daily at 2 AM
    'SELECT maintain_partitions();'
);

-- 11. Create monitoring views
CREATE OR REPLACE VIEW partition_health AS
SELECT 
    pc.parent_table,
    pc.partition_interval,
    pc.retention,
    pc.premake,
    COUNT(pt.partition_table) as partition_count,
    pg_size_pretty(SUM(pg_total_relation_size(pt.partition_table::regclass))) as total_size
FROM partman.part_config pc
LEFT JOIN partman.show_partitions(pc.parent_table) pt ON true
GROUP BY pc.parent_table, pc.partition_interval, pc.retention, pc.premake;

CREATE OR REPLACE VIEW index_usage_stats AS
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- 12. Add comments for documentation
COMMENT ON TABLE email_events IS 'Partitioned table storing email tracking events by month';
COMMENT ON TABLE email_messages IS 'Partitioned table storing inbox messages by month';
COMMENT ON TABLE audit_logs IS 'Partitioned table storing audit logs by month with 3-year retention';
COMMENT ON FUNCTION maintain_partitions() IS 'Automated partition maintenance function';
COMMENT ON FUNCTION get_partition_info() IS 'Returns information about all partitioned tables';
COMMENT ON VIEW partition_health IS 'Monitoring view for partition health and sizes';
COMMENT ON VIEW index_usage_stats IS 'Monitoring view for index usage statistics';

-- Grant necessary permissions
GRANT SELECT ON partition_health TO authenticated;
GRANT SELECT ON index_usage_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_partition_info() TO authenticated;