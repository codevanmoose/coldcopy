const { chromium } = require('playwright');

(async () => {
  console.log('🧪 ColdCopy Live Platform Check\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 300 
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true
  });
  
  const page = await context.newPage();
  
  // Capture console messages
  page.on('console', msg => {
    console.log(`Browser console [${msg.type()}]:`, msg.text());
  });
  
  page.on('pageerror', error => {
    console.log('Page error:', error.message);
  });
  
  try {
    // 1. Check if site is accessible
    console.log('1. Checking if coldcopy.cc is accessible...');
    
    try {
      await page.goto('https://www.coldcopy.cc', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      console.log('✅ Site is accessible');
    } catch (error) {
      console.log('❌ Site is not accessible:', error.message);
      await page.screenshot({ path: 'site-not-accessible.png' });
      throw error;
    }
    
    // 2. Check page content
    console.log('\n2. Checking page content...');
    
    const title = await page.title();
    console.log('Page title:', title);
    
    const hasContent = await page.locator('body').textContent();
    if (hasContent && hasContent.length > 100) {
      console.log('✅ Page has content');
    } else {
      console.log('❌ Page appears empty');
    }
    
    await page.screenshot({ path: 'landing-page.png' });
    
    // 3. Check for error messages
    const errors = await page.locator('.error, .text-red-500, [role="alert"]').all();
    if (errors.length > 0) {
      console.log('⚠️  Found error messages on page:');
      for (const error of errors) {
        const text = await error.textContent();
        console.log('  -', text);
      }
    }
    
    // 4. Try to navigate to login
    console.log('\n3. Navigating to login page...');
    
    try {
      await page.goto('https://www.coldcopy.cc/login', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      console.log('✅ Login page accessible');
      
      // Check for login form
      const emailInput = await page.locator('input[type="email"]').isVisible();
      const passwordInput = await page.locator('input[type="password"]').isVisible();
      const loginButton = await page.locator('button:has-text("Sign in")').isVisible();
      
      console.log('Login form elements:');
      console.log('  Email input:', emailInput ? '✅' : '❌');
      console.log('  Password input:', passwordInput ? '✅' : '❌');
      console.log('  Login button:', loginButton ? '✅' : '❌');
      
      await page.screenshot({ path: 'login-page.png' });
      
    } catch (error) {
      console.log('❌ Login page error:', error.message);
    }
    
    // 5. Test admin login
    console.log('\n4. Testing admin login...');
    
    if (await page.locator('input[type="email"]').isVisible()) {
      await page.fill('input[type="email"]', 'jaspervanmoose@gmail.com');
      await page.fill('input[type="password"]', 'okkenbollen33');
      
      console.log('Credentials filled, attempting login...');
      await page.click('button:has-text("Sign in")');
      
      // Wait for response
      await page.waitForTimeout(5000);
      
      const currentUrl = page.url();
      console.log('Current URL after login:', currentUrl);
      
      if (currentUrl.includes('dashboard')) {
        console.log('✅ Login successful - redirected to dashboard');
        await page.screenshot({ path: 'dashboard-after-login.png' });
        
        // Quick dashboard check
        console.log('\n5. Quick dashboard check...');
        
        const navItems = ['Campaigns', 'Leads', 'Inbox', 'Templates', 'Analytics', 'Settings'];
        console.log('Navigation items:');
        
        for (const item of navItems) {
          const isVisible = await page.locator(`text="${item}"`).first().isVisible();
          console.log(`  ${item}:`, isVisible ? '✅' : '❌');
        }
        
      } else {
        console.log('❌ Login failed or redirected elsewhere');
        
        // Check for error messages
        const errorMsg = await page.locator('.text-destructive, .text-red-600, [role="alert"]').first().textContent().catch(() => null);
        if (errorMsg) {
          console.log('Error message:', errorMsg);
        }
        
        await page.screenshot({ path: 'login-failed.png' });
      }
    }
    
    // 6. API health check
    console.log('\n6. Checking API endpoints...');
    
    const apiEndpoints = [
      '/api/health',
      '/api/test-auth'
    ];
    
    for (const endpoint of apiEndpoints) {
      const response = await page.evaluate(async (url) => {
        try {
          const res = await fetch(url);
          const text = await res.text();
          let data;
          try {
            data = JSON.parse(text);
          } catch {
            data = text;
          }
          return {
            url,
            status: res.status,
            ok: res.ok,
            data
          };
        } catch (error) {
          return {
            url,
            error: error.message
          };
        }
      }, `https://www.coldcopy.cc${endpoint}`);
      
      console.log(`${endpoint}:`, response.status || 'ERROR', response.ok ? '✅' : '❌');
      if (response.error) {
        console.log('  Error:', response.error);
      }
    }
    
    console.log('\n✅ Basic platform check complete!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    await page.screenshot({ path: 'error-state.png' });
  }
  
  console.log('\nScreenshots saved. Browser will remain open for inspection.');
  console.log('Press Ctrl+C to close.\n');
  
  // Keep browser open
  await new Promise(() => {});
})();