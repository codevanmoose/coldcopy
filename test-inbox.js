const { chromium } = require('playwright');

(async () => {
  console.log('🧪 Testing ColdCopy Inbox Feature\n');
  
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
    if (response.url().includes('/api/')) {
      console.log(`API: ${response.url().split('/api/')[1]} - Status: ${response.status()}`);
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
    
    // 2. Navigate to Inbox
    console.log('\n2. Navigating to Inbox...');
    await page.click('text="Inbox"');
    await page.waitForTimeout(3000);
    
    const inboxUrl = page.url();
    if (inboxUrl.includes('inbox')) {
      results.passed.push('Inbox navigation works');
    } else {
      results.failed.push('Inbox navigation failed');
    }
    
    // 3. Check inbox content
    console.log('\n3. Checking inbox page...');
    
    // Wait for content to load
    await Promise.race([
      page.waitForSelector('.inbox-thread', { timeout: 5000 }),
      page.waitForSelector('[data-testid="inbox-empty"]', { timeout: 5000 }),
      page.waitForSelector('.text-muted-foreground:has-text("inbox")', { timeout: 5000 }),
      page.waitForTimeout(5000)
    ]);
    
    // Check for inbox elements
    const hasThreads = await page.locator('.inbox-thread, [data-testid*="thread"]').count();
    const hasEmptyState = await page.locator('[data-testid="inbox-empty"], .text-muted-foreground:has-text("No conversations")').isVisible();
    const hasFilters = await page.locator('button:has-text("Filter"), button:has-text("All")').isVisible();
    
    console.log('- Thread count:', hasThreads);
    console.log('- Has empty state:', hasEmptyState);
    console.log('- Has filters:', hasFilters);
    
    if (hasThreads > 0 || hasEmptyState) {
      results.passed.push('Inbox display working');
    } else {
      results.failed.push('Inbox display not found');
    }
    
    // 4. Test filters if available
    if (hasFilters) {
      console.log('\n4. Testing inbox filters...');
      const filterButton = await page.locator('button:has-text("Filter"), button:has-text("All")').first();
      await filterButton.click();
      await page.waitForTimeout(1000);
      
      // Check for filter options
      const hasFilterOptions = await page.locator('[role="menu"], .dropdown-menu').isVisible();
      if (hasFilterOptions) {
        results.passed.push('Filter dropdown works');
      } else {
        results.failed.push('Filter dropdown not working');
      }
    }
    
    // 5. Test search
    console.log('\n5. Testing inbox search...');
    const searchInput = await page.locator('input[type="search"], input[placeholder*="search" i]').first();
    const hasSearch = await searchInput.isVisible();
    
    if (hasSearch) {
      await searchInput.fill('test search');
      await page.waitForTimeout(1000);
      results.passed.push('Search input works');
    } else {
      results.failed.push('Search not found');
    }
    
    // Take screenshot
    await page.screenshot({ path: 'inbox-test.png' });
    
    // 6. Check for real-time updates support
    console.log('\n6. Checking for real-time features...');
    const hasRealtimeIndicator = await page.locator('.online-indicator, [data-testid="realtime"]').isVisible();
    console.log('- Real-time indicator:', hasRealtimeIndicator);
    
  } catch (error) {
    console.error('\n❌ Test error:', error);
    results.failed.push(`Test crashed: ${error.message}`);
  }
  
  // Print results
  console.log('\n' + '='.repeat(50));
  console.log('📊 INBOX TEST RESULTS');
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