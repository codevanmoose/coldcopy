-- Function to get analytics overview
CREATE OR REPLACE FUNCTION get_analytics_overview(
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
  v_current_period_start TIMESTAMPTZ;
  v_current_period_end TIMESTAMPTZ;
  v_previous_period_start TIMESTAMPTZ;
  v_previous_period_end TIMESTAMPTZ;
  v_period_length INTERVAL;
BEGIN
  -- Set date ranges
  v_current_period_end := COALESCE(p_end_date, NOW());
  v_current_period_start := COALESCE(p_start_date, v_current_period_end - INTERVAL '30 days');
  v_period_length := v_current_period_end - v_current_period_start;
  v_previous_period_end := v_current_period_start;
  v_previous_period_start := v_previous_period_end - v_period_length;

  -- Calculate metrics
  WITH current_metrics AS (
    SELECT
      COUNT(DISTINCT ce.id) AS total_emails_sent,
      COUNT(DISTINCT CASE WHEN ee.event_type = 'opened' THEN ee.email_id END) AS emails_opened,
      COUNT(DISTINCT CASE WHEN ee.event_type = 'clicked' THEN ee.email_id END) AS emails_clicked,
      COUNT(DISTINCT CASE WHEN ee.event_type = 'replied' THEN ee.email_id END) AS emails_replied,
      AVG(EXTRACT(EPOCH FROM (em.received_at - ce.sent_at)) / 3600) AS avg_response_hours
    FROM campaign_emails ce
    LEFT JOIN email_events ee ON ee.email_id = ce.id
    LEFT JOIN email_messages em ON em.campaign_email_id = ce.id AND em.direction = 'inbound'
    WHERE ce.workspace_id = p_workspace_id
      AND ce.sent_at BETWEEN v_current_period_start AND v_current_period_end
  ),
  previous_metrics AS (
    SELECT
      COUNT(DISTINCT ce.id) AS total_emails_sent,
      COUNT(DISTINCT CASE WHEN ee.event_type = 'opened' THEN ee.email_id END) AS emails_opened,
      AVG(EXTRACT(EPOCH FROM (em.received_at - ce.sent_at)) / 3600) AS avg_response_hours
    FROM campaign_emails ce
    LEFT JOIN email_events ee ON ee.email_id = ce.id
    LEFT JOIN email_messages em ON em.campaign_email_id = ce.id AND em.direction = 'inbound'
    WHERE ce.workspace_id = p_workspace_id
      AND ce.sent_at BETWEEN v_previous_period_start AND v_previous_period_end
  )
  SELECT json_build_object(
    'total_emails_sent', cm.total_emails_sent,
    'emails_sent_change', 
      CASE WHEN pm.total_emails_sent > 0 
        THEN ROUND(((cm.total_emails_sent::NUMERIC - pm.total_emails_sent) / pm.total_emails_sent * 100)::NUMERIC, 1)
        ELSE 0 
      END,
    'avg_open_rate', 
      CASE WHEN cm.total_emails_sent > 0 
        THEN ROUND((cm.emails_opened::NUMERIC / cm.total_emails_sent * 100)::NUMERIC, 1)
        ELSE 0 
      END,
    'open_rate_change',
      CASE WHEN pm.total_emails_sent > 0 AND pm.emails_opened > 0
        THEN ROUND((
          (cm.emails_opened::NUMERIC / cm.total_emails_sent) - 
          (pm.emails_opened::NUMERIC / pm.total_emails_sent)
        ) * 100::NUMERIC, 1)
        ELSE 0
      END,
    'avg_reply_rate',
      CASE WHEN cm.total_emails_sent > 0 
        THEN ROUND((cm.emails_replied::NUMERIC / cm.total_emails_sent * 100)::NUMERIC, 1)
        ELSE 0 
      END,
    'reply_rate_change', 0, -- Would calculate similar to open_rate_change
    'avg_response_time', 
      CASE WHEN cm.avg_response_hours IS NOT NULL
        THEN cm.avg_response_hours || 'h'
        ELSE '0h'
      END,
    'response_time_change',
      CASE WHEN pm.avg_response_hours > 0
        THEN ROUND(((cm.avg_response_hours - pm.avg_response_hours) / pm.avg_response_hours * 100)::NUMERIC, 1)
        ELSE 0
      END
  ) INTO v_result
  FROM current_metrics cm, previous_metrics pm;

  RETURN v_result;
END;
$$;

-- Function to get email engagement over time
CREATE OR REPLACE FUNCTION get_email_engagement_over_time(
  p_workspace_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(
  date DATE,
  emails_sent BIGINT,
  emails_opened BIGINT,
  emails_clicked BIGINT,
  emails_replied BIGINT
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
  )
  SELECT
    ds.date,
    COUNT(DISTINCT ce.id) FILTER (WHERE DATE(ce.sent_at) = ds.date) AS emails_sent,
    COUNT(DISTINCT ee.email_id) FILTER (WHERE ee.event_type = 'opened' AND DATE(ee.created_at) = ds.date) AS emails_opened,
    COUNT(DISTINCT ee.email_id) FILTER (WHERE ee.event_type = 'clicked' AND DATE(ee.created_at) = ds.date) AS emails_clicked,
    COUNT(DISTINCT ee.email_id) FILTER (WHERE ee.event_type = 'replied' AND DATE(ee.created_at) = ds.date) AS emails_replied
  FROM date_series ds
  LEFT JOIN campaign_emails ce ON DATE(ce.sent_at) = ds.date AND ce.workspace_id = p_workspace_id
  LEFT JOIN email_events ee ON ee.email_id = ce.id
  GROUP BY ds.date
  ORDER BY ds.date;
END;
$$;

-- Function to get lead conversion funnel
CREATE OR REPLACE FUNCTION get_lead_conversion_funnel(
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
BEGIN
  WITH funnel_data AS (
    SELECT
      COUNT(DISTINCT l.id) AS total_leads,
      COUNT(DISTINCT ce.lead_id) AS leads_emailed,
      COUNT(DISTINCT CASE WHEN ee.event_type = 'opened' THEN ce.lead_id END) AS leads_opened,
      COUNT(DISTINCT CASE WHEN ee.event_type = 'clicked' THEN ce.lead_id END) AS leads_clicked,
      COUNT(DISTINCT CASE WHEN ee.event_type = 'replied' THEN ce.lead_id END) AS leads_replied,
      COUNT(DISTINCT CASE WHEN l.status = 'converted' THEN l.id END) AS leads_converted
    FROM leads l
    LEFT JOIN campaign_emails ce ON ce.lead_id = l.id
    LEFT JOIN email_events ee ON ee.email_id = ce.id
    WHERE l.workspace_id = p_workspace_id
      AND l.created_at BETWEEN COALESCE(p_start_date, NOW() - INTERVAL '30 days') AND COALESCE(p_end_date, NOW())
  )
  SELECT json_build_object(
    'total_leads', total_leads,
    'emails_sent', leads_emailed,
    'emails_opened', leads_opened,
    'emails_clicked', leads_clicked,
    'emails_replied', leads_replied,
    'leads_converted', leads_converted
  ) INTO v_result
  FROM funnel_data;

  RETURN v_result;
END;
$$;

-- Function to get response time analytics
CREATE OR REPLACE FUNCTION get_response_time_analytics(
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
BEGIN
  WITH response_times AS (
    SELECT
      EXTRACT(EPOCH FROM (em.received_at - ce.sent_at)) / 3600 AS hours_to_response
    FROM campaign_emails ce
    INNER JOIN email_messages em ON em.campaign_email_id = ce.id AND em.direction = 'inbound'
    WHERE ce.workspace_id = p_workspace_id
      AND ce.sent_at BETWEEN COALESCE(p_start_date, NOW() - INTERVAL '30 days') AND COALESCE(p_end_date, NOW())
  ),
  distribution AS (
    SELECT
      COUNT(*) FILTER (WHERE hours_to_response < 1) AS under_1_hour,
      COUNT(*) FILTER (WHERE hours_to_response >= 1 AND hours_to_response < 4) AS under_4_hours,
      COUNT(*) FILTER (WHERE hours_to_response >= 4 AND hours_to_response < 24) AS under_24_hours,
      COUNT(*) FILTER (WHERE hours_to_response >= 24 AND hours_to_response < 72) AS under_3_days,
      COUNT(*) FILTER (WHERE hours_to_response >= 72) AS over_3_days,
      AVG(hours_to_response) AS avg_hours,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY hours_to_response) AS median_hours
    FROM response_times
  ),
  hourly AS (
    SELECT
      EXTRACT(HOUR FROM ce.sent_at) AS hour,
      AVG(EXTRACT(EPOCH FROM (em.received_at - ce.sent_at)) / 60) AS avg_response_minutes
    FROM campaign_emails ce
    INNER JOIN email_messages em ON em.campaign_email_id = ce.id AND em.direction = 'inbound'
    WHERE ce.workspace_id = p_workspace_id
      AND ce.sent_at BETWEEN COALESCE(p_start_date, NOW() - INTERVAL '30 days') AND COALESCE(p_end_date, NOW())
    GROUP BY EXTRACT(HOUR FROM ce.sent_at)
  )
  SELECT json_build_object(
    'under_1_hour', COALESCE(d.under_1_hour, 0),
    'under_4_hours', COALESCE(d.under_4_hours, 0),
    'under_24_hours', COALESCE(d.under_24_hours, 0),
    'under_3_days', COALESCE(d.under_3_days, 0),
    'over_3_days', COALESCE(d.over_3_days, 0),
    'avg_response_time', COALESCE(ROUND(d.avg_hours::NUMERIC, 1) || 'h', '0h'),
    'median_response_time', COALESCE(ROUND(d.median_hours::NUMERIC, 1) || 'h', '0h'),
    'improvement_percentage', 15, -- Placeholder
    'hourly_distribution', COALESCE((
      SELECT json_agg(json_build_object(
        'hour', hour,
        'avg_response_minutes', ROUND(avg_response_minutes::NUMERIC, 0)
      ) ORDER BY hour)
      FROM hourly
    ), '[]'::JSON)
  ) INTO v_result
  FROM distribution d;

  RETURN v_result;
END;
$$;

-- Function to get team performance metrics
CREATE OR REPLACE FUNCTION get_team_performance_metrics(
  p_workspace_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(
  user_id UUID,
  email VARCHAR,
  name VARCHAR,
  role user_role,
  emails_sent BIGINT,
  reply_rate NUMERIC,
  avg_response_time VARCHAR,
  conversations_handled BIGINT,
  performance_score INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH user_metrics AS (
    SELECT
      u.id AS user_id,
      u.email,
      u.name,
      wm.role,
      COUNT(DISTINCT ce.id) AS emails_sent,
      COUNT(DISTINCT CASE WHEN ee.event_type = 'replied' THEN ee.email_id END) AS emails_replied,
      AVG(EXTRACT(EPOCH FROM (em.received_at - ce.sent_at)) / 3600) AS avg_response_hours,
      COUNT(DISTINCT et.id) AS conversations_handled
    FROM users u
    INNER JOIN workspace_members wm ON wm.user_id = u.id AND wm.workspace_id = p_workspace_id
    LEFT JOIN campaign_emails ce ON ce.sent_by = u.id 
      AND ce.sent_at BETWEEN COALESCE(p_start_date, NOW() - INTERVAL '30 days') AND COALESCE(p_end_date, NOW())
    LEFT JOIN email_events ee ON ee.email_id = ce.id
    LEFT JOIN email_messages em ON em.campaign_email_id = ce.id AND em.direction = 'inbound'
    LEFT JOIN email_threads et ON et.assigned_to = u.id
    GROUP BY u.id, u.email, u.name, wm.role
  )
  SELECT
    um.user_id,
    um.email::VARCHAR,
    um.name::VARCHAR,
    um.role,
    um.emails_sent,
    CASE WHEN um.emails_sent > 0 
      THEN ROUND((um.emails_replied::NUMERIC / um.emails_sent * 100)::NUMERIC, 1)
      ELSE 0 
    END AS reply_rate,
    COALESCE(ROUND(um.avg_response_hours::NUMERIC, 1) || 'h', '0h') AS avg_response_time,
    um.conversations_handled,
    -- Performance score calculation (simplified)
    LEAST(100, GREATEST(0,
      (CASE WHEN um.emails_sent > 0 THEN 25 ELSE 0 END) +
      (CASE WHEN um.emails_sent > 0 AND um.emails_replied > 0 
        THEN LEAST(25, (um.emails_replied::NUMERIC / um.emails_sent * 100))::INTEGER 
        ELSE 0 
      END) +
      (CASE WHEN um.avg_response_hours < 24 THEN 25 ELSE 10 END) +
      (CASE WHEN um.conversations_handled > 0 THEN 25 ELSE 0 END)
    )) AS performance_score
  FROM user_metrics um
  ORDER BY performance_score DESC;
END;
$$;

-- Function to get A/B test results
CREATE OR REPLACE FUNCTION get_ab_test_results(
  p_workspace_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  campaign_name VARCHAR,
  test_variable VARCHAR,
  status VARCHAR,
  variant_a_name VARCHAR,
  variant_a_sent BIGINT,
  variant_a_open_rate NUMERIC,
  variant_a_click_rate NUMERIC,
  variant_a_reply_rate NUMERIC,
  variant_b_name VARCHAR,
  variant_b_sent BIGINT,
  variant_b_open_rate NUMERIC,
  variant_b_click_rate NUMERIC,
  variant_b_reply_rate NUMERIC,
  winner CHAR(1),
  confidence_level NUMERIC,
  is_significant BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Placeholder implementation - would need actual A/B test tables
  RETURN QUERY
  SELECT
    gen_random_uuid() AS id,
    'Welcome Email Campaign'::VARCHAR AS campaign_name,
    'Subject Line'::VARCHAR AS test_variable,
    'completed'::VARCHAR AS status,
    'Professional Subject'::VARCHAR AS variant_a_name,
    500::BIGINT AS variant_a_sent,
    28.5::NUMERIC AS variant_a_open_rate,
    4.2::NUMERIC AS variant_a_click_rate,
    6.8::NUMERIC AS variant_a_reply_rate,
    'Casual Subject'::VARCHAR AS variant_b_name,
    500::BIGINT AS variant_b_sent,
    32.1::NUMERIC AS variant_b_open_rate,
    5.6::NUMERIC AS variant_b_click_rate,
    8.9::NUMERIC AS variant_b_reply_rate,
    'b'::CHAR(1) AS winner,
    95.3::NUMERIC AS confidence_level,
    TRUE AS is_significant
  WHERE p_workspace_id IS NOT NULL
  LIMIT 0; -- Return empty for now
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_analytics_overview TO authenticated;
GRANT EXECUTE ON FUNCTION get_email_engagement_over_time TO authenticated;
GRANT EXECUTE ON FUNCTION get_lead_conversion_funnel TO authenticated;
GRANT EXECUTE ON FUNCTION get_response_time_analytics TO authenticated;
GRANT EXECUTE ON FUNCTION get_team_performance_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION get_ab_test_results TO authenticated;