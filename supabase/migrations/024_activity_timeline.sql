-- UP
-- Activity timeline table for comprehensive activity tracking
CREATE TABLE IF NOT EXISTS activity_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  pipedrive_activity_id INTEGER,
  category VARCHAR(50) NOT NULL CHECK (category IN ('email', 'call', 'meeting', 'task', 'note', 'linkedin', 'sms', 'whatsapp')),
  sub_type VARCHAR(50) NOT NULL,
  subject TEXT NOT NULL,
  description TEXT,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  duration INTEGER, -- in minutes
  participants JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  synced BOOLEAN DEFAULT FALSE,
  synced_at TIMESTAMP WITH TIME ZONE,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activity templates for customization
CREATE TABLE IF NOT EXISTS activity_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('email', 'call', 'meeting', 'task', 'note', 'linkedin', 'sms', 'whatsapp')),
  default_subject TEXT NOT NULL,
  default_description TEXT,
  default_duration INTEGER,
  fields JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workspace_id, name)
);

-- Activity sync queue for batch processing
CREATE TABLE IF NOT EXISTS activity_sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES activity_timeline(id) ON DELETE CASCADE,
  priority INTEGER DEFAULT 0,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email thread tracking for conversation analysis
CREATE TABLE IF NOT EXISTS email_thread_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL REFERENCES email_threads(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  sentiment VARCHAR(20) CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  engagement_score INTEGER CHECK (engagement_score >= 0 AND engagement_score <= 100),
  intent_level VARCHAR(20) CHECK (intent_level IN ('high', 'medium', 'low')),
  key_topics TEXT[],
  next_best_action VARCHAR(100),
  analysis_metadata JSONB DEFAULT '{}',
  analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activity engagement metrics
CREATE TABLE IF NOT EXISTS activity_engagement_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_activities INTEGER DEFAULT 0,
  email_activities INTEGER DEFAULT 0,
  call_activities INTEGER DEFAULT 0,
  meeting_activities INTEGER DEFAULT 0,
  engagement_score INTEGER DEFAULT 0,
  response_time_minutes INTEGER,
  activity_velocity DECIMAL(10,2), -- activities per day
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workspace_id, lead_id, campaign_id, date)
);

-- Historical sync status
CREATE TABLE IF NOT EXISTS activity_historical_sync (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  sync_type VARCHAR(50) NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  total_activities INTEGER DEFAULT 0,
  synced_activities INTEGER DEFAULT 0,
  failed_activities INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  error_log JSONB DEFAULT '[]',
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_activity_timeline_workspace ON activity_timeline(workspace_id);
CREATE INDEX idx_activity_timeline_lead ON activity_timeline(lead_id);
CREATE INDEX idx_activity_timeline_campaign ON activity_timeline(campaign_id);
CREATE INDEX idx_activity_timeline_timestamp ON activity_timeline(timestamp);
CREATE INDEX idx_activity_timeline_category ON activity_timeline(category);
CREATE INDEX idx_activity_timeline_sub_type ON activity_timeline(sub_type);
CREATE INDEX idx_activity_timeline_synced ON activity_timeline(synced);
CREATE INDEX idx_activity_timeline_pipedrive ON activity_timeline(pipedrive_activity_id);

CREATE INDEX idx_activity_templates_workspace ON activity_templates(workspace_id);
CREATE INDEX idx_activity_templates_category ON activity_templates(category);

CREATE INDEX idx_activity_sync_queue_workspace ON activity_sync_queue(workspace_id);
CREATE INDEX idx_activity_sync_queue_status ON activity_sync_queue(status);
CREATE INDEX idx_activity_sync_queue_scheduled ON activity_sync_queue(scheduled_at);

CREATE INDEX idx_email_thread_analysis_workspace ON email_thread_analysis(workspace_id);
CREATE INDEX idx_email_thread_analysis_thread ON email_thread_analysis(thread_id);
CREATE INDEX idx_email_thread_analysis_lead ON email_thread_analysis(lead_id);
CREATE INDEX idx_email_thread_analysis_sentiment ON email_thread_analysis(sentiment);

CREATE INDEX idx_activity_engagement_metrics_workspace ON activity_engagement_metrics(workspace_id);
CREATE INDEX idx_activity_engagement_metrics_lead ON activity_engagement_metrics(lead_id);
CREATE INDEX idx_activity_engagement_metrics_campaign ON activity_engagement_metrics(campaign_id);
CREATE INDEX idx_activity_engagement_metrics_date ON activity_engagement_metrics(date);

CREATE INDEX idx_activity_historical_sync_workspace ON activity_historical_sync(workspace_id);
CREATE INDEX idx_activity_historical_sync_status ON activity_historical_sync(status);

-- Enable RLS
ALTER TABLE activity_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_thread_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_engagement_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_historical_sync ENABLE ROW LEVEL SECURITY;

-- RLS Policies for activity_timeline
CREATE POLICY activity_timeline_select ON activity_timeline
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY activity_timeline_insert ON activity_timeline
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY activity_timeline_update ON activity_timeline
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY activity_timeline_delete ON activity_timeline
  FOR DELETE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- RLS Policies for activity_templates
CREATE POLICY activity_templates_select ON activity_templates
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY activity_templates_all ON activity_templates
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- RLS Policies for activity_sync_queue
CREATE POLICY activity_sync_queue_select ON activity_sync_queue
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY activity_sync_queue_all ON activity_sync_queue
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- RLS Policies for email_thread_analysis
CREATE POLICY email_thread_analysis_select ON email_thread_analysis
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY email_thread_analysis_all ON email_thread_analysis
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for activity_engagement_metrics
CREATE POLICY activity_engagement_metrics_select ON activity_engagement_metrics
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY activity_engagement_metrics_all ON activity_engagement_metrics
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for activity_historical_sync
CREATE POLICY activity_historical_sync_select ON activity_historical_sync
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY activity_historical_sync_all ON activity_historical_sync
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Function to update engagement metrics
CREATE OR REPLACE FUNCTION update_activity_engagement_metrics()
RETURNS TRIGGER AS $$
BEGIN
  -- Update or insert engagement metrics for the day
  INSERT INTO activity_engagement_metrics (
    workspace_id,
    lead_id,
    campaign_id,
    date,
    total_activities,
    email_activities,
    call_activities,
    meeting_activities,
    engagement_score
  )
  VALUES (
    NEW.workspace_id,
    NEW.lead_id,
    NEW.campaign_id,
    DATE(NEW.timestamp),
    1,
    CASE WHEN NEW.category = 'email' THEN 1 ELSE 0 END,
    CASE WHEN NEW.category = 'call' THEN 1 ELSE 0 END,
    CASE WHEN NEW.category = 'meeting' THEN 1 ELSE 0 END,
    COALESCE((NEW.metadata->>'engagement'->>'score')::INTEGER, 0)
  )
  ON CONFLICT (workspace_id, lead_id, campaign_id, date)
  DO UPDATE SET
    total_activities = activity_engagement_metrics.total_activities + 1,
    email_activities = activity_engagement_metrics.email_activities + 
      CASE WHEN NEW.category = 'email' THEN 1 ELSE 0 END,
    call_activities = activity_engagement_metrics.call_activities + 
      CASE WHEN NEW.category = 'call' THEN 1 ELSE 0 END,
    meeting_activities = activity_engagement_metrics.meeting_activities + 
      CASE WHEN NEW.category = 'meeting' THEN 1 ELSE 0 END,
    engagement_score = (
      activity_engagement_metrics.engagement_score * activity_engagement_metrics.total_activities + 
      COALESCE((NEW.metadata->>'engagement'->>'score')::INTEGER, 0)
    ) / (activity_engagement_metrics.total_activities + 1),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update engagement metrics
CREATE TRIGGER update_engagement_metrics_on_activity
  AFTER INSERT ON activity_timeline
  FOR EACH ROW
  EXECUTE FUNCTION update_activity_engagement_metrics();

-- Function to analyze email threads
CREATE OR REPLACE FUNCTION analyze_email_thread(p_thread_id UUID, p_workspace_id UUID)
RETURNS VOID AS $$
DECLARE
  v_lead_id UUID;
  v_message_count INTEGER;
  v_sentiment VARCHAR(20);
  v_engagement_score INTEGER;
BEGIN
  -- Get lead_id from thread
  SELECT lead_id INTO v_lead_id
  FROM email_threads
  WHERE id = p_thread_id AND workspace_id = p_workspace_id;

  -- Count messages
  SELECT COUNT(*) INTO v_message_count
  FROM email_messages
  WHERE thread_id = p_thread_id;

  -- Calculate basic engagement score
  v_engagement_score := LEAST(v_message_count * 10, 100);

  -- Determine sentiment (simplified - in production use NLP)
  v_sentiment := 'neutral';

  -- Insert or update analysis
  INSERT INTO email_thread_analysis (
    workspace_id,
    thread_id,
    lead_id,
    sentiment,
    engagement_score,
    intent_level,
    analysis_metadata
  )
  VALUES (
    p_workspace_id,
    p_thread_id,
    v_lead_id,
    v_sentiment,
    v_engagement_score,
    CASE 
      WHEN v_engagement_score > 70 THEN 'high'
      WHEN v_engagement_score > 40 THEN 'medium'
      ELSE 'low'
    END,
    jsonb_build_object('message_count', v_message_count)
  )
  ON CONFLICT (thread_id)
  DO UPDATE SET
    sentiment = EXCLUDED.sentiment,
    engagement_score = EXCLUDED.engagement_score,
    intent_level = EXCLUDED.intent_level,
    analysis_metadata = EXCLUDED.analysis_metadata,
    analyzed_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to queue activities for sync
CREATE OR REPLACE FUNCTION queue_activity_for_sync(p_activity_id UUID, p_priority INTEGER DEFAULT 0)
RETURNS VOID AS $$
BEGIN
  INSERT INTO activity_sync_queue (
    workspace_id,
    activity_id,
    priority,
    scheduled_at
  )
  SELECT 
    workspace_id,
    id,
    p_priority,
    NOW()
  FROM activity_timeline
  WHERE id = p_activity_id
  ON CONFLICT (activity_id)
  DO UPDATE SET
    priority = GREATEST(activity_sync_queue.priority, EXCLUDED.priority),
    attempts = 0,
    status = 'pending',
    scheduled_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to queue new activities for sync
CREATE OR REPLACE FUNCTION queue_new_activity_for_sync()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM queue_activity_for_sync(NEW.id, 1);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER queue_activity_on_insert
  AFTER INSERT ON activity_timeline
  FOR EACH ROW
  WHEN (NEW.pipedrive_activity_id IS NULL)
  EXECUTE FUNCTION queue_new_activity_for_sync();

-- Update triggers
CREATE TRIGGER update_activity_timeline_updated_at
  BEFORE UPDATE ON activity_timeline
  FOR EACH ROW
  EXECUTE FUNCTION update_pipedrive_updated_at();

CREATE TRIGGER update_activity_templates_updated_at
  BEFORE UPDATE ON activity_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_pipedrive_updated_at();

CREATE TRIGGER update_activity_engagement_metrics_updated_at
  BEFORE UPDATE ON activity_engagement_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_pipedrive_updated_at();

-- DOWN
DROP TRIGGER IF EXISTS update_activity_engagement_metrics_updated_at ON activity_engagement_metrics;
DROP TRIGGER IF EXISTS update_activity_templates_updated_at ON activity_templates;
DROP TRIGGER IF EXISTS update_activity_timeline_updated_at ON activity_timeline;
DROP TRIGGER IF EXISTS queue_activity_on_insert ON activity_timeline;
DROP TRIGGER IF EXISTS update_engagement_metrics_on_activity ON activity_timeline;

DROP FUNCTION IF EXISTS queue_new_activity_for_sync();
DROP FUNCTION IF EXISTS queue_activity_for_sync(UUID, INTEGER);
DROP FUNCTION IF EXISTS analyze_email_thread(UUID, UUID);
DROP FUNCTION IF EXISTS update_activity_engagement_metrics();

DROP POLICY IF EXISTS activity_historical_sync_all ON activity_historical_sync;
DROP POLICY IF EXISTS activity_historical_sync_select ON activity_historical_sync;
DROP POLICY IF EXISTS activity_engagement_metrics_all ON activity_engagement_metrics;
DROP POLICY IF EXISTS activity_engagement_metrics_select ON activity_engagement_metrics;
DROP POLICY IF EXISTS email_thread_analysis_all ON email_thread_analysis;
DROP POLICY IF EXISTS email_thread_analysis_select ON email_thread_analysis;
DROP POLICY IF EXISTS activity_sync_queue_all ON activity_sync_queue;
DROP POLICY IF EXISTS activity_sync_queue_select ON activity_sync_queue;
DROP POLICY IF EXISTS activity_templates_all ON activity_templates;
DROP POLICY IF EXISTS activity_templates_select ON activity_templates;
DROP POLICY IF EXISTS activity_timeline_delete ON activity_timeline;
DROP POLICY IF EXISTS activity_timeline_update ON activity_timeline;
DROP POLICY IF EXISTS activity_timeline_insert ON activity_timeline;
DROP POLICY IF EXISTS activity_timeline_select ON activity_timeline;

DROP INDEX IF EXISTS idx_activity_historical_sync_status;
DROP INDEX IF EXISTS idx_activity_historical_sync_workspace;
DROP INDEX IF EXISTS idx_activity_engagement_metrics_date;
DROP INDEX IF EXISTS idx_activity_engagement_metrics_campaign;
DROP INDEX IF EXISTS idx_activity_engagement_metrics_lead;
DROP INDEX IF EXISTS idx_activity_engagement_metrics_workspace;
DROP INDEX IF EXISTS idx_email_thread_analysis_sentiment;
DROP INDEX IF EXISTS idx_email_thread_analysis_lead;
DROP INDEX IF EXISTS idx_email_thread_analysis_thread;
DROP INDEX IF EXISTS idx_email_thread_analysis_workspace;
DROP INDEX IF EXISTS idx_activity_sync_queue_scheduled;
DROP INDEX IF EXISTS idx_activity_sync_queue_status;
DROP INDEX IF EXISTS idx_activity_sync_queue_workspace;
DROP INDEX IF EXISTS idx_activity_templates_category;
DROP INDEX IF EXISTS idx_activity_templates_workspace;
DROP INDEX IF EXISTS idx_activity_timeline_pipedrive;
DROP INDEX IF EXISTS idx_activity_timeline_synced;
DROP INDEX IF EXISTS idx_activity_timeline_sub_type;
DROP INDEX IF EXISTS idx_activity_timeline_category;
DROP INDEX IF EXISTS idx_activity_timeline_timestamp;
DROP INDEX IF EXISTS idx_activity_timeline_campaign;
DROP INDEX IF EXISTS idx_activity_timeline_lead;
DROP INDEX IF EXISTS idx_activity_timeline_workspace;

DROP TABLE IF EXISTS activity_historical_sync;
DROP TABLE IF EXISTS activity_engagement_metrics;
DROP TABLE IF EXISTS email_thread_analysis;
DROP TABLE IF EXISTS activity_sync_queue;
DROP TABLE IF EXISTS activity_templates;
DROP TABLE IF EXISTS activity_timeline;