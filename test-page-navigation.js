// Test page navigation issues after login
const { chromium } = require('playwright');

(async () => {
  console.log('🔍 Testing page navigation after login...');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Listen to console logs and network
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`[Browser Error]:`, msg.text());
    }
  });
  
  page.on('requestfailed', request => {
    console.log(`[Network Failed]:`, request.url(), request.failure().errorText);
  });
  
  try {
    // Step 1: Login first
    console.log('📋 Step 1: Logging in...');
    await page.goto('https://coldcopy.cc/login');
    await page.waitForSelector('input[type="email"]');
    await page.fill('input[type="email"]', 'jaspervanmoose@gmail.com');
    await page.fill('input[type="password"]', 'ColdCopyAdmin2024!');
    await page.click('button[type="submit"]');
    
    // Wait for dashboard
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    console.log('✅ Successfully logged in');
    
    // Step 2: Test each page navigation
    const pagesToTest = [
      { name: 'Leads', url: '/leads' },
      { name: 'Campaigns', url: '/campaigns' }, 
      { name: 'Templates', url: '/templates' },
      { name: 'Settings', url: '/settings' }
    ];
    
    for (const pageTest of pagesToTest) {
      console.log(`📋 Testing: ${pageTest.name} page...`);
      
      try {
        await page.goto(`https://coldcopy.cc${pageTest.url}`);
        
        // Wait a moment for page load
        await page.waitForTimeout(3000);
        
        // Check page title
        const title = await page.title();
        console.log(`Page title: ${title}`);
        
        // Check for any content
        const hasContent = await page.locator('main, .content, h1, h2').count() > 0;
        
        if (hasContent) {
          console.log(`✅ ${pageTest.name} page has content`);
          
          // Check for loading states
          const hasLoading = await page.locator('.loading, .animate-spin').count() > 0;
          if (hasLoading) {
            console.log(`🔄 ${pageTest.name} page is still loading...`);
            await page.waitForTimeout(5000);
          }
          
          // Check for specific page elements
          const pageText = await page.locator('body').textContent();
          if (pageText.includes('404') || pageText.includes('Not Found')) {
            console.log(`❌ ${pageTest.name} page shows 404 error`);
          } else if (pageText.includes('Error') || pageText.includes('Failed')) {
            console.log(`❌ ${pageTest.name} page shows error`);
          } else {
            console.log(`✅ ${pageTest.name} page loaded successfully`);
          }
          
        } else {
          console.log(`❌ ${pageTest.name} page has no content`);
        }
        
      } catch (error) {
        console.log(`❌ ${pageTest.name} page failed:`, error.message);
      }
      
      // Add delay between tests
      await page.waitForTimeout(1000);
    }
    
  } catch (error) {
    console.error('❌ Navigation test failed:', error.message);
  } finally {
    await page.waitForTimeout(2000);
    await browser.close();
  }
})();