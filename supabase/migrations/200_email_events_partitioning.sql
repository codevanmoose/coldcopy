-- Email Events Table Partitioning
-- Partition by month for efficient data management and query performance

-- First, rename the existing table to preserve data
ALTER TABLE email_events RENAME TO email_events_old;

-- Create new partitioned table
CREATE TABLE email_events (
    id UUID DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    email_id UUID REFERENCES campaign_emails(id) ON DELETE SET NULL,
    
    -- Event information
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB DEFAULT '{}',
    
    -- Email provider information
    provider_message_id VARCHAR(255),
    provider_response JSONB,
    
    -- Tracking
    ip_address INET,
    user_agent TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT email_events_pkey PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create indexes on the partitioned table
CREATE INDEX idx_email_events_workspace_created ON email_events (workspace_id, created_at DESC);
CREATE INDEX idx_email_events_campaign_created ON email_events (campaign_id, created_at DESC);
CREATE INDEX idx_email_events_lead_created ON email_events (lead_id, created_at DESC);
CREATE INDEX idx_email_events_email_id ON email_events (email_id) WHERE email_id IS NOT NULL;
CREATE INDEX idx_email_events_event_type ON email_events (event_type, created_at DESC);
CREATE INDEX idx_email_events_created_at ON email_events (created_at DESC);

-- Create function to automatically create monthly partitions
CREATE OR REPLACE FUNCTION create_monthly_partition(table_name text, start_date date)
RETURNS void AS $$
DECLARE
    partition_name text;
    start_date_str text;
    end_date_str text;
BEGIN
    partition_name := table_name || '_' || to_char(start_date, 'YYYY_MM');
    start_date_str := to_char(start_date, 'YYYY-MM-DD');
    end_date_str := to_char((start_date + interval '1 month')::date, 'YYYY-MM-DD');
    
    -- Check if partition already exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = partition_name
    ) THEN
        EXECUTE format(
            'CREATE TABLE %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
            partition_name, table_name, start_date_str, end_date_str
        );
        
        -- Add partition-specific indexes if needed
        EXECUTE format(
            'CREATE INDEX %I ON %I (workspace_id, event_type)',
            partition_name || '_workspace_event_idx',
            partition_name
        );
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create partitions for the last 6 months and next 3 months
DO $$
DECLARE
    current_date date := date_trunc('month', CURRENT_DATE - interval '6 months');
    end_date date := date_trunc('month', CURRENT_DATE + interval '3 months');
BEGIN
    WHILE current_date < end_date LOOP
        PERFORM create_monthly_partition('email_events', current_date);
        current_date := current_date + interval '1 month';
    END LOOP;
END $$;

-- Migrate data from old table to partitioned table
INSERT INTO email_events 
SELECT * FROM email_events_old;

-- Verify data migration
DO $$
DECLARE
    old_count bigint;
    new_count bigint;
BEGIN
    SELECT COUNT(*) INTO old_count FROM email_events_old;
    SELECT COUNT(*) INTO new_count FROM email_events;
    
    IF old_count != new_count THEN
        RAISE EXCEPTION 'Data migration failed. Old count: %, New count: %', old_count, new_count;
    END IF;
END $$;

-- Drop old table
DROP TABLE email_events_old CASCADE;

-- Create automated partition management function
CREATE OR REPLACE FUNCTION maintain_email_event_partitions()
RETURNS void AS $$
DECLARE
    months_to_keep integer := 12; -- Keep 12 months of data
    months_ahead integer := 3; -- Create partitions 3 months ahead
    current_partition date;
    oldest_partition text;
    newest_partition date;
BEGIN
    -- Create future partitions
    current_partition := date_trunc('month', CURRENT_DATE);
    FOR i IN 1..months_ahead LOOP
        PERFORM create_monthly_partition('email_events', current_partition);
        current_partition := current_partition + interval '1 month';
    END LOOP;
    
    -- Drop old partitions (older than months_to_keep)
    FOR oldest_partition IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename LIKE 'email_events_%'
        AND tablename < 'email_events_' || to_char(CURRENT_DATE - interval '1 month' * months_to_keep, 'YYYY_MM')
        ORDER BY tablename
    LOOP
        -- Archive partition data before dropping (optional)
        -- You could copy to an archive table or export to S3 here
        
        EXECUTE format('DROP TABLE %I', oldest_partition);
        RAISE NOTICE 'Dropped old partition: %', oldest_partition;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create RLS policies for partitioned table
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace isolation for email events" ON email_events
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id 
            FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

-- Create a scheduled job to maintain partitions (to be called by external scheduler)
-- This function should be called monthly by a cron job or pg_cron
CREATE OR REPLACE FUNCTION schedule_partition_maintenance()
RETURNS void AS $$
BEGIN
    PERFORM maintain_email_event_partitions();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT SELECT, INSERT ON email_events TO authenticated;
GRANT EXECUTE ON FUNCTION schedule_partition_maintenance() TO service_role;

-- Add constraint exclusion for better query planning
ALTER DATABASE postgres SET constraint_exclusion = partition;