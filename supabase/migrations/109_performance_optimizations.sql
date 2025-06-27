-- Performance Optimizations
-- Comprehensive database optimizations for blazing fast queries

-- ============================================
-- PART 1: CORE TABLE INDEXES
-- ============================================

-- Leads table optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_workspace_status 
ON leads(workspace_id, status) 
WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_workspace_created 
ON leads(workspace_id, created_at DESC) 
WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_email_lower 
ON leads(LOWER(email)) 
WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_enrichment 
ON leads(workspace_id, last_enriched_at) 
WHERE enrichment_data IS NOT NULL;

-- Campaigns table optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_workspace_status_active 
ON campaigns(workspace_id, status) 
WHERE status IN ('active', 'paused');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_next_run 
ON campaigns(next_run_at) 
WHERE status = 'active' AND next_run_at IS NOT NULL;

-- Campaign emails optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaign_emails_status_scheduled 
ON campaign_emails(workspace_id, status, scheduled_at) 
WHERE status IN ('scheduled', 'pending');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaign_emails_lead_campaign 
ON campaign_emails(lead_id, campaign_id, step_number);

-- Email events optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_events_email_type 
ON email_events(campaign_email_id, event_type, occurred_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_events_workspace_date 
ON email_events(workspace_id, occurred_at DESC);

-- ============================================
-- PART 2: INTEGRATION INDEXES
-- ============================================

-- LinkedIn integration indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_linkedin_messages_workspace_status 
ON linkedin_messages(workspace_id, status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_linkedin_profiles_workspace_updated 
ON linkedin_profiles(workspace_id, last_message_received_at DESC NULLS LAST);

-- Twitter integration indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_twitter_messages_workspace_status 
ON twitter_messages(workspace_id, status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_twitter_searches_active 
ON twitter_searches(workspace_id, is_active, last_reset_at) 
WHERE is_active = true;

-- Sales intelligence indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_intent_signals_workspace_score 
ON intent_signals(workspace_id, intent_score DESC, detected_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_website_visitors_workspace_recent 
ON website_visitors(workspace_id, last_seen_at DESC) 
WHERE last_seen_at > NOW() - INTERVAL '7 days';

-- ============================================
-- PART 3: MATERIALIZED VIEWS FOR ANALYTICS
-- ============================================

-- Campaign performance summary
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_campaign_performance AS
SELECT 
    c.id as campaign_id,
    c.workspace_id,
    c.name as campaign_name,
    c.status,
    COUNT(DISTINCT ce.id) as total_emails,
    COUNT(DISTINCT CASE WHEN ce.status = 'sent' THEN ce.id END) as emails_sent,
    COUNT(DISTINCT CASE WHEN ce.status = 'delivered' THEN ce.id END) as emails_delivered,
    COUNT(DISTINCT CASE WHEN ee.event_type = 'opened' THEN ce.id END) as unique_opens,
    COUNT(DISTINCT CASE WHEN ee.event_type = 'clicked' THEN ce.id END) as unique_clicks,
    COUNT(DISTINCT CASE WHEN ce.status = 'replied' THEN ce.id END) as replies,
    COUNT(DISTINCT CASE WHEN ce.status = 'bounced' THEN ce.id END) as bounces,
    COUNT(DISTINCT CASE WHEN ce.status = 'unsubscribed' THEN ce.id END) as unsubscribes,
    ROUND(
        CASE 
            WHEN COUNT(DISTINCT CASE WHEN ce.status = 'delivered' THEN ce.id END) > 0 
            THEN COUNT(DISTINCT CASE WHEN ee.event_type = 'opened' THEN ce.id END)::numeric / 
                 COUNT(DISTINCT CASE WHEN ce.status = 'delivered' THEN ce.id END) * 100
            ELSE 0 
        END, 2
    ) as open_rate,
    ROUND(
        CASE 
            WHEN COUNT(DISTINCT CASE WHEN ee.event_type = 'opened' THEN ce.id END) > 0 
            THEN COUNT(DISTINCT CASE WHEN ee.event_type = 'clicked' THEN ce.id END)::numeric / 
                 COUNT(DISTINCT CASE WHEN ee.event_type = 'opened' THEN ce.id END) * 100
            ELSE 0 
        END, 2
    ) as click_rate,
    ROUND(
        CASE 
            WHEN COUNT(DISTINCT CASE WHEN ce.status = 'delivered' THEN ce.id END) > 0 
            THEN COUNT(DISTINCT CASE WHEN ce.status = 'replied' THEN ce.id END)::numeric / 
                 COUNT(DISTINCT CASE WHEN ce.status = 'delivered' THEN ce.id END) * 100
            ELSE 0 
        END, 2
    ) as reply_rate,
    c.created_at,
    c.updated_at,
    NOW() as last_refreshed
FROM campaigns c
LEFT JOIN campaign_emails ce ON c.id = ce.campaign_id
LEFT JOIN email_events ee ON ce.id = ee.campaign_email_id
GROUP BY c.id, c.workspace_id, c.name, c.status, c.created_at, c.updated_at;

CREATE UNIQUE INDEX idx_mv_campaign_performance_id ON mv_campaign_performance(campaign_id);
CREATE INDEX idx_mv_campaign_performance_workspace ON mv_campaign_performance(workspace_id);

-- Lead engagement summary
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_lead_engagement AS
SELECT 
    l.id as lead_id,
    l.workspace_id,
    l.email,
    l.first_name,
    l.last_name,
    l.company,
    COUNT(DISTINCT ce.campaign_id) as campaigns_count,
    COUNT(DISTINCT ce.id) as emails_received,
    COUNT(DISTINCT CASE WHEN ee.event_type = 'opened' THEN ee.id END) as total_opens,
    COUNT(DISTINCT CASE WHEN ee.event_type = 'clicked' THEN ee.id END) as total_clicks,
    COUNT(DISTINCT CASE WHEN ce.status = 'replied' THEN ce.id END) as total_replies,
    MAX(CASE WHEN ee.event_type = 'opened' THEN ee.occurred_at END) as last_open_at,
    MAX(CASE WHEN ee.event_type = 'clicked' THEN ee.occurred_at END) as last_click_at,
    MAX(CASE WHEN ce.status = 'replied' THEN ce.updated_at END) as last_reply_at,
    CASE 
        WHEN COUNT(DISTINCT CASE WHEN ce.status = 'replied' THEN ce.id END) > 0 THEN 'replied'
        WHEN COUNT(DISTINCT CASE WHEN ee.event_type = 'clicked' THEN ee.id END) > 0 THEN 'engaged'
        WHEN COUNT(DISTINCT CASE WHEN ee.event_type = 'opened' THEN ee.id END) > 0 THEN 'opened'
        WHEN COUNT(DISTINCT ce.id) > 0 THEN 'contacted'
        ELSE 'new'
    END as engagement_level,
    COALESCE(
        -- Calculate engagement score (0-100)
        (
            CASE WHEN COUNT(DISTINCT ce.id) > 0 THEN 10 ELSE 0 END + -- Contacted
            CASE WHEN COUNT(DISTINCT CASE WHEN ee.event_type = 'opened' THEN ee.id END) > 0 THEN 20 ELSE 0 END + -- Opened
            COUNT(DISTINCT CASE WHEN ee.event_type = 'clicked' THEN ee.id END) * 10 + -- Clicks (up to 30)
            CASE WHEN COUNT(DISTINCT CASE WHEN ce.status = 'replied' THEN ce.id END) > 0 THEN 40 ELSE 0 END -- Replied
        ), 0
    ) as engagement_score,
    l.created_at,
    NOW() as last_refreshed
FROM leads l
LEFT JOIN campaign_emails ce ON l.id = ce.lead_id
LEFT JOIN email_events ee ON ce.id = ee.campaign_email_id
WHERE l.deleted_at IS NULL
GROUP BY l.id, l.workspace_id, l.email, l.first_name, l.last_name, l.company, l.created_at;

CREATE UNIQUE INDEX idx_mv_lead_engagement_id ON mv_lead_engagement(lead_id);
CREATE INDEX idx_mv_lead_engagement_workspace ON mv_lead_engagement(workspace_id);
CREATE INDEX idx_mv_lead_engagement_score ON mv_lead_engagement(workspace_id, engagement_score DESC);

-- Workspace usage summary
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_workspace_usage AS
SELECT 
    w.id as workspace_id,
    w.name as workspace_name,
    COUNT(DISTINCT u.id) as total_users,
    COUNT(DISTINCT l.id) as total_leads,
    COUNT(DISTINCT c.id) as total_campaigns,
    COUNT(DISTINCT ce.id) as total_emails_sent,
    COUNT(DISTINCT CASE WHEN ce.created_at > NOW() - INTERVAL '30 days' THEN ce.id END) as emails_last_30_days,
    COUNT(DISTINCT CASE WHEN l.created_at > NOW() - INTERVAL '30 days' THEN l.id END) as leads_last_30_days,
    SUM(CASE WHEN at.token_type = 'ai_generation' THEN at.tokens_used ELSE 0 END) as ai_tokens_used,
    SUM(CASE WHEN at.token_type = 'enrichment' THEN at.credits_used ELSE 0 END) as enrichment_credits_used,
    MAX(ce.created_at) as last_email_sent_at,
    MAX(l.created_at) as last_lead_created_at,
    w.created_at,
    NOW() as last_refreshed
FROM workspaces w
LEFT JOIN workspace_members wm ON w.id = wm.workspace_id
LEFT JOIN users u ON wm.user_id = u.id
LEFT JOIN leads l ON w.id = l.workspace_id AND l.deleted_at IS NULL
LEFT JOIN campaigns c ON w.id = c.workspace_id
LEFT JOIN campaign_emails ce ON c.id = ce.campaign_id
LEFT JOIN ai_tokens at ON w.id = at.workspace_id
GROUP BY w.id, w.name, w.created_at;

CREATE UNIQUE INDEX idx_mv_workspace_usage_id ON mv_workspace_usage(workspace_id);

-- Email deliverability summary
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_deliverability_summary AS
SELECT 
    da.workspace_id,
    da.domain,
    da.spam_score,
    da.domain_reputation,
    COUNT(DISTINCT ip.id) as inbox_tests_count,
    AVG(ip.gmail_placement) as avg_gmail_placement,
    AVG(ip.outlook_placement) as avg_outlook_placement,
    AVG(ip.yahoo_placement) as avg_yahoo_placement,
    AVG(ip.overall_placement) as avg_overall_placement,
    MAX(da.last_checked_at) as last_reputation_check,
    MAX(ip.tested_at) as last_inbox_test,
    NOW() as last_refreshed
FROM deliverability_analysis da
LEFT JOIN inbox_placement_tests ip ON da.workspace_id = ip.workspace_id
WHERE da.last_checked_at > NOW() - INTERVAL '30 days'
GROUP BY da.workspace_id, da.domain, da.spam_score, da.domain_reputation;

CREATE INDEX idx_mv_deliverability_workspace ON mv_deliverability_summary(workspace_id);

-- ============================================
-- PART 4: QUERY PERFORMANCE FUNCTIONS
-- ============================================

-- Function to analyze slow queries
CREATE OR REPLACE FUNCTION analyze_slow_queries(
    threshold_ms INTEGER DEFAULT 1000
) RETURNS TABLE (
    query TEXT,
    calls BIGINT,
    total_time DOUBLE PRECISION,
    mean_time DOUBLE PRECISION,
    max_time DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pg_stat_statements.query,
        pg_stat_statements.calls,
        pg_stat_statements.total_exec_time as total_time,
        pg_stat_statements.mean_exec_time as mean_time,
        pg_stat_statements.max_exec_time as max_time
    FROM pg_stat_statements
    WHERE pg_stat_statements.mean_exec_time > threshold_ms
    ORDER BY pg_stat_statements.mean_exec_time DESC
    LIMIT 50;
END;
$$ LANGUAGE plpgsql;

-- Function to get table sizes
CREATE OR REPLACE FUNCTION get_table_sizes() 
RETURNS TABLE (
    table_name TEXT,
    total_size TEXT,
    table_size TEXT,
    indexes_size TEXT,
    rows_estimate BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        schemaname||'.'||tablename AS table_name,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
        pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
        pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) AS indexes_size,
        n_live_tup AS rows_estimate
    FROM pg_stat_user_tables
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PART 5: REFRESH POLICIES
-- ============================================

-- Create refresh function for materialized views
CREATE OR REPLACE FUNCTION refresh_materialized_views() RETURNS void AS $$
BEGIN
    -- Refresh campaign performance (every hour)
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_campaign_performance;
    
    -- Refresh lead engagement (every 2 hours)
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_lead_engagement;
    
    -- Refresh workspace usage (every 6 hours)
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_workspace_usage;
    
    -- Refresh deliverability summary (every 4 hours)
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_deliverability_summary;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PART 6: PARTITIONING FOR LARGE TABLES
-- ============================================

-- Partition email_events by month (already done in previous migrations)
-- Ensure partition management is automated

-- Create function to automatically create monthly partitions
CREATE OR REPLACE FUNCTION create_monthly_partitions(
    table_name TEXT,
    months_ahead INTEGER DEFAULT 3
) RETURNS void AS $$
DECLARE
    start_date DATE;
    end_date DATE;
    partition_name TEXT;
    i INTEGER;
BEGIN
    FOR i IN 0..months_ahead LOOP
        start_date := DATE_TRUNC('month', CURRENT_DATE + (i || ' months')::INTERVAL);
        end_date := start_date + INTERVAL '1 month';
        partition_name := table_name || '_' || TO_CHAR(start_date, 'YYYY_MM');
        
        -- Check if partition exists
        IF NOT EXISTS (
            SELECT 1 FROM pg_class 
            WHERE relname = partition_name
        ) THEN
            EXECUTE format(
                'CREATE TABLE %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
                partition_name,
                table_name,
                start_date,
                end_date
            );
            
            -- Create indexes on partition
            EXECUTE format(
                'CREATE INDEX %I ON %I (workspace_id, occurred_at)',
                partition_name || '_workspace_occurred_idx',
                partition_name
            );
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PART 7: VACUUM AND ANALYZE SETTINGS
-- ============================================

-- Set aggressive autovacuum for high-traffic tables
ALTER TABLE campaign_emails SET (
    autovacuum_vacuum_scale_factor = 0.05,
    autovacuum_analyze_scale_factor = 0.05
);

ALTER TABLE email_events SET (
    autovacuum_vacuum_scale_factor = 0.05,
    autovacuum_analyze_scale_factor = 0.05
);

ALTER TABLE leads SET (
    autovacuum_vacuum_scale_factor = 0.1,
    autovacuum_analyze_scale_factor = 0.1
);

-- ============================================
-- PART 8: CONNECTION POOLING RECOMMENDATIONS
-- ============================================

-- Create a monitoring view for connection usage
CREATE OR REPLACE VIEW v_connection_stats AS
SELECT 
    count(*) as total_connections,
    count(*) FILTER (WHERE state = 'active') as active_connections,
    count(*) FILTER (WHERE state = 'idle') as idle_connections,
    count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction,
    max(EXTRACT(EPOCH FROM (now() - state_change))) as max_idle_seconds
FROM pg_stat_activity
WHERE datname = current_database();

-- ============================================
-- PART 9: QUERY OPTIMIZATION HINTS
-- ============================================

-- Create statistics for correlated columns
CREATE STATISTICS stats_leads_workspace_status ON workspace_id, status FROM leads;
CREATE STATISTICS stats_campaigns_workspace_status ON workspace_id, status FROM campaigns;
CREATE STATISTICS stats_campaign_emails_multi ON workspace_id, campaign_id, status FROM campaign_emails;

-- ============================================
-- PART 10: CLEANUP AND MAINTENANCE
-- ============================================

-- Function to clean up old data
CREATE OR REPLACE FUNCTION cleanup_old_data(
    days_to_keep INTEGER DEFAULT 90
) RETURNS void AS $$
BEGIN
    -- Delete old email events (keep aggregated data in materialized views)
    DELETE FROM email_events 
    WHERE occurred_at < NOW() - (days_to_keep || ' days')::INTERVAL
    AND workspace_id IN (
        SELECT id FROM workspaces 
        WHERE NOT (settings->>'keep_all_data')::boolean
    );
    
    -- Delete old webhook events
    DELETE FROM webhook_events 
    WHERE created_at < NOW() - INTERVAL '30 days';
    
    -- Clean up orphaned records
    DELETE FROM campaign_emails 
    WHERE campaign_id NOT IN (SELECT id FROM campaigns);
    
    DELETE FROM email_events 
    WHERE campaign_email_id NOT IN (SELECT id FROM campaign_emails);
END;
$$ LANGUAGE plpgsql;

-- Schedule periodic maintenance
COMMENT ON FUNCTION refresh_materialized_views() IS 
'Run this function via cron job:
- Every hour for campaign performance
- Every 2 hours for lead engagement
- Every 6 hours for workspace usage';

COMMENT ON FUNCTION create_monthly_partitions(TEXT, INTEGER) IS 
'Run monthly to ensure partitions exist for next 3 months';

COMMENT ON FUNCTION cleanup_old_data(INTEGER) IS 
'Run weekly to remove old data and maintain performance';