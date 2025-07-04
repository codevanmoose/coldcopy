const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 100 
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  // Enable console logging
  page.on('console', msg => {
    console.log(`Browser console [${msg.type()}]:`, msg.text());
  });
  
  // Log network errors
  page.on('requestfailed', request => {
    console.log(`Request failed: ${request.url()} - ${request.failure().errorText}`);
  });

  console.log('1. Testing auth status page...');
  await page.goto('https://www.coldcopy.cc/auth-test');
  await page.waitForTimeout(3000);
  
  // Take screenshot of auth test page
  await page.screenshot({ path: 'auth-test-page.png', fullPage: true });
  
  // Get the status text
  const statusText = await page.locator('pre').textContent().catch(() => 'No status found');
  console.log('Auth test status:', statusText);
  
  console.log('\n2. Testing login page...');
  await page.goto('https://www.coldcopy.cc/login');
  
  // Wait for the page to load
  await page.waitForTimeout(3000);
  
  // Take screenshot of login page
  await page.screenshot({ path: 'login-page-initial.png', fullPage: true });
  
  // Check if we're stuck on a loading spinner
  const hasSpinner = await page.locator('svg.animate-spin').count() > 0;
  console.log('Has loading spinner:', hasSpinner);
  
  // Check for any error messages in console
  const loginFormVisible = await page.locator('input[type="email"]').isVisible().catch(() => false);
  console.log('Login form visible:', loginFormVisible);
  
  if (!loginFormVisible) {
    console.log('Login form not visible, checking page source...');
    const pageContent = await page.content();
    console.log('Page title:', await page.title());
    
    // Check if there's an error
    const errorElement = await page.locator('text=/error|Error/i').first().textContent().catch(() => null);
    if (errorElement) {
      console.log('Error found:', errorElement);
    }
  }
  
  // Try to create a test account if login form is visible
  if (loginFormVisible) {
    console.log('\n3. Attempting to create test account...');
    
    // First go to signup
    await page.goto('https://www.coldcopy.cc/signup');
    await page.waitForTimeout(2000);
    
    const signupFormVisible = await page.locator('input[type="email"]').isVisible().catch(() => false);
    
    if (signupFormVisible) {
      const testEmail = `test${Date.now()}@example.com`;
      const testPassword = 'TestPassword123!';
      
      console.log('Creating account with:', testEmail);
      
      await page.fill('input[type="email"]', testEmail);
      await page.fill('input[type="password"]', testPassword);
      
      // Look for confirm password field
      const confirmPasswordField = await page.locator('input[type="password"]').nth(1);
      if (await confirmPasswordField.isVisible()) {
        await confirmPasswordField.fill(testPassword);
      }
      
      await page.screenshot({ path: 'signup-filled.png' });
      
      // Click signup button
      await page.click('button[type="submit"]');
      
      // Wait for response
      await page.waitForTimeout(5000);
      
      // Check where we ended up
      const currentUrl = page.url();
      console.log('After signup, current URL:', currentUrl);
      
      await page.screenshot({ path: 'after-signup.png', fullPage: true });
    }
  }
  
  // Check network tab for failed requests
  console.log('\n4. Checking for network issues...');
  
  // Try direct API call
  console.log('\n5. Testing API health...');
  const healthResponse = await page.evaluate(async () => {
    try {
      const response = await fetch('https://www.coldcopy.cc/api/health');
      const data = await response.json();
      return { status: response.status, data };
    } catch (error) {
      return { error: error.message };
    }
  });
  console.log('Health API response:', healthResponse);
  
  // Test auth API
  console.log('\n6. Testing auth API...');
  const authResponse = await page.evaluate(async () => {
    try {
      const response = await fetch('https://www.coldcopy.cc/api/test-auth');
      const data = await response.json();
      return { status: response.status, data };
    } catch (error) {
      return { error: error.message };
    }
  });
  console.log('Auth API response:', authResponse);
  
  await browser.close();
})();