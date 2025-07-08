const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/web/.env.production' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createLeadsTable() {
  console.log('🏗️  Creating leads table...\n');
  
  // Create leads table
  const { error: createError } = await supabase.rpc('exec_sql', {
    sql: `
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
      
      -- Create indexes
      CREATE INDEX idx_leads_workspace_id ON public.leads(workspace_id);
      CREATE INDEX idx_leads_status ON public.leads(status);
      CREATE INDEX idx_leads_email ON public.leads(email);
      CREATE INDEX idx_leads_created_at ON public.leads(created_at DESC);
      
      -- Enable RLS
      ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
      
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
    `
  });
  
  if (createError) {
    console.error('❌ Error creating leads table:', createError);
    
    // Try a simpler approach without RPC
    console.log('\nTrying simpler table creation...');
    
    // First, let's check if the table exists
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'leads');
      
    if (tablesError) {
      console.error('❌ Error checking tables:', tablesError);
    } else if (tables && tables.length > 0) {
      console.log('✅ Leads table already exists!');
    } else {
      console.log('❌ Leads table does not exist. Please create it manually in Supabase dashboard.');
      console.log('\nSQL to run in Supabase SQL Editor:');
      console.log(`
CREATE TABLE public.leads (
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

-- Create indexes
CREATE INDEX idx_leads_workspace_id ON public.leads(workspace_id);
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_email ON public.leads(email);
CREATE INDEX idx_leads_created_at ON public.leads(created_at DESC);

-- Enable RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

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
      `);
    }
  } else {
    console.log('✅ Leads table created successfully!');
  }
  
  // Test if we can query the table
  console.log('\nTesting leads table...');
  const { data: testData, error: testError } = await supabase
    .from('leads')
    .select('count')
    .limit(1);
    
  if (testError) {
    console.error('❌ Error testing leads table:', testError);
  } else {
    console.log('✅ Leads table is accessible!');
  }
}

createLeadsTable().catch(console.error);