-- HubSpot workflow trigger configurations
CREATE TABLE hubspot_workflow_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT true,
  event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
    'email_sent',
    'email_opened',
    'email_clicked',
    'email_replied',
    'email_bounced',
    'email_unsubscribed'
  )),
  conditions JSONB DEFAULT '[]'::jsonb,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  hubspot_workflow_id VARCHAR(255),
  property_updates JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_hubspot_workflow_triggers_workspace ON hubspot_workflow_triggers(workspace_id);
CREATE INDEX idx_hubspot_workflow_triggers_enabled ON hubspot_workflow_triggers(enabled) WHERE enabled = true;
CREATE INDEX idx_hubspot_workflow_triggers_event_type ON hubspot_workflow_triggers(event_type);

-- HubSpot workflow execution logs
CREATE TABLE hubspot_workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  trigger_id UUID NOT NULL REFERENCES hubspot_workflow_triggers(id) ON DELETE CASCADE,
  event_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  hubspot_contact_id VARCHAR(255),
  execution_time TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for execution logs
CREATE INDEX idx_hubspot_workflow_executions_workspace ON hubspot_workflow_executions(workspace_id);
CREATE INDEX idx_hubspot_workflow_executions_trigger ON hubspot_workflow_executions(trigger_id);
CREATE INDEX idx_hubspot_workflow_executions_lead ON hubspot_workflow_executions(lead_id);
CREATE INDEX idx_hubspot_workflow_executions_time ON hubspot_workflow_executions(execution_time DESC);

-- HubSpot activity logs (for tracking what was sent to HubSpot)
CREATE TABLE IF NOT EXISTS hubspot_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  hubspot_contact_id VARCHAR(255) NOT NULL,
  activity_type VARCHAR(50) NOT NULL,
  activity_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for activity logs
CREATE INDEX IF NOT EXISTS idx_hubspot_activity_log_workspace ON hubspot_activity_log(workspace_id);
CREATE INDEX IF NOT EXISTS idx_hubspot_activity_log_lead ON hubspot_activity_log(lead_id);
CREATE INDEX IF NOT EXISTS idx_hubspot_activity_log_created ON hubspot_activity_log(created_at DESC);

-- HubSpot sync configuration
CREATE TABLE IF NOT EXISTS hubspot_sync_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE UNIQUE,
  enabled BOOLEAN DEFAULT true,
  sync_interval INTEGER DEFAULT 60, -- minutes
  sync_direction VARCHAR(20) DEFAULT 'bidirectional' CHECK (sync_direction IN ('to_hubspot', 'from_hubspot', 'bidirectional')),
  auto_create_contacts BOOLEAN DEFAULT false,
  auto_log_activities BOOLEAN DEFAULT true,
  activity_types TEXT[] DEFAULT ARRAY['email_sent', 'email_opened', 'email_clicked', 'email_replied'],
  custom_property_prefix VARCHAR(50) DEFAULT 'coldcopy_',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_hubspot_workflow_triggers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updating updated_at
CREATE TRIGGER update_hubspot_workflow_triggers_updated_at
  BEFORE UPDATE ON hubspot_workflow_triggers
  FOR EACH ROW
  EXECUTE FUNCTION update_hubspot_workflow_triggers_updated_at();

-- RLS policies for workflow triggers
ALTER TABLE hubspot_workflow_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their workspace workflow triggers"
  ON hubspot_workflow_triggers FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage workflow triggers"
  ON hubspot_workflow_triggers FOR ALL
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_users 
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

-- RLS policies for execution logs
ALTER TABLE hubspot_workflow_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their workspace execution logs"
  ON hubspot_workflow_executions FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_users WHERE user_id = auth.uid()
  ));

-- RLS policies for activity logs
ALTER TABLE hubspot_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their workspace activity logs"
  ON hubspot_activity_log FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_users WHERE user_id = auth.uid()
  ));

-- RLS policies for sync config
ALTER TABLE hubspot_sync_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their workspace sync config"
  ON hubspot_sync_config FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage sync config"
  ON hubspot_sync_config FOR ALL
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_users 
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

-- Function to get workflow trigger statistics
CREATE OR REPLACE FUNCTION get_workflow_trigger_stats(p_workspace_id UUID)
RETURNS TABLE (
  trigger_id UUID,
  trigger_name VARCHAR,
  event_type VARCHAR,
  total_executions BIGINT,
  successful_executions BIGINT,
  failed_executions BIGINT,
  last_execution TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.name,
    t.event_type,
    COUNT(e.id) AS total_executions,
    COUNT(e.id) FILTER (WHERE e.status = 'success') AS successful_executions,
    COUNT(e.id) FILTER (WHERE e.status = 'failed') AS failed_executions,
    MAX(e.execution_time) AS last_execution
  FROM hubspot_workflow_triggers t
  LEFT JOIN hubspot_workflow_executions e ON t.id = e.trigger_id
  WHERE t.workspace_id = p_workspace_id
  GROUP BY t.id, t.name, t.event_type
  ORDER BY total_executions DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;