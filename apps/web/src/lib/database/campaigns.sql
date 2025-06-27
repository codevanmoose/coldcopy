-- Update campaigns table with more comprehensive fields
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'sequence' CHECK (type IN ('sequence', 'one-off', 'drip')),
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC',
ADD COLUMN IF NOT EXISTS schedule_settings JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS ab_test_settings JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS is_ab_test BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES campaigns(id),
ADD COLUMN IF NOT EXISTS daily_limit INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_limit INTEGER DEFAULT 0;

-- Campaign sequences table (email steps in a campaign)
CREATE TABLE IF NOT EXISTS campaign_sequences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  delay_days INTEGER DEFAULT 0,
  delay_hours INTEGER DEFAULT 0,
  is_reply_to_previous BOOLEAN DEFAULT false,
  condition_type TEXT CHECK (condition_type IN ('always', 'no_reply', 'no_open', 'opened', 'clicked')),
  condition_value TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, sequence_number)
);

-- Campaign leads table (leads assigned to campaigns)
CREATE TABLE IF NOT EXISTS campaign_leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'unsubscribed', 'bounced')),
  current_sequence INTEGER DEFAULT 0,
  ab_variant TEXT,
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, lead_id)
);

-- Campaign schedule queue
CREATE TABLE IF NOT EXISTS campaign_schedule_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  campaign_lead_id UUID NOT NULL REFERENCES campaign_leads(id) ON DELETE CASCADE,
  sequence_id UUID NOT NULL REFERENCES campaign_sequences(id) ON DELETE CASCADE,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaign templates table
CREATE TABLE IF NOT EXISTS campaign_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('sequence', 'one-off', 'drip')),
  category TEXT,
  sequences JSONB NOT NULL DEFAULT '[]',
  settings JSONB DEFAULT '{}',
  is_public BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_campaign_sequences_campaign ON campaign_sequences(campaign_id);
CREATE INDEX idx_campaign_leads_campaign ON campaign_leads(campaign_id);
CREATE INDEX idx_campaign_leads_status ON campaign_leads(status);
CREATE INDEX idx_campaign_schedule_queue_scheduled ON campaign_schedule_queue(scheduled_for, status);
CREATE INDEX idx_campaign_schedule_queue_campaign ON campaign_schedule_queue(campaign_id);

-- Enable RLS
ALTER TABLE campaign_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_schedule_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for campaign_sequences
CREATE POLICY "Users can view sequences for their workspace campaigns" ON campaign_sequences
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      JOIN users u ON u.workspace_id = c.workspace_id
      WHERE c.id = campaign_sequences.campaign_id
      AND u.id = auth.uid()
    )
  );

CREATE POLICY "Campaign managers can manage sequences" ON campaign_sequences
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      JOIN users u ON u.workspace_id = c.workspace_id
      WHERE c.id = campaign_sequences.campaign_id
      AND u.id = auth.uid()
      AND u.role IN ('campaign_manager', 'workspace_admin', 'super_admin')
    )
  );

-- RLS Policies for campaign_leads
CREATE POLICY "Users can view campaign leads for their workspace" ON campaign_leads
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      JOIN users u ON u.workspace_id = c.workspace_id
      WHERE c.id = campaign_leads.campaign_id
      AND u.id = auth.uid()
    )
  );

CREATE POLICY "Campaign managers can manage campaign leads" ON campaign_leads
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      JOIN users u ON u.workspace_id = c.workspace_id
      WHERE c.id = campaign_leads.campaign_id
      AND u.id = auth.uid()
      AND u.role IN ('campaign_manager', 'workspace_admin', 'super_admin')
    )
  );

-- RLS Policies for campaign_schedule_queue
CREATE POLICY "Users can view schedule queue for their workspace" ON campaign_schedule_queue
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      JOIN users u ON u.workspace_id = c.workspace_id
      WHERE c.id = campaign_schedule_queue.campaign_id
      AND u.id = auth.uid()
    )
  );

CREATE POLICY "System can manage schedule queue" ON campaign_schedule_queue
  FOR ALL
  USING (true);

-- RLS Policies for campaign_templates
CREATE POLICY "Users can view templates for their workspace" ON campaign_templates
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM users WHERE id = auth.uid()
    )
    OR is_public = true
  );

CREATE POLICY "Campaign managers can manage templates" ON campaign_templates
  FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM users 
      WHERE id = auth.uid() 
      AND role IN ('campaign_manager', 'workspace_admin', 'super_admin')
    )
  );

-- Function to schedule campaign emails
CREATE OR REPLACE FUNCTION schedule_campaign_email(
  p_campaign_lead_id UUID,
  p_sequence_id UUID,
  p_scheduled_for TIMESTAMPTZ
) RETURNS UUID AS $$
DECLARE
  v_queue_id UUID;
  v_campaign_id UUID;
BEGIN
  -- Get campaign_id from campaign_lead
  SELECT campaign_id INTO v_campaign_id
  FROM campaign_leads
  WHERE id = p_campaign_lead_id;
  
  -- Insert into schedule queue
  INSERT INTO campaign_schedule_queue (
    campaign_id,
    campaign_lead_id,
    sequence_id,
    scheduled_for,
    status
  ) VALUES (
    v_campaign_id,
    p_campaign_lead_id,
    p_sequence_id,
    p_scheduled_for,
    'pending'
  ) RETURNING id INTO v_queue_id;
  
  RETURN v_queue_id;
END;
$$ LANGUAGE plpgsql;

-- Function to advance campaign lead to next sequence
CREATE OR REPLACE FUNCTION advance_campaign_sequence(
  p_campaign_lead_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_campaign_lead campaign_leads%ROWTYPE;
  v_next_sequence campaign_sequences%ROWTYPE;
  v_schedule_time TIMESTAMPTZ;
BEGIN
  -- Get campaign lead details
  SELECT * INTO v_campaign_lead
  FROM campaign_leads
  WHERE id = p_campaign_lead_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Get next sequence
  SELECT * INTO v_next_sequence
  FROM campaign_sequences
  WHERE campaign_id = v_campaign_lead.campaign_id
  AND sequence_number = v_campaign_lead.current_sequence + 1
  ORDER BY sequence_number
  LIMIT 1;
  
  IF NOT FOUND THEN
    -- No more sequences, mark as completed
    UPDATE campaign_leads
    SET status = 'completed',
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_campaign_lead_id;
    
    RETURN TRUE;
  END IF;
  
  -- Calculate schedule time
  v_schedule_time := NOW() + 
    INTERVAL '1 day' * v_next_sequence.delay_days +
    INTERVAL '1 hour' * v_next_sequence.delay_hours;
  
  -- Schedule the email
  PERFORM schedule_campaign_email(
    p_campaign_lead_id,
    v_next_sequence.id,
    v_schedule_time
  );
  
  -- Update campaign lead
  UPDATE campaign_leads
  SET current_sequence = v_next_sequence.sequence_number,
      updated_at = NOW()
  WHERE id = p_campaign_lead_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;