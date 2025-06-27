-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create custom types
CREATE TYPE user_role AS ENUM ('super_admin', 'workspace_admin', 'campaign_manager', 'outreach_specialist');
CREATE TYPE campaign_status AS ENUM ('draft', 'scheduled', 'active', 'paused', 'completed');
CREATE TYPE email_event_type AS ENUM ('sent', 'delivered', 'opened', 'clicked', 'replied', 'bounced', 'unsubscribed');
CREATE TYPE lead_status AS ENUM ('new', 'contacted', 'replied', 'qualified', 'unqualified', 'unsubscribed');

-- Workspaces table (for multi-tenancy)
CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    domain TEXT,
    settings JSONB DEFAULT '{}',
    branding JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for slug lookups
CREATE INDEX idx_workspaces_slug ON workspaces(slug);

-- Users table (extends Supabase auth.users)
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    role user_role NOT NULL DEFAULT 'outreach_specialist',
    avatar_url TEXT,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for users
CREATE INDEX idx_users_workspace_id ON users(workspace_id);
CREATE INDEX idx_users_email ON users(email);

-- Campaigns table
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    status campaign_status NOT NULL DEFAULT 'draft',
    settings JSONB NOT NULL DEFAULT '{}',
    sequence_steps JSONB NOT NULL DEFAULT '[]',
    scheduling JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    scheduled_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for campaigns
CREATE INDEX idx_campaigns_workspace_id ON campaigns(workspace_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_created_by ON campaigns(created_by);

-- Leads table
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    company TEXT,
    title TEXT,
    status lead_status NOT NULL DEFAULT 'new',
    enrichment_data JSONB DEFAULT '{}',
    custom_fields JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(workspace_id, email)
);

-- Create indexes for leads
CREATE INDEX idx_leads_workspace_id ON leads(workspace_id);
CREATE INDEX idx_leads_email ON leads(email);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_company ON leads(company);
CREATE INDEX idx_leads_tags ON leads USING GIN(tags);

-- Campaign leads junction table
CREATE TABLE campaign_leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending',
    current_step INTEGER DEFAULT 0,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    last_contacted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(campaign_id, lead_id)
);

-- Create indexes for campaign_leads
CREATE INDEX idx_campaign_leads_campaign_id ON campaign_leads(campaign_id);
CREATE INDEX idx_campaign_leads_lead_id ON campaign_leads(lead_id);
CREATE INDEX idx_campaign_leads_scheduled_at ON campaign_leads(scheduled_at);

-- Email events table (partitioned by month)
CREATE TABLE email_events (
    id UUID DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL,
    campaign_id UUID NOT NULL,
    lead_id UUID NOT NULL,
    campaign_lead_id UUID REFERENCES campaign_leads(id) ON DELETE CASCADE,
    event_type email_event_type NOT NULL,
    email_id TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create indexes for email_events
CREATE INDEX idx_email_events_workspace_id ON email_events(workspace_id);
CREATE INDEX idx_email_events_campaign_id ON email_events(campaign_id);
CREATE INDEX idx_email_events_lead_id ON email_events(lead_id);
CREATE INDEX idx_email_events_event_type ON email_events(event_type);
CREATE INDEX idx_email_events_created_at ON email_events(created_at);

-- Create initial partitions for email_events
CREATE TABLE email_events_2024_01 PARTITION OF email_events
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
CREATE TABLE email_events_2024_02 PARTITION OF email_events
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
-- Add more partitions as needed

-- Email threads table
CREATE TABLE email_threads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    assigned_to UUID REFERENCES users(id),
    locked_by UUID REFERENCES users(id),
    locked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for email_threads
CREATE INDEX idx_email_threads_workspace_id ON email_threads(workspace_id);
CREATE INDEX idx_email_threads_campaign_id ON email_threads(campaign_id);
CREATE INDEX idx_email_threads_lead_id ON email_threads(lead_id);
CREATE INDEX idx_email_threads_assigned_to ON email_threads(assigned_to);

-- Email messages table
CREATE TABLE email_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id UUID NOT NULL REFERENCES email_threads(id) ON DELETE CASCADE,
    from_email TEXT NOT NULL,
    to_email TEXT NOT NULL,
    subject TEXT,
    body_text TEXT,
    body_html TEXT,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    message_id TEXT,
    in_reply_to TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for email_messages
CREATE INDEX idx_email_messages_thread_id ON email_messages(thread_id);
CREATE INDEX idx_email_messages_message_id ON email_messages(message_id);

-- AI token usage table
CREATE TABLE ai_token_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    model TEXT NOT NULL,
    tokens_used INTEGER NOT NULL,
    cost_cents INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for ai_token_usage
CREATE INDEX idx_ai_token_usage_workspace_id ON ai_token_usage(workspace_id);
CREATE INDEX idx_ai_token_usage_user_id ON ai_token_usage(user_id);
CREATE INDEX idx_ai_token_usage_created_at ON ai_token_usage(created_at);

-- Suppression list table
CREATE TABLE suppression_list (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(workspace_id, email)
);

-- Create indexes for suppression_list
CREATE INDEX idx_suppression_list_workspace_id ON suppression_list(workspace_id);
CREATE INDEX idx_suppression_list_email ON suppression_list(email);

-- Email templates table
CREATE TABLE email_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    body_text TEXT,
    body_html TEXT,
    variables JSONB DEFAULT '[]',
    is_shared BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for email_templates
CREATE INDEX idx_email_templates_workspace_id ON email_templates(workspace_id);
CREATE INDEX idx_email_templates_created_by ON email_templates(created_by);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON workspaces
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_email_threads_updated_at BEFORE UPDATE ON email_threads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_email_templates_updated_at BEFORE UPDATE ON email_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_token_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppression_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- Workspaces policies
CREATE POLICY "Users can view their workspace" ON workspaces
    FOR SELECT USING (
        id IN (SELECT workspace_id FROM users WHERE id = auth.uid())
    );

CREATE POLICY "Super admins can manage all workspaces" ON workspaces
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin')
    );

-- Users policies
CREATE POLICY "Users can view users in their workspace" ON users
    FOR SELECT USING (
        workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid())
    );

CREATE POLICY "Workspace admins can manage users" ON users
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM users 
            WHERE id = auth.uid() AND role IN ('workspace_admin', 'super_admin')
        )
    );

-- Campaigns policies
CREATE POLICY "Users can view campaigns in their workspace" ON campaigns
    FOR SELECT USING (
        workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid())
    );

CREATE POLICY "Campaign managers can manage campaigns" ON campaigns
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM users 
            WHERE id = auth.uid() AND role IN ('campaign_manager', 'workspace_admin', 'super_admin')
        )
    );

-- Leads policies
CREATE POLICY "Users can view leads in their workspace" ON leads
    FOR SELECT USING (
        workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid())
    );

CREATE POLICY "Users can manage leads in their workspace" ON leads
    FOR ALL USING (
        workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid())
    );

-- Apply similar policies to other tables...

-- Create materialized view for lead engagement summary
CREATE MATERIALIZED VIEW lead_engagement_summary AS
SELECT 
    l.id as lead_id,
    l.workspace_id,
    l.email,
    l.status as lead_status,
    COUNT(DISTINCT e.campaign_id) as campaigns_count,
    COUNT(CASE WHEN e.event_type = 'sent' THEN 1 END) as emails_sent,
    COUNT(CASE WHEN e.event_type = 'opened' THEN 1 END) as emails_opened,
    COUNT(CASE WHEN e.event_type = 'clicked' THEN 1 END) as emails_clicked,
    COUNT(CASE WHEN e.event_type = 'replied' THEN 1 END) as emails_replied,
    MAX(e.created_at) as last_activity_at
FROM leads l
LEFT JOIN email_events e ON l.id = e.lead_id
GROUP BY l.id, l.workspace_id, l.email, l.status;

-- Create index on materialized view
CREATE INDEX idx_lead_engagement_workspace ON lead_engagement_summary(workspace_id);
CREATE INDEX idx_lead_engagement_lead ON lead_engagement_summary(lead_id);

-- Create function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_lead_engagement_summary()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY lead_engagement_summary;
END;
$$ LANGUAGE plpgsql;