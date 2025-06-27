-- Add tracking fields to campaign_emails table
ALTER TABLE campaign_emails
ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS open_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS click_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS message_id TEXT,
ADD COLUMN IF NOT EXISTS content_html TEXT,
ADD COLUMN IF NOT EXISTS content_text TEXT;

-- Add engagement score to leads
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS engagement_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;

-- Function to increment engagement score
CREATE OR REPLACE FUNCTION increment_engagement_score(
  p_lead_id UUID,
  p_points INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_score INTEGER;
BEGIN
  UPDATE leads
  SET engagement_score = COALESCE(engagement_score, 0) + p_points
  WHERE id = p_lead_id
  RETURNING engagement_score INTO v_new_score;
  
  RETURN v_new_score;
END;
$$;

-- Function to get campaign tracking stats
CREATE OR REPLACE FUNCTION get_campaign_tracking_stats(
  p_campaign_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  WITH stats AS (
    SELECT
      COUNT(DISTINCT ce.id) AS sent,
      COUNT(DISTINCT CASE WHEN ce.opened_at IS NOT NULL THEN ce.id END) AS opened,
      COUNT(DISTINCT CASE WHEN ce.clicked_at IS NOT NULL THEN ce.id END) AS clicked,
      COUNT(DISTINCT CASE WHEN ce.replied_at IS NOT NULL THEN ce.id END) AS replied,
      SUM(ce.click_count) AS total_clicks
    FROM campaign_emails ce
    WHERE ce.campaign_id = p_campaign_id
  ),
  top_links AS (
    SELECT
      ee.metadata->>'url' AS url,
      COUNT(DISTINCT ee.lead_id) AS unique_clicks,
      COUNT(*) AS total_clicks
    FROM email_events ee
    WHERE ee.campaign_id = p_campaign_id
      AND ee.event_type = 'clicked'
      AND ee.metadata->>'url' IS NOT NULL
    GROUP BY ee.metadata->>'url'
    ORDER BY unique_clicks DESC, total_clicks DESC
    LIMIT 5
  ),
  engagement_timeline AS (
    SELECT
      DATE_TRUNC('hour', ee.created_at) AS hour,
      COUNT(DISTINCT CASE WHEN ee.event_type = 'opened' THEN ee.lead_id END) AS opens,
      COUNT(DISTINCT CASE WHEN ee.event_type = 'clicked' THEN ee.lead_id END) AS clicks
    FROM email_events ee
    WHERE ee.campaign_id = p_campaign_id
      AND ee.created_at >= NOW() - INTERVAL '7 days'
    GROUP BY DATE_TRUNC('hour', ee.created_at)
    ORDER BY hour
  )
  SELECT json_build_object(
    'sent', s.sent,
    'opened', s.opened,
    'clicked', s.clicked,
    'replied', s.replied,
    'clickCount', s.total_clicks,
    'topLinks', COALESCE((SELECT json_agg(row_to_json(tl)) FROM top_links tl), '[]'::JSON),
    'engagementTimeline', COALESCE((SELECT json_agg(row_to_json(et)) FROM engagement_timeline et), '[]'::JSON)
  ) INTO v_result
  FROM stats s;

  RETURN v_result;
END;
$$;

-- Function to get lead engagement history
CREATE OR REPLACE FUNCTION get_lead_engagement_history(
  p_lead_id UUID,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE(
  event_type VARCHAR,
  email_id UUID,
  campaign_id UUID,
  campaign_name VARCHAR,
  subject VARCHAR,
  created_at TIMESTAMPTZ,
  metadata JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ee.event_type::VARCHAR,
    ee.email_id,
    ee.campaign_id,
    c.name AS campaign_name,
    ce.subject,
    ee.created_at,
    ee.metadata
  FROM email_events ee
  LEFT JOIN campaigns c ON c.id = ee.campaign_id
  LEFT JOIN campaign_emails ce ON ce.id = ee.email_id
  WHERE ee.lead_id = p_lead_id
  ORDER BY ee.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Create indexes for tracking queries
CREATE INDEX IF NOT EXISTS idx_email_events_email_id ON email_events(email_id);
CREATE INDEX IF NOT EXISTS idx_email_events_lead_id ON email_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_email_events_campaign_id ON email_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_events_event_type ON email_events(event_type);
CREATE INDEX IF NOT EXISTS idx_email_events_created_at ON email_events(created_at);

CREATE INDEX IF NOT EXISTS idx_campaign_emails_campaign_id ON campaign_emails(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_emails_lead_id ON campaign_emails(lead_id);
CREATE INDEX IF NOT EXISTS idx_campaign_emails_opened_at ON campaign_emails(opened_at);
CREATE INDEX IF NOT EXISTS idx_campaign_emails_clicked_at ON campaign_emails(clicked_at);

-- Grant permissions
GRANT EXECUTE ON FUNCTION increment_engagement_score TO authenticated;
GRANT EXECUTE ON FUNCTION get_campaign_tracking_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_lead_engagement_history TO authenticated;