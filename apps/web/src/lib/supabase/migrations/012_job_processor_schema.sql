-- ====================================
-- Job Processing System Schema
-- ====================================

-- Create enrichment jobs table
CREATE TABLE IF NOT EXISTS enrichment_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'single_lead_enrichment',
    'batch_lead_enrichment',
    'email_validation',
    'company_data_update',
    'social_profile_discovery'
  )),
  priority INTEGER NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'queued',
    'in_progress',
    'completed',
    'failed',
    'retrying',
    'dead_letter'
  )),
  payload JSONB NOT NULL DEFAULT '{}',
  result JSONB,
  error_message TEXT,
  error_code TEXT,
  error_stack TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  webhook_url TEXT,
  tags TEXT[] DEFAULT '{}',
  
  -- Indexes for efficient querying
  INDEX idx_enrichment_jobs_workspace_status (workspace_id, status),
  INDEX idx_enrichment_jobs_status_priority (status, priority),
  INDEX idx_enrichment_jobs_type_status (type, status),
  INDEX idx_enrichment_jobs_scheduled_at (scheduled_at) WHERE scheduled_at IS NOT NULL,
  INDEX idx_enrichment_jobs_created_at (created_at),
  INDEX idx_enrichment_jobs_tags (tags) USING GIN
);

-- Create worker tracking table
CREATE TABLE IF NOT EXISTS enrichment_workers (
  worker_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'healthy' CHECK (status IN ('healthy', 'degraded', 'unhealthy')),
  last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uptime BIGINT NOT NULL DEFAULT 0,
  processed_jobs INTEGER NOT NULL DEFAULT 0,
  current_load DECIMAL(3,2) NOT NULL DEFAULT 0.0 CHECK (current_load BETWEEN 0.0 AND 1.0),
  memory_usage DECIMAL(10,2) NOT NULL DEFAULT 0.0,
  version TEXT NOT NULL DEFAULT '1.0.0',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  INDEX idx_enrichment_workers_status (status),
  INDEX idx_enrichment_workers_heartbeat (last_heartbeat)
);

-- Create webhook tracking table
CREATE TABLE IF NOT EXISTS enrichment_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  job_id UUID REFERENCES enrichment_jobs(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  INDEX idx_enrichment_webhooks_provider (provider_id),
  INDEX idx_enrichment_webhooks_job (job_id),
  INDEX idx_enrichment_webhooks_active (is_active)
);

-- Create job metrics materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS enrichment_job_metrics AS
SELECT
  COUNT(*) as total_jobs,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_jobs,
  COUNT(*) FILTER (WHERE status = 'queued') as queued_jobs,
  COUNT(*) FILTER (WHERE status = 'in_progress') as running_jobs,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_jobs,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_jobs,
  COUNT(*) FILTER (WHERE status = 'dead_letter') as dead_letter_jobs,
  COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000) FILTER (WHERE completed_at IS NOT NULL AND started_at IS NOT NULL), 0) as average_processing_time_ms,
  COALESCE(COUNT(*) FILTER (WHERE status = 'completed')::DECIMAL / NULLIF(COUNT(*) FILTER (WHERE status IN ('completed', 'failed', 'dead_letter')), 0), 0) as success_rate,
  COALESCE(COUNT(*) FILTER (WHERE status = 'failed')::DECIMAL / NULLIF(COUNT(*) FILTER (WHERE status IN ('completed', 'failed', 'dead_letter')), 0), 0) as error_rate,
  COUNT(*) FILTER (WHERE status IN ('pending', 'queued', 'retrying')) as queue_depth,
  COALESCE(COUNT(*) FILTER (WHERE completed_at >= NOW() - INTERVAL '1 hour'), 0) as hourly_throughput,
  NOW() as computed_at
FROM enrichment_jobs
WHERE created_at >= NOW() - INTERVAL '30 days';

-- Create unique index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_enrichment_job_metrics_computed_at ON enrichment_job_metrics (computed_at);

-- ====================================
-- Functions and Procedures
-- ====================================

-- Function to get job metrics
CREATE OR REPLACE FUNCTION get_job_metrics()
RETURNS TABLE (
  total_jobs BIGINT,
  pending_jobs BIGINT,
  running_jobs BIGINT,
  completed_jobs BIGINT,
  failed_jobs BIGINT,
  dead_letter_jobs BIGINT,
  average_processing_time DECIMAL,
  success_rate DECIMAL,
  throughput DECIMAL,
  error_rate DECIMAL,
  queue_depth BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.total_jobs,
    m.pending_jobs,
    m.running_jobs::BIGINT,
    m.completed_jobs,
    m.failed_jobs,
    m.dead_letter_jobs,
    m.average_processing_time_ms / 1000.0 as average_processing_time,
    m.success_rate,
    m.hourly_throughput::DECIMAL as throughput,
    m.error_rate,
    m.queue_depth
  FROM enrichment_job_metrics m
  ORDER BY m.computed_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get workspace-specific job metrics
CREATE OR REPLACE FUNCTION get_workspace_job_metrics(p_workspace_id UUID)
RETURNS TABLE (
  total_jobs BIGINT,
  pending_jobs BIGINT,
  running_jobs BIGINT,
  completed_jobs BIGINT,
  failed_jobs BIGINT,
  dead_letter_jobs BIGINT,
  average_processing_time DECIMAL,
  success_rate DECIMAL,
  error_rate DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) as total_jobs,
    COUNT(*) FILTER (WHERE j.status = 'pending') as pending_jobs,
    COUNT(*) FILTER (WHERE j.status = 'in_progress') as running_jobs,
    COUNT(*) FILTER (WHERE j.status = 'completed') as completed_jobs,
    COUNT(*) FILTER (WHERE j.status = 'failed') as failed_jobs,
    COUNT(*) FILTER (WHERE j.status = 'dead_letter') as dead_letter_jobs,
    COALESCE(AVG(EXTRACT(EPOCH FROM (j.completed_at - j.started_at))), 0) as average_processing_time,
    COALESCE(COUNT(*) FILTER (WHERE j.status = 'completed')::DECIMAL / NULLIF(COUNT(*) FILTER (WHERE j.status IN ('completed', 'failed', 'dead_letter')), 0), 0) as success_rate,
    COALESCE(COUNT(*) FILTER (WHERE j.status = 'failed')::DECIMAL / NULLIF(COUNT(*) FILTER (WHERE j.status IN ('completed', 'failed', 'dead_letter')), 0), 0) as error_rate
  FROM enrichment_jobs j
  WHERE j.workspace_id = p_workspace_id
    AND j.created_at >= NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup old jobs
CREATE OR REPLACE FUNCTION cleanup_old_jobs(older_than_days INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM enrichment_jobs
  WHERE status IN ('completed', 'failed')
    AND completed_at < NOW() - (older_than_days || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup dead workers
CREATE OR REPLACE FUNCTION cleanup_dead_workers()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM enrichment_workers
  WHERE last_heartbeat < NOW() - INTERVAL '5 minutes';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get next job for processing
CREATE OR REPLACE FUNCTION get_next_job_for_processing()
RETURNS TABLE (
  job_id UUID,
  workspace_id UUID,
  job_type TEXT,
  priority INTEGER,
  payload JSONB,
  retry_count INTEGER,
  max_retries INTEGER
) AS $$
DECLARE
  selected_job_id UUID;
BEGIN
  -- Select and lock the next job
  SELECT j.id INTO selected_job_id
  FROM enrichment_jobs j
  WHERE j.status IN ('pending', 'queued')
    AND (j.scheduled_at IS NULL OR j.scheduled_at <= NOW())
  ORDER BY j.priority ASC, j.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;
  
  -- If no job found, return empty
  IF selected_job_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Update job status to in_progress
  UPDATE enrichment_jobs
  SET 
    status = 'in_progress',
    started_at = NOW(),
    updated_at = NOW()
  WHERE id = selected_job_id;
  
  -- Return job details
  RETURN QUERY
  SELECT 
    j.id,
    j.workspace_id,
    j.type,
    j.priority,
    j.payload,
    j.retry_count,
    j.max_retries
  FROM enrichment_jobs j
  WHERE j.id = selected_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark job as completed
CREATE OR REPLACE FUNCTION complete_job(
  p_job_id UUID,
  p_result JSONB DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  updated_rows INTEGER;
BEGIN
  UPDATE enrichment_jobs
  SET 
    status = 'completed',
    result = p_result,
    completed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_job_id
    AND status = 'in_progress';
  
  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  RETURN updated_rows > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark job as failed
CREATE OR REPLACE FUNCTION fail_job(
  p_job_id UUID,
  p_error_message TEXT,
  p_error_code TEXT DEFAULT NULL,
  p_error_stack TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  updated_rows INTEGER;
  current_retry_count INTEGER;
  max_retry_count INTEGER;
BEGIN
  -- Get current retry information
  SELECT retry_count, max_retries INTO current_retry_count, max_retry_count
  FROM enrichment_jobs
  WHERE id = p_job_id;
  
  -- Determine final status based on retry count
  IF current_retry_count >= max_retry_count THEN
    -- Move to dead letter queue
    UPDATE enrichment_jobs
    SET 
      status = 'dead_letter',
      error_message = p_error_message,
      error_code = p_error_code,
      error_stack = p_error_stack,
      completed_at = NOW(),
      updated_at = NOW()
    WHERE id = p_job_id
      AND status = 'in_progress';
  ELSE
    -- Mark as failed for retry
    UPDATE enrichment_jobs
    SET 
      status = 'failed',
      error_message = p_error_message,
      error_code = p_error_code,
      error_stack = p_error_stack,
      completed_at = NOW(),
      updated_at = NOW()
    WHERE id = p_job_id
      AND status = 'in_progress';
  END IF;
  
  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  RETURN updated_rows > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================
-- Triggers
-- ====================================

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to jobs table
DROP TRIGGER IF EXISTS update_enrichment_jobs_updated_at ON enrichment_jobs;
CREATE TRIGGER update_enrichment_jobs_updated_at
  BEFORE UPDATE ON enrichment_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to workers table
DROP TRIGGER IF EXISTS update_enrichment_workers_updated_at ON enrichment_workers;
CREATE TRIGGER update_enrichment_workers_updated_at
  BEFORE UPDATE ON enrichment_workers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to webhooks table
DROP TRIGGER IF EXISTS update_enrichment_webhooks_updated_at ON enrichment_webhooks;
CREATE TRIGGER update_enrichment_webhooks_updated_at
  BEFORE UPDATE ON enrichment_webhooks
  FOR EACH ROW
  EXECUTE FUNCTION update_enrichment_webhooks();

-- ====================================
-- Row Level Security (RLS)
-- ====================================

-- Enable RLS on all tables
ALTER TABLE enrichment_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrichment_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrichment_webhooks ENABLE ROW LEVEL SECURITY;

-- RLS policies for enrichment_jobs
CREATE POLICY "Users can view jobs from their workspace" ON enrichment_jobs
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert jobs for their workspace" ON enrichment_jobs
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update jobs from their workspace" ON enrichment_jobs
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete jobs from their workspace" ON enrichment_jobs
  FOR DELETE USING (
    workspace_id IN (
      SELECT workspace_id FROM profiles WHERE id = auth.uid()
    )
  );

-- RLS policies for enrichment_workers (read-only for users)
CREATE POLICY "Users can view worker status" ON enrichment_workers
  FOR SELECT USING (true);

-- RLS policies for enrichment_webhooks
CREATE POLICY "Users can view webhooks for their jobs" ON enrichment_webhooks
  FOR SELECT USING (
    job_id IN (
      SELECT id FROM enrichment_jobs 
      WHERE workspace_id IN (
        SELECT workspace_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- ====================================
-- Scheduled Jobs for Maintenance
-- ====================================

-- Create extension for cron jobs if not exists
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule cleanup jobs (commented out - enable if pg_cron is available)
-- SELECT cron.schedule('cleanup-old-jobs', '0 2 * * *', 'SELECT cleanup_old_jobs(7);');
-- SELECT cron.schedule('cleanup-dead-workers', '*/5 * * * *', 'SELECT cleanup_dead_workers();');
-- SELECT cron.schedule('refresh-job-metrics', '*/5 * * * *', 'REFRESH MATERIALIZED VIEW enrichment_job_metrics;');

-- ====================================
-- Initial Data and Indexes
-- ====================================

-- Refresh the materialized view initially
REFRESH MATERIALIZED VIEW enrichment_job_metrics;

-- Grant necessary permissions
GRANT SELECT ON enrichment_job_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION get_job_metrics() TO authenticated;
GRANT EXECUTE ON FUNCTION get_workspace_job_metrics(UUID) TO authenticated;

-- Create additional performance indexes
CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_workspace_type_status ON enrichment_jobs (workspace_id, type, status);
CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_priority_created_at ON enrichment_jobs (priority, created_at) WHERE status IN ('pending', 'queued');
CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_completed_performance ON enrichment_jobs (completed_at, started_at) WHERE status = 'completed';

-- Add comments for documentation
COMMENT ON TABLE enrichment_jobs IS 'Stores enrichment jobs with their status, payload, and results';
COMMENT ON TABLE enrichment_workers IS 'Tracks worker processes and their health status';
COMMENT ON TABLE enrichment_webhooks IS 'Manages webhook configurations for job notifications';
COMMENT ON MATERIALIZED VIEW enrichment_job_metrics IS 'Aggregated metrics for job performance monitoring';

COMMENT ON COLUMN enrichment_jobs.priority IS 'Job priority (1=highest, 5=lowest)';
COMMENT ON COLUMN enrichment_jobs.payload IS 'Job input data and configuration';
COMMENT ON COLUMN enrichment_jobs.result IS 'Job output data upon completion';
COMMENT ON COLUMN enrichment_jobs.retry_count IS 'Number of times this job has been retried';
COMMENT ON COLUMN enrichment_jobs.scheduled_at IS 'When the job should be processed (NULL for immediate)';

COMMENT ON COLUMN enrichment_workers.current_load IS 'Current load as percentage (0.0-1.0)';
COMMENT ON COLUMN enrichment_workers.memory_usage IS 'Memory usage in MB';
COMMENT ON COLUMN enrichment_workers.uptime IS 'Worker uptime in milliseconds';