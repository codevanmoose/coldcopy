-- Workflow Automation Tables
-- This migration adds comprehensive workflow automation support

-- Workflows table
CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  version INTEGER NOT NULL DEFAULT 1,
  
  -- Workflow definition
  trigger_config JSONB NOT NULL,
  actions_config JSONB NOT NULL DEFAULT '[]',
  conditions_config JSONB NOT NULL DEFAULT '[]',
  
  -- Execution settings
  settings JSONB NOT NULL DEFAULT '{}',
  
  -- Analytics
  total_executions INTEGER DEFAULT 0,
  successful_executions INTEGER DEFAULT 0,
  failed_executions INTEGER DEFAULT 0,
  average_execution_time DECIMAL(10,2) DEFAULT 0,
  last_executed_at TIMESTAMP WITH TIME ZONE,
  conversion_rate DECIMAL(5,4) DEFAULT 0,
  
  -- Metadata
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_modified_by UUID REFERENCES users(id),
  tags TEXT[] DEFAULT '{}',
  folder TEXT
);

-- Workflow executions table
CREATE TABLE workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Execution context
  triggered_by JSONB NOT NULL,
  execution_context JSONB NOT NULL DEFAULT '{}',
  
  -- Execution state
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'paused', 'cancelled')),
  current_action_id TEXT,
  
  -- Timing
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  estimated_completion_at TIMESTAMP WITH TIME ZONE,
  
  -- Results
  result JSONB,
  error JSONB,
  
  -- Execution log
  execution_log JSONB NOT NULL DEFAULT '[]'
);

-- Workflow templates table
CREATE TABLE workflow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('lead_nurturing', 'onboarding', 'sales_process', 'customer_success', 'marketing', 'support', 'custom')),
  tags TEXT[] DEFAULT '{}',
  difficulty TEXT NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  estimated_setup_time INTEGER NOT NULL, -- minutes
  
  -- Template definition
  workflow_config JSONB NOT NULL,
  
  -- Usage tracking
  usage_count INTEGER DEFAULT 0,
  rating DECIMAL(3,2) DEFAULT 0,
  
  -- Metadata
  author TEXT NOT NULL,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workflow execution steps table (for detailed step tracking)
CREATE TABLE workflow_execution_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  
  -- Step details
  step_name TEXT NOT NULL,
  step_type TEXT NOT NULL,
  step_config JSONB NOT NULL DEFAULT '{}',
  
  -- Execution details
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,
  
  -- Results
  input_data JSONB,
  output_data JSONB,
  error_data JSONB,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workflow triggers table (for tracking trigger events)
CREATE TABLE workflow_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Trigger details
  trigger_type TEXT NOT NULL,
  trigger_data JSONB NOT NULL DEFAULT '{}',
  
  -- Execution tracking
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  trigger_count INTEGER DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_workflows_workspace_id ON workflows(workspace_id);
CREATE INDEX idx_workflows_status ON workflows(status);
CREATE INDEX idx_workflows_created_at ON workflows(created_at);
CREATE INDEX idx_workflows_last_executed_at ON workflows(last_executed_at);

CREATE INDEX idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX idx_workflow_executions_workspace_id ON workflow_executions(workspace_id);
CREATE INDEX idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX idx_workflow_executions_started_at ON workflow_executions(started_at);

CREATE INDEX idx_workflow_execution_steps_execution_id ON workflow_execution_steps(execution_id);
CREATE INDEX idx_workflow_execution_steps_workflow_id ON workflow_execution_steps(workflow_id);
CREATE INDEX idx_workflow_execution_steps_status ON workflow_execution_steps(status);

CREATE INDEX idx_workflow_triggers_workflow_id ON workflow_triggers(workflow_id);
CREATE INDEX idx_workflow_triggers_workspace_id ON workflow_triggers(workspace_id);
CREATE INDEX idx_workflow_triggers_trigger_type ON workflow_triggers(trigger_type);

CREATE INDEX idx_workflow_templates_category ON workflow_templates(category);
CREATE INDEX idx_workflow_templates_difficulty ON workflow_templates(difficulty);
CREATE INDEX idx_workflow_templates_usage_count ON workflow_templates(usage_count DESC);

-- RLS Policies

-- Workflows
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view workflows in their workspace" ON workflows
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Campaign managers can create workflows" ON workflows
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid() 
      AND role IN ('workspace_admin', 'campaign_manager')
    )
  );

CREATE POLICY "Campaign managers can update workflows" ON workflows
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid() 
      AND role IN ('workspace_admin', 'campaign_manager')
    )
  );

CREATE POLICY "Campaign managers can delete workflows" ON workflows
  FOR DELETE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid() 
      AND role IN ('workspace_admin', 'campaign_manager')
    )
  );

-- Workflow executions
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view executions in their workspace" ON workflow_executions
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

-- Workflow execution steps
ALTER TABLE workflow_execution_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view execution steps in their workspace" ON workflow_execution_steps
  FOR SELECT USING (
    workflow_id IN (
      SELECT id FROM workflows 
      WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
      )
    )
  );

-- Workflow triggers
ALTER TABLE workflow_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view triggers in their workspace" ON workflow_triggers
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

-- Workflow templates (public read access)
ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view public templates" ON workflow_templates
  FOR SELECT USING (is_public = true);

-- Functions for workflow management

-- Function to update workflow analytics
CREATE OR REPLACE FUNCTION update_workflow_analytics(p_workflow_id UUID)
RETURNS VOID AS $$
DECLARE
  analytics_data RECORD;
BEGIN
  -- Calculate analytics from executions
  SELECT 
    COUNT(*) as total_executions,
    COUNT(*) FILTER (WHERE status = 'completed') as successful_executions,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_executions,
    AVG(EXTRACT(EPOCH FROM (completed_at - started_at))/60) as avg_execution_time,
    MAX(completed_at) as last_executed_at
  INTO analytics_data
  FROM workflow_executions 
  WHERE workflow_id = p_workflow_id;
  
  -- Update workflow with analytics
  UPDATE workflows SET
    total_executions = COALESCE(analytics_data.total_executions, 0),
    successful_executions = COALESCE(analytics_data.successful_executions, 0),
    failed_executions = COALESCE(analytics_data.failed_executions, 0),
    average_execution_time = COALESCE(analytics_data.avg_execution_time, 0),
    last_executed_at = analytics_data.last_executed_at,
    conversion_rate = CASE 
      WHEN analytics_data.total_executions > 0 
      THEN analytics_data.successful_executions::DECIMAL / analytics_data.total_executions 
      ELSE 0 
    END,
    updated_at = NOW()
  WHERE id = p_workflow_id;
END;
$$ LANGUAGE plpgsql;

-- Function to create workflow execution
CREATE OR REPLACE FUNCTION create_workflow_execution(
  p_workflow_id UUID,
  p_workspace_id UUID,
  p_triggered_by JSONB,
  p_context JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  execution_id UUID;
  workflow_record workflows%ROWTYPE;
BEGIN
  -- Get workflow details
  SELECT * INTO workflow_record FROM workflows WHERE id = p_workflow_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workflow not found';
  END IF;
  
  -- Create execution record
  INSERT INTO workflow_executions (
    workflow_id,
    workspace_id,
    triggered_by,
    execution_context,
    status
  ) VALUES (
    p_workflow_id,
    p_workspace_id,
    p_triggered_by,
    p_context,
    'running'
  ) RETURNING id INTO execution_id;
  
  -- Update trigger count
  UPDATE workflow_triggers SET
    trigger_count = trigger_count + 1,
    last_triggered_at = NOW()
  WHERE workflow_id = p_workflow_id;
  
  RETURN execution_id;
END;
$$ LANGUAGE plpgsql;

-- Function to complete workflow execution
CREATE OR REPLACE FUNCTION complete_workflow_execution(
  p_execution_id UUID,
  p_status TEXT,
  p_result JSONB DEFAULT NULL,
  p_error JSONB DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  workflow_id UUID;
BEGIN
  -- Get workflow_id and update execution
  UPDATE workflow_executions SET
    status = p_status,
    completed_at = NOW(),
    result = p_result,
    error = p_error
  WHERE id = p_execution_id
  RETURNING workflow_id INTO workflow_id;
  
  -- Update workflow analytics
  PERFORM update_workflow_analytics(workflow_id);
END;
$$ LANGUAGE plpgsql;

-- Function to get workflow analytics
CREATE OR REPLACE FUNCTION get_workflow_analytics(
  p_workspace_id UUID,
  p_workflow_id UUID DEFAULT NULL,
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS JSONB AS $$
DECLARE
  result JSONB := '{}';
  execution_trends JSONB;
  top_workflows JSONB;
  failure_reasons JSONB;
  overall_stats JSONB;
BEGIN
  -- Overall statistics
  SELECT jsonb_build_object(
    'totalExecutions', COUNT(*),
    'successRate', COALESCE(COUNT(*) FILTER (WHERE status = 'completed')::DECIMAL / NULLIF(COUNT(*), 0), 0),
    'averageExecutionTime', COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - started_at))/60), 0)
  ) INTO overall_stats
  FROM workflow_executions we
  JOIN workflows w ON we.workflow_id = w.id
  WHERE w.workspace_id = p_workspace_id
    AND (p_workflow_id IS NULL OR we.workflow_id = p_workflow_id)
    AND we.started_at BETWEEN p_start_date AND p_end_date;
  
  -- Execution trends (daily)
  SELECT jsonb_agg(
    jsonb_build_object(
      'date', execution_date,
      'executions', execution_count,
      'successRate', success_rate
    ) ORDER BY execution_date
  ) INTO execution_trends
  FROM (
    SELECT 
      DATE(we.started_at) as execution_date,
      COUNT(*) as execution_count,
      COALESCE(COUNT(*) FILTER (WHERE we.status = 'completed')::DECIMAL / NULLIF(COUNT(*), 0), 0) as success_rate
    FROM workflow_executions we
    JOIN workflows w ON we.workflow_id = w.id
    WHERE w.workspace_id = p_workspace_id
      AND (p_workflow_id IS NULL OR we.workflow_id = p_workflow_id)
      AND we.started_at BETWEEN p_start_date AND p_end_date
    GROUP BY DATE(we.started_at)
    ORDER BY DATE(we.started_at)
  ) trends;
  
  -- Top performing workflows
  IF p_workflow_id IS NULL THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', w.id,
        'name', w.name,
        'executions', execution_count,
        'successRate', success_rate
      ) ORDER BY execution_count DESC
    ) INTO top_workflows
    FROM (
      SELECT 
        w.id,
        w.name,
        COUNT(we.*) as execution_count,
        COALESCE(COUNT(we.*) FILTER (WHERE we.status = 'completed')::DECIMAL / NULLIF(COUNT(we.*), 0), 0) as success_rate
      FROM workflows w
      LEFT JOIN workflow_executions we ON w.id = we.workflow_id 
        AND we.started_at BETWEEN p_start_date AND p_end_date
      WHERE w.workspace_id = p_workspace_id
      GROUP BY w.id, w.name
      HAVING COUNT(we.*) > 0
      ORDER BY execution_count DESC
      LIMIT 10
    ) top;
  END IF;
  
  -- Common failure reasons
  SELECT jsonb_agg(
    jsonb_build_object(
      'reason', error_reason,
      'count', reason_count,
      'percentage', (reason_count::DECIMAL / total_failures * 100)
    ) ORDER BY reason_count DESC
  ) INTO failure_reasons
  FROM (
    SELECT 
      COALESCE(we.error->>'message', 'Unknown error') as error_reason,
      COUNT(*) as reason_count,
      (SELECT COUNT(*) FROM workflow_executions we2 
       JOIN workflows w2 ON we2.workflow_id = w2.id 
       WHERE w2.workspace_id = p_workspace_id 
         AND (p_workflow_id IS NULL OR we2.workflow_id = p_workflow_id)
         AND we2.status = 'failed' 
         AND we2.started_at BETWEEN p_start_date AND p_end_date) as total_failures
    FROM workflow_executions we
    JOIN workflows w ON we.workflow_id = w.id
    WHERE w.workspace_id = p_workspace_id
      AND (p_workflow_id IS NULL OR we.workflow_id = p_workflow_id)
      AND we.status = 'failed'
      AND we.started_at BETWEEN p_start_date AND p_end_date
    GROUP BY we.error->>'message'
    ORDER BY COUNT(*) DESC
    LIMIT 10
  ) failures
  WHERE total_failures > 0;
  
  -- Build final result
  result := overall_stats;
  result := result || jsonb_build_object('executionTrends', COALESCE(execution_trends, '[]'));
  
  IF top_workflows IS NOT NULL THEN
    result := result || jsonb_build_object('topPerformingWorkflows', top_workflows);
  END IF;
  
  IF failure_reasons IS NOT NULL THEN
    result := result || jsonb_build_object('commonFailureReasons', failure_reasons);
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Triggers to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_workflows_updated_at 
  BEFORE UPDATE ON workflows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_triggers_updated_at 
  BEFORE UPDATE ON workflow_triggers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_templates_updated_at 
  BEFORE UPDATE ON workflow_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample workflow templates
INSERT INTO workflow_templates (
  name,
  description,
  category,
  tags,
  difficulty,
  estimated_setup_time,
  workflow_config,
  author,
  is_public
) VALUES
(
  'Welcome Email Sequence',
  'A 3-part welcome email sequence for new leads',
  'lead_nurturing',
  ARRAY['email', 'welcome', 'nurturing'],
  'beginner',
  15,
  '{
    "trigger": {
      "type": "lead_created",
      "conditions": {}
    },
    "actions": [
      {
        "id": "welcome-1",
        "type": "send_email",
        "config": {
          "subject": "Welcome to {{company_name}}!",
          "templateId": "welcome-template"
        }
      },
      {
        "id": "wait-1",
        "type": "wait",
        "config": {
          "waitDuration": 1440
        }
      },
      {
        "id": "welcome-2",
        "type": "send_email",
        "config": {
          "subject": "Getting started with {{company_name}}",
          "templateId": "getting-started-template"
        }
      }
    ]
  }',
  'ColdCopy Team',
  true
),
(
  'Abandoned Cart Recovery',
  'Re-engage leads who showed interest but didn''t convert',
  'sales_process',
  ARRAY['email', 'recovery', 'conversion'],
  'intermediate',
  25,
  '{
    "trigger": {
      "type": "email_clicked",
      "conditions": {
        "field": "link_type",
        "operator": "equals",
        "value": "pricing"
      }
    },
    "actions": [
      {
        "id": "tag-interested",
        "type": "add_tag",
        "config": {
          "tags": ["pricing-interested"]
        }
      },
      {
        "id": "wait-24h",
        "type": "wait",
        "config": {
          "waitDuration": 1440
        }
      },
      {
        "id": "follow-up",
        "type": "send_email",
        "config": {
          "subject": "Still thinking about {{company_name}}?",
          "templateId": "follow-up-template"
        }
      }
    ]
  }',
  'ColdCopy Team',
  true
);

-- Create indexes on JSONB fields for better performance
CREATE INDEX idx_workflows_trigger_config_gin ON workflows USING gin(trigger_config);
CREATE INDEX idx_workflows_actions_config_gin ON workflows USING gin(actions_config);
CREATE INDEX idx_workflow_executions_triggered_by_gin ON workflow_executions USING gin(triggered_by);
CREATE INDEX idx_workflow_executions_execution_context_gin ON workflow_executions USING gin(execution_context);