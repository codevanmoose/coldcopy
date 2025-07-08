// Test login specifically with detailed debugging
const { chromium } = require('playwright');

(async () => {
  console.log('🔍 Testing login flow with detailed debugging...');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Listen to console logs
  page.on('console', msg => {
    console.log(`[Browser Console ${msg.type()}]:`, msg.text());
  });
  
  // Listen to network failures
  page.on('requestfailed', request => {
    console.log(`[Network Failed]:`, request.url(), request.failure().errorText);
  });
  
  try {
    console.log('📋 Step 1: Loading login page...');
    await page.goto('https://coldcopy.cc/login');
    await page.waitForSelector('input[type="email"]', { timeout: 5000 });
    console.log('✅ Login page loaded successfully');
    
    console.log('📋 Step 2: Filling login form...');
    await page.fill('input[type="email"]', 'jaspervanmoose@gmail.com');
    await page.fill('input[type="password"]', 'ColdCopyAdmin2024!');
    console.log('✅ Credentials entered');
    
    console.log('📋 Step 3: Submitting login form...');
    const startTime = Date.now();
    
    // Click submit and monitor what happens
    await page.click('button[type="submit"]');
    console.log('✅ Submit button clicked');
    
    // Wait a moment to see immediate response
    await page.waitForTimeout(2000);
    
    // Check for any error messages
    const errorElements = await page.locator('.text-destructive, .error, [role="alert"]').all();
    if (errorElements.length > 0) {
      console.log('❌ Error messages found:');
      for (const element of errorElements) {
        const text = await element.textContent();
        if (text && text.trim()) {
          console.log(`   Error: ${text.trim()}`);
        }
      }
    } else {
      console.log('✅ No error messages visible');
    }
    
    // Check loading state
    const loadingElements = await page.locator('.animate-spin, .loading, :has-text("Signing in")').all();
    if (loadingElements.length > 0) {
      console.log('🔄 Login form is in loading state');
    }
    
    // Wait longer to see if redirect happens
    console.log('📋 Step 4: Waiting for redirect or completion...');
    
    try {
      // Try to wait for dashboard
      await page.waitForURL('**/dashboard', { timeout: 8000 });
      const endTime = Date.now();
      console.log(`✅ LOGIN SUCCESS! Time taken: ${endTime - startTime}ms`);
      
      // Check if dashboard loaded properly
      await page.waitForSelector('h1', { timeout: 3000 });
      console.log('✅ Dashboard content loaded');
      
    } catch (timeoutError) {
      const endTime = Date.now();
      console.log(`❌ LOGIN TIMEOUT after ${endTime - startTime}ms`);
      
      // Check current URL
      const currentUrl = page.url();
      console.log(`Current URL: ${currentUrl}`);
      
      // Check page content to understand what happened
      const pageTitle = await page.title();
      console.log(`Page title: ${pageTitle}`);
      
      // Look for any visible content that might indicate the issue
      const mainContent = await page.locator('main, body').first().textContent();
      console.log(`Page content preview: ${mainContent.substring(0, 200)}...`);
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  } finally {
    await page.waitForTimeout(2000);
    await browser.close();
  }
})();