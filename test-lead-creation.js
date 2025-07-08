const { chromium } = require('playwright');

async function testLeadCreation() {
  const browser = await chromium.launch({ headless: false, devtools: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Monitor network for API calls
  page.on('response', response => {
    if (response.url().includes('/api/leads')) {
      console.log(`API Response: ${response.status()} ${response.statusText()} - ${response.url()}`);
    }
  });

  console.log('🔍 Testing Lead Creation...\n');

  try {
    // Login first
    console.log('1. Logging in...');
    await page.goto('https://www.coldcopy.cc/login');
    await page.fill('input[type="email"]', 'jaspervanmoose@gmail.com');
    await page.fill('input[type="password"]', 'okkenbollen33');
    await page.click('button[type="submit"]');
    
    // Wait for dashboard
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    console.log('✅ Logged in successfully');

    // Navigate to leads page
    console.log('\n2. Navigating to Leads page...');
    await page.click('a[href="/leads"]');
    await page.waitForLoadState('networkidle');
    console.log('✅ On Leads page');

    // Try to find and click "Add Lead" button
    console.log('\n3. Looking for Add Lead button...');
    
    // Try different selectors
    const addLeadButton = await page.locator('button:has-text("Add Lead"), button:has-text("New Lead"), button:has-text("Create Lead"), button:has-text("+")').first();
    
    if (await addLeadButton.count() > 0) {
      console.log('✅ Found Add Lead button');
      await addLeadButton.click();
      
      // Wait for modal or form
      await page.waitForTimeout(2000);
      
      // Check if a form appeared
      const emailInput = await page.locator('input[name="email"], input[placeholder*="email"]').first();
      if (await emailInput.count() > 0) {
        console.log('✅ Lead form opened');
        
        // Fill the form
        console.log('\n4. Filling lead form...');
        await emailInput.fill('test@example.com');
        
        const nameInput = await page.locator('input[name="name"], input[placeholder*="name"]').first();
        if (await nameInput.count() > 0) {
          await nameInput.fill('Test Lead');
        }
        
        const companyInput = await page.locator('input[name="company"], input[placeholder*="company"]').first();
        if (await companyInput.count() > 0) {
          await companyInput.fill('Test Company');
        }
        
        // Submit the form
        console.log('\n5. Submitting form...');
        const submitButton = await page.locator('button[type="submit"], button:has-text("Save"), button:has-text("Add"), button:has-text("Create")').last();
        await submitButton.click();
        
        // Wait for response
        await page.waitForTimeout(3000);
        
        // Check for errors
        const errorMessage = await page.locator('.text-destructive, [role="alert"], .text-red-500').first();
        if (await errorMessage.count() > 0) {
          const error = await errorMessage.textContent();
          console.log(`❌ Error: ${error}`);
        }
      }
    } else {
      console.log('❌ Could not find Add Lead button');
      
      // Take screenshot for debugging
      await page.screenshot({ path: 'leads-page.png' });
      console.log('   Screenshot saved as leads-page.png');
    }

  } catch (error) {
    console.error('❌ Test error:', error.message);
  } finally {
    console.log('\n⏸️  Keeping browser open for inspection...');
    await page.waitForTimeout(30000);
    await browser.close();
  }
}

testLeadCreation();