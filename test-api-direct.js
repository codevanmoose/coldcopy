const { chromium } = require('playwright');

(async () => {
  console.log('🧪 Testing API Endpoints Directly\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 100 
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true
  });
  
  const page = await context.newPage();
  
  try {
    // 1. Login
    console.log('1. Logging in...');
    await page.goto('https://www.coldcopy.cc/login');
    await page.fill('input[type="email"]', 'jaspervanmoose@gmail.com');
    await page.fill('input[type="password"]', 'okkenbollen33');
    await page.click('button:has-text("Sign in")');
    
    // Wait for navigation
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    console.log('✅ Login successful\n');
    
    // 2. Test workspace API
    console.log('2. Testing /api/workspaces...');
    const workspaceResponse = await page.evaluate(async () => {
      const res = await fetch('/api/workspaces');
      const data = await res.json();
      return { status: res.status, data };
    });
    
    console.log('Workspace API Response:');
    console.log('Status:', workspaceResponse.status);
    console.log('Data:', JSON.stringify(workspaceResponse.data, null, 2));
    
    if (!workspaceResponse.data?.data?.[0]) {
      console.log('❌ No workspace found');
      return;
    }
    
    const workspaceId = workspaceResponse.data.data[0].workspace_id;
    console.log('\n✅ Got workspace ID:', workspaceId);
    
    // 3. Test GET leads
    console.log('\n3. Testing GET /api/workspaces/{id}/leads...');
    const getLeadsResponse = await page.evaluate(async (wsId) => {
      const res = await fetch(`/api/workspaces/${wsId}/leads`);
      const data = await res.json();
      return { status: res.status, data };
    }, workspaceId);
    
    console.log('GET Leads Response:');
    console.log('Status:', getLeadsResponse.status);
    console.log('Data:', JSON.stringify(getLeadsResponse.data, null, 2));
    
    // 4. Test POST leads
    console.log('\n4. Testing POST /api/workspaces/{id}/leads...');
    const testLead = {
      email: `test${Date.now()}@example.com`,
      first_name: 'Test',
      last_name: 'User',
      company: 'Test Company',
      title: 'Test Title',
      status: 'new'
    };
    
    console.log('Sending:', JSON.stringify(testLead, null, 2));
    
    const postLeadsResponse = await page.evaluate(async (wsId, lead) => {
      const res = await fetch(`/api/workspaces/${wsId}/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(lead)
      });
      
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
      
      return { 
        status: res.status, 
        statusText: res.statusText,
        data 
      };
    }, workspaceId, testLead);
    
    console.log('\nPOST Leads Response:');
    console.log('Status:', postLeadsResponse.status, postLeadsResponse.statusText);
    console.log('Data:', JSON.stringify(postLeadsResponse.data, null, 2));
    
    if (postLeadsResponse.status === 201) {
      console.log('\n✅ Lead created successfully!');
    } else {
      console.log('\n❌ Failed to create lead');
    }
    
    // 5. Test OPTIONS (CORS preflight)
    console.log('\n5. Testing OPTIONS /api/workspaces/{id}/leads...');
    const optionsResponse = await page.evaluate(async (wsId) => {
      const res = await fetch(`/api/workspaces/${wsId}/leads`, {
        method: 'OPTIONS',
      });
      
      return { 
        status: res.status,
        headers: Object.fromEntries(res.headers.entries())
      };
    }, workspaceId);
    
    console.log('OPTIONS Response:');
    console.log('Status:', optionsResponse.status);
    console.log('Headers:', JSON.stringify(optionsResponse.headers, null, 2));
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
  
  console.log('\n✅ Test complete!');
  console.log('Browser will remain open for inspection.');
  console.log('Press Ctrl+C to close.\n');
  
  // Keep browser open
  await new Promise(() => {});
})();