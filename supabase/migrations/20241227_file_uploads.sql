-- Create uploads table for tracking file uploads
CREATE TABLE IF NOT EXISTS uploads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('avatar', 'logo', 'attachment', 'import', 'template', 'export')),
    filename TEXT NOT NULL,
    path TEXT NOT NULL,
    size BIGINT NOT NULL,
    mime_type TEXT NOT NULL,
    url TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_uploads_user_id ON uploads(user_id);
CREATE INDEX idx_uploads_workspace_id ON uploads(workspace_id);
CREATE INDEX idx_uploads_type ON uploads(type);
CREATE INDEX idx_uploads_created_at ON uploads(created_at DESC);

-- RLS policies
ALTER TABLE uploads ENABLE ROW LEVEL SECURITY;

-- Users can view their own uploads
CREATE POLICY "Users can view own uploads" ON uploads
    FOR SELECT USING (auth.uid() = user_id);

-- Users can view uploads in their workspace
CREATE POLICY "Users can view workspace uploads" ON uploads
    FOR SELECT USING (
        workspace_id IN (
            SELECT workspace_id 
            FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

-- Users can create their own uploads
CREATE POLICY "Users can create own uploads" ON uploads
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can create uploads in their workspace
CREATE POLICY "Users can create workspace uploads" ON uploads
    FOR INSERT WITH CHECK (
        workspace_id IN (
            SELECT workspace_id 
            FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

-- Users can update their own uploads
CREATE POLICY "Users can update own uploads" ON uploads
    FOR UPDATE USING (auth.uid() = user_id);

-- Workspace admins can update workspace uploads
CREATE POLICY "Workspace admins can update uploads" ON uploads
    FOR UPDATE USING (
        workspace_id IN (
            SELECT workspace_id 
            FROM workspace_members 
            WHERE user_id = auth.uid() 
            AND role IN ('workspace_admin', 'campaign_manager')
        )
    );

-- Users can delete their own uploads
CREATE POLICY "Users can delete own uploads" ON uploads
    FOR DELETE USING (auth.uid() = user_id);

-- Workspace admins can delete workspace uploads
CREATE POLICY "Workspace admins can delete uploads" ON uploads
    FOR DELETE USING (
        workspace_id IN (
            SELECT workspace_id 
            FROM workspace_members 
            WHERE user_id = auth.uid() 
            AND role IN ('workspace_admin', 'campaign_manager')
        )
    );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_uploads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_uploads_updated_at_trigger
    BEFORE UPDATE ON uploads
    FOR EACH ROW
    EXECUTE FUNCTION update_uploads_updated_at();

-- Add storage usage tracking to workspaces
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS storage_used_bytes BIGINT DEFAULT 0;

-- Function to update workspace storage usage
CREATE OR REPLACE FUNCTION update_workspace_storage_usage()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE workspaces 
        SET storage_used_bytes = storage_used_bytes + NEW.size
        WHERE id = NEW.workspace_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE workspaces 
        SET storage_used_bytes = GREATEST(0, storage_used_bytes - OLD.size)
        WHERE id = OLD.workspace_id;
    ELSIF TG_OP = 'UPDATE' AND OLD.size != NEW.size THEN
        UPDATE workspaces 
        SET storage_used_bytes = GREATEST(0, storage_used_bytes - OLD.size + NEW.size)
        WHERE id = NEW.workspace_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to track storage usage
CREATE TRIGGER update_workspace_storage_usage_trigger
    AFTER INSERT OR UPDATE OR DELETE ON uploads
    FOR EACH ROW
    WHEN (NEW.workspace_id IS NOT NULL OR OLD.workspace_id IS NOT NULL)
    EXECUTE FUNCTION update_workspace_storage_usage();