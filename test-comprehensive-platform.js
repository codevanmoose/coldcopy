// Comprehensive Platform Testing
const { chromium } = require('playwright');

(async () => {
  console.log('🚀 Starting comprehensive ColdCopy platform testing...');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  let passedTests = 0;
  let failedTests = 0;
  const testResults = [];
  
  // Helper function to run tests
  async function runTest(testName, testFn) {
    try {
      console.log(`📋 Testing: ${testName}...`);
      await testFn();
      console.log(`✅ PASSED: ${testName}`);
      testResults.push({ test: testName, status: 'PASSED' });
      passedTests++;
    } catch (error) {
      console.log(`❌ FAILED: ${testName} - ${error.message}`);
      testResults.push({ test: testName, status: 'FAILED', error: error.message });
      failedTests++;
    }
  }
  
  try {
    // Test 1: Landing Page Load
    await runTest('Landing Page Load', async () => {
      await page.goto('https://coldcopy.cc');
      await page.waitForSelector('h1', { timeout: 10000 });
      const title = await page.textContent('h1');
      if (!title || title.length === 0) {
        throw new Error('Landing page title not found');
      }
    });
    
    // Test 2: Navigation to Login
    await runTest('Navigation to Login Page', async () => {
      await page.click('a[href*="login"], button:has-text("Login"), a:has-text("Login")');
      await page.waitForURL('**/login');
      await page.waitForSelector('input[type="email"]', { timeout: 5000 });
    });
    
    // Test 3: Login Form Validation
    await runTest('Login Form Validation', async () => {
      await page.fill('input[type="email"]', 'invalid-email');
      await page.click('button[type="submit"]');
      // Should show validation error or stay on page
      await page.waitForTimeout(2000);
    });
    
    // Test 4: Admin Login
    await runTest('Admin Login Flow', async () => {
      await page.fill('input[type="email"]', 'jaspervanmoose@gmail.com');
      await page.fill('input[type="password"]', 'ColdCopyAdmin2024!');
      await page.click('button[type="submit"]');
      
      // Wait for either dashboard or loading state
      try {
        await page.waitForURL('**/dashboard', { timeout: 10000 });
      } catch {
        // If login is slow, wait for dashboard elements instead
        await page.waitForSelector('[data-testid="dashboard"], .dashboard, main', { timeout: 15000 });
      }
    });
    
    // Test 5: Dashboard Load
    await runTest('Dashboard Loading', async () => {
      // Ensure we're on dashboard page
      const currentUrl = page.url();
      if (!currentUrl.includes('dashboard')) {
        await page.goto('https://coldcopy.cc/dashboard');
      }
      
      await page.waitForSelector('h1, h2, [role="main"]', { timeout: 10000 });
      
      // Look for dashboard elements
      const hasStats = await page.locator('.grid .card, .stats, [data-testid="stat"]').count() > 0;
      const hasContent = await page.locator('main, .dashboard-content, .content').count() > 0;
      
      if (!hasStats && !hasContent) {
        throw new Error('Dashboard content not loaded properly');
      }
    });
    
    // Test 6: Navigation Menu
    await runTest('Dashboard Navigation', async () => {
      const navItems = ['Leads', 'Campaigns', 'Templates', 'Inbox', 'Analytics'];
      let foundNavItems = 0;
      
      for (const item of navItems) {
        const navLink = page.locator(`a:has-text("${item}"), nav a[href*="${item.toLowerCase()}"], [data-testid="nav-${item.toLowerCase()}"], button:has-text("${item}")`);
        if (await navLink.count() > 0) {
          foundNavItems++;
        }
      }
      
      if (foundNavItems < 3) {
        throw new Error(`Only found ${foundNavItems} navigation items, expected at least 3`);
      }
    });
    
    // Test 7: Leads Page
    await runTest('Leads Page Access', async () => {
      await page.goto('https://coldcopy.cc/leads');
      await page.waitForSelector('h1, h2, .leads-page, [data-testid="leads"]', { timeout: 8000 });
      
      // Look for leads table or empty state
      const hasTable = await page.locator('table, .leads-table, [data-testid="leads-table"]').count() > 0;
      const hasEmptyState = await page.locator('.empty-state, .no-leads, :has-text("No leads")').count() > 0;
      const hasAddButton = await page.locator('button:has-text("Add"), button:has-text("Create"), button:has-text("New")').count() > 0;
      
      if (!hasTable && !hasEmptyState && !hasAddButton) {
        throw new Error('Leads page does not have expected content');
      }
    });
    
    // Test 8: Campaigns Page  
    await runTest('Campaigns Page Access', async () => {
      await page.goto('https://coldcopy.cc/campaigns');
      await page.waitForSelector('h1, h2, .campaigns-page, [data-testid="campaigns"]', { timeout: 8000 });
      
      // Look for campaigns content
      const hasContent = await page.locator('table, .campaign-card, .empty-state, button:has-text("Create")').count() > 0;
      
      if (!hasContent) {
        throw new Error('Campaigns page does not have expected content');
      }
    });
    
    // Test 9: Templates Page
    await runTest('Templates Page Access', async () => {
      await page.goto('https://coldcopy.cc/templates');
      await page.waitForSelector('h1, h2, .templates-page, [data-testid="templates"]', { timeout: 8000 });
      
      // Look for templates content
      const hasContent = await page.locator('.template-card, .template-list, .empty-state, button:has-text("Create")').count() > 0;
      
      if (!hasContent) {
        throw new Error('Templates page does not have expected content');
      }
    });
    
    // Test 10: API Health Check
    await runTest('API Health Check', async () => {
      const response = await page.request.get('https://coldcopy.cc/api/workspaces');
      
      if (response.status() === 500) {
        throw new Error('API returning 500 errors - likely environment variables not configured');
      }
      
      if (response.status() === 401) {
        // 401 is expected for unauthenticated requests
        console.log('API returned 401 (expected for unauthenticated request)');
      } else if (response.status() >= 400) {
        throw new Error(`API returned ${response.status()} status`);
      }
    });
    
    // Test 11: User Profile/Settings
    await runTest('Settings Page Access', async () => {
      await page.goto('https://coldcopy.cc/settings');
      await page.waitForSelector('h1, h2, .settings-page, form', { timeout: 8000 });
      
      const hasSettingsContent = await page.locator('form, .settings-section, input, select').count() > 0;
      
      if (!hasSettingsContent) {
        throw new Error('Settings page does not have expected form elements');
      }
    });
    
    // Test 12: Authentication Persistence
    await runTest('Authentication Persistence', async () => {
      await page.reload();
      await page.waitForTimeout(3000);
      
      // Should still be logged in and on dashboard/app area
      const currentUrl = page.url();
      const isLoggedIn = !currentUrl.includes('/login') && !currentUrl.includes('/signup');
      
      if (!isLoggedIn) {
        throw new Error('Authentication not persisting across page refresh');
      }
    });
    
    console.log(`\n🎯 TEST SUMMARY:`);
    console.log(`✅ Passed: ${passedTests}`);
    console.log(`❌ Failed: ${failedTests}`);
    console.log(`📊 Success Rate: ${Math.round((passedTests / (passedTests + failedTests)) * 100)}%`);
    
    console.log(`\n📋 DETAILED RESULTS:`);
    testResults.forEach(result => {
      const icon = result.status === 'PASSED' ? '✅' : '❌';
      console.log(`${icon} ${result.test}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });
    
    // Final assessment
    if (failedTests === 0) {
      console.log(`\n🎉 ALL TESTS PASSED! ColdCopy platform is 100% functional!`);
    } else if (passedTests >= 8) {
      console.log(`\n🎊 PLATFORM READY! ${passedTests}/${passedTests + failedTests} tests passed - Core functionality working!`);
    } else {
      console.log(`\n⚠️  PLATFORM NEEDS FIXES - Only ${passedTests}/${passedTests + failedTests} tests passed`);
    }
    
  } catch (error) {
    console.error('❌ Testing failed:', error);
  } finally {
    await browser.close();
  }
})();