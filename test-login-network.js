const { chromium } = require('playwright');

async function testLoginWithNetwork() {
  const browser = await chromium.launch({ 
    headless: false,
    devtools: true
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Monitor network requests
  const networkLogs = [];
  page.on('request', request => {
    if (request.url().includes('auth') || request.url().includes('login')) {
      networkLogs.push({
        method: request.method(),
        url: request.url(),
        headers: request.headers()
      });
    }
  });

  page.on('response', response => {
    if (response.url().includes('auth') || response.url().includes('login')) {
      networkLogs.push({
        status: response.status(),
        url: response.url(),
        statusText: response.statusText()
      });
    }
  });

  console.log('🔍 Testing Login with Network Monitoring...\n');

  try {
    // Navigate to login page
    console.log('1. Navigating to login page...');
    await page.goto('https://www.coldcopy.cc/login', { waitUntil: 'networkidle' });
    
    // Fill and submit form
    console.log('\n2. Filling login form...');
    await page.fill('input[type="email"]', 'jaspervanmoose@gmail.com');
    await page.fill('input[type="password"]', 'okkenbollen33');
    
    // Clear network logs before submission
    networkLogs.length = 0;
    
    // Submit form
    console.log('\n3. Submitting form...');
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    
    // Wait a bit for network activity
    await page.waitForTimeout(5000);
    
    // Print network logs
    console.log('\n📡 Network Activity:');
    networkLogs.forEach(log => {
      if (log.method) {
        console.log(`   → ${log.method} ${log.url}`);
      } else {
        console.log(`   ← ${log.status} ${log.statusText} - ${log.url}`);
      }
    });
    
    // Check current state
    const currentUrl = page.url();
    console.log(`\n4. Current URL: ${currentUrl}`);
    
    // Check for any error messages
    const errorElement = await page.locator('.text-destructive, [role="alert"], .text-red-500').first();
    if (await errorElement.count() > 0) {
      const errorText = await errorElement.textContent();
      console.log(`\n❌ Error message found: "${errorText}"`);
    }
    
    // Check if still on login page with spinner
    const spinner = await page.locator('.animate-spin').count();
    if (spinner > 0 && currentUrl.includes('/login')) {
      console.log('⚠️  Still on login page with loading spinner');
      
      // Try to find what's blocking
      const buttonText = await submitButton.textContent();
      console.log(`   Button text: "${buttonText}"`);
    }
    
    // Try direct navigation to dashboard to test middleware
    console.log('\n5. Testing direct dashboard access...');
    await page.goto('https://www.coldcopy.cc/dashboard');
    await page.waitForLoadState('networkidle');
    
    const dashboardUrl = page.url();
    if (dashboardUrl.includes('/login')) {
      console.log('   ❌ Redirected back to login - not authenticated');
    } else if (dashboardUrl.includes('/dashboard')) {
      console.log('   ✅ Successfully accessed dashboard!');
    }

  } catch (error) {
    console.error('\n❌ Test error:', error.message);
  } finally {
    console.log('\n⏸️  Keeping browser open for inspection...');
    await page.waitForTimeout(30000);
    await browser.close();
  }
}

testLoginWithNetwork();