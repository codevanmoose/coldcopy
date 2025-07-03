#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './apps/web/.env.production' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkTables() {
  try {
    // Use a more reliable way to check for tables
    const tables = [
      'workspaces',
      'user_profiles',
      'workspace_members',
      'campaigns',
      'leads'
    ];

    console.log('Checking for tables in the database...\n');

    for (const table of tables) {
      try {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        
        if (error) {
          console.log(`❌ ${table}: Not found or error - ${error.message}`);
        } else {
          console.log(`✅ ${table}: Exists (${count || 0} rows)`);
        }
      } catch (e) {
        console.log(`❌ ${table}: Error - ${e.message}`);
      }
    }

    // Try to get schema information differently
    console.log('\nChecking database schema...');
    const { data, error } = await supabase.rpc('get_tables_list', {});
    if (!error && data) {
      console.log('Available tables:', data);
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

checkTables();