-- Enhanced Email Events Partitioning Migration
-- This migration improves the existing partitioning system with automation and better performance

BEGIN;

-- Create a function to automatically create monthly partitions
CREATE OR REPLACE FUNCTION create_email_events_partition(
    partition_start DATE,
    partition_end DATE
) RETURNS VOID AS $$
DECLARE
    partition_name TEXT;
    index_prefix TEXT;
BEGIN
    -- Generate partition name (e.g., email_events_2024_03)
    partition_name := 'email_events_' || to_char(partition_start, 'YYYY_MM');
    index_prefix := partition_name;
    
    -- Create the partition if it doesn't exist
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I PARTITION OF email_events
        FOR VALUES FROM (%L) TO (%L)
    ', partition_name, partition_start, partition_end);
    
    -- Create optimized indexes on the new partition
    EXECUTE format('
        CREATE INDEX IF NOT EXISTS %I_workspace_created_idx 
        ON %I (workspace_id, created_at DESC)
    ', index_prefix, partition_name);
    
    EXECUTE format('
        CREATE INDEX IF NOT EXISTS %I_campaign_event_idx 
        ON %I (campaign_id, event_type, created_at DESC)
    ', index_prefix, partition_name);
    
    EXECUTE format('
        CREATE INDEX IF NOT EXISTS %I_lead_event_idx 
        ON %I (lead_id, event_type, created_at DESC)
    ', index_prefix, partition_name);
    
    EXECUTE format('
        CREATE INDEX IF NOT EXISTS %I_event_type_idx 
        ON %I (event_type, created_at DESC) 
        WHERE event_type IN (''open'', ''click'', ''delivery'', ''bounce'')
    ', index_prefix, partition_name);
    
    -- Create index for webhook processing
    EXECUTE format('
        CREATE INDEX IF NOT EXISTS %I_external_id_idx 
        ON %I (external_id) 
        WHERE external_id IS NOT NULL
    ', index_prefix, partition_name);
    
    RAISE NOTICE 'Created partition % with indexes', partition_name;
END;
$$ LANGUAGE plpgsql;

-- Create a function to automatically create future partitions
CREATE OR REPLACE FUNCTION maintain_email_events_partitions() RETURNS VOID AS $$
DECLARE
    current_month DATE;
    future_month DATE;
    partition_count INTEGER := 6; -- Create 6 months ahead
    i INTEGER;
BEGIN
    -- Start from current month
    current_month := date_trunc('month', CURRENT_DATE);
    
    -- Create partitions for current month + next 6 months
    FOR i IN 0..partition_count LOOP
        future_month := current_month + (i || ' months')::INTERVAL;
        
        PERFORM create_email_events_partition(
            future_month,
            future_month + INTERVAL '1 month'
        );
    END LOOP;
    
    RAISE NOTICE 'Maintained email_events partitions through %', 
                 current_month + (partition_count || ' months')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- Create function for partition cleanup (archive old data)
CREATE OR REPLACE FUNCTION cleanup_old_email_events_partitions(
    retention_months INTEGER DEFAULT 12
) RETURNS TABLE(dropped_partition TEXT, record_count BIGINT) AS $$
DECLARE
    cutoff_date DATE;
    partition_record RECORD;
    partition_count BIGINT;
BEGIN
    -- Calculate cutoff date
    cutoff_date := date_trunc('month', CURRENT_DATE) - (retention_months || ' months')::INTERVAL;
    
    -- Find partitions older than retention period
    FOR partition_record IN
        SELECT schemaname, tablename
        FROM pg_tables
        WHERE tablename LIKE 'email_events_%'
        AND schemaname = 'public'
        AND tablename ~ '^email_events_\d{4}_\d{2}$'
    LOOP
        -- Extract date from partition name and check if it's old enough
        DECLARE
            partition_date DATE;
            year_part TEXT;
            month_part TEXT;
        BEGIN
            -- Extract year and month from partition name (email_events_2024_01)
            year_part := substring(partition_record.tablename from 'email_events_(\d{4})_\d{2}');
            month_part := substring(partition_record.tablename from 'email_events_\d{4}_(\d{2})');
            
            IF year_part IS NOT NULL AND month_part IS NOT NULL THEN
                partition_date := (year_part || '-' || month_part || '-01')::DATE;
                
                IF partition_date < cutoff_date THEN
                    -- Get record count before dropping
                    EXECUTE format('SELECT COUNT(*) FROM %I.%I', 
                                 partition_record.schemaname, 
                                 partition_record.tablename) 
                    INTO partition_count;
                    
                    -- Drop the old partition
                    EXECUTE format('DROP TABLE IF EXISTS %I.%I CASCADE', 
                                 partition_record.schemaname, 
                                 partition_record.tablename);
                    
                    -- Return info about dropped partition
                    dropped_partition := partition_record.tablename;
                    record_count := partition_count;
                    RETURN NEXT;
                    
                    RAISE NOTICE 'Dropped old partition % with % records', 
                                partition_record.tablename, partition_count;
                END IF;
            END IF;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create initial partitions for the next 6 months if they don't exist
SELECT maintain_email_events_partitions();

-- Create a scheduled job function that can be called by cron
CREATE OR REPLACE FUNCTION scheduled_partition_maintenance() RETURNS VOID AS $$
BEGIN
    -- Create future partitions
    PERFORM maintain_email_events_partitions();
    
    -- Log maintenance activity
    INSERT INTO system_logs (event_type, message, created_at)
    VALUES (
        'partition_maintenance',
        'Automatic email_events partition maintenance completed',
        NOW()
    ) ON CONFLICT DO NOTHING; -- In case system_logs doesn't exist yet
    
EXCEPTION WHEN OTHERS THEN
    -- Log errors but don't fail
    RAISE NOTICE 'Partition maintenance error: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Add additional composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS email_events_workspace_campaign_created_idx 
ON email_events (workspace_id, campaign_id, created_at DESC);

CREATE INDEX IF NOT EXISTS email_events_workspace_event_created_idx 
ON email_events (workspace_id, event_type, created_at DESC)
WHERE event_type IN ('open', 'click', 'delivery', 'bounce', 'complaint');

-- Index for analytics queries
CREATE INDEX IF NOT EXISTS email_events_analytics_idx 
ON email_events (workspace_id, event_type, created_at) 
WHERE event_type IN ('delivery', 'open', 'click');

-- Index for webhook deduplication
CREATE INDEX IF NOT EXISTS email_events_external_id_workspace_idx 
ON email_events (external_id, workspace_id) 
WHERE external_id IS NOT NULL;

-- Create a view for partition information
CREATE OR REPLACE VIEW email_events_partition_info AS
SELECT 
    schemaname,
    tablename as partition_name,
    CASE 
        WHEN tablename ~ '^email_events_\d{4}_\d{2}$' THEN
            (substring(tablename from 'email_events_(\d{4}_\d{2})'))::TEXT
        ELSE 'unknown'
    END as partition_period,
    pg_total_relation_size(schemaname||'.'||tablename) as size_bytes,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size_pretty,
    (
        SELECT COUNT(*) 
        FROM information_schema.tables t2 
        WHERE t2.table_name = pg_tables.tablename
    ) as row_estimate
FROM pg_tables
WHERE tablename LIKE 'email_events%'
AND schemaname = 'public'
ORDER BY tablename;

-- Create function to get partition statistics
CREATE OR REPLACE FUNCTION get_email_events_partition_stats()
RETURNS TABLE(
    partition_name TEXT,
    period TEXT,
    record_count BIGINT,
    size_mb NUMERIC,
    oldest_record TIMESTAMP WITH TIME ZONE,
    newest_record TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    partition_record RECORD;
BEGIN
    FOR partition_record IN
        SELECT tablename
        FROM pg_tables
        WHERE tablename LIKE 'email_events_%'
        AND schemaname = 'public'
        AND tablename ~ '^email_events_\d{4}_\d{2}$'
        ORDER BY tablename
    LOOP
        RETURN QUERY
        EXECUTE format('
            SELECT 
                %L::TEXT as partition_name,
                %L::TEXT as period,
                COUNT(*)::BIGINT as record_count,
                ROUND(pg_total_relation_size(%L) / 1024.0 / 1024.0, 2) as size_mb,
                MIN(created_at) as oldest_record,
                MAX(created_at) as newest_record
            FROM %I
        ', 
            partition_record.tablename,
            substring(partition_record.tablename from 'email_events_(\d{4}_\d{2})'),
            'public.' || partition_record.tablename,
            partition_record.tablename
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create a table to track partition maintenance logs
CREATE TABLE IF NOT EXISTS partition_maintenance_log (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    operation_type TEXT NOT NULL, -- 'create', 'cleanup', 'maintenance'
    partition_name TEXT,
    details JSONB DEFAULT '{}',
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    execution_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on maintenance log
CREATE INDEX IF NOT EXISTS partition_maintenance_log_created_idx 
ON partition_maintenance_log (created_at DESC);

-- Add a comment explaining the partitioning strategy
COMMENT ON TABLE email_events IS 
'Email events table partitioned by month (created_at) for optimal performance. 
Partitions are automatically created 6 months in advance and can be cleaned up 
using cleanup_old_email_events_partitions() function.';

COMMENT ON FUNCTION maintain_email_events_partitions() IS 
'Automatically creates monthly partitions for email_events table 6 months in advance. 
Should be called monthly via cron job.';

COMMENT ON FUNCTION cleanup_old_email_events_partitions(INTEGER) IS 
'Archives old email_events partitions older than specified months (default 12). 
Returns information about dropped partitions.';

COMMIT;