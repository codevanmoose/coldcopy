const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 300 
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
    console.log('=== COLDCOPY ADMIN LOGIN TEST ===\n');
    
    // Admin credentials from setup
    const adminEmail = 'jaspervanmoose@gmail.com';
    const adminPassword = 'okkenbollen33';
    
    // 1. LOGIN WITH ADMIN ACCOUNT
    console.log('1. Logging in with admin account...');
    await page.goto('https://www.coldcopy.cc/login');
    await page.waitForLoadState('networkidle');
    
    // Fill login form
    await page.fill('input[type="email"]', adminEmail);
    await page.fill('input[type="password"]', adminPassword);
    
    await page.screenshot({ path: 'admin-login-form.png' });
    
    // Submit form
    await page.click('button:has-text("Sign in")');
    
    // Wait for navigation
    console.log('Waiting for login response...');
    await page.waitForTimeout(5000);
    
    const currentUrl = page.url();
    console.log('After login URL:', currentUrl);
    
    // Check for error messages
    const errorMessage = await page.locator('.text-destructive, .text-red-600, [role="alert"], .bg-destructive').first().textContent().catch(() => null);
    if (errorMessage) {
      console.log('Login error:', errorMessage);
      await page.screenshot({ path: 'login-error.png' });
    }
    
    // Check if we reached dashboard
    if (currentUrl.includes('dashboard')) {
      console.log('✅ Login successful! Now on dashboard');
      await page.screenshot({ path: 'dashboard-after-login.png' });
      
      // Test dashboard functionality
      console.log('\n=== TESTING DASHBOARD FEATURES ===\n');
      
      // Wait for dashboard to fully load
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      // Test each major section
      const sections = [
        { name: 'Campaigns', selector: 'a[href="/campaigns"], text="Campaigns"' },
        { name: 'Leads', selector: 'a[href="/leads"], text="Leads"' },
        { name: 'Inbox', selector: 'a[href="/inbox"], text="Inbox"' },
        { name: 'Templates', selector: 'a[href="/templates"], text="Templates"' },
        { name: 'Analytics', selector: 'a[href="/analytics"], text="Analytics"' },
        { name: 'Settings', selector: 'a[href="/settings"], text="Settings"' }
      ];
      
      for (const section of sections) {
        console.log(`\nTesting ${section.name}...`);
        
        try {
          // Navigate to section
          await page.click(section.selector);
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(2000);
          
          const sectionUrl = page.url();
          console.log(`- URL: ${sectionUrl}`);
          
          // Check for errors
          const hasError = await page.locator('text=/error|Error|Something went wrong/i').count() > 0;
          if (hasError) {
            const errorText = await page.locator('text=/error|Error|Something went wrong/i').first().textContent();
            console.log(`- ❌ Error found: ${errorText}`);
          } else {
            console.log(`- ✅ Page loaded successfully`);
          }
          
          // Check for loading states
          const hasSpinner = await page.locator('.animate-spin, [aria-label="Loading"]').count() > 0;
          if (hasSpinner) {
            console.log(`- ⚠️  Still loading...`);
            await page.waitForTimeout(3000);
          }
          
          await page.screenshot({ path: `dashboard-${section.name.toLowerCase()}.png` });
          
          // Test specific features
          if (section.name === 'Campaigns') {
            const campaignCount = await page.locator('[data-testid="campaign-card"], .campaign-item, text=/campaign/i').count();
            console.log(`- Found ${campaignCount} campaigns`);
            
            const hasNewButton = await page.locator('button:has-text("New Campaign"), a:has-text("New Campaign"), button:has-text("Create Campaign")').count() > 0;
            console.log(`- Has "New Campaign" button: ${hasNewButton ? '✅' : '❌'}`);
          }
          
          if (section.name === 'Leads') {
            const leadCount = await page.locator('tr[data-testid="lead-row"], .lead-item, tbody tr').count();
            console.log(`- Found ${leadCount} leads in table`);
            
            const hasImportButton = await page.locator('button:has-text("Import"), a:has-text("Import"), button:has-text("Upload CSV")').count() > 0;
            console.log(`- Has "Import" button: ${hasImportButton ? '✅' : '❌'}`);
          }
          
          if (section.name === 'Templates') {
            const templateCount = await page.locator('[data-testid="template-card"], .template-item, text=/template/i').count();
            console.log(`- Found ${templateCount} templates`);
          }
          
        } catch (error) {
          console.log(`- ❌ Failed to navigate: ${error.message}`);
        }
      }
      
      // Test creating a new campaign
      console.log('\n\n=== TESTING CAMPAIGN CREATION ===\n');
      
      await page.goto('https://www.coldcopy.cc/campaigns/new');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      const onNewCampaignPage = page.url().includes('campaigns/new');
      console.log(`On new campaign page: ${onNewCampaignPage ? '✅' : '❌'}`);
      
      if (onNewCampaignPage) {
        await page.screenshot({ path: 'new-campaign-page.png' });
        
        // Check for form elements
        const hasNameInput = await page.locator('input[name="name"], input[placeholder*="campaign"], input[type="text"]').first().isVisible();
        console.log(`Has campaign name input: ${hasNameInput ? '✅' : '❌'}`);
      }
      
      // Test user menu
      console.log('\n\n=== TESTING USER MENU ===\n');
      
      await page.goto('https://www.coldcopy.cc/dashboard');
      await page.waitForLoadState('networkidle');
      
      // Look for user avatar/menu button
      const userMenuButton = await page.locator('button:has(img[alt*="avatar" i]), button[aria-label*="user" i], button[aria-label*="profile" i], .user-menu-trigger').first();
      
      if (await userMenuButton.isVisible()) {
        console.log('Found user menu button');
        await userMenuButton.click();
        await page.waitForTimeout(1000);
        
        const hasSignOut = await page.locator('text=/sign out|log out|logout/i').count() > 0;
        console.log(`Has sign out option: ${hasSignOut ? '✅' : '❌'}`);
        
        await page.screenshot({ path: 'user-menu-open.png' });
      } else {
        console.log('Could not find user menu button');
      }
      
    } else {
      console.log('❌ Login failed - not redirected to dashboard');
      console.log('Current URL:', currentUrl);
      await page.screenshot({ path: 'login-failed-state.png' });
      
      // Check what page we're on
      const pageTitle = await page.title();
      const pageContent = await page.locator('h1, h2').first().textContent().catch(() => 'No heading found');
      console.log('Page title:', pageTitle);
      console.log('Page heading:', pageContent);
    }
    
    // Final API status check
    console.log('\n\n=== API STATUS CHECK ===\n');
    
    const apiResponse = await page.evaluate(async () => {
      const endpoints = [
        '/api/health',
        '/api/test-auth',
        '/api/workspaces',
        '/api/metrics'
      ];
      
      const results = [];
      for (const endpoint of endpoints) {
        try {
          const res = await fetch(`https://www.coldcopy.cc${endpoint}`);
          const text = await res.text();
          let data;
          try {
            data = JSON.parse(text);
          } catch {
            data = text;
          }
          results.push({
            endpoint,
            status: res.status,
            ok: res.ok,
            data: data
          });
        } catch (error) {
          results.push({
            endpoint,
            error: error.message
          });
        }
      }
      return results;
    });
    
    apiResponse.forEach(res => {
      console.log(`${res.endpoint}: ${res.status || 'ERROR'} ${res.ok ? '✅' : '❌'}`);
      if (res.error) console.log(`  Error: ${res.error}`);
      if (res.data && res.endpoint === '/api/test-auth') {
        console.log(`  Auth status: ${res.data.hasSession ? 'Logged in' : 'Not logged in'}`);
      }
    });
    
  } catch (error) {
    console.error('Test failed:', error);
    await page.screenshot({ path: 'test-error-state.png' });
  }
  
  console.log('\n=== TEST COMPLETE ===');
  console.log('\nBrowser will remain open for manual inspection...');
  console.log('Press Ctrl+C to close');
  
  // Keep the script running
  await new Promise(() => {});
})();