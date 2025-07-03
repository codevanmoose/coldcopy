#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './apps/web/.env.production' });

// Configuration
const ADMIN_EMAIL = 'jaspervanmoose@gmail.com';
const ADMIN_PASSWORD = 'okkenbollen33';

// Get Supabase credentials from environment
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in environment variables');
  process.exit(1);
}

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function setupAdmin() {
  console.log('🚀 Setting up admin user...');
  
  try {
    // Step 1: Check if user exists
    const { data: existingUser, error: checkError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('email', ADMIN_EMAIL)
      .maybeSingle();

    if (checkError) {
      console.error('❌ Error checking existing user:', checkError);
      process.exit(1);
    }

    let userId;
    let workspaceId;

    if (existingUser) {
      console.log('✅ User already exists');
      userId = existingUser.id;
      
      // Get their workspace membership
      const { data: membershipData } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', userId)
        .single();
        
      if (membershipData) {
        workspaceId = membershipData.workspace_id;
      }
    } else {
      console.log('📝 Creating new user...');
      
      // Create user via auth
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        email_confirm: true
      });

      if (authError) {
        console.error('❌ Error creating auth user:', authError);
        process.exit(1);
      }

      userId = authData.user.id;
      console.log('✅ Auth user created');

      // The user_profile and workspace should be created automatically by triggers
      // Let's wait a moment for triggers to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get the created workspace
      const { data: workspaceData } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', userId)
        .single();

      if (workspaceData) {
        workspaceId = workspaceData.workspace_id;
      }
    }

    // Step 2: Update user to super_admin role
    if (workspaceId) {
      const { error: updateError } = await supabase
        .from('workspace_members')
        .update({ role: 'super_admin' })
        .eq('user_id', userId)
        .eq('workspace_id', workspaceId);

      if (updateError) {
        console.error('❌ Error updating user role:', updateError);
        process.exit(1);
      }

      console.log('✅ User role updated to super_admin');
    }

    // Step 3: Update user profile metadata
    const { error: profileError } = await supabase
      .from('user_profiles')
      .update({ 
        full_name: 'Jasper Van Moose',
        metadata: { 
          is_admin: true,
          setup_date: new Date().toISOString()
        }
      })
      .eq('id', userId);

    if (profileError) {
      console.error('❌ Error updating user profile:', profileError);
      process.exit(1);
    }

    console.log('✅ User profile updated');

    // Step 4: Display results
    console.log('\n🎉 Admin setup complete!');
    console.log('================================');
    console.log('Email:', ADMIN_EMAIL);
    console.log('Password:', ADMIN_PASSWORD);
    console.log('Role: super_admin');
    console.log('User ID:', userId);
    console.log('Workspace ID:', workspaceId);
    console.log('================================');
    console.log('\nYou can now log in at: https://coldcopy.cc');
    console.log('Admin panel will be available at: https://coldcopy.cc/admin');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

// Run the setup
setupAdmin();