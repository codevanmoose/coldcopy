// Fix admin password by deleting and recreating user
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './apps/web/.env.production' });

(async () => {
  console.log('🚀 Fixing admin user authentication...');
  
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
    const adminPassword = 'ColdCopyAdmin2024!';
    
    // Step 1: Find the existing user
    console.log('📋 Finding existing admin user...');
    
    const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Error listing users:', listError);
      return;
    }
    
    const adminUser = authUsers.users.find(user => user.email === adminEmail);
    
    if (!adminUser) {
      console.error('❌ Admin user not found');
      return;
    }
    
    console.log('✅ Found admin user:', adminUser.id);
    
    // Step 2: Delete the user from auth.users
    console.log('📋 Deleting user from auth.users...');
    
    const { error: deleteError } = await supabase.auth.admin.deleteUser(adminUser.id);
    
    if (deleteError) {
      console.error('❌ Error deleting user:', deleteError);
    } else {
      console.log('✅ User deleted from auth.users');
    }
    
    // Step 3: Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Step 4: Recreate the user with the same ID
    console.log('📋 Recreating user with same ID...');
    
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_id: adminUser.id // Use the same ID
    });
    
    if (createError) {
      console.error('❌ Error recreating user:', createError);
      
      // If same ID fails, create with new ID
      console.log('📋 Trying with new ID...');
      
      const { data: newUserNewId, error: createNewError } = await supabase.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true
      });
      
      if (createNewError) {
        console.error('❌ Error creating user with new ID:', createNewError);
        return;
      }
      
      console.log('✅ User created with new ID:', newUserNewId.user.id);
      
      // Update user_profiles and workspace_members with new ID
      const { error: updateProfileError } = await supabase
        .from('user_profiles')
        .update({ id: newUserNewId.user.id })
        .eq('id', adminUser.id);
        
      const { error: updateMemberError } = await supabase
        .from('workspace_members')
        .update({ user_id: newUserNewId.user.id })
        .eq('user_id', adminUser.id);
        
      if (updateProfileError || updateMemberError) {
        console.log('⚠️  May need to update database references manually');
      }
      
    } else {
      console.log('✅ User recreated with same ID:', newUser.user.id);
    }
    
    // Step 5: Test authentication
    console.log('📋 Testing authentication...');
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const clientSupabase = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    
    const { data: authData, error: authError } = await clientSupabase.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword
    });
    
    if (authError) {
      console.error('❌ Authentication still failed:', authError.message);
    } else {
      console.log('✅ Authentication successful!');
      console.log('User authenticated with ID:', authData.user.id);
    }
    
    console.log('\n🎉 Admin user fix complete!');
    console.log('================================');
    console.log('Email:', adminEmail);
    console.log('Password:', adminPassword);
    console.log('================================');
    
  } catch (error) {
    console.error('❌ Fix failed:', error);
  }
})();