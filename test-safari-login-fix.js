const { chromium, webkit, firefox } = require('playwright');

// Test configuration
const TEST_URL = 'https://www.coldcopy.cc';
const TEST_EMAIL = 'jaspervanmoose@gmail.com';
const TEST_PASSWORD = process.env.COLDCOPY_PASSWORD || 'your-password-here';

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

async function testSafariLogin() {
  console.log(`${colors.blue}🧪 Testing Safari Login Fix${colors.reset}\n`);
  
  // Test browsers
  const browsers = [
    { name: 'Safari (WebKit)', browser: webkit },
    { name: 'Chrome', browser: chromium },
    { name: 'Firefox', browser: firefox }
  ];
  
  const results = [];
  
  for (const { name, browser } of browsers) {
    console.log(`${colors.yellow}Testing ${name}...${colors.reset}`);
    
    const context = await browser.launch({ 
      headless: false,
      slowMo: 100 // Slow down for visual debugging
    });
    const page = await context.newPage();
    
    try {
      // Set viewport
      await page.setViewportSize({ width: 1280, height: 720 });
      
      // Go to login page
      console.log('  → Navigating to login page...');
      await page.goto(`${TEST_URL}/login`, { waitUntil: 'networkidle' });
      
      // Check if already logged in (redirected to dashboard)
      const currentUrl = page.url();
      if (currentUrl.includes('/dashboard')) {
        console.log(`  ${colors.yellow}⚠️  Already logged in, logging out first...${colors.reset}`);
        
        // Logout
        await page.click('[data-testid="profile-button"]').catch(() => {
          // Try alternative selector
          return page.click('button:has-text("Profile")').catch(() => {
            return page.click('img[alt*="Profile"]').catch(() => null);
          });
        });
        
        await page.click('text=Logout');
        await page.waitForURL('**/login', { timeout: 5000 }).catch(() => {});
      }
      
      // Wait for login form to be visible
      console.log('  → Waiting for login form...');
      await page.waitForSelector('input[type="email"]', { timeout: 10000 });
      
      // Fill login form
      console.log('  → Filling login form...');
      await page.fill('input[type="email"]', TEST_EMAIL);
      await page.fill('input[type="password"]', TEST_PASSWORD);
      
      // Click login button
      console.log('  → Clicking login button...');
      await page.click('button[type="submit"]');
      
      // Wait for navigation
      console.log('  → Waiting for dashboard redirect...');
      const loginSuccess = await Promise.race([
        page.waitForURL('**/dashboard', { timeout: 10000 }).then(() => true),
        page.waitForSelector('text=Invalid login credentials', { timeout: 10000 }).then(() => false)
      ]).catch(() => false);
      
      if (loginSuccess) {
        console.log(`  ${colors.green}✅ Login successful!${colors.reset}`);
        
        // Verify dashboard loads
        await page.waitForSelector('text=Dashboard', { timeout: 5000 });
        console.log(`  ${colors.green}✅ Dashboard loaded successfully${colors.reset}`);
        
        results.push({ browser: name, success: true });
      } else {
        console.log(`  ${colors.red}❌ Login failed${colors.reset}`);
        
        // Check for error messages
        const errorText = await page.textContent('body').catch(() => '');
        if (errorText.includes('Invalid login credentials')) {
          console.log(`  ${colors.red}   Error: Invalid credentials${colors.reset}`);
        } else {
          console.log(`  ${colors.red}   Error: Unknown login issue${colors.reset}`);
        }
        
        results.push({ browser: name, success: false });
      }
      
    } catch (error) {
      console.log(`  ${colors.red}❌ Test failed: ${error.message}${colors.reset}`);
      results.push({ browser: name, success: false, error: error.message });
    }
    
    // Take screenshot
    await page.screenshot({ 
      path: `safari-login-test-${name.toLowerCase().replace(/[^a-z]/g, '-')}.png` 
    });
    
    await context.close();
    console.log('');
  }
  
  // Summary
  console.log(`${colors.blue}📊 Test Results:${colors.reset}`);
  console.log('=====================================');
  results.forEach(result => {
    const status = result.success ? 
      `${colors.green}✅ PASS${colors.reset}` : 
      `${colors.red}❌ FAIL${colors.reset}`;
    console.log(`${result.browser}: ${status}`);
    if (result.error) {
      console.log(`  Error: ${result.error}`);
    }
  });
  
  const safariResult = results.find(r => r.browser.includes('Safari'));
  if (safariResult && !safariResult.success) {
    console.log(`\n${colors.yellow}⚠️  Safari login issue detected!${colors.reset}`);
    console.log('Possible causes:');
    console.log('1. Cookie timing issue - fix has been deployed');
    console.log('2. Safari privacy settings blocking cookies');
    console.log('3. Incorrect password (check TEST_PASSWORD env var)');
    console.log('\nTry:');
    console.log('1. Clear Safari cookies and cache');
    console.log('2. Check Safari > Preferences > Privacy > "Prevent cross-site tracking"');
    console.log('3. Wait a few minutes for deployment to complete');
  }
}

// Run the test
testSafariLogin().catch(console.error);