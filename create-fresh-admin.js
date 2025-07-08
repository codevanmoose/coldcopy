// Create a completely fresh admin user
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './apps/web/.env.production' });

(async () => {
  console.log('🚀 Creating fresh admin user...');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  try {
    // Create a new admin user with a fresh email
    const newAdminEmail = 'admin@coldcopy.cc';
    const newAdminPassword = 'AdminColdCopy2024!';
    
    console.log('📋 Creating new admin user:', newAdminEmail);
    
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: newAdminEmail,
      password: newAdminPassword,
      email_confirm: true
    });
    
    if (createError) {
      console.error('❌ Error creating user:', createError);
      return;
    }
    
    console.log('✅ New admin user created successfully');
    console.log('User ID:', newUser.user.id);
    
    // Wait a moment for the user to be fully created
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test authentication immediately
    console.log('📋 Testing authentication with new user...');
    
    const clientSupabase = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    
    const { data: authData, error: authError } = await clientSupabase.auth.signInWithPassword({
      email: newAdminEmail,
      password: newAdminPassword
    });
    
    if (authError) {
      console.error('❌ Authentication failed:', authError.message);
    } else {
      console.log('✅ Authentication successful with new user!');
      console.log('Session user ID:', authData.user.id);
    }
    
    // Create user profile and workspace for the new admin
    console.log('📋 Setting up workspace and profile...');
    
    // Create workspace
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .insert({
        name: 'ColdCopy Admin',
        domain: 'coldcopy.cc',
        settings: {
          theme: 'dark',
          timezone: 'UTC'
        }
      })
      .select()
      .single();
      
    if (workspaceError) {
      console.error('❌ Error creating workspace:', workspaceError);
      return;
    }
    
    console.log('✅ Workspace created:', workspace.id);
    
    // Create user profile
    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        id: newUser.user.id,
        email: newAdminEmail,
        full_name: 'ColdCopy Admin',
        metadata: {
          is_admin: true,
          setup_date: new Date().toISOString()
        }
      });
      
    if (profileError) {
      console.error('❌ Error creating profile:', profileError);
      return;
    }
    
    console.log('✅ User profile created');
    
    // Create workspace membership
    const { error: memberError } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: workspace.id,
        user_id: newUser.user.id,
        role: 'super_admin',
        is_default: true
      });
      
    if (memberError) {
      console.error('❌ Error creating workspace membership:', memberError);
      return;
    }
    
    console.log('✅ Workspace membership created');
    
    console.log('\n🎉 Fresh admin user setup complete!');
    console.log('================================');
    console.log('Email:', newAdminEmail);
    console.log('Password:', newAdminPassword);
    console.log('Role: super_admin');
    console.log('User ID:', newUser.user.id);
    console.log('Workspace ID:', workspace.id);
    console.log('================================');
    console.log('\nYou can now log in at: https://coldcopy.cc');
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
})();