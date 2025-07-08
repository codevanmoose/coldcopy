-- Create leads table
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  name VARCHAR(512) GENERATED ALWAYS AS (
    CASE 
      WHEN first_name IS NOT NULL AND last_name IS NOT NULL THEN first_name || ' ' || last_name
      WHEN first_name IS NOT NULL THEN first_name
      WHEN last_name IS NOT NULL THEN last_name
      ELSE NULL
    END
  ) STORED,
  company VARCHAR(255),
  title VARCHAR(255),
  phone VARCHAR(50),
  website VARCHAR(512),
  linkedin_url VARCHAR(512),
  twitter_url VARCHAR(512),
  industry VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'replied', 'qualified', 'unqualified', 'unsubscribed')),
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  custom_fields JSONB DEFAULT '{}',
  score INTEGER DEFAULT 0,
  last_contacted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, email)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_workspace_id ON public.leads(workspace_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_email ON public.leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view leads in their workspace" ON public.leads;
DROP POLICY IF EXISTS "Users can create leads in their workspace" ON public.leads;
DROP POLICY IF EXISTS "Users can update leads in their workspace" ON public.leads;
DROP POLICY IF EXISTS "Users can delete leads in their workspace" ON public.leads;

-- Create RLS policies
CREATE POLICY "Users can view leads in their workspace" ON public.leads
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create leads in their workspace" ON public.leads
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update leads in their workspace" ON public.leads
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete leads in their workspace" ON public.leads
  FOR DELETE USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Add some test data (optional)
-- INSERT INTO public.leads (workspace_id, email, first_name, last_name, company, title, status)
-- VALUES 
--   ('3936bec4-d1f7-4e7c-83d9-3b62c3fc40ad', 'john.doe@example.com', 'John', 'Doe', 'Acme Corp', 'CEO', 'new'),
--   ('3936bec4-d1f7-4e7c-83d9-3b62c3fc40ad', 'jane.smith@example.com', 'Jane', 'Smith', 'Tech Solutions', 'CTO', 'new'),
--   ('3936bec4-d1f7-4e7c-83d9-3b62c3fc40ad', 'bob.wilson@example.com', 'Bob', 'Wilson', 'Marketing Inc', 'VP Sales', 'contacted');