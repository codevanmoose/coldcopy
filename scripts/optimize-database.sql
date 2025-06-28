-- ColdCopy Database Optimization Script
-- This script contains various optimizations for better database performance

-- ====================================
-- 1. ANALYZE ALL TABLES
-- ====================================

-- Update table statistics for query planner
DO $$
DECLARE
    table_name text;
BEGIN
    FOR table_name IN 
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE 'ANALYZE ' || quote_ident(table_name);
        RAISE NOTICE 'Analyzed table: %', table_name;
    END LOOP;
END $$;

-- ====================================
-- 2. VACUUM AND REINDEX
-- ====================================

-- Vacuum all tables to reclaim space and update visibility map
DO $$
DECLARE
    table_name text;
BEGIN
    FOR table_name IN 
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE 'VACUUM (ANALYZE, VERBOSE) ' || quote_ident(table_name);
        RAISE NOTICE 'Vacuumed table: %', table_name;
    END LOOP;
END $$;

-- Reindex tables with high dead tuple ratio
DO $$
DECLARE
    table_rec record;
BEGIN
    FOR table_rec IN 
        SELECT 
            schemaname, 
            tablename,
            n_dead_tup,
            n_live_tup,
            CASE 
                WHEN n_live_tup = 0 THEN 0
                ELSE (n_dead_tup::float / n_live_tup::float) * 100
            END as dead_ratio
        FROM pg_stat_user_tables 
        WHERE schemaname = 'public'
        AND n_live_tup > 1000  -- Only tables with significant data
        AND (n_dead_tup::float / GREATEST(n_live_tup::float, 1)) > 0.1  -- More than 10% dead tuples
    LOOP
        EXECUTE 'REINDEX TABLE ' || quote_ident(table_rec.tablename);
        RAISE NOTICE 'Reindexed table: % (dead ratio: %)', table_rec.tablename, table_rec.dead_ratio;
    END LOOP;
END $$;

-- ====================================
-- 3. PERFORMANCE INDEXES
-- ====================================

-- Create indexes for common query patterns
-- Only create if they don't already exist

-- Leads table optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_workspace_email 
ON leads(workspace_id, email) WHERE email IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_workspace_company 
ON leads(workspace_id, company) WHERE company IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_workspace_status 
ON leads(workspace_id, status, updated_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_created_at_desc 
ON leads(created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_enrichment_status 
ON leads(workspace_id, enrichment_status) WHERE enrichment_status IS NOT NULL;

-- Campaigns table optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_workspace_status 
ON campaigns(workspace_id, status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_workspace_type 
ON campaigns(workspace_id, type) WHERE type IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_scheduled_at 
ON campaigns(scheduled_at) WHERE scheduled_at IS NOT NULL AND status = 'scheduled';

-- Campaign emails table optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaign_emails_campaign_status 
ON campaign_emails(campaign_id, status, scheduled_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaign_emails_lead_id 
ON campaign_emails(lead_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaign_emails_workspace_sent 
ON campaign_emails(workspace_id, sent_at DESC) WHERE sent_at IS NOT NULL;

-- Email events table optimizations (partitioned table)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_events_email_id_type 
ON email_events(email_id, event_type, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_events_workspace_created 
ON email_events(workspace_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_events_type_created 
ON email_events(event_type, created_at DESC);

-- Users and workspace optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_workspace_role 
ON users(workspace_id, role) WHERE workspace_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workspace_members_workspace_user 
ON workspace_members(workspace_id, user_id, role);

-- API keys optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_keys_workspace_active 
ON api_keys(workspace_id, is_active, expires_at) WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_key_usage_created_at 
ON api_key_usage(created_at DESC) WHERE created_at > NOW() - INTERVAL '30 days';

-- Billing and subscriptions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscriptions_workspace_status 
ON subscriptions(workspace_id, status, trial_end);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usage_records_workspace_period 
ON usage_records(workspace_id, billing_period, created_at DESC);

-- Uploads and file storage
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_uploads_workspace_type 
ON uploads(workspace_id, type, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_uploads_user_type 
ON uploads(user_id, type, created_at DESC);

-- ====================================
-- 4. PARTIAL INDEXES FOR FILTERED QUERIES
-- ====================================

-- Active campaigns only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_active 
ON campaigns(workspace_id, status, created_at DESC) 
WHERE status IN ('active', 'scheduled', 'sending');

-- Unread email messages
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_messages_unread 
ON email_messages(workspace_id, created_at DESC) 
WHERE is_read = false;

-- Failed email events for retry
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_events_failed 
ON email_events(workspace_id, created_at DESC) 
WHERE event_type = 'failed';

-- Recent audit logs (last 30 days)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_recent 
ON audit_logs(workspace_id, created_at DESC) 
WHERE created_at > NOW() - INTERVAL '30 days';

-- ====================================
-- 5. COMPOSITE INDEXES FOR COMPLEX QUERIES
-- ====================================

-- Lead enrichment queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_enrichment_composite 
ON leads(workspace_id, enrichment_status, updated_at DESC) 
WHERE enrichment_status IN ('pending', 'failed');

-- Campaign performance queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaign_emails_performance 
ON campaign_emails(campaign_id, status, sent_at, lead_id) 
WHERE sent_at IS NOT NULL;

-- Email analytics queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_events_analytics 
ON email_events(workspace_id, event_type, created_at, email_id) 
WHERE created_at > NOW() - INTERVAL '90 days';

-- User activity tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user_activity 
ON audit_logs(user_id, action, created_at DESC) 
WHERE created_at > NOW() - INTERVAL '7 days';

-- ====================================
-- 6. EXPRESSION INDEXES
-- ====================================

-- Case-insensitive email searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_email_lower 
ON leads(workspace_id, lower(email)) WHERE email IS NOT NULL;

-- Domain extraction for email analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_email_domain 
ON leads(workspace_id, split_part(email, '@', 2)) WHERE email IS NOT NULL;

-- Company name search (case-insensitive)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_company_lower 
ON leads(workspace_id, lower(company)) WHERE company IS NOT NULL;

-- ====================================
-- 7. JSONB INDEXES FOR METADATA
-- ====================================

-- Lead enrichment data
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_enrichment_data_gin 
ON leads USING GIN (enrichment_data) WHERE enrichment_data IS NOT NULL;

-- Campaign settings
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_settings_gin 
ON campaigns USING GIN (settings) WHERE settings IS NOT NULL;

-- Email event metadata
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_events_metadata_gin 
ON email_events USING GIN (metadata) WHERE metadata IS NOT NULL;

-- User preferences
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_preferences_gin 
ON users USING GIN (preferences) WHERE preferences IS NOT NULL;

-- ====================================
-- 8. BTREE INDEXES FOR SORTING
-- ====================================

-- Common sorting patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_workspace_name_sort 
ON leads(workspace_id, lower(first_name), lower(last_name));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_workspace_name_sort 
ON campaigns(workspace_id, lower(name));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_events_workspace_time_sort 
ON email_events(workspace_id, created_at DESC, event_type);

-- ====================================
-- 9. UPDATE STATISTICS
-- ====================================

-- Update statistics targets for frequently queried columns
ALTER TABLE leads ALTER COLUMN email SET STATISTICS 1000;
ALTER TABLE leads ALTER COLUMN company SET STATISTICS 1000;
ALTER TABLE leads ALTER COLUMN workspace_id SET STATISTICS 1000;

ALTER TABLE campaigns ALTER COLUMN workspace_id SET STATISTICS 1000;
ALTER TABLE campaigns ALTER COLUMN status SET STATISTICS 500;

ALTER TABLE email_events ALTER COLUMN event_type SET STATISTICS 500;
ALTER TABLE email_events ALTER COLUMN workspace_id SET STATISTICS 1000;

ALTER TABLE campaign_emails ALTER COLUMN status SET STATISTICS 500;
ALTER TABLE campaign_emails ALTER COLUMN workspace_id SET STATISTICS 1000;

-- ====================================
-- 10. MAINTENANCE FUNCTIONS
-- ====================================

-- Function to get index usage statistics
CREATE OR REPLACE FUNCTION get_index_usage_stats()
RETURNS TABLE(
    schemaname TEXT,
    tablename TEXT,
    indexname TEXT,
    idx_scan BIGINT,
    idx_tup_read BIGINT,
    idx_tup_fetch BIGINT,
    index_size TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.schemaname::TEXT,
        i.tablename::TEXT,
        i.indexname::TEXT,
        s.idx_scan,
        s.idx_tup_read,
        s.idx_tup_fetch,
        pg_size_pretty(pg_relation_size(i.schemaname||'.'||i.indexname)) as index_size
    FROM pg_stat_user_indexes s
    JOIN pg_indexes i ON s.indexrelname = i.indexname
    WHERE i.schemaname = 'public'
    ORDER BY s.idx_scan DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to identify unused indexes
CREATE OR REPLACE FUNCTION find_unused_indexes()
RETURNS TABLE(
    schemaname TEXT,
    tablename TEXT,
    indexname TEXT,
    index_size TEXT,
    table_size TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.schemaname::TEXT,
        i.tablename::TEXT,
        i.indexname::TEXT,
        pg_size_pretty(pg_relation_size(i.schemaname||'.'||i.indexname)) as index_size,
        pg_size_pretty(pg_relation_size(i.schemaname||'.'||i.tablename)) as table_size
    FROM pg_stat_user_indexes s
    JOIN pg_indexes i ON s.indexrelname = i.indexname
    WHERE i.schemaname = 'public'
    AND s.idx_scan = 0
    AND i.indexname NOT LIKE '%_pkey'  -- Exclude primary keys
    ORDER BY pg_relation_size(i.schemaname||'.'||i.indexname) DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to analyze table bloat
CREATE OR REPLACE FUNCTION analyze_table_bloat()
RETURNS TABLE(
    table_name TEXT,
    bloat_ratio NUMERIC,
    bloat_size TEXT,
    live_tuples BIGINT,
    dead_tuples BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        schemaname||'.'||tablename as table_name,
        CASE 
            WHEN n_live_tup = 0 THEN 0
            ELSE ROUND((n_dead_tup::NUMERIC / n_live_tup::NUMERIC) * 100, 2)
        END as bloat_ratio,
        pg_size_pretty(n_dead_tup * (pg_relation_size(schemaname||'.'||tablename)::NUMERIC / GREATEST(n_live_tup + n_dead_tup, 1))) as bloat_size,
        n_live_tup as live_tuples,
        n_dead_tup as dead_tuples
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    AND n_live_tup > 0
    ORDER BY (n_dead_tup::NUMERIC / n_live_tup::NUMERIC) DESC;
END;
$$ LANGUAGE plpgsql;

-- ====================================
-- 11. FINAL CLEANUP AND ANALYSIS
-- ====================================

-- Final ANALYZE to update all statistics
ANALYZE;

-- Reset query statistics for fresh monitoring
SELECT pg_stat_statements_reset();

-- Report completion
DO $$
BEGIN
    RAISE NOTICE 'Database optimization completed successfully!';
    RAISE NOTICE 'New indexes created and statistics updated.';
    RAISE NOTICE 'Monitor query performance and adjust as needed.';
END $$;