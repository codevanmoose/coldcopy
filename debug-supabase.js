#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './apps/web/.env.production' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Supabase URL:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  db: {
    schema: 'public'
  }
});

async function debug() {
  // Try a simple insert to see what happens
  console.log('\nTrying to create a user via auth...');
  
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: 'jaspervanmoose@gmail.com',
    password: 'okkenbollen33',
    email_confirm: true
  });

  if (authError) {
    console.error('Auth error:', authError);
  } else {
    console.log('✅ User created successfully!');
    console.log('User ID:', authData.user.id);
    
    // Wait for triggers
    console.log('\nWaiting for database triggers to complete...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check if user profile was created
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();
      
    if (profileError) {
      console.error('Profile check error:', profileError);
    } else {
      console.log('✅ User profile found:', profile);
    }
    
    // Check workspace membership
    const { data: membership, error: membershipError } = await supabase
      .from('workspace_members')
      .select('*, workspaces(*)')
      .eq('user_id', authData.user.id)
      .single();
      
    if (membershipError) {
      console.error('Membership check error:', membershipError);
    } else {
      console.log('✅ Workspace membership found:', membership);
      
      // Update to super_admin
      const { error: updateError } = await supabase
        .from('workspace_members')
        .update({ role: 'super_admin' })
        .eq('user_id', authData.user.id)
        .eq('workspace_id', membership.workspace_id);
        
      if (updateError) {
        console.error('Role update error:', updateError);
      } else {
        console.log('✅ Updated role to super_admin!');
      }
    }
  }
}

debug();