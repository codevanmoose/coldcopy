-- Performance monitoring and optimization functions

-- Enable pg_stat_statements for query monitoring
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Function to analyze a query
CREATE OR REPLACE FUNCTION analyze_query(query_text TEXT)
RETURNS TABLE(query_plan JSONB) AS $$
BEGIN
    -- Execute EXPLAIN ANALYZE and return as JSONB
    RETURN QUERY
    EXECUTE 'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ' || query_text;
END;
$$ LANGUAGE plpgsql;

-- Function to get table statistics
CREATE OR REPLACE FUNCTION get_table_stats()
RETURNS TABLE(
    table_name TEXT,
    row_count BIGINT,
    table_size TEXT,
    index_size TEXT,
    total_size TEXT,
    last_vacuum TIMESTAMP,
    last_analyze TIMESTAMP,
    dead_tuples BIGINT,
    live_tuples BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        schemaname || '.' || tablename as table_name,
        n_tup_ins + n_tup_upd - n_tup_del as row_count,
        pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
        pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as index_size,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
        last_vacuum,
        last_analyze,
        n_dead_tup as dead_tuples,
        n_live_tup as live_tuples
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get index statistics
CREATE OR REPLACE FUNCTION get_index_stats()
RETURNS TABLE(
    index_name TEXT,
    table_name TEXT,
    index_size TEXT,
    index_scans BIGINT,
    index_reads BIGINT,
    index_hit_rate NUMERIC,
    is_unique BOOLEAN,
    is_primary BOOLEAN,
    columns TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.indexname::TEXT as index_name,
        i.tablename::TEXT as table_name,
        pg_size_pretty(pg_relation_size(i.schemaname||'.'||i.indexname)) as index_size,
        s.idx_scan as index_scans,
        s.idx_tup_read as index_reads,
        CASE 
            WHEN s.idx_tup_read = 0 THEN 0
            ELSE round((s.idx_scan::numeric / s.idx_tup_read) * 100, 2)
        END as index_hit_rate,
        indisunique as is_unique,
        indisprimary as is_primary,
        ARRAY(
            SELECT pg_get_indexdef(idx.indexrelid, k + 1, true)
            FROM generate_subscripts(idx.indkey, 1) as k
            ORDER BY k
        ) as columns
    FROM pg_indexes i
    LEFT JOIN pg_stat_user_indexes s ON i.indexname = s.indexname
    LEFT JOIN pg_index idx ON idx.indexrelid = (i.schemaname||'.'||i.indexname)::regclass
    WHERE i.schemaname = 'public'
    ORDER BY s.idx_scan DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql;

-- Function to find slow queries
CREATE OR REPLACE FUNCTION get_slow_queries(threshold_ms NUMERIC DEFAULT 1000)
RETURNS TABLE(
    query TEXT,
    execution_time NUMERIC,
    row_count BIGINT,
    calls BIGINT,
    total_time NUMERIC,
    mean_time NUMERIC,
    rows_per_call NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.query::TEXT,
        s.max_exec_time as execution_time,
        s.rows as row_count,
        s.calls,
        s.total_exec_time as total_time,
        s.mean_exec_time as mean_time,
        CASE 
            WHEN s.calls = 0 THEN 0
            ELSE s.rows::numeric / s.calls
        END as rows_per_call
    FROM pg_stat_statements s
    WHERE s.mean_exec_time > threshold_ms
    ORDER BY s.mean_exec_time DESC
    LIMIT 50;
END;
$$ LANGUAGE plpgsql;

-- Function to suggest missing indexes
CREATE OR REPLACE FUNCTION suggest_indexes()
RETURNS TABLE(
    table_name TEXT,
    columns TEXT[],
    reason TEXT,
    estimated_improvement TEXT
) AS $$
BEGIN
    RETURN QUERY
    -- Find tables with frequent sequential scans
    SELECT 
        t.schemaname || '.' || t.tablename as table_name,
        ARRAY['Consider columns used in WHERE, JOIN, and ORDER BY clauses'] as columns,
        'High sequential scan rate: ' || t.seq_scan || ' scans, ' || t.seq_tup_read || ' rows read' as reason,
        CASE 
            WHEN t.seq_tup_read > 100000 THEN 'High - Could significantly improve performance'
            WHEN t.seq_tup_read > 10000 THEN 'Medium - Moderate performance improvement'
            ELSE 'Low - Minor performance improvement'
        END as estimated_improvement
    FROM pg_stat_user_tables t
    WHERE t.seq_scan > 100
    AND t.seq_tup_read > 1000
    AND t.schemaname = 'public'
    ORDER BY t.seq_tup_read DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get connection pool statistics
CREATE OR REPLACE FUNCTION get_connection_pool_stats()
RETURNS TABLE(
    total_connections INTEGER,
    active_connections INTEGER,
    idle_connections INTEGER,
    waiting_clients INTEGER,
    max_connections INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        count(*)::INTEGER as total_connections,
        count(*) FILTER (WHERE state = 'active')::INTEGER as active_connections,
        count(*) FILTER (WHERE state = 'idle')::INTEGER as idle_connections,
        count(*) FILTER (WHERE wait_event_type = 'Client')::INTEGER as waiting_clients,
        (SELECT setting::INTEGER FROM pg_settings WHERE name = 'max_connections') as max_connections
    FROM pg_stat_activity
    WHERE pid != pg_backend_pid();
END;
$$ LANGUAGE plpgsql;

-- Function to find idle connections
CREATE OR REPLACE FUNCTION find_idle_connections(idle_threshold_minutes INTEGER DEFAULT 5)
RETURNS TABLE(
    pid INTEGER,
    duration TEXT,
    state TEXT,
    query TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.pid,
        (now() - a.state_change)::TEXT as duration,
        a.state,
        a.query
    FROM pg_stat_activity a
    WHERE a.state = 'idle'
    AND a.state_change < (now() - (idle_threshold_minutes || ' minutes')::INTERVAL)
    AND a.pid != pg_backend_pid()
    ORDER BY a.state_change ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to get database size and growth
CREATE OR REPLACE FUNCTION get_database_metrics()
RETURNS TABLE(
    database_size TEXT,
    table_count INTEGER,
    index_count INTEGER,
    largest_table TEXT,
    largest_table_size TEXT,
    total_queries BIGINT,
    cache_hit_ratio NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pg_size_pretty(pg_database_size(current_database())) as database_size,
        (SELECT count(*)::INTEGER FROM pg_tables WHERE schemaname = 'public') as table_count,
        (SELECT count(*)::INTEGER FROM pg_indexes WHERE schemaname = 'public') as index_count,
        (
            SELECT schemaname || '.' || tablename 
            FROM pg_tables t
            WHERE schemaname = 'public'
            ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC 
            LIMIT 1
        ) as largest_table,
        (
            SELECT pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
            FROM pg_tables t
            WHERE schemaname = 'public'
            ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC 
            LIMIT 1
        ) as largest_table_size,
        (SELECT sum(calls) FROM pg_stat_statements) as total_queries,
        (
            SELECT round(
                (sum(blks_hit) * 100.0 / nullif(sum(blks_hit) + sum(blks_read), 0))::numeric, 
                2
            )
            FROM pg_stat_database
            WHERE datname = current_database()
        ) as cache_hit_ratio;
END;
$$ LANGUAGE plpgsql;

-- Function to analyze query performance over time
CREATE OR REPLACE FUNCTION get_query_performance_trends(hours_back INTEGER DEFAULT 24)
RETURNS TABLE(
    hour_bucket TIMESTAMP,
    avg_execution_time NUMERIC,
    total_queries BIGINT,
    slow_queries BIGINT,
    cache_hit_ratio NUMERIC
) AS $$
BEGIN
    -- This would require a time-series table to track metrics over time
    -- For now, return current stats
    RETURN QUERY
    SELECT 
        date_trunc('hour', now()) as hour_bucket,
        avg(mean_exec_time) as avg_execution_time,
        sum(calls) as total_queries,
        count(*) FILTER (WHERE mean_exec_time > 1000) as slow_queries,
        (
            SELECT round(
                (sum(blks_hit) * 100.0 / nullif(sum(blks_hit) + sum(blks_read), 0))::numeric, 
                2
            )
            FROM pg_stat_database
            WHERE datname = current_database()
        ) as cache_hit_ratio
    FROM pg_stat_statements
    GROUP BY date_trunc('hour', now());
END;
$$ LANGUAGE plpgsql;

-- Function to get lock information
CREATE OR REPLACE FUNCTION get_lock_info()
RETURNS TABLE(
    blocked_pid INTEGER,
    blocking_pid INTEGER,
    blocked_query TEXT,
    blocking_query TEXT,
    lock_type TEXT,
    duration INTERVAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        blocked.pid as blocked_pid,
        blocking.pid as blocking_pid,
        blocked.query as blocked_query,
        blocking.query as blocking_query,
        locks.mode as lock_type,
        now() - blocked.query_start as duration
    FROM pg_locks locks
    JOIN pg_stat_activity blocked ON locks.pid = blocked.pid
    JOIN pg_stat_activity blocking ON locks.transactionid = blocking.transactionid
    WHERE NOT locks.granted
    AND blocked.pid != blocking.pid
    ORDER BY duration DESC;
END;
$$ LANGUAGE plpgsql;

-- Create performance monitoring view
CREATE OR REPLACE VIEW performance_overview AS
SELECT 
    'Database Size' as metric,
    pg_size_pretty(pg_database_size(current_database())) as value,
    'info' as status
UNION ALL
SELECT 
    'Cache Hit Ratio' as metric,
    round(
        (sum(blks_hit) * 100.0 / nullif(sum(blks_hit) + sum(blks_read), 0))::numeric, 
        2
    )::TEXT || '%' as value,
    CASE 
        WHEN round(
            (sum(blks_hit) * 100.0 / nullif(sum(blks_hit) + sum(blks_read), 0))::numeric, 
            2
        ) >= 95 THEN 'success'
        WHEN round(
            (sum(blks_hit) * 100.0 / nullif(sum(blks_hit) + sum(blks_read), 0))::numeric, 
            2
        ) >= 90 THEN 'warning'
        ELSE 'error'
    END as status
FROM pg_stat_database
WHERE datname = current_database()
UNION ALL
SELECT 
    'Active Connections' as metric,
    count(*)::TEXT as value,
    CASE 
        WHEN count(*) < 50 THEN 'success'
        WHEN count(*) < 80 THEN 'warning'
        ELSE 'error'
    END as status
FROM pg_stat_activity
WHERE state = 'active'
AND pid != pg_backend_pid()
UNION ALL
SELECT 
    'Slow Queries (>1s)' as metric,
    count(*)::TEXT as value,
    CASE 
        WHEN count(*) = 0 THEN 'success'
        WHEN count(*) < 10 THEN 'warning'
        ELSE 'error'
    END as status
FROM pg_stat_statements
WHERE mean_exec_time > 1000;

-- Grant permissions to authenticated users
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT SELECT ON performance_overview TO authenticated;