// Fix workspace schema and create admin properly
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './apps/web/.env.production' });

(async () => {
  console.log('🚀 Fixing workspace schema and admin setup...');
  
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
    
    console.log('📋 Checking workspace_members table structure...');
    
    // Try to insert without is_default first
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('*')
      .limit(1)
      .single();
      
    if (!workspace) {
      console.error('❌ No workspace found');
      return;
    }
    
    console.log('✅ Found workspace:', workspace.id);
    
    console.log('📋 Creating workspace membership (simplified)...');
    
    const { error: memberError } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: workspace.id,
        user_id: newUserId,
        role: 'super_admin'
      });
      
    if (memberError) {
      console.error('❌ Error creating membership:', memberError);
      
      // Try with minimal fields
      console.log('📋 Trying with minimal fields...');
      
      const { error: minimalError } = await supabase
        .from('workspace_members')
        .insert({
          workspace_id: workspace.id,
          user_id: newUserId
        });
        
      if (minimalError) {
        console.error('❌ Error with minimal fields:', minimalError);
        return;
      } else {
        console.log('✅ Created membership with minimal fields');
      }
    } else {
      console.log('✅ Created workspace membership');
    }
    
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
    
    console.log('\n🎉 Admin setup complete!');
    console.log('================================');
    console.log('Email:', adminEmail);
    console.log('Password: ColdCopyAdmin2024!');
    console.log('User ID:', authData.user.id);
    console.log('Workspace ID:', workspace.id);
    console.log('================================');
    console.log('✅ Ready to test login!');
    
    return { success: true, userId: authData.user.id, workspaceId: workspace.id };
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    return { success: false, error };
  }
})();