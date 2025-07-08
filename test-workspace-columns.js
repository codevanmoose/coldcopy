const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/web/.env.production' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testColumns() {
  console.log('🔍 Testing workspace_members columns\n');
  
  // Get one row to see all columns
  const { data, error } = await supabase
    .from('workspace_members')
    .select('*')
    .limit(1)
    .single();
    
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Columns in workspace_members:');
    console.log(Object.keys(data));
    console.log('\nFull data:', JSON.stringify(data, null, 2));
  }
}

testColumns().catch(console.error);