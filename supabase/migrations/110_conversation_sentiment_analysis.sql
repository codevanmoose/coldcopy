-- Conversation Sentiment Analysis Schema
-- Track sentiment trends across entire conversation threads

-- Conversation threads table
CREATE TABLE IF NOT EXISTS conversation_threads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    
    -- Thread identification
    thread_key TEXT NOT NULL, -- Unique identifier for the conversation
    channel TEXT CHECK (channel IN ('email', 'linkedin', 'twitter', 'multi')) NOT NULL,
    subject TEXT,
    
    -- Participants
    participants JSONB DEFAULT '[]', -- Array of participant info
    primary_contact_email TEXT,
    primary_contact_name TEXT,
    
    -- Thread metadata
    message_count INTEGER DEFAULT 0,
    first_message_at TIMESTAMP WITH TIME ZONE,
    last_message_at TIMESTAMP WITH TIME ZONE,
    last_analyzed_at TIMESTAMP WITH TIME ZONE,
    
    -- Overall sentiment metrics
    overall_sentiment TEXT CHECK (overall_sentiment IN ('very_positive', 'positive', 'neutral', 'negative', 'very_negative')),
    sentiment_score DECIMAL(3,2), -- -1.0 to 1.0
    sentiment_confidence DECIMAL(3,2), -- 0.0 to 1.0
    
    -- Sentiment trend
    sentiment_trend TEXT CHECK (sentiment_trend IN ('improving', 'stable', 'declining', 'volatile')),
    sentiment_history JSONB DEFAULT '[]', -- Array of {timestamp, score, sentiment}
    
    -- Conversation dynamics
    response_time_avg_hours DECIMAL(10,2),
    response_time_trend TEXT CHECK (response_time_trend IN ('faster', 'stable', 'slower')),
    engagement_level TEXT CHECK (engagement_level IN ('high', 'medium', 'low', 'declining')),
    
    -- Key moments
    turning_points JSONB DEFAULT '[]', -- Moments where sentiment shifted significantly
    positive_peaks JSONB DEFAULT '[]', -- Highest positive sentiment moments
    negative_valleys JSONB DEFAULT '[]', -- Lowest sentiment moments
    
    -- Risk indicators
    risk_level TEXT CHECK (risk_level IN ('none', 'low', 'medium', 'high', 'critical')),
    risk_factors JSONB DEFAULT '[]', -- Array of risk factors detected
    churn_probability DECIMAL(3,2), -- 0.0 to 1.0
    
    -- Opportunity indicators
    opportunity_score DECIMAL(3,2), -- 0.0 to 1.0
    buying_signals JSONB DEFAULT '[]', -- Detected buying signals
    next_best_action TEXT,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    archived_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint
    CONSTRAINT unique_workspace_thread_key UNIQUE (workspace_id, thread_key)
);

-- Individual message sentiment analysis
CREATE TABLE IF NOT EXISTS message_sentiments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    thread_id UUID NOT NULL REFERENCES conversation_threads(id) ON DELETE CASCADE,
    
    -- Message reference
    message_id UUID NOT NULL, -- References email_messages, linkedin_messages, or twitter_messages
    message_type TEXT CHECK (message_type IN ('email', 'linkedin', 'twitter')) NOT NULL,
    
    -- Message metadata
    sender_email TEXT,
    sender_name TEXT,
    is_from_lead BOOLEAN DEFAULT false,
    message_content TEXT NOT NULL,
    message_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Sentiment analysis
    sentiment TEXT CHECK (sentiment IN ('very_positive', 'positive', 'neutral', 'negative', 'very_negative')) NOT NULL,
    sentiment_score DECIMAL(3,2) NOT NULL, -- -1.0 to 1.0
    confidence DECIMAL(3,2) NOT NULL, -- 0.0 to 1.0
    
    -- Emotion detection
    emotions JSONB DEFAULT '{}', -- {joy: 0.8, anger: 0.1, fear: 0.1, etc.}
    dominant_emotion TEXT,
    
    -- Language analysis
    tone JSONB DEFAULT '{}', -- {professional: 0.9, casual: 0.1, formal: 0.8, etc.}
    politeness_score DECIMAL(3,2), -- 0.0 to 1.0
    urgency_level TEXT CHECK (urgency_level IN ('none', 'low', 'medium', 'high', 'critical')),
    
    -- Key phrases and topics
    key_phrases JSONB DEFAULT '[]',
    topics JSONB DEFAULT '[]',
    entities JSONB DEFAULT '{}', -- Named entities mentioned
    
    -- Intent and signals
    detected_intents JSONB DEFAULT '[]', -- ['question', 'complaint', 'praise', etc.]
    buying_signals JSONB DEFAULT '[]',
    risk_signals JSONB DEFAULT '[]',
    
    -- Context from thread
    messages_before INTEGER DEFAULT 0,
    sentiment_change_from_previous DECIMAL(3,2), -- Change from previous message
    is_turning_point BOOLEAN DEFAULT false,
    
    -- Analysis metadata
    analyzed_by TEXT DEFAULT 'gpt-4-turbo-preview',
    analysis_version TEXT DEFAULT 'v1',
    tokens_used INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Sentiment alerts and triggers
CREATE TABLE IF NOT EXISTS sentiment_alerts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    thread_id UUID NOT NULL REFERENCES conversation_threads(id) ON DELETE CASCADE,
    
    -- Alert details
    alert_type TEXT CHECK (alert_type IN (
        'negative_sentiment', 'sentiment_decline', 'high_risk',
        'churn_risk', 'escalation_needed', 'opportunity_detected',
        'positive_momentum', 'engagement_drop'
    )) NOT NULL,
    
    severity TEXT CHECK (severity IN ('info', 'warning', 'critical')) NOT NULL,
    
    -- Alert context
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    recommended_action TEXT,
    
    -- Trigger details
    triggered_by TEXT, -- What caused the alert
    trigger_value DECIMAL(10,2), -- Numeric value that triggered it
    threshold_value DECIMAL(10,2), -- Threshold that was exceeded
    
    -- Status
    status TEXT CHECK (status IN ('active', 'acknowledged', 'resolved', 'ignored')) DEFAULT 'active',
    acknowledged_by UUID REFERENCES users(id),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT,
    
    -- Automation
    auto_action_taken BOOLEAN DEFAULT false,
    auto_action_details JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Sentiment analysis rules
CREATE TABLE IF NOT EXISTS sentiment_rules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Rule definition
    name TEXT NOT NULL,
    description TEXT,
    rule_type TEXT CHECK (rule_type IN ('threshold', 'pattern', 'keyword', 'trend')) NOT NULL,
    
    -- Conditions
    conditions JSONB NOT NULL, -- Rule conditions
    
    -- Actions
    alert_enabled BOOLEAN DEFAULT true,
    alert_severity TEXT CHECK (alert_severity IN ('info', 'warning', 'critical')) DEFAULT 'warning',
    notification_channels JSONB DEFAULT '[]', -- ['email', 'slack', 'webhook']
    
    -- Auto-response
    auto_response_enabled BOOLEAN DEFAULT false,
    auto_response_template TEXT,
    auto_assign_to UUID REFERENCES users(id),
    
    -- Settings
    is_active BOOLEAN DEFAULT true,
    cooldown_hours INTEGER DEFAULT 24, -- Don't trigger again for X hours
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Sentiment benchmarks by industry/category
CREATE TABLE IF NOT EXISTS sentiment_benchmarks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Benchmark category
    industry TEXT,
    conversation_stage TEXT,
    channel TEXT,
    
    -- Benchmark values
    avg_sentiment_score DECIMAL(3,2),
    positive_threshold DECIMAL(3,2),
    negative_threshold DECIMAL(3,2),
    
    -- Response time benchmarks
    avg_response_time_hours DECIMAL(10,2),
    fast_response_threshold_hours DECIMAL(10,2),
    slow_response_threshold_hours DECIMAL(10,2),
    
    -- Engagement benchmarks
    avg_message_count INTEGER,
    high_engagement_threshold INTEGER,
    low_engagement_threshold INTEGER,
    
    -- Conversion benchmarks
    avg_positive_conversion_rate DECIMAL(3,2),
    avg_sentiment_at_conversion DECIMAL(3,2),
    
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_conversation_threads_workspace ON conversation_threads(workspace_id);
CREATE INDEX idx_conversation_threads_lead ON conversation_threads(lead_id);
CREATE INDEX idx_conversation_threads_sentiment ON conversation_threads(workspace_id, overall_sentiment);
CREATE INDEX idx_conversation_threads_risk ON conversation_threads(workspace_id, risk_level) WHERE risk_level != 'none';
CREATE INDEX idx_conversation_threads_active ON conversation_threads(workspace_id, is_active) WHERE is_active = true;

CREATE INDEX idx_message_sentiments_thread ON message_sentiments(thread_id);
CREATE INDEX idx_message_sentiments_timestamp ON message_sentiments(thread_id, message_timestamp);
CREATE INDEX idx_message_sentiments_turning_points ON message_sentiments(thread_id) WHERE is_turning_point = true;

CREATE INDEX idx_sentiment_alerts_workspace_active ON sentiment_alerts(workspace_id, status) WHERE status = 'active';
CREATE INDEX idx_sentiment_alerts_thread ON sentiment_alerts(thread_id);

-- Functions
CREATE OR REPLACE FUNCTION calculate_sentiment_trend(
    sentiment_history JSONB
) RETURNS TEXT AS $$
DECLARE
    history_length INTEGER;
    recent_avg DECIMAL;
    older_avg DECIMAL;
    volatility DECIMAL;
BEGIN
    history_length := jsonb_array_length(sentiment_history);
    
    IF history_length < 3 THEN
        RETURN 'stable';
    END IF;
    
    -- Calculate average of recent half vs older half
    SELECT AVG((value->>'score')::DECIMAL) INTO recent_avg
    FROM jsonb_array_elements(sentiment_history) WITH ORDINALITY AS t(value, idx)
    WHERE idx > history_length / 2;
    
    SELECT AVG((value->>'score')::DECIMAL) INTO older_avg
    FROM jsonb_array_elements(sentiment_history) WITH ORDINALITY AS t(value, idx)
    WHERE idx <= history_length / 2;
    
    -- Calculate volatility
    SELECT STDDEV((value->>'score')::DECIMAL) INTO volatility
    FROM jsonb_array_elements(sentiment_history) AS value;
    
    -- Determine trend
    IF volatility > 0.3 THEN
        RETURN 'volatile';
    ELSIF recent_avg > older_avg + 0.1 THEN
        RETURN 'improving';
    ELSIF recent_avg < older_avg - 0.1 THEN
        RETURN 'declining';
    ELSE
        RETURN 'stable';
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION calculate_risk_level(
    sentiment_score DECIMAL,
    sentiment_trend TEXT,
    response_time_trend TEXT,
    engagement_level TEXT,
    churn_probability DECIMAL
) RETURNS TEXT AS $$
BEGIN
    -- Critical risk conditions
    IF sentiment_score < -0.5 OR churn_probability > 0.8 THEN
        RETURN 'critical';
    END IF;
    
    -- High risk conditions
    IF sentiment_score < -0.2 OR 
       (sentiment_trend = 'declining' AND engagement_level = 'low') OR
       churn_probability > 0.6 THEN
        RETURN 'high';
    END IF;
    
    -- Medium risk conditions
    IF sentiment_score < 0 OR 
       sentiment_trend = 'volatile' OR
       response_time_trend = 'slower' OR
       churn_probability > 0.4 THEN
        RETURN 'medium';
    END IF;
    
    -- Low risk conditions
    IF sentiment_score < 0.3 OR engagement_level = 'low' THEN
        RETURN 'low';
    END IF;
    
    RETURN 'none';
END;
$$ LANGUAGE plpgsql;

-- Trigger to update thread sentiment after new message
CREATE OR REPLACE FUNCTION update_thread_sentiment()
RETURNS TRIGGER AS $$
DECLARE
    thread_stats RECORD;
    new_sentiment_history JSONB;
    new_turning_points JSONB;
BEGIN
    -- Calculate updated thread statistics
    SELECT 
        COUNT(*) as msg_count,
        AVG(sentiment_score) as avg_sentiment,
        MIN(message_timestamp) as first_msg,
        MAX(message_timestamp) as last_msg,
        AVG(CASE WHEN confidence > 0 THEN confidence END) as avg_confidence
    INTO thread_stats
    FROM message_sentiments
    WHERE thread_id = NEW.thread_id;
    
    -- Update sentiment history
    SELECT 
        COALESCE(sentiment_history, '[]'::jsonb) || 
        jsonb_build_object(
            'timestamp', NEW.message_timestamp,
            'score', NEW.sentiment_score,
            'sentiment', NEW.sentiment
        )
    INTO new_sentiment_history
    FROM conversation_threads
    WHERE id = NEW.thread_id;
    
    -- Check for turning points
    IF NEW.is_turning_point THEN
        SELECT 
            COALESCE(turning_points, '[]'::jsonb) || 
            jsonb_build_object(
                'message_id', NEW.message_id,
                'timestamp', NEW.message_timestamp,
                'from_sentiment', LAG(NEW.sentiment) OVER (ORDER BY NEW.message_timestamp),
                'to_sentiment', NEW.sentiment,
                'change', NEW.sentiment_change_from_previous
            )
        INTO new_turning_points
        FROM conversation_threads
        WHERE id = NEW.thread_id;
    END IF;
    
    -- Update conversation thread
    UPDATE conversation_threads
    SET 
        message_count = thread_stats.msg_count,
        overall_sentiment = CASE
            WHEN thread_stats.avg_sentiment >= 0.5 THEN 'very_positive'
            WHEN thread_stats.avg_sentiment >= 0.2 THEN 'positive'
            WHEN thread_stats.avg_sentiment >= -0.2 THEN 'neutral'
            WHEN thread_stats.avg_sentiment >= -0.5 THEN 'negative'
            ELSE 'very_negative'
        END,
        sentiment_score = thread_stats.avg_sentiment,
        sentiment_confidence = thread_stats.avg_confidence,
        sentiment_history = new_sentiment_history,
        sentiment_trend = calculate_sentiment_trend(new_sentiment_history),
        turning_points = COALESCE(new_turning_points, turning_points),
        first_message_at = COALESCE(first_message_at, thread_stats.first_msg),
        last_message_at = thread_stats.last_msg,
        last_analyzed_at = NOW(),
        updated_at = NOW()
    WHERE id = NEW.thread_id;
    
    -- Update risk level
    UPDATE conversation_threads
    SET risk_level = calculate_risk_level(
        sentiment_score,
        sentiment_trend,
        response_time_trend,
        engagement_level,
        churn_probability
    )
    WHERE id = NEW.thread_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_thread_sentiment
AFTER INSERT ON message_sentiments
FOR EACH ROW
EXECUTE FUNCTION update_thread_sentiment();

-- RLS policies
ALTER TABLE conversation_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_sentiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentiment_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentiment_rules ENABLE ROW LEVEL SECURITY;

-- RLS policies for conversation_threads
CREATE POLICY "Users can view their workspace's conversation threads"
ON conversation_threads FOR SELECT
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can manage their workspace's conversation threads"
ON conversation_threads FOR ALL
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

-- Similar policies for other tables
CREATE POLICY "Users can view their workspace's message sentiments"
ON message_sentiments FOR SELECT
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can manage their workspace's sentiment alerts"
ON sentiment_alerts FOR ALL
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can manage their workspace's sentiment rules"
ON sentiment_rules FOR ALL
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

-- Triggers
CREATE TRIGGER update_conversation_threads_updated_at
    BEFORE UPDATE ON conversation_threads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sentiment_alerts_updated_at
    BEFORE UPDATE ON sentiment_alerts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sentiment_rules_updated_at
    BEFORE UPDATE ON sentiment_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();