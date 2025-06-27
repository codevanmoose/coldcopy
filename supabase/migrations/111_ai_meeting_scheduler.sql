-- AI Meeting Scheduler Schema
-- Intelligent meeting detection, scheduling, and automation

-- Meeting requests detected from conversations
CREATE TABLE IF NOT EXISTS meeting_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    
    -- Source information
    source_message_id UUID NOT NULL, -- Original message that triggered detection
    source_type TEXT CHECK (source_type IN ('email', 'linkedin', 'twitter', 'manual')) NOT NULL,
    conversation_thread_id UUID REFERENCES conversation_threads(id),
    
    -- Request details
    requester_email TEXT NOT NULL,
    requester_name TEXT,
    requested_by_lead BOOLEAN DEFAULT true, -- true if lead requested, false if sales rep
    
    -- Meeting intent detection
    intent_confidence DECIMAL(3,2) NOT NULL, -- 0.0 to 1.0
    detected_intent TEXT CHECK (detected_intent IN (
        'demo_request', 'intro_call', 'follow_up', 'technical_discussion',
        'negotiation', 'closing_call', 'check_in', 'general_meeting'
    )) NOT NULL,
    
    -- Extracted meeting details
    suggested_duration_minutes INTEGER DEFAULT 30,
    suggested_topic TEXT,
    suggested_agenda JSONB DEFAULT '[]', -- Array of agenda items
    participants JSONB DEFAULT '[]', -- Array of {email, name, role}
    
    -- Time preferences extracted
    timezone TEXT,
    preferred_times JSONB DEFAULT '[]', -- Array of time preferences mentioned
    earliest_date DATE,
    latest_date DATE,
    urgency_level TEXT CHECK (urgency_level IN ('low', 'medium', 'high', 'asap')) DEFAULT 'medium',
    
    -- Status tracking
    status TEXT CHECK (status IN (
        'detected', 'pending_slots', 'slots_proposed', 'scheduled', 
        'rescheduled', 'cancelled', 'completed', 'no_show'
    )) DEFAULT 'detected',
    
    -- AI analysis
    ai_analysis JSONB DEFAULT '{}', -- Full AI analysis results
    ai_model TEXT DEFAULT 'gpt-4-turbo-preview',
    tokens_used INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Proposed meeting slots
CREATE TABLE IF NOT EXISTS meeting_slots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    request_id UUID NOT NULL REFERENCES meeting_requests(id) ON DELETE CASCADE,
    
    -- Slot details
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    timezone TEXT NOT NULL,
    
    -- Availability info
    host_available BOOLEAN DEFAULT true,
    attendees_available JSONB DEFAULT '{}', -- {email: boolean}
    conflicts JSONB DEFAULT '[]', -- Array of conflicting events
    
    -- Scoring
    preference_score DECIMAL(3,2), -- 0.0 to 1.0 based on stated preferences
    convenience_score DECIMAL(3,2), -- 0.0 to 1.0 based on time of day, day of week
    overall_score DECIMAL(3,2), -- Combined score for ranking
    
    -- Selection
    is_proposed BOOLEAN DEFAULT false,
    proposed_at TIMESTAMP WITH TIME ZONE,
    is_selected BOOLEAN DEFAULT false,
    selected_at TIMESTAMP WITH TIME ZONE,
    rejected_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Scheduled meetings
CREATE TABLE IF NOT EXISTS scheduled_meetings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    request_id UUID NOT NULL REFERENCES meeting_requests(id) ON DELETE CASCADE,
    slot_id UUID REFERENCES meeting_slots(id),
    
    -- Meeting details
    title TEXT NOT NULL,
    description TEXT,
    agenda JSONB DEFAULT '[]',
    
    -- Time and location
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    timezone TEXT NOT NULL,
    location TEXT, -- Physical location
    meeting_url TEXT, -- Video conferencing link
    meeting_provider TEXT CHECK (meeting_provider IN ('zoom', 'teams', 'meet', 'other')),
    
    -- Participants
    host_email TEXT NOT NULL,
    host_name TEXT,
    attendees JSONB NOT NULL DEFAULT '[]', -- Array of {email, name, status, responded_at}
    
    -- Calendar integration
    calendar_event_id TEXT, -- External calendar event ID
    calendar_provider TEXT CHECK (calendar_provider IN ('google', 'outlook', 'other')),
    ical_uid TEXT,
    
    -- Status tracking
    status TEXT CHECK (status IN (
        'scheduled', 'confirmed', 'tentative', 'cancelled', 
        'completed', 'no_show', 'rescheduled'
    )) DEFAULT 'scheduled',
    
    -- Reminders
    reminder_sent_24h BOOLEAN DEFAULT false,
    reminder_sent_1h BOOLEAN DEFAULT false,
    
    -- Meeting outcome
    attendance JSONB DEFAULT '{}', -- {email: attended_boolean}
    duration_minutes INTEGER,
    meeting_notes TEXT,
    follow_up_required BOOLEAN DEFAULT false,
    outcome TEXT CHECK (outcome IN (
        'successful', 'rescheduled', 'no_show_lead', 
        'no_show_sales', 'cancelled', 'technical_issues'
    )),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Meeting templates for different types
CREATE TABLE IF NOT EXISTS meeting_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Template info
    name TEXT NOT NULL,
    meeting_type TEXT CHECK (meeting_type IN (
        'demo_request', 'intro_call', 'follow_up', 'technical_discussion',
        'negotiation', 'closing_call', 'check_in', 'general_meeting'
    )) NOT NULL,
    
    -- Default settings
    default_duration_minutes INTEGER DEFAULT 30,
    default_title TEXT,
    default_description TEXT,
    default_agenda JSONB DEFAULT '[]',
    
    -- Scheduling preferences
    buffer_before_minutes INTEGER DEFAULT 0,
    buffer_after_minutes INTEGER DEFAULT 0,
    preferred_hours JSONB DEFAULT '{}', -- {monday: {start: "09:00", end: "17:00"}, ...}
    
    -- Communication templates
    invitation_template TEXT,
    reminder_template_24h TEXT,
    reminder_template_1h TEXT,
    follow_up_template TEXT,
    cancellation_template TEXT,
    
    -- Settings
    auto_send_invites BOOLEAN DEFAULT true,
    auto_send_reminders BOOLEAN DEFAULT true,
    require_confirmation BOOLEAN DEFAULT false,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Meeting availability rules
CREATE TABLE IF NOT EXISTS meeting_availability (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Availability windows
    timezone TEXT NOT NULL DEFAULT 'UTC',
    weekly_hours JSONB NOT NULL DEFAULT '{}', -- {monday: [{start: "09:00", end: "12:00"}, ...], ...}
    
    -- Constraints
    min_notice_hours INTEGER DEFAULT 24,
    max_bookings_per_day INTEGER DEFAULT 5,
    buffer_between_meetings_minutes INTEGER DEFAULT 15,
    
    -- Blocked dates
    blocked_dates JSONB DEFAULT '[]', -- Array of date ranges
    
    -- Integration settings
    sync_with_calendar BOOLEAN DEFAULT true,
    calendar_provider TEXT CHECK (calendar_provider IN ('google', 'outlook', 'other')),
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Meeting analytics
CREATE TABLE IF NOT EXISTS meeting_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Time period
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Request metrics
    total_requests_detected INTEGER DEFAULT 0,
    requests_converted_to_meetings INTEGER DEFAULT 0,
    avg_time_to_schedule_hours DECIMAL(10,2),
    
    -- Meeting metrics
    total_meetings_scheduled INTEGER DEFAULT 0,
    meetings_completed INTEGER DEFAULT 0,
    meetings_cancelled INTEGER DEFAULT 0,
    meetings_no_show INTEGER DEFAULT 0,
    
    -- Efficiency metrics
    avg_slots_proposed DECIMAL(5,2),
    first_slot_acceptance_rate DECIMAL(3,2),
    reschedule_rate DECIMAL(3,2),
    
    -- Outcome metrics
    meetings_led_to_opportunity DECIMAL(3,2),
    avg_meeting_duration_minutes DECIMAL(10,2),
    satisfaction_score DECIMAL(3,2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_meeting_requests_workspace ON meeting_requests(workspace_id);
CREATE INDEX idx_meeting_requests_status ON meeting_requests(workspace_id, status);
CREATE INDEX idx_meeting_requests_lead ON meeting_requests(lead_id);
CREATE INDEX idx_meeting_slots_request ON meeting_slots(request_id);
CREATE INDEX idx_meeting_slots_time ON meeting_slots(start_time, end_time);
CREATE INDEX idx_scheduled_meetings_workspace ON scheduled_meetings(workspace_id);
CREATE INDEX idx_scheduled_meetings_time ON scheduled_meetings(start_time, status);
CREATE INDEX idx_meeting_availability_user ON meeting_availability(user_id);

-- Functions
CREATE OR REPLACE FUNCTION calculate_slot_score(
    slot meeting_slots,
    preferences JSONB
) RETURNS DECIMAL AS $$
DECLARE
    pref_score DECIMAL := 0.5;
    conv_score DECIMAL := 0.5;
    hour INTEGER;
    dow INTEGER;
BEGIN
    -- Extract hour and day of week
    hour := EXTRACT(HOUR FROM slot.start_time);
    dow := EXTRACT(DOW FROM slot.start_time);
    
    -- Preference score based on mentioned times
    IF preferences IS NOT NULL AND jsonb_array_length(preferences) > 0 THEN
        -- Check if slot matches any preferred times
        -- Implementation depends on preference format
        pref_score := 0.7; -- Placeholder
    END IF;
    
    -- Convenience score based on business hours
    IF hour >= 9 AND hour <= 17 AND dow BETWEEN 1 AND 5 THEN
        conv_score := 1.0;
    ELSIF hour >= 8 AND hour <= 18 AND dow BETWEEN 1 AND 5 THEN
        conv_score := 0.8;
    ELSIF dow IN (0, 6) THEN -- Weekend
        conv_score := 0.3;
    ELSE
        conv_score := 0.5;
    END IF;
    
    -- Calculate overall score
    RETURN (pref_score * 0.6 + conv_score * 0.4);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION detect_meeting_request()
RETURNS TRIGGER AS $$
DECLARE
    workspace_id UUID;
    lead_id UUID;
BEGIN
    -- Get workspace_id based on message type
    IF TG_TABLE_NAME = 'email_messages' THEN
        SELECT em.workspace_id, ce.lead_id 
        INTO workspace_id, lead_id
        FROM email_messages em
        LEFT JOIN campaign_emails ce ON em.campaign_email_id = ce.id
        WHERE em.id = NEW.id;
    ELSIF TG_TABLE_NAME = 'linkedin_messages' THEN
        SELECT lm.workspace_id, lp.lead_id
        INTO workspace_id, lead_id
        FROM linkedin_messages lm
        LEFT JOIN linkedin_profiles lp ON lm.profile_id = lp.id
        WHERE lm.id = NEW.id;
    END IF;
    
    -- Check if message contains meeting-related keywords
    IF NEW.content ~* '\m(meeting|call|demo|schedule|calendar|availability|book|appointment)\M' THEN
        -- Queue for AI analysis
        INSERT INTO meeting_request_queue (
            workspace_id,
            message_id,
            message_type,
            lead_id,
            status
        ) VALUES (
            workspace_id,
            NEW.id,
            TG_TABLE_NAME,
            lead_id,
            'pending'
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create queue table for async processing
CREATE TABLE IF NOT EXISTS meeting_request_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL,
    message_id UUID NOT NULL,
    message_type TEXT NOT NULL,
    lead_id UUID,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- RLS policies
ALTER TABLE meeting_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_analytics ENABLE ROW LEVEL SECURITY;

-- RLS policies for meeting_requests
CREATE POLICY "Users can view their workspace's meeting requests"
ON meeting_requests FOR SELECT
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can manage their workspace's meeting requests"
ON meeting_requests FOR ALL
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

-- Similar policies for other tables
CREATE POLICY "Users can manage their workspace's meeting slots"
ON meeting_slots FOR ALL
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can manage their workspace's scheduled meetings"
ON scheduled_meetings FOR ALL
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can manage their workspace's meeting templates"
ON meeting_templates FOR ALL
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can manage their meeting availability"
ON meeting_availability FOR ALL
TO authenticated
USING (
    user_id = auth.uid() OR
    workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

-- Triggers
CREATE TRIGGER update_meeting_requests_updated_at
    BEFORE UPDATE ON meeting_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scheduled_meetings_updated_at
    BEFORE UPDATE ON scheduled_meetings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meeting_templates_updated_at
    BEFORE UPDATE ON meeting_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meeting_availability_updated_at
    BEFORE UPDATE ON meeting_availability
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();