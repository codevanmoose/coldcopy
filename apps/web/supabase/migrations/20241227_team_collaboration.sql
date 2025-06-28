-- Team Collaboration Features
-- Real-time presence, collision detection, and activity tracking

-- User Presence Table
CREATE TABLE IF NOT EXISTS user_presence (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Presence status
  status VARCHAR(20) NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'away', 'busy', 'offline')),
  custom_status TEXT,
  
  -- Current activity
  current_page VARCHAR(255),
  current_resource_type VARCHAR(50), -- 'lead', 'campaign', 'email', etc.
  current_resource_id UUID,
  
  -- Session information
  session_id VARCHAR(255) NOT NULL,
  device_type VARCHAR(20) DEFAULT 'desktop' CHECK (device_type IN ('desktop', 'mobile', 'tablet')),
  browser VARCHAR(50),
  ip_address INET,
  
  -- Timestamps
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint per workspace/user
  UNIQUE(workspace_id, user_id)
);

-- Resource Locks Table (for collision detection)
CREATE TABLE IF NOT EXISTS resource_locks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Resource information
  resource_type VARCHAR(50) NOT NULL, -- 'lead', 'campaign', 'email_template', etc.
  resource_id UUID NOT NULL,
  
  -- Lock details
  locked_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lock_type VARCHAR(20) NOT NULL DEFAULT 'editing' CHECK (lock_type IN ('editing', 'viewing', 'processing')),
  session_id VARCHAR(255) NOT NULL,
  
  -- Lock metadata
  lock_reason VARCHAR(100),
  auto_release_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  acquired_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint per resource
  UNIQUE(workspace_id, resource_type, resource_id, lock_type)
);

-- Activity Feed Table
CREATE TABLE IF NOT EXISTS activity_feed (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Activity details
  activity_type VARCHAR(50) NOT NULL, -- 'created', 'updated', 'deleted', 'viewed', etc.
  resource_type VARCHAR(50) NOT NULL, -- 'lead', 'campaign', 'email', etc.
  resource_id UUID,
  resource_name TEXT,
  
  -- Activity metadata
  activity_data JSONB DEFAULT '{}',
  description TEXT,
  
  -- Visibility
  is_public BOOLEAN DEFAULT true,
  mentioned_users UUID[] DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Real-time Notifications Table
CREATE TABLE IF NOT EXISTS realtime_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Recipients
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- null for broadcast
  role_filter VARCHAR(50), -- target specific roles
  
  -- Notification content
  notification_type VARCHAR(50) NOT NULL, -- 'presence_update', 'lock_acquired', 'activity', etc.
  title VARCHAR(255) NOT NULL,
  message TEXT,
  data JSONB DEFAULT '{}',
  
  -- Delivery
  channels VARCHAR(20)[] DEFAULT '{"in_app"}', -- 'in_app', 'push', 'email'
  priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  
  -- Status
  delivered_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  dismissed_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Team Activity Summary (materialized view)
CREATE MATERIALIZED VIEW team_activity_summary AS
SELECT 
  workspace_id,
  DATE(created_at) as activity_date,
  
  -- Activity counts by type
  COUNT(*) as total_activities,
  COUNT(*) FILTER (WHERE activity_type = 'created') as items_created,
  COUNT(*) FILTER (WHERE activity_type = 'updated') as items_updated,
  COUNT(*) FILTER (WHERE activity_type = 'deleted') as items_deleted,
  COUNT(*) FILTER (WHERE activity_type = 'viewed') as items_viewed,
  
  -- Resource counts by type
  COUNT(DISTINCT CASE WHEN resource_type = 'lead' THEN resource_id END) as leads_touched,
  COUNT(DISTINCT CASE WHEN resource_type = 'campaign' THEN resource_id END) as campaigns_touched,
  COUNT(DISTINCT CASE WHEN resource_type = 'email' THEN resource_id END) as emails_touched,
  
  -- User activity
  COUNT(DISTINCT user_id) as active_users,
  ARRAY_AGG(DISTINCT user_id) as user_list,
  
  -- Peak activity hour
  MODE() WITHIN GROUP (ORDER BY EXTRACT(HOUR FROM created_at)) as peak_hour,
  
  -- Summary data
  MAX(created_at) as last_activity_at
FROM activity_feed 
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY workspace_id, DATE(created_at);

-- Add indexes for performance
CREATE INDEX idx_user_presence_workspace_user ON user_presence(workspace_id, user_id);
CREATE INDEX idx_user_presence_status ON user_presence(status) WHERE status != 'offline';
CREATE INDEX idx_user_presence_session ON user_presence(session_id);
CREATE INDEX idx_user_presence_last_activity ON user_presence(last_activity DESC);

CREATE INDEX idx_resource_locks_workspace_resource ON resource_locks(workspace_id, resource_type, resource_id);
CREATE INDEX idx_resource_locks_user ON resource_locks(locked_by_user_id);
CREATE INDEX idx_resource_locks_session ON resource_locks(session_id);
CREATE INDEX idx_resource_locks_heartbeat ON resource_locks(last_heartbeat DESC);
CREATE INDEX idx_resource_locks_auto_release ON resource_locks(auto_release_at) WHERE auto_release_at IS NOT NULL;

CREATE INDEX idx_activity_feed_workspace_time ON activity_feed(workspace_id, created_at DESC);
CREATE INDEX idx_activity_feed_user ON activity_feed(user_id);
CREATE INDEX idx_activity_feed_resource ON activity_feed(resource_type, resource_id);
CREATE INDEX idx_activity_feed_public ON activity_feed(workspace_id, is_public, created_at DESC) WHERE is_public = true;

CREATE INDEX idx_realtime_notifications_user ON realtime_notifications(user_id, created_at DESC);
CREATE INDEX idx_realtime_notifications_workspace ON realtime_notifications(workspace_id, created_at DESC);
CREATE INDEX idx_realtime_notifications_unread ON realtime_notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX idx_realtime_notifications_expires ON realtime_notifications(expires_at) WHERE expires_at IS NOT NULL;

-- Enable RLS
ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE realtime_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_presence
CREATE POLICY "Users can view presence in their workspace" ON user_presence
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM user_profiles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their own presence" ON user_presence
  FOR ALL USING (
    user_id = auth.uid() AND 
    workspace_id IN (
      SELECT workspace_id FROM user_profiles 
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for resource_locks
CREATE POLICY "Users can view locks in their workspace" ON resource_locks
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM user_profiles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create locks in their workspace" ON resource_locks
  FOR INSERT WITH CHECK (
    locked_by_user_id = auth.uid() AND
    workspace_id IN (
      SELECT workspace_id FROM user_profiles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own locks" ON resource_locks
  FOR UPDATE USING (
    locked_by_user_id = auth.uid()
  );

CREATE POLICY "Users can delete their own locks" ON resource_locks
  FOR DELETE USING (
    locked_by_user_id = auth.uid()
  );

-- RLS Policies for activity_feed
CREATE POLICY "Users can view public activities in their workspace" ON activity_feed
  FOR SELECT USING (
    is_public = true AND
    workspace_id IN (
      SELECT workspace_id FROM user_profiles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their own activities" ON activity_feed
  FOR SELECT USING (
    user_id = auth.uid()
  );

CREATE POLICY "Users can create activities in their workspace" ON activity_feed
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    workspace_id IN (
      SELECT workspace_id FROM user_profiles 
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for realtime_notifications
CREATE POLICY "Users can view their own notifications" ON realtime_notifications
  FOR SELECT USING (
    user_id = auth.uid() OR 
    (user_id IS NULL AND workspace_id IN (
      SELECT workspace_id FROM user_profiles 
      WHERE user_id = auth.uid()
    ))
  );

CREATE POLICY "System can create notifications" ON realtime_notifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own notifications" ON realtime_notifications
  FOR UPDATE USING (
    user_id = auth.uid()
  );

-- Functions for presence management
CREATE OR REPLACE FUNCTION update_user_presence(
  p_workspace_id UUID,
  p_status VARCHAR(20),
  p_custom_status TEXT DEFAULT NULL,
  p_current_page VARCHAR(255) DEFAULT NULL,
  p_current_resource_type VARCHAR(50) DEFAULT NULL,
  p_current_resource_id UUID DEFAULT NULL,
  p_session_id VARCHAR(255) DEFAULT NULL,
  p_device_type VARCHAR(20) DEFAULT 'desktop',
  p_browser VARCHAR(50) DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  presence_id UUID;
BEGIN
  INSERT INTO user_presence (
    workspace_id,
    user_id,
    status,
    custom_status,
    current_page,
    current_resource_type,
    current_resource_id,
    session_id,
    device_type,
    browser,
    last_seen,
    last_activity
  ) VALUES (
    p_workspace_id,
    auth.uid(),
    p_status,
    p_custom_status,
    p_current_page,
    p_current_resource_type,
    p_current_resource_id,
    p_session_id,
    p_device_type,
    p_browser,
    NOW(),
    NOW()
  )
  ON CONFLICT (workspace_id, user_id) 
  DO UPDATE SET
    status = EXCLUDED.status,
    custom_status = EXCLUDED.custom_status,
    current_page = EXCLUDED.current_page,
    current_resource_type = EXCLUDED.current_resource_type,
    current_resource_id = EXCLUDED.current_resource_id,
    session_id = EXCLUDED.session_id,
    device_type = EXCLUDED.device_type,
    browser = EXCLUDED.browser,
    last_seen = NOW(),
    last_activity = NOW()
  RETURNING id INTO presence_id;
  
  RETURN presence_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to acquire resource lock
CREATE OR REPLACE FUNCTION acquire_resource_lock(
  p_workspace_id UUID,
  p_resource_type VARCHAR(50),
  p_resource_id UUID,
  p_lock_type VARCHAR(20) DEFAULT 'editing',
  p_session_id VARCHAR(255) DEFAULT NULL,
  p_lock_reason VARCHAR(100) DEFAULT NULL,
  p_auto_release_minutes INTEGER DEFAULT 30
)
RETURNS JSONB AS $$
DECLARE
  lock_id UUID;
  existing_lock RECORD;
  result JSONB;
BEGIN
  -- Check for existing lock
  SELECT * INTO existing_lock
  FROM resource_locks 
  WHERE workspace_id = p_workspace_id 
    AND resource_type = p_resource_type 
    AND resource_id = p_resource_id 
    AND lock_type = p_lock_type
    AND (auto_release_at IS NULL OR auto_release_at > NOW());
  
  IF existing_lock.id IS NOT NULL THEN
    -- Lock exists and is still valid
    IF existing_lock.locked_by_user_id = auth.uid() THEN
      -- Update heartbeat for own lock
      UPDATE resource_locks 
      SET last_heartbeat = NOW(),
          auto_release_at = CASE 
            WHEN p_auto_release_minutes > 0 
            THEN NOW() + INTERVAL '1 minute' * p_auto_release_minutes 
            ELSE NULL 
          END
      WHERE id = existing_lock.id;
      
      result := jsonb_build_object(
        'success', true,
        'lock_id', existing_lock.id,
        'action', 'renewed',
        'message', 'Lock renewed successfully'
      );
    ELSE
      -- Lock held by another user
      result := jsonb_build_object(
        'success', false,
        'error', 'resource_locked',
        'message', 'Resource is currently locked by another user',
        'locked_by', existing_lock.locked_by_user_id,
        'locked_at', existing_lock.acquired_at
      );
    END IF;
  ELSE
    -- No existing lock, create new one
    INSERT INTO resource_locks (
      workspace_id,
      resource_type,
      resource_id,
      locked_by_user_id,
      lock_type,
      session_id,
      lock_reason,
      auto_release_at
    ) VALUES (
      p_workspace_id,
      p_resource_type,
      p_resource_id,
      auth.uid(),
      p_lock_type,
      p_session_id,
      p_lock_reason,
      CASE 
        WHEN p_auto_release_minutes > 0 
        THEN NOW() + INTERVAL '1 minute' * p_auto_release_minutes 
        ELSE NULL 
      END
    ) RETURNING id INTO lock_id;
    
    result := jsonb_build_object(
      'success', true,
      'lock_id', lock_id,
      'action', 'acquired',
      'message', 'Lock acquired successfully'
    );
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to release resource lock
CREATE OR REPLACE FUNCTION release_resource_lock(
  p_workspace_id UUID,
  p_resource_type VARCHAR(50),
  p_resource_id UUID,
  p_lock_type VARCHAR(20) DEFAULT 'editing'
)
RETURNS BOOLEAN AS $$
DECLARE
  rows_affected INTEGER;
BEGIN
  DELETE FROM resource_locks 
  WHERE workspace_id = p_workspace_id 
    AND resource_type = p_resource_type 
    AND resource_id = p_resource_id 
    AND lock_type = p_lock_type
    AND locked_by_user_id = auth.uid();
  
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log activity
CREATE OR REPLACE FUNCTION log_activity(
  p_workspace_id UUID,
  p_activity_type VARCHAR(50),
  p_resource_type VARCHAR(50),
  p_resource_id UUID,
  p_resource_name TEXT,
  p_activity_data JSONB DEFAULT '{}',
  p_description TEXT DEFAULT NULL,
  p_is_public BOOLEAN DEFAULT true
)
RETURNS UUID AS $$
DECLARE
  activity_id UUID;
BEGIN
  INSERT INTO activity_feed (
    workspace_id,
    user_id,
    activity_type,
    resource_type,
    resource_id,
    resource_name,
    activity_data,
    description,
    is_public
  ) VALUES (
    p_workspace_id,
    auth.uid(),
    p_activity_type,
    p_resource_type,
    p_resource_id,
    p_resource_name,
    p_activity_data,
    p_description,
    p_is_public
  ) RETURNING id INTO activity_id;
  
  RETURN activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up expired locks and offline presence
CREATE OR REPLACE FUNCTION cleanup_collaboration_data()
RETURNS INTEGER AS $$
DECLARE
  cleaned_count INTEGER := 0;
BEGIN
  -- Remove expired locks
  DELETE FROM resource_locks 
  WHERE auto_release_at IS NOT NULL AND auto_release_at < NOW();
  
  GET DIAGNOSTICS cleaned_count = ROW_COUNT;
  
  -- Remove locks with stale heartbeats (no activity for 10 minutes)
  DELETE FROM resource_locks 
  WHERE last_heartbeat < NOW() - INTERVAL '10 minutes';
  
  GET DIAGNOSTICS cleaned_count = cleaned_count + ROW_COUNT;
  
  -- Mark users as offline if no activity for 5 minutes
  UPDATE user_presence 
  SET status = 'offline'
  WHERE status != 'offline' 
    AND last_activity < NOW() - INTERVAL '5 minutes';
  
  GET DIAGNOSTICS cleaned_count = cleaned_count + ROW_COUNT;
  
  -- Delete old presence records (offline for more than 24 hours)
  DELETE FROM user_presence 
  WHERE status = 'offline' 
    AND last_activity < NOW() - INTERVAL '24 hours';
  
  GET DIAGNOSTICS cleaned_count = cleaned_count + ROW_COUNT;
  
  -- Delete old activity feed entries (older than 90 days)
  DELETE FROM activity_feed 
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  GET DIAGNOSTICS cleaned_count = cleaned_count + ROW_COUNT;
  
  -- Delete old notifications (older than 30 days)
  DELETE FROM realtime_notifications 
  WHERE created_at < NOW() - INTERVAL '30 days'
    OR (expires_at IS NOT NULL AND expires_at < NOW());
  
  GET DIAGNOSTICS cleaned_count = cleaned_count + ROW_COUNT;
  
  RETURN cleaned_count;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_team_activity_summary()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY team_activity_summary;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Refresh materialized view daily
CREATE OR REPLACE FUNCTION schedule_team_activity_refresh()
RETURNS void AS $$
BEGIN
  -- This would be called by a cron job
  REFRESH MATERIALIZED VIEW CONCURRENTLY team_activity_summary;
END;
$$ LANGUAGE plpgsql;

-- Sample data for testing
DO $$
DECLARE
  workspace_uuid UUID;
  user_uuid UUID;
BEGIN
  -- Get first workspace and user for demo data
  SELECT id INTO workspace_uuid FROM workspaces LIMIT 1;
  SELECT id INTO user_uuid FROM auth.users LIMIT 1;
  
  IF workspace_uuid IS NOT NULL AND user_uuid IS NOT NULL THEN
    -- Insert sample presence data
    INSERT INTO user_presence (workspace_id, user_id, status, current_page, session_id, device_type)
    VALUES 
      (workspace_uuid, user_uuid, 'online', '/dashboard', 'session_123', 'desktop');
    
    -- Insert sample activity data
    INSERT INTO activity_feed (workspace_id, user_id, activity_type, resource_type, resource_id, resource_name, description)
    VALUES 
      (workspace_uuid, user_uuid, 'created', 'campaign', gen_random_uuid(), 'Q1 Outreach Campaign', 'Created new email campaign'),
      (workspace_uuid, user_uuid, 'updated', 'lead', gen_random_uuid(), 'John Doe', 'Updated lead information'),
      (workspace_uuid, user_uuid, 'viewed', 'analytics', NULL, 'Campaign Analytics', 'Viewed campaign performance dashboard');
  END IF;
END $$;