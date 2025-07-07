#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './apps/web/.env.production' });

// Configuration
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'jaspervanmoose@gmail.com';

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

async function updateToAdmin() {
  console.log(`🚀 Updating ${ADMIN_EMAIL} to admin...`);
  
  try {
    // Step 1: Get user from auth.users by email
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('❌ Error fetching users:', authError);
      process.exit(1);
    }
    
    const authUser = users.find(u => u.email === ADMIN_EMAIL);
    
    if (!authUser) {
      console.error(`❌ User ${ADMIN_EMAIL} not found in auth.users`);
      process.exit(1);
    }
    
    const userId = authUser.id;
    console.log(`✅ Found user: ${userId}`);
    
    // Step 2: Check if user_profiles exists, create if not
    const { data: profile, error: profileCheckError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
      
    if (!profile) {
      console.log('📝 Creating user profile...');
      const { error: createProfileError } = await supabase
        .from('user_profiles')
        .insert({
          id: userId,
          email: ADMIN_EMAIL,
          full_name: 'Jasper Van Moose',
          metadata: { is_admin: true }
        });
        
      if (createProfileError) {
        console.error('❌ Error creating profile:', createProfileError);
        process.exit(1);
      }
      console.log('✅ User profile created');
    } else {
      // Update existing profile
      const { error: updateProfileError } = await supabase
        .from('user_profiles')
        .update({ 
          full_name: 'Jasper Van Moose',
          metadata: { is_admin: true }
        })
        .eq('id', userId);
        
      if (updateProfileError) {
        console.error('❌ Error updating profile:', updateProfileError);
        process.exit(1);
      }
      console.log('✅ User profile updated');
    }
    
    // Step 3: Check workspace membership
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
      
    if (membership) {
      // Update role to super_admin
      const { error: updateError } = await supabase
        .from('workspace_members')
        .update({ role: 'super_admin' })
        .eq('user_id', userId)
        .eq('workspace_id', membership.workspace_id);
        
      if (updateError) {
        console.error('❌ Error updating role:', updateError);
        process.exit(1);
      }
      console.log('✅ Updated to super_admin role');
      console.log('Workspace ID:', membership.workspace_id);
    } else {
      // Create workspace and membership
      console.log('📝 Creating workspace...');
      
      // First try to create with minimal fields
      const workspaceData = {
        name: 'Van Moose Projects'
      };
      
      // Check if slug column exists by trying with it
      const { data: workspace, error: wsError } = await supabase
        .from('workspaces')
        .insert(workspaceData)
        .select()
        .single();
        
      if (wsError) {
        console.error('❌ Error creating workspace:', wsError);
        process.exit(1);
      }
      
      const { error: memberError } = await supabase
        .from('workspace_members')
        .insert({
          workspace_id: workspace.id,
          user_id: userId,
          role: 'super_admin'
        });
        
      if (memberError) {
        console.error('❌ Error creating membership:', memberError);
        process.exit(1);
      }
      
      console.log('✅ Created workspace and super_admin membership');
      console.log('Workspace ID:', workspace.id);
    }
    
    console.log('\n🎉 Admin setup complete!');
    console.log('================================');
    console.log('Email:', ADMIN_EMAIL);
    console.log('Role: super_admin');
    console.log('User ID:', userId);
    console.log('================================');
    console.log('\nYou can now log in at: https://coldcopy.cc');
    console.log('Use your existing password for this account.');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

// Run the update
updateToAdmin();