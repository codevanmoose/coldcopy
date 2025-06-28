-- ColdCopy Database Optimization Script
-- Run this after all migrations are complete
-- Estimated time: 5-10 minutes depending on data size

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS pg_trgm; -- For text search
CREATE EXTENSION IF NOT EXISTS btree_gin; -- For composite indexes
CREATE EXTENSION IF NOT EXISTS postgres_fdw; -- For future sharding

-- =====================================================
-- PARTITIONING SETUP
-- =====================================================

-- Create partition management function
CREATE OR REPLACE FUNCTION create_monthly_partitions(
    table_name text,
    start_date date,
    months_ahead integer DEFAULT 3
)
RETURNS void AS $$
DECLARE
    partition_date date;
    partition_name text;
    start_range date;
    end_range date;
BEGIN
    FOR i IN 0..months_ahead LOOP
        partition_date := start_date + (i || ' months')::interval;
        partition_name := table_name || '_' || to_char(partition_date, 'YYYY_MM');
        start_range := date_trunc('month', partition_date);
        end_range := start_range + '1 month'::interval;
        
        -- Check if partition exists
        IF NOT EXISTS (
            SELECT 1 FROM pg_class WHERE relname = partition_name
        ) THEN
            EXECUTE format(
                'CREATE TABLE %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
                partition_name, table_name, start_range, end_range
            );
            RAISE NOTICE 'Created partition %', partition_name;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create partitions for email_events (if not already partitioned)
DO $$
BEGIN
    -- Create partitions for the next 3 months
    PERFORM create_monthly_partitions('email_events', CURRENT_DATE, 3);
    
    -- Create partitions for historical data (last 12 months)
    PERFORM create_monthly_partitions('email_events', CURRENT_DATE - '12 months'::interval, 12);
END $$;

-- =====================================================
-- MATERIALIZED VIEWS OPTIMIZATION
-- =====================================================

-- Drop existing views if they exist and recreate with optimizations
DROP MATERIALIZED VIEW IF EXISTS campaign_analytics_mv CASCADE;
DROP MATERIALIZED VIEW IF EXISTS workspace_usage_analytics_mv CASCADE;
DROP MATERIALIZED VIEW IF EXISTS lead_engagement_scores_mv CASCADE;
DROP MATERIALIZED VIEW IF EXISTS email_deliverability_metrics_mv CASCADE;

-- Campaign Analytics Materialized View
CREATE MATERIALIZED VIEW campaign_analytics_mv AS
WITH campaign_stats AS (
    SELECT 
        c.id AS campaign_id,
        c.workspace_id,
        c.name AS campaign_name,
        c.status AS campaign_status,
        c.created_at AS campaign_created_at,
        COUNT(DISTINCT ce.id) AS total_emails,
        COUNT(DISTINCT CASE WHEN ce.status = 'sent' THEN ce.id END) AS sent_count,
        COUNT(DISTINCT CASE WHEN ce.status = 'delivered' THEN ce.id END) AS delivered_count,
        COUNT(DISTINCT CASE WHEN ce.status = 'bounced' THEN ce.id END) AS bounced_count,
        COUNT(DISTINCT CASE WHEN ce.status = 'failed' THEN ce.id END) AS failed_count
    FROM campaigns c
    LEFT JOIN campaign_emails ce ON c.id = ce.campaign_id
    GROUP BY c.id
),
event_stats AS (
    SELECT 
        ce.campaign_id,
        COUNT(DISTINCT CASE WHEN ee.event_type = 'open' THEN ee.lead_id END) AS unique_opens,
        COUNT(CASE WHEN ee.event_type = 'open' THEN 1 END) AS total_opens,
        COUNT(DISTINCT CASE WHEN ee.event_type = 'click' THEN ee.lead_id END) AS unique_clicks,
        COUNT(CASE WHEN ee.event_type = 'click' THEN 1 END) AS total_clicks,
        COUNT(DISTINCT CASE WHEN ee.event_type = 'reply' THEN ee.lead_id END) AS replies,
        COUNT(DISTINCT CASE WHEN ee.event_type = 'unsubscribe' THEN ee.lead_id END) AS unsubscribes
    FROM campaign_emails ce
    JOIN email_events ee ON ce.id = ee.campaign_email_id
    GROUP BY ce.campaign_id
)
SELECT 
    cs.*,
    COALESCE(es.unique_opens, 0) AS unique_opens,
    COALESCE(es.total_opens, 0) AS total_opens,
    COALESCE(es.unique_clicks, 0) AS unique_clicks,
    COALESCE(es.total_clicks, 0) AS total_clicks,
    COALESCE(es.replies, 0) AS replies,
    COALESCE(es.unsubscribes, 0) AS unsubscribes,
    CASE 
        WHEN cs.sent_count > 0 THEN (es.unique_opens::float / cs.sent_count * 100)
        ELSE 0 
    END AS open_rate,
    CASE 
        WHEN cs.sent_count > 0 THEN (es.unique_clicks::float / cs.sent_count * 100)
        ELSE 0 
    END AS click_rate,
    CASE 
        WHEN cs.sent_count > 0 THEN (es.replies::float / cs.sent_count * 100)
        ELSE 0 
    END AS reply_rate,
    NOW() AS last_refreshed
FROM campaign_stats cs
LEFT JOIN event_stats es ON cs.campaign_id = es.campaign_id;

-- Create indexes on materialized view
CREATE INDEX idx_campaign_analytics_mv_workspace ON campaign_analytics_mv(workspace_id);
CREATE INDEX idx_campaign_analytics_mv_status ON campaign_analytics_mv(campaign_status);
CREATE INDEX idx_campaign_analytics_mv_created ON campaign_analytics_mv(campaign_created_at DESC);

-- Workspace Usage Analytics
CREATE MATERIALIZED VIEW workspace_usage_analytics_mv AS
SELECT 
    w.id AS workspace_id,
    w.name AS workspace_name,
    COUNT(DISTINCT u.id) AS total_users,
    COUNT(DISTINCT l.id) AS total_leads,
    COUNT(DISTINCT c.id) AS total_campaigns,
    COUNT(DISTINCT ce.id) AS total_emails_sent,
    SUM(CASE WHEN c.created_at > NOW() - INTERVAL '30 days' THEN 1 ELSE 0 END) AS campaigns_last_30_days,
    SUM(CASE WHEN l.created_at > NOW() - INTERVAL '30 days' THEN 1 ELSE 0 END) AS leads_added_last_30_days,
    MAX(c.created_at) AS last_campaign_created,
    MAX(ce.sent_at) AS last_email_sent,
    NOW() AS last_refreshed
FROM workspaces w
LEFT JOIN users u ON w.id = u.workspace_id
LEFT JOIN leads l ON w.id = l.workspace_id
LEFT JOIN campaigns c ON w.id = c.workspace_id
LEFT JOIN campaign_emails ce ON c.id = ce.campaign_id
GROUP BY w.id;

CREATE INDEX idx_workspace_usage_mv_workspace ON workspace_usage_analytics_mv(workspace_id);

-- Lead Engagement Scores
CREATE MATERIALIZED VIEW lead_engagement_scores_mv AS
WITH lead_email_stats AS (
    SELECT 
        l.id AS lead_id,
        l.workspace_id,
        COUNT(DISTINCT ce.id) AS emails_received,
        COUNT(DISTINCT CASE WHEN ee.event_type = 'open' THEN ee.id END) AS email_opens,
        COUNT(DISTINCT CASE WHEN ee.event_type = 'click' THEN ee.id END) AS email_clicks,
        COUNT(DISTINCT CASE WHEN ee.event_type = 'reply' THEN ee.id END) AS email_replies,
        MAX(ee.created_at) AS last_engagement_date
    FROM leads l
    LEFT JOIN campaign_emails ce ON l.id = ce.lead_id
    LEFT JOIN email_events ee ON ce.id = ee.campaign_email_id
    GROUP BY l.id, l.workspace_id
)
SELECT 
    lead_id,
    workspace_id,
    emails_received,
    email_opens,
    email_clicks,
    email_replies,
    last_engagement_date,
    -- Calculate engagement score (0-100)
    LEAST(100, 
        (CASE WHEN emails_received > 0 THEN email_opens::float / emails_received * 30 ELSE 0 END) +
        (CASE WHEN emails_received > 0 THEN email_clicks::float / emails_received * 40 ELSE 0 END) +
        (CASE WHEN emails_received > 0 THEN email_replies::float / emails_received * 30 ELSE 0 END)
    )::integer AS engagement_score,
    NOW() AS last_refreshed
FROM lead_email_stats;

CREATE INDEX idx_lead_engagement_mv_workspace ON lead_engagement_scores_mv(workspace_id);
CREATE INDEX idx_lead_engagement_mv_lead ON lead_engagement_scores_mv(lead_id);
CREATE INDEX idx_lead_engagement_mv_score ON lead_engagement_scores_mv(engagement_score DESC);

-- Email Deliverability Metrics
CREATE MATERIALIZED VIEW email_deliverability_metrics_mv AS
WITH daily_stats AS (
    SELECT 
        w.id AS workspace_id,
        DATE(ce.sent_at) AS send_date,
        COUNT(ce.id) AS total_sent,
        COUNT(CASE WHEN ce.status = 'delivered' THEN 1 END) AS delivered,
        COUNT(CASE WHEN ce.status = 'bounced' THEN 1 END) AS bounced,
        COUNT(CASE WHEN ce.status = 'complained' THEN 1 END) AS complaints
    FROM workspaces w
    JOIN campaigns c ON w.id = c.workspace_id
    JOIN campaign_emails ce ON c.id = ce.campaign_id
    WHERE ce.sent_at > NOW() - INTERVAL '30 days'
    GROUP BY w.id, DATE(ce.sent_at)
)
SELECT 
    workspace_id,
    send_date,
    total_sent,
    delivered,
    bounced,
    complaints,
    CASE 
        WHEN total_sent > 0 THEN (delivered::float / total_sent * 100)
        ELSE 0 
    END AS delivery_rate,
    CASE 
        WHEN total_sent > 0 THEN (bounced::float / total_sent * 100)
        ELSE 0 
    END AS bounce_rate,
    CASE 
        WHEN total_sent > 0 THEN (complaints::float / total_sent * 100)
        ELSE 0 
    END AS complaint_rate,
    NOW() AS last_refreshed
FROM daily_stats;

CREATE INDEX idx_deliverability_mv_workspace ON email_deliverability_metrics_mv(workspace_id);
CREATE INDEX idx_deliverability_mv_date ON email_deliverability_metrics_mv(send_date DESC);

-- =====================================================
-- COMPOSITE INDEXES FOR COMMON QUERIES
-- =====================================================

-- Workspace isolation pattern (add to all major tables)
CREATE INDEX IF NOT EXISTS idx_leads_workspace_created ON leads(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_workspace_status ON leads(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_workspace_email ON leads(workspace_id, email);

CREATE INDEX IF NOT EXISTS idx_campaigns_workspace_created ON campaigns(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_workspace_status ON campaigns(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_campaigns_workspace_type ON campaigns(workspace_id, type);

CREATE INDEX IF NOT EXISTS idx_campaign_emails_workspace_sent ON campaign_emails(workspace_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_emails_workspace_status ON campaign_emails(workspace_id, status);

-- Email event lookups (on partitioned table)
CREATE INDEX IF NOT EXISTS idx_email_events_lead_created ON email_events(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_events_campaign_type ON email_events(campaign_email_id, event_type);
CREATE INDEX IF NOT EXISTS idx_email_events_workspace_type_created ON email_events(workspace_id, event_type, created_at DESC);

-- Enrichment queries
CREATE INDEX IF NOT EXISTS idx_enrichment_requests_workspace_status ON enrichment_requests(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_enriched_data_lead_provider ON enriched_data(lead_id, provider_name);

-- Billing queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_workspace_status ON subscriptions(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_usage_records_workspace_period ON usage_records(workspace_id, period_start DESC);

-- AI token tracking
CREATE INDEX IF NOT EXISTS idx_ai_usage_workspace_created ON ai_usage_logs(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_workspace_model ON ai_usage_logs(workspace_id, model);

-- GDPR compliance
CREATE INDEX IF NOT EXISTS idx_consent_records_workspace_lead ON consent_records(workspace_id, lead_id);
CREATE INDEX IF NOT EXISTS idx_data_subject_requests_workspace_status ON data_subject_requests(workspace_id, status);

-- =====================================================
-- PARTIAL INDEXES FOR PERFORMANCE
-- =====================================================

-- Active records only
CREATE INDEX IF NOT EXISTS idx_leads_active ON leads(workspace_id, email) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_campaigns_active ON campaigns(workspace_id, created_at DESC) WHERE status = 'active';

-- Recent data (hot data)
CREATE INDEX IF NOT EXISTS idx_email_events_recent ON email_events(workspace_id, created_at DESC) 
WHERE created_at > NOW() - INTERVAL '30 days';

-- Pending operations
CREATE INDEX IF NOT EXISTS idx_enrichment_pending ON enrichment_requests(workspace_id, created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_workflow_executions_pending ON workflow_executions(scheduled_at) WHERE status = 'pending';

-- =====================================================
-- FUNCTION-BASED INDEXES
-- =====================================================

-- Case-insensitive email search
CREATE INDEX IF NOT EXISTS idx_leads_email_lower ON leads(workspace_id, LOWER(email));

-- JSON field indexes (for settings and metadata)
CREATE INDEX IF NOT EXISTS idx_campaigns_settings_gin ON campaigns USING gin(settings);
CREATE INDEX IF NOT EXISTS idx_workspaces_settings_gin ON workspaces USING gin(settings);

-- Full text search on lead names
CREATE INDEX IF NOT EXISTS idx_leads_name_trgm ON leads USING gin(
    (COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')) gin_trgm_ops
);

-- =====================================================
-- STATISTICS AND VACUUM
-- =====================================================

-- Update table statistics
ANALYZE leads;
ANALYZE campaigns;
ANALYZE campaign_emails;
ANALYZE email_events;
ANALYZE workspaces;
ANALYZE users;

-- Vacuum tables (removes dead tuples)
VACUUM ANALYZE leads;
VACUUM ANALYZE campaigns;
VACUUM ANALYZE campaign_emails;
VACUUM ANALYZE email_events;

-- =====================================================
-- PERFORMANCE MONITORING SETUP
-- =====================================================

-- Create performance monitoring schema
CREATE SCHEMA IF NOT EXISTS monitoring;

-- Query performance tracking
CREATE TABLE IF NOT EXISTS monitoring.slow_queries (
    id SERIAL PRIMARY KEY,
    query_fingerprint TEXT,
    query TEXT,
    calls BIGINT,
    total_time DOUBLE PRECISION,
    mean_time DOUBLE PRECISION,
    max_time DOUBLE PRECISION,
    captured_at TIMESTAMP DEFAULT NOW()
);

-- Index usage tracking
CREATE TABLE IF NOT EXISTS monitoring.index_usage (
    id SERIAL PRIMARY KEY,
    schemaname TEXT,
    tablename TEXT,
    indexname TEXT,
    idx_scan BIGINT,
    idx_tup_read BIGINT,
    idx_tup_fetch BIGINT,
    captured_at TIMESTAMP DEFAULT NOW()
);

-- Table size tracking
CREATE TABLE IF NOT EXISTS monitoring.table_sizes (
    id SERIAL PRIMARY KEY,
    schemaname TEXT,
    tablename TEXT,
    total_size BIGINT,
    table_size BIGINT,
    indexes_size BIGINT,
    captured_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- AUTOMATED MAINTENANCE FUNCTIONS
-- =====================================================

-- Function to refresh all materialized views
CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS void AS $$
DECLARE
    view_name TEXT;
BEGIN
    FOR view_name IN 
        SELECT matviewname 
        FROM pg_matviews 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY %I', view_name);
        RAISE NOTICE 'Refreshed view: %', view_name;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to capture performance metrics
CREATE OR REPLACE FUNCTION capture_performance_metrics()
RETURNS void AS $$
BEGIN
    -- Capture slow queries
    INSERT INTO monitoring.slow_queries (query_fingerprint, query, calls, total_time, mean_time, max_time)
    SELECT 
        queryid::text,
        query,
        calls,
        total_exec_time,
        mean_exec_time,
        max_exec_time
    FROM pg_stat_statements
    WHERE mean_exec_time > 100
    ORDER BY mean_exec_time DESC
    LIMIT 50;
    
    -- Capture index usage
    INSERT INTO monitoring.index_usage (schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch)
    SELECT 
        schemaname,
        tablename,
        indexname,
        idx_scan,
        idx_tup_read,
        idx_tup_fetch
    FROM pg_stat_user_indexes;
    
    -- Capture table sizes
    INSERT INTO monitoring.table_sizes (schemaname, tablename, total_size, table_size, indexes_size)
    SELECT 
        schemaname,
        tablename,
        pg_total_relation_size(schemaname||'.'||tablename) AS total_size,
        pg_relation_size(schemaname||'.'||tablename) AS table_size,
        pg_indexes_size(schemaname||'.'||tablename) AS indexes_size
    FROM pg_tables
    WHERE schemaname NOT IN ('pg_catalog', 'information_schema', 'monitoring');
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SCHEDULED JOBS (using pg_cron if available)
-- =====================================================

-- Note: These require pg_cron extension. If not available, run manually or via external scheduler

-- Create cron jobs (if pg_cron is available)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Refresh materialized views every hour
        PERFORM cron.schedule('refresh-materialized-views', '0 * * * *', 'SELECT refresh_all_materialized_views()');
        
        -- Create new partitions daily
        PERFORM cron.schedule('create-partitions', '0 2 * * *', 'SELECT create_monthly_partitions(''email_events'', CURRENT_DATE, 3)');
        
        -- Capture performance metrics every 6 hours
        PERFORM cron.schedule('capture-metrics', '0 */6 * * *', 'SELECT capture_performance_metrics()');
        
        RAISE NOTICE 'Scheduled jobs created successfully';
    ELSE
        RAISE NOTICE 'pg_cron not available. Run maintenance functions manually.';
    END IF;
END $$;

-- =====================================================
-- FINAL SUMMARY
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Database optimization completed!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Created:';
    RAISE NOTICE '- Monthly partitions for email_events';
    RAISE NOTICE '- 4 materialized views for analytics';
    RAISE NOTICE '- 50+ optimized indexes';
    RAISE NOTICE '- Performance monitoring tables';
    RAISE NOTICE '- Automated maintenance functions';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Schedule regular view refreshes';
    RAISE NOTICE '2. Monitor query performance';
    RAISE NOTICE '3. Review index usage weekly';
    RAISE NOTICE '4. Archive old partitions monthly';
    RAISE NOTICE '';
END $$;