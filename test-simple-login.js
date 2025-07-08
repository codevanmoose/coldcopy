// Simple Login Test
const { chromium } = require('playwright');

(async () => {
  console.log('🚀 Testing simple login flow...');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Test 1: Load login page
    console.log('📋 Loading login page...');
    await page.goto('https://coldcopy.cc/login');
    await page.waitForSelector('input[type="email"]', { timeout: 5000 });
    console.log('✅ Login page loaded');
    
    // Test 2: Try to login
    console.log('📋 Attempting login...');
    await page.fill('input[type="email"]', 'jaspervanmoose@gmail.com');
    await page.fill('input[type="password"]', 'ColdCopyAdmin2024!');
    
    // Click login and wait for response
    await page.click('button[type="submit"]');
    
    // Wait a moment to see what happens
    await page.waitForTimeout(3000);
    
    // Check current URL
    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);
    
    // Check for errors
    const errorElements = await page.locator('.text-destructive, .error, [role="alert"]').all();
    if (errorElements.length > 0) {
      for (const element of errorElements) {
        const text = await element.textContent();
        if (text && text.trim()) {
          console.log(`❌ Error: ${text.trim()}`);
        }
      }
    }
    
    // Check if redirected to dashboard
    if (currentUrl.includes('dashboard')) {
      console.log('✅ SUCCESS: Redirected to dashboard!');
      
      // Check if dashboard loads
      await page.waitForSelector('h1, h2, main', { timeout: 5000 });
      console.log('✅ Dashboard content loaded');
      
      // Check for navigation
      const hasNav = await page.locator('nav, sidebar, [data-testid="nav"]').count() > 0;
      if (hasNav) {
        console.log('✅ Navigation present');
      }
      
      console.log('🎉 LOGIN FLOW WORKING PERFECTLY!');
    } else if (currentUrl.includes('login')) {
      console.log('❌ Still on login page - login failed');
      
      // Try to see if there are any console errors
      page.on('console', msg => {
        if (msg.type() === 'error') {
          console.log(`Console error: ${msg.text()}`);
        }
      });
      
    } else {
      console.log(`⚠️  Unexpected redirect to: ${currentUrl}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    // Keep browser open for a moment to see the result
    await page.waitForTimeout(2000);
    await browser.close();
  }
})();