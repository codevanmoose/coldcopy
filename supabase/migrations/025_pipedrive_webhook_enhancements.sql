-- UP
-- Enhanced webhook event tracking
CREATE TABLE IF NOT EXISTS pipedrive_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  webhook_id UUID REFERENCES pipedrive_webhooks(id) ON DELETE SET NULL,
  event_id TEXT NOT NULL UNIQUE, -- Pipedrive event ID for deduplication
  event_action VARCHAR(50) NOT NULL CHECK (event_action IN ('added', 'updated', 'deleted', 'merged')),
  event_object VARCHAR(50) NOT NULL CHECK (event_object IN ('person', 'organization', 'deal', 'activity', 'user', 'note', 'file', 'product', 'stage')),
  object_id INTEGER NOT NULL,
  retry_object JSONB, -- Full object data for retry
  current_data JSONB NOT NULL, -- Current state of object
  previous_data JSONB, -- Previous state for 'updated' events
  meta_data JSONB, -- Metadata from Pipedrive
  user_id INTEGER, -- Pipedrive user who triggered the event
  company_id INTEGER, -- Pipedrive company ID
  processed_at TIMESTAMP WITH TIME ZONE,
  processing_status VARCHAR(50) DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  next_retry_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  event_time TIMESTAMP WITH TIME ZONE NOT NULL -- When the event occurred in Pipedrive
);

-- Webhook signatures for verification
CREATE TABLE IF NOT EXISTS pipedrive_webhook_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  webhook_secret TEXT NOT NULL, -- Encrypted webhook secret
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  rotated_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(workspace_id, is_active) -- Only one active secret per workspace
);

-- Sync queue for bidirectional updates
CREATE TABLE IF NOT EXISTS pipedrive_sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  operation VARCHAR(50) NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
  entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('person', 'organization', 'deal', 'activity', 'note')),
  entity_id UUID NOT NULL, -- ColdCopy entity ID
  pipedrive_id INTEGER, -- Pipedrive ID if exists
  data JSONB NOT NULL, -- Data to sync
  field_mappings JSONB, -- Specific field mappings for this sync
  priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sync locks to prevent concurrent updates
CREATE TABLE IF NOT EXISTS pipedrive_sync_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(255) NOT NULL, -- Can be either ColdCopy or Pipedrive ID
  lock_type VARCHAR(50) NOT NULL CHECK (lock_type IN ('exclusive', 'shared')),
  locked_by UUID NOT NULL, -- Process/request ID that holds the lock
  locked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW() + INTERVAL '5 minutes',
  released_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(workspace_id, entity_type, entity_id, lock_type)
);

-- Webhook event routing rules
CREATE TABLE IF NOT EXISTS pipedrive_webhook_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  event_action VARCHAR(50) NOT NULL,
  event_object VARCHAR(50) NOT NULL,
  handler_name VARCHAR(255) NOT NULL, -- Handler function/service name
  handler_config JSONB DEFAULT '{}', -- Configuration for the handler
  filter_conditions JSONB DEFAULT '{}', -- Conditions to match events
  priority INTEGER DEFAULT 5,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sync metrics for monitoring
CREATE TABLE IF NOT EXISTS pipedrive_sync_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
  entity_type VARCHAR(50) NOT NULL,
  events_received INTEGER DEFAULT 0,
  events_processed INTEGER DEFAULT 0,
  events_failed INTEGER DEFAULT 0,
  sync_operations INTEGER DEFAULT 0,
  sync_conflicts INTEGER DEFAULT 0,
  avg_processing_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workspace_id, metric_date, entity_type)
);

-- Webhook subscription status tracking
CREATE TABLE IF NOT EXISTS pipedrive_webhook_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  webhook_url TEXT NOT NULL,
  last_event_at TIMESTAMP WITH TIME ZONE,
  last_error_at TIMESTAMP WITH TIME ZONE,
  last_error_message TEXT,
  consecutive_failures INTEGER DEFAULT 0,
  is_healthy BOOLEAN DEFAULT TRUE,
  health_check_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workspace_id, webhook_url)
);

-- Indexes for performance
CREATE INDEX idx_pipedrive_webhook_events_workspace ON pipedrive_webhook_events(workspace_id);
CREATE INDEX idx_pipedrive_webhook_events_status ON pipedrive_webhook_events(processing_status);
CREATE INDEX idx_pipedrive_webhook_events_created ON pipedrive_webhook_events(created_at DESC);
CREATE INDEX idx_pipedrive_webhook_events_event_time ON pipedrive_webhook_events(event_time DESC);
CREATE INDEX idx_pipedrive_webhook_events_object ON pipedrive_webhook_events(event_object, object_id);
CREATE INDEX idx_pipedrive_webhook_events_retry ON pipedrive_webhook_events(next_retry_at) WHERE processing_status = 'failed';

CREATE INDEX idx_pipedrive_sync_queue_workspace ON pipedrive_sync_queue(workspace_id);
CREATE INDEX idx_pipedrive_sync_queue_status ON pipedrive_sync_queue(status);
CREATE INDEX idx_pipedrive_sync_queue_scheduled ON pipedrive_sync_queue(scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_pipedrive_sync_queue_entity ON pipedrive_sync_queue(entity_type, entity_id);
CREATE INDEX idx_pipedrive_sync_queue_priority ON pipedrive_sync_queue(priority DESC, scheduled_at) WHERE status = 'pending';

CREATE INDEX idx_pipedrive_sync_locks_entity ON pipedrive_sync_locks(workspace_id, entity_type, entity_id);
CREATE INDEX idx_pipedrive_sync_locks_expires ON pipedrive_sync_locks(expires_at) WHERE released_at IS NULL;

CREATE INDEX idx_pipedrive_webhook_routes_workspace ON pipedrive_webhook_routes(workspace_id);
CREATE INDEX idx_pipedrive_webhook_routes_event ON pipedrive_webhook_routes(event_action, event_object) WHERE is_active = TRUE;

CREATE INDEX idx_pipedrive_sync_metrics_workspace ON pipedrive_sync_metrics(workspace_id, metric_date DESC);

-- Enable RLS
ALTER TABLE pipedrive_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipedrive_webhook_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipedrive_sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipedrive_sync_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipedrive_webhook_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipedrive_sync_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipedrive_webhook_status ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY pipedrive_webhook_events_select ON pipedrive_webhook_events
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY pipedrive_webhook_events_insert ON pipedrive_webhook_events
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY pipedrive_webhook_signatures_all ON pipedrive_webhook_signatures
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY pipedrive_sync_queue_select ON pipedrive_sync_queue
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY pipedrive_sync_queue_all ON pipedrive_sync_queue
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY pipedrive_sync_locks_all ON pipedrive_sync_locks
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY pipedrive_webhook_routes_select ON pipedrive_webhook_routes
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY pipedrive_webhook_routes_all ON pipedrive_webhook_routes
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY pipedrive_sync_metrics_select ON pipedrive_sync_metrics
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY pipedrive_webhook_status_select ON pipedrive_webhook_status
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
    )
  );

-- Functions for webhook processing

-- Function to acquire a sync lock
CREATE OR REPLACE FUNCTION acquire_pipedrive_sync_lock(
  p_workspace_id UUID,
  p_entity_type VARCHAR(50),
  p_entity_id VARCHAR(255),
  p_lock_type VARCHAR(50),
  p_locked_by UUID,
  p_duration_minutes INTEGER DEFAULT 5
)
RETURNS BOOLEAN AS $$
DECLARE
  v_lock_acquired BOOLEAN := FALSE;
BEGIN
  -- Try to acquire the lock
  INSERT INTO pipedrive_sync_locks (
    workspace_id,
    entity_type,
    entity_id,
    lock_type,
    locked_by,
    expires_at
  )
  VALUES (
    p_workspace_id,
    p_entity_type,
    p_entity_id,
    p_lock_type,
    p_locked_by,
    NOW() + (p_duration_minutes || ' minutes')::INTERVAL
  )
  ON CONFLICT (workspace_id, entity_type, entity_id, lock_type)
  DO NOTHING;
  
  -- Check if we got the lock
  SELECT EXISTS (
    SELECT 1 FROM pipedrive_sync_locks
    WHERE workspace_id = p_workspace_id
      AND entity_type = p_entity_type
      AND entity_id = p_entity_id
      AND lock_type = p_lock_type
      AND locked_by = p_locked_by
      AND released_at IS NULL
      AND expires_at > NOW()
  ) INTO v_lock_acquired;
  
  RETURN v_lock_acquired;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to release a sync lock
CREATE OR REPLACE FUNCTION release_pipedrive_sync_lock(
  p_workspace_id UUID,
  p_entity_type VARCHAR(50),
  p_entity_id VARCHAR(255),
  p_locked_by UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_rows_updated INTEGER;
BEGIN
  UPDATE pipedrive_sync_locks
  SET released_at = NOW()
  WHERE workspace_id = p_workspace_id
    AND entity_type = p_entity_type
    AND entity_id = p_entity_id
    AND locked_by = p_locked_by
    AND released_at IS NULL;
  
  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  
  RETURN v_rows_updated > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up expired locks
CREATE OR REPLACE FUNCTION cleanup_expired_pipedrive_locks()
RETURNS INTEGER AS $$
DECLARE
  v_rows_updated INTEGER;
BEGIN
  UPDATE pipedrive_sync_locks
  SET released_at = NOW()
  WHERE expires_at < NOW()
    AND released_at IS NULL;
  
  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  
  RETURN v_rows_updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update sync metrics
CREATE OR REPLACE FUNCTION update_pipedrive_sync_metrics(
  p_workspace_id UUID,
  p_entity_type VARCHAR(50),
  p_events_received INTEGER DEFAULT 0,
  p_events_processed INTEGER DEFAULT 0,
  p_events_failed INTEGER DEFAULT 0,
  p_sync_operations INTEGER DEFAULT 0,
  p_sync_conflicts INTEGER DEFAULT 0,
  p_processing_time_ms INTEGER DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO pipedrive_sync_metrics (
    workspace_id,
    entity_type,
    events_received,
    events_processed,
    events_failed,
    sync_operations,
    sync_conflicts,
    avg_processing_time_ms
  )
  VALUES (
    p_workspace_id,
    p_entity_type,
    p_events_received,
    p_events_processed,
    p_events_failed,
    p_sync_operations,
    p_sync_conflicts,
    p_processing_time_ms
  )
  ON CONFLICT (workspace_id, metric_date, entity_type)
  DO UPDATE SET
    events_received = pipedrive_sync_metrics.events_received + EXCLUDED.events_received,
    events_processed = pipedrive_sync_metrics.events_processed + EXCLUDED.events_processed,
    events_failed = pipedrive_sync_metrics.events_failed + EXCLUDED.events_failed,
    sync_operations = pipedrive_sync_metrics.sync_operations + EXCLUDED.sync_operations,
    sync_conflicts = pipedrive_sync_metrics.sync_conflicts + EXCLUDED.sync_conflicts,
    avg_processing_time_ms = CASE
      WHEN pipedrive_sync_metrics.avg_processing_time_ms IS NULL THEN EXCLUDED.avg_processing_time_ms
      WHEN EXCLUDED.avg_processing_time_ms IS NULL THEN pipedrive_sync_metrics.avg_processing_time_ms
      ELSE (pipedrive_sync_metrics.avg_processing_time_ms + EXCLUDED.avg_processing_time_ms) / 2
    END,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get next items from sync queue
CREATE OR REPLACE FUNCTION get_next_pipedrive_sync_items(
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  queue_id UUID,
  workspace_id UUID,
  operation VARCHAR(50),
  entity_type VARCHAR(50),
  entity_id UUID,
  pipedrive_id INTEGER,
  data JSONB,
  field_mappings JSONB
) AS $$
BEGIN
  RETURN QUERY
  UPDATE pipedrive_sync_queue
  SET 
    status = 'processing',
    processed_at = NOW(),
    retry_count = retry_count + 1
  WHERE id IN (
    SELECT id
    FROM pipedrive_sync_queue
    WHERE status = 'pending'
      AND scheduled_at <= NOW()
      AND retry_count < max_retries
    ORDER BY priority DESC, scheduled_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING 
    id,
    pipedrive_sync_queue.workspace_id,
    pipedrive_sync_queue.operation,
    pipedrive_sync_queue.entity_type,
    pipedrive_sync_queue.entity_id,
    pipedrive_sync_queue.pipedrive_id,
    pipedrive_sync_queue.data,
    pipedrive_sync_queue.field_mappings;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers
CREATE TRIGGER update_pipedrive_webhook_signatures_updated_at
  BEFORE UPDATE ON pipedrive_webhook_signatures
  FOR EACH ROW
  EXECUTE FUNCTION update_pipedrive_updated_at();

CREATE TRIGGER update_pipedrive_sync_queue_updated_at
  BEFORE UPDATE ON pipedrive_sync_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_pipedrive_updated_at();

CREATE TRIGGER update_pipedrive_webhook_routes_updated_at
  BEFORE UPDATE ON pipedrive_webhook_routes
  FOR EACH ROW
  EXECUTE FUNCTION update_pipedrive_updated_at();

CREATE TRIGGER update_pipedrive_sync_metrics_updated_at
  BEFORE UPDATE ON pipedrive_sync_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_pipedrive_updated_at();

CREATE TRIGGER update_pipedrive_webhook_status_updated_at
  BEFORE UPDATE ON pipedrive_webhook_status
  FOR EACH ROW
  EXECUTE FUNCTION update_pipedrive_updated_at();

-- DOWN
DROP FUNCTION IF EXISTS get_next_pipedrive_sync_items(INTEGER);
DROP FUNCTION IF EXISTS update_pipedrive_sync_metrics(UUID, VARCHAR, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS cleanup_expired_pipedrive_locks();
DROP FUNCTION IF EXISTS release_pipedrive_sync_lock(UUID, VARCHAR, VARCHAR, UUID);
DROP FUNCTION IF EXISTS acquire_pipedrive_sync_lock(UUID, VARCHAR, VARCHAR, VARCHAR, UUID, INTEGER);

DROP TRIGGER IF EXISTS update_pipedrive_webhook_status_updated_at ON pipedrive_webhook_status;
DROP TRIGGER IF EXISTS update_pipedrive_sync_metrics_updated_at ON pipedrive_sync_metrics;
DROP TRIGGER IF EXISTS update_pipedrive_webhook_routes_updated_at ON pipedrive_webhook_routes;
DROP TRIGGER IF EXISTS update_pipedrive_sync_queue_updated_at ON pipedrive_sync_queue;
DROP TRIGGER IF EXISTS update_pipedrive_webhook_signatures_updated_at ON pipedrive_webhook_signatures;

DROP POLICY IF EXISTS pipedrive_webhook_status_select ON pipedrive_webhook_status;
DROP POLICY IF EXISTS pipedrive_sync_metrics_select ON pipedrive_sync_metrics;
DROP POLICY IF EXISTS pipedrive_webhook_routes_all ON pipedrive_webhook_routes;
DROP POLICY IF EXISTS pipedrive_webhook_routes_select ON pipedrive_webhook_routes;
DROP POLICY IF EXISTS pipedrive_sync_locks_all ON pipedrive_sync_locks;
DROP POLICY IF EXISTS pipedrive_sync_queue_all ON pipedrive_sync_queue;
DROP POLICY IF EXISTS pipedrive_sync_queue_select ON pipedrive_sync_queue;
DROP POLICY IF EXISTS pipedrive_webhook_signatures_all ON pipedrive_webhook_signatures;
DROP POLICY IF EXISTS pipedrive_webhook_events_insert ON pipedrive_webhook_events;
DROP POLICY IF EXISTS pipedrive_webhook_events_select ON pipedrive_webhook_events;

DROP INDEX IF EXISTS idx_pipedrive_sync_metrics_workspace;
DROP INDEX IF EXISTS idx_pipedrive_webhook_routes_event;
DROP INDEX IF EXISTS idx_pipedrive_webhook_routes_workspace;
DROP INDEX IF EXISTS idx_pipedrive_sync_locks_expires;
DROP INDEX IF EXISTS idx_pipedrive_sync_locks_entity;
DROP INDEX IF EXISTS idx_pipedrive_sync_queue_priority;
DROP INDEX IF EXISTS idx_pipedrive_sync_queue_entity;
DROP INDEX IF EXISTS idx_pipedrive_sync_queue_scheduled;
DROP INDEX IF EXISTS idx_pipedrive_sync_queue_status;
DROP INDEX IF EXISTS idx_pipedrive_sync_queue_workspace;
DROP INDEX IF EXISTS idx_pipedrive_webhook_events_retry;
DROP INDEX IF EXISTS idx_pipedrive_webhook_events_object;
DROP INDEX IF EXISTS idx_pipedrive_webhook_events_event_time;
DROP INDEX IF EXISTS idx_pipedrive_webhook_events_created;
DROP INDEX IF EXISTS idx_pipedrive_webhook_events_status;
DROP INDEX IF EXISTS idx_pipedrive_webhook_events_workspace;

DROP TABLE IF EXISTS pipedrive_webhook_status;
DROP TABLE IF EXISTS pipedrive_sync_metrics;
DROP TABLE IF EXISTS pipedrive_webhook_routes;
DROP TABLE IF EXISTS pipedrive_sync_locks;
DROP TABLE IF EXISTS pipedrive_sync_queue;
DROP TABLE IF EXISTS pipedrive_webhook_signatures;
DROP TABLE IF EXISTS pipedrive_webhook_events;