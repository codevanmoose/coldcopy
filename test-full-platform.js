const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500 
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  // Enable console logging
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`Browser ERROR:`, msg.text());
    }
  });

  try {
    console.log('=== COLDCOPY FULL PLATFORM TEST ===\n');
    
    // Test credentials
    const testEmail = `playwright.test${Date.now()}@example.com`;
    const testPassword = 'TestPassword123!';
    const testFullName = 'Playwright Test User';
    const testWorkspace = `Test Workspace ${Date.now()}`;
    
    console.log('Test account details:');
    console.log('Email:', testEmail);
    console.log('Password:', testPassword);
    console.log('Full Name:', testFullName);
    console.log('Workspace:', testWorkspace);
    
    // 1. CREATE ACCOUNT
    console.log('\n1. Creating new account...');
    await page.goto('https://www.coldcopy.cc/signup');
    await page.waitForLoadState('networkidle');
    
    // Fill signup form
    await page.fill('input[placeholder*="John Doe"]', testFullName);
    await page.fill('input[placeholder*="Acme Agency"]', testWorkspace);
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', testPassword);
    
    await page.screenshot({ path: 'signup-form-filled.png' });
    
    // Submit form
    await page.click('button:has-text("Start free trial")');
    
    // Wait for navigation or error
    await page.waitForTimeout(5000);
    
    const currentUrl = page.url();
    console.log('After signup URL:', currentUrl);
    
    // Check for error messages
    const errorMessage = await page.locator('.text-destructive, .text-red-600, [role="alert"]').first().textContent().catch(() => null);
    if (errorMessage) {
      console.log('Signup error:', errorMessage);
    }
    
    // Check if we're on verify email page
    if (currentUrl.includes('verify-email')) {
      console.log('Redirected to email verification page - signup successful!');
      await page.screenshot({ path: 'verify-email-page.png' });
      
      // For testing, let's try to login directly
      console.log('\n2. Attempting direct login (bypassing email verification for test)...');
      await page.goto('https://www.coldcopy.cc/login');
      await page.waitForLoadState('networkidle');
      
      await page.fill('input[type="email"]', testEmail);
      await page.fill('input[type="password"]', testPassword);
      await page.click('button:has-text("Sign in")');
      
      await page.waitForTimeout(3000);
      
      const loginUrl = page.url();
      console.log('After login URL:', loginUrl);
      
      if (loginUrl.includes('dashboard')) {
        console.log('Login successful! Testing dashboard...');
      } else {
        console.log('Login requires email verification. Checking for existing test account...');
        
        // Try with a known test account if available
        const existingEmail = 'test@example.com';
        const existingPassword = 'Test123!';
        
        console.log('\n3. Trying with existing test account...');
        await page.goto('https://www.coldcopy.cc/login');
        await page.waitForLoadState('networkidle');
        
        await page.fill('input[type="email"]', existingEmail);
        await page.fill('input[type="password"]', existingPassword);
        await page.click('button:has-text("Sign in")');
        
        await page.waitForTimeout(3000);
      }
    }
    
    // 3. TEST DASHBOARD FEATURES (if logged in)
    if (page.url().includes('dashboard')) {
      console.log('\n=== TESTING DASHBOARD FEATURES ===\n');
      
      await page.screenshot({ path: 'dashboard-home.png' });
      
      // Test navigation items
      const navItems = [
        { name: 'Campaigns', path: '/campaigns' },
        { name: 'Leads', path: '/leads' },
        { name: 'Inbox', path: '/inbox' },
        { name: 'Templates', path: '/templates' },
        { name: 'Analytics', path: '/analytics' },
        { name: 'Settings', path: '/settings' }
      ];
      
      for (const item of navItems) {
        console.log(`\nTesting ${item.name}...`);
        
        try {
          // Click nav item
          await page.click(`text="${item.name}"`).catch(() => {
            // Try alternative selectors
            return page.click(`a:has-text("${item.name}")`);
          });
          
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(2000);
          
          const url = page.url();
          console.log(`- URL: ${url}`);
          console.log(`- Expected path: ${item.path}`);
          console.log(`- Match: ${url.includes(item.path) ? '✅' : '❌'}`);
          
          // Check for errors
          const hasError = await page.locator('text=/error|Error|failed|Failed/i').count() > 0;
          if (hasError) {
            const errorText = await page.locator('text=/error|Error|failed|Failed/i').first().textContent();
            console.log(`- Error found: ${errorText}`);
          }
          
          await page.screenshot({ path: `dashboard-${item.name.toLowerCase()}.png` });
          
          // Test specific features
          if (item.name === 'Campaigns') {
            const hasNewButton = await page.locator('button:has-text("New Campaign"), a:has-text("New Campaign")').count() > 0;
            console.log(`- Has "New Campaign" button: ${hasNewButton ? '✅' : '❌'}`);
          }
          
          if (item.name === 'Leads') {
            const hasImportButton = await page.locator('button:has-text("Import"), a:has-text("Import")').count() > 0;
            console.log(`- Has "Import" button: ${hasImportButton ? '✅' : '❌'}`);
          }
          
        } catch (error) {
          console.log(`- Failed to navigate: ${error.message}`);
        }
      }
      
      // Test user menu
      console.log('\n\nTesting user menu...');
      const avatarButton = await page.locator('button img[alt*="Avatar"], button:has-text("Profile"), button[aria-label*="profile"]').first();
      if (await avatarButton.isVisible()) {
        await avatarButton.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'user-menu-open.png' });
        
        const hasLogout = await page.locator('text="Sign out", text="Logout", text="Log out"').count() > 0;
        console.log(`- Has logout option: ${hasLogout ? '✅' : '❌'}`);
      }
      
    } else {
      console.log('\nCould not access dashboard - email verification may be required');
      await page.screenshot({ path: 'final-state.png' });
    }
    
    // 4. CHECK FOR JAVASCRIPT ERRORS
    console.log('\n=== CHECKING FOR ERRORS ===\n');
    
    // Test critical API endpoints
    const apiTests = [
      '/api/health',
      '/api/test-auth',
      '/api/workspaces',
      '/api/campaigns'
    ];
    
    for (const endpoint of apiTests) {
      const response = await page.evaluate(async (url) => {
        try {
          const res = await fetch(`https://www.coldcopy.cc${url}`);
          return { 
            url, 
            status: res.status, 
            ok: res.ok,
            data: await res.text().then(t => {
              try { return JSON.parse(t); } catch { return t; }
            })
          };
        } catch (error) {
          return { url, error: error.message };
        }
      }, endpoint);
      
      console.log(`API ${endpoint}: ${response.status || 'ERROR'} ${response.ok ? '✅' : '❌'}`);
      if (response.error) console.log(`  Error: ${response.error}`);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
    await page.screenshot({ path: 'error-state.png' });
  }
  
  console.log('\n=== TEST COMPLETE ===');
  
  // Keep browser open for manual inspection
  console.log('\nBrowser will remain open for manual inspection...');
  console.log('Press Ctrl+C to close');
  
  // Keep the script running
  await new Promise(() => {});
})();