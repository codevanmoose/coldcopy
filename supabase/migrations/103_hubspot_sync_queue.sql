-- HubSpot Sync Queue
-- Manages asynchronous sync operations with retry logic

CREATE TABLE hubspot_sync_queue (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Operation details
    object_type VARCHAR(50) NOT NULL CHECK (object_type IN ('contacts', 'companies', 'deals', 'activities')),
    operation VARCHAR(20) NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
    direction VARCHAR(20) NOT NULL CHECK (direction IN ('to_hubspot', 'from_hubspot')),
    
    -- Priority and scheduling
    priority INTEGER NOT NULL DEFAULT 100, -- Lower number = higher priority
    data JSONB NOT NULL DEFAULT '{}', -- Operation-specific data
    
    -- Retry logic
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 5,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    
    -- Status tracking
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,
    
    -- Timing
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Prevent duplicate operations
    UNIQUE(workspace_id, object_type, operation, data)
);

-- Indexes for efficient queue processing
CREATE INDEX idx_hubspot_sync_queue_workspace ON hubspot_sync_queue(workspace_id);
CREATE INDEX idx_hubspot_sync_queue_processing ON hubspot_sync_queue(workspace_id, status, priority, created_at) 
    WHERE status = 'pending';
CREATE INDEX idx_hubspot_sync_queue_retry ON hubspot_sync_queue(workspace_id, status, next_retry_at) 
    WHERE status = 'pending' AND next_retry_at IS NOT NULL;
CREATE INDEX idx_hubspot_sync_queue_cleanup ON hubspot_sync_queue(status, updated_at) 
    WHERE status IN ('completed', 'failed');

-- RLS policies
ALTER TABLE hubspot_sync_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace isolation for sync queue" ON hubspot_sync_queue
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id 
            FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_hubspot_sync_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_hubspot_sync_queue_updated_at
    BEFORE UPDATE ON hubspot_sync_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_hubspot_sync_queue_updated_at();

-- Function to get next queue items for processing
CREATE OR REPLACE FUNCTION get_next_sync_queue_items(
    p_workspace_id UUID,
    p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    object_type VARCHAR(50),
    operation VARCHAR(20),
    direction VARCHAR(20),
    priority INTEGER,
    data JSONB,
    retry_count INTEGER,
    max_retries INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sq.id,
        sq.object_type,
        sq.operation,
        sq.direction,
        sq.priority,
        sq.data,
        sq.retry_count,
        sq.max_retries
    FROM hubspot_sync_queue sq
    WHERE sq.workspace_id = p_workspace_id
      AND sq.status = 'pending'
      AND (sq.next_retry_at IS NULL OR sq.next_retry_at <= NOW())
    ORDER BY sq.priority ASC, sq.created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED; -- Prevent concurrent processing of same items
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get sync queue statistics
CREATE OR REPLACE FUNCTION get_sync_queue_stats(p_workspace_id UUID)
RETURNS TABLE (
    status VARCHAR(20),
    count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sq.status,
        COUNT(*) as count
    FROM hubspot_sync_queue sq
    WHERE sq.workspace_id = p_workspace_id
    GROUP BY sq.status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup old queue items
CREATE OR REPLACE FUNCTION cleanup_sync_queue(
    p_workspace_id UUID,
    p_days_old INTEGER DEFAULT 7
)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM hubspot_sync_queue
    WHERE workspace_id = p_workspace_id
      AND status IN ('completed', 'failed')
      AND updated_at < NOW() - INTERVAL '1 day' * p_days_old;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to retry failed items
CREATE OR REPLACE FUNCTION retry_failed_sync_items(
    p_workspace_id UUID,
    p_max_age_hours INTEGER DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE hubspot_sync_queue
    SET 
        status = 'pending',
        retry_count = 0,
        next_retry_at = NULL,
        error_message = NULL,
        updated_at = NOW()
    WHERE workspace_id = p_workspace_id
      AND status = 'failed'
      AND (p_max_age_hours IS NULL OR created_at > NOW() - INTERVAL '1 hour' * p_max_age_hours);
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_next_sync_queue_items(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_sync_queue_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_sync_queue(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION retry_failed_sync_items(UUID, INTEGER) TO authenticated;

-- Automated cleanup job (runs daily)
-- This would typically be handled by a cron job or background worker
-- For demonstration, we'll create a function that can be called manually

CREATE OR REPLACE FUNCTION auto_cleanup_sync_queues()
RETURNS TEXT AS $$
DECLARE
    workspace_record RECORD;
    total_cleaned INTEGER := 0;
    cleaned_count INTEGER;
BEGIN
    -- Clean up for all workspaces
    FOR workspace_record IN 
        SELECT id FROM workspaces WHERE deleted_at IS NULL
    LOOP
        SELECT cleanup_sync_queue(workspace_record.id, 7) INTO cleaned_count;
        total_cleaned := total_cleaned + cleaned_count;
    END LOOP;
    
    RETURN 'Cleaned up ' || total_cleaned || ' old sync queue items';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;