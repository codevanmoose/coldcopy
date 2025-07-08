// Test Login Performance Specifically
const { chromium } = require('playwright');

(async () => {
  console.log('🚀 Testing login performance fix...');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    console.log('📋 Testing: Fast Login Flow...');
    const startTime = Date.now();
    
    // Go to login page
    await page.goto('https://coldcopy.cc/login');
    await page.waitForSelector('input[type="email"]', { timeout: 5000 });
    console.log('✅ Login page loaded');
    
    // Fill credentials
    await page.fill('input[type="email"]', 'jaspervanmoose@gmail.com');
    await page.fill('input[type="password"]', 'ColdCopyAdmin2024!');
    
    // Submit form and measure time
    const loginStartTime = Date.now();
    await page.click('button[type="submit"]');
    
    // Wait for successful redirect to dashboard
    try {
      await page.waitForURL('**/dashboard', { timeout: 8000 });
      const loginEndTime = Date.now();
      const loginDuration = loginEndTime - loginStartTime;
      
      console.log(`✅ LOGIN SUCCESS! Duration: ${loginDuration}ms`);
      
      if (loginDuration < 3000) {
        console.log('🎉 EXCELLENT: Login is very fast (<3s)');
      } else if (loginDuration < 5000) {
        console.log('👍 GOOD: Login is reasonably fast (<5s)');
      } else {
        console.log('⚠️  SLOW: Login took longer than 5 seconds');
      }
      
    } catch (timeoutError) {
      console.log('❌ LOGIN TIMEOUT: Still slower than 8 seconds');
      
      // Check if we ended up somewhere else
      const currentUrl = page.url();
      console.log(`Current URL: ${currentUrl}`);
      
      // Look for any error messages
      const hasError = await page.locator('.error, [role="alert"], .text-destructive').count() > 0;
      if (hasError) {
        const errorText = await page.locator('.error, [role="alert"], .text-destructive').first().textContent();
        console.log(`Error message: ${errorText}`);
      }
    }
    
    // Test dashboard loading after login
    if (page.url().includes('dashboard')) {
      console.log('📋 Testing: Dashboard loading after login...');
      const dashboardStartTime = Date.now();
      
      await page.waitForSelector('h1, h2, [role="main"]', { timeout: 5000 });
      
      const dashboardEndTime = Date.now();
      const dashboardDuration = dashboardEndTime - dashboardStartTime;
      
      console.log(`✅ Dashboard loaded in ${dashboardDuration}ms`);
      
      // Check for expected dashboard elements
      const hasStats = await page.locator('.grid .card, .stats').count() > 0;
      const hasNav = await page.locator('nav, sidebar, [data-testid="nav"]').count() > 0;
      
      if (hasStats && hasNav) {
        console.log('✅ Dashboard content loaded successfully');
      } else {
        console.log('⚠️  Dashboard content may not be fully loaded');
      }
    }
    
    const totalTime = Date.now() - startTime;
    console.log(`\n🎯 TOTAL LOGIN FLOW: ${totalTime}ms`);
    
    if (totalTime < 5000) {
      console.log('🎉 FIXED! Login timeout issue resolved!');
    } else {
      console.log('🔧 Still needs optimization - but improved from 15+ seconds');
    }
    
  } catch (error) {
    console.error('❌ Login test failed:', error);
  } finally {
    await browser.close();
  }
})();