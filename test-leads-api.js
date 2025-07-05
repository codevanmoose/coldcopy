const { chromium } = require('playwright');

(async () => {
  console.log('🧪 Testing ColdCopy Lead Management API\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 100 
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true
  });
  
  const page = await context.newPage();
  
  // Enable detailed logging
  page.on('response', response => {
    if (response.url().includes('/api/')) {
      console.log(`API Response: ${response.url()} - Status: ${response.status()}`);
    }
  });
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`Browser ERROR:`, msg.text());
    }
  });
  
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
    
    // 2. Get workspace ID from API
    console.log('2. Testing workspace API...');
    const workspaceData = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/workspaces');
        const data = await res.json();
        return { status: res.status, data };
      } catch (err) {
        return { error: err.message };
      }
    });
    
    console.log('Workspace API response:', workspaceData);
    
    if (workspaceData.status !== 200 || !workspaceData.data?.data?.length) {
      console.log('❌ Failed to get workspace data');
      return;
    }
    
    const workspaceId = workspaceData.data.data[0].workspace_id;
    console.log('✅ Got workspace ID:', workspaceId, '\n');
    
    // 3. Test leads API directly
    console.log('3. Testing leads API...');
    const leadsData = await page.evaluate(async (wsId) => {
      try {
        const res = await fetch(`/api/workspaces/${wsId}/leads`);
        const data = await res.json();
        return { status: res.status, data };
      } catch (err) {
        return { error: err.message };
      }
    }, workspaceId);
    
    console.log('Leads API response:', JSON.stringify(leadsData, null, 2));
    
    if (leadsData.status === 200) {
      console.log('✅ Leads API working');
      console.log(`Total leads: ${leadsData.data?.total || 0}`);
    } else {
      console.log('❌ Leads API failed');
    }
    
    // 4. Navigate to leads page
    console.log('\n4. Navigating to leads page...');
    await page.goto('https://www.coldcopy.cc/leads');
    
    // Wait for any of these elements to appear
    await Promise.race([
      page.waitForSelector('table', { timeout: 10000 }),
      page.waitForSelector('[role="table"]', { timeout: 10000 }),
      page.waitForSelector('.text-destructive', { timeout: 10000 }),
      page.waitForTimeout(10000)
    ]);
    
    // Check what loaded
    const hasTable = await page.locator('table, [role="table"]').isVisible();
    const hasError = await page.locator('.text-destructive, [role="alert"]').isVisible();
    
    console.log('Page loaded:');
    console.log('- Has table:', hasTable);
    console.log('- Has error:', hasError);
    
    if (hasError) {
      const errorText = await page.locator('.text-destructive, [role="alert"]').first().textContent();
      console.log('- Error message:', errorText);
    }
    
    // Take screenshot
    await page.screenshot({ path: 'leads-api-test.png' });
    
    // 5. Check for console errors
    console.log('\n5. Page diagnostics...');
    const pageTitle = await page.title();
    const pageUrl = page.url();
    console.log('- Title:', pageTitle);
    console.log('- URL:', pageUrl);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    await page.screenshot({ path: 'leads-api-error.png' });
  }
  
  console.log('\n✅ Test complete!');
  console.log('\nBrowser will remain open for inspection.');
  console.log('Press Ctrl+C to close.\n');
  
  // Keep browser open
  await new Promise(() => {});
})();