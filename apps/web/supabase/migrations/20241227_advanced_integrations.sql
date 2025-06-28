-- Advanced Integrations
-- Slack, Zapier, Gmail, and other third-party service integrations

-- Integration Providers Table
CREATE TABLE IF NOT EXISTS integration_providers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Provider details
  name VARCHAR(50) NOT NULL UNIQUE, -- 'slack', 'zapier', 'gmail', 'webhook', etc.
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  category VARCHAR(30) NOT NULL, -- 'communication', 'automation', 'email', 'crm', etc.
  
  -- Configuration
  auth_type VARCHAR(20) NOT NULL, -- 'oauth2', 'api_key', 'webhook', 'none'
  auth_config JSONB DEFAULT '{}', -- OAuth URLs, scopes, etc.
  webhook_support BOOLEAN DEFAULT false,
  rate_limits JSONB DEFAULT '{}', -- Rate limiting configuration
  
  -- Capabilities
  supported_events TEXT[] DEFAULT '{}', -- Events this provider can handle
  supported_actions TEXT[] DEFAULT '{}', -- Actions this provider can perform
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_premium BOOLEAN DEFAULT false,
  
  -- Metadata
  icon_url VARCHAR(255),
  website_url VARCHAR(255),
  documentation_url VARCHAR(255),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workspace Integrations Table
CREATE TABLE IF NOT EXISTS workspace_integrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- User who set up integration
  
  -- Integration details
  provider_id UUID NOT NULL REFERENCES integration_providers(id) ON DELETE CASCADE,
  integration_name VARCHAR(100) NOT NULL, -- User-defined name
  
  -- Authentication
  auth_data JSONB DEFAULT '{}', -- Encrypted OAuth tokens, API keys, etc.
  auth_expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Configuration
  settings JSONB DEFAULT '{}', -- Provider-specific settings
  webhook_url VARCHAR(255), -- Webhook endpoint if applicable
  webhook_secret VARCHAR(255), -- Webhook verification secret
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  last_error TEXT,
  sync_status VARCHAR(20) DEFAULT 'active', -- 'active', 'error', 'paused', 'disconnected'
  
  -- Usage tracking
  total_executions INTEGER DEFAULT 0,
  last_execution_at TIMESTAMP WITH TIME ZONE,
  monthly_executions INTEGER DEFAULT 0,
  monthly_reset_date DATE DEFAULT CURRENT_DATE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint per workspace/provider (only one integration per provider per workspace)
  UNIQUE(workspace_id, provider_id)
);

-- Integration Automations Table
CREATE TABLE IF NOT EXISTS integration_automations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Automation details
  name VARCHAR(100) NOT NULL,
  description TEXT,
  
  -- Trigger configuration
  trigger_provider_id UUID REFERENCES integration_providers(id),
  trigger_event VARCHAR(50) NOT NULL, -- 'campaign_completed', 'lead_replied', etc.
  trigger_conditions JSONB DEFAULT '{}', -- Conditions for trigger
  
  -- Action configuration
  action_provider_id UUID REFERENCES integration_providers(id),
  action_type VARCHAR(50) NOT NULL, -- 'send_message', 'create_task', etc.
  action_config JSONB DEFAULT '{}', -- Action-specific configuration
  
  -- Flow control
  is_active BOOLEAN DEFAULT true,
  execution_order INTEGER DEFAULT 0,
  max_executions INTEGER, -- Limit executions per time period
  execution_window_hours INTEGER DEFAULT 24,
  
  -- Error handling
  retry_attempts INTEGER DEFAULT 3,
  retry_delay_minutes INTEGER DEFAULT 5,
  on_error VARCHAR(20) DEFAULT 'retry', -- 'retry', 'skip', 'pause'
  
  -- Statistics
  total_executions INTEGER DEFAULT 0,
  successful_executions INTEGER DEFAULT 0,
  failed_executions INTEGER DEFAULT 0,
  last_execution_at TIMESTAMP WITH TIME ZONE,
  last_success_at TIMESTAMP WITH TIME ZONE,
  last_error_at TIMESTAMP WITH TIME ZONE,
  last_error TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Integration Execution Logs Table
CREATE TABLE IF NOT EXISTS integration_execution_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Execution details
  automation_id UUID REFERENCES integration_automations(id) ON DELETE SET NULL,
  provider_id UUID REFERENCES integration_providers(id),
  execution_type VARCHAR(20) NOT NULL, -- 'automation', 'manual', 'webhook'
  
  -- Request/Response
  trigger_event VARCHAR(50),
  trigger_data JSONB DEFAULT '{}',
  action_type VARCHAR(50),
  action_data JSONB DEFAULT '{}',
  
  -- Result
  status VARCHAR(20) NOT NULL, -- 'success', 'failed', 'partial'
  response_data JSONB DEFAULT '{}',
  error_message TEXT,
  execution_duration_ms INTEGER,
  
  -- Metadata
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address INET,
  user_agent TEXT,
  
  -- Timestamps
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Slack Integration Specific Tables
CREATE TABLE IF NOT EXISTS slack_channels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_integration_id UUID NOT NULL REFERENCES workspace_integrations(id) ON DELETE CASCADE,
  
  -- Channel details
  slack_channel_id VARCHAR(100) NOT NULL,
  channel_name VARCHAR(100) NOT NULL,
  is_private BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  
  -- Sync settings
  sync_enabled BOOLEAN DEFAULT true,
  sync_types TEXT[] DEFAULT '{"campaign_updates", "replies", "errors"}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(workspace_integration_id, slack_channel_id)
);

-- Zapier Webhooks Table
CREATE TABLE IF NOT EXISTS zapier_webhooks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_integration_id UUID NOT NULL REFERENCES workspace_integrations(id) ON DELETE CASCADE,
  
  -- Webhook details
  webhook_name VARCHAR(100) NOT NULL,
  webhook_url VARCHAR(500) NOT NULL,
  webhook_secret VARCHAR(255),
  
  -- Trigger configuration
  trigger_events TEXT[] DEFAULT '{}', -- Events that trigger this webhook
  event_filters JSONB DEFAULT '{}', -- Filters for events
  
  -- Data configuration
  payload_template JSONB DEFAULT '{}', -- Template for webhook payload
  include_metadata BOOLEAN DEFAULT true,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  total_triggers INTEGER DEFAULT 0,
  failed_triggers INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Gmail Integration Tables
CREATE TABLE IF NOT EXISTS gmail_labels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_integration_id UUID NOT NULL REFERENCES workspace_integrations(id) ON DELETE CASCADE,
  
  -- Label details
  gmail_label_id VARCHAR(100) NOT NULL,
  label_name VARCHAR(100) NOT NULL,
  label_type VARCHAR(20) DEFAULT 'user', -- 'system', 'user'
  
  -- Sync settings
  sync_enabled BOOLEAN DEFAULT false,
  auto_apply_rules JSONB DEFAULT '{}', -- Rules for auto-applying labels
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(workspace_integration_id, gmail_label_id)
);

CREATE TABLE IF NOT EXISTS gmail_sync_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_integration_id UUID NOT NULL REFERENCES workspace_integrations(id) ON DELETE CASCADE,
  
  -- Sync details
  sync_type VARCHAR(20) NOT NULL, -- 'inbox', 'sent', 'labels'
  gmail_history_id VARCHAR(50),
  
  -- Results
  messages_processed INTEGER DEFAULT 0,
  messages_imported INTEGER DEFAULT 0,
  messages_updated INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,
  
  -- Status
  status VARCHAR(20) NOT NULL, -- 'running', 'completed', 'failed'
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Error details
  error_message TEXT,
  error_details JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_integration_providers_name ON integration_providers(name);
CREATE INDEX idx_integration_providers_category ON integration_providers(category);
CREATE INDEX idx_integration_providers_active ON integration_providers(is_active) WHERE is_active = true;

CREATE INDEX idx_workspace_integrations_workspace ON workspace_integrations(workspace_id);
CREATE INDEX idx_workspace_integrations_provider ON workspace_integrations(provider_id);
CREATE INDEX idx_workspace_integrations_active ON workspace_integrations(workspace_id, is_active) WHERE is_active = true;
CREATE INDEX idx_workspace_integrations_sync_status ON workspace_integrations(sync_status);

CREATE INDEX idx_integration_automations_workspace ON integration_automations(workspace_id);
CREATE INDEX idx_integration_automations_trigger_event ON integration_automations(trigger_event);
CREATE INDEX idx_integration_automations_active ON integration_automations(workspace_id, is_active) WHERE is_active = true;
CREATE INDEX idx_integration_automations_execution_order ON integration_automations(workspace_id, execution_order);

CREATE INDEX idx_integration_execution_logs_workspace ON integration_execution_logs(workspace_id);
CREATE INDEX idx_integration_execution_logs_automation ON integration_execution_logs(automation_id);
CREATE INDEX idx_integration_execution_logs_status ON integration_execution_logs(status);
CREATE INDEX idx_integration_execution_logs_created_at ON integration_execution_logs(created_at DESC);

CREATE INDEX idx_slack_channels_workspace_integration ON slack_channels(workspace_integration_id);
CREATE INDEX idx_slack_channels_channel_id ON slack_channels(slack_channel_id);

CREATE INDEX idx_zapier_webhooks_workspace_integration ON zapier_webhooks(workspace_integration_id);
CREATE INDEX idx_zapier_webhooks_active ON zapier_webhooks(is_active) WHERE is_active = true;

CREATE INDEX idx_gmail_labels_workspace_integration ON gmail_labels(workspace_integration_id);
CREATE INDEX idx_gmail_labels_sync_enabled ON gmail_labels(sync_enabled) WHERE sync_enabled = true;

CREATE INDEX idx_gmail_sync_history_workspace_integration ON gmail_sync_history(workspace_integration_id);
CREATE INDEX idx_gmail_sync_history_status ON gmail_sync_history(status);

-- Enable RLS
ALTER TABLE integration_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE slack_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE zapier_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE gmail_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE gmail_sync_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Integration providers are publicly readable" ON integration_providers
  FOR SELECT USING (is_active = true);

CREATE POLICY "Users can view integrations in their workspace" ON workspace_integrations
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM user_profiles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage integrations in their workspace" ON workspace_integrations
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM user_profiles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view automations in their workspace" ON integration_automations
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM user_profiles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage automations in their workspace" ON integration_automations
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM user_profiles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view execution logs in their workspace" ON integration_execution_logs
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM user_profiles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert execution logs" ON integration_execution_logs
  FOR INSERT WITH CHECK (true);

-- Apply similar policies to integration-specific tables
CREATE POLICY "Users can manage slack channels in their workspace" ON slack_channels
  FOR ALL USING (
    workspace_integration_id IN (
      SELECT id FROM workspace_integrations 
      WHERE workspace_id IN (
        SELECT workspace_id FROM user_profiles 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage zapier webhooks in their workspace" ON zapier_webhooks
  FOR ALL USING (
    workspace_integration_id IN (
      SELECT id FROM workspace_integrations 
      WHERE workspace_id IN (
        SELECT workspace_id FROM user_profiles 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage gmail labels in their workspace" ON gmail_labels
  FOR ALL USING (
    workspace_integration_id IN (
      SELECT id FROM workspace_integrations 
      WHERE workspace_id IN (
        SELECT workspace_id FROM user_profiles 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can view gmail sync history in their workspace" ON gmail_sync_history
  FOR SELECT USING (
    workspace_integration_id IN (
      SELECT id FROM workspace_integrations 
      WHERE workspace_id IN (
        SELECT workspace_id FROM user_profiles 
        WHERE user_id = auth.uid()
      )
    )
  );

-- Functions for integration management
CREATE OR REPLACE FUNCTION update_workspace_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_integration_automations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER trigger_workspace_integrations_updated_at
  BEFORE UPDATE ON workspace_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_workspace_integrations_updated_at();

CREATE TRIGGER trigger_integration_automations_updated_at
  BEFORE UPDATE ON integration_automations
  FOR EACH ROW
  EXECUTE FUNCTION update_integration_automations_updated_at();

-- Function to execute automation
CREATE OR REPLACE FUNCTION execute_integration_automation(
  p_automation_id UUID,
  p_trigger_data JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  automation_record RECORD;
  execution_id UUID;
  execution_result JSONB;
BEGIN
  -- Get automation details
  SELECT * INTO automation_record
  FROM integration_automations
  WHERE id = p_automation_id AND is_active = true;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Automation not found or inactive';
  END IF;
  
  -- Create execution log
  INSERT INTO integration_execution_logs (
    workspace_id,
    automation_id,
    provider_id,
    execution_type,
    trigger_event,
    trigger_data,
    action_type,
    action_data,
    status,
    started_at
  ) VALUES (
    automation_record.workspace_id,
    p_automation_id,
    automation_record.action_provider_id,
    'automation',
    automation_record.trigger_event,
    p_trigger_data,
    automation_record.action_type,
    automation_record.action_config,
    'running',
    NOW()
  ) RETURNING id INTO execution_id;
  
  -- Update automation statistics
  UPDATE integration_automations
  SET 
    total_executions = total_executions + 1,
    last_execution_at = NOW()
  WHERE id = p_automation_id;
  
  RETURN execution_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log integration execution result
CREATE OR REPLACE FUNCTION log_integration_execution_result(
  p_execution_id UUID,
  p_status VARCHAR(20),
  p_response_data JSONB DEFAULT '{}',
  p_error_message TEXT DEFAULT NULL,
  p_duration_ms INTEGER DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE integration_execution_logs
  SET
    status = p_status,
    response_data = p_response_data,
    error_message = p_error_message,
    execution_duration_ms = p_duration_ms,
    completed_at = NOW()
  WHERE id = p_execution_id;
  
  -- Update automation success/failure counts
  IF p_status = 'success' THEN
    UPDATE integration_automations
    SET 
      successful_executions = successful_executions + 1,
      last_success_at = NOW()
    WHERE id = (SELECT automation_id FROM integration_execution_logs WHERE id = p_execution_id);
  ELSE
    UPDATE integration_automations
    SET 
      failed_executions = failed_executions + 1,
      last_error_at = NOW(),
      last_error = p_error_message
    WHERE id = (SELECT automation_id FROM integration_execution_logs WHERE id = p_execution_id);
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert default integration providers
INSERT INTO integration_providers (name, display_name, description, category, auth_type, supported_events, supported_actions, icon_url, website_url) VALUES
('slack', 'Slack', 'Send notifications and updates to Slack channels', 'communication', 'oauth2', 
 ARRAY['campaign_completed', 'lead_replied', 'campaign_started', 'error_occurred'], 
 ARRAY['send_message', 'create_channel', 'invite_user'], 
 '/integrations/slack-icon.png', 'https://slack.com'),

('zapier', 'Zapier', 'Connect ColdCopy to 5000+ apps with Zapier', 'automation', 'webhook', 
 ARRAY['campaign_completed', 'lead_created', 'lead_updated', 'lead_replied', 'campaign_started'],
 ARRAY['trigger_zap', 'webhook'], 
 '/integrations/zapier-icon.png', 'https://zapier.com'),

('gmail', 'Gmail', 'Sync emails and manage Gmail labels', 'email', 'oauth2',
 ARRAY['email_received', 'email_sent', 'label_applied'],
 ARRAY['send_email', 'create_label', 'apply_label', 'sync_messages'],
 '/integrations/gmail-icon.png', 'https://gmail.com'),

('webhook', 'Custom Webhook', 'Send data to any webhook URL', 'automation', 'none',
 ARRAY['campaign_completed', 'lead_created', 'lead_updated', 'lead_replied', 'campaign_started', 'error_occurred'],
 ARRAY['webhook_post', 'webhook_put'],
 '/integrations/webhook-icon.png', ''),

('microsoft_teams', 'Microsoft Teams', 'Send notifications to Teams channels', 'communication', 'oauth2',
 ARRAY['campaign_completed', 'lead_replied', 'campaign_started', 'error_occurred'],
 ARRAY['send_message', 'create_channel'],
 '/integrations/teams-icon.png', 'https://teams.microsoft.com'),

('discord', 'Discord', 'Send notifications to Discord servers', 'communication', 'webhook',
 ARRAY['campaign_completed', 'lead_replied', 'campaign_started', 'error_occurred'],
 ARRAY['send_message'],
 '/integrations/discord-icon.png', 'https://discord.com');

-- Sample automation data
DO $$
DECLARE
  workspace_uuid UUID;
  slack_provider_id UUID;
  zapier_provider_id UUID;
BEGIN
  -- Get first workspace for demo data
  SELECT id INTO workspace_uuid FROM workspaces LIMIT 1;
  SELECT id INTO slack_provider_id FROM integration_providers WHERE name = 'slack';
  SELECT id INTO zapier_provider_id FROM integration_providers WHERE name = 'zapier';
  
  IF workspace_uuid IS NOT NULL AND slack_provider_id IS NOT NULL THEN
    -- Sample Slack automation
    INSERT INTO integration_automations (
      workspace_id,
      name,
      description,
      trigger_event,
      action_provider_id,
      action_type,
      action_config,
      trigger_conditions
    ) VALUES (
      workspace_uuid,
      'Notify on Campaign Completion',
      'Send Slack message when email campaign completes',
      'campaign_completed',
      slack_provider_id,
      'send_message',
      jsonb_build_object(
        'channel', '#general',
        'message', 'Campaign "{{campaign_name}}" completed! Sent {{total_sent}} emails with {{open_rate}}% open rate.'
      ),
      jsonb_build_object('min_sent_count', 10)
    );
    
    -- Sample Zapier automation
    IF zapier_provider_id IS NOT NULL THEN
      INSERT INTO integration_automations (
        workspace_id,
        name,
        description,
        trigger_event,
        action_provider_id,
        action_type,
        action_config
      ) VALUES (
        workspace_uuid,
        'New Lead to CRM',
        'Send new leads to CRM via Zapier',
        'lead_created',
        zapier_provider_id,
        'trigger_zap',
        jsonb_build_object(
          'webhook_url', 'https://hooks.zapier.com/hooks/catch/123456/abcdef/',
          'include_fields', ARRAY['name', 'email', 'company', 'source']
        )
      );
    END IF;
  END IF;
END $$;