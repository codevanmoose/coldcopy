const { chromium } = require('playwright');

async function testLeadCreation() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Monitor API calls
  page.on('response', response => {
    if (response.url().includes('/api/')) {
      console.log(`API: ${response.status()} ${response.url()}`);
    }
  });

  console.log('🔍 Testing Lead Creation...\n');

  try {
    // Login
    console.log('1. Logging in...');
    await page.goto('https://www.coldcopy.cc/login');
    await page.fill('input[type="email"]', 'jaspervanmoose@gmail.com');
    await page.fill('input[type="password"]', 'okkenbollen33');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    console.log('✅ Logged in successfully');

    // Navigate to leads - try direct navigation
    console.log('\n2. Navigating to Leads page...');
    await page.goto('https://www.coldcopy.cc/leads');
    await page.waitForLoadState('networkidle');
    
    // Check if we're on the leads page
    const pageTitle = await page.textContent('h1').catch(() => '');
    if (pageTitle.toLowerCase().includes('lead')) {
      console.log('✅ On Leads page');
    } else {
      console.log('⚠️  Page title:', pageTitle);
    }

    // Look for Add Lead button
    console.log('\n3. Looking for Add Lead button...');
    await page.waitForTimeout(2000); // Wait for page to fully load
    
    // Try to find the button by text
    const addButton = await page.getByRole('button', { name: /add lead/i }).first();
    if (await addButton.isVisible()) {
      console.log('✅ Found Add Lead button');
      
      // Click it
      await addButton.click();
      console.log('✅ Clicked Add Lead button');
      
      // Wait for form/modal
      await page.waitForTimeout(2000);
      
      // Look for email input
      const emailInput = await page.locator('input[type="email"]').nth(1); // Skip login email
      if (await emailInput.isVisible()) {
        console.log('✅ Lead form opened');
        
        // Fill form
        console.log('\n4. Filling lead form...');
        await emailInput.fill('test@example.com');
        
        // Try to find name input
        const nameInputs = await page.locator('input[placeholder*="name" i], input[name*="name" i]').all();
        for (const input of nameInputs) {
          const placeholder = await input.getAttribute('placeholder') || '';
          const name = await input.getAttribute('name') || '';
          console.log(`   Found input: ${name} (${placeholder})`);
          
          if (placeholder.toLowerCase().includes('first') || name.toLowerCase().includes('first')) {
            await input.fill('Test');
          } else if (placeholder.toLowerCase().includes('last') || name.toLowerCase().includes('last')) {
            await input.fill('Lead');
          }
        }
        
        // Company input
        const companyInput = await page.locator('input[placeholder*="company" i], input[name="company"]').first();
        if (await companyInput.isVisible()) {
          await companyInput.fill('Test Company');
        }
        
        // Submit
        console.log('\n5. Submitting form...');
        const submitButton = await page.getByRole('button', { name: /save|add|create/i }).last();
        await submitButton.click();
        
        // Wait for response
        await page.waitForTimeout(3000);
        
        // Check for success or error
        const toastMessage = await page.locator('[role="alert"], .sonner-toast').first().textContent().catch(() => '');
        if (toastMessage) {
          console.log(`📢 Toast message: "${toastMessage}"`);
        }
        
        // Check if lead was added to table
        const tableRows = await page.locator('table tbody tr').count();
        console.log(`📊 Table now has ${tableRows} rows`);
      }
    } else {
      console.log('❌ Could not find Add Lead button');
      // Take screenshot
      await page.screenshot({ path: 'leads-page-debug.png' });
    }

  } catch (error) {
    console.error('❌ Test error:', error.message);
    await page.screenshot({ path: 'error-screenshot.png' });
  } finally {
    console.log('\n✅ Test completed. Browser closing...');
    await page.waitForTimeout(5000);
    await browser.close();
  }
}

testLeadCreation();