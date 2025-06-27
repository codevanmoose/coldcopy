-- UP
-- Webhook subscription configuration
CREATE TABLE IF NOT EXISTS hubspot_webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  property_name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Webhook event logs
CREATE TABLE IF NOT EXISTS hubspot_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  portal_id TEXT NOT NULL,
  object_id TEXT NOT NULL,
  occurred_at TIMESTAMP NOT NULL,
  event_data JSONB NOT NULL,
  processed_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Webhook processing errors
CREATE TABLE IF NOT EXISTS hubspot_webhook_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  event_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Import queue for new contacts from webhooks
CREATE TABLE IF NOT EXISTS hubspot_import_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  hubspot_contact_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  attempts INTEGER DEFAULT 0,
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Engagement event log
CREATE TABLE IF NOT EXISTS hubspot_engagement_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  engagement_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  property_name TEXT,
  property_value JSONB,
  occurred_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_webhook_subscriptions_workspace ON hubspot_webhook_subscriptions(workspace_id);
CREATE INDEX idx_webhook_logs_event ON hubspot_webhook_logs(event_id);
CREATE INDEX idx_webhook_logs_portal ON hubspot_webhook_logs(portal_id);
CREATE INDEX idx_webhook_logs_occurred ON hubspot_webhook_logs(occurred_at DESC);
CREATE INDEX idx_webhook_errors_created ON hubspot_webhook_errors(created_at DESC);
CREATE INDEX idx_import_queue_status ON hubspot_import_queue(workspace_id, status);
CREATE INDEX idx_engagement_log_workspace ON hubspot_engagement_log(workspace_id, occurred_at DESC);

-- RLS Policies
ALTER TABLE hubspot_webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hubspot_import_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE hubspot_engagement_log ENABLE ROW LEVEL SECURITY;

-- Webhook subscriptions policies
CREATE POLICY webhook_subscriptions_select ON hubspot_webhook_subscriptions
  FOR SELECT USING (workspace_id IN (
    SELECT workspace_id FROM workspace_users WHERE user_id = auth.uid()
  ));

CREATE POLICY webhook_subscriptions_insert ON hubspot_webhook_subscriptions
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY webhook_subscriptions_update ON hubspot_webhook_subscriptions
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Import queue policies
CREATE POLICY import_queue_select ON hubspot_import_queue
  FOR SELECT USING (workspace_id IN (
    SELECT workspace_id FROM workspace_users WHERE user_id = auth.uid()
  ));

CREATE POLICY import_queue_insert ON hubspot_import_queue
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Engagement log policies
CREATE POLICY engagement_log_select ON hubspot_engagement_log
  FOR SELECT USING (workspace_id IN (
    SELECT workspace_id FROM workspace_users WHERE user_id = auth.uid()
  ));

-- Function to process import queue
CREATE OR REPLACE FUNCTION process_hubspot_import_queue()
RETURNS TABLE (
  queue_id UUID,
  workspace_id UUID,
  hubspot_contact_id TEXT
) AS $$
BEGIN
  RETURN QUERY
  UPDATE hubspot_import_queue
  SET 
    status = 'processing',
    attempts = attempts + 1
  WHERE id IN (
    SELECT id 
    FROM hubspot_import_queue
    WHERE status = 'pending'
    AND attempts < 3
    ORDER BY created_at
    LIMIT 10
    FOR UPDATE SKIP LOCKED
  )
  RETURNING id, hubspot_import_queue.workspace_id, hubspot_import_queue.hubspot_contact_id;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old webhook logs
CREATE OR REPLACE FUNCTION cleanup_old_webhook_logs()
RETURNS void AS $$
BEGIN
  -- Delete logs older than 30 days
  DELETE FROM hubspot_webhook_logs 
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  -- Delete error logs older than 90 days
  DELETE FROM hubspot_webhook_errors 
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  -- Delete processed import queue items older than 7 days
  DELETE FROM hubspot_import_queue 
  WHERE status IN ('completed', 'failed') 
  AND processed_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- DOWN
DROP FUNCTION IF EXISTS cleanup_old_webhook_logs();
DROP FUNCTION IF EXISTS process_hubspot_import_queue();

DROP POLICY IF EXISTS engagement_log_select ON hubspot_engagement_log;
DROP POLICY IF EXISTS import_queue_insert ON hubspot_import_queue;
DROP POLICY IF EXISTS import_queue_select ON hubspot_import_queue;
DROP POLICY IF EXISTS webhook_subscriptions_update ON hubspot_webhook_subscriptions;
DROP POLICY IF EXISTS webhook_subscriptions_insert ON hubspot_webhook_subscriptions;
DROP POLICY IF EXISTS webhook_subscriptions_select ON hubspot_webhook_subscriptions;

DROP INDEX IF EXISTS idx_engagement_log_workspace;
DROP INDEX IF EXISTS idx_import_queue_status;
DROP INDEX IF EXISTS idx_webhook_errors_created;
DROP INDEX IF EXISTS idx_webhook_logs_occurred;
DROP INDEX IF EXISTS idx_webhook_logs_portal;
DROP INDEX IF EXISTS idx_webhook_logs_event;
DROP INDEX IF EXISTS idx_webhook_subscriptions_workspace;

DROP TABLE IF EXISTS hubspot_engagement_log;
DROP TABLE IF EXISTS hubspot_import_queue;
DROP TABLE IF EXISTS hubspot_webhook_errors;
DROP TABLE IF EXISTS hubspot_webhook_logs;
DROP TABLE IF EXISTS hubspot_webhook_subscriptions;