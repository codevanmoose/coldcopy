#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './apps/web/.env.production' });

// Get Supabase credentials from environment
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Testing Supabase connection...');
console.log('URL:', supabaseUrl);
console.log('Service Key:', supabaseServiceKey ? 'Present' : 'Missing');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testConnection() {
  try {
    // Test 1: Check if we can query the auth.users table
    console.log('\n1. Testing auth.users table...');
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) {
      console.error('❌ Error accessing auth.users:', usersError);
    } else {
      console.log('✅ Successfully connected to auth system');
      console.log(`   Found ${users.users.length} users`);
    }

    // Test 2: Check available tables
    console.log('\n2. Checking available tables...');
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .limit(10);
    
    if (tablesError) {
      console.error('❌ Error listing tables:', tablesError);
    } else {
      console.log('✅ Found tables:', tables.map(t => t.table_name).join(', '));
    }

    // Test 3: Check if workspaces table exists
    console.log('\n3. Testing workspaces table...');
    const { count, error: workspaceError } = await supabase
      .from('workspaces')
      .select('*', { count: 'exact', head: true });
    
    if (workspaceError) {
      console.error('❌ Error accessing workspaces:', workspaceError);
    } else {
      console.log('✅ Workspaces table exists');
      console.log(`   Total workspaces: ${count}`);
    }

    // Test 4: Check if user_profiles table exists
    console.log('\n4. Testing user_profiles table...');
    const { count: profileCount, error: profileError } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true });
    
    if (profileError) {
      console.error('❌ Error accessing user_profiles:', profileError);
    } else {
      console.log('✅ User profiles table exists');
      console.log(`   Total profiles: ${profileCount}`);
    }

  } catch (error) {
    console.error('\n❌ Unexpected error:', error);
  }
}

testConnection();