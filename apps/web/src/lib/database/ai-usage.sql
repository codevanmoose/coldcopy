-- AI usage logs table
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic')),
  model TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL,
  completion_tokens INTEGER NOT NULL,
  total_tokens INTEGER NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('email_generation', 'lead_enrichment', 'subject_optimization', 'other')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_ai_usage_logs_workspace ON ai_usage_logs(workspace_id);
CREATE INDEX idx_ai_usage_logs_user ON ai_usage_logs(user_id);
CREATE INDEX idx_ai_usage_logs_created_at ON ai_usage_logs(created_at DESC);

-- Enable RLS
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their workspace AI usage" ON ai_usage_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.workspace_id = ai_usage_logs.workspace_id
    )
  );

CREATE POLICY "Service role can insert AI usage" ON ai_usage_logs
  FOR INSERT
  WITH CHECK (true);

-- Add AI token columns to workspaces table
ALTER TABLE workspaces 
ADD COLUMN IF NOT EXISTS ai_tokens_balance INTEGER DEFAULT 1000,
ADD COLUMN IF NOT EXISTS ai_tokens_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ai_tokens_purchased INTEGER DEFAULT 0;

-- Function to check and deduct AI tokens
CREATE OR REPLACE FUNCTION check_and_deduct_ai_tokens(
  p_workspace_id UUID,
  p_tokens_required INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_balance INTEGER;
BEGIN
  -- Get current balance with lock
  SELECT ai_tokens_balance INTO v_current_balance
  FROM workspaces
  WHERE id = p_workspace_id
  FOR UPDATE;
  
  -- Check if sufficient balance
  IF v_current_balance < p_tokens_required THEN
    RETURN FALSE;
  END IF;
  
  -- Deduct tokens
  UPDATE workspaces
  SET 
    ai_tokens_balance = ai_tokens_balance - p_tokens_required,
    ai_tokens_used = ai_tokens_used + p_tokens_required,
    updated_at = NOW()
  WHERE id = p_workspace_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to add purchased tokens
CREATE OR REPLACE FUNCTION add_ai_tokens(
  p_workspace_id UUID,
  p_tokens_to_add INTEGER
) RETURNS INTEGER AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  UPDATE workspaces
  SET 
    ai_tokens_balance = ai_tokens_balance + p_tokens_to_add,
    ai_tokens_purchased = ai_tokens_purchased + p_tokens_to_add,
    updated_at = NOW()
  WHERE id = p_workspace_id
  RETURNING ai_tokens_balance INTO v_new_balance;
  
  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql;