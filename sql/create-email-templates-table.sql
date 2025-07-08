-- Create email_templates table
CREATE TABLE IF NOT EXISTS public.email_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
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

-- Create indexes
CREATE INDEX idx_email_templates_workspace_id ON public.email_templates(workspace_id);
CREATE INDEX idx_email_templates_category ON public.email_templates(category);
CREATE INDEX idx_email_templates_is_public ON public.email_templates(is_public);
CREATE INDEX idx_email_templates_created_at ON public.email_templates(created_at DESC);
CREATE INDEX idx_email_templates_tags ON public.email_templates USING GIN(tags);

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view templates in their workspace or public templates" ON public.email_templates
    FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id 
            FROM public.workspace_members 
            WHERE user_id = auth.uid()
        )
        OR is_public = true
    );

CREATE POLICY "Users can create templates in their workspace" ON public.email_templates
    FOR INSERT
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id 
            FROM public.workspace_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update templates they created" ON public.email_templates
    FOR UPDATE
    USING (
        created_by = auth.uid()
        OR workspace_id IN (
            SELECT workspace_id 
            FROM public.workspace_members 
            WHERE user_id = auth.uid()
            AND role IN ('super_admin', 'workspace_admin')
        )
    );

CREATE POLICY "Admins can delete templates in their workspace" ON public.email_templates
    FOR DELETE
    USING (
        workspace_id IN (
            SELECT workspace_id 
            FROM public.workspace_members 
            WHERE user_id = auth.uid()
            AND role IN ('super_admin', 'workspace_admin')
        )
    );

-- Create updated_at trigger
CREATE TRIGGER update_email_templates_updated_at
    BEFORE UPDATE ON public.email_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert some default templates
INSERT INTO public.email_templates (workspace_id, name, description, category, blocks, variables, subject, is_public, tags, created_by) 
SELECT 
    w.id as workspace_id,
    'Welcome Email' as name,
    'A friendly welcome email for new contacts' as description,
    'Welcome' as category,
    '[{"id": "1", "type": "heading", "content": "Welcome to {{company}}!", "styles": {"fontSize": "24px", "fontWeight": "bold", "textAlign": "center"}}, {"id": "2", "type": "text", "content": "Hi {{first_name}},\\n\\nWe''re excited to have you here! This is the beginning of something great.", "styles": {"fontSize": "16px"}}]'::jsonb as blocks,
    ARRAY['company', 'first_name'] as variables,
    'Welcome to {{company}}!' as subject,
    true as is_public,
    ARRAY['welcome', 'onboarding'] as tags,
    w.created_by as created_by
FROM public.workspaces w
WHERE NOT EXISTS (
    SELECT 1 FROM public.email_templates 
    WHERE workspace_id = w.id AND name = 'Welcome Email'
);

INSERT INTO public.email_templates (workspace_id, name, description, category, blocks, variables, subject, is_public, tags, created_by) 
SELECT 
    w.id as workspace_id,
    'Follow-up Email' as name,
    'Professional follow-up template' as description,
    'Follow-up' as category,
    '[{"id": "1", "type": "text", "content": "Hi {{first_name}},\\n\\nI wanted to follow up on my previous email about {{topic}}. I believe {{company}} could really benefit from our solution.", "styles": {"fontSize": "16px"}}]'::jsonb as blocks,
    ARRAY['first_name', 'topic', 'company'] as variables,
    'Following up on {{topic}}' as subject,
    true as is_public,
    ARRAY['follow-up', 'sales'] as tags,
    w.created_by as created_by
FROM public.workspaces w
WHERE NOT EXISTS (
    SELECT 1 FROM public.email_templates 
    WHERE workspace_id = w.id AND name = 'Follow-up Email'
);