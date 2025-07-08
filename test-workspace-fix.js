const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/web/.env.production' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testWorkspaceFix() {
  console.log('🔍 Testing Fixed Workspace Query\n');
  
  const userId = 'fbefdfba-662c-4304-8fe6-928b8db3a1a7';
  
  // Test the fixed query
  console.log('Testing the fixed join query...');
  const { data: memberships, error } = await supabase
    .from('workspace_members')
    .select(`
      workspace_id,
      role,
      workspaces (
        id,
        name,
        domain
      )
    `)
    .eq('user_id', userId);
    
  if (error) {
    console.error('❌ Error with join query:', error);
  } else {
    console.log('✅ Join query successful!');
    console.log('Raw data:', JSON.stringify(memberships, null, 2));
    
    // Transform the data like the API does
    const workspaces = memberships?.map((m) => ({
      workspace_id: m.workspace_id,
      workspace_name: m.workspaces?.name || 'Unnamed Workspace',
      workspace_slug: m.workspaces?.domain || 'default',
      role: m.role,
      is_default: false
    })) || [];
    
    console.log('\nTransformed data:', JSON.stringify(workspaces, null, 2));
  }
}

testWorkspaceFix().catch(console.error);