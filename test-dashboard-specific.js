const { chromium } = require('playwright');

// Test configuration
const BASE_URL = 'https://coldcopy.cc';
const ADMIN_EMAIL = 'jaspervanmoose@gmail.com';
const ADMIN_PASSWORD = 'ColdCopy2025!';

async function testDashboardFeatures() {
  const browser = await chromium.launch({ 
    headless: false, // Show browser for debugging
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();
  
  console.log('🔍 Testing Dashboard Features in Detail...\n');
  
  try {
    // Login first
    console.log('📝 Logging in...');
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');
    
    // Fill login form
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    
    // Wait for navigation
    await page.waitForURL(/dashboard|campaigns|leads/, { timeout: 10000 });
    console.log('✅ Logged in successfully!\n');
    
    // Take screenshot of current page
    await page.screenshot({ path: 'dashboard-screenshot.png' });
    console.log('📸 Screenshot saved as dashboard-screenshot.png\n');
    
    // Test Dashboard Overview (Story 9)
    console.log('🔍 Testing Dashboard Overview...');
    const pageContent = await page.textContent('body');
    console.log('Page URL:', page.url());
    
    // Look for dashboard statistics
    const statsKeywords = ['leads', 'campaigns', 'emails', 'reply', 'total', 'active'];
    const foundStats = statsKeywords.filter(keyword => 
      pageContent.toLowerCase().includes(keyword)
    );
    console.log('Found stats keywords:', foundStats);
    
    // Test Quick Actions (Story 10)
    console.log('\n🔍 Testing Quick Actions...');
    const buttons = await page.$$eval('button, a[role="button"]', elements => 
      elements.map(el => el.textContent.trim()).filter(text => text.length > 0)
    );
    console.log('Found buttons:', buttons.slice(0, 10)); // First 10 buttons
    
    // Test Sidebar Navigation (Story 11)
    console.log('\n🔍 Testing Sidebar Navigation...');
    const navItems = await page.$$eval('nav a, aside a, [role="navigation"] a', elements => 
      elements.map(el => el.textContent.trim()).filter(text => text.length > 0)
    );
    console.log('Found navigation items:', navItems);
    
    // Check for specific navigation items
    const expectedNavItems = ['Dashboard', 'Campaigns', 'Leads', 'Templates', 'Inbox', 'Analytics', 'Settings'];
    const foundNavItems = expectedNavItems.filter(item => 
      navItems.some(nav => nav.toLowerCase().includes(item.toLowerCase()))
    );
    console.log('Found expected nav items:', foundNavItems);
    
    // Try to navigate to different sections
    console.log('\n🔍 Testing Navigation Links...');
    
    // Try Campaigns
    try {
      const campaignsLink = await page.$('a:has-text("Campaigns"), nav :text("Campaigns")');
      if (campaignsLink) {
        await campaignsLink.click();
        await page.waitForTimeout(2000);
        console.log('✅ Navigated to:', page.url());
      }
    } catch (e) {
      console.log('⚠️ Could not navigate to Campaigns');
    }
    
    // Try Leads
    try {
      const leadsLink = await page.$('a:has-text("Leads"), nav :text("Leads")');
      if (leadsLink) {
        await leadsLink.click();
        await page.waitForTimeout(2000);
        console.log('✅ Navigated to:', page.url());
      }
    } catch (e) {
      console.log('⚠️ Could not navigate to Leads');
    }
    
    // Check page structure
    console.log('\n🔍 Analyzing Page Structure...');
    const hasHeader = await page.$('header');
    const hasSidebar = await page.$('aside, nav[class*="sidebar"], div[class*="sidebar"]');
    const hasMainContent = await page.$('main, div[class*="content"], div[class*="main"]');
    
    console.log('Has header:', !!hasHeader);
    console.log('Has sidebar:', !!hasSidebar);
    console.log('Has main content:', !!hasMainContent);
    
    // Final summary
    console.log('\n📊 DASHBOARD TEST SUMMARY:');
    console.log('- Dashboard Overview:', foundStats.length >= 3 ? '✅ PASS' : '❌ FAIL');
    console.log('- Quick Actions:', buttons.length >= 2 ? '✅ PASS' : '❌ FAIL');
    console.log('- Sidebar Navigation:', foundNavItems.length >= 5 ? '✅ PASS' : '❌ FAIL');
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  } finally {
    // Keep browser open for 5 seconds to see the page
    await page.waitForTimeout(5000);
    await browser.close();
  }
}

// Run the test
testDashboardFeatures().catch(console.error);