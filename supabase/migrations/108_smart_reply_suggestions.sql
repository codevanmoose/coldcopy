-- Smart Reply Suggestions Schema
-- AI-powered response suggestions for faster, more personalized replies

-- Message analysis table
CREATE TABLE IF NOT EXISTS message_analysis (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    message_id UUID NOT NULL, -- Can reference email_messages, linkedin_messages, or twitter_messages
    message_type TEXT CHECK (message_type IN ('email', 'linkedin', 'twitter')) NOT NULL,
    
    -- Original message content
    message_content TEXT NOT NULL,
    sender_name TEXT,
    sender_email TEXT,
    
    -- Analysis results
    sentiment TEXT CHECK (sentiment IN ('positive', 'negative', 'neutral', 'mixed')),
    sentiment_score DECIMAL(3,2), -- -1.0 to 1.0
    
    intent TEXT CHECK (intent IN (
        'question', 'complaint', 'interest', 'objection', 
        'meeting_request', 'pricing_inquiry', 'feature_request',
        'support_request', 'unsubscribe', 'other'
    )),
    intent_confidence DECIMAL(3,2), -- 0.0 to 1.0
    
    -- Key topics and entities
    topics JSONB DEFAULT '[]', -- ["pricing", "features", "integration"]
    entities JSONB DEFAULT '{}', -- {people: ["John"], companies: ["Acme Corp"], dates: ["next Tuesday"]}
    
    -- Context from conversation
    conversation_summary TEXT,
    previous_interactions INTEGER DEFAULT 0,
    
    -- Metadata
    analysis_model TEXT DEFAULT 'gpt-4-turbo-preview',
    analysis_tokens_used INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Reply suggestions table
CREATE TABLE IF NOT EXISTS reply_suggestions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    analysis_id UUID NOT NULL REFERENCES message_analysis(id) ON DELETE CASCADE,
    
    -- Suggestion details
    suggestion_type TEXT CHECK (suggestion_type IN (
        'quick_reply', 'detailed_response', 'follow_up',
        'objection_handling', 'meeting_proposal', 'closing'
    )) NOT NULL,
    
    -- The suggested reply
    content TEXT NOT NULL,
    tone TEXT CHECK (tone IN ('professional', 'friendly', 'casual', 'formal', 'enthusiastic')),
    
    -- Personalization elements used
    personalization_used JSONB DEFAULT '[]', -- ["name", "company", "previous_interaction", "pain_point"]
    
    -- Quality metrics
    relevance_score DECIMAL(3,2), -- 0.0 to 1.0
    personalization_score DECIMAL(3,2), -- 0.0 to 1.0
    
    -- Usage tracking
    was_selected BOOLEAN DEFAULT false,
    was_edited BOOLEAN DEFAULT false,
    final_content TEXT, -- If edited, store the final version
    selected_at TIMESTAMP WITH TIME ZONE,
    
    -- AI generation details
    ai_model TEXT DEFAULT 'gpt-4-turbo-preview',
    ai_tokens_used INTEGER,
    generation_time_ms INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Reply templates for common scenarios
CREATE TABLE IF NOT EXISTS reply_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Template categorization
    category TEXT CHECK (category IN (
        'initial_outreach', 'follow_up', 'objection_handling',
        'meeting_scheduling', 'pricing_discussion', 'technical_questions',
        'closing', 'thank_you', 'apology', 'referral_request'
    )) NOT NULL,
    
    intent TEXT CHECK (intent IN (
        'question', 'complaint', 'interest', 'objection', 
        'meeting_request', 'pricing_inquiry', 'feature_request',
        'support_request', 'unsubscribe', 'other'
    )),
    
    -- Template content
    name TEXT NOT NULL,
    description TEXT,
    template_content TEXT NOT NULL,
    
    -- Variables that can be personalized
    variables JSONB DEFAULT '[]', -- ["{{first_name}}", "{{company}}", "{{pain_point}}"]
    
    -- Usage stats
    times_used INTEGER DEFAULT 0,
    success_rate DECIMAL(3,2), -- Based on positive responses
    last_used_at TIMESTAMP WITH TIME ZONE,
    
    -- Settings
    is_active BOOLEAN DEFAULT true,
    requires_approval BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Conversation context for better suggestions
CREATE TABLE IF NOT EXISTS conversation_context (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    
    -- Conversation summary
    conversation_thread_id TEXT NOT NULL, -- Unique identifier for the conversation
    channel TEXT CHECK (channel IN ('email', 'linkedin', 'twitter')) NOT NULL,
    
    -- Context data
    message_count INTEGER DEFAULT 0,
    last_message_at TIMESTAMP WITH TIME ZONE,
    conversation_stage TEXT CHECK (conversation_stage IN (
        'initial_contact', 'qualification', 'discovery',
        'proposal', 'negotiation', 'closing', 'closed_won', 'closed_lost'
    )),
    
    -- Key information extracted
    pain_points JSONB DEFAULT '[]',
    objectives JSONB DEFAULT '[]',
    budget_mentioned BOOLEAN DEFAULT false,
    timeline_mentioned BOOLEAN DEFAULT false,
    decision_makers JSONB DEFAULT '[]',
    competitors_mentioned JSONB DEFAULT '[]',
    
    -- Sentiment tracking
    overall_sentiment TEXT CHECK (overall_sentiment IN ('positive', 'negative', 'neutral', 'mixed')),
    sentiment_trend TEXT CHECK (sentiment_trend IN ('improving', 'declining', 'stable')),
    
    -- AI-generated summary
    summary TEXT,
    next_steps TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Reply performance tracking
CREATE TABLE IF NOT EXISTS reply_performance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    suggestion_id UUID REFERENCES reply_suggestions(id) ON DELETE SET NULL,
    
    -- Message details
    sent_message_id UUID NOT NULL,
    sent_message_type TEXT CHECK (sent_message_type IN ('email', 'linkedin', 'twitter')) NOT NULL,
    sent_content TEXT NOT NULL,
    
    -- Response tracking
    got_response BOOLEAN DEFAULT false,
    response_time_hours DECIMAL(10,2),
    response_sentiment TEXT CHECK (response_sentiment IN ('positive', 'negative', 'neutral', 'mixed')),
    
    -- Outcome
    outcome TEXT CHECK (outcome IN (
        'meeting_scheduled', 'positive_response', 'requested_info',
        'objection_raised', 'not_interested', 'unsubscribed', 'no_response'
    )),
    
    -- Conversion tracking
    led_to_opportunity BOOLEAN DEFAULT false,
    led_to_deal BOOLEAN DEFAULT false,
    deal_value DECIMAL(10,2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_message_analysis_workspace ON message_analysis(workspace_id);
CREATE INDEX idx_message_analysis_sentiment ON message_analysis(workspace_id, sentiment);
CREATE INDEX idx_message_analysis_intent ON message_analysis(workspace_id, intent);
CREATE INDEX idx_reply_suggestions_analysis ON reply_suggestions(analysis_id);
CREATE INDEX idx_reply_suggestions_selected ON reply_suggestions(workspace_id, was_selected);
CREATE INDEX idx_reply_templates_category ON reply_templates(workspace_id, category);
CREATE INDEX idx_reply_templates_active ON reply_templates(workspace_id, is_active);
CREATE INDEX idx_conversation_context_lead ON conversation_context(workspace_id, lead_id);
CREATE INDEX idx_conversation_context_thread ON conversation_context(conversation_thread_id);
CREATE INDEX idx_reply_performance_outcome ON reply_performance(workspace_id, outcome);

-- Functions
CREATE OR REPLACE FUNCTION calculate_reply_success_rate()
RETURNS TRIGGER AS $$
BEGIN
    -- Update template success rate based on performance
    UPDATE reply_templates
    SET success_rate = (
        SELECT 
            CASE 
                WHEN COUNT(*) > 0 THEN
                    CAST(SUM(CASE WHEN rp.outcome IN ('meeting_scheduled', 'positive_response', 'requested_info') THEN 1 ELSE 0 END) AS DECIMAL) / COUNT(*)
                ELSE 0
            END
        FROM reply_performance rp
        JOIN reply_suggestions rs ON rp.suggestion_id = rs.id
        WHERE rs.content LIKE '%' || reply_templates.template_content || '%'
    )
    WHERE id IN (
        SELECT DISTINCT rt.id
        FROM reply_templates rt
        JOIN reply_suggestions rs ON rs.content LIKE '%' || rt.template_content || '%'
        WHERE rs.id = NEW.suggestion_id
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for success rate calculation
CREATE TRIGGER update_reply_success_rate
AFTER INSERT OR UPDATE ON reply_performance
FOR EACH ROW
EXECUTE FUNCTION calculate_reply_success_rate();

-- RLS policies
ALTER TABLE message_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE reply_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reply_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE reply_performance ENABLE ROW LEVEL SECURITY;

-- RLS policies for message_analysis
CREATE POLICY "Users can view their workspace's message analysis"
ON message_analysis FOR SELECT
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can create message analysis for their workspace"
ON message_analysis FOR INSERT
TO authenticated
WITH CHECK (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

-- Similar policies for other tables
CREATE POLICY "Users can manage their workspace's reply suggestions"
ON reply_suggestions FOR ALL
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can manage their workspace's reply templates"
ON reply_templates FOR ALL
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can view their workspace's conversation context"
ON conversation_context FOR ALL
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can view their workspace's reply performance"
ON reply_performance FOR ALL
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

-- Triggers
CREATE TRIGGER update_message_analysis_updated_at
    BEFORE UPDATE ON message_analysis
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reply_templates_updated_at
    BEFORE UPDATE ON reply_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversation_context_updated_at
    BEFORE UPDATE ON conversation_context
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();