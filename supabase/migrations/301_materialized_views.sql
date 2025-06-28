-- Advanced Materialized Views for ColdCopy Analytics
-- High-performance pre-aggregated data for instant dashboard loading

-- 1. Campaign Performance Analytics
DROP MATERIALIZED VIEW IF EXISTS mv_campaign_analytics CASCADE;

CREATE MATERIALIZED VIEW mv_campaign_analytics AS
WITH campaign_stats AS (
    SELECT 
        c.id as campaign_id,
        c.workspace_id,
        c.name as campaign_name,
        c.status,
        c.created_at as campaign_created_at,
        c.started_at,
        c.completed_at,
        
        -- Email counts
        COUNT(ce.id) as total_emails,
        COUNT(CASE WHEN ce.status = 'sent' THEN 1 END) as emails_sent,
        COUNT(CASE WHEN ce.status = 'scheduled' THEN 1 END) as emails_scheduled,
        COUNT(CASE WHEN ce.status = 'failed' THEN 1 END) as emails_failed,
        
        -- Unique leads
        COUNT(DISTINCT ce.lead_id) as unique_leads_contacted,
        
        -- Campaign duration
        EXTRACT(EPOCH FROM (COALESCE(c.completed_at, NOW()) - c.started_at))/3600 as duration_hours
        
    FROM campaigns c
    LEFT JOIN campaign_emails ce ON c.id = ce.campaign_id
    GROUP BY c.id, c.workspace_id, c.name, c.status, c.created_at, c.started_at, c.completed_at
),
event_stats AS (
    SELECT 
        ce.campaign_id,
        
        -- Email events
        COUNT(CASE WHEN ee.event_type = 'sent' THEN 1 END) as sent_count,
        COUNT(CASE WHEN ee.event_type = 'delivered' THEN 1 END) as delivered_count,
        COUNT(CASE WHEN ee.event_type = 'opened' THEN 1 END) as opened_count,
        COUNT(CASE WHEN ee.event_type = 'clicked' THEN 1 END) as clicked_count,
        COUNT(CASE WHEN ee.event_type = 'bounced' THEN 1 END) as bounced_count,
        COUNT(CASE WHEN ee.event_type = 'complained' THEN 1 END) as complained_count,
        COUNT(CASE WHEN ee.event_type = 'unsubscribed' THEN 1 END) as unsubscribed_count,
        COUNT(CASE WHEN ee.event_type = 'replied' THEN 1 END) as replied_count,
        
        -- Unique counts
        COUNT(DISTINCT CASE WHEN ee.event_type = 'opened' THEN ee.email_address END) as unique_opens,
        COUNT(DISTINCT CASE WHEN ee.event_type = 'clicked' THEN ee.email_address END) as unique_clicks,
        COUNT(DISTINCT CASE WHEN ee.event_type = 'replied' THEN ee.email_address END) as unique_replies,
        
        -- Time to first engagement
        MIN(CASE WHEN ee.event_type = 'opened' THEN ee.timestamp END) as first_open_at,
        MIN(CASE WHEN ee.event_type = 'clicked' THEN ee.timestamp END) as first_click_at,
        MIN(CASE WHEN ee.event_type = 'replied' THEN ee.timestamp END) as first_reply_at
        
    FROM campaign_emails ce
    LEFT JOIN email_events ee ON ce.id = ee.campaign_email_id
    GROUP BY ce.campaign_id
)
SELECT 
    cs.*,
    
    -- Event counts
    COALESCE(es.sent_count, 0) as sent_count,
    COALESCE(es.delivered_count, 0) as delivered_count,
    COALESCE(es.opened_count, 0) as opened_count,
    COALESCE(es.clicked_count, 0) as clicked_count,
    COALESCE(es.bounced_count, 0) as bounced_count,
    COALESCE(es.complained_count, 0) as complained_count,
    COALESCE(es.unsubscribed_count, 0) as unsubscribed_count,
    COALESCE(es.replied_count, 0) as replied_count,
    
    -- Unique engagement counts
    COALESCE(es.unique_opens, 0) as unique_opens,
    COALESCE(es.unique_clicks, 0) as unique_clicks,
    COALESCE(es.unique_replies, 0) as unique_replies,
    
    -- Calculated rates (as percentages)
    CASE 
        WHEN cs.emails_sent > 0 THEN 
            ROUND((COALESCE(es.delivered_count, 0)::numeric / cs.emails_sent::numeric) * 100, 2)
        ELSE 0 
    END as delivery_rate,
    
    CASE 
        WHEN COALESCE(es.delivered_count, 0) > 0 THEN 
            ROUND((COALESCE(es.unique_opens, 0)::numeric / es.delivered_count::numeric) * 100, 2)
        ELSE 0 
    END as open_rate,
    
    CASE 
        WHEN COALESCE(es.delivered_count, 0) > 0 THEN 
            ROUND((COALESCE(es.unique_clicks, 0)::numeric / es.delivered_count::numeric) * 100, 2)
        ELSE 0 
    END as click_rate,
    
    CASE 
        WHEN COALESCE(es.delivered_count, 0) > 0 THEN 
            ROUND((COALESCE(es.unique_replies, 0)::numeric / es.delivered_count::numeric) * 100, 2)
        ELSE 0 
    END as reply_rate,
    
    CASE 
        WHEN cs.emails_sent > 0 THEN 
            ROUND((COALESCE(es.bounced_count, 0)::numeric / cs.emails_sent::numeric) * 100, 2)
        ELSE 0 
    END as bounce_rate,
    
    -- Time to engagement
    es.first_open_at,
    es.first_click_at,
    es.first_reply_at,
    
    -- ROI and performance metrics
    CASE 
        WHEN cs.unique_leads_contacted > 0 THEN 
            ROUND(COALESCE(es.unique_replies, 0)::numeric / cs.unique_leads_contacted::numeric * 100, 2)
        ELSE 0 
    END as lead_conversion_rate,
    
    -- Refresh timestamp
    NOW() as refreshed_at
    
FROM campaign_stats cs
LEFT JOIN event_stats es ON cs.campaign_id = es.campaign_id;

-- Create indexes on materialized view
CREATE UNIQUE INDEX idx_mv_campaign_analytics_campaign_id ON mv_campaign_analytics (campaign_id);
CREATE INDEX idx_mv_campaign_analytics_workspace_id ON mv_campaign_analytics (workspace_id);
CREATE INDEX idx_mv_campaign_analytics_status ON mv_campaign_analytics (workspace_id, status);
CREATE INDEX idx_mv_campaign_analytics_performance ON mv_campaign_analytics (workspace_id, reply_rate DESC, open_rate DESC);

-- 2. Workspace Usage Analytics
DROP MATERIALIZED VIEW IF EXISTS mv_workspace_analytics CASCADE;

CREATE MATERIALIZED VIEW mv_workspace_analytics AS
WITH daily_stats AS (
    SELECT 
        workspace_id,
        date_trunc('day', created_at) as date,
        COUNT(*) as daily_events,
        COUNT(DISTINCT email_address) as daily_unique_recipients,
        COUNT(CASE WHEN event_type = 'sent' THEN 1 END) as daily_sent,
        COUNT(CASE WHEN event_type = 'opened' THEN 1 END) as daily_opens,
        COUNT(CASE WHEN event_type = 'clicked' THEN 1 END) as daily_clicks,
        COUNT(CASE WHEN event_type = 'replied' THEN 1 END) as daily_replies
    FROM email_events
    WHERE created_at >= NOW() - INTERVAL '90 days'
    GROUP BY workspace_id, date_trunc('day', created_at)
),
workspace_totals AS (
    SELECT 
        w.id as workspace_id,
        w.name as workspace_name,
        w.created_at as workspace_created_at,
        
        -- Campaign counts
        COUNT(DISTINCT c.id) as total_campaigns,
        COUNT(DISTINCT CASE WHEN c.status = 'active' THEN c.id END) as active_campaigns,
        COUNT(DISTINCT CASE WHEN c.status = 'completed' THEN c.id END) as completed_campaigns,
        
        -- Lead counts
        COUNT(DISTINCT l.id) as total_leads,
        COUNT(DISTINCT CASE WHEN l.status = 'active' THEN l.id END) as active_leads,
        COUNT(DISTINCT CASE WHEN l.created_at >= NOW() - INTERVAL '30 days' THEN l.id END) as leads_added_30d,
        
        -- User activity
        COUNT(DISTINCT wm.user_id) as total_users,
        MAX(al.created_at) as last_activity_at
        
    FROM workspaces w
    LEFT JOIN campaigns c ON w.id = c.workspace_id
    LEFT JOIN leads l ON w.id = l.workspace_id
    LEFT JOIN workspace_members wm ON w.id = wm.workspace_id
    LEFT JOIN audit_logs al ON w.id = al.workspace_id
    GROUP BY w.id, w.name, w.created_at
)
SELECT 
    wt.*,
    
    -- 30-day aggregates
    COALESCE(SUM(ds.daily_events) FILTER (WHERE ds.date >= NOW() - INTERVAL '30 days'), 0) as events_30d,
    COALESCE(SUM(ds.daily_sent) FILTER (WHERE ds.date >= NOW() - INTERVAL '30 days'), 0) as sent_30d,
    COALESCE(SUM(ds.daily_opens) FILTER (WHERE ds.date >= NOW() - INTERVAL '30 days'), 0) as opens_30d,
    COALESCE(SUM(ds.daily_clicks) FILTER (WHERE ds.date >= NOW() - INTERVAL '30 days'), 0) as clicks_30d,
    COALESCE(SUM(ds.daily_replies) FILTER (WHERE ds.date >= NOW() - INTERVAL '30 days'), 0) as replies_30d,
    
    -- 7-day aggregates
    COALESCE(SUM(ds.daily_events) FILTER (WHERE ds.date >= NOW() - INTERVAL '7 days'), 0) as events_7d,
    COALESCE(SUM(ds.daily_sent) FILTER (WHERE ds.date >= NOW() - INTERVAL '7 days'), 0) as sent_7d,
    COALESCE(SUM(ds.daily_opens) FILTER (WHERE ds.date >= NOW() - INTERVAL '7 days'), 0) as opens_7d,
    COALESCE(SUM(ds.daily_clicks) FILTER (WHERE ds.date >= NOW() - INTERVAL '7 days'), 0) as clicks_7d,
    COALESCE(SUM(ds.daily_replies) FILTER (WHERE ds.date >= NOW() - INTERVAL '7 days'), 0) as replies_7d,
    
    -- Average daily activity (30-day)
    COALESCE(ROUND(AVG(ds.daily_events) FILTER (WHERE ds.date >= NOW() - INTERVAL '30 days'), 2), 0) as avg_daily_events_30d,
    COALESCE(ROUND(AVG(ds.daily_sent) FILTER (WHERE ds.date >= NOW() - INTERVAL '30 days'), 2), 0) as avg_daily_sent_30d,
    
    -- Peak activity day
    (SELECT ds2.date FROM daily_stats ds2 WHERE ds2.workspace_id = wt.workspace_id ORDER BY ds2.daily_events DESC LIMIT 1) as peak_activity_date,
    (SELECT MAX(ds2.daily_events) FROM daily_stats ds2 WHERE ds2.workspace_id = wt.workspace_id) as peak_daily_events,
    
    -- Activity score (weighted combination of metrics)
    CASE 
        WHEN SUM(ds.daily_events) FILTER (WHERE ds.date >= NOW() - INTERVAL '7 days') > 0 THEN
            LEAST(100, GREATEST(0, 
                (SUM(ds.daily_sent) FILTER (WHERE ds.date >= NOW() - INTERVAL '7 days') * 1) +
                (SUM(ds.daily_opens) FILTER (WHERE ds.date >= NOW() - INTERVAL '7 days') * 2) +
                (SUM(ds.daily_clicks) FILTER (WHERE ds.date >= NOW() - INTERVAL '7 days') * 3) +
                (SUM(ds.daily_replies) FILTER (WHERE ds.date >= NOW() - INTERVAL '7 days') * 5)
            ))
        ELSE 0
    END as activity_score_7d,
    
    NOW() as refreshed_at
    
FROM workspace_totals wt
LEFT JOIN daily_stats ds ON wt.workspace_id = ds.workspace_id
GROUP BY wt.workspace_id, wt.workspace_name, wt.workspace_created_at, wt.total_campaigns, 
         wt.active_campaigns, wt.completed_campaigns, wt.total_leads, wt.active_leads, 
         wt.leads_added_30d, wt.total_users, wt.last_activity_at;

-- Create indexes on workspace analytics
CREATE UNIQUE INDEX idx_mv_workspace_analytics_workspace_id ON mv_workspace_analytics (workspace_id);
CREATE INDEX idx_mv_workspace_analytics_activity_score ON mv_workspace_analytics (activity_score_7d DESC);
CREATE INDEX idx_mv_workspace_analytics_events_30d ON mv_workspace_analytics (events_30d DESC);

-- 3. Lead Engagement Scores
DROP MATERIALIZED VIEW IF EXISTS mv_lead_engagement_scores CASCADE;

CREATE MATERIALIZED VIEW mv_lead_engagement_scores AS
WITH lead_events AS (
    SELECT 
        l.id as lead_id,
        l.workspace_id,
        l.email,
        l.name,
        l.company,
        l.status as lead_status,
        l.created_at as lead_created_at,
        l.updated_at as lead_updated_at,
        
        -- Event counts (lifetime)
        COUNT(ee.id) as total_events,
        COUNT(CASE WHEN ee.event_type = 'sent' THEN 1 END) as emails_received,
        COUNT(CASE WHEN ee.event_type = 'opened' THEN 1 END) as total_opens,
        COUNT(CASE WHEN ee.event_type = 'clicked' THEN 1 END) as total_clicks,
        COUNT(CASE WHEN ee.event_type = 'replied' THEN 1 END) as total_replies,
        COUNT(CASE WHEN ee.event_type = 'bounced' THEN 1 END) as total_bounces,
        COUNT(CASE WHEN ee.event_type = 'complained' THEN 1 END) as total_complaints,
        
        -- Recent activity (30 days)
        COUNT(CASE WHEN ee.event_type = 'opened' AND ee.created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as opens_30d,
        COUNT(CASE WHEN ee.event_type = 'clicked' AND ee.created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as clicks_30d,
        COUNT(CASE WHEN ee.event_type = 'replied' AND ee.created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as replies_30d,
        
        -- Time metrics
        MIN(ee.created_at) as first_contact_at,
        MAX(ee.created_at) as last_activity_at,
        MAX(CASE WHEN ee.event_type = 'opened' THEN ee.created_at END) as last_open_at,
        MAX(CASE WHEN ee.event_type = 'clicked' THEN ee.created_at END) as last_click_at,
        MAX(CASE WHEN ee.event_type = 'replied' THEN ee.created_at END) as last_reply_at,
        
        -- Unique campaigns engaged with
        COUNT(DISTINCT ee.campaign_id) as campaigns_engaged
        
    FROM leads l
    LEFT JOIN email_events ee ON l.id = ee.lead_id
    GROUP BY l.id, l.workspace_id, l.email, l.name, l.company, l.status, l.created_at, l.updated_at
)
SELECT 
    lead_id,
    workspace_id,
    email,
    name,
    company,
    lead_status,
    lead_created_at,
    lead_updated_at,
    
    -- Event metrics
    total_events,
    emails_received,
    total_opens,
    total_clicks,
    total_replies,
    total_bounces,
    total_complaints,
    opens_30d,
    clicks_30d,
    replies_30d,
    campaigns_engaged,
    
    -- Time metrics
    first_contact_at,
    last_activity_at,
    last_open_at,
    last_click_at,
    last_reply_at,
    
    -- Engagement rates
    CASE 
        WHEN emails_received > 0 THEN 
            ROUND((total_opens::numeric / emails_received::numeric) * 100, 2)
        ELSE 0 
    END as open_rate,
    
    CASE 
        WHEN emails_received > 0 THEN 
            ROUND((total_clicks::numeric / emails_received::numeric) * 100, 2)
        ELSE 0 
    END as click_rate,
    
    CASE 
        WHEN emails_received > 0 THEN 
            ROUND((total_replies::numeric / emails_received::numeric) * 100, 2)
        ELSE 0 
    END as reply_rate,
    
    -- Engagement score (0-100)
    LEAST(100, GREATEST(0,
        (total_opens * 2) +
        (total_clicks * 5) +
        (total_replies * 10) +
        (opens_30d * 3) +
        (clicks_30d * 6) +
        (replies_30d * 12) +
        (campaigns_engaged * 5) +
        CASE 
            WHEN last_activity_at >= NOW() - INTERVAL '7 days' THEN 10
            WHEN last_activity_at >= NOW() - INTERVAL '30 days' THEN 5
            ELSE 0
        END
    )) as engagement_score,
    
    -- Lead temperature (hot/warm/cold)
    CASE 
        WHEN replies_30d > 0 OR (opens_30d > 2 AND clicks_30d > 0) THEN 'hot'
        WHEN opens_30d > 0 OR clicks_30d > 0 OR last_activity_at >= NOW() - INTERVAL '30 days' THEN 'warm'
        ELSE 'cold'
    END as temperature,
    
    -- Days since last activity
    CASE 
        WHEN last_activity_at IS NOT NULL THEN 
            EXTRACT(DAYS FROM NOW() - last_activity_at)::integer
        ELSE NULL 
    END as days_since_last_activity,
    
    NOW() as refreshed_at
    
FROM lead_events;

-- Create indexes on lead engagement scores
CREATE UNIQUE INDEX idx_mv_lead_engagement_scores_lead_id ON mv_lead_engagement_scores (lead_id);
CREATE INDEX idx_mv_lead_engagement_scores_workspace_id ON mv_lead_engagement_scores (workspace_id);
CREATE INDEX idx_mv_lead_engagement_scores_engagement_score ON mv_lead_engagement_scores (workspace_id, engagement_score DESC);
CREATE INDEX idx_mv_lead_engagement_scores_temperature ON mv_lead_engagement_scores (workspace_id, temperature);
CREATE INDEX idx_mv_lead_engagement_scores_last_activity ON mv_lead_engagement_scores (workspace_id, last_activity_at DESC NULLS LAST);

-- 4. Email Deliverability Metrics
DROP MATERIALIZED VIEW IF EXISTS mv_email_deliverability_metrics CASCADE;

CREATE MATERIALIZED VIEW mv_email_deliverability_metrics AS
WITH hourly_stats AS (
    SELECT 
        workspace_id,
        date_trunc('hour', created_at) as hour,
        COUNT(*) as total_events,
        COUNT(CASE WHEN event_type = 'sent' THEN 1 END) as sent_count,
        COUNT(CASE WHEN event_type = 'delivered' THEN 1 END) as delivered_count,
        COUNT(CASE WHEN event_type = 'bounced' THEN 1 END) as bounced_count,
        COUNT(CASE WHEN event_type = 'complained' THEN 1 END) as complained_count,
        COUNT(DISTINCT email_address) as unique_recipients
    FROM email_events
    WHERE created_at >= NOW() - INTERVAL '48 hours'
    GROUP BY workspace_id, date_trunc('hour', created_at)
),
daily_stats AS (
    SELECT 
        workspace_id,
        date_trunc('day', created_at) as date,
        COUNT(CASE WHEN event_type = 'sent' THEN 1 END) as daily_sent,
        COUNT(CASE WHEN event_type = 'delivered' THEN 1 END) as daily_delivered,
        COUNT(CASE WHEN event_type = 'bounced' THEN 1 END) as daily_bounced,
        COUNT(CASE WHEN event_type = 'complained' THEN 1 END) as daily_complained,
        COUNT(DISTINCT email_address) as daily_unique_recipients
    FROM email_events
    WHERE created_at >= NOW() - INTERVAL '30 days'
    GROUP BY workspace_id, date_trunc('day', created_at)
),
bounce_analysis AS (
    SELECT 
        workspace_id,
        bounce_reason,
        COUNT(*) as bounce_count
    FROM email_events
    WHERE event_type = 'bounced' 
    AND created_at >= NOW() - INTERVAL '30 days'
    AND bounce_reason IS NOT NULL
    GROUP BY workspace_id, bounce_reason
)
SELECT 
    w.id as workspace_id,
    w.name as workspace_name,
    
    -- 24-hour metrics
    COALESCE(SUM(hs.sent_count) FILTER (WHERE hs.hour >= NOW() - INTERVAL '24 hours'), 0) as sent_24h,
    COALESCE(SUM(hs.delivered_count) FILTER (WHERE hs.hour >= NOW() - INTERVAL '24 hours'), 0) as delivered_24h,
    COALESCE(SUM(hs.bounced_count) FILTER (WHERE hs.hour >= NOW() - INTERVAL '24 hours'), 0) as bounced_24h,
    COALESCE(SUM(hs.complained_count) FILTER (WHERE hs.hour >= NOW() - INTERVAL '24 hours'), 0) as complained_24h,
    
    -- 7-day metrics
    COALESCE(SUM(ds.daily_sent) FILTER (WHERE ds.date >= NOW() - INTERVAL '7 days'), 0) as sent_7d,
    COALESCE(SUM(ds.daily_delivered) FILTER (WHERE ds.date >= NOW() - INTERVAL '7 days'), 0) as delivered_7d,
    COALESCE(SUM(ds.daily_bounced) FILTER (WHERE ds.date >= NOW() - INTERVAL '7 days'), 0) as bounced_7d,
    COALESCE(SUM(ds.daily_complained) FILTER (WHERE ds.date >= NOW() - INTERVAL '7 days'), 0) as complained_7d,
    
    -- 30-day metrics
    COALESCE(SUM(ds.daily_sent), 0) as sent_30d,
    COALESCE(SUM(ds.daily_delivered), 0) as delivered_30d,
    COALESCE(SUM(ds.daily_bounced), 0) as bounced_30d,
    COALESCE(SUM(ds.daily_complained), 0) as complained_30d,
    
    -- Delivery rates
    CASE 
        WHEN SUM(hs.sent_count) FILTER (WHERE hs.hour >= NOW() - INTERVAL '24 hours') > 0 THEN
            ROUND((SUM(hs.delivered_count) FILTER (WHERE hs.hour >= NOW() - INTERVAL '24 hours')::numeric / 
                   SUM(hs.sent_count) FILTER (WHERE hs.hour >= NOW() - INTERVAL '24 hours')::numeric) * 100, 2)
        ELSE 0 
    END as delivery_rate_24h,
    
    CASE 
        WHEN SUM(ds.daily_sent) > 0 THEN
            ROUND((SUM(ds.daily_delivered)::numeric / SUM(ds.daily_sent)::numeric) * 100, 2)
        ELSE 0 
    END as delivery_rate_30d,
    
    -- Bounce rates
    CASE 
        WHEN SUM(hs.sent_count) FILTER (WHERE hs.hour >= NOW() - INTERVAL '24 hours') > 0 THEN
            ROUND((SUM(hs.bounced_count) FILTER (WHERE hs.hour >= NOW() - INTERVAL '24 hours')::numeric / 
                   SUM(hs.sent_count) FILTER (WHERE hs.hour >= NOW() - INTERVAL '24 hours')::numeric) * 100, 2)
        ELSE 0 
    END as bounce_rate_24h,
    
    CASE 
        WHEN SUM(ds.daily_sent) > 0 THEN
            ROUND((SUM(ds.daily_bounced)::numeric / SUM(ds.daily_sent)::numeric) * 100, 2)
        ELSE 0 
    END as bounce_rate_30d,
    
    -- Complaint rates
    CASE 
        WHEN SUM(hs.delivered_count) FILTER (WHERE hs.hour >= NOW() - INTERVAL '24 hours') > 0 THEN
            ROUND((SUM(hs.complained_count) FILTER (WHERE hs.hour >= NOW() - INTERVAL '24 hours')::numeric / 
                   SUM(hs.delivered_count) FILTER (WHERE hs.hour >= NOW() - INTERVAL '24 hours')::numeric) * 100, 4)
        ELSE 0 
    END as complaint_rate_24h,
    
    CASE 
        WHEN SUM(ds.daily_delivered) > 0 THEN
            ROUND((SUM(ds.daily_complained)::numeric / SUM(ds.daily_delivered)::numeric) * 100, 4)
        ELSE 0 
    END as complaint_rate_30d,
    
    -- Reputation score (0-100)
    LEAST(100, GREATEST(0,
        100 - 
        (CASE 
            WHEN SUM(ds.daily_sent) > 0 THEN
                (SUM(ds.daily_bounced)::numeric / SUM(ds.daily_sent)::numeric) * 50
            ELSE 0 
        END) - 
        (CASE 
            WHEN SUM(ds.daily_delivered) > 0 THEN
                (SUM(ds.daily_complained)::numeric / SUM(ds.daily_delivered)::numeric) * 1000
            ELSE 0 
        END)
    )) as reputation_score,
    
    -- Top bounce reasons (as JSON array)
    (SELECT COALESCE(json_agg(json_build_object('reason', bounce_reason, 'count', bounce_count) ORDER BY bounce_count DESC), '[]'::json)
     FROM bounce_analysis ba 
     WHERE ba.workspace_id = w.id 
     LIMIT 5) as top_bounce_reasons,
    
    NOW() as refreshed_at
    
FROM workspaces w
LEFT JOIN hourly_stats hs ON w.id = hs.workspace_id
LEFT JOIN daily_stats ds ON w.id = ds.workspace_id
GROUP BY w.id, w.name;

-- Create indexes on deliverability metrics
CREATE UNIQUE INDEX idx_mv_email_deliverability_metrics_workspace_id ON mv_email_deliverability_metrics (workspace_id);
CREATE INDEX idx_mv_email_deliverability_metrics_reputation_score ON mv_email_deliverability_metrics (reputation_score DESC);
CREATE INDEX idx_mv_email_deliverability_metrics_bounce_rate ON mv_email_deliverability_metrics (bounce_rate_30d);

-- 5. Set up automatic refresh schedules
SELECT cron.schedule(
    'refresh-campaign-analytics',
    '*/15 * * * *', -- Every 15 minutes
    'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_campaign_analytics;'
);

SELECT cron.schedule(
    'refresh-workspace-analytics',
    '0 * * * *', -- Every hour
    'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_workspace_analytics;'
);

SELECT cron.schedule(
    'refresh-lead-engagement-scores',
    '0 */6 * * *', -- Every 6 hours
    'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_lead_engagement_scores;'
);

SELECT cron.schedule(
    'refresh-deliverability-metrics',
    '*/30 * * * *', -- Every 30 minutes
    'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_email_deliverability_metrics;'
);

-- 6. Create refresh monitoring
CREATE TABLE materialized_view_refresh_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    view_name TEXT NOT NULL,
    refresh_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    refresh_completed_at TIMESTAMPTZ,
    refresh_duration_ms INTEGER,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Function to log refresh operations
CREATE OR REPLACE FUNCTION log_materialized_view_refresh()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO materialized_view_refresh_log (view_name, refresh_completed_at, refresh_duration_ms)
    VALUES (TG_TABLE_NAME, NOW(), EXTRACT(EPOCH FROM (NOW() - OLD.refreshed_at)) * 1000);
    RETURN NEW;
END;
$$;

-- Add comments
COMMENT ON MATERIALIZED VIEW mv_campaign_analytics IS 'Campaign performance metrics refreshed every 15 minutes';
COMMENT ON MATERIALIZED VIEW mv_workspace_analytics IS 'Workspace usage analytics refreshed every hour';
COMMENT ON MATERIALIZED VIEW mv_lead_engagement_scores IS 'Lead engagement scoring refreshed every 6 hours';
COMMENT ON MATERIALIZED VIEW mv_email_deliverability_metrics IS 'Email deliverability metrics refreshed every 30 minutes';

-- Grant permissions
GRANT SELECT ON mv_campaign_analytics TO authenticated;
GRANT SELECT ON mv_workspace_analytics TO authenticated;
GRANT SELECT ON mv_lead_engagement_scores TO authenticated;
GRANT SELECT ON mv_email_deliverability_metrics TO authenticated;
GRANT SELECT ON materialized_view_refresh_log TO authenticated;