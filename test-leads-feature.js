const { chromium } = require('playwright');

(async () => {
  console.log('🧪 Testing ColdCopy Lead Management Features\n');
  
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
    if (msg.type() === 'error') {
      console.log(`Browser ERROR:`, msg.text());
    }
  });
  
  try {
    // Login first
    console.log('1. Logging in as admin...');
    await page.goto('https://www.coldcopy.cc/login');
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[type="email"]', 'jaspervanmoose@gmail.com');
    await page.fill('input[type="password"]', 'okkenbollen33');
    await page.click('button:has-text("Sign in")');
    
    await page.waitForTimeout(5000);
    
    if (!page.url().includes('dashboard')) {
      console.log('❌ Login failed');
      return;
    }
    
    console.log('✅ Login successful\n');
    
    // Navigate to leads
    console.log('2. Testing Leads Section...');
    await page.click('text="Leads"');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    const leadsUrl = page.url();
    console.log('Current URL:', leadsUrl);
    
    // Check for leads table
    console.log('\n3. Checking leads table...');
    const hasTable = await page.locator('table, [role="table"]').isVisible();
    console.log('Has table:', hasTable ? '✅' : '❌');
    
    // Count leads
    const leadRows = await page.locator('tbody tr, [role="row"]').count();
    console.log(`Found ${leadRows} lead rows`);
    
    // Check for table headers
    const headers = ['Email', 'Name', 'Company', 'Status', 'Created'];
    console.log('\nTable headers:');
    for (const header of headers) {
      const hasHeader = await page.locator(`th:has-text("${header}"), td:has-text("${header}")`).first().isVisible();
      console.log(`${header}:`, hasHeader ? '✅' : '❌');
    }
    
    // Look for action buttons
    console.log('\n4. Checking action buttons...');
    
    const importButton = await page.locator('button:has-text("Import"), a:has-text("Import")').first();
    const hasImportButton = await importButton.isVisible();
    console.log('Import button:', hasImportButton ? '✅' : '❌');
    
    const addLeadButton = await page.locator('button:has-text("Add Lead"), button:has-text("New Lead")').first();
    const hasAddLeadButton = await addLeadButton.isVisible();
    console.log('Add Lead button:', hasAddLeadButton ? '✅' : '❌');
    
    // Test search functionality
    console.log('\n5. Testing search...');
    const searchInput = await page.locator('input[placeholder*="Search"], input[type="search"]').first();
    const hasSearchInput = await searchInput.isVisible();
    console.log('Search input:', hasSearchInput ? '✅' : '❌');
    
    if (hasSearchInput) {
      await searchInput.fill('test@example.com');
      await page.waitForTimeout(1000);
      console.log('Search performed');
    }
    
    // Test filters
    console.log('\n6. Testing filters...');
    const filterButton = await page.locator('button:has-text("Filter"), button:has-text("Filters")').first();
    const hasFilterButton = await filterButton.isVisible();
    console.log('Filter button:', hasFilterButton ? '✅' : '❌');
    
    await page.screenshot({ path: 'leads-list.png' });
    
    // Test Add Lead functionality
    if (hasAddLeadButton) {
      console.log('\n7. Testing Add Lead...');
      await addLeadButton.click();
      await page.waitForTimeout(2000);
      
      // Check if modal or new page opened
      const addLeadUrl = page.url();
      if (addLeadUrl.includes('new')) {
        console.log('✅ Navigated to add lead page');
      } else {
        // Check for modal
        const modal = await page.locator('[role="dialog"], .modal').first();
        const hasModal = await modal.isVisible();
        console.log('Add lead modal:', hasModal ? '✅' : '❌');
      }
      
      // Look for form fields
      const emailField = await page.locator('input[name="email"], input[type="email"]').first();
      const hasEmailField = await emailField.isVisible();
      console.log('Email field:', hasEmailField ? '✅' : '❌');
      
      const nameField = await page.locator('input[name="name"], input[placeholder*="name" i]').first();
      const hasNameField = await nameField.isVisible();
      console.log('Name field:', hasNameField ? '✅' : '❌');
      
      const companyField = await page.locator('input[name="company"], input[placeholder*="company" i]').first();
      const hasCompanyField = await companyField.isVisible();
      console.log('Company field:', hasCompanyField ? '✅' : '❌');
      
      await page.screenshot({ path: 'add-lead-form.png' });
    }
    
    // Test Import functionality
    if (hasImportButton) {
      console.log('\n8. Testing Import functionality...');
      
      // Go back to leads list if needed
      await page.goto('https://www.coldcopy.cc/leads');
      await page.waitForLoadState('networkidle');
      
      await importButton.click();
      await page.waitForTimeout(2000);
      
      // Check for import interface
      const importUrl = page.url();
      if (importUrl.includes('import')) {
        console.log('✅ Navigated to import page');
      } else {
        // Check for modal
        const importModal = await page.locator('[role="dialog"], .modal').first();
        const hasImportModal = await importModal.isVisible();
        console.log('Import modal:', hasImportModal ? '✅' : '❌');
      }
      
      // Look for file upload
      const fileInput = await page.locator('input[type="file"]').first();
      const hasFileInput = await fileInput.isVisible();
      console.log('File upload input:', hasFileInput ? '✅' : '❌');
      
      // Check for CSV template download
      const templateLink = await page.locator('a:has-text("template"), button:has-text("template")').first();
      const hasTemplateLink = await templateLink.isVisible();
      console.log('CSV template link:', hasTemplateLink ? '✅' : '❌');
      
      await page.screenshot({ path: 'import-leads.png' });
    }
    
    // Check for errors
    console.log('\n9. Checking for errors...');
    const errors = await page.locator('.text-destructive, .text-red-600, [role="alert"]').all();
    if (errors.length > 0) {
      console.log('⚠️  Found error messages:');
      for (const error of errors) {
        const text = await error.textContent();
        console.log('  -', text);
      }
    } else {
      console.log('✅ No error messages found');
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    await page.screenshot({ path: 'leads-test-error.png' });
  }
  
  console.log('\n✅ Lead management test complete!');
  console.log('\nScreenshots saved. Browser will remain open for inspection.');
  console.log('Press Ctrl+C to close.\n');
  
  // Keep browser open
  await new Promise(() => {});
})();