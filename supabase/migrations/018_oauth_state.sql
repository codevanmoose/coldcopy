-- UP
-- OAuth state management for secure OAuth flows
CREATE TABLE IF NOT EXISTS auth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT NOT NULL UNIQUE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for cleanup and lookups
CREATE INDEX idx_auth_states_state ON auth_states(state);
CREATE INDEX idx_auth_states_expires ON auth_states(expires_at);

-- RLS Policies
ALTER TABLE auth_states ENABLE ROW LEVEL SECURITY;

-- Only the user who created the state can access it
CREATE POLICY auth_states_select ON auth_states
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY auth_states_insert ON auth_states
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY auth_states_delete ON auth_states
  FOR DELETE USING (user_id = auth.uid());

-- Function to clean up expired states
CREATE OR REPLACE FUNCTION cleanup_expired_auth_states()
RETURNS void AS $$
BEGIN
  DELETE FROM auth_states WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- DOWN
DROP FUNCTION IF EXISTS cleanup_expired_auth_states();
DROP POLICY IF EXISTS auth_states_delete ON auth_states;
DROP POLICY IF EXISTS auth_states_insert ON auth_states;
DROP POLICY IF EXISTS auth_states_select ON auth_states;
DROP INDEX IF EXISTS idx_auth_states_expires;
DROP INDEX IF EXISTS idx_auth_states_state;
DROP TABLE IF EXISTS auth_states;