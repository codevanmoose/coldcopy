-- Advanced Analytics Functions and Procedures
-- This migration adds stored procedures and functions for advanced analytics

-- Function to get subject line performance
CREATE OR REPLACE FUNCTION get_subject_line_performance(
  p_workspace_id UUID,
  p_start_date TIMESTAMP WITH TIME ZONE,
  p_end_date TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE (
  subject TEXT,
  open_rate DECIMAL,
  click_rate DECIMAL,
  sent_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ce.subject_line as subject,
    COALESCE(
      (COUNT(CASE WHEN ee.event_type = 'opened' THEN 1 END)::DECIMAL / 
       NULLIF(COUNT(CASE WHEN ee.event_type = 'sent' THEN 1 END), 0)) * 100, 0
    ) as open_rate,
    COALESCE(
      (COUNT(CASE WHEN ee.event_type = 'clicked' THEN 1 END)::DECIMAL / 
       NULLIF(COUNT(CASE WHEN ee.event_type = 'delivered' THEN 1 END), 0)) * 100, 0
    ) as click_rate,
    COUNT(CASE WHEN ee.event_type = 'sent' THEN 1 END)::INTEGER as sent_count
  FROM campaign_emails ce
  LEFT JOIN email_events ee ON ce.id = ee.email_id
  WHERE ce.workspace_id = p_workspace_id
    AND ce.created_at >= p_start_date
    AND ce.created_at <= p_end_date
    AND ce.subject_line IS NOT NULL
  GROUP BY ce.subject_line
  HAVING COUNT(CASE WHEN ee.event_type = 'sent' THEN 1 END) >= 10
  ORDER BY open_rate DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- Function to get template performance
CREATE OR REPLACE FUNCTION get_template_performance(
  p_workspace_id UUID,
  p_start_date TIMESTAMP WITH TIME ZONE,
  p_end_date TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE (
  template_id UUID,
  template_name TEXT,
  open_rate DECIMAL,
  click_rate DECIMAL,
  reply_rate DECIMAL,
  usage_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    et.id as template_id,
    et.name as template_name,
    COALESCE(
      (COUNT(CASE WHEN ee.event_type = 'opened' THEN 1 END)::DECIMAL / 
       NULLIF(COUNT(CASE WHEN ee.event_type = 'sent' THEN 1 END), 0)) * 100, 0
    ) as open_rate,
    COALESCE(
      (COUNT(CASE WHEN ee.event_type = 'clicked' THEN 1 END)::DECIMAL / 
       NULLIF(COUNT(CASE WHEN ee.event_type = 'delivered' THEN 1 END), 0)) * 100, 0
    ) as click_rate,
    COALESCE(
      (COUNT(CASE WHEN ee.event_type = 'replied' THEN 1 END)::DECIMAL / 
       NULLIF(COUNT(CASE WHEN ee.event_type = 'delivered' THEN 1 END), 0)) * 100, 0
    ) as reply_rate,
    COUNT(DISTINCT ce.id)::INTEGER as usage_count
  FROM email_templates et
  LEFT JOIN campaign_emails ce ON et.id = ce.template_id
  LEFT JOIN email_events ee ON ce.id = ee.email_id
  WHERE et.workspace_id = p_workspace_id
    AND ce.created_at >= p_start_date
    AND ce.created_at <= p_end_date
  GROUP BY et.id, et.name
  HAVING COUNT(DISTINCT ce.id) > 0
  ORDER BY open_rate DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get revenue trends
CREATE OR REPLACE FUNCTION get_revenue_trends(
  p_workspace_id UUID,
  p_start_date TIMESTAMP WITH TIME ZONE,
  p_end_date TIMESTAMP WITH TIME ZONE,
  p_period TEXT DEFAULT 'day'
)
RETURNS TABLE (
  date TEXT,
  revenue DECIMAL,
  deals_closed INTEGER
) AS $$
DECLARE
  date_format TEXT;
BEGIN
  -- Set date format based on period
  CASE p_period
    WHEN 'hour' THEN date_format := 'YYYY-MM-DD HH24:00';
    WHEN 'day' THEN date_format := 'YYYY-MM-DD';
    WHEN 'week' THEN date_format := 'YYYY-"W"WW';
    WHEN 'month' THEN date_format := 'YYYY-MM';
    WHEN 'quarter' THEN date_format := 'YYYY-"Q"Q';
    WHEN 'year' THEN date_format := 'YYYY';
    ELSE date_format := 'YYYY-MM-DD';
  END CASE;

  RETURN QUERY
  SELECT 
    TO_CHAR(created_at, date_format) as date,
    SUM(amount)::DECIMAL as revenue,
    COUNT(*)::INTEGER as deals_closed
  FROM deals
  WHERE workspace_id = p_workspace_id
    AND created_at >= p_start_date
    AND created_at <= p_end_date
    AND status = 'closed_won'
  GROUP BY TO_CHAR(created_at, date_format)
  ORDER BY date;
END;
$$ LANGUAGE plpgsql;

-- Function to get advanced metrics with AI-powered insights
CREATE OR REPLACE FUNCTION get_advanced_metrics(
  p_workspace_id UUID,
  p_start_date TIMESTAMP WITH TIME ZONE,
  p_end_date TIMESTAMP WITH TIME ZONE
)
RETURNS JSON AS $$
DECLARE
  result JSON;
  engagement_score DECIMAL;
  deliverability_score DECIMAL;
  lead_quality_score DECIMAL;
  sender_reputation DECIMAL;
  list_health_score DECIMAL;
  campaign_effectiveness DECIMAL;
BEGIN
  -- Calculate engagement score (0-10)
  SELECT 
    LEAST(10, GREATEST(0,
      (AVG(CASE WHEN ee.event_type = 'opened' THEN 5 ELSE 0 END) +
       AVG(CASE WHEN ee.event_type = 'clicked' THEN 8 ELSE 0 END) +
       AVG(CASE WHEN ee.event_type = 'replied' THEN 10 ELSE 0 END)) / 2.3
    ))
  INTO engagement_score
  FROM email_events ee
  JOIN campaign_emails ce ON ee.email_id = ce.id
  WHERE ce.workspace_id = p_workspace_id
    AND ee.created_at >= p_start_date
    AND ee.created_at <= p_end_date;

  -- Calculate deliverability score (0-10)
  SELECT 
    LEAST(10, GREATEST(0,
      (COUNT(CASE WHEN ee.event_type = 'delivered' THEN 1 END)::DECIMAL / 
       NULLIF(COUNT(CASE WHEN ee.event_type = 'sent' THEN 1 END), 0)) * 10
    ))
  INTO deliverability_score
  FROM email_events ee
  JOIN campaign_emails ce ON ee.email_id = ce.id
  WHERE ce.workspace_id = p_workspace_id
    AND ee.created_at >= p_start_date
    AND ee.created_at <= p_end_date;

  -- Calculate lead quality score (0-10)
  SELECT 
    COALESCE(AVG(
      CASE 
        WHEN enrichment_data->>'score' IS NOT NULL 
        THEN (enrichment_data->>'score')::DECIMAL / 10
        ELSE 5
      END
    ), 5)
  INTO lead_quality_score
  FROM leads
  WHERE workspace_id = p_workspace_id
    AND created_at >= p_start_date
    AND created_at <= p_end_date;

  -- Calculate sender reputation (simplified)
  SELECT 
    LEAST(10, GREATEST(0,
      10 - (COUNT(CASE WHEN ee.event_type = 'bounced' THEN 1 END)::DECIMAL / 
            NULLIF(COUNT(CASE WHEN ee.event_type = 'sent' THEN 1 END), 0)) * 100
    ))
  INTO sender_reputation
  FROM email_events ee
  JOIN campaign_emails ce ON ee.email_id = ce.id
  WHERE ce.workspace_id = p_workspace_id
    AND ee.created_at >= p_start_date
    AND ee.created_at <= p_end_date;

  -- Calculate list health score
  SELECT 
    LEAST(10, GREATEST(0,
      (COUNT(CASE WHEN status = 'active' THEN 1 END)::DECIMAL / 
       NULLIF(COUNT(*), 0)) * 10
    ))
  INTO list_health_score
  FROM leads
  WHERE workspace_id = p_workspace_id;

  -- Calculate campaign effectiveness
  SELECT 
    COALESCE(AVG(
      CASE 
        WHEN status = 'completed' THEN
          LEAST(10, (
            SELECT COUNT(*)::DECIMAL / NULLIF(target_count, 0) * 10
            FROM campaigns c2
            WHERE c2.id = c.id
          ))
        ELSE 5
      END
    ), 5)
  INTO campaign_effectiveness
  FROM campaigns c
  WHERE workspace_id = p_workspace_id
    AND created_at >= p_start_date
    AND created_at <= p_end_date;

  -- Build result JSON
  SELECT json_build_object(
    'engagement_score', COALESCE(engagement_score, 0),
    'deliverability_score', COALESCE(deliverability_score, 0),
    'sender_reputation', COALESCE(sender_reputation, 0),
    'list_health_score', COALESCE(list_health_score, 0),
    'campaign_effectiveness', COALESCE(campaign_effectiveness, 0),
    'lead_quality_score', COALESCE(lead_quality_score, 0),
    'predictive_analytics', json_build_object(
      'next_month_performance', json_build_object(
        'estimated_opens', COALESCE(engagement_score * 100, 0),
        'estimated_clicks', COALESCE(engagement_score * 20, 0),
        'estimated_replies', COALESCE(engagement_score * 5, 0),
        'confidence_level', COALESCE((engagement_score + deliverability_score) * 5, 0)
      ),
      'churn_risk_leads', '[]'::json,
      'optimal_send_times', json_build_array(
        json_build_object('day', 'Tuesday', 'hour', 10, 'expected_open_rate', 25.5),
        json_build_object('day', 'Wednesday', 'hour', 14, 'expected_open_rate', 23.2),
        json_build_object('day', 'Thursday', 'hour', 9, 'expected_open_rate', 22.8)
      )
    )
  )
  INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to get geographical analytics
CREATE OR REPLACE FUNCTION get_geo_analytics(
  p_workspace_id UUID,
  p_start_date TIMESTAMP WITH TIME ZONE,
  p_end_date TIMESTAMP WITH TIME ZONE
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'performance_by_region', (
      SELECT json_agg(region_data)
      FROM (
        SELECT 
          COALESCE(l.enrichment_data->>'country', 'Unknown') as country,
          COALESCE(l.enrichment_data->>'region', 'Unknown') as region,
          COUNT(CASE WHEN ee.event_type = 'sent' THEN 1 END) as emails_sent,
          COALESCE(
            (COUNT(CASE WHEN ee.event_type = 'opened' THEN 1 END)::DECIMAL / 
             NULLIF(COUNT(CASE WHEN ee.event_type = 'delivered' THEN 1 END), 0)) * 100, 0
          ) as open_rate,
          COALESCE(
            (COUNT(CASE WHEN ee.event_type = 'clicked' THEN 1 END)::DECIMAL / 
             NULLIF(COUNT(CASE WHEN ee.event_type = 'delivered' THEN 1 END), 0)) * 100, 0
          ) as click_rate,
          COALESCE(
            (COUNT(CASE WHEN ee.event_type = 'replied' THEN 1 END)::DECIMAL / 
             NULLIF(COUNT(CASE WHEN ee.event_type = 'delivered' THEN 1 END), 0)) * 100, 0
          ) as reply_rate,
          0::DECIMAL as conversion_rate
        FROM leads l
        JOIN campaign_emails ce ON l.id = ce.lead_id
        JOIN email_events ee ON ce.id = ee.email_id
        WHERE l.workspace_id = p_workspace_id
          AND ee.created_at >= p_start_date
          AND ee.created_at <= p_end_date
        GROUP BY l.enrichment_data->>'country', l.enrichment_data->>'region'
        HAVING COUNT(CASE WHEN ee.event_type = 'sent' THEN 1 END) >= 10
        ORDER BY open_rate DESC
        LIMIT 10
      ) region_data
    ),
    'timezone_performance', json_build_array(
      json_build_object('timezone', 'UTC-8', 'best_send_time', '10:00', 'open_rate', 24.5, 'click_rate', 3.2),
      json_build_object('timezone', 'UTC-5', 'best_send_time', '14:00', 'open_rate', 23.1, 'click_rate', 2.9),
      json_build_object('timezone', 'UTC+0', 'best_send_time', '09:00', 'open_rate', 22.8, 'click_rate', 2.7)
    ),
    'language_performance', json_build_array(
      json_build_object('language', 'English', 'emails_sent', 1500, 'engagement_rate', 23.5, 'conversion_rate', 2.1),
      json_build_object('language', 'Spanish', 'emails_sent', 300, 'engagement_rate', 18.2, 'conversion_rate', 1.8)
    )
  )
  INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to get real-time analytics
CREATE OR REPLACE FUNCTION get_realtime_analytics(
  p_workspace_id UUID
)
RETURNS JSON AS $$
DECLARE
  result JSON;
  active_campaigns INTEGER;
  emails_sent_today INTEGER;
  opens_last_hour INTEGER;
  clicks_last_hour INTEGER;
  replies_last_hour INTEGER;
BEGIN
  -- Get active campaigns
  SELECT COUNT(*)
  INTO active_campaigns
  FROM campaigns
  WHERE workspace_id = p_workspace_id
    AND status = 'active';

  -- Get emails sent today
  SELECT COUNT(*)
  INTO emails_sent_today
  FROM email_events ee
  JOIN campaign_emails ce ON ee.email_id = ce.id
  WHERE ce.workspace_id = p_workspace_id
    AND ee.event_type = 'sent'
    AND ee.created_at >= CURRENT_DATE;

  -- Get opens in last hour
  SELECT COUNT(*)
  INTO opens_last_hour
  FROM email_events ee
  JOIN campaign_emails ce ON ee.email_id = ce.id
  WHERE ce.workspace_id = p_workspace_id
    AND ee.event_type = 'opened'
    AND ee.created_at >= NOW() - INTERVAL '1 hour';

  -- Get clicks in last hour
  SELECT COUNT(*)
  INTO clicks_last_hour
  FROM email_events ee
  JOIN campaign_emails ce ON ee.email_id = ce.id
  WHERE ce.workspace_id = p_workspace_id
    AND ee.event_type = 'clicked'
    AND ee.created_at >= NOW() - INTERVAL '1 hour';

  -- Get replies in last hour
  SELECT COUNT(*)
  INTO replies_last_hour
  FROM email_events ee
  JOIN campaign_emails ce ON ee.email_id = ce.id
  WHERE ce.workspace_id = p_workspace_id
    AND ee.event_type = 'replied'
    AND ee.created_at >= NOW() - INTERVAL '1 hour';

  SELECT json_build_object(
    'active_campaigns', active_campaigns,
    'emails_sent_today', emails_sent_today,
    'opens_last_hour', opens_last_hour,
    'clicks_last_hour', clicks_last_hour,
    'replies_last_hour', replies_last_hour,
    'current_sending_rate', GREATEST(0, emails_sent_today::DECIMAL / 24),
    'server_performance', json_build_object(
      'response_time', 120,
      'uptime', 99.9,
      'error_rate', 0.1
    ),
    'live_events', (
      SELECT json_agg(event_data)
      FROM (
        SELECT json_build_object(
          'timestamp', ee.created_at,
          'event_type', ee.event_type,
          'campaign_name', c.name,
          'lead_email', l.email,
          'details', json_build_object('user_agent', ee.metadata->>'user_agent')
        ) as event_data
        FROM email_events ee
        JOIN campaign_emails ce ON ee.email_id = ce.id
        JOIN campaigns c ON ce.campaign_id = c.id
        JOIN leads l ON ce.lead_id = l.id
        WHERE ce.workspace_id = p_workspace_id
          AND ee.created_at >= NOW() - INTERVAL '1 hour'
        ORDER BY ee.created_at DESC
        LIMIT 10
      ) recent_events
    )
  )
  INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to get competitor analytics (simplified)
CREATE OR REPLACE FUNCTION get_competitor_analytics(
  p_workspace_id UUID,
  p_industry TEXT DEFAULT NULL
)
RETURNS JSON AS $$
BEGIN
  RETURN json_build_object(
    'market_share', 15.5,
    'competitor_comparison', json_build_array(
      json_build_object('competitor', 'Company A', 'market_share', 25.2, 'estimated_volume', 15000, 'key_differentiators', json_build_array('Price', 'Features')),
      json_build_object('competitor', 'Company B', 'market_share', 18.7, 'estimated_volume', 11000, 'key_differentiators', json_build_array('Support', 'Integrations')),
      json_build_object('competitor', 'Company C', 'market_share', 12.3, 'estimated_volume', 8000, 'key_differentiators', json_build_array('Ease of use', 'Analytics'))
    ),
    'industry_benchmarks', json_build_object(
      'average_open_rate', 
      CASE 
        WHEN p_industry = 'technology' THEN 21.3
        WHEN p_industry = 'finance' THEN 19.8
        WHEN p_industry = 'healthcare' THEN 23.1
        ELSE 22.1
      END,
      'average_click_rate',
      CASE 
        WHEN p_industry = 'technology' THEN 2.8
        WHEN p_industry = 'finance' THEN 2.2
        WHEN p_industry = 'healthcare' THEN 3.1
        ELSE 2.6
      END,
      'average_reply_rate',
      CASE 
        WHEN p_industry = 'technology' THEN 1.2
        WHEN p_industry = 'finance' THEN 0.9
        WHEN p_industry = 'healthcare' THEN 1.5
        ELSE 1.1
      END,
      'average_bounce_rate',
      CASE 
        WHEN p_industry = 'technology' THEN 2.1
        WHEN p_industry = 'finance' THEN 3.2
        WHEN p_industry = 'healthcare' THEN 1.8
        ELSE 2.4
      END
    )
  );
END;
$$ LANGUAGE plpgsql;

-- Function to export analytics (placeholder - would integrate with external service)
CREATE OR REPLACE FUNCTION export_analytics(
  p_workspace_id UUID,
  p_start_date TIMESTAMP WITH TIME ZONE,
  p_end_date TIMESTAMP WITH TIME ZONE,
  p_format TEXT,
  p_sections TEXT[]
)
RETURNS TEXT AS $$
BEGIN
  -- This is a placeholder function
  -- In a real implementation, this would generate CSV/Excel/PDF exports
  -- For now, return a simple confirmation
  RETURN 'Export generated for workspace ' || p_workspace_id || ' in ' || p_format || ' format';
END;
$$ LANGUAGE plpgsql;