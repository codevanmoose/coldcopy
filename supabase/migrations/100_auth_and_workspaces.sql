-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User roles enum
CREATE TYPE user_role AS ENUM ('super_admin', 'workspace_admin', 'campaign_manager', 'outreach_specialist');

-- Workspace status enum
CREATE TYPE workspace_status AS ENUM ('active', 'suspended', 'cancelled', 'trial');

-- Create workspaces table
CREATE TABLE workspaces (
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
CREATE TABLE user_profiles (
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
CREATE TABLE workspace_members (
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

-- Create workspace invitations table
CREATE TABLE workspace_invitations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'outreach_specialist',
    token VARCHAR(255) UNIQUE NOT NULL,
    invited_by UUID NOT NULL REFERENCES auth.users(id),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create API keys table for workspace-level API access
CREATE TABLE api_keys (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    key_prefix VARCHAR(10) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    scopes JSONB DEFAULT '[]',
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

-- Create audit log table
CREATE TABLE audit_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    action VARCHAR(255) NOT NULL,
    resource_type VARCHAR(100),
    resource_id UUID,
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_workspaces_slug ON workspaces(slug);
CREATE INDEX idx_workspaces_status ON workspaces(status);
CREATE INDEX idx_workspace_members_workspace ON workspace_members(workspace_id);
CREATE INDEX idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX idx_workspace_invitations_email ON workspace_invitations(email);
CREATE INDEX idx_workspace_invitations_token ON workspace_invitations(token);
CREATE INDEX idx_api_keys_workspace ON api_keys(workspace_id);
CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX idx_audit_logs_workspace ON audit_logs(workspace_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

-- Create functions

-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_profiles (id, email)
    VALUES (NEW.id, NEW.email);
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

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER create_user_profile_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_user_profile();

CREATE TRIGGER create_default_workspace_trigger
    AFTER INSERT ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION create_default_workspace();

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

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Workspaces policies
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

-- User profiles policies
CREATE POLICY "Users can view any profile"
    ON user_profiles FOR SELECT
    USING (true);

CREATE POLICY "Users can update their own profile"
    ON user_profiles FOR UPDATE
    USING (id = auth.uid());

-- Workspace members policies
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

-- Workspace invitations policies
CREATE POLICY "Workspace admins can manage invitations"
    ON workspace_invitations FOR ALL
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid() AND role IN ('workspace_admin', 'super_admin')
    ));

CREATE POLICY "Anyone can view their invitation by token"
    ON workspace_invitations FOR SELECT
    USING (true); -- Will be filtered by token in application

-- API keys policies
CREATE POLICY "Workspace admins can manage API keys"
    ON api_keys FOR ALL
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid() AND role IN ('workspace_admin', 'super_admin')
    ));

-- Audit logs policies
CREATE POLICY "Users can view audit logs for their workspaces"
    ON audit_logs FOR SELECT
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "System can insert audit logs"
    ON audit_logs FOR INSERT
    WITH CHECK (true);

-- Helper functions for application

-- Get user's workspaces
CREATE OR REPLACE FUNCTION get_user_workspaces(user_id UUID)
RETURNS TABLE (
    workspace_id UUID,
    workspace_name VARCHAR(255),
    workspace_slug VARCHAR(255),
    role user_role,
    is_default BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        w.id,
        w.name,
        w.slug,
        wm.role,
        wm.is_default
    FROM workspaces w
    INNER JOIN workspace_members wm ON w.id = wm.workspace_id
    WHERE wm.user_id = get_user_workspaces.user_id
    AND w.status = 'active'
    ORDER BY wm.is_default DESC, w.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check user permission
CREATE OR REPLACE FUNCTION check_user_permission(
    p_user_id UUID,
    p_workspace_id UUID,
    p_permission VARCHAR(255)
) RETURNS BOOLEAN AS $$
DECLARE
    user_role user_role;
    user_permissions JSONB;
BEGIN
    -- Get user's role and permissions
    SELECT role, permissions INTO user_role, user_permissions
    FROM workspace_members
    WHERE user_id = p_user_id AND workspace_id = p_workspace_id;
    
    -- Super admin and workspace admin have all permissions
    IF user_role IN ('super_admin', 'workspace_admin') THEN
        RETURN TRUE;
    END IF;
    
    -- Check specific permission in permissions JSONB
    IF user_permissions ? p_permission THEN
        RETURN TRUE;
    END IF;
    
    -- Default role-based permissions
    CASE user_role
        WHEN 'campaign_manager' THEN
            RETURN p_permission IN ('campaigns:read', 'campaigns:write', 'leads:read', 'leads:write', 'analytics:read');
        WHEN 'outreach_specialist' THEN
            RETURN p_permission IN ('campaigns:read', 'leads:read', 'inbox:read', 'inbox:write');
        ELSE
            RETURN FALSE;
    END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;