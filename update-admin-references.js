// Update database references for new admin user ID
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './apps/web/.env.production' });

(async () => {
  console.log('🚀 Updating admin user database references...');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  try {
    const oldUserId = 'fbefdfba-662c-4304-8fe6-928b8db3a1a7';
    const newUserId = '13d60da0-a0b8-4cf1-97c3-d40d24069bc9';
    const adminEmail = 'jaspervanmoose@gmail.com';
    
    console.log('📋 Updating user_profiles...');
    
    // Check if profile exists with old ID
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', oldUserId)
      .single();
      
    if (existingProfile) {
      // Update the profile to new user ID
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ 
          id: newUserId,
          email: adminEmail
        })
        .eq('id', oldUserId);
        
      if (updateError) {
        console.error('❌ Error updating user_profiles:', updateError);
        
        // If update fails, delete old and create new
        await supabase.from('user_profiles').delete().eq('id', oldUserId);
        
        const { error: insertError } = await supabase
          .from('user_profiles')
          .insert({
            id: newUserId,
            email: adminEmail,
            full_name: existingProfile.full_name || 'Admin User',
            metadata: existingProfile.metadata || { is_admin: true }
          });
          
        if (insertError) {
          console.error('❌ Error creating new profile:', insertError);
        } else {
          console.log('✅ Created new user profile');
        }
      } else {
        console.log('✅ Updated user_profiles');
      }
    } else {
      // Create new profile
      const { error: createError } = await supabase
        .from('user_profiles')
        .insert({
          id: newUserId,
          email: adminEmail,
          full_name: 'Admin User',
          metadata: { is_admin: true }
        });
        
      if (createError) {
        console.error('❌ Error creating profile:', createError);
      } else {
        console.log('✅ Created new user profile');
      }
    }
    
    console.log('📋 Updating workspace_members...');
    
    // Check if workspace membership exists
    const { data: existingMember } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('user_id', oldUserId)
      .single();
      
    if (existingMember) {
      // Update to new user ID
      const { error: updateMemberError } = await supabase
        .from('workspace_members')
        .update({ user_id: newUserId })
        .eq('user_id', oldUserId);
        
      if (updateMemberError) {
        console.error('❌ Error updating workspace_members:', updateMemberError);
        
        // Delete old and create new
        await supabase.from('workspace_members').delete().eq('user_id', oldUserId);
        
        const { error: insertMemberError } = await supabase
          .from('workspace_members')
          .insert({
            workspace_id: existingMember.workspace_id,
            user_id: newUserId,
            role: 'super_admin',
            is_default: true
          });
          
        if (insertMemberError) {
          console.error('❌ Error creating workspace membership:', insertMemberError);
        } else {
          console.log('✅ Created new workspace membership');
        }
      } else {
        console.log('✅ Updated workspace_members');
      }
    } else {
      console.log('⚠️  No existing workspace membership found');
    }
    
    console.log('📋 Final verification...');
    
    // Verify the setup
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', newUserId)
      .single();
      
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('user_id', newUserId)
      .single();
      
    if (profile && membership) {
      console.log('✅ Verification successful');
      console.log('Profile ID:', profile.id);
      console.log('Workspace ID:', membership.workspace_id);
      console.log('Role:', membership.role);
    } else {
      console.error('❌ Verification failed');
    }
    
    console.log('\n🎉 Database references updated!');
    console.log('Admin user should now be able to login and access dashboard');
    
  } catch (error) {
    console.error('❌ Update failed:', error);
  }
})();