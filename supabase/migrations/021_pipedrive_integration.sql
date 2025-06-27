-- UP
-- Pipedrive integration settings
CREATE TABLE IF NOT EXISTS pipedrive_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  company_domain TEXT NOT NULL,
  access_token TEXT NOT NULL, -- Encrypted in application layer
  refresh_token TEXT, -- Encrypted in application layer
  expires_at TIMESTAMP WITH TIME ZONE,
  token_type VARCHAR(50) DEFAULT 'Bearer',
  scopes TEXT[] NOT NULL DEFAULT '{}',
  api_token TEXT, -- Encrypted fallback for API token auth
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workspace_id)
);

-- Field mappings between ColdCopy and Pipedrive
CREATE TABLE IF NOT EXISTS pipedrive_field_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_field VARCHAR(255) NOT NULL,
  target_field VARCHAR(255) NOT NULL,
  source_system VARCHAR(50) NOT NULL CHECK (source_system IN ('coldcopy', 'pipedrive')),
  target_system VARCHAR(50) NOT NULL CHECK (target_system IN ('coldcopy', 'pipedrive')),
  field_type VARCHAR(50) NOT NULL,
  transformation JSONB,
  required BOOLEAN DEFAULT FALSE,
  bidirectional BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workspace_id, source_field, target_field, source_system, target_system)
);

-- Sync status tracking
CREATE TABLE IF NOT EXISTS pipedrive_sync_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('person', 'organization', 'deal', 'activity')),
  entity_id VARCHAR(255) NOT NULL,
  pipedrive_id INTEGER,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  sync_hash TEXT, -- For change detection
  status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'synced', 'error')) DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workspace_id, entity_type, entity_id)
);

-- Activity log for Pipedrive sync
CREATE TABLE IF NOT EXISTS pipedrive_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  pipedrive_person_id INTEGER,
  pipedrive_deal_id INTEGER,
  activity_type VARCHAR(100) NOT NULL,
  activity_data JSONB DEFAULT '{}',
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pipeline stage mappings for workflow automation
CREATE TABLE IF NOT EXISTS pipedrive_stage_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  pipedrive_stage_id INTEGER NOT NULL,
  coldcopy_status VARCHAR(100),
  trigger_actions JSONB DEFAULT '[]', -- Array of actions to trigger
  probability INTEGER CHECK (probability >= 0 AND probability <= 100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workspace_id, pipedrive_stage_id)
);

-- Stage change history for analytics
CREATE TABLE IF NOT EXISTS pipedrive_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  deal_id INTEGER NOT NULL,
  stage_id INTEGER NOT NULL,
  previous_stage_id INTEGER,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_in_stage INTERVAL,
  changed_by_user_id INTEGER,
  probability INTEGER,
  deal_value DECIMAL(15,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Webhook configurations
CREATE TABLE IF NOT EXISTS pipedrive_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  pipedrive_webhook_id INTEGER NOT NULL,
  event_action VARCHAR(50) NOT NULL CHECK (event_action IN ('added', 'updated', 'deleted', 'merged')),
  event_object VARCHAR(50) NOT NULL CHECK (event_object IN ('person', 'organization', 'deal', 'activity', 'user')),
  subscription_url TEXT NOT NULL,
  version VARCHAR(10) DEFAULT '1.0',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workspace_id, event_action, event_object)
);

-- Conflict tracking for sync conflicts
CREATE TABLE IF NOT EXISTS pipedrive_sync_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  pipedrive_id INTEGER,
  conflict_type VARCHAR(100) NOT NULL,
  coldcopy_data JSONB NOT NULL,
  pipedrive_data JSONB NOT NULL,
  resolution_status VARCHAR(50) DEFAULT 'pending' CHECK (resolution_status IN ('pending', 'resolved', 'ignored')),
  resolved_data JSONB,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Token usage tracking for budget management
CREATE TABLE IF NOT EXISTS pipedrive_token_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  tokens_used INTEGER DEFAULT 0,
  tokens_limit INTEGER DEFAULT 30000,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workspace_id, date)
);

-- Indexes for performance
CREATE INDEX idx_pipedrive_integrations_workspace ON pipedrive_integrations(workspace_id);
CREATE INDEX idx_pipedrive_field_mappings_workspace ON pipedrive_field_mappings(workspace_id);
CREATE INDEX idx_pipedrive_field_mappings_source ON pipedrive_field_mappings(source_system, source_field);
CREATE INDEX idx_pipedrive_field_mappings_target ON pipedrive_field_mappings(target_system, target_field);
CREATE INDEX idx_pipedrive_sync_status_workspace ON pipedrive_sync_status(workspace_id);
CREATE INDEX idx_pipedrive_sync_status_entity ON pipedrive_sync_status(entity_type, entity_id);
CREATE INDEX idx_pipedrive_sync_status_pipedrive ON pipedrive_sync_status(pipedrive_id);
CREATE INDEX idx_pipedrive_sync_status_status ON pipedrive_sync_status(status);
CREATE INDEX idx_pipedrive_activity_log_workspace ON pipedrive_activity_log(workspace_id);
CREATE INDEX idx_pipedrive_activity_log_lead ON pipedrive_activity_log(lead_id);
CREATE INDEX idx_pipedrive_activity_log_synced ON pipedrive_activity_log(synced_at);
CREATE INDEX idx_pipedrive_activity_log_person ON pipedrive_activity_log(pipedrive_person_id);
CREATE INDEX idx_pipedrive_activity_log_deal ON pipedrive_activity_log(pipedrive_deal_id);
CREATE INDEX idx_pipedrive_stage_mappings_workspace ON pipedrive_stage_mappings(workspace_id);
CREATE INDEX idx_pipedrive_stage_mappings_stage ON pipedrive_stage_mappings(pipedrive_stage_id);
CREATE INDEX idx_pipedrive_stage_history_workspace ON pipedrive_stage_history(workspace_id);
CREATE INDEX idx_pipedrive_stage_history_deal ON pipedrive_stage_history(deal_id);
CREATE INDEX idx_pipedrive_stage_history_changed ON pipedrive_stage_history(changed_at);
CREATE INDEX idx_pipedrive_webhooks_workspace ON pipedrive_webhooks(workspace_id);
CREATE INDEX idx_pipedrive_webhooks_event ON pipedrive_webhooks(event_action, event_object);
CREATE INDEX idx_pipedrive_sync_conflicts_workspace ON pipedrive_sync_conflicts(workspace_id);
CREATE INDEX idx_pipedrive_sync_conflicts_status ON pipedrive_sync_conflicts(resolution_status);
CREATE INDEX idx_pipedrive_sync_conflicts_entity ON pipedrive_sync_conflicts(entity_type, entity_id);
CREATE INDEX idx_pipedrive_token_usage_workspace ON pipedrive_token_usage(workspace_id);
CREATE INDEX idx_pipedrive_token_usage_date ON pipedrive_token_usage(date);

-- RLS Policies
ALTER TABLE pipedrive_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipedrive_field_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipedrive_sync_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipedrive_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipedrive_stage_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipedrive_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipedrive_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipedrive_sync_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipedrive_token_usage ENABLE ROW LEVEL SECURITY;

-- Pipedrive integrations policies
CREATE POLICY pipedrive_integrations_select ON pipedrive_integrations
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY pipedrive_integrations_insert ON pipedrive_integrations
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY pipedrive_integrations_update ON pipedrive_integrations
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY pipedrive_integrations_delete ON pipedrive_integrations
  FOR DELETE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Field mappings policies
CREATE POLICY pipedrive_field_mappings_select ON pipedrive_field_mappings
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY pipedrive_field_mappings_all ON pipedrive_field_mappings
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Sync status policies
CREATE POLICY pipedrive_sync_status_select ON pipedrive_sync_status
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY pipedrive_sync_status_all ON pipedrive_sync_status
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Activity log policies (read-only for most users)
CREATE POLICY pipedrive_activity_log_select ON pipedrive_activity_log
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY pipedrive_activity_log_insert ON pipedrive_activity_log
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Stage mappings policies
CREATE POLICY pipedrive_stage_mappings_select ON pipedrive_stage_mappings
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY pipedrive_stage_mappings_all ON pipedrive_stage_mappings
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Stage history policies (read-only)
CREATE POLICY pipedrive_stage_history_select ON pipedrive_stage_history
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY pipedrive_stage_history_insert ON pipedrive_stage_history
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Webhooks policies
CREATE POLICY pipedrive_webhooks_select ON pipedrive_webhooks
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY pipedrive_webhooks_all ON pipedrive_webhooks
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Sync conflicts policies
CREATE POLICY pipedrive_sync_conflicts_select ON pipedrive_sync_conflicts
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY pipedrive_sync_conflicts_all ON pipedrive_sync_conflicts
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Token usage policies
CREATE POLICY pipedrive_token_usage_select ON pipedrive_token_usage
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY pipedrive_token_usage_all ON pipedrive_token_usage
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_pipedrive_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_pipedrive_integrations_updated_at
  BEFORE UPDATE ON pipedrive_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_pipedrive_updated_at();

CREATE TRIGGER update_pipedrive_field_mappings_updated_at
  BEFORE UPDATE ON pipedrive_field_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_pipedrive_updated_at();

CREATE TRIGGER update_pipedrive_sync_status_updated_at
  BEFORE UPDATE ON pipedrive_sync_status
  FOR EACH ROW
  EXECUTE FUNCTION update_pipedrive_updated_at();

CREATE TRIGGER update_pipedrive_stage_mappings_updated_at
  BEFORE UPDATE ON pipedrive_stage_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_pipedrive_updated_at();

CREATE TRIGGER update_pipedrive_webhooks_updated_at
  BEFORE UPDATE ON pipedrive_webhooks
  FOR EACH ROW
  EXECUTE FUNCTION update_pipedrive_updated_at();

CREATE TRIGGER update_pipedrive_token_usage_updated_at
  BEFORE UPDATE ON pipedrive_token_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_pipedrive_updated_at();

-- Function to automatically update token usage
CREATE OR REPLACE FUNCTION track_pipedrive_token_usage(
  p_workspace_id UUID,
  p_tokens_used INTEGER
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO pipedrive_token_usage (workspace_id, tokens_used)
  VALUES (p_workspace_id, p_tokens_used)
  ON CONFLICT (workspace_id, date)
  DO UPDATE SET 
    tokens_used = pipedrive_token_usage.tokens_used + p_tokens_used,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current token usage for a workspace
CREATE OR REPLACE FUNCTION get_pipedrive_token_usage(p_workspace_id UUID)
RETURNS TABLE (
  date DATE,
  tokens_used INTEGER,
  tokens_limit INTEGER,
  tokens_remaining INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ptu.date,
    ptu.tokens_used,
    ptu.tokens_limit,
    (ptu.tokens_limit - ptu.tokens_used) as tokens_remaining
  FROM pipedrive_token_usage ptu
  WHERE ptu.workspace_id = p_workspace_id
    AND ptu.date = CURRENT_DATE;
  
  -- If no record exists for today, return default values
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      CURRENT_DATE,
      0::INTEGER,
      30000::INTEGER,
      30000::INTEGER;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- DOWN
DROP FUNCTION IF EXISTS get_pipedrive_token_usage(UUID);
DROP FUNCTION IF EXISTS track_pipedrive_token_usage(UUID, INTEGER);

DROP TRIGGER IF EXISTS update_pipedrive_token_usage_updated_at ON pipedrive_token_usage;
DROP TRIGGER IF EXISTS update_pipedrive_webhooks_updated_at ON pipedrive_webhooks;
DROP TRIGGER IF EXISTS update_pipedrive_stage_mappings_updated_at ON pipedrive_stage_mappings;
DROP TRIGGER IF EXISTS update_pipedrive_sync_status_updated_at ON pipedrive_sync_status;
DROP TRIGGER IF EXISTS update_pipedrive_field_mappings_updated_at ON pipedrive_field_mappings;
DROP TRIGGER IF EXISTS update_pipedrive_integrations_updated_at ON pipedrive_integrations;
DROP FUNCTION IF EXISTS update_pipedrive_updated_at();

DROP POLICY IF EXISTS pipedrive_token_usage_all ON pipedrive_token_usage;
DROP POLICY IF EXISTS pipedrive_token_usage_select ON pipedrive_token_usage;
DROP POLICY IF EXISTS pipedrive_sync_conflicts_all ON pipedrive_sync_conflicts;
DROP POLICY IF EXISTS pipedrive_sync_conflicts_select ON pipedrive_sync_conflicts;
DROP POLICY IF EXISTS pipedrive_webhooks_all ON pipedrive_webhooks;
DROP POLICY IF EXISTS pipedrive_webhooks_select ON pipedrive_webhooks;
DROP POLICY IF EXISTS pipedrive_stage_history_insert ON pipedrive_stage_history;
DROP POLICY IF EXISTS pipedrive_stage_history_select ON pipedrive_stage_history;
DROP POLICY IF EXISTS pipedrive_stage_mappings_all ON pipedrive_stage_mappings;
DROP POLICY IF EXISTS pipedrive_stage_mappings_select ON pipedrive_stage_mappings;
DROP POLICY IF EXISTS pipedrive_activity_log_insert ON pipedrive_activity_log;
DROP POLICY IF EXISTS pipedrive_activity_log_select ON pipedrive_activity_log;
DROP POLICY IF EXISTS pipedrive_sync_status_all ON pipedrive_sync_status;
DROP POLICY IF EXISTS pipedrive_sync_status_select ON pipedrive_sync_status;
DROP POLICY IF EXISTS pipedrive_field_mappings_all ON pipedrive_field_mappings;
DROP POLICY IF EXISTS pipedrive_field_mappings_select ON pipedrive_field_mappings;
DROP POLICY IF EXISTS pipedrive_integrations_delete ON pipedrive_integrations;
DROP POLICY IF EXISTS pipedrive_integrations_update ON pipedrive_integrations;
DROP POLICY IF EXISTS pipedrive_integrations_insert ON pipedrive_integrations;
DROP POLICY IF EXISTS pipedrive_integrations_select ON pipedrive_integrations;

DROP INDEX IF EXISTS idx_pipedrive_token_usage_date;
DROP INDEX IF EXISTS idx_pipedrive_token_usage_workspace;
DROP INDEX IF EXISTS idx_pipedrive_sync_conflicts_entity;
DROP INDEX IF EXISTS idx_pipedrive_sync_conflicts_status;
DROP INDEX IF EXISTS idx_pipedrive_sync_conflicts_workspace;
DROP INDEX IF EXISTS idx_pipedrive_webhooks_event;
DROP INDEX IF EXISTS idx_pipedrive_webhooks_workspace;
DROP INDEX IF EXISTS idx_pipedrive_stage_history_changed;
DROP INDEX IF EXISTS idx_pipedrive_stage_history_deal;
DROP INDEX IF EXISTS idx_pipedrive_stage_history_workspace;
DROP INDEX IF EXISTS idx_pipedrive_stage_mappings_stage;
DROP INDEX IF EXISTS idx_pipedrive_stage_mappings_workspace;
DROP INDEX IF EXISTS idx_pipedrive_activity_log_deal;
DROP INDEX IF EXISTS idx_pipedrive_activity_log_person;
DROP INDEX IF EXISTS idx_pipedrive_activity_log_synced;
DROP INDEX IF EXISTS idx_pipedrive_activity_log_lead;
DROP INDEX IF EXISTS idx_pipedrive_activity_log_workspace;
DROP INDEX IF EXISTS idx_pipedrive_sync_status_status;
DROP INDEX IF EXISTS idx_pipedrive_sync_status_pipedrive;
DROP INDEX IF EXISTS idx_pipedrive_sync_status_entity;
DROP INDEX IF EXISTS idx_pipedrive_sync_status_workspace;
DROP INDEX IF EXISTS idx_pipedrive_field_mappings_target;
DROP INDEX IF EXISTS idx_pipedrive_field_mappings_source;
DROP INDEX IF EXISTS idx_pipedrive_field_mappings_workspace;
DROP INDEX IF EXISTS idx_pipedrive_integrations_workspace;

DROP TABLE IF EXISTS pipedrive_token_usage;
DROP TABLE IF EXISTS pipedrive_sync_conflicts;
DROP TABLE IF EXISTS pipedrive_webhooks;
DROP TABLE IF EXISTS pipedrive_stage_history;
DROP TABLE IF EXISTS pipedrive_stage_mappings;
DROP TABLE IF EXISTS pipedrive_activity_log;
DROP TABLE IF EXISTS pipedrive_sync_status;
DROP TABLE IF EXISTS pipedrive_field_mappings;
DROP TABLE IF EXISTS pipedrive_integrations;