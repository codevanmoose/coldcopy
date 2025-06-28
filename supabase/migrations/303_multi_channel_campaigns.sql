-- Multi-Channel Campaign Tables
-- This migration adds support for unified multi-channel campaigns

-- Multi-channel campaigns table
CREATE TABLE multi_channel_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'active', 'paused', 'completed', 'failed')),
  
  -- Target audience configuration
  target_audience JSONB NOT NULL DEFAULT '{}',
  
  -- Sequence configuration (steps and channels)
  sequence_config JSONB NOT NULL DEFAULT '[]',
  
  -- Scheduling settings
  scheduling_config JSONB NOT NULL DEFAULT '{}',
  
  -- Tracking configuration
  tracking_config JSONB NOT NULL DEFAULT '{}',
  
  -- Compliance settings
  compliance_config JSONB NOT NULL DEFAULT '{}',
  
  -- Channel campaign mappings
  channel_campaigns JSONB DEFAULT '[]',
  
  -- Execution tracking
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  paused_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Multi-channel campaign analytics table
CREATE TABLE multi_channel_campaign_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES multi_channel_campaigns(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Overall metrics
  total_targeted INTEGER DEFAULT 0,
  total_reached INTEGER DEFAULT 0,
  total_engaged INTEGER DEFAULT 0,
  total_converted INTEGER DEFAULT 0,
  total_cost DECIMAL(10,2) DEFAULT 0,
  
  -- Channel-specific metrics
  email_metrics JSONB DEFAULT '{}',
  linkedin_metrics JSONB DEFAULT '{}',
  twitter_metrics JSONB DEFAULT '{}',
  sms_metrics JSONB DEFAULT '{}',
  
  -- Sequence performance
  sequence_metrics JSONB DEFAULT '[]',
  
  -- Time-based metrics
  daily_metrics JSONB DEFAULT '{}',
  weekly_metrics JSONB DEFAULT '{}',
  
  -- Last updated
  last_calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Channel-specific campaign tables

-- LinkedIn campaigns table
CREATE TABLE linkedin_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  
  -- LinkedIn-specific settings
  target_audience JSONB DEFAULT '{}',
  message_template TEXT NOT NULL,
  personalization_fields TEXT[] DEFAULT '{}',
  
  -- Campaign sequence info (if part of multi-channel)
  parent_campaign_id UUID REFERENCES multi_channel_campaigns(id) ON DELETE CASCADE,
  sequence_step INTEGER,
  
  -- Connection and messaging settings
  connection_request_message TEXT,
  follow_up_sequence JSONB DEFAULT '[]',
  
  -- Limits and throttling
  limits JSONB NOT NULL DEFAULT '{"dailyConnections": 20, "dailyMessages": 50, "weeklyLimit": 100}',
  
  -- Analytics
  analytics JSONB DEFAULT '{}',
  
  -- Execution tracking
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Twitter campaigns table
CREATE TABLE twitter_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  
  -- Twitter-specific settings
  target_audience JSONB DEFAULT '{}',
  actions JSONB NOT NULL DEFAULT '[]', -- Array of action configurations
  
  -- Campaign sequence info (if part of multi-channel)
  parent_campaign_id UUID REFERENCES multi_channel_campaigns(id) ON DELETE CASCADE,
  sequence_step INTEGER,
  
  -- Limits and throttling
  limits JSONB NOT NULL DEFAULT '{"dailyFollows": 50, "dailyLikes": 100, "dailyRetweets": 50, "dailyReplies": 25, "dailyDMs": 25}',
  
  -- Analytics
  analytics JSONB DEFAULT '{}',
  
  -- Execution tracking
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SMS campaigns table
CREATE TABLE sms_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'active', 'paused', 'completed')),
  
  -- SMS content
  message_content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'mms', 'template')),
  media_urls TEXT[],
  
  -- Campaign sequence info (if part of multi-channel)
  parent_campaign_id UUID REFERENCES multi_channel_campaigns(id) ON DELETE CASCADE,
  sequence_step INTEGER,
  
  -- Target audience
  target_audience JSONB DEFAULT '{}',
  
  -- Scheduling
  scheduling JSONB DEFAULT '{}',
  
  -- Personalization
  personalization JSONB DEFAULT '{}',
  
  -- Limits
  limits JSONB DEFAULT '{}',
  
  -- Analytics
  analytics JSONB DEFAULT '{}',
  
  -- Execution tracking
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Multi-channel execution log
CREATE TABLE multi_channel_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES multi_channel_campaigns(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Execution details
  sequence_step INTEGER NOT NULL,
  channel TEXT NOT NULL,
  channel_campaign_id UUID,
  
  -- Target information
  lead_id UUID REFERENCES leads(id),
  contact_identifier TEXT NOT NULL, -- email, phone, linkedin_url, twitter_handle
  
  -- Execution status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'executing', 'completed', 'failed', 'skipped')),
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE,
  
  -- Results
  result JSONB DEFAULT '{}',
  error_message TEXT,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_multi_channel_campaigns_workspace ON multi_channel_campaigns(workspace_id);
CREATE INDEX idx_multi_channel_campaigns_status ON multi_channel_campaigns(status);
CREATE INDEX idx_multi_channel_campaigns_created_at ON multi_channel_campaigns(created_at);

CREATE INDEX idx_linkedin_campaigns_workspace ON linkedin_campaigns(workspace_id);
CREATE INDEX idx_linkedin_campaigns_parent ON linkedin_campaigns(parent_campaign_id);
CREATE INDEX idx_linkedin_campaigns_status ON linkedin_campaigns(status);

CREATE INDEX idx_twitter_campaigns_workspace ON twitter_campaigns(workspace_id);
CREATE INDEX idx_twitter_campaigns_parent ON twitter_campaigns(parent_campaign_id);
CREATE INDEX idx_twitter_campaigns_status ON twitter_campaigns(status);

CREATE INDEX idx_sms_campaigns_workspace ON sms_campaigns(workspace_id);
CREATE INDEX idx_sms_campaigns_parent ON sms_campaigns(parent_campaign_id);
CREATE INDEX idx_sms_campaigns_status ON sms_campaigns(status);

CREATE INDEX idx_multi_channel_executions_campaign ON multi_channel_executions(campaign_id);
CREATE INDEX idx_multi_channel_executions_scheduled ON multi_channel_executions(scheduled_at);
CREATE INDEX idx_multi_channel_executions_status ON multi_channel_executions(status);
CREATE INDEX idx_multi_channel_executions_lead ON multi_channel_executions(lead_id);

-- RLS Policies

-- Multi-channel campaigns
ALTER TABLE multi_channel_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view multi-channel campaigns in their workspace" ON multi_channel_campaigns
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Campaign managers can create multi-channel campaigns" ON multi_channel_campaigns
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid() 
      AND role IN ('workspace_admin', 'campaign_manager')
    )
  );

CREATE POLICY "Campaign managers can update multi-channel campaigns" ON multi_channel_campaigns
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid() 
      AND role IN ('workspace_admin', 'campaign_manager')
    )
  );

-- LinkedIn campaigns
ALTER TABLE linkedin_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view LinkedIn campaigns in their workspace" ON linkedin_campaigns
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Campaign managers can manage LinkedIn campaigns" ON linkedin_campaigns
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid() 
      AND role IN ('workspace_admin', 'campaign_manager')
    )
  );

-- Twitter campaigns
ALTER TABLE twitter_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view Twitter campaigns in their workspace" ON twitter_campaigns
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Campaign managers can manage Twitter campaigns" ON twitter_campaigns
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid() 
      AND role IN ('workspace_admin', 'campaign_manager')
    )
  );

-- SMS campaigns
ALTER TABLE sms_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view SMS campaigns in their workspace" ON sms_campaigns
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Campaign managers can manage SMS campaigns" ON sms_campaigns
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid() 
      AND role IN ('workspace_admin', 'campaign_manager')
    )
  );

-- Multi-channel executions
ALTER TABLE multi_channel_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view executions in their workspace" ON multi_channel_executions
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

-- Analytics
ALTER TABLE multi_channel_campaign_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view analytics in their workspace" ON multi_channel_campaign_analytics
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

-- Functions for multi-channel campaign management

-- Function to calculate multi-channel campaign analytics
CREATE OR REPLACE FUNCTION calculate_multi_channel_analytics(p_campaign_id UUID)
RETURNS VOID AS $$
DECLARE
  campaign_record multi_channel_campaigns%ROWTYPE;
  analytics_record multi_channel_campaign_analytics%ROWTYPE;
BEGIN
  -- Get campaign record
  SELECT * INTO campaign_record FROM multi_channel_campaigns WHERE id = p_campaign_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Initialize analytics record
  SELECT * INTO analytics_record FROM multi_channel_campaign_analytics WHERE campaign_id = p_campaign_id;
  
  IF NOT FOUND THEN
    INSERT INTO multi_channel_campaign_analytics (campaign_id, workspace_id)
    VALUES (p_campaign_id, campaign_record.workspace_id)
    RETURNING * INTO analytics_record;
  END IF;
  
  -- Calculate overall metrics from executions
  UPDATE multi_channel_campaign_analytics SET
    total_targeted = (
      SELECT COUNT(DISTINCT lead_id)
      FROM multi_channel_executions
      WHERE campaign_id = p_campaign_id
    ),
    total_reached = (
      SELECT COUNT(*)
      FROM multi_channel_executions
      WHERE campaign_id = p_campaign_id
      AND status = 'completed'
    ),
    total_engaged = (
      SELECT COUNT(*)
      FROM multi_channel_executions e
      JOIN leads l ON e.lead_id = l.id
      WHERE e.campaign_id = p_campaign_id
      AND l.status = 'engaged'
    ),
    total_converted = (
      SELECT COUNT(*)
      FROM multi_channel_executions e
      JOIN leads l ON e.lead_id = l.id
      WHERE e.campaign_id = p_campaign_id
      AND l.status = 'converted'
    ),
    last_calculated_at = NOW()
  WHERE campaign_id = p_campaign_id;
END;
$$ LANGUAGE plpgsql;

-- Function to schedule multi-channel campaign execution
CREATE OR REPLACE FUNCTION schedule_multi_channel_campaign(p_campaign_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  campaign_record multi_channel_campaigns%ROWTYPE;
  target_leads RECORD;
  sequence_step RECORD;
  execution_time TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get campaign
  SELECT * INTO campaign_record FROM multi_channel_campaigns WHERE id = p_campaign_id;
  
  IF NOT FOUND OR campaign_record.status != 'draft' THEN
    RETURN FALSE;
  END IF;
  
  -- Get target leads based on audience configuration
  FOR target_leads IN
    SELECT l.id, l.email, l.phone, l.enrichment_data
    FROM leads l
    WHERE l.workspace_id = campaign_record.workspace_id
    AND (
      campaign_record.target_audience->>'leadLists' IS NULL
      OR l.list_id = ANY(
        SELECT jsonb_array_elements_text(campaign_record.target_audience->'leadLists')::UUID
      )
    )
    AND l.status = 'active'
  LOOP
    -- Schedule execution for each sequence step
    FOR sequence_step IN
      SELECT 
        value->>'step' as step_number,
        value->>'triggerType' as trigger_type,
        value->>'triggerValue' as trigger_value,
        value->'channels' as channels
      FROM jsonb_array_elements(campaign_record.sequence_config)
    LOOP
      -- Calculate execution time based on trigger
      IF sequence_step.trigger_type = 'immediate' THEN
        execution_time := NOW();
      ELSIF sequence_step.trigger_type = 'delay' THEN
        execution_time := NOW() + INTERVAL '1 hour' * (sequence_step.trigger_value::INTEGER);
      ELSE
        execution_time := NOW() + INTERVAL '24 hours'; -- Default delay
      END IF;
      
      -- Create execution records for enabled channels
      INSERT INTO multi_channel_executions (
        campaign_id,
        workspace_id,
        sequence_step,
        channel,
        lead_id,
        contact_identifier,
        scheduled_at
      )
      SELECT 
        p_campaign_id,
        campaign_record.workspace_id,
        sequence_step.step_number::INTEGER,
        channel_config->>'channel',
        target_leads.id,
        CASE 
          WHEN channel_config->>'channel' = 'email' THEN target_leads.email
          WHEN channel_config->>'channel' = 'sms' THEN target_leads.phone
          WHEN channel_config->>'channel' = 'linkedin' THEN target_leads.enrichment_data->>'linkedin_url'
          WHEN channel_config->>'channel' = 'twitter' THEN target_leads.enrichment_data->>'twitter_handle'
          ELSE target_leads.email
        END,
        execution_time
      FROM jsonb_array_elements(sequence_step.channels) as channel_config
      WHERE (channel_config->>'isEnabled')::BOOLEAN = TRUE;
    END LOOP;
  END LOOP;
  
  -- Update campaign status
  UPDATE multi_channel_campaigns SET
    status = 'scheduled',
    started_at = NOW(),
    updated_at = NOW()
  WHERE id = p_campaign_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_multi_channel_campaigns_updated_at 
  BEFORE UPDATE ON multi_channel_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_linkedin_campaigns_updated_at 
  BEFORE UPDATE ON linkedin_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_twitter_campaigns_updated_at 
  BEFORE UPDATE ON twitter_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sms_campaigns_updated_at 
  BEFORE UPDATE ON sms_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();