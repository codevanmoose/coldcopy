-- Campaign Analytics Materialized Views Migration
-- This migration creates high-performance materialized views for campaign analytics
-- with automatic hourly refresh and comprehensive metrics

BEGIN;

-- Create a function to refresh all materialized views
CREATE OR REPLACE FUNCTION refresh_all_analytics_views() RETURNS VOID AS $$
DECLARE
    view_record RECORD;
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    execution_time_ms INTEGER;
BEGIN
    start_time := clock_timestamp();
    
    -- Refresh all analytics materialized views
    FOR view_record IN
        SELECT schemaname, matviewname
        FROM pg_matviews
        WHERE schemaname = 'public'
        AND matviewname LIKE '%_analytics_mv'
    LOOP
        BEGIN
            EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY %I.%I', 
                          view_record.schemaname, view_record.matviewname);
            
            RAISE NOTICE 'Refreshed materialized view: %', view_record.matviewname;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Failed to refresh materialized view %: %', 
                         view_record.matviewname, SQLERRM;
        END;
    END LOOP;
    
    end_time := clock_timestamp();
    execution_time_ms := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
    
    -- Log the refresh operation
    INSERT INTO materialized_view_refresh_log (
        refresh_type, 
        execution_time_ms, 
        refreshed_at
    ) VALUES (
        'all_analytics', 
        execution_time_ms, 
        start_time
    ) ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'All analytics views refreshed in %ms', execution_time_ms;
END;
$$ LANGUAGE plpgsql;

-- Create materialized view refresh log table
CREATE TABLE IF NOT EXISTS materialized_view_refresh_log (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    view_name TEXT,
    refresh_type TEXT NOT NULL, -- 'single', 'all_analytics', 'scheduled'
    execution_time_ms INTEGER,
    rows_affected INTEGER,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    refreshed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mv_refresh_log_refreshed_at_idx 
ON materialized_view_refresh_log (refreshed_at DESC);

-- 1. CAMPAIGN PERFORMANCE OVERVIEW
-- High-level metrics per campaign with real-time insights
CREATE MATERIALIZED VIEW campaign_performance_analytics_mv AS
SELECT 
    c.id as campaign_id,
    c.workspace_id,
    c.name as campaign_name,
    c.status as campaign_status,
    c.created_at as campaign_created_at,
    
    -- Email Volume Metrics
    COUNT(CASE WHEN ee.event_type = 'sent' THEN 1 END) as emails_sent,
    COUNT(CASE WHEN ee.event_type = 'delivery' THEN 1 END) as emails_delivered,
    COUNT(CASE WHEN ee.event_type = 'bounce' THEN 1 END) as emails_bounced,
    COUNT(CASE WHEN ee.event_type = 'complaint' THEN 1 END) as spam_complaints,
    
    -- Engagement Metrics
    COUNT(CASE WHEN ee.event_type = 'open' THEN 1 END) as total_opens,
    COUNT(DISTINCT CASE WHEN ee.event_type = 'open' THEN ee.lead_id END) as unique_opens,
    COUNT(CASE WHEN ee.event_type = 'click' THEN 1 END) as total_clicks,
    COUNT(DISTINCT CASE WHEN ee.event_type = 'click' THEN ee.lead_id END) as unique_clicks,
    
    -- Calculated Rates (as percentages)
    CASE 
        WHEN COUNT(CASE WHEN ee.event_type = 'sent' THEN 1 END) > 0 
        THEN ROUND(
            (COUNT(CASE WHEN ee.event_type = 'delivery' THEN 1 END)::DECIMAL / 
             COUNT(CASE WHEN ee.event_type = 'sent' THEN 1 END)) * 100, 2
        )
        ELSE 0
    END as delivery_rate,
    
    CASE 
        WHEN COUNT(CASE WHEN ee.event_type = 'delivery' THEN 1 END) > 0 
        THEN ROUND(
            (COUNT(DISTINCT CASE WHEN ee.event_type = 'open' THEN ee.lead_id END)::DECIMAL / 
             COUNT(CASE WHEN ee.event_type = 'delivery' THEN 1 END)) * 100, 2
        )
        ELSE 0
    END as open_rate,
    
    CASE 
        WHEN COUNT(DISTINCT CASE WHEN ee.event_type = 'open' THEN ee.lead_id END) > 0 
        THEN ROUND(
            (COUNT(DISTINCT CASE WHEN ee.event_type = 'click' THEN ee.lead_id END)::DECIMAL / 
             COUNT(DISTINCT CASE WHEN ee.event_type = 'open' THEN ee.lead_id END)) * 100, 2
        )
        ELSE 0
    END as click_through_rate,
    
    CASE 
        WHEN COUNT(CASE WHEN ee.event_type = 'sent' THEN 1 END) > 0 
        THEN ROUND(
            (COUNT(CASE WHEN ee.event_type = 'bounce' THEN 1 END)::DECIMAL / 
             COUNT(CASE WHEN ee.event_type = 'sent' THEN 1 END)) * 100, 2
        )
        ELSE 0
    END as bounce_rate,
    
    CASE 
        WHEN COUNT(CASE WHEN ee.event_type = 'sent' THEN 1 END) > 0 
        THEN ROUND(
            (COUNT(CASE WHEN ee.event_type = 'complaint' THEN 1 END)::DECIMAL / 
             COUNT(CASE WHEN ee.event_type = 'sent' THEN 1 END)) * 100, 2
        )
        ELSE 0
    END as complaint_rate,
    
    -- Timing Metrics
    MIN(ee.created_at) as first_email_sent,
    MAX(ee.created_at) as last_activity,
    
    -- Lead Count
    COUNT(DISTINCT ee.lead_id) as total_leads,
    
    -- Performance Score (weighted composite)
    CASE 
        WHEN COUNT(CASE WHEN ee.event_type = 'sent' THEN 1 END) > 0 
        THEN ROUND(
            (-- Open rate weight: 40%
             (COUNT(DISTINCT CASE WHEN ee.event_type = 'open' THEN ee.lead_id END)::DECIMAL / 
              NULLIF(COUNT(CASE WHEN ee.event_type = 'delivery' THEN 1 END), 0)) * 40 +
             -- Click rate weight: 30%
             (COUNT(DISTINCT CASE WHEN ee.event_type = 'click' THEN ee.lead_id END)::DECIMAL / 
              NULLIF(COUNT(DISTINCT CASE WHEN ee.event_type = 'open' THEN ee.lead_id END), 0)) * 30 +
             -- Delivery rate weight: 20%
             (COUNT(CASE WHEN ee.event_type = 'delivery' THEN 1 END)::DECIMAL / 
              NULLIF(COUNT(CASE WHEN ee.event_type = 'sent' THEN 1 END), 0)) * 20 +
             -- Low complaint rate weight: 10% (inverted)
             (1 - COUNT(CASE WHEN ee.event_type = 'complaint' THEN 1 END)::DECIMAL / 
              NULLIF(COUNT(CASE WHEN ee.event_type = 'sent' THEN 1 END), 0)) * 10
            ), 2
        )
        ELSE 0
    END as performance_score,
    
    -- Data freshness
    NOW() as last_updated
    
FROM campaigns c
LEFT JOIN email_events ee ON c.id = ee.campaign_id
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.workspace_id, c.name, c.status, c.created_at;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX campaign_performance_analytics_mv_idx 
ON campaign_performance_analytics_mv (campaign_id);

-- Create additional indexes for common queries
CREATE INDEX campaign_performance_workspace_idx 
ON campaign_performance_analytics_mv (workspace_id, performance_score DESC);

CREATE INDEX campaign_performance_status_idx 
ON campaign_performance_analytics_mv (campaign_status, last_activity DESC);

-- 2. DAILY CAMPAIGN TRENDS
-- Day-by-day performance trends for time-series analysis
CREATE MATERIALIZED VIEW daily_campaign_trends_analytics_mv AS
SELECT 
    c.id as campaign_id,
    c.workspace_id,
    DATE(ee.created_at) as trend_date,
    
    -- Daily Volume
    COUNT(CASE WHEN ee.event_type = 'sent' THEN 1 END) as daily_sent,
    COUNT(CASE WHEN ee.event_type = 'delivery' THEN 1 END) as daily_delivered,
    COUNT(CASE WHEN ee.event_type = 'open' THEN 1 END) as daily_opens,
    COUNT(CASE WHEN ee.event_type = 'click' THEN 1 END) as daily_clicks,
    COUNT(CASE WHEN ee.event_type = 'bounce' THEN 1 END) as daily_bounces,
    
    -- Unique Engagement
    COUNT(DISTINCT CASE WHEN ee.event_type = 'open' THEN ee.lead_id END) as daily_unique_opens,
    COUNT(DISTINCT CASE WHEN ee.event_type = 'click' THEN ee.lead_id END) as daily_unique_clicks,
    
    -- Daily Rates
    CASE 
        WHEN COUNT(CASE WHEN ee.event_type = 'sent' THEN 1 END) > 0 
        THEN ROUND(
            (COUNT(CASE WHEN ee.event_type = 'delivery' THEN 1 END)::DECIMAL / 
             COUNT(CASE WHEN ee.event_type = 'sent' THEN 1 END)) * 100, 2
        )
        ELSE 0
    END as daily_delivery_rate,
    
    CASE 
        WHEN COUNT(CASE WHEN ee.event_type = 'delivery' THEN 1 END) > 0 
        THEN ROUND(
            (COUNT(DISTINCT CASE WHEN ee.event_type = 'open' THEN ee.lead_id END)::DECIMAL / 
             COUNT(CASE WHEN ee.event_type = 'delivery' THEN 1 END)) * 100, 2
        )
        ELSE 0
    END as daily_open_rate,
    
    -- Hour of day analysis (for optimal send times)
    ROUND(AVG(EXTRACT(HOUR FROM ee.created_at)), 1) as avg_send_hour,
    
    -- Weekend vs weekday flag
    CASE 
        WHEN EXTRACT(DOW FROM ee.created_at) IN (0, 6) 
        THEN 'weekend' 
        ELSE 'weekday' 
    END as day_type,
    
    NOW() as last_updated
    
FROM campaigns c
JOIN email_events ee ON c.id = ee.campaign_id
WHERE c.deleted_at IS NULL
  AND ee.created_at >= CURRENT_DATE - INTERVAL '90 days' -- Last 90 days only
GROUP BY c.id, c.workspace_id, DATE(ee.created_at), 
         CASE WHEN EXTRACT(DOW FROM ee.created_at) IN (0, 6) THEN 'weekend' ELSE 'weekday' END;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX daily_campaign_trends_analytics_mv_idx 
ON daily_campaign_trends_analytics_mv (campaign_id, trend_date);

-- Create indexes for time-series queries
CREATE INDEX daily_trends_workspace_date_idx 
ON daily_campaign_trends_analytics_mv (workspace_id, trend_date DESC);

CREATE INDEX daily_trends_performance_idx 
ON daily_campaign_trends_analytics_mv (trend_date DESC, daily_open_rate DESC);

-- 3. WORKSPACE ANALYTICS SUMMARY
-- High-level workspace performance metrics
CREATE MATERIALIZED VIEW workspace_analytics_summary_mv AS
SELECT 
    w.id as workspace_id,
    w.name as workspace_name,
    w.plan as workspace_plan,
    
    -- Campaign Counts
    COUNT(DISTINCT c.id) as total_campaigns,
    COUNT(DISTINCT CASE WHEN c.status = 'active' THEN c.id END) as active_campaigns,
    COUNT(DISTINCT CASE WHEN c.status = 'paused' THEN c.id END) as paused_campaigns,
    COUNT(DISTINCT CASE WHEN c.status = 'completed' THEN c.id END) as completed_campaigns,
    
    -- Overall Email Metrics
    COALESCE(SUM(cpa.emails_sent), 0) as total_emails_sent,
    COALESCE(SUM(cpa.emails_delivered), 0) as total_emails_delivered,
    COALESCE(SUM(cpa.unique_opens), 0) as total_unique_opens,
    COALESCE(SUM(cpa.unique_clicks), 0) as total_unique_clicks,
    COALESCE(SUM(cpa.emails_bounced), 0) as total_bounces,
    COALESCE(SUM(cpa.spam_complaints), 0) as total_complaints,
    
    -- Workspace-wide Rates
    CASE 
        WHEN SUM(cpa.emails_sent) > 0 
        THEN ROUND(
            (SUM(cpa.emails_delivered)::DECIMAL / SUM(cpa.emails_sent)) * 100, 2
        )
        ELSE 0
    END as overall_delivery_rate,
    
    CASE 
        WHEN SUM(cpa.emails_delivered) > 0 
        THEN ROUND(
            (SUM(cpa.unique_opens)::DECIMAL / SUM(cpa.emails_delivered)) * 100, 2
        )
        ELSE 0
    END as overall_open_rate,
    
    CASE 
        WHEN SUM(cpa.unique_opens) > 0 
        THEN ROUND(
            (SUM(cpa.unique_clicks)::DECIMAL / SUM(cpa.unique_opens)) * 100, 2
        )
        ELSE 0
    END as overall_click_through_rate,
    
    -- Performance Metrics
    ROUND(AVG(cpa.performance_score), 2) as avg_campaign_performance,
    MAX(cpa.performance_score) as best_campaign_performance,
    MIN(cpa.performance_score) as worst_campaign_performance,
    
    -- Time Metrics
    MIN(c.created_at) as first_campaign_date,
    MAX(cpa.last_activity) as last_activity_date,
    
    -- Lead Metrics
    COALESCE(SUM(cpa.total_leads), 0) as total_leads_contacted,
    
    -- Growth Metrics (30-day trends)
    (
        SELECT COUNT(DISTINCT c2.id) 
        FROM campaigns c2 
        WHERE c2.workspace_id = w.id 
          AND c2.created_at >= CURRENT_DATE - INTERVAL '30 days'
          AND c2.deleted_at IS NULL
    ) as campaigns_created_last_30_days,
    
    (
        SELECT COALESCE(SUM(
            CASE WHEN ee.event_type = 'sent' 
                 AND ee.created_at >= CURRENT_DATE - INTERVAL '30 days' 
            THEN 1 ELSE 0 END
        ), 0)
        FROM email_events ee
        JOIN campaigns c2 ON ee.campaign_id = c2.id
        WHERE c2.workspace_id = w.id
    ) as emails_sent_last_30_days,
    
    NOW() as last_updated
    
FROM workspaces w
LEFT JOIN campaigns c ON w.id = c.workspace_id AND c.deleted_at IS NULL
LEFT JOIN campaign_performance_analytics_mv cpa ON c.id = cpa.campaign_id
WHERE w.deleted_at IS NULL
GROUP BY w.id, w.name, w.plan;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX workspace_analytics_summary_mv_idx 
ON workspace_analytics_summary_mv (workspace_id);

-- Create indexes for performance queries
CREATE INDEX workspace_analytics_plan_performance_idx 
ON workspace_analytics_summary_mv (workspace_plan, avg_campaign_performance DESC);

CREATE INDEX workspace_analytics_activity_idx 
ON workspace_analytics_summary_mv (last_activity_date DESC, total_emails_sent DESC);

-- 4. LEAD ENGAGEMENT ANALYTICS
-- Lead-level engagement scoring and segmentation
CREATE MATERIALIZED VIEW lead_engagement_analytics_mv AS
SELECT 
    l.id as lead_id,
    l.workspace_id,
    l.email as lead_email,
    l.first_name,
    l.last_name,
    l.company,
    l.status as lead_status,
    
    -- Engagement Counts
    COUNT(CASE WHEN ee.event_type = 'sent' THEN 1 END) as emails_received,
    COUNT(CASE WHEN ee.event_type = 'open' THEN 1 END) as total_opens,
    COUNT(CASE WHEN ee.event_type = 'click' THEN 1 END) as total_clicks,
    COUNT(DISTINCT ee.campaign_id) as campaigns_involved,
    
    -- Engagement Rates
    CASE 
        WHEN COUNT(CASE WHEN ee.event_type = 'sent' THEN 1 END) > 0 
        THEN ROUND(
            (COUNT(CASE WHEN ee.event_type = 'open' THEN 1 END)::DECIMAL / 
             COUNT(CASE WHEN ee.event_type = 'sent' THEN 1 END)) * 100, 2
        )
        ELSE 0
    END as personal_open_rate,
    
    CASE 
        WHEN COUNT(CASE WHEN ee.event_type = 'open' THEN 1 END) > 0 
        THEN ROUND(
            (COUNT(CASE WHEN ee.event_type = 'click' THEN 1 END)::DECIMAL / 
             COUNT(CASE WHEN ee.event_type = 'open' THEN 1 END)) * 100, 2
        )
        ELSE 0
    END as personal_click_rate,
    
    -- Timing Analysis
    MIN(ee.created_at) as first_contact_date,
    MAX(ee.created_at) as last_activity_date,
    
    -- Most active hour of day for this lead
    MODE() WITHIN GROUP (ORDER BY EXTRACT(HOUR FROM ee.created_at)) as preferred_hour,
    
    -- Engagement Score (0-100)
    LEAST(100, GREATEST(0, ROUND(
        -- Base score from open rate (40 points max)
        (CASE 
            WHEN COUNT(CASE WHEN ee.event_type = 'sent' THEN 1 END) > 0 
            THEN (COUNT(CASE WHEN ee.event_type = 'open' THEN 1 END)::DECIMAL / 
                  COUNT(CASE WHEN ee.event_type = 'sent' THEN 1 END)) * 40
            ELSE 0
        END) +
        -- Click engagement bonus (30 points max)
        (CASE 
            WHEN COUNT(CASE WHEN ee.event_type = 'open' THEN 1 END) > 0 
            THEN (COUNT(CASE WHEN ee.event_type = 'click' THEN 1 END)::DECIMAL / 
                  COUNT(CASE WHEN ee.event_type = 'open' THEN 1 END)) * 30
            ELSE 0
        END) +
        -- Frequency bonus (20 points max)
        LEAST(20, COUNT(CASE WHEN ee.event_type = 'open' THEN 1 END) * 2) +
        -- Recency bonus (10 points max)
        (CASE 
            WHEN MAX(ee.created_at) >= CURRENT_DATE - INTERVAL '7 days' THEN 10
            WHEN MAX(ee.created_at) >= CURRENT_DATE - INTERVAL '30 days' THEN 5
            ELSE 0
        END)
    ))) as engagement_score,
    
    -- Engagement Segment
    CASE 
        WHEN COUNT(CASE WHEN ee.event_type = 'open' THEN 1 END) = 0 THEN 'cold'
        WHEN COUNT(CASE WHEN ee.event_type = 'click' THEN 1 END) > 0 
             AND COUNT(CASE WHEN ee.event_type = 'open' THEN 1 END) >= 3 THEN 'hot'
        WHEN COUNT(CASE WHEN ee.event_type = 'open' THEN 1 END) >= 2 THEN 'warm'
        ELSE 'lukewarm'
    END as engagement_segment,
    
    -- Response indicators
    CASE WHEN COUNT(CASE WHEN ee.event_type = 'click' THEN 1 END) > 0 THEN TRUE ELSE FALSE END as has_clicked,
    CASE WHEN COUNT(CASE WHEN ee.event_type = 'bounce' THEN 1 END) > 0 THEN TRUE ELSE FALSE END as has_bounced,
    CASE WHEN COUNT(CASE WHEN ee.event_type = 'complaint' THEN 1 END) > 0 THEN TRUE ELSE FALSE END as has_complained,
    
    NOW() as last_updated
    
FROM leads l
LEFT JOIN email_events ee ON l.id = ee.lead_id
WHERE l.deleted_at IS NULL
  AND (ee.created_at IS NULL OR ee.created_at >= CURRENT_DATE - INTERVAL '180 days') -- Last 6 months
GROUP BY l.id, l.workspace_id, l.email, l.first_name, l.last_name, l.company, l.status;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX lead_engagement_analytics_mv_idx 
ON lead_engagement_analytics_mv (lead_id);

-- Create indexes for segmentation queries
CREATE INDEX lead_engagement_workspace_segment_idx 
ON lead_engagement_analytics_mv (workspace_id, engagement_segment, engagement_score DESC);

CREATE INDEX lead_engagement_score_idx 
ON lead_engagement_analytics_mv (engagement_score DESC, last_activity_date DESC);

-- 5. EMAIL PERFORMANCE BY HOUR
-- Optimal sending time analysis
CREATE MATERIALIZED VIEW hourly_performance_analytics_mv AS
SELECT 
    workspace_id,
    EXTRACT(HOUR FROM ee.created_at) as send_hour,
    EXTRACT(DOW FROM ee.created_at) as day_of_week, -- 0=Sunday, 6=Saturday
    
    -- Volume metrics
    COUNT(CASE WHEN ee.event_type = 'sent' THEN 1 END) as emails_sent,
    COUNT(CASE WHEN ee.event_type = 'delivery' THEN 1 END) as emails_delivered,
    COUNT(CASE WHEN ee.event_type = 'open' THEN 1 END) as total_opens,
    COUNT(CASE WHEN ee.event_type = 'click' THEN 1 END) as total_clicks,
    
    -- Performance rates
    CASE 
        WHEN COUNT(CASE WHEN ee.event_type = 'delivery' THEN 1 END) > 0 
        THEN ROUND(
            (COUNT(CASE WHEN ee.event_type = 'open' THEN 1 END)::DECIMAL / 
             COUNT(CASE WHEN ee.event_type = 'delivery' THEN 1 END)) * 100, 2
        )
        ELSE 0
    END as hourly_open_rate,
    
    CASE 
        WHEN COUNT(CASE WHEN ee.event_type = 'open' THEN 1 END) > 0 
        THEN ROUND(
            (COUNT(CASE WHEN ee.event_type = 'click' THEN 1 END)::DECIMAL / 
             COUNT(CASE WHEN ee.event_type = 'open' THEN 1 END)) * 100, 2
        )
        ELSE 0
    END as hourly_click_rate,
    
    -- Day type classification
    CASE 
        WHEN EXTRACT(DOW FROM ee.created_at) IN (0, 6) THEN 'weekend'
        WHEN EXTRACT(DOW FROM ee.created_at) IN (1, 5) THEN 'week_edge' 
        ELSE 'midweek'
    END as day_type,
    
    -- Time classification
    CASE 
        WHEN EXTRACT(HOUR FROM ee.created_at) BETWEEN 6 AND 11 THEN 'morning'
        WHEN EXTRACT(HOUR FROM ee.created_at) BETWEEN 12 AND 17 THEN 'afternoon'
        WHEN EXTRACT(HOUR FROM ee.created_at) BETWEEN 18 AND 22 THEN 'evening'
        ELSE 'night'
    END as time_period,
    
    NOW() as last_updated
    
FROM email_events ee
JOIN campaigns c ON ee.campaign_id = c.id
WHERE ee.created_at >= CURRENT_DATE - INTERVAL '90 days' -- Last 90 days
  AND c.deleted_at IS NULL
  AND ee.event_type IN ('sent', 'delivery', 'open', 'click')
GROUP BY 
    c.workspace_id,
    EXTRACT(HOUR FROM ee.created_at),
    EXTRACT(DOW FROM ee.created_at),
    CASE WHEN EXTRACT(DOW FROM ee.created_at) IN (0, 6) THEN 'weekend' 
         WHEN EXTRACT(DOW FROM ee.created_at) IN (1, 5) THEN 'week_edge' 
         ELSE 'midweek' END,
    CASE WHEN EXTRACT(HOUR FROM ee.created_at) BETWEEN 6 AND 11 THEN 'morning'
         WHEN EXTRACT(HOUR FROM ee.created_at) BETWEEN 12 AND 17 THEN 'afternoon' 
         WHEN EXTRACT(HOUR FROM ee.created_at) BETWEEN 18 AND 22 THEN 'evening'
         ELSE 'night' END;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX hourly_performance_analytics_mv_idx 
ON hourly_performance_analytics_mv (workspace_id, send_hour, day_of_week);

-- Create indexes for time optimization queries
CREATE INDEX hourly_performance_workspace_rate_idx 
ON hourly_performance_analytics_mv (workspace_id, hourly_open_rate DESC);

CREATE INDEX hourly_performance_time_period_idx 
ON hourly_performance_analytics_mv (time_period, day_type, hourly_open_rate DESC);

-- Create a function to get the optimal send time for a workspace
CREATE OR REPLACE FUNCTION get_optimal_send_times(workspace_uuid UUID, limit_count INTEGER DEFAULT 5)
RETURNS TABLE(
    send_hour INTEGER,
    day_of_week INTEGER,
    day_name TEXT,
    time_period TEXT,
    day_type TEXT,
    open_rate DECIMAL,
    click_rate DECIMAL,
    emails_sent BIGINT,
    performance_score DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        hpa.send_hour,
        hpa.day_of_week,
        CASE hpa.day_of_week
            WHEN 0 THEN 'Sunday'
            WHEN 1 THEN 'Monday'
            WHEN 2 THEN 'Tuesday'
            WHEN 3 THEN 'Wednesday'
            WHEN 4 THEN 'Thursday'
            WHEN 5 THEN 'Friday'
            WHEN 6 THEN 'Saturday'
        END as day_name,
        hpa.time_period,
        hpa.day_type,
        hpa.hourly_open_rate,
        hpa.hourly_click_rate,
        hpa.emails_sent,
        ROUND(
            (hpa.hourly_open_rate * 0.6 + hpa.hourly_click_rate * 0.4), 2
        ) as performance_score
    FROM hourly_performance_analytics_mv hpa
    WHERE hpa.workspace_id = workspace_uuid
      AND hpa.emails_sent >= 50 -- Minimum volume for statistical significance
    ORDER BY 
        (hpa.hourly_open_rate * 0.6 + hpa.hourly_click_rate * 0.4) DESC,
        hpa.emails_sent DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled refresh function for materialized views
CREATE OR REPLACE FUNCTION scheduled_analytics_refresh() RETURNS VOID AS $$
BEGIN
    -- Refresh in dependency order (campaign_performance first, then others)
    REFRESH MATERIALIZED VIEW CONCURRENTLY campaign_performance_analytics_mv;
    REFRESH MATERIALIZED VIEW CONCURRENTLY workspace_analytics_summary_mv;
    REFRESH MATERIALIZED VIEW CONCURRENTLY daily_campaign_trends_analytics_mv;
    REFRESH MATERIALIZED VIEW CONCURRENTLY lead_engagement_analytics_mv;
    REFRESH MATERIALIZED VIEW CONCURRENTLY hourly_performance_analytics_mv;
    
    -- Log the refresh
    INSERT INTO materialized_view_refresh_log (
        refresh_type,
        execution_time_ms,
        refreshed_at
    ) VALUES (
        'scheduled_refresh',
        EXTRACT(EPOCH FROM clock_timestamp() - clock_timestamp()) * 1000,
        NOW()
    );
    
    RAISE NOTICE 'Scheduled analytics refresh completed at %', NOW();
END;
$$ LANGUAGE plpgsql;

-- Create analytics summary view for dashboard
CREATE OR REPLACE VIEW analytics_dashboard_summary AS
SELECT 
    'campaign_performance' as metric_type,
    COUNT(*) as total_records,
    MAX(last_updated) as last_refresh,
    AVG(performance_score) as avg_score
FROM campaign_performance_analytics_mv

UNION ALL

SELECT 
    'workspace_summary' as metric_type,
    COUNT(*) as total_records,
    MAX(last_updated) as last_refresh,
    AVG(avg_campaign_performance) as avg_score
FROM workspace_analytics_summary_mv

UNION ALL

SELECT 
    'lead_engagement' as metric_type,
    COUNT(*) as total_records,
    MAX(last_updated) as last_refresh,
    AVG(engagement_score) as avg_score
FROM lead_engagement_analytics_mv

UNION ALL

SELECT 
    'daily_trends' as metric_type,
    COUNT(*) as total_records,
    MAX(last_updated) as last_refresh,
    AVG(daily_open_rate) as avg_score
FROM daily_campaign_trends_analytics_mv

UNION ALL

SELECT 
    'hourly_performance' as metric_type,
    COUNT(*) as total_records,
    MAX(last_updated) as last_refresh,
    AVG(hourly_open_rate) as avg_score
FROM hourly_performance_analytics_mv;

-- Comment on materialized views explaining their purpose
COMMENT ON MATERIALIZED VIEW campaign_performance_analytics_mv IS 
'High-performance campaign analytics with real-time metrics. Refreshed hourly.';

COMMENT ON MATERIALIZED VIEW workspace_analytics_summary_mv IS 
'Workspace-level performance summary and growth metrics. Refreshed hourly.';

COMMENT ON MATERIALIZED VIEW daily_campaign_trends_analytics_mv IS 
'Daily time-series data for campaign performance trending. Refreshed hourly.';

COMMENT ON MATERIALIZED VIEW lead_engagement_analytics_mv IS 
'Lead-level engagement scoring and segmentation. Refreshed hourly.';

COMMENT ON MATERIALIZED VIEW hourly_performance_analytics_mv IS 
'Optimal send time analysis by hour and day of week. Refreshed hourly.';

COMMIT;