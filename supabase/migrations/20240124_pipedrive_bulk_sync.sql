-- Create pipedrive_sync_jobs table
CREATE TABLE IF NOT EXISTS pipedrive_sync_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  source VARCHAR(50) NOT NULL DEFAULT 'manual',
  total_records INTEGER DEFAULT 0,
  processed_records INTEGER DEFAULT 0,
  successful_records INTEGER DEFAULT 0,
  failed_records INTEGER DEFAULT 0,
  duplicate_records INTEGER DEFAULT 0,
  options JSONB,
  result JSONB,
  error TEXT,
  created_by_id UUID NOT NULL REFERENCES users(id),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_pipedrive_sync_jobs_workspace_id ON pipedrive_sync_jobs(workspace_id);
CREATE INDEX idx_pipedrive_sync_jobs_status ON pipedrive_sync_jobs(status);
CREATE INDEX idx_pipedrive_sync_jobs_created_at ON pipedrive_sync_jobs(created_at DESC);
CREATE INDEX idx_pipedrive_sync_jobs_created_by ON pipedrive_sync_jobs(created_by_id);

-- Add RLS policies
ALTER TABLE pipedrive_sync_jobs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view sync jobs for their workspace
CREATE POLICY "Users can view workspace sync jobs" ON pipedrive_sync_jobs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = pipedrive_sync_jobs.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

-- Policy: Admin/owners can create sync jobs
CREATE POLICY "Admin can create sync jobs" ON pipedrive_sync_jobs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = pipedrive_sync_jobs.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('admin', 'owner')
    )
  );

-- Policy: Admin/owners can update sync jobs
CREATE POLICY "Admin can update sync jobs" ON pipedrive_sync_jobs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = pipedrive_sync_jobs.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('admin', 'owner')
    )
  );

-- Policy: Admin/owners can delete sync jobs
CREATE POLICY "Admin can delete sync jobs" ON pipedrive_sync_jobs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = pipedrive_sync_jobs.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('admin', 'owner')
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_pipedrive_sync_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_pipedrive_sync_jobs_updated_at
  BEFORE UPDATE ON pipedrive_sync_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_pipedrive_sync_jobs_updated_at();

-- Create view for sync job statistics
CREATE VIEW pipedrive_sync_job_stats AS
SELECT
  workspace_id,
  COUNT(*) AS total_jobs,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completed_jobs,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) AS failed_jobs,
  COUNT(CASE WHEN status IN ('running', 'paused') THEN 1 END) AS active_jobs,
  SUM(total_records) AS total_records_synced,
  SUM(successful_records) AS total_successful_records,
  SUM(failed_records) AS total_failed_records,
  AVG(CASE 
    WHEN completed_at IS NOT NULL AND started_at IS NOT NULL 
    THEN EXTRACT(EPOCH FROM (completed_at - started_at))
    ELSE NULL
  END) AS avg_sync_duration_seconds
FROM pipedrive_sync_jobs
GROUP BY workspace_id;

-- Grant permissions on the view
GRANT SELECT ON pipedrive_sync_job_stats TO authenticated;