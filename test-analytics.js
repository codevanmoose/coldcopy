const { chromium } = require('playwright');

(async () => {
  console.log('🧪 Testing ColdCopy Analytics Feature\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 300 
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true
  });
  
  const page = await context.newPage();
  
  // Track API responses
  page.on('response', response => {
    if (response.url().includes('/api/') && response.url().includes('analytics')) {
      console.log(`Analytics API: ${response.url().split('/api/')[1]} - Status: ${response.status()}`);
    }
  });
  
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
    
    // 2. Navigate to Analytics
    console.log('\n2. Navigating to Analytics...');
    await page.click('text="Analytics"');
    await page.waitForTimeout(3000);
    
    const analyticsUrl = page.url();
    if (analyticsUrl.includes('analytics')) {
      results.passed.push('Analytics navigation works');
    } else {
      results.failed.push('Analytics navigation failed');
    }
    
    // 3. Check analytics content
    console.log('\n3. Checking analytics page...');
    
    // Wait for content to load
    await Promise.race([
      page.waitForSelector('.recharts-wrapper', { timeout: 5000 }),
      page.waitForSelector('canvas', { timeout: 5000 }),
      page.waitForSelector('[data-testid="analytics-chart"]', { timeout: 5000 }),
      page.waitForSelector('.card:has-text("Email")', { timeout: 5000 }),
      page.waitForTimeout(5000)
    ]);
    
    // Check for analytics elements
    const hasCharts = await page.locator('.recharts-wrapper, canvas, svg[role="img"]').count();
    const hasMetricCards = await page.locator('.card, [data-testid*="metric"]').count();
    const hasDatePicker = await page.locator('button:has-text("days"), button[aria-label*="date"]').isVisible();
    
    console.log('- Chart count:', hasCharts);
    console.log('- Metric cards:', hasMetricCards);
    console.log('- Has date picker:', hasDatePicker);
    
    if (hasCharts > 0 || hasMetricCards > 0) {
      results.passed.push('Analytics display working');
    } else {
      results.failed.push('No analytics content found');
    }
    
    // 4. Check for different analytics tabs
    console.log('\n4. Checking analytics tabs...');
    const tabs = ['Overview', 'Campaigns', 'Leads', 'Email Performance'];
    let tabCount = 0;
    
    for (const tab of tabs) {
      const hasTab = await page.locator(`button:has-text("${tab}"), [role="tab"]:has-text("${tab}")`).isVisible();
      if (hasTab) {
        tabCount++;
        console.log(`- ${tab} tab: ✅`);
      } else {
        console.log(`- ${tab} tab: ❌`);
      }
    }
    
    if (tabCount > 0) {
      results.passed.push(`Found ${tabCount} analytics tabs`);
    }
    
    // 5. Test date range selector
    console.log('\n5. Testing date range selector...');
    const dateButton = await page.locator('button:has-text("days"), button:has-text("Last"), button[aria-label*="date"]').first();
    if (await dateButton.isVisible()) {
      await dateButton.click();
      await page.waitForTimeout(1000);
      
      const hasDateOptions = await page.locator('[role="menu"], .dropdown-menu, .popover').isVisible();
      if (hasDateOptions) {
        results.passed.push('Date range selector works');
      } else {
        results.failed.push('Date range options not found');
      }
    }
    
    // 6. Check for data export
    console.log('\n6. Looking for export functionality...');
    const hasExport = await page.locator('button:has-text("Export"), button:has-text("Download")').isVisible();
    console.log('- Export button:', hasExport ? '✅' : '❌');
    
    if (hasExport) {
      results.passed.push('Export functionality available');
    }
    
    // Take screenshot
    await page.screenshot({ path: 'analytics-test.png' });
    
  } catch (error) {
    console.error('\n❌ Test error:', error);
    results.failed.push(`Test crashed: ${error.message}`);
  }
  
  // Print results
  console.log('\n' + '='.repeat(50));
  console.log('📊 ANALYTICS TEST RESULTS');
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