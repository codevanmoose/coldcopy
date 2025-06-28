-- Onboarding progress tracking

-- Table to track user onboarding progress
CREATE TABLE IF NOT EXISTS onboarding_progress (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    step_id TEXT NOT NULL,
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_onboarding_progress_workspace_id ON onboarding_progress(workspace_id);
CREATE INDEX idx_onboarding_progress_user_id ON onboarding_progress(user_id);
CREATE INDEX idx_onboarding_progress_step_id ON onboarding_progress(step_id);
CREATE INDEX idx_onboarding_progress_completed ON onboarding_progress(completed, completed_at);

-- Unique constraint to prevent duplicate progress entries
CREATE UNIQUE INDEX idx_onboarding_progress_unique ON onboarding_progress(workspace_id, user_id, step_id);

-- RLS policies
ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;

-- Users can only see their own workspace's onboarding progress
CREATE POLICY "Users can view own workspace onboarding progress" ON onboarding_progress
    FOR SELECT USING (
        workspace_id IN (
            SELECT workspace_id 
            FROM profiles 
            WHERE id = auth.uid()
        )
    );

-- Users can update their own onboarding progress
CREATE POLICY "Users can update own onboarding progress" ON onboarding_progress
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id 
            FROM profiles 
            WHERE id = auth.uid()
        )
    );

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_onboarding_progress_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update the updated_at column
CREATE TRIGGER trigger_update_onboarding_progress_updated_at
    BEFORE UPDATE ON onboarding_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_onboarding_progress_updated_at();

-- Function to get onboarding completion percentage
CREATE OR REPLACE FUNCTION get_onboarding_completion_percentage(p_workspace_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    total_required_steps INTEGER := 5; -- workspace-setup, email-configuration, import-leads, create-campaign, launch-campaign
    completed_required_steps INTEGER;
BEGIN
    -- Count completed required steps
    SELECT COUNT(*)
    INTO completed_required_steps
    FROM onboarding_progress
    WHERE workspace_id = p_workspace_id
    AND completed = true
    AND step_id IN ('workspace-setup', 'email-configuration', 'import-leads', 'create-campaign', 'launch-campaign');
    
    -- Return percentage
    RETURN ROUND((completed_required_steps::NUMERIC / total_required_steps::NUMERIC) * 100, 1);
END;
$$ LANGUAGE plpgsql;

-- Function to check if onboarding is complete
CREATE OR REPLACE FUNCTION is_onboarding_complete(p_workspace_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    required_steps TEXT[] := ARRAY['workspace-setup', 'email-configuration', 'import-leads', 'create-campaign', 'launch-campaign'];
    completed_count INTEGER;
BEGIN
    -- Count completed required steps
    SELECT COUNT(*)
    INTO completed_count
    FROM onboarding_progress
    WHERE workspace_id = p_workspace_id
    AND completed = true
    AND step_id = ANY(required_steps);
    
    -- Return true if all required steps are completed
    RETURN completed_count = array_length(required_steps, 1);
END;
$$ LANGUAGE plpgsql;

-- Function to get next onboarding step
CREATE OR REPLACE FUNCTION get_next_onboarding_step(p_workspace_id UUID)
RETURNS TABLE(
    step_id TEXT,
    step_title TEXT,
    step_description TEXT,
    estimated_time TEXT
) AS $$
DECLARE
    step_info RECORD;
BEGIN
    -- Define required steps with metadata
    FOR step_info IN 
        SELECT * FROM (VALUES
            ('workspace-setup', 'Complete Workspace Setup', 'Configure your workspace name, timezone, and preferences', '2 min'),
            ('email-configuration', 'Connect Email Account', 'Set up email sending with Gmail, Outlook, or SMTP', '5 min'),
            ('import-leads', 'Import Your First Leads', 'Upload a CSV file or connect your CRM to import prospects', '3 min'),
            ('create-campaign', 'Create Your First Campaign', 'Build a multi-step email sequence with AI assistance', '10 min'),
            ('launch-campaign', 'Launch Your First Campaign', 'Review and start your outreach campaign', '1 min')
        ) AS steps(id, title, description, time)
    LOOP
        -- Check if this step is completed
        IF NOT EXISTS (
            SELECT 1 FROM onboarding_progress 
            WHERE workspace_id = p_workspace_id 
            AND step_id = step_info.id 
            AND completed = true
        ) THEN
            -- Return this step as the next one
            step_id := step_info.id;
            step_title := step_info.title;
            step_description := step_info.description;
            estimated_time := step_info.time;
            RETURN NEXT;
            RETURN;
        END IF;
    END LOOP;
    
    -- If all steps are completed, return nothing
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically detect and mark completed steps
CREATE OR REPLACE FUNCTION auto_detect_onboarding_completion(p_workspace_id UUID)
RETURNS INTEGER AS $$
DECLARE
    steps_updated INTEGER := 0;
    workspace_has_name BOOLEAN;
    workspace_has_timezone BOOLEAN;
    has_email_account BOOLEAN;
    has_leads BOOLEAN;
    has_campaign BOOLEAN;
    has_active_campaign BOOLEAN;
BEGIN
    -- Check workspace setup
    SELECT 
        (name IS NOT NULL AND length(trim(name)) > 0),
        (timezone IS NOT NULL AND length(trim(timezone)) > 0)
    INTO workspace_has_name, workspace_has_timezone
    FROM workspaces 
    WHERE id = p_workspace_id;
    
    IF workspace_has_name AND workspace_has_timezone THEN
        INSERT INTO onboarding_progress (workspace_id, step_id, completed, completed_at)
        VALUES (p_workspace_id, 'workspace-setup', true, NOW())
        ON CONFLICT (workspace_id, user_id, step_id) 
        DO UPDATE SET completed = true, completed_at = NOW()
        WHERE onboarding_progress.completed = false;
        
        IF FOUND THEN
            steps_updated := steps_updated + 1;
        END IF;
    END IF;
    
    -- Check email configuration
    SELECT EXISTS(
        SELECT 1 FROM email_accounts 
        WHERE workspace_id = p_workspace_id AND status = 'active'
    ) INTO has_email_account;
    
    IF has_email_account THEN
        INSERT INTO onboarding_progress (workspace_id, step_id, completed, completed_at)
        VALUES (p_workspace_id, 'email-configuration', true, NOW())
        ON CONFLICT (workspace_id, user_id, step_id) 
        DO UPDATE SET completed = true, completed_at = NOW()
        WHERE onboarding_progress.completed = false;
        
        IF FOUND THEN
            steps_updated := steps_updated + 1;
        END IF;
    END IF;
    
    -- Check leads
    SELECT EXISTS(
        SELECT 1 FROM leads 
        WHERE workspace_id = p_workspace_id
    ) INTO has_leads;
    
    IF has_leads THEN
        INSERT INTO onboarding_progress (workspace_id, step_id, completed, completed_at)
        VALUES (p_workspace_id, 'import-leads', true, NOW())
        ON CONFLICT (workspace_id, user_id, step_id) 
        DO UPDATE SET completed = true, completed_at = NOW()
        WHERE onboarding_progress.completed = false;
        
        IF FOUND THEN
            steps_updated := steps_updated + 1;
        END IF;
    END IF;
    
    -- Check campaigns
    SELECT EXISTS(
        SELECT 1 FROM campaigns 
        WHERE workspace_id = p_workspace_id
    ) INTO has_campaign;
    
    IF has_campaign THEN
        INSERT INTO onboarding_progress (workspace_id, step_id, completed, completed_at)
        VALUES (p_workspace_id, 'create-campaign', true, NOW())
        ON CONFLICT (workspace_id, user_id, step_id) 
        DO UPDATE SET completed = true, completed_at = NOW()
        WHERE onboarding_progress.completed = false;
        
        IF FOUND THEN
            steps_updated := steps_updated + 1;
        END IF;
    END IF;
    
    -- Check active campaigns
    SELECT EXISTS(
        SELECT 1 FROM campaigns 
        WHERE workspace_id = p_workspace_id AND status = 'active'
    ) INTO has_active_campaign;
    
    IF has_active_campaign THEN
        INSERT INTO onboarding_progress (workspace_id, step_id, completed, completed_at)
        VALUES (p_workspace_id, 'launch-campaign', true, NOW())
        ON CONFLICT (workspace_id, user_id, step_id) 
        DO UPDATE SET completed = true, completed_at = NOW()
        WHERE onboarding_progress.completed = false;
        
        IF FOUND THEN
            steps_updated := steps_updated + 1;
        END IF;
    END IF;
    
    RETURN steps_updated;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT ALL ON onboarding_progress TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;