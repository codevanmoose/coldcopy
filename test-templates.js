const { chromium } = require('playwright');

(async () => {
  console.log('🧪 Testing ColdCopy Templates Feature\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 300 
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true
  });
  
  const page = await context.newPage();
  
  // Track errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
      console.log(`Browser ERROR:`, msg.text());
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
    
    // 2. Navigate to Templates
    console.log('\n2. Navigating to Templates...');
    await page.click('text="Templates"');
    await page.waitForTimeout(3000);
    
    const templatesUrl = page.url();
    if (templatesUrl.includes('templates')) {
      results.passed.push('Templates navigation works');
    } else {
      results.failed.push('Templates navigation failed');
    }
    
    // 3. Check for templates content
    console.log('\n3. Checking templates page...');
    
    // Wait for content to load
    await Promise.race([
      page.waitForSelector('table', { timeout: 5000 }),
      page.waitForSelector('[role="grid"]', { timeout: 5000 }),
      page.waitForSelector('.grid', { timeout: 5000 }),
      page.waitForTimeout(5000)
    ]);
    
    // Check for templates
    const hasTable = await page.locator('table, [role="grid"], .grid').isVisible();
    const hasCreateButton = await page.locator('button:has-text("Create"), button:has-text("New Template")').isVisible();
    
    console.log('- Has templates display:', hasTable);
    console.log('- Has create button:', hasCreateButton);
    
    if (hasTable) {
      results.passed.push('Templates display working');
    } else {
      results.failed.push('Templates display not found');
    }
    
    // 4. Check for demo templates
    console.log('\n4. Looking for demo templates...');
    const templateCount = await page.locator('tr, [role="row"], .card').count();
    console.log(`Found ${templateCount} template items`);
    
    if (templateCount > 0) {
      results.passed.push(`Found ${templateCount} templates`);
    } else {
      results.failed.push('No templates found');
    }
    
    // 5. Test template creation
    if (hasCreateButton) {
      console.log('\n5. Testing template creation...');
      await page.locator('button:has-text("Create"), button:has-text("New Template")').first().click();
      await page.waitForTimeout(2000);
      
      // Check if modal or new page opened
      const hasModal = await page.locator('[role="dialog"], .modal').isVisible();
      const isNewPage = page.url().includes('new');
      
      if (hasModal || isNewPage) {
        results.passed.push('Template creation dialog opens');
        
        // Look for form fields
        const hasNameField = await page.locator('input[name="name"], input[placeholder*="name" i]').isVisible();
        const hasSubjectField = await page.locator('input[name="subject"], input[placeholder*="subject" i]').isVisible();
        const hasBodyField = await page.locator('textarea, [contenteditable="true"]').isVisible();
        
        console.log('- Name field:', hasNameField);
        console.log('- Subject field:', hasSubjectField);
        console.log('- Body field:', hasBodyField);
        
        if (hasNameField && hasSubjectField && hasBodyField) {
          results.passed.push('Template form fields present');
        } else {
          results.failed.push('Template form incomplete');
        }
      } else {
        results.failed.push('Template creation dialog failed to open');
      }
    }
    
    // Take screenshot
    await page.screenshot({ path: 'templates-test.png' });
    
  } catch (error) {
    console.error('\n❌ Test error:', error);
    results.failed.push(`Test crashed: ${error.message}`);
  }
  
  // Print results
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEMPLATES TEST RESULTS');
  console.log('='.repeat(50));
  
  console.log(`\n✅ PASSED (${results.passed.length}):`);
  results.passed.forEach(test => console.log(`   - ${test}`));
  
  if (results.failed.length > 0) {
    console.log(`\n❌ FAILED (${results.failed.length}):`);
    results.failed.forEach(test => console.log(`   - ${test}`));
  }
  
  if (errors.length > 0) {
    console.log(`\n⚠️  Console Errors (${errors.length}):`);
    const uniqueErrors = [...new Set(errors)];
    uniqueErrors.forEach(err => console.log(`   - ${err.substring(0, 100)}...`));
  }
  
  const successRate = Math.round((results.passed.length / (results.passed.length + results.failed.length)) * 100);
  console.log(`\n📈 Success Rate: ${successRate}%`);
  
  console.log('\nBrowser will remain open for inspection.');
  console.log('Press Ctrl+C to close.\n');
  
  // Keep browser open
  await new Promise(() => {});
})();