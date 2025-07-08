const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zicipvpablahehxstbfr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppY2lwdnBhYmxhaGVoeHN0YmZyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTAwNjc1MSwiZXhwIjoyMDY2NTgyNzUxfQ.FuHhzGlvQaA4HXPhKvR1UZIn3UPr4EgtydupNTdJjow';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLeadsTable() {
  console.log('🔍 Checking leads table...\n');

  try {
    // Try to query the leads table
    console.log('1. Testing leads table query...');
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .limit(1);

    if (error) {
      console.log('❌ Error querying leads table:', error.message);
      console.log('   Error code:', error.code);
      
      if (error.code === '42P01') {
        console.log('\n⚠️  The leads table does not exist!');
        console.log('   You need to create it in Supabase.');
      }
    } else {
      console.log('✅ Leads table exists!');
      console.log('   Current row count:', data?.length || 0);
    }

    // Check if we can see table info
    console.log('\n2. Checking table structure...');
    const { data: tables } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .like('table_name', '%lead%');

    if (tables && tables.length > 0) {
      console.log('   Found tables:', tables.map(t => t.table_name).join(', '));
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkLeadsTable();