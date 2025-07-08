#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://zicipvpablahehxstbfr.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppY2lwdnBhYmxhaGVoeHN0YmZyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTAwNjc1MSwiZXhwIjoyMDY2NTgyNzUxfQ.FuHhzGlvQaA4HXPhKvR1UZIn3UPr4EgtydupNTdJjow';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createMissingTables() {
  console.log('🚀 Creating missing database tables...');

  try {
    // Create leads table
    console.log('📝 Creating leads table...');
    const { error: leadsError } = await supabase.from('leads').select('*').limit(1);
    if (leadsError && leadsError.code === 'PGRST116') {
      // Table doesn't exist, we'll have to guide the user to create it manually
      console.log('❌ Cannot create tables via API. Need manual setup.');
      console.log('');
      console.log('📋 MANUAL SETUP REQUIRED:');
      console.log('1. Go to https://app.supabase.com/project/zicipvpablahehxstbfr');
      console.log('2. Navigate to SQL Editor');
      console.log('3. Create a new query');
      console.log('4. Copy and paste the contents of create-missing-tables.sql');
      console.log('5. Run the query');
      console.log('');
      console.log('Alternatively, use Supabase CLI:');
      console.log('npx supabase login');
      console.log('npx supabase link --project-ref zicipvpablahehxstbfr');
      console.log('npx supabase db reset');
      return;
    } else {
      console.log('✅ Leads table already exists');
    }

    // Check other tables
    const tables = ['campaigns', 'email_templates', 'email_sends'];
    for (const table of tables) {
      try {
        const { error } = await supabase.from(table).select('*').limit(1);
        if (error && error.code === 'PGRST116') {
          console.log(`❌ ${table} table missing`);
        } else {
          console.log(`✅ ${table} table exists`);
        }
      } catch (e) {
        console.log(`❌ ${table} table missing`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the function
createMissingTables();