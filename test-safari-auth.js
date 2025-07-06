const { chromium, webkit, firefox } = require('playwright');

async function testAuthFlow(browserType, browserName) {
  console.log(`\n🧪 Testing ${browserName}...`);
  
  const browser = await browserType.launch({ 
    headless: false,
    devtools: true 
  });
  const context = await browser.newContext({
    // Enable detailed cookie logging
    recordHar: { path: `${browserName}-auth.har` }
  });
  
  // Log all cookies
  context.on('response', async response => {
    const cookies = await context.cookies();
    if (response.url().includes('supabase') || response.url().includes('auth')) {
      console.log(`${browserName} - Response: ${response.url()}`);
      console.log(`${browserName} - Status: ${response.status()}`);
      console.log(`${browserName} - Cookies:`, cookies.filter(c => c.name.includes('auth')));
    }
  });

  const page = await context.newPage();
  
  try {
    // Enable console logging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`${browserName} Console Error:`, msg.text());
      }
    });
    
    // Navigate to login page
    console.log(`${browserName}: Navigating to login page...`);
    await page.goto('https://www.coldcopy.cc/login', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    // Check if redirected to dashboard
    const currentUrl = page.url();
    console.log(`${browserName}: Current URL after navigation: ${currentUrl}`);
    
    if (currentUrl.includes('/dashboard')) {
      console.log(`${browserName}: ⚠️  Redirected to dashboard immediately!`);
      
      // Check for auth session
      const cookies = await context.cookies();
      const authCookies = cookies.filter(c => 
        c.name.includes('auth-token') || 
        c.name.includes('sb-') ||
        c.name.includes('supabase')
      );
      
      console.log(`${browserName}: Auth cookies found:`, authCookies.map(c => ({
        name: c.name,
        domain: c.domain,
        secure: c.secure,
        sameSite: c.sameSite,
        httpOnly: c.httpOnly
      })));
      
      // Try to get session info via console
      const sessionInfo = await page.evaluate(async () => {
        try {
          // Check localStorage
          const localStorage = {};
          for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i);
            if (key && key.includes('supabase')) {
              localStorage[key] = window.localStorage.getItem(key);
            }
          }
          
          // Check sessionStorage
          const sessionStorage = {};
          for (let i = 0; i < window.sessionStorage.length; i++) {
            const key = window.sessionStorage.key(i);
            if (key && key.includes('supabase')) {
              sessionStorage[key] = window.sessionStorage.getItem(key);
            }
          }
          
          return {
            localStorage,
            sessionStorage,
            cookies: document.cookie
          };
        } catch (e) {
          return { error: e.message };
        }
      });
      
      console.log(`${browserName}: Session storage info:`, sessionInfo);
      
    } else {
      console.log(`${browserName}: ✅ Stayed on login page as expected`);
      
      // Test actual login
      console.log(`${browserName}: Testing login flow...`);
      
      // Fill in credentials
      await page.fill('input[type="email"]', 'jaspervanmoose@gmail.com');
      await page.fill('input[type="password"]', 'okkenbollen33');
      
      // Click login button
      await page.click('button[type="submit"]');
      
      // Wait for navigation
      await page.waitForNavigation({ 
        waitUntil: 'networkidle',
        timeout: 30000 
      }).catch(e => console.log(`${browserName}: Navigation timeout`));
      
      const afterLoginUrl = page.url();
      console.log(`${browserName}: URL after login: ${afterLoginUrl}`);
      
      if (afterLoginUrl.includes('/dashboard')) {
        console.log(`${browserName}: ✅ Successfully logged in and redirected to dashboard`);
      } else {
        console.log(`${browserName}: ❌ Login failed or unexpected redirect`);
      }
    }
    
    // Take screenshot for debugging
    await page.screenshot({ 
      path: `${browserName}-auth-test.png`,
      fullPage: true 
    });
    
  } catch (error) {
    console.error(`${browserName} Error:`, error);
    await page.screenshot({ 
      path: `${browserName}-error.png`,
      fullPage: true 
    });
  } finally {
    // Wait a bit to observe
    await new Promise(resolve => setTimeout(resolve, 3000));
    await browser.close();
  }
}

async function runTests() {
  console.log('🔍 Testing authentication behavior across browsers...\n');
  
  // Test each browser
  await testAuthFlow(webkit, 'Safari/WebKit');
  await testAuthFlow(firefox, 'Firefox');
  await testAuthFlow(chromium, 'Chrome');
  
  console.log('\n✅ Tests complete! Check the screenshots and HAR files for details.');
}

runTests().catch(console.error);