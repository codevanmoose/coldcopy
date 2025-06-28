-- Performance monitoring tables

-- Table for storing performance snapshots
CREATE TABLE IF NOT EXISTS performance_snapshots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metrics JSONB NOT NULL,
    alert_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partition by month for better performance
-- ALTER TABLE performance_snapshots PARTITION BY RANGE (timestamp);

-- Create indexes
CREATE INDEX idx_performance_snapshots_timestamp ON performance_snapshots(timestamp DESC);
CREATE INDEX idx_performance_snapshots_metrics_gin ON performance_snapshots USING GIN (metrics);

-- Table for storing performance alerts
CREATE TABLE IF NOT EXISTS performance_alerts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('warning', 'error', 'critical')),
    category TEXT NOT NULL CHECK (category IN ('query', 'connection', 'storage', 'memory', 'rate_limit')),
    message TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    threshold NUMERIC,
    current_value NUMERIC,
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_performance_alerts_type ON performance_alerts(type, created_at DESC);
CREATE INDEX idx_performance_alerts_category ON performance_alerts(category, created_at DESC);
CREATE INDEX idx_performance_alerts_resolved ON performance_alerts(resolved, created_at DESC);
CREATE INDEX idx_performance_alerts_created_at ON performance_alerts(created_at DESC);

-- RLS policies (only admins can access performance data)
ALTER TABLE performance_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_alerts ENABLE ROW LEVEL SECURITY;

-- Super admins can view all performance data
CREATE POLICY "Super admins can view performance snapshots" ON performance_snapshots
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'super_admin'
        )
    );

CREATE POLICY "Super admins can view performance alerts" ON performance_alerts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'super_admin'
        )
    );

-- System can insert performance data
CREATE POLICY "System can insert performance snapshots" ON performance_snapshots
    FOR INSERT WITH CHECK (true);

CREATE POLICY "System can insert performance alerts" ON performance_alerts
    FOR INSERT WITH CHECK (true);

-- Super admins can update alerts (resolve them)
CREATE POLICY "Super admins can update performance alerts" ON performance_alerts
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'super_admin'
        )
    );

-- Function to clean up old performance data
CREATE OR REPLACE FUNCTION cleanup_old_performance_data()
RETURNS void AS $$
BEGIN
    -- Delete snapshots older than 90 days
    DELETE FROM performance_snapshots 
    WHERE created_at < NOW() - INTERVAL '90 days';
    
    -- Delete resolved alerts older than 30 days
    DELETE FROM performance_alerts 
    WHERE resolved = true 
    AND resolved_at < NOW() - INTERVAL '30 days';
    
    -- Delete unresolved alerts older than 7 days (they should have been addressed)
    DELETE FROM performance_alerts 
    WHERE resolved = false 
    AND created_at < NOW() - INTERVAL '7 days';
    
    RAISE NOTICE 'Performance data cleanup completed';
END;
$$ LANGUAGE plpgsql;

-- Function to get performance summary
CREATE OR REPLACE FUNCTION get_performance_summary(hours_back INTEGER DEFAULT 24)
RETURNS TABLE(
    avg_response_time NUMERIC,
    avg_error_rate NUMERIC,
    avg_connection_count NUMERIC,
    avg_cache_hit_ratio NUMERIC,
    total_alerts BIGINT,
    critical_alerts BIGINT,
    warning_alerts BIGINT,
    latest_snapshot TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ROUND(AVG((metrics->>'responseTime')::NUMERIC), 2) as avg_response_time,
        ROUND(AVG((metrics->>'errorRate')::NUMERIC), 2) as avg_error_rate,
        ROUND(AVG((metrics->>'connectionCount')::NUMERIC), 2) as avg_connection_count,
        ROUND(AVG((metrics->>'cacheHitRatio')::NUMERIC), 2) as avg_cache_hit_ratio,
        (
            SELECT COUNT(*) 
            FROM performance_alerts 
            WHERE created_at > NOW() - (hours_back || ' hours')::INTERVAL
        ) as total_alerts,
        (
            SELECT COUNT(*) 
            FROM performance_alerts 
            WHERE created_at > NOW() - (hours_back || ' hours')::INTERVAL
            AND type = 'critical'
        ) as critical_alerts,
        (
            SELECT COUNT(*) 
            FROM performance_alerts 
            WHERE created_at > NOW() - (hours_back || ' hours')::INTERVAL
            AND type = 'warning'
        ) as warning_alerts,
        MAX(timestamp) as latest_snapshot
    FROM performance_snapshots
    WHERE timestamp > NOW() - (hours_back || ' hours')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- Function to get performance trends
CREATE OR REPLACE FUNCTION get_performance_trends(hours_back INTEGER DEFAULT 24)
RETURNS TABLE(
    hour_bucket TIMESTAMPTZ,
    avg_response_time NUMERIC,
    avg_error_rate NUMERIC,
    avg_connection_count NUMERIC,
    avg_cache_hit_ratio NUMERIC,
    snapshot_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        date_trunc('hour', timestamp) as hour_bucket,
        ROUND(AVG((metrics->>'responseTime')::NUMERIC), 2) as avg_response_time,
        ROUND(AVG((metrics->>'errorRate')::NUMERIC), 2) as avg_error_rate,
        ROUND(AVG((metrics->>'connectionCount')::NUMERIC), 2) as avg_connection_count,
        ROUND(AVG((metrics->>'cacheHitRatio')::NUMERIC), 2) as avg_cache_hit_ratio,
        COUNT(*) as snapshot_count
    FROM performance_snapshots
    WHERE timestamp > NOW() - (hours_back || ' hours')::INTERVAL
    GROUP BY date_trunc('hour', timestamp)
    ORDER BY hour_bucket DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get alert statistics
CREATE OR REPLACE FUNCTION get_alert_statistics(hours_back INTEGER DEFAULT 24)
RETURNS TABLE(
    alert_type TEXT,
    alert_category TEXT,
    alert_count BIGINT,
    avg_current_value NUMERIC,
    avg_threshold NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        type as alert_type,
        category as alert_category,
        COUNT(*) as alert_count,
        ROUND(AVG(current_value), 2) as avg_current_value,
        ROUND(AVG(threshold), 2) as avg_threshold
    FROM performance_alerts
    WHERE created_at > NOW() - (hours_back || ' hours')::INTERVAL
    GROUP BY type, category
    ORDER BY alert_count DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to resolve alerts
CREATE OR REPLACE FUNCTION resolve_performance_alerts(alert_ids UUID[])
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE performance_alerts 
    SET resolved = true, resolved_at = NOW()
    WHERE id = ANY(alert_ids)
    AND resolved = false;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Function to check system health
CREATE OR REPLACE FUNCTION check_system_health()
RETURNS TABLE(
    metric_name TEXT,
    current_value NUMERIC,
    threshold_value NUMERIC,
    status TEXT,
    message TEXT
) AS $$
BEGIN
    RETURN QUERY
    -- Check connection utilization
    SELECT 
        'connection_utilization'::TEXT as metric_name,
        (COUNT(*)::NUMERIC / (SELECT setting::NUMERIC FROM pg_settings WHERE name = 'max_connections')) * 100 as current_value,
        80::NUMERIC as threshold_value,
        CASE 
            WHEN (COUNT(*)::NUMERIC / (SELECT setting::NUMERIC FROM pg_settings WHERE name = 'max_connections')) * 100 > 90 THEN 'critical'
            WHEN (COUNT(*)::NUMERIC / (SELECT setting::NUMERIC FROM pg_settings WHERE name = 'max_connections')) * 100 > 80 THEN 'warning'
            ELSE 'ok'
        END as status,
        'Database connection utilization' as message
    FROM pg_stat_activity
    WHERE state = 'active'
    AND pid != pg_backend_pid()
    
    UNION ALL
    
    -- Check cache hit ratio
    SELECT 
        'cache_hit_ratio'::TEXT as metric_name,
        ROUND(
            (sum(blks_hit) * 100.0 / nullif(sum(blks_hit) + sum(blks_read), 0))::NUMERIC, 
            2
        ) as current_value,
        95::NUMERIC as threshold_value,
        CASE 
            WHEN ROUND(
                (sum(blks_hit) * 100.0 / nullif(sum(blks_hit) + sum(blks_read), 0))::NUMERIC, 
                2
            ) < 90 THEN 'critical'
            WHEN ROUND(
                (sum(blks_hit) * 100.0 / nullif(sum(blks_hit) + sum(blks_read), 0))::NUMERIC, 
                2
            ) < 95 THEN 'warning'
            ELSE 'ok'
        END as status,
        'Database cache hit ratio' as message
    FROM pg_stat_database
    WHERE datname = current_database()
    
    UNION ALL
    
    -- Check for long-running queries
    SELECT 
        'long_running_queries'::TEXT as metric_name,
        COUNT(*)::NUMERIC as current_value,
        5::NUMERIC as threshold_value,
        CASE 
            WHEN COUNT(*) > 10 THEN 'critical'
            WHEN COUNT(*) > 5 THEN 'warning'
            ELSE 'ok'
        END as status,
        'Queries running longer than 30 seconds' as message
    FROM pg_stat_activity
    WHERE state = 'active'
    AND now() - query_start > INTERVAL '30 seconds'
    AND pid != pg_backend_pid();
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to clean up old performance data (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-performance-data', '0 2 * * *', 'SELECT cleanup_old_performance_data();');

-- Grant permissions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT SELECT ON performance_snapshots TO authenticated;
GRANT SELECT ON performance_alerts TO authenticated;
GRANT UPDATE(resolved, resolved_at) ON performance_alerts TO authenticated;