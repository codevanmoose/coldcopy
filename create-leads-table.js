const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://zicipvpablahehxstbfr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppY2lwdnBhYmxhaGVoeHN0YmZyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTAwNjc1MSwiZXhwIjoyMDY2NTgyNzUxfQ.FuHhzGlvQaA4HXPhKvR1UZIn3UPr4EgtydupNTdJjow';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createLeadsTable() {
  console.log('🔧 Creating leads table...\n');

  try {
    // Read SQL file
    const sql = fs.readFileSync('./sql/create-leads-table.sql', 'utf8');
    
    // Execute SQL
    console.log('Executing SQL...');
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      // Try direct execution if RPC doesn't work
      console.log('RPC failed, trying alternative method...');
      
      // Split SQL into individual statements
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);
      
      for (const statement of statements) {
        console.log(`\nExecuting: ${statement.substring(0, 50)}...`);
        
        // For CREATE TABLE, we can't use Supabase client directly
        // User needs to run this in Supabase SQL Editor
        console.log('⚠️  Please run the following SQL in Supabase SQL Editor:');
        console.log('   https://supabase.com/dashboard/project/zicipvpablahehxstbfr/sql');
        console.log('\n--- SQL TO RUN ---');
        console.log(sql);
        console.log('--- END SQL ---\n');
        break;
      }
    } else {
      console.log('✅ Leads table created successfully!');
    }
    
    // Test the table
    console.log('\nTesting leads table...');
    const { data: testData, error: testError } = await supabase
      .from('leads')
      .select('*')
      .limit(1);
    
    if (!testError) {
      console.log('✅ Leads table is working!');
    } else {
      console.log('⚠️  Table might not be ready yet:', testError.message);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

createLeadsTable();