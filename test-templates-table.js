const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zicipvpablahehxstbfr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppY2lwdnBhYmxhaGVoeHN0YmZyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTAwNjc1MSwiZXhwIjoyMDY2NTgyNzUxfQ.FuHhzGlvQaA4HXPhKvR1UZIn3UPr4EgtydupNTdJjow';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTemplatesTable() {
  console.log('🔍 Checking email_templates table...\n');

  try {
    // Try to query the email_templates table
    console.log('1. Testing email_templates table query...');
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .limit(1);

    if (error) {
      console.log('❌ Error querying email_templates table:', error.message);
      console.log('   Error code:', error.code);
      
      if (error.code === '42P01') {
        console.log('\n⚠️  The email_templates table does not exist!');
        console.log('   You need to create it in Supabase.');
      }
    } else {
      console.log('✅ Email_templates table exists!');
      console.log('   Current row count:', data?.length || 0);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkTemplatesTable();