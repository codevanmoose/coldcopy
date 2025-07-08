const { chromium } = require('playwright');

(async () => {
  console.log('🧪 Testing Lead Creation - Diagnosing 405 Error\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500 
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true
  });
  
  const page = await context.newPage();
  
  // Enable detailed logging
  page.on('request', request => {
    if (request.url().includes('/leads') && request.method() === 'POST') {
      console.log(`📤 POST Request to: ${request.url()}`);
      console.log(`   Headers:`, request.headers());
      console.log(`   PostData:`, request.postData());
    }
  });
  
  page.on('response', response => {
    if (response.url().includes('/leads')) {
      console.log(`📥 Response from: ${response.url()}`);
      console.log(`   Status: ${response.status()} ${response.statusText()}`);
      console.log(`   Method: ${response.request().method()}`);
    }
  });
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`❌ Browser ERROR:`, msg.text());
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
    
    // 2. Navigate to leads page
    console.log('2. Navigating to leads page...');
    await page.goto('https://www.coldcopy.cc/leads');
    
    // Wait for page to load
    await page.waitForTimeout(2000);
    
    // 3. Try to click the Add Lead button
    console.log('3. Looking for Add Lead button...');
    
    // Try multiple selectors
    const addLeadSelectors = [
      'button:has-text("Add Lead")',
      'button:has-text("New Lead")',
      'button:has-text("Create Lead")',
      'button[aria-label*="add"]',
      'button[aria-label*="new"]',
      'button[aria-label*="create"]',
      'button:has(svg[class*="Plus"])',
      'button:has(svg[class*="plus"])'
    ];
    
    let buttonFound = false;
    for (const selector of addLeadSelectors) {
      try {
        const button = await page.locator(selector).first();
        if (await button.isVisible()) {
          console.log(`✅ Found button with selector: ${selector}`);
          await button.click();
          buttonFound = true;
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }
    
    if (!buttonFound) {
      console.log('❌ Could not find Add Lead button');
      console.log('Taking screenshot of leads page...');
      await page.screenshot({ path: 'leads-page-no-button.png' });
      
      // Try to manually test the API
      console.log('\n4. Testing API directly...');
      
      // Get workspace ID
      const workspaceData = await page.evaluate(async () => {
        const res = await fetch('/api/workspaces');
        const data = await res.json();
        return data;
      });
      
      if (workspaceData.data && workspaceData.data.length > 0) {
        const workspaceId = workspaceData.data[0].workspace_id;
        console.log(`Got workspace ID: ${workspaceId}`);
        
        // Test POST to leads endpoint
        console.log('\n5. Testing POST to leads endpoint...');
        const createLeadResult = await page.evaluate(async (wsId) => {
          try {
            const response = await fetch(`/api/workspaces/${wsId}/leads`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                email: 'test@example.com',
                first_name: 'Test',
                last_name: 'User',
                company: 'Test Company',
                status: 'new'
              })
            });
            
            const text = await response.text();
            let data;
            try {
              data = JSON.parse(text);
            } catch {
              data = text;
            }
            
            return {
              status: response.status,
              statusText: response.statusText,
              headers: Object.fromEntries(response.headers.entries()),
              data: data
            };
          } catch (err) {
            return { error: err.message };
          }
        }, workspaceId);
        
        console.log('API Response:', JSON.stringify(createLeadResult, null, 2));
      }
    } else {
      // Wait for dialog to open
      console.log('✅ Clicked Add Lead button, waiting for dialog...');
      await page.waitForTimeout(1000);
      
      // Take screenshot
      await page.screenshot({ path: 'lead-creation-dialog.png' });
      
      // Try to fill the form
      console.log('4. Filling lead form...');
      await page.fill('input[id="email"]', 'test@example.com');
      await page.fill('input[id="first_name"]', 'Test');
      await page.fill('input[id="last_name"]', 'User');
      await page.fill('input[id="company"]', 'Test Company');
      
      // Click submit
      const submitButton = await page.locator('button:has-text("Create Lead")').first();
      if (await submitButton.isVisible()) {
        console.log('5. Clicking Create Lead button...');
        await submitButton.click();
        
        // Wait for response
        await page.waitForTimeout(3000);
        
        // Take screenshot of result
        await page.screenshot({ path: 'lead-creation-result.png' });
      }
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    await page.screenshot({ path: 'lead-creation-error.png' });
  }
  
  console.log('\n✅ Test complete!');
  console.log('Check the screenshots and console output above.');
  console.log('Browser will remain open for inspection.');
  console.log('Press Ctrl+C to close.\n');
  
  // Keep browser open
  await new Promise(() => {});
})();