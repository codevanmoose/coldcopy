-- Pipedrive Deal Management System Schema
-- This migration adds comprehensive database support for the Pipedrive deal management features

-- Deal value calculations table
CREATE TABLE IF NOT EXISTS pipedrive_deal_value_calculations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    deal_id BIGINT NOT NULL,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    base_value DECIMAL(15,2) NOT NULL DEFAULT 0,
    calculated_value DECIMAL(15,2) NOT NULL DEFAULT 0,
    confidence INTEGER NOT NULL DEFAULT 50 CHECK (confidence >= 0 AND confidence <= 100),
    factors JSONB NOT NULL DEFAULT '[]'::jsonb,
    calculation_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Deal timeline events
CREATE TABLE IF NOT EXISTS pipedrive_deal_timeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    deal_id BIGINT NOT NULL,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stage progression rules
CREATE TABLE IF NOT EXISTS pipedrive_stage_progression_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    from_stage_id BIGINT NOT NULL,
    to_stage_id BIGINT NOT NULL,
    auto_progress BOOLEAN NOT NULL DEFAULT false,
    conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
    delay_hours INTEGER DEFAULT NULL,
    requires_approval BOOLEAN NOT NULL DEFAULT false,
    approval_users BIGINT[] DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stage approvals
CREATE TABLE IF NOT EXISTS pipedrive_stage_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    deal_id BIGINT NOT NULL,
    from_stage_id BIGINT NOT NULL,
    to_stage_id BIGINT NOT NULL,
    requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reason TEXT,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    approved_at TIMESTAMPTZ DEFAULT NULL
);

-- Automation rules
CREATE TABLE IF NOT EXISTS pipedrive_automation_rules (
    id TEXT PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    enabled BOOLEAN NOT NULL DEFAULT true,
    priority INTEGER NOT NULL DEFAULT 0,
    conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
    actions JSONB NOT NULL DEFAULT '[]'::jsonb,
    triggers JSONB NOT NULL DEFAULT '[]'::jsonb,
    schedule JSONB DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Automation executions log
CREATE TABLE IF NOT EXISTS pipedrive_automation_executions (
    id TEXT PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    rule_id TEXT NOT NULL REFERENCES pipedrive_automation_rules(id) ON DELETE CASCADE,
    deal_id BIGINT NOT NULL,
    triggered_by TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ DEFAULT NULL,
    actions_results JSONB DEFAULT NULL,
    error_message TEXT DEFAULT NULL
);

-- Automation logs
CREATE TABLE IF NOT EXISTS pipedrive_automation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    deal_id BIGINT DEFAULT NULL,
    action_type TEXT NOT NULL,
    data JSONB DEFAULT NULL,
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'error')),
    error_message TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Workflow triggers
CREATE TABLE IF NOT EXISTS pipedrive_workflow_triggers (
    id TEXT PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    stage_id BIGINT NOT NULL,
    conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
    actions JSONB NOT NULL DEFAULT '[]'::jsonb,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Workflow executions
CREATE TABLE IF NOT EXISTS pipedrive_workflow_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    deal_id BIGINT NOT NULL,
    action_type TEXT NOT NULL,
    action_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'failed')),
    error_message TEXT DEFAULT NULL
);

-- Revenue forecasts
CREATE TABLE IF NOT EXISTS pipedrive_revenue_forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    period TEXT NOT NULL CHECK (period IN ('monthly', 'quarterly', 'yearly')),
    forecast_type TEXT NOT NULL CHECK (forecast_type IN ('conservative', 'realistic', 'optimistic')),
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    total_pipeline DECIMAL(15,2) NOT NULL DEFAULT 0,
    weighted_pipeline DECIMAL(15,2) NOT NULL DEFAULT 0,
    projected_revenue DECIMAL(15,2) NOT NULL DEFAULT 0,
    actual_revenue DECIMAL(15,2) DEFAULT NULL,
    confidence INTEGER NOT NULL DEFAULT 50 CHECK (confidence >= 0 AND confidence <= 100),
    breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,
    assumptions JSONB NOT NULL DEFAULT '[]'::jsonb,
    risks JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Forecast history for accuracy tracking
CREATE TABLE IF NOT EXISTS pipedrive_forecast_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    period TEXT NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    total_value DECIMAL(15,2) NOT NULL DEFAULT 0,
    weighted_value DECIMAL(15,2) NOT NULL DEFAULT 0,
    actual_value DECIMAL(15,2) DEFAULT NULL,
    deals_count INTEGER NOT NULL DEFAULT 0,
    confidence INTEGER NOT NULL DEFAULT 50,
    breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,
    forecast_date TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Campaign triggers
CREATE TABLE IF NOT EXISTS pipedrive_campaign_triggers (
    id TEXT PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    enabled BOOLEAN NOT NULL DEFAULT true,
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('deal_created', 'deal_updated', 'stage_changed', 'deal_won', 'deal_lost', 'activity_completed', 'time_based')),
    conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
    campaign_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
    schedule JSONB DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Campaign action logs
CREATE TABLE IF NOT EXISTS pipedrive_campaign_action_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    trigger_id TEXT NOT NULL REFERENCES pipedrive_campaign_triggers(id) ON DELETE CASCADE,
    deal_id BIGINT NOT NULL,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    action_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    result JSONB DEFAULT NULL,
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'failed')),
    error_message TEXT DEFAULT NULL,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Campaign logs
CREATE TABLE IF NOT EXISTS pipedrive_campaign_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    deal_id BIGINT DEFAULT NULL,
    event_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'error')),
    error_message TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Deal campaign sync
CREATE TABLE IF NOT EXISTS pipedrive_deal_campaign_sync (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    deal_id BIGINT NOT NULL,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    active_campaigns TEXT[] DEFAULT '{}',
    active_sequences TEXT[] DEFAULT '{}',
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    sync_status TEXT NOT NULL DEFAULT 'active' CHECK (sync_status IN ('active', 'paused', 'completed', 'error')),
    metadata JSONB DEFAULT '{}'::jsonb,
    UNIQUE(workspace_id, deal_id)
);

-- Notification rules
CREATE TABLE IF NOT EXISTS pipedrive_notification_rules (
    id TEXT PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    enabled BOOLEAN NOT NULL DEFAULT true,
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    triggers JSONB NOT NULL DEFAULT '[]'::jsonb,
    conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
    recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
    channels JSONB NOT NULL DEFAULT '[]'::jsonb,
    template JSONB NOT NULL DEFAULT '{}'::jsonb,
    schedule JSONB DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notification logs
CREATE TABLE IF NOT EXISTS pipedrive_notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    rule_id TEXT NOT NULL REFERENCES pipedrive_notification_rules(id) ON DELETE CASCADE,
    deal_id BIGINT NOT NULL,
    event_type TEXT NOT NULL,
    channel_type TEXT NOT NULL,
    recipients BIGINT[] NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
    error_message TEXT DEFAULT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Deal collaboration
CREATE TABLE IF NOT EXISTS pipedrive_deal_collaboration (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    deal_id BIGINT NOT NULL,
    participants JSONB NOT NULL DEFAULT '[]'::jsonb,
    permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(workspace_id, deal_id)
);

-- Deal activities (comments, updates, etc.)
CREATE TABLE IF NOT EXISTS pipedrive_deal_activities (
    id TEXT PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    deal_id BIGINT NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL CHECK (activity_type IN ('comment', 'update', 'mention', 'file_upload', 'status_change')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Deal mentions
CREATE TABLE IF NOT EXISTS pipedrive_deal_mentions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    deal_id BIGINT NOT NULL,
    from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_id TEXT NOT NULL REFERENCES pipedrive_deal_activities(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Deal watchers
CREATE TABLE IF NOT EXISTS pipedrive_deal_watchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    deal_id BIGINT NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(workspace_id, deal_id, user_id)
);

-- Deal health history
CREATE TABLE IF NOT EXISTS pipedrive_deal_health_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    deal_id BIGINT NOT NULL,
    health_score INTEGER NOT NULL CHECK (health_score >= 0 AND health_score <= 100),
    health_trend TEXT NOT NULL CHECK (health_trend IN ('improving', 'declining', 'stable')),
    risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    predicted_outcome TEXT CHECK (predicted_outcome IN ('win', 'loss', 'stall')),
    win_probability DECIMAL(5,4) DEFAULT NULL CHECK (win_probability >= 0 AND win_probability <= 1),
    factors JSONB NOT NULL DEFAULT '[]'::jsonb,
    action_items JSONB NOT NULL DEFAULT '[]'::jsonb,
    optimizations JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pipedrive deals (local cache/sync table)
CREATE TABLE IF NOT EXISTS pipedrive_deals (
    id BIGINT PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    value DECIMAL(15,2) DEFAULT NULL,
    currency TEXT DEFAULT 'USD',
    person_id BIGINT DEFAULT NULL,
    org_id BIGINT DEFAULT NULL,
    stage_id BIGINT NOT NULL,
    pipeline_id BIGINT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('open', 'won', 'lost', 'deleted')),
    probability INTEGER DEFAULT NULL CHECK (probability >= 0 AND probability <= 100),
    owner_id BIGINT NOT NULL,
    creator_user_id BIGINT DEFAULT NULL,
    add_time TIMESTAMPTZ NOT NULL,
    update_time TIMESTAMPTZ NOT NULL,
    stage_change_time TIMESTAMPTZ DEFAULT NULL,
    won_time TIMESTAMPTZ DEFAULT NULL,
    lost_time TIMESTAMPTZ DEFAULT NULL,
    close_time TIMESTAMPTZ DEFAULT NULL,
    lost_reason TEXT DEFAULT NULL,
    expected_close_date DATE DEFAULT NULL,
    weighted_value DECIMAL(15,2) DEFAULT NULL,
    weighted_value_currency TEXT DEFAULT NULL,
    visible_to TEXT DEFAULT NULL,
    custom_fields JSONB DEFAULT '{}'::jsonb,
    notes_count INTEGER DEFAULT 0,
    files_count INTEGER DEFAULT 0,
    followers_count INTEGER DEFAULT 0,
    email_messages_count INTEGER DEFAULT 0,
    activities_count INTEGER DEFAULT 0,
    done_activities_count INTEGER DEFAULT 0,
    undone_activities_count INTEGER DEFAULT 0,
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pipedrive stages (local cache)
CREATE TABLE IF NOT EXISTS pipedrive_stages (
    id BIGINT PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    order_nr INTEGER NOT NULL,
    active_flag BOOLEAN NOT NULL DEFAULT true,
    deal_probability INTEGER NOT NULL DEFAULT 50 CHECK (deal_probability >= 0 AND deal_probability <= 100),
    pipeline_id BIGINT NOT NULL,
    rotten_flag BOOLEAN NOT NULL DEFAULT false,
    rotten_days INTEGER DEFAULT NULL,
    add_time TIMESTAMPTZ NOT NULL,
    update_time TIMESTAMPTZ NOT NULL,
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pipedrive activities (local cache)
CREATE TABLE IF NOT EXISTS pipedrive_activities (
    id BIGINT PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    type TEXT NOT NULL,
    due_date DATE DEFAULT NULL,
    due_time TIME DEFAULT NULL,
    duration TEXT DEFAULT NULL,
    person_id BIGINT DEFAULT NULL,
    org_id BIGINT DEFAULT NULL,
    deal_id BIGINT DEFAULT NULL,
    done BOOLEAN NOT NULL DEFAULT false,
    add_time TIMESTAMPTZ NOT NULL,
    marked_as_done_time TIMESTAMPTZ DEFAULT NULL,
    note TEXT DEFAULT NULL,
    owner_id BIGINT NOT NULL,
    created_by_user_id BIGINT DEFAULT NULL,
    location TEXT DEFAULT NULL,
    public_description TEXT DEFAULT NULL,
    busy_flag BOOLEAN DEFAULT NULL,
    custom_fields JSONB DEFAULT '{}'::jsonb,
    update_time TIMESTAMPTZ DEFAULT NULL,
    active_flag BOOLEAN DEFAULT true,
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pipedrive_deal_value_calculations_workspace_deal ON pipedrive_deal_value_calculations(workspace_id, deal_id);
CREATE INDEX IF NOT EXISTS idx_pipedrive_deal_value_calculations_lead ON pipedrive_deal_value_calculations(lead_id);

CREATE INDEX IF NOT EXISTS idx_pipedrive_deal_timeline_workspace_deal ON pipedrive_deal_timeline(workspace_id, deal_id);
CREATE INDEX IF NOT EXISTS idx_pipedrive_deal_timeline_event_type ON pipedrive_deal_timeline(event_type);
CREATE INDEX IF NOT EXISTS idx_pipedrive_deal_timeline_created_at ON pipedrive_deal_timeline(created_at);

CREATE INDEX IF NOT EXISTS idx_pipedrive_stage_progression_rules_workspace ON pipedrive_stage_progression_rules(workspace_id);
CREATE INDEX IF NOT EXISTS idx_pipedrive_stage_progression_rules_from_stage ON pipedrive_stage_progression_rules(from_stage_id);

CREATE INDEX IF NOT EXISTS idx_pipedrive_automation_rules_workspace_enabled ON pipedrive_automation_rules(workspace_id, enabled);
CREATE INDEX IF NOT EXISTS idx_pipedrive_automation_executions_workspace_deal ON pipedrive_automation_executions(workspace_id, deal_id);
CREATE INDEX IF NOT EXISTS idx_pipedrive_automation_executions_rule ON pipedrive_automation_executions(rule_id);

CREATE INDEX IF NOT EXISTS idx_pipedrive_revenue_forecasts_workspace_period ON pipedrive_revenue_forecasts(workspace_id, period);
CREATE INDEX IF NOT EXISTS idx_pipedrive_revenue_forecasts_period_dates ON pipedrive_revenue_forecasts(period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_pipedrive_campaign_triggers_workspace_enabled ON pipedrive_campaign_triggers(workspace_id, enabled);
CREATE INDEX IF NOT EXISTS idx_pipedrive_campaign_action_logs_workspace_deal ON pipedrive_campaign_action_logs(workspace_id, deal_id);

CREATE INDEX IF NOT EXISTS idx_pipedrive_notification_rules_workspace_enabled ON pipedrive_notification_rules(workspace_id, enabled);
CREATE INDEX IF NOT EXISTS idx_pipedrive_notification_logs_workspace_deal ON pipedrive_notification_logs(workspace_id, deal_id);

CREATE INDEX IF NOT EXISTS idx_pipedrive_deal_collaboration_workspace_deal ON pipedrive_deal_collaboration(workspace_id, deal_id);
CREATE INDEX IF NOT EXISTS idx_pipedrive_deal_activities_workspace_deal ON pipedrive_deal_activities(workspace_id, deal_id);
CREATE INDEX IF NOT EXISTS idx_pipedrive_deal_activities_user ON pipedrive_deal_activities(user_id);

CREATE INDEX IF NOT EXISTS idx_pipedrive_deal_mentions_to_user_read ON pipedrive_deal_mentions(to_user_id, read);
CREATE INDEX IF NOT EXISTS idx_pipedrive_deal_watchers_workspace_deal ON pipedrive_deal_watchers(workspace_id, deal_id);

CREATE INDEX IF NOT EXISTS idx_pipedrive_deal_health_history_workspace_deal ON pipedrive_deal_health_history(workspace_id, deal_id);
CREATE INDEX IF NOT EXISTS idx_pipedrive_deal_health_history_created_at ON pipedrive_deal_health_history(created_at);

CREATE INDEX IF NOT EXISTS idx_pipedrive_deals_workspace_status ON pipedrive_deals(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_pipedrive_deals_stage ON pipedrive_deals(stage_id);
CREATE INDEX IF NOT EXISTS idx_pipedrive_deals_owner ON pipedrive_deals(owner_id);
CREATE INDEX IF NOT EXISTS idx_pipedrive_deals_expected_close_date ON pipedrive_deals(expected_close_date);

CREATE INDEX IF NOT EXISTS idx_pipedrive_stages_workspace_pipeline ON pipedrive_stages(workspace_id, pipeline_id);
CREATE INDEX IF NOT EXISTS idx_pipedrive_activities_workspace_deal ON pipedrive_activities(workspace_id, deal_id);
CREATE INDEX IF NOT EXISTS idx_pipedrive_activities_owner_done ON pipedrive_activities(owner_id, done);

-- Create updated_at triggers for tables that need them
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_pipedrive_deal_value_calculations_updated_at BEFORE UPDATE ON pipedrive_deal_value_calculations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pipedrive_stage_progression_rules_updated_at BEFORE UPDATE ON pipedrive_stage_progression_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pipedrive_automation_rules_updated_at BEFORE UPDATE ON pipedrive_automation_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pipedrive_workflow_triggers_updated_at BEFORE UPDATE ON pipedrive_workflow_triggers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pipedrive_campaign_triggers_updated_at BEFORE UPDATE ON pipedrive_campaign_triggers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pipedrive_notification_rules_updated_at BEFORE UPDATE ON pipedrive_notification_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pipedrive_deal_collaboration_updated_at BEFORE UPDATE ON pipedrive_deal_collaboration FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pipedrive_deals_updated_at BEFORE UPDATE ON pipedrive_deals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security policies
ALTER TABLE pipedrive_deal_value_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipedrive_deal_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipedrive_stage_progression_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipedrive_stage_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipedrive_automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipedrive_automation_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipedrive_automation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipedrive_workflow_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipedrive_workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipedrive_revenue_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipedrive_forecast_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipedrive_campaign_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipedrive_campaign_action_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipedrive_campaign_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipedrive_deal_campaign_sync ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipedrive_notification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipedrive_notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipedrive_deal_collaboration ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipedrive_deal_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipedrive_deal_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipedrive_deal_watchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipedrive_deal_health_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipedrive_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipedrive_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipedrive_activities ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (workspace isolation)
-- Helper function to check workspace access
CREATE OR REPLACE FUNCTION user_has_workspace_access(workspace_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM workspace_users 
        WHERE workspace_id = workspace_uuid 
        AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policies for all tables
CREATE POLICY "Users can access their workspace pipedrive data" ON pipedrive_deal_value_calculations FOR ALL USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can access their workspace pipedrive data" ON pipedrive_deal_timeline FOR ALL USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can access their workspace pipedrive data" ON pipedrive_stage_progression_rules FOR ALL USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can access their workspace pipedrive data" ON pipedrive_stage_approvals FOR ALL USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can access their workspace pipedrive data" ON pipedrive_automation_rules FOR ALL USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can access their workspace pipedrive data" ON pipedrive_automation_executions FOR ALL USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can access their workspace pipedrive data" ON pipedrive_automation_logs FOR ALL USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can access their workspace pipedrive data" ON pipedrive_workflow_triggers FOR ALL USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can access their workspace pipedrive data" ON pipedrive_workflow_executions FOR ALL USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can access their workspace pipedrive data" ON pipedrive_revenue_forecasts FOR ALL USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can access their workspace pipedrive data" ON pipedrive_forecast_history FOR ALL USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can access their workspace pipedrive data" ON pipedrive_campaign_triggers FOR ALL USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can access their workspace pipedrive data" ON pipedrive_campaign_action_logs FOR ALL USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can access their workspace pipedrive data" ON pipedrive_campaign_logs FOR ALL USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can access their workspace pipedrive data" ON pipedrive_deal_campaign_sync FOR ALL USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can access their workspace pipedrive data" ON pipedrive_notification_rules FOR ALL USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can access their workspace pipedrive data" ON pipedrive_notification_logs FOR ALL USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can access their workspace pipedrive data" ON pipedrive_deal_collaboration FOR ALL USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can access their workspace pipedrive data" ON pipedrive_deal_activities FOR ALL USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can access their workspace pipedrive data" ON pipedrive_deal_mentions FOR ALL USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can access their workspace pipedrive data" ON pipedrive_deal_watchers FOR ALL USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can access their workspace pipedrive data" ON pipedrive_deal_health_history FOR ALL USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can access their workspace pipedrive data" ON pipedrive_deals FOR ALL USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can access their workspace pipedrive data" ON pipedrive_stages FOR ALL USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can access their workspace pipedrive data" ON pipedrive_activities FOR ALL USING (user_has_workspace_access(workspace_id));