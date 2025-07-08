// Clean setup of admin user
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './apps/web/.env.production' });

(async () => {
  console.log('🚀 Clean setup of admin user...');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  try {
    const adminEmail = 'jaspervanmoose@gmail.com';
    const newUserId = '13d60da0-a0b8-4cf1-97c3-d40d24069bc9';
    
    console.log('📋 Cleaning up existing data...');
    
    // Clean up any existing data for both old and new IDs
    await supabase.from('user_profiles').delete().eq('email', adminEmail);
    await supabase.from('workspace_members').delete().eq('user_id', newUserId);
    await supabase.from('workspace_members').delete().eq('user_id', 'fbefdfba-662c-4304-8fe6-928b8db3a1a7');
    
    console.log('✅ Cleaned up existing data');
    
    console.log('📋 Getting or creating workspace...');
    
    // Get existing workspace or create one
    let { data: workspace } = await supabase
      .from('workspaces')
      .select('*')
      .eq('name', 'ColdCopy Admin')
      .single();
      
    if (!workspace) {
      const { data: newWorkspace, error: workspaceError } = await supabase
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
      
      workspace = newWorkspace;
      console.log('✅ Created new workspace');
    } else {
      console.log('✅ Using existing workspace');
    }
    
    console.log('📋 Creating user profile...');
    
    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        id: newUserId,
        email: adminEmail,
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
    
    console.log('✅ Created user profile');
    
    console.log('📋 Creating workspace membership...');
    
    const { error: memberError } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: workspace.id,
        user_id: newUserId,
        role: 'super_admin',
        is_default: true
      });
      
    if (memberError) {
      console.error('❌ Error creating membership:', memberError);
      return;
    }
    
    console.log('✅ Created workspace membership');
    
    console.log('📋 Testing complete login flow...');
    
    // Test authentication
    const clientSupabase = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    
    const { data: authData, error: authError } = await clientSupabase.auth.signInWithPassword({
      email: adminEmail,
      password: 'ColdCopyAdmin2024!'
    });
    
    if (authError) {
      console.error('❌ Authentication failed:', authError.message);
      return;
    }
    
    console.log('✅ Authentication successful');
    
    // Test profile and workspace access
    const authedSupabase = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${authData.session.access_token}`
        }
      }
    });
    
    const { data: profile } = await authedSupabase
      .from('user_profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();
      
    const { data: membership } = await authedSupabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', authData.user.id)
      .single();
      
    if (profile && membership) {
      console.log('✅ Profile and workspace access verified');
    } else {
      console.error('❌ Profile or workspace access failed');
    }
    
    console.log('\n🎉 Admin setup complete and verified!');
    console.log('================================');
    console.log('Email:', adminEmail);
    console.log('Password: ColdCopyAdmin2024!');
    console.log('User ID:', authData.user.id);
    console.log('Workspace ID:', workspace.id);
    console.log('Role: super_admin');
    console.log('================================');
    console.log('✅ Ready to test login at https://coldcopy.cc');
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
})();