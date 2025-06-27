-- Analytics Materialized Views
-- Pre-computed analytics for fast dashboard loading

-- 1. Campaign Performance Analytics (refreshed hourly)
CREATE MATERIALIZED VIEW campaign_analytics AS
WITH email_stats AS (
    SELECT 
        ce.campaign_id,
        ce.workspace_id,
        COUNT(DISTINCT ce.id) as emails_sent,
        COUNT(DISTINCT ce.lead_id) as unique_recipients,
        MIN(ce.sent_at) as first_sent_at,
        MAX(ce.sent_at) as last_sent_at
    FROM campaign_emails ce
    WHERE ce.sent_at IS NOT NULL
    GROUP BY ce.campaign_id, ce.workspace_id
),
event_stats AS (
    SELECT 
        ee.campaign_id,
        ee.workspace_id,
        COUNT(DISTINCT CASE WHEN ee.event_type = 'delivered' THEN ee.lead_id END) as delivered_count,
        COUNT(DISTINCT CASE WHEN ee.event_type = 'opened' THEN ee.lead_id END) as opened_count,
        COUNT(DISTINCT CASE WHEN ee.event_type = 'clicked' THEN ee.lead_id END) as clicked_count,
        COUNT(DISTINCT CASE WHEN ee.event_type = 'replied' THEN ee.lead_id END) as replied_count,
        COUNT(DISTINCT CASE WHEN ee.event_type = 'bounced' THEN ee.lead_id END) as bounced_count,
        COUNT(DISTINCT CASE WHEN ee.event_type = 'complained' THEN ee.lead_id END) as complained_count,
        COUNT(DISTINCT CASE WHEN ee.event_type = 'unsubscribed' THEN ee.lead_id END) as unsubscribed_count,
        COUNT(CASE WHEN ee.event_type = 'opened' THEN 1 END) as total_opens,
        COUNT(CASE WHEN ee.event_type = 'clicked' THEN 1 END) as total_clicks
    FROM email_events ee
    WHERE ee.created_at >= CURRENT_DATE - INTERVAL '90 days' -- Only last 90 days for performance
    GROUP BY ee.campaign_id, ee.workspace_id
)
SELECT 
    c.id as campaign_id,
    c.workspace_id,
    c.name as campaign_name,
    c.status as campaign_status,
    c.created_at as campaign_created_at,
    COALESCE(cl.lead_count, 0) as total_leads,
    COALESCE(es.emails_sent, 0) as emails_sent,
    COALESCE(es.unique_recipients, 0) as unique_recipients,
    COALESCE(ev.delivered_count, 0) as delivered_count,
    COALESCE(ev.opened_count, 0) as opened_count,
    COALESCE(ev.clicked_count, 0) as clicked_count,
    COALESCE(ev.replied_count, 0) as replied_count,
    COALESCE(ev.bounced_count, 0) as bounced_count,
    COALESCE(ev.complained_count, 0) as complained_count,
    COALESCE(ev.unsubscribed_count, 0) as unsubscribed_count,
    COALESCE(ev.total_opens, 0) as total_opens,
    COALESCE(ev.total_clicks, 0) as total_clicks,
    -- Calculated rates
    CASE WHEN es.emails_sent > 0 
        THEN ROUND(100.0 * ev.delivered_count / es.emails_sent, 2) 
        ELSE 0 
    END as delivery_rate,
    CASE WHEN ev.delivered_count > 0 
        THEN ROUND(100.0 * ev.opened_count / ev.delivered_count, 2) 
        ELSE 0 
    END as open_rate,
    CASE WHEN ev.opened_count > 0 
        THEN ROUND(100.0 * ev.clicked_count / ev.opened_count, 2) 
        ELSE 0 
    END as click_rate,
    CASE WHEN es.emails_sent > 0 
        THEN ROUND(100.0 * ev.replied_count / es.emails_sent, 2) 
        ELSE 0 
    END as reply_rate,
    CASE WHEN es.emails_sent > 0 
        THEN ROUND(100.0 * ev.bounced_count / es.emails_sent, 2) 
        ELSE 0 
    END as bounce_rate,
    es.first_sent_at,
    es.last_sent_at,
    NOW() as last_refreshed_at
FROM campaigns c
LEFT JOIN (
    SELECT campaign_id, COUNT(*) as lead_count 
    FROM campaign_leads 
    GROUP BY campaign_id
) cl ON cl.campaign_id = c.id
LEFT JOIN email_stats es ON es.campaign_id = c.id
LEFT JOIN event_stats ev ON ev.campaign_id = c.id
WHERE c.deleted_at IS NULL;

-- Create indexes for fast lookups
CREATE UNIQUE INDEX idx_campaign_analytics_id ON campaign_analytics(campaign_id);
CREATE INDEX idx_campaign_analytics_workspace ON campaign_analytics(workspace_id);
CREATE INDEX idx_campaign_analytics_status ON campaign_analytics(campaign_status);
CREATE INDEX idx_campaign_analytics_created ON campaign_analytics(campaign_created_at DESC);

-- 2. Workspace Usage Analytics (refreshed daily)
CREATE MATERIALIZED VIEW workspace_usage_analytics AS
WITH lead_stats AS (
    SELECT 
        workspace_id,
        COUNT(*) as total_leads,
        COUNT(DISTINCT LOWER(email)) as unique_emails,
        COUNT(CASE WHEN status = 'verified' THEN 1 END) as verified_leads,
        COUNT(CASE WHEN enrichment_data IS NOT NULL THEN 1 END) as enriched_leads,
        MAX(created_at) as last_lead_added
    FROM leads
    WHERE deleted_at IS NULL
    GROUP BY workspace_id
),
campaign_stats AS (
    SELECT 
        workspace_id,
        COUNT(*) as total_campaigns,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_campaigns,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_campaigns,
        MAX(created_at) as last_campaign_created
    FROM campaigns
    WHERE deleted_at IS NULL
    GROUP BY workspace_id
),
email_volume AS (
    SELECT 
        workspace_id,
        COUNT(*) as emails_sent_30d,
        COUNT(DISTINCT lead_id) as unique_recipients_30d
    FROM campaign_emails
    WHERE sent_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY workspace_id
),
ai_usage AS (
    SELECT 
        workspace_id,
        SUM(tokens_used) as tokens_used_30d,
        COUNT(*) as ai_requests_30d
    FROM ai_usage_logs
    WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY workspace_id
),
team_stats AS (
    SELECT 
        workspace_id,
        COUNT(*) as team_members,
        COUNT(CASE WHEN role IN ('owner', 'admin') THEN 1 END) as admin_count
    FROM workspace_members
    WHERE status = 'active'
    GROUP BY workspace_id
)
SELECT 
    w.id as workspace_id,
    w.name as workspace_name,
    w.plan as subscription_plan,
    w.created_at as workspace_created_at,
    COALESCE(l.total_leads, 0) as total_leads,
    COALESCE(l.unique_emails, 0) as unique_emails,
    COALESCE(l.verified_leads, 0) as verified_leads,
    COALESCE(l.enriched_leads, 0) as enriched_leads,
    COALESCE(c.total_campaigns, 0) as total_campaigns,
    COALESCE(c.active_campaigns, 0) as active_campaigns,
    COALESCE(c.completed_campaigns, 0) as completed_campaigns,
    COALESCE(e.emails_sent_30d, 0) as emails_sent_30d,
    COALESCE(e.unique_recipients_30d, 0) as unique_recipients_30d,
    COALESCE(a.tokens_used_30d, 0) as ai_tokens_used_30d,
    COALESCE(a.ai_requests_30d, 0) as ai_requests_30d,
    COALESCE(t.team_members, 0) as team_members,
    COALESCE(t.admin_count, 0) as admin_count,
    l.last_lead_added,
    c.last_campaign_created,
    NOW() as last_refreshed_at
FROM workspaces w
LEFT JOIN lead_stats l ON l.workspace_id = w.id
LEFT JOIN campaign_stats c ON c.workspace_id = w.id
LEFT JOIN email_volume e ON e.workspace_id = w.id
LEFT JOIN ai_usage a ON a.workspace_id = w.id
LEFT JOIN team_stats t ON t.workspace_id = w.id
WHERE w.deleted_at IS NULL;

-- Create indexes
CREATE UNIQUE INDEX idx_workspace_usage_analytics_id ON workspace_usage_analytics(workspace_id);
CREATE INDEX idx_workspace_usage_analytics_plan ON workspace_usage_analytics(subscription_plan);
CREATE INDEX idx_workspace_usage_analytics_created ON workspace_usage_analytics(workspace_created_at DESC);

-- 3. Lead Engagement Score (refreshed every 6 hours)
CREATE MATERIALIZED VIEW lead_engagement_scores AS
WITH recent_events AS (
    SELECT 
        lead_id,
        workspace_id,
        COUNT(CASE WHEN event_type = 'opened' THEN 1 END) as opens,
        COUNT(CASE WHEN event_type = 'clicked' THEN 1 END) as clicks,
        COUNT(CASE WHEN event_type = 'replied' THEN 1 END) as replies,
        MAX(CASE WHEN event_type = 'opened' THEN created_at END) as last_open,
        MAX(CASE WHEN event_type = 'clicked' THEN created_at END) as last_click,
        MAX(CASE WHEN event_type = 'replied' THEN created_at END) as last_reply,
        MIN(created_at) as first_interaction,
        MAX(created_at) as last_interaction
    FROM email_events
    WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
    AND event_type IN ('opened', 'clicked', 'replied')
    GROUP BY lead_id, workspace_id
),
lead_campaigns AS (
    SELECT 
        cl.lead_id,
        COUNT(DISTINCT cl.campaign_id) as campaigns_count,
        COUNT(DISTINCT ce.id) as emails_received
    FROM campaign_leads cl
    LEFT JOIN campaign_emails ce ON ce.lead_id = cl.lead_id AND ce.campaign_id = cl.campaign_id
    GROUP BY cl.lead_id
)
SELECT 
    l.id as lead_id,
    l.workspace_id,
    l.email,
    l.first_name,
    l.last_name,
    l.company,
    COALESCE(re.opens, 0) as total_opens,
    COALESCE(re.clicks, 0) as total_clicks,
    COALESCE(re.replies, 0) as total_replies,
    COALESCE(lc.campaigns_count, 0) as campaigns_count,
    COALESCE(lc.emails_received, 0) as emails_received,
    -- Calculate engagement score (0-100)
    LEAST(100, 
        COALESCE(re.opens, 0) * 1 +
        COALESCE(re.clicks, 0) * 5 +
        COALESCE(re.replies, 0) * 20 +
        CASE WHEN re.last_interaction > CURRENT_DATE - INTERVAL '7 days' THEN 10 ELSE 0 END +
        CASE WHEN re.last_interaction > CURRENT_DATE - INTERVAL '30 days' THEN 5 ELSE 0 END
    ) as engagement_score,
    -- Engagement level
    CASE 
        WHEN COALESCE(re.replies, 0) > 0 THEN 'hot'
        WHEN COALESCE(re.clicks, 0) > 2 THEN 'warm'
        WHEN COALESCE(re.opens, 0) > 3 THEN 'interested'
        WHEN COALESCE(re.opens, 0) > 0 THEN 'aware'
        ELSE 'cold'
    END as engagement_level,
    re.last_open,
    re.last_click,
    re.last_reply,
    re.first_interaction,
    re.last_interaction,
    CASE 
        WHEN re.last_interaction IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (NOW() - re.last_interaction)) / 86400
        ELSE NULL 
    END as days_since_last_interaction,
    NOW() as last_refreshed_at
FROM leads l
LEFT JOIN recent_events re ON re.lead_id = l.id
LEFT JOIN lead_campaigns lc ON lc.lead_id = l.id
WHERE l.deleted_at IS NULL;

-- Create indexes
CREATE UNIQUE INDEX idx_lead_engagement_scores_id ON lead_engagement_scores(lead_id);
CREATE INDEX idx_lead_engagement_scores_workspace ON lead_engagement_scores(workspace_id);
CREATE INDEX idx_lead_engagement_scores_score ON lead_engagement_scores(engagement_score DESC);
CREATE INDEX idx_lead_engagement_scores_level ON lead_engagement_scores(engagement_level);
CREATE INDEX idx_lead_engagement_scores_company ON lead_engagement_scores(company) WHERE company IS NOT NULL;

-- 4. Email Deliverability Metrics (refreshed every 2 hours)
CREATE MATERIALIZED VIEW email_deliverability_metrics AS
WITH hourly_stats AS (
    SELECT 
        workspace_id,
        date_trunc('hour', created_at) as hour,
        COUNT(*) FILTER (WHERE event_type = 'sent') as sent,
        COUNT(*) FILTER (WHERE event_type = 'delivered') as delivered,
        COUNT(*) FILTER (WHERE event_type = 'bounced') as bounced,
        COUNT(*) FILTER (WHERE event_type = 'complained') as complained
    FROM email_events
    WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY workspace_id, date_trunc('hour', created_at)
),
daily_stats AS (
    SELECT 
        workspace_id,
        date_trunc('day', created_at) as day,
        COUNT(*) FILTER (WHERE event_type = 'sent') as sent,
        COUNT(*) FILTER (WHERE event_type = 'delivered') as delivered,
        COUNT(*) FILTER (WHERE event_type = 'bounced') as bounced,
        COUNT(*) FILTER (WHERE event_type = 'complained') as complained,
        COUNT(DISTINCT provider_message_id) as unique_messages
    FROM email_events
    WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY workspace_id, date_trunc('day', created_at)
)
SELECT 
    w.id as workspace_id,
    w.name as workspace_name,
    -- Last 24 hours metrics
    COALESCE(SUM(h.sent) FILTER (WHERE h.hour >= NOW() - INTERVAL '24 hours'), 0) as sent_24h,
    COALESCE(SUM(h.delivered) FILTER (WHERE h.hour >= NOW() - INTERVAL '24 hours'), 0) as delivered_24h,
    COALESCE(SUM(h.bounced) FILTER (WHERE h.hour >= NOW() - INTERVAL '24 hours'), 0) as bounced_24h,
    COALESCE(SUM(h.complained) FILTER (WHERE h.hour >= NOW() - INTERVAL '24 hours'), 0) as complained_24h,
    -- Last 7 days metrics
    COALESCE(SUM(d.sent) FILTER (WHERE d.day >= CURRENT_DATE - INTERVAL '7 days'), 0) as sent_7d,
    COALESCE(SUM(d.delivered) FILTER (WHERE d.day >= CURRENT_DATE - INTERVAL '7 days'), 0) as delivered_7d,
    COALESCE(SUM(d.bounced) FILTER (WHERE d.day >= CURRENT_DATE - INTERVAL '7 days'), 0) as bounced_7d,
    COALESCE(SUM(d.complained) FILTER (WHERE d.day >= CURRENT_DATE - INTERVAL '7 days'), 0) as complained_7d,
    -- Last 30 days metrics
    COALESCE(SUM(d.sent), 0) as sent_30d,
    COALESCE(SUM(d.delivered), 0) as delivered_30d,
    COALESCE(SUM(d.bounced), 0) as bounced_30d,
    COALESCE(SUM(d.complained), 0) as complained_30d,
    -- Calculated rates
    CASE WHEN SUM(h.sent) FILTER (WHERE h.hour >= NOW() - INTERVAL '24 hours') > 0
        THEN ROUND(100.0 * SUM(h.delivered) FILTER (WHERE h.hour >= NOW() - INTERVAL '24 hours') / 
                   SUM(h.sent) FILTER (WHERE h.hour >= NOW() - INTERVAL '24 hours'), 2)
        ELSE 0
    END as delivery_rate_24h,
    CASE WHEN SUM(d.sent) > 0
        THEN ROUND(100.0 * SUM(d.bounced) / SUM(d.sent), 2)
        ELSE 0
    END as bounce_rate_30d,
    CASE WHEN SUM(d.sent) > 0
        THEN ROUND(100.0 * SUM(d.complained) / SUM(d.sent), 2)
        ELSE 0
    END as complaint_rate_30d,
    -- Reputation score (0-100, higher is better)
    GREATEST(0, LEAST(100, 
        100 - 
        (CASE WHEN SUM(d.sent) > 0 THEN SUM(d.bounced) * 100.0 / SUM(d.sent) ELSE 0 END) * 2 -
        (CASE WHEN SUM(d.sent) > 0 THEN SUM(d.complained) * 100.0 / SUM(d.sent) ELSE 0 END) * 10
    ))::INTEGER as reputation_score,
    NOW() as last_refreshed_at
FROM workspaces w
LEFT JOIN hourly_stats h ON h.workspace_id = w.id
LEFT JOIN daily_stats d ON d.workspace_id = w.id
WHERE w.deleted_at IS NULL
GROUP BY w.id, w.name;

-- Create indexes
CREATE UNIQUE INDEX idx_email_deliverability_metrics_id ON email_deliverability_metrics(workspace_id);
CREATE INDEX idx_email_deliverability_metrics_reputation ON email_deliverability_metrics(reputation_score);

-- Create refresh functions for all materialized views
CREATE OR REPLACE FUNCTION refresh_campaign_analytics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY campaign_analytics;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION refresh_workspace_usage_analytics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY workspace_usage_analytics;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION refresh_lead_engagement_scores()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY lead_engagement_scores;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION refresh_email_deliverability_metrics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY email_deliverability_metrics;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT ON campaign_analytics TO authenticated;
GRANT SELECT ON workspace_usage_analytics TO authenticated;
GRANT SELECT ON lead_engagement_scores TO authenticated;
GRANT SELECT ON email_deliverability_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_campaign_analytics() TO service_role;
GRANT EXECUTE ON FUNCTION refresh_workspace_usage_analytics() TO service_role;
GRANT EXECUTE ON FUNCTION refresh_lead_engagement_scores() TO service_role;
GRANT EXECUTE ON FUNCTION refresh_email_deliverability_metrics() TO service_role;