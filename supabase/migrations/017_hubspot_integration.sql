-- UP
-- HubSpot integration settings
CREATE TABLE IF NOT EXISTS hubspot_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  hub_id TEXT NOT NULL,
  access_token TEXT NOT NULL, -- Should be encrypted in production
  refresh_token TEXT NOT NULL, -- Should be encrypted in production
  expires_at TIMESTAMP NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(workspace_id)
);

-- Field mappings between ColdCopy and HubSpot
CREATE TABLE IF NOT EXISTS hubspot_field_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  coldcopy_field TEXT NOT NULL,
  hubspot_property TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('to_hubspot', 'from_hubspot', 'bidirectional')),
  transform_function TEXT, -- Optional data transformation
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(workspace_id, coldcopy_field, hubspot_property)
);

-- Sync status tracking
CREATE TABLE IF NOT EXISTS hubspot_sync_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('contact', 'company', 'activity')),
  entity_id TEXT NOT NULL,
  hubspot_id TEXT,
  last_synced_at TIMESTAMP,
  sync_hash TEXT, -- For change detection
  status TEXT NOT NULL CHECK (status IN ('pending', 'synced', 'error')) DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(workspace_id, entity_type, entity_id)
);

-- Activity log for HubSpot sync
CREATE TABLE IF NOT EXISTS hubspot_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  hubspot_contact_id TEXT,
  activity_type TEXT NOT NULL,
  activity_data JSONB DEFAULT '{}',
  synced_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_hubspot_integrations_workspace ON hubspot_integrations(workspace_id);
CREATE INDEX idx_hubspot_field_mappings_workspace ON hubspot_field_mappings(workspace_id);
CREATE INDEX idx_hubspot_sync_status_workspace ON hubspot_sync_status(workspace_id);
CREATE INDEX idx_hubspot_sync_status_entity ON hubspot_sync_status(entity_type, entity_id);
CREATE INDEX idx_hubspot_sync_status_hubspot ON hubspot_sync_status(hubspot_id);
CREATE INDEX idx_hubspot_activity_log_workspace ON hubspot_activity_log(workspace_id);
CREATE INDEX idx_hubspot_activity_log_lead ON hubspot_activity_log(lead_id);
CREATE INDEX idx_hubspot_activity_log_synced ON hubspot_activity_log(synced_at);

-- RLS Policies
ALTER TABLE hubspot_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE hubspot_field_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE hubspot_sync_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE hubspot_activity_log ENABLE ROW LEVEL SECURITY;

-- HubSpot integrations policies
CREATE POLICY hubspot_integrations_select ON hubspot_integrations
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY hubspot_integrations_insert ON hubspot_integrations
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY hubspot_integrations_update ON hubspot_integrations
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY hubspot_integrations_delete ON hubspot_integrations
  FOR DELETE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Field mappings policies
CREATE POLICY hubspot_field_mappings_select ON hubspot_field_mappings
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY hubspot_field_mappings_insert ON hubspot_field_mappings
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY hubspot_field_mappings_update ON hubspot_field_mappings
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY hubspot_field_mappings_delete ON hubspot_field_mappings
  FOR DELETE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Sync status policies (read-only for non-admins)
CREATE POLICY hubspot_sync_status_select ON hubspot_sync_status
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY hubspot_sync_status_all ON hubspot_sync_status
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Activity log policies (read-only)
CREATE POLICY hubspot_activity_log_select ON hubspot_activity_log
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY hubspot_activity_log_insert ON hubspot_activity_log
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_hubspot_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_hubspot_integrations_updated_at
  BEFORE UPDATE ON hubspot_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_hubspot_updated_at();

CREATE TRIGGER update_hubspot_field_mappings_updated_at
  BEFORE UPDATE ON hubspot_field_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_hubspot_updated_at();

CREATE TRIGGER update_hubspot_sync_status_updated_at
  BEFORE UPDATE ON hubspot_sync_status
  FOR EACH ROW
  EXECUTE FUNCTION update_hubspot_updated_at();

-- DOWN
DROP TRIGGER IF EXISTS update_hubspot_sync_status_updated_at ON hubspot_sync_status;
DROP TRIGGER IF EXISTS update_hubspot_field_mappings_updated_at ON hubspot_field_mappings;
DROP TRIGGER IF EXISTS update_hubspot_integrations_updated_at ON hubspot_integrations;
DROP FUNCTION IF EXISTS update_hubspot_updated_at();

DROP POLICY IF EXISTS hubspot_activity_log_insert ON hubspot_activity_log;
DROP POLICY IF EXISTS hubspot_activity_log_select ON hubspot_activity_log;
DROP POLICY IF EXISTS hubspot_sync_status_all ON hubspot_sync_status;
DROP POLICY IF EXISTS hubspot_sync_status_select ON hubspot_sync_status;
DROP POLICY IF EXISTS hubspot_field_mappings_delete ON hubspot_field_mappings;
DROP POLICY IF EXISTS hubspot_field_mappings_update ON hubspot_field_mappings;
DROP POLICY IF EXISTS hubspot_field_mappings_insert ON hubspot_field_mappings;
DROP POLICY IF EXISTS hubspot_field_mappings_select ON hubspot_field_mappings;
DROP POLICY IF EXISTS hubspot_integrations_delete ON hubspot_integrations;
DROP POLICY IF EXISTS hubspot_integrations_update ON hubspot_integrations;
DROP POLICY IF EXISTS hubspot_integrations_insert ON hubspot_integrations;
DROP POLICY IF EXISTS hubspot_integrations_select ON hubspot_integrations;

DROP INDEX IF EXISTS idx_hubspot_activity_log_synced;
DROP INDEX IF EXISTS idx_hubspot_activity_log_lead;
DROP INDEX IF EXISTS idx_hubspot_activity_log_workspace;
DROP INDEX IF EXISTS idx_hubspot_sync_status_hubspot;
DROP INDEX IF EXISTS idx_hubspot_sync_status_entity;
DROP INDEX IF EXISTS idx_hubspot_sync_status_workspace;
DROP INDEX IF EXISTS idx_hubspot_field_mappings_workspace;
DROP INDEX IF EXISTS idx_hubspot_integrations_workspace;

DROP TABLE IF EXISTS hubspot_activity_log;
DROP TABLE IF EXISTS hubspot_sync_status;
DROP TABLE IF EXISTS hubspot_field_mappings;
DROP TABLE IF EXISTS hubspot_integrations;