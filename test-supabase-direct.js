const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = 'https://zicipvpablahehxstbfr.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppY2lwdnBhYmxhaGVoeHN0YmZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwMDY3NTEsImV4cCI6MjA2NjU4Mjc1MX0.4i08GOhX0UPWjv4YdLRBXXEi2WMYiFgAica8LM9fRB8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testDirectLogin() {
  console.log('🔍 Testing Direct Supabase Login...\n');

  try {
    // Test login with the admin credentials
    console.log('1. Attempting login with jaspervanmoose@gmail.com...');
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'jaspervanmoose@gmail.com',
      password: 'okkenbollen33'
    });

    if (error) {
      console.log('❌ Login failed:', error.message);
      console.log('   Error code:', error.code);
      console.log('   Error status:', error.status);
      
      // Try to get more info about the user
      console.log('\n2. Checking if user exists...');
      const { data: userData, error: userError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('email', 'jaspervanmoose@gmail.com')
        .single();
      
      if (userError) {
        console.log('   Could not query user_profiles:', userError.message);
      } else if (userData) {
        console.log('   ✅ User profile found:', userData.id);
      }
      
    } else {
      console.log('✅ Login successful!');
      console.log('   User ID:', data.user?.id);
      console.log('   Email:', data.user?.email);
      console.log('   Session:', data.session ? 'Created' : 'Not created');
      
      // Check user's workspaces
      if (data.user) {
        console.log('\n3. Checking user workspaces...');
        const { data: workspaces, error: wsError } = await supabase
          .from('workspace_members')
          .select('workspace_id, role, workspaces(name)')
          .eq('user_id', data.user.id);
        
        if (wsError) {
          console.log('   Error fetching workspaces:', wsError.message);
        } else if (workspaces && workspaces.length > 0) {
          console.log('   ✅ Found', workspaces.length, 'workspace(s):');
          workspaces.forEach(ws => {
            console.log(`      - ${ws.workspaces?.name || ws.workspace_id} (${ws.role})`);
          });
        } else {
          console.log('   ⚠️  No workspaces found for user');
        }
      }
    }
    
    // Test with wrong password to verify
    console.log('\n4. Testing with wrong password...');
    const { error: wrongError } = await supabase.auth.signInWithPassword({
      email: 'jaspervanmoose@gmail.com',
      password: 'wrongpassword'
    });
    
    if (wrongError) {
      console.log('   ✅ Correctly rejected wrong password:', wrongError.message);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the test
testDirectLogin();