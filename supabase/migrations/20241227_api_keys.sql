-- Create API keys table for programmatic access
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    key_preview TEXT NOT NULL, -- First 8 characters of the key
    key_hash TEXT NOT NULL UNIQUE, -- SHA-256 hash of the full key
    scopes TEXT[] NOT NULL DEFAULT '{}', -- Array of permission scopes
    expires_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    description TEXT,
    allowed_ips TEXT[], -- Optional IP whitelist
    rate_limit_override INTEGER, -- Custom rate limit (requests per minute)
    metadata JSONB DEFAULT '{}'
);

-- Create indexes
CREATE INDEX idx_api_keys_workspace_id ON api_keys(workspace_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash) WHERE is_active = true;
CREATE INDEX idx_api_keys_expires_at ON api_keys(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_api_keys_created_by ON api_keys(created_by);

-- RLS policies
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Workspace admins can view API keys
CREATE POLICY "Workspace admins can view API keys" ON api_keys
    FOR SELECT USING (
        workspace_id IN (
            SELECT workspace_id 
            FROM workspace_members 
            WHERE user_id = auth.uid() 
            AND role IN ('workspace_admin', 'super_admin')
        )
    );

-- Workspace admins can create API keys
CREATE POLICY "Workspace admins can create API keys" ON api_keys
    FOR INSERT WITH CHECK (
        workspace_id IN (
            SELECT workspace_id 
            FROM workspace_members 
            WHERE user_id = auth.uid() 
            AND role IN ('workspace_admin', 'super_admin')
        )
        AND created_by = auth.uid()
    );

-- Workspace admins can update API keys
CREATE POLICY "Workspace admins can update API keys" ON api_keys
    FOR UPDATE USING (
        workspace_id IN (
            SELECT workspace_id 
            FROM workspace_members 
            WHERE user_id = auth.uid() 
            AND role IN ('workspace_admin', 'super_admin')
        )
    );

-- Workspace admins can delete API keys
CREATE POLICY "Workspace admins can delete API keys" ON api_keys
    FOR DELETE USING (
        workspace_id IN (
            SELECT workspace_id 
            FROM workspace_members 
            WHERE user_id = auth.uid() 
            AND role IN ('workspace_admin', 'super_admin')
        )
    );

-- Function to clean up expired API keys
CREATE OR REPLACE FUNCTION cleanup_expired_api_keys()
RETURNS void AS $$
BEGIN
    UPDATE api_keys 
    SET is_active = false
    WHERE expires_at < NOW() 
    AND is_active = true;
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to clean up expired keys (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-expired-api-keys', '0 * * * *', 'SELECT cleanup_expired_api_keys();');

-- API key usage tracking table
CREATE TABLE IF NOT EXISTS api_key_usage (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    status_code INTEGER,
    response_time_ms INTEGER,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partition by month for performance
CREATE INDEX idx_api_key_usage_created_at ON api_key_usage(created_at DESC);
CREATE INDEX idx_api_key_usage_api_key_id ON api_key_usage(api_key_id);
CREATE INDEX idx_api_key_usage_workspace_id ON api_key_usage(workspace_id);

-- RLS for usage tracking
ALTER TABLE api_key_usage ENABLE ROW LEVEL SECURITY;

-- Workspace admins can view API key usage
CREATE POLICY "Workspace admins can view API key usage" ON api_key_usage
    FOR SELECT USING (
        workspace_id IN (
            SELECT workspace_id 
            FROM workspace_members 
            WHERE user_id = auth.uid() 
            AND role IN ('workspace_admin', 'super_admin')
        )
    );

-- Function to track API key usage
CREATE OR REPLACE FUNCTION track_api_key_usage(
    p_api_key_id UUID,
    p_workspace_id UUID,
    p_endpoint TEXT,
    p_method TEXT,
    p_status_code INTEGER,
    p_response_time_ms INTEGER,
    p_ip_address INET,
    p_user_agent TEXT
)
RETURNS void AS $$
BEGIN
    -- Insert usage record
    INSERT INTO api_key_usage (
        api_key_id,
        workspace_id,
        endpoint,
        method,
        status_code,
        response_time_ms,
        ip_address,
        user_agent
    ) VALUES (
        p_api_key_id,
        p_workspace_id,
        p_endpoint,
        p_method,
        p_status_code,
        p_response_time_ms,
        p_ip_address,
        p_user_agent
    );
    
    -- Update last used timestamp
    UPDATE api_keys 
    SET last_used_at = NOW()
    WHERE id = p_api_key_id;
END;
$$ LANGUAGE plpgsql;