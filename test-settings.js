const { chromium } = require('playwright');

(async () => {
  console.log('🧪 Testing ColdCopy Settings Feature\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 300 
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true
  });
  
  const page = await context.newPage();
  
  const results = {
    passed: [],
    failed: []
  };
  
  try {
    // 1. Login
    console.log('1. Logging in...');
    await page.goto('https://www.coldcopy.cc/login');
    await page.fill('input[type="email"]', 'jaspervanmoose@gmail.com');
    await page.fill('input[type="password"]', 'okkenbollen33');
    await page.click('button:has-text("Sign in")');
    
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    results.passed.push('Login successful');
    
    // 2. Navigate to Settings
    console.log('\n2. Navigating to Settings...');
    await page.click('text="Settings"');
    await page.waitForTimeout(3000);
    
    const settingsUrl = page.url();
    if (settingsUrl.includes('settings')) {
      results.passed.push('Settings navigation works');
    } else {
      results.failed.push('Settings navigation failed');
    }
    
    // 3. Check settings content
    console.log('\n3. Checking settings page...');
    
    // Look for settings sections
    const settingsSections = ['General', 'Profile', 'Workspace', 'Team', 'Billing', 'API', 'Integrations'];
    let foundSections = 0;
    
    for (const section of settingsSections) {
      const hasSection = await page.locator(`text="${section}", [data-testid*="${section.toLowerCase()}"]`).isVisible();
      if (hasSection) {
        foundSections++;
        console.log(`- ${section}: ✅`);
      } else {
        console.log(`- ${section}: ❌`);
      }
    }
    
    if (foundSections > 0) {
      results.passed.push(`Found ${foundSections} settings sections`);
    } else {
      results.failed.push('No settings sections found');
    }
    
    // 4. Check for form elements
    console.log('\n4. Checking form elements...');
    const hasInputs = await page.locator('input, textarea, select').count();
    const hasButtons = await page.locator('button:has-text("Save"), button:has-text("Update")').count();
    
    console.log('- Input fields:', hasInputs);
    console.log('- Save buttons:', hasButtons);
    
    if (hasInputs > 0) {
      results.passed.push('Settings form fields present');
    }
    
    // 5. Test navigation between settings
    console.log('\n5. Testing settings navigation...');
    const settingsTabs = await page.locator('[role="tab"], .nav-link, .settings-nav a').count();
    console.log('- Settings tabs:', settingsTabs);
    
    if (settingsTabs > 0) {
      results.passed.push('Settings navigation available');
    }
    
    // Take screenshot
    await page.screenshot({ path: 'settings-test.png' });
    
  } catch (error) {
    console.error('\n❌ Test error:', error);
    results.failed.push(`Test crashed: ${error.message}`);
  }
  
  // Print results
  console.log('\n' + '='.repeat(50));
  console.log('📊 SETTINGS TEST RESULTS');
  console.log('='.repeat(50));
  
  console.log(`\n✅ PASSED (${results.passed.length}):`);
  results.passed.forEach(test => console.log(`   - ${test}`));
  
  if (results.failed.length > 0) {
    console.log(`\n❌ FAILED (${results.failed.length}):`);
    results.failed.forEach(test => console.log(`   - ${test}`));
  }
  
  const successRate = Math.round((results.passed.length / (results.passed.length + results.failed.length)) * 100);
  console.log(`\n📈 Success Rate: ${successRate}%`);
  
  console.log('\nBrowser will remain open for inspection.');
  console.log('Press Ctrl+C to close.\n');
  
  // Keep browser open
  await new Promise(() => {});
})();