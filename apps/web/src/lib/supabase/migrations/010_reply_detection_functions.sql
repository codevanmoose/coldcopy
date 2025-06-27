-- Function to get reply detection metrics
CREATE OR REPLACE FUNCTION get_reply_detection_metrics(
  p_workspace_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
  v_start_date TIMESTAMPTZ;
  v_end_date TIMESTAMPTZ;
BEGIN
  -- Set date ranges
  v_end_date := COALESCE(p_end_date, NOW());
  v_start_date := COALESCE(p_start_date, v_end_date - INTERVAL '30 days');

  -- Calculate metrics
  WITH email_stats AS (
    SELECT
      COUNT(DISTINCT ce.id) AS total_sent,
      COUNT(DISTINCT CASE WHEN ee.event_type = 'replied' THEN ee.email_id END) AS total_replied,
      COUNT(DISTINCT CASE 
        WHEN ee.event_type = 'replied' AND COALESCE(ee.metadata->>'reply_type', 'genuine_reply') = 'genuine_reply' 
        THEN ee.email_id 
      END) AS genuine_replies,
      COUNT(DISTINCT CASE 
        WHEN ee.event_type = 'replied' AND ee.metadata->>'reply_type' = 'auto_reply' 
        THEN ee.email_id 
      END) AS auto_replies,
      COUNT(DISTINCT CASE 
        WHEN ee.event_type = 'replied' AND ee.metadata->>'reply_type' = 'bounce' 
        THEN ee.email_id 
      END) AS bounces,
      AVG(CASE 
        WHEN ee.event_type = 'replied' 
        THEN COALESCE((ee.metadata->>'reply_score')::NUMERIC, 50) 
      END) AS avg_reply_score
    FROM campaign_emails ce
    LEFT JOIN email_events ee ON ee.email_id = ce.id
    WHERE ce.workspace_id = p_workspace_id
      AND ce.sent_at BETWEEN v_start_date AND v_end_date
      AND ce.status = 'sent'
  )
  SELECT json_build_object(
    'totalProcessed', total_sent,
    'replyRate', 
      CASE WHEN total_sent > 0 
        THEN ROUND((total_replied::NUMERIC / total_sent * 100)::NUMERIC, 2)
        ELSE 0 
      END,
    'genuineReplyRate',
      CASE WHEN total_sent > 0 
        THEN ROUND((genuine_replies::NUMERIC / total_sent * 100)::NUMERIC, 2)
        ELSE 0 
      END,
    'autoReplyRate',
      CASE WHEN total_sent > 0 
        THEN ROUND((auto_replies::NUMERIC / total_sent * 100)::NUMERIC, 2)
        ELSE 0 
      END,
    'bounceRate',
      CASE WHEN total_sent > 0 
        THEN ROUND((bounces::NUMERIC / total_sent * 100)::NUMERIC, 2)
        ELSE 0 
      END,
    'avgReplyScore', COALESCE(ROUND(avg_reply_score::NUMERIC, 1), 0)
  ) INTO v_result
  FROM email_stats;

  RETURN v_result;
END;
$$;

-- Function to get reply trends over time
CREATE OR REPLACE FUNCTION get_reply_trends(
  p_workspace_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(
  date DATE,
  genuine_replies INTEGER,
  auto_replies INTEGER,
  bounces INTEGER,
  out_of_office INTEGER,
  total_replies INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(
      DATE(COALESCE(p_start_date, NOW() - INTERVAL '30 days')),
      DATE(COALESCE(p_end_date, NOW())),
      '1 day'::INTERVAL
    )::DATE AS date
  ),
  daily_replies AS (
    SELECT
      DATE(ee.created_at) AS reply_date,
      COUNT(DISTINCT CASE 
        WHEN COALESCE(ee.metadata->>'reply_type', 'genuine_reply') = 'genuine_reply' 
        THEN ee.email_id 
      END) AS genuine_count,
      COUNT(DISTINCT CASE 
        WHEN ee.metadata->>'reply_type' = 'auto_reply' 
        THEN ee.email_id 
      END) AS auto_count,
      COUNT(DISTINCT CASE 
        WHEN ee.metadata->>'reply_type' = 'bounce' 
        THEN ee.email_id 
      END) AS bounce_count,
      COUNT(DISTINCT CASE 
        WHEN ee.metadata->>'reply_type' = 'out_of_office' 
        THEN ee.email_id 
      END) AS ooo_count,
      COUNT(DISTINCT ee.email_id) AS total_count
    FROM email_events ee
    JOIN campaign_emails ce ON ce.id = ee.email_id
    WHERE ee.event_type = 'replied'
      AND ce.workspace_id = p_workspace_id
      AND ee.created_at BETWEEN COALESCE(p_start_date, NOW() - INTERVAL '30 days') 
        AND COALESCE(p_end_date, NOW())
    GROUP BY DATE(ee.created_at)
  )
  SELECT
    ds.date,
    COALESCE(dr.genuine_count, 0)::INTEGER,
    COALESCE(dr.auto_count, 0)::INTEGER,
    COALESCE(dr.bounce_count, 0)::INTEGER,
    COALESCE(dr.ooo_count, 0)::INTEGER,
    COALESCE(dr.total_count, 0)::INTEGER
  FROM date_series ds
  LEFT JOIN daily_replies dr ON dr.reply_date = ds.date
  ORDER BY ds.date;
END;
$$;

-- Function to get reply score distribution
CREATE OR REPLACE FUNCTION get_reply_score_distribution(
  p_workspace_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(
  score_range TEXT,
  count INTEGER,
  percentage NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH score_data AS (
    SELECT
      CASE
        WHEN COALESCE((ee.metadata->>'reply_score')::NUMERIC, 50) >= 80 THEN '80-100'
        WHEN COALESCE((ee.metadata->>'reply_score')::NUMERIC, 50) >= 60 THEN '60-79'
        WHEN COALESCE((ee.metadata->>'reply_score')::NUMERIC, 50) >= 40 THEN '40-59'
        WHEN COALESCE((ee.metadata->>'reply_score')::NUMERIC, 50) >= 20 THEN '20-39'
        ELSE '0-19'
      END AS range_label,
      COUNT(*) AS reply_count
    FROM email_events ee
    JOIN campaign_emails ce ON ce.id = ee.email_id
    WHERE ee.event_type = 'replied'
      AND ce.workspace_id = p_workspace_id
      AND ee.created_at BETWEEN COALESCE(p_start_date, NOW() - INTERVAL '30 days') 
        AND COALESCE(p_end_date, NOW())
    GROUP BY range_label
  ),
  total_count AS (
    SELECT SUM(reply_count) AS total FROM score_data
  )
  SELECT
    sd.range_label,
    sd.reply_count::INTEGER,
    ROUND((sd.reply_count::NUMERIC / NULLIF(tc.total, 0) * 100)::NUMERIC, 1)
  FROM score_data sd, total_count tc
  ORDER BY 
    CASE sd.range_label
      WHEN '0-19' THEN 1
      WHEN '20-39' THEN 2
      WHEN '40-59' THEN 3
      WHEN '60-79' THEN 4
      WHEN '80-100' THEN 5
    END;
END;
$$;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_email_events_reply_type 
ON email_events((metadata->>'reply_type')) 
WHERE event_type = 'replied';

CREATE INDEX IF NOT EXISTS idx_email_events_reply_score 
ON email_events(((metadata->>'reply_score')::NUMERIC)) 
WHERE event_type = 'replied';

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_reply_detection_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION get_reply_trends TO authenticated;
GRANT EXECUTE ON FUNCTION get_reply_score_distribution TO authenticated;