const { chromium } = require('playwright');

async function debugApiIssues() {
  console.log('🔍 Debugging API authentication issues...');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Track API calls
  const apiCalls = [];
  page.on('response', response => {
    if (response.url().includes('/api/')) {
      apiCalls.push({
        url: response.url(),
        status: response.status()
      });
    }
  });
  
  try {
    console.log('📋 Logging in...');
    await page.goto('https://www.coldcopy.cc/login');
    await page.fill('input[type="email"]', 'jaspervanmoose@gmail.com');
    await page.fill('input[type="password"]', 'ColdCopy2025!');
    await page.click('button[type="submit"]');
    
    // Wait for dashboard
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    console.log('✅ Login successful');
    
    // Test API calls with browser session
    console.log('\n🔍 Testing API calls with authenticated session:');
    
    const endpointsToTest = [
      '/api/workspaces',
      '/api/leads',
      '/api/campaigns', 
      '/api/templates'
    ];
    
    for (const endpoint of endpointsToTest) {
      try {
        console.log(`\n📋 Testing ${endpoint}:`);
        
        const response = await page.request.get(`https://www.coldcopy.cc${endpoint}`);
        console.log(`Status: ${response.status()}`);
        
        if (response.status() === 200) {
          try {
            const data = await response.json();
            console.log(`✅ Success - returned keys: ${Object.keys(data).join(', ')}`);
            if (Array.isArray(data.leads)) console.log(`   Leads count: ${data.leads.length}`);
            if (Array.isArray(data.campaigns)) console.log(`   Campaigns count: ${data.campaigns.length}`);
            if (Array.isArray(data.templates)) console.log(`   Templates count: ${data.templates.length}`);
          } catch (e) {
            console.log(`✅ Success - non-JSON response`);
          }
        } else {
          const text = await response.text();
          console.log(`❌ Error - ${text.substring(0, 200)}`);
        }
      } catch (error) {
        console.log(`❌ Request failed: ${error.message}`);
      }
    }
    
    // Check specific pages
    console.log('\n🔍 Testing page navigation:');
    
    const pagesToTest = [
      { url: '/leads', name: 'Leads' },
      { url: '/campaigns', name: 'Campaigns' }
    ];
    
    for (const pageInfo of pagesToTest) {
      try {
        console.log(`\n📋 Navigating to ${pageInfo.name} page...`);
        
        // Clear previous API calls
        apiCalls.length = 0;
        
        await page.goto(`https://www.coldcopy.cc${pageInfo.url}`);
        await page.waitForTimeout(5000); // Wait for page to load
        
        console.log(`Current URL: ${page.url()}`);
        
        // Check if page loaded properly
        const title = await page.title();
        console.log(`Page title: ${title}`);
        
        // Check for any error messages
        const errorElements = await page.$$('text=/error|Error|failed|Failed/i');
        if (errorElements.length > 0) {
          console.log(`❌ Found ${errorElements.length} error elements on page`);
        } else {
          console.log(`✅ No obvious error messages found`);
        }
        
        // Show API calls made during page load
        console.log('API calls during page load:');
        apiCalls.forEach(call => {
          console.log(`  ${call.status} ${call.url}`);
        });
        
      } catch (error) {
        console.log(`❌ Page navigation failed: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    await browser.close();
  }
}

debugApiIssues();