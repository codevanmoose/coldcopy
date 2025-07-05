const { chromium } = require('playwright');

(async () => {
  console.log('🧪 Testing All ColdCopy Fixes\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 200 
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true
  });
  
  const page = await context.newPage();
  
  // Track console errors
  let consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  
  const results = {
    passed: [],
    failed: [],
    warnings: []
  };
  
  try {
    // 1. Test landing page loads without 404s
    console.log('1. Testing landing page...');
    await page.goto('https://www.coldcopy.cc');
    await page.waitForLoadState('networkidle');
    
    // Check for 404 errors
    const has404s = consoleErrors.some(err => err.includes('404'));
    if (has404s) {
      results.warnings.push('Still some 404 errors on landing page');
    } else {
      results.passed.push('Landing page loads without 404 errors');
    }
    consoleErrors = [];
    
    // 2. Test login
    console.log('\n2. Testing login...');
    await page.goto('https://www.coldcopy.cc/login');
    await page.fill('input[type="email"]', 'jaspervanmoose@gmail.com');
    await page.fill('input[type="password"]', 'okkenbollen33');
    await page.click('button:has-text("Sign in")');
    
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    results.passed.push('Login successful');
    
    // 3. Test workspaces API
    console.log('\n3. Testing workspaces API...');
    const workspacesResponse = await page.evaluate(async () => {
      const res = await fetch('/api/workspaces');
      return { status: res.status, ok: res.ok };
    });
    
    if (workspacesResponse.ok) {
      results.passed.push('Workspaces API working');
    } else {
      results.failed.push('Workspaces API still has issues');
    }
    
    // 4. Test campaign creation form
    console.log('\n4. Testing campaign creation...');
    await page.goto('https://www.coldcopy.cc/campaigns/new');
    await page.waitForLoadState('networkidle');
    
    // Fill step 1
    await page.fill('input[name="name"]', 'Test Campaign');
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(1000);
    
    // Check if email fields are visible in step 2
    const subjectVisible = await page.locator('input[name="subject"], input[placeholder*="subject" i]').first().isVisible();
    const bodyVisible = await page.locator('textarea[name="body"], [contenteditable="true"], textarea[placeholder*="email" i]').first().isVisible();
    
    if (subjectVisible && bodyVisible) {
      results.passed.push('Campaign email fields are visible');
    } else {
      results.failed.push('Campaign email fields not visible');
    }
    
    // 5. Test leads page
    console.log('\n5. Testing leads page...');
    await page.goto('https://www.coldcopy.cc/leads');
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    
    const hasLeadsTable = await page.locator('table, [role="table"]').isVisible();
    if (hasLeadsTable) {
      results.passed.push('Leads page loads successfully');
    } else {
      results.failed.push('Leads page not loading properly');
    }
    
    // 6. Test navigation
    console.log('\n6. Testing navigation...');
    const sections = ['Templates', 'Inbox', 'Analytics', 'Settings'];
    
    for (const section of sections) {
      await page.click(`text="${section}"`);
      await page.waitForTimeout(2000);
      
      const url = page.url();
      if (url.includes(section.toLowerCase())) {
        results.passed.push(`${section} navigation works`);
      } else {
        results.failed.push(`${section} navigation failed`);
      }
    }
    
    // 7. Check final console errors
    console.log('\n7. Checking for console errors...');
    if (consoleErrors.length === 0) {
      results.passed.push('No console errors detected');
    } else {
      const unique404s = [...new Set(consoleErrors.filter(e => e.includes('404')))];
      const otherErrors = consoleErrors.filter(e => !e.includes('404'));
      
      if (unique404s.length > 0) {
        results.warnings.push(`${unique404s.length} unique 404 errors remain`);
      }
      if (otherErrors.length > 0) {
        results.failed.push(`${otherErrors.length} non-404 errors found`);
      }
    }
    
  } catch (error) {
    console.error('Test error:', error);
    results.failed.push(`Test crashed: ${error.message}`);
  }
  
  // Print results
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(50));
  
  console.log(`\n✅ PASSED (${results.passed.length}):`);
  results.passed.forEach(test => console.log(`   - ${test}`));
  
  if (results.warnings.length > 0) {
    console.log(`\n⚠️  WARNINGS (${results.warnings.length}):`);
    results.warnings.forEach(test => console.log(`   - ${test}`));
  }
  
  if (results.failed.length > 0) {
    console.log(`\n❌ FAILED (${results.failed.length}):`);
    results.failed.forEach(test => console.log(`   - ${test}`));
  }
  
  const successRate = Math.round((results.passed.length / (results.passed.length + results.failed.length)) * 100);
  console.log(`\n📈 Success Rate: ${successRate}%`);
  
  if (results.failed.length === 0) {
    console.log('\n🎉 All critical tests passed! Platform is functional.');
  } else {
    console.log('\n⚠️  Some tests failed. Review and fix remaining issues.');
  }
  
  console.log('\nBrowser will remain open for inspection.');
  console.log('Press Ctrl+C to close.\n');
  
  // Keep browser open
  await new Promise(() => {});
})();