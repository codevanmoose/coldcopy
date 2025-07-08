const { chromium } = require('playwright');

async function testLogin() {
  const browser = await chromium.launch({ 
    headless: false,
    devtools: true // Open devtools to see console errors
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture console messages
  const consoleMessages = [];
  page.on('console', (msg) => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text()
    });
  });

  // Capture network failures
  page.on('requestfailed', request => {
    console.log(`❌ Request failed: ${request.url()} - ${request.failure().errorText}`);
  });

  console.log('🔍 Testing Login with Console Monitoring...\n');

  try {
    // Navigate to login page
    console.log('1. Navigating to login page...');
    await page.goto('https://www.coldcopy.cc/login', { waitUntil: 'networkidle' });
    
    // Print any console errors
    const errors = consoleMessages.filter(msg => msg.type === 'error');
    if (errors.length > 0) {
      console.log('⚠️  Console errors found:');
      errors.forEach(err => console.log(`   - ${err.text}`));
    }

    // Check for login form
    const emailInput = await page.locator('input[type="email"]').count();
    const passwordInput = await page.locator('input[type="password"]').count();
    
    if (emailInput === 0 || passwordInput === 0) {
      console.log('❌ Login form not found!');
      return;
    }

    console.log('✅ Login form found');

    // Fill credentials
    console.log('\n2. Entering credentials...');
    await page.fill('input[type="email"]', 'jaspervanmoose@gmail.com');
    await page.fill('input[type="password"]', 'okkenbollen33');
    
    // Take screenshot before submitting
    await page.screenshot({ path: 'before-login.png' });
    
    // Submit form
    console.log('\n3. Submitting form...');
    
    // Try different methods to submit
    const submitButton = page.locator('button[type="submit"]');
    if (await submitButton.count() > 0) {
      await submitButton.click();
    } else {
      // Try pressing Enter
      await page.keyboard.press('Enter');
    }

    // Wait for response
    console.log('\n4. Waiting for response...');
    
    // Wait for either navigation or error message
    const result = await Promise.race([
      page.waitForURL('**/dashboard', { timeout: 15000 }).then(() => 'dashboard'),
      page.waitForSelector('.text-destructive, [role="alert"], .text-red-500', { timeout: 15000 }).then(() => 'error'),
      page.waitForTimeout(15000).then(() => 'timeout')
    ]);

    // Take screenshot after action
    await page.screenshot({ path: 'after-login.png' });

    // Check result
    if (result === 'dashboard') {
      console.log('✅ Successfully logged in!');
      const currentUrl = page.url();
      console.log(`   Current URL: ${currentUrl}`);
    } else if (result === 'error') {
      const errorText = await page.locator('.text-destructive, [role="alert"], .text-red-500').first().textContent();
      console.log(`❌ Login failed with error: ${errorText}`);
    } else {
      console.log('❌ Login timeout - no response after 15 seconds');
      console.log(`   Current URL: ${page.url()}`);
      
      // Check for loading spinners
      const spinner = await page.locator('.animate-spin').count();
      if (spinner > 0) {
        console.log('   ⚠️  Loading spinner still active');
      }
    }

    // Print all console messages at the end
    console.log('\n📋 All console messages:');
    consoleMessages.forEach(msg => {
      console.log(`   [${msg.type}] ${msg.text}`);
    });

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
  } finally {
    // Keep browser open for manual inspection
    console.log('\n⏸️  Browser will stay open for 30 seconds for inspection...');
    await page.waitForTimeout(30000);
    await browser.close();
  }
}

// Run the test
testLogin();