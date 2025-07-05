-- Fix for missing get_user_workspaces RPC function
-- Run this in your Supabase SQL editor

-- First, ensure the user_role enum exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('super_admin', 'workspace_admin', 'campaign_manager', 'outreach_specialist');
    END IF;
END$$;

-- Create the get_user_workspaces function
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_workspaces(UUID) TO authenticated;

-- Test the function (replace with a real user_id from your database)
-- SELECT * FROM get_user_workspaces('your-user-id-here');