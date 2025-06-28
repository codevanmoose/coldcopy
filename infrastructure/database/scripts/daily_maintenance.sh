#!/bin/bash

# ColdCopy Daily Database Maintenance Script
# Run this script daily during low-traffic hours (e.g., 2 AM UTC)

set -e

# Load environment variables
source /etc/coldcopy/.env

# Database connection
DATABASE_URL="${DATABASE_URL:-$SUPABASE_DB_URL}"

# Log file
LOG_FILE="/var/log/coldcopy/db_maintenance_$(date +%Y%m%d).log"
mkdir -p /var/log/coldcopy

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Start maintenance
log "Starting daily database maintenance..."

# 1. Refresh materialized views
log "Refreshing materialized views..."
psql "$DATABASE_URL" << EOF
SELECT refresh_all_materialized_views();
EOF

# 2. Update statistics
log "Updating table statistics..."
psql "$DATABASE_URL" << EOF
ANALYZE VERBOSE;
EOF

# 3. Vacuum tables (non-blocking)
log "Vacuuming tables..."
psql "$DATABASE_URL" << EOF
-- Vacuum most active tables
VACUUM ANALYZE leads;
VACUUM ANALYZE campaigns;
VACUUM ANALYZE campaign_emails;
VACUUM ANALYZE email_events;
VACUUM ANALYZE email_messages;
VACUUM ANALYZE workflow_executions;
EOF

# 4. Create new partitions
log "Creating new partitions..."
psql "$DATABASE_URL" << EOF
SELECT create_monthly_partitions('email_events', CURRENT_DATE, 3);
EOF

# 5. Clean up old monitoring data
log "Cleaning up old monitoring data..."
psql "$DATABASE_URL" << EOF
-- Keep only last 30 days of monitoring data
DELETE FROM monitoring.slow_queries WHERE captured_at < NOW() - INTERVAL '30 days';
DELETE FROM monitoring.index_usage WHERE captured_at < NOW() - INTERVAL '30 days';
DELETE FROM monitoring.table_sizes WHERE captured_at < NOW() - INTERVAL '30 days';

-- Clean up old audit logs (keep 90 days)
DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '90 days';
EOF

# 6. Capture current performance metrics
log "Capturing performance metrics..."
psql "$DATABASE_URL" << EOF
SELECT capture_performance_metrics();
EOF

# 7. Check for unused indexes
log "Checking for unused indexes..."
psql "$DATABASE_URL" << EOF
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
AND schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY tablename, indexname;
EOF

# 8. Check table bloat
log "Checking table bloat..."
psql "$DATABASE_URL" << EOF
WITH constants AS (
    SELECT current_setting('block_size')::numeric AS bs, 23 AS hdr, 8 AS ma
),
no_stats AS (
    SELECT table_schema, table_name, 
        n_live_tup::numeric as est_rows,
        pg_table_size(relid)::numeric as table_size
    FROM information_schema.columns
        JOIN pg_stat_user_tables as psut
           ON table_schema = psut.schemaname
           AND table_name = psut.relname
        LEFT OUTER JOIN pg_stats
        ON table_schema = pg_stats.schemaname
            AND table_name = pg_stats.tablename
            AND column_name = attname 
    WHERE attname IS NULL
        AND table_schema NOT IN ('pg_catalog', 'information_schema')
    GROUP BY table_schema, table_name, relid, n_live_tup
),
null_headers AS (
    SELECT
        hdr+1+(sum(case when null_frac <> 0 THEN 1 else 0 END)/8) as nullhdr,
        SUM((1-null_frac)*avg_width) as datawidth,
        MAX(null_frac) as maxfracsum,
        schemaname,
        tablename,
        hdr, ma, bs
    FROM pg_stats CROSS JOIN constants
        LEFT OUTER JOIN no_stats
            ON schemaname = no_stats.table_schema
            AND tablename = no_stats.table_name
    WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
        AND no_stats.table_name IS NULL
        AND EXISTS ( SELECT 1
            FROM information_schema.columns
                WHERE schemaname = columns.table_schema
                    AND tablename = columns.table_name )
    GROUP BY schemaname, tablename, hdr, ma, bs
),
data_headers AS (
    SELECT
        ma, bs, hdr, schemaname, tablename,
        (datawidth+(hdr+ma-(case when hdr%ma=0 THEN ma ELSE hdr%ma END)))::numeric AS datahdr,
        (maxfracsum*(nullhdr+ma-(case when nullhdr%ma=0 THEN ma ELSE nullhdr%ma END))) AS nullhdr2
    FROM null_headers
),
table_estimates AS (
    SELECT schemaname, tablename, bs,
        reltuples::numeric as est_rows, relpages * bs as table_bytes,
    CEIL((reltuples*
            (datahdr + nullhdr2 + 4 + ma -
                (CASE WHEN datahdr%ma=0
                    THEN ma ELSE datahdr%ma END)
                )/(bs-20))) * bs AS expected_bytes,
        reltoastrelid
    FROM data_headers
        JOIN pg_class ON tablename = relname
        JOIN pg_namespace ON relnamespace = pg_namespace.oid
            AND schemaname = nspname
    WHERE pg_class.relkind = 'r'
),
estimates_with_toast AS (
    SELECT schemaname, tablename, 
        TRUE as can_estimate,
        est_rows,
        table_bytes + ( coalesce(toast.relpages, 0) * bs ) as table_bytes,
        expected_bytes + ( ceil( coalesce(toast.reltuples, 0) / 4 ) * bs ) as expected_bytes
    FROM table_estimates LEFT OUTER JOIN pg_class as toast
        ON table_estimates.reltoastrelid = toast.oid
            AND toast.relkind = 't'
),
table_estimates_plus AS (
    SELECT current_database() as databasename,
            schemaname, tablename, can_estimate, 
            est_rows,
            CASE WHEN table_bytes > 0
                THEN table_bytes::NUMERIC
                ELSE NULL::NUMERIC END
                AS table_bytes,
            CASE WHEN expected_bytes > 0 
                THEN expected_bytes::NUMERIC
                ELSE NULL::NUMERIC END
                    AS expected_bytes,
            CASE WHEN expected_bytes > 0 AND table_bytes > 0
                AND expected_bytes <= table_bytes
                THEN (table_bytes - expected_bytes)::NUMERIC
                ELSE 0::NUMERIC END AS bloat_bytes
    FROM estimates_with_toast
    UNION ALL
    SELECT current_database() as databasename, 
        table_schema, table_name, FALSE, 
        est_rows, table_size,
        NULL::NUMERIC, NULL::NUMERIC
    FROM no_stats
),
bloat_data AS (
    select current_database() as databasename,
        schemaname, tablename, can_estimate, 
        table_bytes, round(table_bytes/(1024^2)::NUMERIC,3) as table_mb,
        expected_bytes, round(expected_bytes/(1024^2)::NUMERIC,3) as expected_mb,
        round(bloat_bytes/(1024^2)::NUMERIC,3) as bloat_mb,
        round(bloat_bytes*100/table_bytes::NUMERIC,2) as bloat_pct
    FROM table_estimates_plus
)
SELECT datname, schemaname, tablename,
    can_estimate,
    pg_size_pretty(table_bytes) AS table_size,
    CASE WHEN bloat_pct > 20 AND bloat_mb > 10
        THEN pg_size_pretty(bloat_bytes) || ' (' || bloat_pct || '%)'
        ELSE 'OK'
    END AS bloat_info
FROM bloat_data
WHERE table_bytes > 1024*1024*10  -- Only tables > 10MB
    AND (bloat_pct > 20 OR bloat_mb > 10)
ORDER BY bloat_bytes DESC
LIMIT 20;
EOF

# 9. Generate maintenance report
log "Generating maintenance report..."
psql "$DATABASE_URL" << EOF
SELECT 
    'Database Size' as metric,
    pg_size_pretty(pg_database_size(current_database())) as value
UNION ALL
SELECT 
    'Total Connections' as metric,
    count(*)::text as value
FROM pg_stat_activity
UNION ALL
SELECT 
    'Active Queries' as metric,
    count(*)::text as value
FROM pg_stat_activity
WHERE state = 'active'
UNION ALL
SELECT 
    'Longest Running Query' as metric,
    COALESCE(max(extract(epoch from (now() - query_start)))::text || ' seconds', 'None') as value
FROM pg_stat_activity
WHERE state = 'active' AND query NOT LIKE '%pg_stat_activity%';
EOF

# 10. Send notification if issues found
ISSUES=$(psql -t "$DATABASE_URL" -c "
    SELECT COUNT(*) 
    FROM pg_stat_user_tables 
    WHERE n_dead_tup > n_live_tup 
    AND schemaname NOT IN ('pg_catalog', 'information_schema');
")

if [ "$ISSUES" -gt 0 ]; then
    log "WARNING: Found $ISSUES tables with high dead tuple count"
    # Send alert to monitoring system
    # curl -X POST "$MONITORING_WEBHOOK" -d "{\"text\":\"Database maintenance: $ISSUES tables need attention\"}"
fi

log "Daily maintenance completed successfully!"

# Compress old log files
find /var/log/coldcopy -name "db_maintenance_*.log" -mtime +7 -exec gzip {} \;

# Delete very old log files
find /var/log/coldcopy -name "db_maintenance_*.log.gz" -mtime +30 -delete

exit 0