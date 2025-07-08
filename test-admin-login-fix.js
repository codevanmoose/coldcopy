const { chromium } = require('playwright');

async function testAdminLogin() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('🔍 Testing Admin Login...\n');

  try {
    // Navigate to login page
    console.log('1. Navigating to login page...');
    await page.goto('https://www.coldcopy.cc/login');
    await page.waitForLoadState('networkidle');

    // Check if we're on login page
    const loginForm = await page.locator('form').count();
    if (loginForm > 0) {
      console.log('✅ Login page loaded successfully');
    } else {
      console.log('❌ Login page did not load properly');
    }

    // Fill in credentials
    console.log('\n2. Entering admin credentials...');
    await page.fill('input[type="email"]', 'jaspervanmoose@gmail.com');
    console.log('✅ Email entered');
    
    // Get the password from environment or prompt
    const password = process.env.ADMIN_PASSWORD || 'test123'; // You'll need to set the actual password
    await page.fill('input[type="password"]', password);
    console.log('✅ Password entered');

    // Click login button
    console.log('\n3. Clicking login button...');
    await page.click('button[type="submit"]');

    // Wait for navigation or error
    console.log('4. Waiting for response...');
    
    // Try to wait for dashboard redirect
    try {
      await page.waitForURL('**/dashboard', { timeout: 10000 });
      console.log('✅ Successfully redirected to dashboard!');
      
      // Check if dashboard loaded
      const welcomeText = await page.textContent('h1');
      console.log(`✅ Dashboard loaded with: "${welcomeText}"`);
      
      // Test session persistence
      console.log('\n5. Testing session persistence...');
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      const urlAfterReload = page.url();
      if (urlAfterReload.includes('/dashboard')) {
        console.log('✅ Session persisted after reload');
      } else {
        console.log('❌ Session lost after reload - redirected to:', urlAfterReload);
      }
      
    } catch (error) {
      // Check for error messages
      const errorMessage = await page.locator('.text-red-500, .text-destructive, [role="alert"]').textContent().catch(() => null);
      if (errorMessage) {
        console.log(`❌ Login failed with error: ${errorMessage}`);
      } else {
        console.log('❌ Login failed - timeout waiting for dashboard');
        console.log('Current URL:', page.url());
        
        // Check if we're stuck on login page with loading spinner
        const spinner = await page.locator('.animate-spin, [aria-label="Loading"]').count();
        if (spinner > 0) {
          console.log('⚠️  Infinite loading spinner detected');
        }
      }
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  } finally {
    await browser.close();
  }
}

// Run the test
testAdminLogin();