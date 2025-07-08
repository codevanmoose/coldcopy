const { chromium } = require('playwright');

(async () => {
  let browser;
  
  try {
    console.log('🚀 Starting Campaign Creation Test...\n');
    
    browser = await chromium.launch({ 
      headless: false, 
      slowMo: 500 
    });
    
    const context = await browser.newContext();
    const page = await context.newPage();

    // Enable console logging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('Browser error:', msg.text());
      }
    });

    // Enable request/response logging
    page.on('request', request => {
      if (request.url().includes('/api/') && request.method() === 'POST') {
        console.log(`📤 API Request: ${request.method()} ${request.url()}`);
        const postData = request.postData();
        if (postData) {
          try {
            console.log('   Request body:', JSON.stringify(JSON.parse(postData), null, 2));
          } catch (e) {
            console.log('   Request body:', postData);
          }
        }
      }
    });

    page.on('response', async response => {
      if (response.url().includes('/api/') && response.request().method() === 'POST') {
        console.log(`📥 API Response: ${response.status()} ${response.url()}`);
        if (!response.ok()) {
          try {
            const body = await response.text();
            console.log('   Error response:', body);
          } catch (e) {
            console.log('   Could not read response body');
          }
        }
      }
    });

    // 1. Navigate to login page
    console.log('1️⃣  Navigating to login page...');
    await page.goto('https://www.coldcopy.cc/login');
    await page.waitForLoadState('networkidle');

    // 2. Login
    console.log('2️⃣  Logging in as admin...');
    await page.fill('input[type="email"]', 'jaspervanmoose@gmail.com');
    await page.fill('input[type="password"]', 'ColdCopy2025!@#SecureAdmin');
    
    // Click login button
    await page.click('button[type="submit"]');
    
    // Wait for navigation to dashboard
    await page.waitForURL('**/dashboard', { timeout: 30000 });
    console.log('✅ Login successful!\n');

    // Wait for dashboard to load and check for infinite loading
    console.log('⏳ Waiting for dashboard to load...');
    
    // Try refreshing the page if stuck in loading
    await page.waitForTimeout(3000);
    
    // Check if still loading
    const isLoading = await page.isVisible('.animate-spin');
    if (isLoading) {
      console.log('   Dashboard stuck in loading state, refreshing...');
      await page.reload();
      await page.waitForTimeout(3000);
    }

    // Wait for sidebar to be visible
    await page.waitForSelector('nav a[href="/campaigns"]', { timeout: 10000 });

    // 3. Navigate to campaigns
    console.log('3️⃣  Navigating to campaigns...');
    await page.click('nav a[href="/campaigns"]');
    await page.waitForURL('**/campaigns');
    await page.waitForTimeout(1000);

    // 4. Click new campaign button
    console.log('4️⃣  Creating new campaign...');
    await page.click('a[href="/campaigns/new"]');
    await page.waitForURL('**/campaigns/new');
    await page.waitForTimeout(1000);

    // 5. Fill campaign details (Step 1)
    console.log('5️⃣  Filling campaign details...');
    await page.fill('input[id="name"]', 'Test Campaign from Script');
    await page.fill('textarea[id="description"]', 'This is a test campaign created by the automation script');
    
    // Select campaign type (sequence is default)
    console.log('   Campaign type: Email Sequence');
    
    // Click Next
    console.log('   Clicking Next...');
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(1000);

    // 6. Email content (Step 2)
    console.log('6️⃣  Setting up email sequence...');
    
    // Wait for sequence builder to load
    await page.waitForSelector('input[placeholder*="Subject"]', { timeout: 5000 });
    
    // Fill first email
    await page.fill('input[placeholder*="Subject"]', 'Test Subject Line');
    await page.fill('textarea[placeholder*="email content"]', 'Hi {{firstName}},\n\nThis is a test email from the automated script.\n\nBest regards,\nTest');
    
    // Click Next
    console.log('   Clicking Next...');
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(1000);

    // 7. Select leads (Step 3)
    console.log('7️⃣  Selecting leads...');
    
    // Check if there are any leads to select
    const leadCheckboxes = await page.$$('input[type="checkbox"]');
    if (leadCheckboxes.length > 1) { // Skip the "select all" checkbox
      console.log(`   Found ${leadCheckboxes.length - 1} leads`);
      // Select first lead
      await leadCheckboxes[1].click();
      console.log('   Selected 1 lead');
    } else {
      console.log('   No leads found to select');
    }
    
    // Click Next
    console.log('   Clicking Next...');
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(1000);

    // 8. Schedule settings (Step 4)
    console.log('8️⃣  Configuring schedule...');
    console.log('   Using default schedule settings');
    
    // Click Create Campaign
    console.log('   Clicking Create Campaign...');
    const createButton = await page.waitForSelector('button:has-text("Create Campaign")', { timeout: 5000 });
    
    // Listen for the response
    const responsePromise = page.waitForResponse(response => 
      response.url().includes('/campaigns') && response.request().method() === 'POST'
    );
    
    await createButton.click();
    
    // Wait for response
    console.log('\n⏳ Waiting for API response...');
    const response = await responsePromise;
    
    console.log(`\n📊 Campaign Creation Response:`);
    console.log(`   Status: ${response.status()}`);
    console.log(`   URL: ${response.url()}`);
    
    if (!response.ok()) {
      const responseBody = await response.text();
      console.log(`   Error: ${responseBody}`);
      console.log('\n❌ Campaign creation failed!');
    } else {
      console.log('\n✅ Campaign created successfully!');
      
      // Wait for redirect
      await page.waitForURL('**/campaigns/*', { timeout: 10000 });
      console.log('   Redirected to campaign details page');
    }

    // Take screenshot
    await page.screenshot({ path: 'campaign-creation-result.png' });
    console.log('\n📸 Screenshot saved as campaign-creation-result.png');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    // Take error screenshot
    if (browser) {
      const page = (await browser.contexts())[0]?.pages()[0];
      if (page) {
        await page.screenshot({ path: 'campaign-creation-error.png' });
        console.log('📸 Error screenshot saved as campaign-creation-error.png');
      }
    }
  } finally {
    if (browser) {
      await browser.close();
    }
    console.log('\n🏁 Test completed');
  }
})();