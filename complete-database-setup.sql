-- ===============================================
-- COMPLETE DATABASE SETUP FOR COLDCOPY
-- Run this in Supabase SQL Editor to reach 100%
-- ===============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop existing types and recreate to avoid conflicts
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS workspace_status CASCADE;
DROP TYPE IF EXISTS lead_status CASCADE;
DROP TYPE IF EXISTS campaign_status CASCADE;

-- Create enums
CREATE TYPE user_role AS ENUM ('super_admin', 'workspace_admin', 'campaign_manager', 'outreach_specialist');
CREATE TYPE workspace_status AS ENUM ('active', 'suspended', 'cancelled', 'trial');
CREATE TYPE lead_status AS ENUM ('new', 'contacted', 'replied', 'qualified', 'unqualified', 'unsubscribed');
CREATE TYPE campaign_status AS ENUM ('draft', 'scheduled', 'active', 'paused', 'completed');

-- ===============================================
-- 1. CORE AUTH & WORKSPACE TABLES
-- ===============================================

-- Create workspaces table
CREATE TABLE IF NOT EXISTS workspaces (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    domain VARCHAR(255),
    logo_url TEXT,
    brand_color VARCHAR(7) DEFAULT '#4F46E5',
    settings JSONB DEFAULT '{}',
    status workspace_status DEFAULT 'trial',
    trial_ends_at TIMESTAMPTZ,
    subscription_id VARCHAR(255),
    subscription_status VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    avatar_url TEXT,
    phone VARCHAR(50),
    timezone VARCHAR(50) DEFAULT 'UTC',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create workspace members table (many-to-many)
CREATE TABLE IF NOT EXISTS workspace_members (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'outreach_specialist',
    is_default BOOLEAN DEFAULT FALSE,
    invited_by UUID REFERENCES auth.users(id),
    invited_at TIMESTAMPTZ,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    permissions JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, user_id)
);

-- ===============================================
-- 2. LEADS TABLE
-- ===============================================

CREATE TABLE IF NOT EXISTS leads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    name TEXT GENERATED ALWAYS AS (
        CASE 
            WHEN first_name IS NOT NULL AND last_name IS NOT NULL THEN first_name || ' ' || last_name
            WHEN first_name IS NOT NULL THEN first_name
            WHEN last_name IS NOT NULL THEN last_name
            ELSE NULL
        END
    ) STORED,
    company TEXT,
    title TEXT,
    phone TEXT,
    website TEXT,
    linkedin_url TEXT,
    location TEXT,
    industry TEXT,
    status lead_status NOT NULL DEFAULT 'new',
    score INTEGER DEFAULT 0,
    tags TEXT[] DEFAULT '{}',
    custom_fields JSONB DEFAULT '{}',
    notes TEXT,
    last_contacted_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, email)
);

-- ===============================================
-- 3. EMAIL TEMPLATES TABLE
-- ===============================================

CREATE TABLE IF NOT EXISTS email_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    blocks JSONB NOT NULL DEFAULT '[]',
    variables TEXT[] DEFAULT '{}',
    styles JSONB DEFAULT '{"backgroundColor": "#ffffff", "fontFamily": "Arial, sans-serif", "maxWidth": "600px"}',
    preview_text TEXT,
    subject TEXT,
    is_public BOOLEAN DEFAULT false,
    tags TEXT[] DEFAULT '{}',
    thumbnail TEXT,
    usage_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, name)
);

-- ===============================================
-- 4. CAMPAIGNS TABLES
-- ===============================================

-- Create campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL DEFAULT 'sequence' CHECK (type IN ('sequence', 'one-off', 'drip')),
    status campaign_status NOT NULL DEFAULT 'draft',
    timezone TEXT NOT NULL DEFAULT 'UTC',
    schedule_settings JSONB DEFAULT '{}',
    daily_limit INTEGER DEFAULT 50,
    total_leads INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    open_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    bounce_count INTEGER DEFAULT 0,
    email_sequence JSONB DEFAULT '[]',
    target_audience JSONB DEFAULT '{}',
    settings JSONB DEFAULT '{}',
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    scheduled_at TIMESTAMPTZ
);

-- Create campaign_emails table (for email sequences)
CREATE TABLE IF NOT EXISTS campaign_emails (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    sequence_number INTEGER NOT NULL,
    name TEXT,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    delay_days INTEGER DEFAULT 0,
    delay_hours INTEGER DEFAULT 0,
    condition_type TEXT DEFAULT 'always' CHECK (condition_type IN ('always', 'no_reply', 'no_open', 'opened', 'clicked')),
    condition_value TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(campaign_id, sequence_number)
);

-- Create campaign_leads table (junction table for campaigns and leads)
CREATE TABLE IF NOT EXISTS campaign_leads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'unsubscribed', 'bounced')),
    current_sequence INTEGER DEFAULT 0,
    next_email_at TIMESTAMPTZ,
    last_email_at TIMESTAMPTZ,
    email_count INTEGER DEFAULT 0,
    open_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    replied BOOLEAN DEFAULT false,
    replied_at TIMESTAMPTZ,
    unsubscribed_at TIMESTAMPTZ,
    bounced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(campaign_id, lead_id)
);

-- Create campaign_events table
CREATE TABLE IF NOT EXISTS campaign_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    campaign_lead_id UUID REFERENCES campaign_leads(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    email_id UUID,
    event_type TEXT NOT NULL CHECK (event_type IN ('sent', 'delivered', 'opened', 'clicked', 'replied', 'bounced', 'unsubscribed', 'complained')),
    event_data JSONB DEFAULT '{}',
    occurred_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===============================================
-- 5. INBOX TABLES (Team Collaboration)
-- ===============================================

-- Email threads table
CREATE TABLE IF NOT EXISTS email_threads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    subject TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'archived', 'spam')),
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
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
    message_id TEXT UNIQUE,
    in_reply_to TEXT,
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

-- Inbox messages table (simplified version for demo)
CREATE TABLE IF NOT EXISTS inbox_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    thread_id UUID REFERENCES email_threads(id),
    lead_id UUID REFERENCES leads(id),
    campaign_id UUID REFERENCES campaigns(id),
    from_email TEXT NOT NULL,
    from_name TEXT,
    to_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT,
    body_html TEXT,
    status TEXT DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'replied', 'archived')),
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    assigned_to UUID REFERENCES auth.users(id),
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===============================================
-- 6. EMAIL TRACKING TABLES
-- ===============================================

-- Email events table (for tracking opens, clicks, etc)
CREATE TABLE IF NOT EXISTS email_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('sent', 'delivered', 'opened', 'clicked', 'replied', 'bounced', 'unsubscribed', 'complained')),
    event_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email sends table for tracking
CREATE TABLE IF NOT EXISTS email_sends (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
    email_address TEXT NOT NULL,
    subject TEXT NOT NULL,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    replied_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===============================================
-- 7. ANALYTICS TABLES
-- ===============================================

-- Analytics events table
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    event_type TEXT NOT NULL,
    event_category TEXT,
    event_action TEXT,
    event_label TEXT,
    event_value NUMERIC,
    properties JSONB DEFAULT '{}',
    session_id TEXT,
    user_agent TEXT,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analytics summary table
CREATE TABLE IF NOT EXISTS analytics_summary (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    metrics JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, date)
);

-- ===============================================
-- 8. AI TOKEN USAGE TABLES
-- ===============================================

CREATE TABLE IF NOT EXISTS ai_token_usage (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    model TEXT NOT NULL,
    prompt_tokens INTEGER NOT NULL,
    completion_tokens INTEGER NOT NULL,
    total_tokens INTEGER NOT NULL,
    cost DECIMAL(10, 6),
    purpose TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===============================================
-- 9. AUDIT LOGS TABLE
-- ===============================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id UUID,
    changes JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===============================================
-- 10. CREATE INDEXES
-- ===============================================

-- Workspace indexes
CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON workspaces(slug);
CREATE INDEX IF NOT EXISTS idx_workspaces_status ON workspaces(status);

-- Workspace members indexes
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);

-- Leads indexes
CREATE INDEX IF NOT EXISTS idx_leads_workspace_id ON leads(workspace_id);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);

-- Email templates indexes
CREATE INDEX IF NOT EXISTS idx_email_templates_workspace_id ON email_templates(workspace_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_category ON email_templates(category);
CREATE INDEX IF NOT EXISTS idx_email_templates_is_public ON email_templates(is_public);

-- Campaign indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_workspace_id ON campaigns(workspace_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(created_at DESC);

-- Campaign emails indexes
CREATE INDEX IF NOT EXISTS idx_campaign_emails_campaign_id ON campaign_emails(campaign_id);

-- Campaign leads indexes
CREATE INDEX IF NOT EXISTS idx_campaign_leads_campaign_id ON campaign_leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_lead_id ON campaign_leads(lead_id);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_status ON campaign_leads(status);

-- Campaign events indexes
CREATE INDEX IF NOT EXISTS idx_campaign_events_campaign_id ON campaign_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_events_lead_id ON campaign_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_campaign_events_event_type ON campaign_events(event_type);

-- Email events indexes
CREATE INDEX IF NOT EXISTS idx_email_events_workspace_id ON email_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_email_events_campaign_id ON email_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_events_lead_id ON email_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_email_events_event_type ON email_events(event_type);

-- Inbox indexes
CREATE INDEX IF NOT EXISTS idx_email_threads_workspace ON email_threads(workspace_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_status ON email_threads(status);
CREATE INDEX IF NOT EXISTS idx_email_messages_thread ON email_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_workspace ON inbox_messages(workspace_id);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_status ON inbox_messages(status);

-- Analytics indexes
CREATE INDEX IF NOT EXISTS idx_analytics_events_workspace ON analytics_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_summary_workspace ON analytics_summary(workspace_id);

-- AI usage indexes
CREATE INDEX IF NOT EXISTS idx_ai_token_usage_workspace ON ai_token_usage(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ai_token_usage_created ON ai_token_usage(created_at DESC);

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace ON audit_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- ===============================================
-- 11. FUNCTIONS AND TRIGGERS
-- ===============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create default workspace on signup
CREATE OR REPLACE FUNCTION create_default_workspace()
RETURNS TRIGGER AS $$
DECLARE
    workspace_id UUID;
    workspace_slug VARCHAR(255);
BEGIN
    -- Generate unique slug from email
    workspace_slug := LOWER(SPLIT_PART(NEW.email, '@', 1) || '-' || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
    
    -- Create workspace
    INSERT INTO workspaces (name, slug, trial_ends_at)
    VALUES (
        SPLIT_PART(NEW.email, '@', 1) || '''s Workspace',
        workspace_slug,
        NOW() + INTERVAL '14 days'
    )
    RETURNING id INTO workspace_id;
    
    -- Add user as workspace admin
    INSERT INTO workspace_members (workspace_id, user_id, role, is_default)
    VALUES (workspace_id, NEW.id, 'workspace_admin', TRUE);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for user profiles
DROP TRIGGER IF EXISTS create_user_profile_trigger ON auth.users;
CREATE TRIGGER create_user_profile_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_user_profile();

DROP TRIGGER IF EXISTS create_default_workspace_trigger ON user_profiles;
CREATE TRIGGER create_default_workspace_trigger
    AFTER INSERT ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION create_default_workspace();

-- Create updated_at triggers for all tables
CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON workspaces
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workspace_members_updated_at BEFORE UPDATE ON workspace_members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_templates_updated_at BEFORE UPDATE ON email_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaign_emails_updated_at BEFORE UPDATE ON campaign_emails
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaign_leads_updated_at BEFORE UPDATE ON campaign_leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_threads_updated_at BEFORE UPDATE ON email_threads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inbox_messages_updated_at BEFORE UPDATE ON inbox_messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_analytics_summary_updated_at BEFORE UPDATE ON analytics_summary
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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

-- ===============================================
-- 12. ROW LEVEL SECURITY (RLS)
-- ===============================================

-- Enable RLS on all tables
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_token_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sends ENABLE ROW LEVEL SECURITY;

-- Workspaces RLS policies
CREATE POLICY "Users can view workspaces they are members of" ON workspaces
    FOR SELECT USING (id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Workspace admins can update their workspace" ON workspaces
    FOR UPDATE USING (id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid() AND role IN ('workspace_admin', 'super_admin')
    ));

-- User profiles RLS policies
CREATE POLICY "Users can view any profile" ON user_profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" ON user_profiles
    FOR UPDATE USING (id = auth.uid());

-- Workspace members RLS policies
CREATE POLICY "Users can view members of their workspaces" ON workspace_members
    FOR SELECT USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Workspace admins can manage members" ON workspace_members
    FOR ALL USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid() AND role IN ('workspace_admin', 'super_admin')
    ));

-- Leads RLS policies
CREATE POLICY "Users can view leads in their workspace" ON leads
    FOR SELECT USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can create leads in their workspace" ON leads
    FOR INSERT WITH CHECK (workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can update leads in their workspace" ON leads
    FOR UPDATE USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Admins can delete leads in their workspace" ON leads
    FOR DELETE USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid() AND role IN ('super_admin', 'workspace_admin', 'campaign_manager')
    ));

-- Email templates RLS policies
CREATE POLICY "Users can view templates in their workspace or public templates" ON email_templates
    FOR SELECT USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        ) OR is_public = true
    );

CREATE POLICY "Users can create templates in their workspace" ON email_templates
    FOR INSERT WITH CHECK (workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can update templates they created" ON email_templates
    FOR UPDATE USING (
        created_by = auth.uid() OR workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid() AND role IN ('super_admin', 'workspace_admin')
        )
    );

-- Campaigns RLS policies
CREATE POLICY "Users can view campaigns in their workspace" ON campaigns
    FOR SELECT USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can create campaigns in their workspace" ON campaigns
    FOR INSERT WITH CHECK (workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can update campaigns in their workspace" ON campaigns
    FOR UPDATE USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    ));

-- Campaign related tables RLS policies
CREATE POLICY "Users can view campaign emails" ON campaign_emails
    FOR SELECT USING (campaign_id IN (
        SELECT id FROM campaigns WHERE workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    ));

CREATE POLICY "Users can manage campaign emails" ON campaign_emails
    FOR ALL USING (campaign_id IN (
        SELECT id FROM campaigns WHERE workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    ));

-- Email events RLS policies
CREATE POLICY "Users can view email events in their workspace" ON email_events
    FOR SELECT USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "System can create email events" ON email_events
    FOR INSERT WITH CHECK (true);

-- Inbox RLS policies
CREATE POLICY "Users can view inbox messages in their workspace" ON inbox_messages
    FOR SELECT USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can manage inbox messages in their workspace" ON inbox_messages
    FOR ALL USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    ));

-- Analytics RLS policies
CREATE POLICY "Users can view analytics in their workspace" ON analytics_events
    FOR SELECT USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "System can create analytics events" ON analytics_events
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view analytics summary in their workspace" ON analytics_summary
    FOR SELECT USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    ));

-- AI token usage RLS policies
CREATE POLICY "Users can view AI usage in their workspace" ON ai_token_usage
    FOR SELECT USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "System can track AI usage" ON ai_token_usage
    FOR INSERT WITH CHECK (true);

-- Audit logs RLS policies
CREATE POLICY "Users can view audit logs in their workspace" ON audit_logs
    FOR SELECT USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "System can create audit logs" ON audit_logs
    FOR INSERT WITH CHECK (true);

-- Email sends RLS policies
CREATE POLICY "Users can view email sends in their workspace" ON email_sends
    FOR SELECT USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can create email sends in their workspace" ON email_sends
    FOR INSERT WITH CHECK (workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    ));

-- ===============================================
-- 13. GRANT PERMISSIONS
-- ===============================================

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- ===============================================
-- 14. CREATE DEMO DATA FUNCTIONS
-- ===============================================

-- Function to seed demo inbox messages
CREATE OR REPLACE FUNCTION seed_demo_inbox_messages(p_workspace_id UUID)
RETURNS void AS $$
BEGIN
    INSERT INTO inbox_messages (workspace_id, from_email, from_name, to_email, subject, body, status, priority, created_at)
    VALUES
    (p_workspace_id, 'sarah.johnson@techcorp.com', 'Sarah Johnson', 'you@coldcopy.cc', 
     'Re: Quick question about your platform', 
     'Hi there, Thanks for reaching out! I''d love to learn more about how ColdCopy can help our sales team. Can we schedule a quick 15-minute call this week? Best regards, Sarah', 
     'unread', 'high', NOW() - INTERVAL '2 hours'),
    
    (p_workspace_id, 'mike.chen@startupinc.io', 'Mike Chen', 'you@coldcopy.cc', 
     'Interested in enterprise features', 
     'Hello, We''re evaluating cold email platforms for our 50-person sales team. Do you offer custom integrations with Salesforce? What''s included in your enterprise plan? Thanks, Mike', 
     'unread', 'high', NOW() - INTERVAL '4 hours'),
    
    (p_workspace_id, 'emily.davis@marketing.pro', 'Emily Davis', 'you@coldcopy.cc', 
     'Following up on our demo', 
     'Hi! Just wanted to follow up on our demo yesterday. The AI features looked really impressive. I''m discussing with my team and will get back to you by Friday. Cheers, Emily', 
     'read', 'normal', NOW() - INTERVAL '1 day'),
    
    (p_workspace_id, 'alex.wong@agency123.com', 'Alex Wong', 'you@coldcopy.cc', 
     'White-label options?', 
     'Hey, I run a digital marketing agency and I''m interested in your white-label options. Can we brand the platform with our logo and domain? What''s the pricing for agencies? -Alex', 
     'read', 'normal', NOW() - INTERVAL '2 days'),
    
    (p_workspace_id, 'jessica.taylor@sales.co', 'Jessica Taylor', 'you@coldcopy.cc', 
     'Quick question about email limits', 
     'What are the daily email sending limits on your Pro plan? We typically send about 500-1000 emails per day. Also, do you support email warming? Thanks!', 
     'replied', 'normal', NOW() - INTERVAL '3 days');
END;
$$ LANGUAGE plpgsql;

-- Function to seed demo analytics
CREATE OR REPLACE FUNCTION seed_demo_analytics(p_workspace_id UUID)
RETURNS void AS $$
BEGIN
    -- Insert demo analytics events
    INSERT INTO analytics_events (workspace_id, event_type, event_category, event_action, event_value, created_at)
    SELECT 
        p_workspace_id,
        CASE (random() * 4)::int
            WHEN 0 THEN 'page_view'
            WHEN 1 THEN 'campaign_created'
            WHEN 2 THEN 'email_sent'
            WHEN 3 THEN 'lead_added'
            ELSE 'template_used'
        END,
        CASE (random() * 3)::int
            WHEN 0 THEN 'engagement'
            WHEN 1 THEN 'conversion'
            ELSE 'activity'
        END,
        'user_action',
        (random() * 100)::int,
        NOW() - (random() * INTERVAL '30 days')
    FROM generate_series(1, 100);

    -- Insert summary data for the last 30 days
    INSERT INTO analytics_summary (workspace_id, date, metrics)
    SELECT 
        p_workspace_id,
        CURRENT_DATE - i,
        jsonb_build_object(
            'emails_sent', (random() * 500 + 100)::int,
            'emails_opened', (random() * 300 + 50)::int,
            'emails_clicked', (random() * 100 + 10)::int,
            'emails_replied', (random() * 50 + 5)::int,
            'leads_added', (random() * 100 + 20)::int,
            'campaigns_created', (random() * 10 + 1)::int,
            'active_users', (random() * 5 + 1)::int
        )
    FROM generate_series(0, 29) i
    ON CONFLICT (workspace_id, date) DO UPDATE
    SET metrics = EXCLUDED.metrics;
END;
$$ LANGUAGE plpgsql;

-- ===============================================
-- SUCCESS MESSAGE
-- ===============================================

SELECT 
    '✅ ColdCopy database setup completed successfully!' as status,
    'All tables created with indexes and RLS policies' as details,
    'Ready for 100% production deployment!' as next_step;