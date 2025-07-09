const { chromium } = require('playwright');

// Test configuration
const BASE_URL = 'https://coldcopy.cc';
const ADMIN_EMAIL = 'jaspervanmoose@gmail.com';
const ADMIN_PASSWORD = 'ColdCopy2025!';

async function testDashboardInDetail() {
  const browser = await chromium.launch({ 
    headless: false, // Show browser
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();
  
  console.log('🔍 Detailed Dashboard Test...\n');
  
  try {
    // Login
    console.log('📝 Logging in...');
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    
    // Wait for navigation with longer timeout
    await page.waitForURL(/dashboard|campaigns|leads/, { timeout: 30000 });
    console.log('✅ Logged in successfully!');
    console.log('Current URL:', page.url());
    
    // Wait for content to load
    console.log('\n⏳ Waiting for dashboard content...');
    await page.waitForTimeout(5000); // Give it 5 seconds to load
    
    // Take screenshot
    await page.screenshot({ path: 'dashboard-test-screenshot.png', fullPage: true });
    console.log('📸 Screenshot saved\n');
    
    // Get page HTML
    const pageHtml = await page.content();
    console.log('Page HTML length:', pageHtml.length);
    
    // Check for loading spinner
    const hasSpinner = await page.$('.animate-spin, [class*="loading"], [class*="spinner"]');
    console.log('Has loading spinner:', !!hasSpinner);
    
    // Check for error messages
    const errorText = await page.textContent('body');
    if (errorText.includes('error') || errorText.includes('Error')) {
      console.log('⚠️  Page contains error text');
    }
    
    // Test specific dashboard elements
    console.log('\n🔍 Testing Dashboard Elements:');
    
    // 1. Stats cards
    const statsCards = await page.$$('h3, .text-2xl, [class*="stat"], [class*="card"]');
    console.log(`Found ${statsCards.length} potential stat cards`);
    
    // 2. Quick action buttons
    const quickActions = await page.$$('a[href="/campaigns/new"], a[href="/leads"], a[href="/templates"], a[href="/analytics"]');
    console.log(`Found ${quickActions.length} quick action links`);
    
    // 3. Sidebar navigation
    const sidebarLinks = await page.$$('nav a, aside a, [class*="sidebar"] a');
    console.log(`Found ${sidebarLinks.length} sidebar links`);
    
    // Try to find specific text
    const texts = ['Dashboard', 'Campaigns', 'Leads', 'Templates', 'Total Leads', 'Create Campaign'];
    for (const text of texts) {
      const element = await page.$(`text=${text}`);
      console.log(`Text "${text}":`, element ? '✅ Found' : '❌ Not found');
    }
    
    // Check network requests
    console.log('\n🌐 Checking API calls...');
    page.on('response', response => {
      if (response.url().includes('/api/')) {
        console.log(`API Response: ${response.url()} - ${response.status()}`);
      }
    });
    
    // Reload to capture API calls
    await page.reload();
    await page.waitForTimeout(3000);
    
    // Final assessment
    console.log('\n📊 DASHBOARD TEST RESULTS:');
    console.log('- Page loads:', '✅');
    console.log('- Stats cards:', statsCards.length > 0 ? '✅' : '❌');
    console.log('- Quick actions:', quickActions.length >= 4 ? '✅' : '❌');
    console.log('- Sidebar nav:', sidebarLinks.length >= 5 ? '✅' : '❌');
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  } finally {
    await page.waitForTimeout(5000); // Keep browser open
    await browser.close();
  }
}

testDashboardInDetail().catch(console.error);