-- ===============================================
-- CRITICAL DATABASE SETUP FOR COLDCOPY
-- Execute this in Supabase SQL Editor
-- ===============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

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
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
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
-- 5. EMAIL EVENTS TABLE
-- ===============================================

CREATE TABLE IF NOT EXISTS email_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('sent', 'delivered', 'opened', 'clicked', 'replied', 'bounced', 'unsubscribed', 'complained')),
    event_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===============================================
-- 6. CREATE INDEXES
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
CREATE INDEX IF NOT EXISTS idx_leads_workspace_status ON leads(workspace_id, status);

-- Email templates indexes
CREATE INDEX IF NOT EXISTS idx_email_templates_workspace_id ON email_templates(workspace_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_category ON email_templates(category);
CREATE INDEX IF NOT EXISTS idx_email_templates_is_public ON email_templates(is_public);
CREATE INDEX IF NOT EXISTS idx_email_templates_created_at ON email_templates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_templates_tags ON email_templates USING GIN(tags);

-- Campaign indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_workspace_id ON campaigns(workspace_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(created_at DESC);

-- Campaign emails indexes
CREATE INDEX IF NOT EXISTS idx_campaign_emails_campaign_id ON campaign_emails(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_emails_sequence ON campaign_emails(campaign_id, sequence_number);

-- Campaign leads indexes
CREATE INDEX IF NOT EXISTS idx_campaign_leads_campaign_id ON campaign_leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_lead_id ON campaign_leads(lead_id);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_status ON campaign_leads(status);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_next_email ON campaign_leads(next_email_at);

-- Campaign events indexes
CREATE INDEX IF NOT EXISTS idx_campaign_events_campaign_id ON campaign_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_events_lead_id ON campaign_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_campaign_events_type ON campaign_events(event_type);
CREATE INDEX IF NOT EXISTS idx_campaign_events_occurred ON campaign_events(occurred_at DESC);

-- Email events indexes
CREATE INDEX IF NOT EXISTS idx_email_events_workspace_id ON email_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_email_events_campaign_id ON email_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_events_lead_id ON email_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_email_events_event_type ON email_events(event_type);
CREATE INDEX IF NOT EXISTS idx_email_events_created_at ON email_events(created_at);

-- ===============================================
-- 7. FUNCTIONS AND TRIGGERS
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

-- Create updated_at triggers
CREATE TRIGGER update_workspaces_updated_at
    BEFORE UPDATE ON workspaces
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workspace_members_updated_at
    BEFORE UPDATE ON workspace_members
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at
    BEFORE UPDATE ON leads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_templates_updated_at
    BEFORE UPDATE ON email_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at
    BEFORE UPDATE ON campaigns
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaign_emails_updated_at
    BEFORE UPDATE ON campaign_emails
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaign_leads_updated_at
    BEFORE UPDATE ON campaign_leads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ===============================================
-- 8. ROW LEVEL SECURITY (RLS)
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

-- ===============================================
-- WORKSPACES RLS POLICIES
-- ===============================================

CREATE POLICY "Users can view workspaces they are members of"
    ON workspaces FOR SELECT
    USING (id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Workspace admins can update their workspace"
    ON workspaces FOR UPDATE
    USING (id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid() AND role IN ('workspace_admin', 'super_admin')
    ));

-- ===============================================
-- USER PROFILES RLS POLICIES
-- ===============================================

CREATE POLICY "Users can view any profile"
    ON user_profiles FOR SELECT
    USING (true);

CREATE POLICY "Users can update their own profile"
    ON user_profiles FOR UPDATE
    USING (id = auth.uid());

CREATE POLICY "Users can insert their own profile"
    ON user_profiles FOR INSERT
    WITH CHECK (id = auth.uid());

-- ===============================================
-- WORKSPACE MEMBERS RLS POLICIES
-- ===============================================

CREATE POLICY "Users can view members of their workspaces"
    ON workspace_members FOR SELECT
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Workspace admins can manage members"
    ON workspace_members FOR ALL
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid() AND role IN ('workspace_admin', 'super_admin')
    ));

CREATE POLICY "System can create workspace members"
    ON workspace_members FOR INSERT
    WITH CHECK (true);

-- ===============================================
-- LEADS RLS POLICIES
-- ===============================================

CREATE POLICY "Users can view leads in their workspace"
    ON leads FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id 
            FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create leads in their workspace"
    ON leads FOR INSERT
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id 
            FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update leads in their workspace"
    ON leads FOR UPDATE
    USING (
        workspace_id IN (
            SELECT workspace_id 
            FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can delete leads in their workspace"
    ON leads FOR DELETE
    USING (
        workspace_id IN (
            SELECT workspace_id 
            FROM workspace_members 
            WHERE user_id = auth.uid()
            AND role IN ('super_admin', 'workspace_admin', 'campaign_manager')
        )
    );

-- ===============================================
-- EMAIL TEMPLATES RLS POLICIES
-- ===============================================

CREATE POLICY "Users can view templates in their workspace or public templates"
    ON email_templates FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id 
            FROM workspace_members 
            WHERE user_id = auth.uid()
        )
        OR is_public = true
    );

CREATE POLICY "Users can create templates in their workspace"
    ON email_templates FOR INSERT
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id 
            FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update templates they created"
    ON email_templates FOR UPDATE
    USING (
        created_by = auth.uid()
        OR workspace_id IN (
            SELECT workspace_id 
            FROM workspace_members 
            WHERE user_id = auth.uid()
            AND role IN ('super_admin', 'workspace_admin')
        )
    );

CREATE POLICY "Admins can delete templates in their workspace"
    ON email_templates FOR DELETE
    USING (
        workspace_id IN (
            SELECT workspace_id 
            FROM workspace_members 
            WHERE user_id = auth.uid()
            AND role IN ('super_admin', 'workspace_admin')
        )
    );

-- ===============================================
-- CAMPAIGNS RLS POLICIES
-- ===============================================

CREATE POLICY "Users can view campaigns in their workspace"
    ON campaigns FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id 
            FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create campaigns in their workspace"
    ON campaigns FOR INSERT
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id 
            FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update campaigns in their workspace"
    ON campaigns FOR UPDATE
    USING (
        workspace_id IN (
            SELECT workspace_id 
            FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can delete campaigns"
    ON campaigns FOR DELETE
    USING (
        workspace_id IN (
            SELECT workspace_id 
            FROM workspace_members 
            WHERE user_id = auth.uid()
            AND role IN ('super_admin', 'workspace_admin')
        )
    );

-- ===============================================
-- CAMPAIGN RELATED TABLES RLS POLICIES
-- ===============================================

-- Campaign emails
CREATE POLICY "Users can view campaign emails"
    ON campaign_emails FOR SELECT
    USING (
        campaign_id IN (
            SELECT id FROM campaigns
            WHERE workspace_id IN (
                SELECT workspace_id 
                FROM workspace_members 
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can manage campaign emails"
    ON campaign_emails FOR ALL
    USING (
        campaign_id IN (
            SELECT id FROM campaigns
            WHERE workspace_id IN (
                SELECT workspace_id 
                FROM workspace_members 
                WHERE user_id = auth.uid()
            )
        )
    );

-- Campaign leads
CREATE POLICY "Users can view campaign leads"
    ON campaign_leads FOR SELECT
    USING (
        campaign_id IN (
            SELECT id FROM campaigns
            WHERE workspace_id IN (
                SELECT workspace_id 
                FROM workspace_members 
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can manage campaign leads"
    ON campaign_leads FOR ALL
    USING (
        campaign_id IN (
            SELECT id FROM campaigns
            WHERE workspace_id IN (
                SELECT workspace_id 
                FROM workspace_members 
                WHERE user_id = auth.uid()
            )
        )
    );

-- Campaign events
CREATE POLICY "Users can view campaign events"
    ON campaign_events FOR SELECT
    USING (
        campaign_id IN (
            SELECT id FROM campaigns
            WHERE workspace_id IN (
                SELECT workspace_id 
                FROM workspace_members 
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "System can create campaign events"
    ON campaign_events FOR INSERT
    WITH CHECK (true);

-- Email events
CREATE POLICY "Users can view email events in their workspace"
    ON email_events FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id 
            FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "System can create email events"
    ON email_events FOR INSERT
    WITH CHECK (true);

-- ===============================================
-- 9. CREATE ADMIN USER AND WORKSPACE
-- ===============================================

-- Insert admin user (this will fail if user doesn't exist in auth.users)
-- Execute this AFTER creating the admin user in Supabase Auth
DO $$
DECLARE
    admin_workspace_id UUID;
BEGIN
    -- Create admin workspace if it doesn't exist
    INSERT INTO workspaces (id, name, slug, status)
    VALUES (
        '00000000-0000-0000-0000-000000000001',
        'Admin Workspace',
        'admin',
        'active'
    ) ON CONFLICT (id) DO NOTHING;
    
    -- Check if jaspervanmoose@gmail.com exists in auth.users
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'jaspervanmoose@gmail.com') THEN
        -- Add admin user to workspace if not already added
        INSERT INTO workspace_members (workspace_id, user_id, role, is_default)
        SELECT 
            '00000000-0000-0000-0000-000000000001',
            id,
            'super_admin',
            true
        FROM auth.users 
        WHERE email = 'jaspervanmoose@gmail.com'
        ON CONFLICT (workspace_id, user_id) DO UPDATE SET 
            role = 'super_admin',
            is_default = true;
    END IF;
END;
$$;

-- ===============================================
-- 10. GRANT PERMISSIONS
-- ===============================================

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- ===============================================
-- SUCCESS MESSAGE
-- ===============================================

SELECT 
    '✅ ColdCopy database setup completed successfully!' as status,
    'Core tables created: workspaces, user_profiles, workspace_members, leads, email_templates, campaigns, campaign_emails, campaign_leads, campaign_events, email_events' as tables_created,
    'RLS policies enabled for all tables' as security,
    'Triggers created for auto-profile creation and updated_at timestamps' as automation,
    'Ready for application use!' as next_step;