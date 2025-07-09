const { chromium } = require('playwright');

const BASE_URL = 'https://coldcopy.cc';
const ADMIN_EMAIL = 'jaspervanmoose@gmail.com';
const ADMIN_PASSWORD = 'ColdCopy2025!';

async function testDashboardHeadless() {
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();
  
  console.log('🔍 Testing Dashboard with Fixed Selectors...\n');
  
  try {
    // Login
    console.log('📝 Logging in...');
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    
    // Wait for dashboard with longer timeout
    await page.waitForURL(/dashboard/, { timeout: 30000 });
    console.log('✅ Logged in to dashboard');
    
    // Wait for React to render
    await page.waitForTimeout(5000);
    
    // Test with actual content from the screenshot
    console.log('\n📊 Testing Dashboard Elements:');
    
    // Story 9: Dashboard Overview - Look for actual text
    const dashboardText = await page.textContent('body');
    const hasWelcomeText = dashboardText.includes('Welcome back') || dashboardText.includes('overview');
    console.log('Story 9 - Dashboard Overview:', hasWelcomeText ? '✅ PASS' : '❌ FAIL');
    
    // Story 10: Quick Actions - Look for action card text
    const hasCreateCampaign = dashboardText.includes('Create Campaign') || dashboardText.includes('Start a new email');
    const hasAddLeads = dashboardText.includes('Add Leads') || dashboardText.includes('Import or add');
    const hasActions = hasCreateCampaign || hasAddLeads;
    console.log('Story 10 - Quick Actions:', hasActions ? '✅ PASS' : '❌ FAIL');
    
    // Story 11: Sidebar Navigation - Look for nav text
    const hasInbox = dashboardText.includes('Inbox');
    const hasCampaigns = dashboardText.includes('Campaigns');
    const hasTemplates = dashboardText.includes('Templates');
    const hasNav = hasInbox && hasCampaigns && hasTemplates;
    console.log('Story 11 - Sidebar Navigation:', hasNav ? '✅ PASS' : '❌ FAIL');
    
    // Count passes
    const passes = [hasWelcomeText, hasActions, hasNav].filter(x => x).length;
    console.log(`\n✅ Dashboard Tests: ${passes}/3 passed`);
    
    if (passes === 3) {
      console.log('🎉 ALL DASHBOARD TESTS PASSED!');
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  } finally {
    await browser.close();
  }
}

testDashboardHeadless().catch(console.error);