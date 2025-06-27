-- Suppression list table
CREATE TABLE IF NOT EXISTS suppression_list (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('unsubscribe', 'bounce', 'complaint', 'manual')),
  source TEXT NOT NULL CHECK (source IN ('link', 'webhook', 'api', 'manual')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, email)
);

-- Create indexes
CREATE INDEX idx_suppression_list_workspace_email ON suppression_list(workspace_id, email);
CREATE INDEX idx_suppression_list_created_at ON suppression_list(created_at DESC);

-- Enable RLS
ALTER TABLE suppression_list ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their workspace suppression list" ON suppression_list
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.workspace_id = suppression_list.workspace_id
    )
  );

CREATE POLICY "Workspace admins can manage suppression list" ON suppression_list
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.workspace_id = suppression_list.workspace_id
      AND users.role IN ('workspace_admin', 'super_admin')
    )
  );

-- Allow unauthenticated unsubscribe (for email links)
CREATE POLICY "Allow unauthenticated unsubscribe" ON suppression_list
  FOR INSERT
  WITH CHECK (reason = 'unsubscribe' AND source = 'link');