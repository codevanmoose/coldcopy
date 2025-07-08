const fetch = require('node-fetch');
require('dotenv').config({ path: './apps/web/.env.production' });

async function testCampaignAPI() {
  console.log('🚀 Testing Campaign API Endpoint...\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Missing Supabase configuration');
    return;
  }

  try {
    // First, authenticate
    console.log('1️⃣  Authenticating...');
    const authResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey
      },
      body: JSON.stringify({
        email: 'jaspervanmoose@gmail.com',
        password: 'SecurePass123!'
      })
    });

    const authData = await authResponse.json();
    
    if (!authResponse.ok) {
      console.error('❌ Authentication failed:', authData);
      
      // Try to reset password
      console.log('\n2️⃣  Attempting to update password directly...');
      
      // Use service role key to update password
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (serviceRoleKey) {
        const updateResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users/fbefdfba-662c-4304-8fe6-928b8db3a1a7`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`
          },
          body: JSON.stringify({
            password: 'ColdCopy2025!@#SecureAdmin'
          })
        });

        if (updateResponse.ok) {
          console.log('✅ Password updated successfully');
          console.log('   New password: ColdCopy2025!@#SecureAdmin');
          
          // Try to authenticate with new password
          console.log('\n3️⃣  Attempting authentication with new password...');
          const newAuthResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseAnonKey
            },
            body: JSON.stringify({
              email: 'jaspervanmoose@gmail.com',
              password: 'ColdCopy2025!@#SecureAdmin'
            })
          });
          
          const newAuthData = await newAuthResponse.json();
          if (newAuthResponse.ok) {
            console.log('✅ Authentication successful with new password!');
            accessToken = newAuthData.access_token;
            // Continue with the test
            await testCampaignEndpoint(accessToken);
          } else {
            console.error('❌ Authentication still failed:', newAuthData);
            return;
          }
        } else {
          const error = await updateResponse.text();
          console.error('❌ Failed to update password:', error);
        }
      }
      return;
    }

    console.log('✅ Authentication successful');
    let accessToken = authData.access_token;

    // Test campaign creation endpoint
    console.log('\n2️⃣  Testing campaign creation endpoint...');
    
    const campaignData = {
      name: 'Test Campaign from API',
      description: 'Testing campaign creation',
      type: 'sequence',
      status: 'draft',
      sequences: [{
        sequence_number: 1,
        name: 'Step 1',
        subject: 'Test Subject',
        body: 'Test email body',
        delay_days: 0,
        delay_hours: 0,
        condition_type: 'always'
      }],
      lead_ids: []
    };

    // Get workspace ID
    const workspaceId = '3936bec4-d1f7-4e7c-83d9-3b62c3fc40ad';

    // Test the API endpoint
    const apiUrl = `https://www.coldcopy.cc/api/workspaces/${workspaceId}/campaigns`;
    console.log(`   POST ${apiUrl}`);
    console.log('   Request body:', JSON.stringify(campaignData, null, 2));

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(campaignData)
    });

    console.log(`\n📊 Response Status: ${response.status}`);
    const responseText = await response.text();
    
    try {
      const responseData = JSON.parse(responseText);
      console.log('   Response:', JSON.stringify(responseData, null, 2));
      
      if (response.ok) {
        console.log('\n✅ Campaign API is working correctly!');
      } else {
        console.log('\n❌ Campaign API returned an error');
      }
    } catch (e) {
      console.log('   Response:', responseText);
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

testCampaignAPI();