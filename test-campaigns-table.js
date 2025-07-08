require('dotenv').config({ path: './apps/web/.env.production' });
const { createClient } = require('@supabase/supabase-js');

async function testCampaignsTable() {
  console.log('🚀 Testing Campaigns Table...\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase configuration');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1. Check if campaigns table exists
    console.log('1️⃣  Checking campaigns table...');
    const { data: tables, error: tablesError } = await supabase
      .from('campaigns')
      .select('*')
      .limit(1);

    if (tablesError) {
      console.error('❌ Campaigns table error:', tablesError);
      
      // Try to create the table
      console.log('\n2️⃣  Creating campaigns table...');
      
      const { error: createError } = await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS campaigns (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            type VARCHAR(50) DEFAULT 'sequence',
            status VARCHAR(50) DEFAULT 'draft',
            created_by UUID NOT NULL REFERENCES auth.users(id),
            settings JSONB DEFAULT '{}',
            sequence_steps JSONB DEFAULT '[]',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          
          -- Create indexes
          CREATE INDEX IF NOT EXISTS idx_campaigns_workspace_id ON campaigns(workspace_id);
          CREATE INDEX IF NOT EXISTS idx_campaigns_created_by ON campaigns(created_by);
          CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
        `
      });

      if (createError) {
        console.error('❌ Failed to create table:', createError);
        
        // Try direct SQL
        console.log('\n3️⃣  Attempting direct table creation...');
        const { data, error } = await supabase.from('information_schema.tables')
          .select('table_name')
          .eq('table_schema', 'public')
          .eq('table_name', 'campaigns')
          .single();
          
        if (error) {
          console.log('   Table does not exist');
          console.log('\n   ⚠️  Please create the campaigns table in Supabase dashboard:');
          console.log(`
CREATE TABLE campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) DEFAULT 'sequence',
  status VARCHAR(50) DEFAULT 'draft',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  settings JSONB DEFAULT '{}',
  sequence_steps JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
          `);
        }
      } else {
        console.log('✅ Campaigns table created successfully');
      }
    } else {
      console.log('✅ Campaigns table exists');
      
      // 2. Test creating a campaign
      console.log('\n2️⃣  Testing campaign creation...');
      
      const testCampaign = {
        workspace_id: '3936bec4-d1f7-4e7c-83d9-3b62c3fc40ad',
        name: 'Test Campaign Direct',
        description: 'Testing direct database creation',
        type: 'sequence',
        status: 'draft',
        created_by: 'fbefdfba-662c-4304-8fe6-928b8db3a1a7',
        settings: {
          timezone: 'America/New_York',
          daily_limit: 50
        },
        sequence_steps: [{
          sequence_number: 1,
          name: 'Step 1',
          subject: 'Test Subject',
          body: 'Test email body',
          delay_days: 0,
          delay_hours: 0,
          condition_type: 'always'
        }]
      };

      const { data: campaign, error: createError } = await supabase
        .from('campaigns')
        .insert(testCampaign)
        .select()
        .single();

      if (createError) {
        console.error('❌ Failed to create campaign:', createError);
      } else {
        console.log('✅ Campaign created successfully');
        console.log('   Campaign ID:', campaign.id);
        console.log('   Campaign Name:', campaign.name);
        
        // Clean up
        console.log('\n3️⃣  Cleaning up test campaign...');
        const { error: deleteError } = await supabase
          .from('campaigns')
          .delete()
          .eq('id', campaign.id);
          
        if (!deleteError) {
          console.log('✅ Test campaign deleted');
        }
      }
    }

    // 4. Check related tables
    console.log('\n4️⃣  Checking related tables...');
    
    // Check campaign_leads
    const { error: leadsTableError } = await supabase
      .from('campaign_leads')
      .select('*')
      .limit(1);
      
    if (leadsTableError) {
      console.log('❌ campaign_leads table missing');
      console.log('   Create with:');
      console.log(`
CREATE TABLE campaign_leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
      `);
    } else {
      console.log('✅ campaign_leads table exists');
    }

    // Check campaign_emails
    const { error: emailsTableError } = await supabase
      .from('campaign_emails')
      .select('*')
      .limit(1);
      
    if (emailsTableError) {
      console.log('❌ campaign_emails table missing');
    } else {
      console.log('✅ campaign_emails table exists');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

testCampaignsTable();