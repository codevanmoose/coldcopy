const { chromium } = require('playwright');
const fetch = require('node-fetch');

async function testCampaignAPIWithSession() {
  let browser;
  
  try {
    console.log('🚀 Testing Campaign API with Session...\n');
    
    browser = await chromium.launch({ 
      headless: true
    });
    
    const context = await browser.newContext();
    const page = await context.newPage();

    // 1. Login to get session
    console.log('1️⃣  Logging in to get session...');
    await page.goto('https://www.coldcopy.cc/login');
    
    await page.fill('input[type="email"]', 'jaspervanmoose@gmail.com');
    await page.fill('input[type="password"]', 'ColdCopy2025!@#SecureAdmin');
    await page.click('button[type="submit"]');
    
    // Wait for navigation
    await page.waitForURL('**/dashboard', { timeout: 30000 });
    console.log('✅ Login successful!\n');

    // 2. Get cookies
    console.log('2️⃣  Extracting session cookies...');
    const cookies = await context.cookies();
    const cookieHeader = cookies
      .map(cookie => `${cookie.name}=${cookie.value}`)
      .join('; ');
    
    console.log(`   Found ${cookies.length} cookies\n`);

    // 3. First test workspace access
    console.log('3️⃣  Testing workspace access...');
    
    const workspacesResponse = await fetch('https://www.coldcopy.cc/api/workspaces', {
      headers: {
        'Cookie': cookieHeader
      }
    });
    
    console.log(`   GET /api/workspaces - Status: ${workspacesResponse.status}`);
    
    if (workspacesResponse.ok) {
      const workspacesData = await workspacesResponse.json();
      console.log('   Workspaces:', JSON.stringify(workspacesData, null, 2));
      
      if (workspacesData.data && workspacesData.data.length > 0) {
        const actualWorkspaceId = workspacesData.data[0].workspace_id;
        console.log(`\n   Using workspace ID: ${actualWorkspaceId}`);
        
        // 4. Test campaign API with correct workspace
        console.log('\n4️⃣  Testing campaign API endpoint...');
    
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

        const apiUrl = `https://www.coldcopy.cc/api/workspaces/${actualWorkspaceId}/campaigns`;
    
    console.log(`   POST ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader
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
        console.log('   Campaign ID:', responseData.data?.id);
        console.log('   Campaign Name:', responseData.data?.name);
      } else {
        console.log('\n❌ Campaign API returned an error');
        
        // If it's a 403, it might be workspace access issue
        if (response.status === 403) {
          console.log('\n4️⃣  Checking workspace access...');
          
          // Try to get workspaces list
          const workspacesResponse = await fetch('https://www.coldcopy.cc/api/workspaces', {
            headers: {
              'Cookie': cookieHeader
            }
          });
          
          if (workspacesResponse.ok) {
            const workspacesData = await workspacesResponse.json();
            console.log('   Available workspaces:', JSON.stringify(workspacesData, null, 2));
            
            // Try with the first available workspace
            if (workspacesData.data && workspacesData.data.length > 0) {
              const firstWorkspaceId = workspacesData.data[0].workspace_id;
              console.log(`\n5️⃣  Retrying with workspace ID: ${firstWorkspaceId}`);
              
              const retryUrl = `https://www.coldcopy.cc/api/workspaces/${firstWorkspaceId}/campaigns`;
              const retryResponse = await fetch(retryUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Cookie': cookieHeader
                },
                body: JSON.stringify(campaignData)
              });
              
              const retryData = await retryResponse.json();
              console.log(`   Retry Status: ${retryResponse.status}`);
              console.log('   Retry Response:', JSON.stringify(retryData, null, 2));
              
              if (retryResponse.ok) {
                console.log('\n✅ Campaign created successfully with correct workspace!');
              }
            }
          }
        }
      }
    } catch (e) {
      console.log('   Response:', responseText);
    }
      } else {
        console.log('   No workspaces found for user');
      }
    } else {
      console.log('   Failed to get workspaces:', await workspacesResponse.text());
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
    console.log('\n🏁 Test completed');
  }
}

testCampaignAPIWithSession();