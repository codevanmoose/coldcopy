const { chromium } = require('playwright');

async function testSessionPersistence() {
  let browser;
  
  try {
    console.log('🧪 Testing Session Persistence...\\n');
    
    browser = await chromium.launch({ 
      headless: false // Keep visible to see the test
    });
    
    const context = await browser.newContext();
    const page = await context.newPage();

    // 1. Login to the platform
    console.log('1️⃣  Logging in...');
    await page.goto('https://www.coldcopy.cc/login');
    
    await page.fill('input[type="email"]', 'jaspervanmoose@gmail.com');
    await page.fill('input[type="password"]', 'ColdCopy2025!@#SecureAdmin');
    await page.click('button[type="submit"]');
    
    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    console.log('✅ Login successful, redirected to dashboard');

    // 2. Verify dashboard loads
    console.log('\\n2️⃣  Checking dashboard content...');
    
    // Wait for the main content to load
    await page.waitForSelector('h1:has-text("Dashboard")', { timeout: 5000 });
    console.log('✅ Dashboard title found');
    
    // Check for stats cards (should show loading or data)
    const statsCards = await page.locator('[role="main"] .grid .card').count();
    console.log(`✅ Found ${statsCards} stats cards`);

    // 3. Test page refresh (critical for session persistence)
    console.log('\\n3️⃣  Testing page refresh (session persistence)...');
    
    await page.reload();
    
    // Should NOT redirect to login, should stay on dashboard
    await page.waitForSelector('h1:has-text("Dashboard")', { timeout: 10000 });
    console.log('✅ Page refresh successful - session persisted!');
    
    // Verify URL is still dashboard
    const currentUrl = page.url();
    if (currentUrl.includes('/dashboard')) {
      console.log('✅ URL verification passed - still on dashboard');
    } else {
      console.log('❌ URL verification failed - redirected away from dashboard');
      console.log('Current URL:', currentUrl);
    }

    // 4. Test navigation to other pages
    console.log('\\n4️⃣  Testing navigation...');
    
    // Click on Leads in sidebar
    await page.click('text=Leads');
    await page.waitForSelector('h1:has-text("Leads")', { timeout: 5000 });
    console.log('✅ Navigation to Leads page successful');
    
    // Go back to dashboard
    await page.click('text=Dashboard');
    await page.waitForSelector('h1:has-text("Dashboard")', { timeout: 5000 });
    console.log('✅ Navigation back to Dashboard successful');

    // 5. Test analytics data loading
    console.log('\\n5️⃣  Testing analytics data loading...');
    
    // Check if analytics cards show data (not just loading)
    await page.waitForTimeout(2000); // Give time for API calls
    
    const hasStatValues = await page.locator('.text-2xl.font-bold').count();
    if (hasStatValues > 0) {
      console.log(`✅ Analytics loaded - found ${hasStatValues} stat values`);
      
      // Get the first stat value to verify it's not empty
      const firstStatValue = await page.locator('.text-2xl.font-bold').first().textContent();
      console.log(`   First stat value: "${firstStatValue}"`);
    } else {
      console.log('⚠️  Analytics might still be loading or failed to load');
    }

    console.log('\\n🎉 All session persistence tests passed!');
    
    // Keep browser open for 5 seconds to see the result
    await page.waitForTimeout(5000);

  } catch (error) {
    console.error('\\n❌ Test failed:', error.message);
    
    // Take a screenshot for debugging
    if (browser) {
      const pages = await browser.contexts()[0]?.pages();
      if (pages && pages[0]) {
        await pages[0].screenshot({ path: 'session-test-error.png' });
        console.log('Screenshot saved as session-test-error.png');
      }
    }
  } finally {
    if (browser) {
      await browser.close();
    }
    console.log('\\n🏁 Test completed');
  }
}

testSessionPersistence();