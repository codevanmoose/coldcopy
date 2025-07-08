// Test Signup Flow to Verify Authentication
const { chromium } = require('playwright');

(async () => {
  console.log('🚀 Testing signup flow to verify auth system...');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Test 1: Load signup page
    console.log('📋 Loading signup page...');
    await page.goto('https://coldcopy.cc/signup');
    await page.waitForSelector('input[type="email"]', { timeout: 5000 });
    console.log('✅ Signup page loaded');
    
    // Test 2: Try to signup with a test user
    console.log('📋 Attempting signup...');
    const testEmail = `test-${Date.now()}@example.com`;
    const testPassword = 'TestPassword123!';
    
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', testPassword);
    
    // Fill other required fields if they exist
    const firstNameInput = page.locator('input[name="firstName"], input[name="first_name"], #firstName, #first_name');
    if (await firstNameInput.count() > 0) {
      await firstNameInput.fill('Test');
    }
    
    const lastNameInput = page.locator('input[name="lastName"], input[name="last_name"], #lastName, #last_name');
    if (await lastNameInput.count() > 0) {
      await lastNameInput.fill('User');
    }
    
    // Click signup button
    await page.click('button[type="submit"]');
    
    // Wait for response
    await page.waitForTimeout(3000);
    
    // Check current URL
    const currentUrl = page.url();
    console.log(`Current URL after signup: ${currentUrl}`);
    
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
    
    // Check for success messages
    const successElements = await page.locator('.text-green-600, .success, .text-success').all();
    if (successElements.length > 0) {
      for (const element of successElements) {
        const text = await element.textContent();
        if (text && text.trim()) {
          console.log(`✅ Success: ${text.trim()}`);
        }
      }
    }
    
    // Test results
    if (currentUrl.includes('dashboard') || currentUrl.includes('verify') || currentUrl.includes('confirm')) {
      console.log('✅ AUTHENTICATION WORKING: Signup flow successful');
      console.log('🔧 Issue is likely with the admin user credentials specifically');
      console.log('💡 Recommendation: Reset admin password or create new admin user');
    } else if (currentUrl.includes('signup')) {
      console.log('❌ AUTHENTICATION ISSUE: Still on signup page');
      console.log('🔧 Issue is likely with Supabase environment variables in production');
      console.log('💡 Recommendation: Check Vercel environment variables');
    } else {
      console.log(`⚠️  Unexpected result: ${currentUrl}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('🔧 This suggests environment configuration issues');
  } finally {
    await page.waitForTimeout(2000);
    await browser.close();
  }
})();