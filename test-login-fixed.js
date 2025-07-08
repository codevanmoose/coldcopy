const { chromium } = require('playwright');

async function testLoginFixed() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('🔍 Testing Fixed Login...\n');

  try {
    // Navigate to login page
    console.log('1. Navigating to login page...');
    await page.goto('https://www.coldcopy.cc/login', { waitUntil: 'networkidle' });
    
    // Fill and submit form
    console.log('2. Filling login form...');
    await page.fill('input[type="email"]', 'jaspervanmoose@gmail.com');
    await page.fill('input[type="password"]', 'okkenbollen33');
    
    // Submit form
    console.log('3. Submitting form...');
    await page.click('button[type="submit"]');
    
    // Wait for navigation
    console.log('4. Waiting for redirect...');
    
    try {
      await page.waitForURL('**/dashboard', { timeout: 10000 });
      console.log('✅ Successfully redirected to dashboard!');
      
      const welcomeText = await page.locator('h1').first().textContent();
      console.log(`   Dashboard loaded: "${welcomeText}"`);
      
      // Test session persistence
      console.log('\n5. Testing page refresh...');
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      const urlAfterReload = page.url();
      if (urlAfterReload.includes('/dashboard')) {
        console.log('✅ Session persisted after reload');
      } else {
        console.log('❌ Session lost after reload');
      }
      
    } catch (error) {
      console.log('❌ Login redirect failed');
      console.log('   Current URL:', page.url());
      
      // Check for errors
      const errorElement = await page.locator('.text-destructive, [role="alert"]').first();
      if (await errorElement.count() > 0) {
        const errorText = await errorElement.textContent();
        console.log(`   Error: "${errorText}"`);
      }
    }

  } catch (error) {
    console.error('❌ Test error:', error.message);
  } finally {
    await browser.close();
  }
}

testLoginFixed();