-- Email threads table
CREATE TABLE IF NOT EXISTS email_threads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'archived', 'spam')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_from TEXT,
  message_count INTEGER DEFAULT 0,
  is_read BOOLEAN DEFAULT false,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email messages table
CREATE TABLE IF NOT EXISTS email_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES email_threads(id) ON DELETE CASCADE,
  message_id TEXT UNIQUE, -- External email message ID
  in_reply_to TEXT, -- For threading
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_emails TEXT[] NOT NULL,
  cc_emails TEXT[] DEFAULT '{}',
  bcc_emails TEXT[] DEFAULT '{}',
  subject TEXT NOT NULL,
  body_text TEXT,
  body_html TEXT,
  headers JSONB DEFAULT '{}',
  attachments JSONB DEFAULT '[]',
  is_read BOOLEAN DEFAULT false,
  is_draft BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Thread participants table
CREATE TABLE IF NOT EXISTS thread_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES email_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'viewer' CHECK (role IN ('viewer', 'responder', 'owner')),
  last_seen_at TIMESTAMPTZ,
  is_mentioned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(thread_id, user_id)
);

-- Thread activities table (for real-time collaboration)
CREATE TABLE IF NOT EXISTS thread_activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES email_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('viewing', 'typing', 'replied', 'assigned', 'tagged', 'closed', 'reopened')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Saved replies/templates
CREATE TABLE IF NOT EXISTS saved_replies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  shortcuts TEXT[] DEFAULT '{}',
  is_shared BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_email_threads_workspace ON email_threads(workspace_id);
CREATE INDEX idx_email_threads_assigned ON email_threads(assigned_to);
CREATE INDEX idx_email_threads_status ON email_threads(status);
CREATE INDEX idx_email_threads_last_message ON email_threads(last_message_at DESC);

CREATE INDEX idx_email_messages_thread ON email_messages(thread_id);
CREATE INDEX idx_email_messages_direction ON email_messages(direction);
CREATE INDEX idx_email_messages_received ON email_messages(received_at DESC);

CREATE INDEX idx_thread_participants_user ON thread_participants(user_id);
CREATE INDEX idx_thread_activities_thread ON thread_activities(thread_id);
CREATE INDEX idx_thread_activities_created ON thread_activities(created_at DESC);

-- Enable RLS
ALTER TABLE email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE thread_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE thread_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_replies ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_threads
CREATE POLICY "Users can view threads in their workspace" ON email_threads
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage threads in their workspace" ON email_threads
  FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM users WHERE id = auth.uid()
    )
  );

-- RLS Policies for email_messages
CREATE POLICY "Users can view messages in their workspace threads" ON email_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM email_threads t
      JOIN users u ON u.workspace_id = t.workspace_id
      WHERE t.id = email_messages.thread_id
      AND u.id = auth.uid()
    )
  );

CREATE POLICY "Users can create messages in their workspace threads" ON email_messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM email_threads t
      JOIN users u ON u.workspace_id = t.workspace_id
      WHERE t.id = email_messages.thread_id
      AND u.id = auth.uid()
    )
  );

-- RLS Policies for thread_participants
CREATE POLICY "Users can view participants in their workspace" ON thread_participants
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM email_threads t
      JOIN users u ON u.workspace_id = t.workspace_id
      WHERE t.id = thread_participants.thread_id
      AND u.id = auth.uid()
    )
  );

-- RLS Policies for thread_activities
CREATE POLICY "Users can view activities in their workspace" ON thread_activities
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM email_threads t
      JOIN users u ON u.workspace_id = t.workspace_id
      WHERE t.id = thread_activities.thread_id
      AND u.id = auth.uid()
    )
  );

CREATE POLICY "Users can create activities" ON thread_activities
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM email_threads t
      JOIN users u ON u.workspace_id = t.workspace_id
      WHERE t.id = thread_activities.thread_id
      AND u.id = auth.uid()
    )
  );

-- RLS Policies for saved_replies
CREATE POLICY "Users can view saved replies in their workspace" ON saved_replies
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM users WHERE id = auth.uid()
    )
    AND (is_shared = true OR user_id = auth.uid())
  );

CREATE POLICY "Users can manage their own saved replies" ON saved_replies
  FOR ALL
  USING (
    user_id = auth.uid() OR
    (is_shared = true AND workspace_id IN (
      SELECT workspace_id FROM users WHERE id = auth.uid()
    ))
  );

-- Function to update thread on new message
CREATE OR REPLACE FUNCTION update_thread_on_message() RETURNS TRIGGER AS $$
BEGIN
  UPDATE email_threads
  SET 
    last_message_at = NEW.received_at,
    last_message_from = NEW.from_email,
    message_count = message_count + 1,
    is_read = CASE WHEN NEW.direction = 'inbound' THEN false ELSE is_read END,
    updated_at = NOW()
  WHERE id = NEW.thread_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_thread_on_message_trigger
AFTER INSERT ON email_messages
FOR EACH ROW
EXECUTE FUNCTION update_thread_on_message();

-- Function to find or create thread
CREATE OR REPLACE FUNCTION find_or_create_thread(
  p_workspace_id UUID,
  p_subject TEXT,
  p_lead_id UUID DEFAULT NULL,
  p_campaign_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_thread_id UUID;
  v_normalized_subject TEXT;
BEGIN
  -- Normalize subject (remove Re:, Fwd:, etc)
  v_normalized_subject := regexp_replace(
    p_subject, 
    '^(RE:|FW:|FWD:|Re:|Fw:|Fwd:)\s*', 
    '', 
    'gi'
  );
  
  -- Try to find existing thread
  SELECT id INTO v_thread_id
  FROM email_threads
  WHERE workspace_id = p_workspace_id
  AND (
    subject = v_normalized_subject OR
    subject = p_subject
  )
  AND (
    (p_lead_id IS NULL AND lead_id IS NULL) OR
    lead_id = p_lead_id
  )
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Create new thread if not found
  IF v_thread_id IS NULL THEN
    INSERT INTO email_threads (
      workspace_id,
      subject,
      lead_id,
      campaign_id
    ) VALUES (
      p_workspace_id,
      v_normalized_subject,
      p_lead_id,
      p_campaign_id
    ) RETURNING id INTO v_thread_id;
  END IF;
  
  RETURN v_thread_id;
END;
$$ LANGUAGE plpgsql;