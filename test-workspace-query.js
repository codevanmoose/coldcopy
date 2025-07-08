const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/web/.env.production' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testWorkspaceQuery() {
  console.log('🔍 Testing Workspace Query\n');
  
  const userId = 'fbefdfba-662c-4304-8fe6-928b8db3a1a7';
  
  // 1. Check workspace_members table
  console.log('1. Checking workspace_members table...');
  const { data: members, error: membersError } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('user_id', userId);
    
  if (membersError) {
    console.error('❌ Error querying workspace_members:', membersError);
  } else {
    console.log('✅ workspace_members data:', JSON.stringify(members, null, 2));
  }
  
  // 2. Check workspaces table
  console.log('\n2. Checking workspaces table...');
  const { data: workspaces, error: workspacesError } = await supabase
    .from('workspaces')
    .select('*')
    .limit(5);
    
  if (workspacesError) {
    console.error('❌ Error querying workspaces:', workspacesError);
  } else {
    console.log('✅ workspaces data:', JSON.stringify(workspaces, null, 2));
  }
  
  // 3. Test the join query from the API
  console.log('\n3. Testing the join query...');
  const { data: joinData, error: joinError } = await supabase
    .from('workspace_members')
    .select(`
      workspace_id,
      role,
      is_default,
      workspaces (
        id,
        name,
        slug
      )
    `)
    .eq('user_id', userId);
    
  if (joinError) {
    console.error('❌ Error with join query:', joinError);
  } else {
    console.log('✅ Join query data:', JSON.stringify(joinData, null, 2));
  }
  
  // 4. Check user_profiles table
  console.log('\n4. Checking user_profiles table...');
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();
    
  if (profileError) {
    console.error('❌ Error querying user_profiles:', profileError);
  } else {
    console.log('✅ user_profiles data:', JSON.stringify(profile, null, 2));
  }
}

testWorkspaceQuery().catch(console.error);