// Test creating a new user to verify auth system
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './apps/web/.env.production' });

(async () => {
  console.log('🚀 Testing user creation in Supabase Auth...');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials');
    return;
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  try {
    // Test 1: Check if admin user exists in auth.users
    console.log('📋 Checking if admin user exists in auth.users...');
    
    const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Error listing users:', listError);
      return;
    }
    
    console.log(`Found ${authUsers.users.length} users in auth.users`);
    
    const adminUser = authUsers.users.find(user => user.email === 'jaspervanmoose@gmail.com');
    
    if (adminUser) {
      console.log('✅ Admin user found in auth.users');
      console.log('User ID:', adminUser.id);
      console.log('Email confirmed:', adminUser.email_confirmed_at ? 'Yes' : 'No');
      console.log('Last sign in:', adminUser.last_sign_in_at || 'Never');
      
      // Check if user can be authenticated with the password
      console.log('📋 Testing password authentication...');
      
      // Create a client instance to test login
      const clientSupabase = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
      
      const { data: authData, error: authError } = await clientSupabase.auth.signInWithPassword({
        email: 'jaspervanmoose@gmail.com',
        password: 'ColdCopyAdmin2024!'
      });
      
      if (authError) {
        console.error('❌ Password authentication failed:', authError.message);
        
        // Try to reset the password
        console.log('🔧 Attempting to reset password...');
        
        const { error: updateError } = await supabase.auth.admin.updateUserById(adminUser.id, {
          password: 'ColdCopyAdmin2024!'
        });
        
        if (updateError) {
          console.error('❌ Password reset failed:', updateError);
        } else {
          console.log('✅ Password reset successfully');
        }
        
      } else {
        console.log('✅ Password authentication successful');
      }
      
    } else {
      console.log('❌ Admin user NOT found in auth.users');
      console.log('🔧 Creating admin user in auth.users...');
      
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: 'jaspervanmoose@gmail.com',
        password: 'ColdCopyAdmin2024!',
        email_confirm: true
      });
      
      if (createError) {
        console.error('❌ Error creating user:', createError);
      } else {
        console.log('✅ Admin user created successfully');
        console.log('New User ID:', newUser.user.id);
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
})();