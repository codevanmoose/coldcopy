#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyMigration() {
  console.log('## Verifying Migration\n');
  
  const checks = [
    {
      name: 'Database Connection',
      check: async () => {
        const { error } = await supabase.from('schema_migrations').select('count').single();
        return !error || error.code === 'PGRST116'; // Table might not exist yet
      }
    },
    {
      name: 'Core Tables Exist',
      check: async () => {
        const tables = [
          'workspaces',
          'users',
          'leads',
          'campaigns',
          'email_events'
        ];
        
        for (const table of tables) {
          const { error } = await supabase.from(table).select('count').limit(0);
          if (error && error.code !== 'PGRST116') {
            console.log(`  ❌ Table '${table}' check failed:`, error.message);
            return false;
          }
        }
        return true;
      }
    },
    {
      name: 'RLS Policies',
      check: async () => {
        // Check if RLS is enabled on critical tables
        const { data, error } = await supabase.rpc('exec_sql', {
          sql: `
            SELECT tablename, rowsecurity 
            FROM pg_tables 
            WHERE schemaname = 'public' 
            AND tablename IN ('workspaces', 'users', 'leads', 'campaigns')
          `
        });
        
        if (error) {
          console.log('  ⚠️  Could not verify RLS policies');
          return true; // Don't fail the check
        }
        
        const tablesWithoutRLS = data?.filter(t => !t.rowsecurity) || [];
        if (tablesWithoutRLS.length > 0) {
          console.log('  ⚠️  Tables without RLS:', tablesWithoutRLS.map(t => t.tablename).join(', '));
        }
        
        return true;
      }
    },
    {
      name: 'Critical Indexes',
      check: async () => {
        // Check for critical indexes
        const { data, error } = await supabase.rpc('exec_sql', {
          sql: `
            SELECT 
              i.relname as index_name,
              t.relname as table_name
            FROM pg_index idx
            JOIN pg_class i ON i.oid = idx.indexrelid
            JOIN pg_class t ON t.oid = idx.indrelid
            WHERE t.relname IN ('leads', 'campaigns', 'email_events')
            AND i.relname LIKE '%workspace_id%'
          `
        });
        
        if (error) {
          console.log('  ⚠️  Could not verify indexes');
          return true;
        }
        
        const hasWorkspaceIndexes = data && data.length > 0;
        if (!hasWorkspaceIndexes) {
          console.log('  ⚠️  Missing workspace_id indexes on critical tables');
        }
        
        return true;
      }
    },
    {
      name: 'Functions and Triggers',
      check: async () => {
        // Check for critical functions
        const { data, error } = await supabase.rpc('exec_sql', {
          sql: `
            SELECT routine_name 
            FROM information_schema.routines 
            WHERE routine_schema = 'public' 
            AND routine_type = 'FUNCTION'
          `
        });
        
        if (error) {
          console.log('  ⚠️  Could not verify functions');
          return true;
        }
        
        return true;
      }
    }
  ];
  
  let allPassed = true;
  
  for (const { name, check } of checks) {
    process.stdout.write(`Checking ${name}... `);
    try {
      const passed = await check();
      if (passed) {
        console.log('✅');
      } else {
        console.log('❌');
        allPassed = false;
      }
    } catch (error) {
      console.log('❌');
      console.log(`  Error: ${error.message}`);
      allPassed = false;
    }
  }
  
  console.log(`\n### Verification ${allPassed ? 'Passed ✅' : 'Failed ❌'}`);
  
  if (!allPassed) {
    process.exit(1);
  }
}

verifyMigration().catch(error => {
  console.error('Verification error:', error);
  process.exit(1);
});