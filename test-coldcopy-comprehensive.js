const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Test configuration
const TEST_CONFIG = {
  baseUrl: 'https://www.coldcopy.cc',
  adminCredentials: {
    email: 'jaspervanmoose@gmail.com',
    password: 'okkenbollen33',
  },
  testUser: {
    email: `test.${Date.now()}@example.com`,
    password: 'TestPassword123!',
    fullName: 'Test User',
    workspace: `Test Workspace ${Date.now()}`,
  },
  headless: false,
  slowMo: 200,
  timeout: 60000,
};

// Test results storage
const testResults = {
  startTime: new Date(),
  tests: [],
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
  },
  errors: [],
  warnings: [],
  performance: {},
};

// Helper functions
async function logTest(name, status, details = '') {
  const icon = status === 'passed' ? '✅' : status === 'failed' ? '❌' : '⏭️';
  const color = status === 'passed' ? colors.green : status === 'failed' ? colors.red : colors.yellow;
  
  console.log(`${color}${icon} ${name}${colors.reset} ${details ? `- ${details}` : ''}`);
  
  testResults.tests.push({
    name,
    status,
    details,
    timestamp: new Date(),
  });
  
  testResults.summary.total++;
  testResults.summary[status]++;
}

async function logSection(title) {
  console.log(`\n${colors.cyan}${colors.bright}=== ${title} ===${colors.reset}\n`);
}

async function takeScreenshot(page, name) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `screenshots/${name}-${timestamp}.png`;
  await fs.mkdir('screenshots', { recursive: true });
  await page.screenshot({ path: filename, fullPage: true });
  return filename;
}

async function checkForErrors(page) {
  const errors = [];
  
  // Check for UI error messages
  const errorElements = await page.$$('.text-destructive, .text-red-600, [role="alert"], .bg-destructive');
  for (const element of errorElements) {
    const text = await element.textContent();
    if (text) errors.push(text.trim());
  }
  
  // Check console errors
  const consoleErrors = await page.evaluate(() => window.__consoleErrors || []);
  errors.push(...consoleErrors);
  
  return errors;
}

async function measurePerformance(page) {
  return page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0];
    const paint = performance.getEntriesByType('paint');
    
    return {
      loadTime: navigation.loadEventEnd - navigation.fetchStart,
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
      firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
      firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
    };
  });
}

// Main test execution
async function runComprehensiveTests() {
  const browser = await chromium.launch({
    headless: TEST_CONFIG.headless,
    slowMo: TEST_CONFIG.slowMo,
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true,
  });
  
  const page = await context.newPage();
  
  // Inject error tracking
  await page.addInitScript(() => {
    window.__consoleErrors = [];
    const originalError = console.error;
    console.error = (...args) => {
      window.__consoleErrors.push(args.join(' '));
      originalError(...args);
    };
  });
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`${colors.red}Browser ERROR: ${msg.text()}${colors.reset}`);
    }
  });
  
  try {
    console.log(`${colors.blue}${colors.bright}🧪 COLDCOPY COMPREHENSIVE PLATFORM TEST${colors.reset}`);
    console.log(`${colors.blue}Base URL: ${TEST_CONFIG.baseUrl}${colors.reset}`);
    console.log(`${colors.blue}Started: ${testResults.startTime.toISOString()}${colors.reset}\n`);
    
    // 1. LANDING PAGE & PERFORMANCE
    await logSection('Landing Page & Performance Tests');
    
    await page.goto(TEST_CONFIG.baseUrl);
    await page.waitForLoadState('networkidle');
    
    const landingPerf = await measurePerformance(page);
    testResults.performance.landing = landingPerf;
    
    if (landingPerf.loadTime < 3000) {
      await logTest('Landing page load time', 'passed', `${landingPerf.loadTime}ms`);
    } else {
      await logTest('Landing page load time', 'failed', `${landingPerf.loadTime}ms (exceeds 3s threshold)`);
    }
    
    // Check landing page elements
    const hasHeroSection = await page.locator('h1').isVisible();
    await logTest('Landing page hero section', hasHeroSection ? 'passed' : 'failed');
    
    const hasCTA = await page.locator('a:has-text("Start"), button:has-text("Start")').first().isVisible();
    await logTest('Landing page CTA button', hasCTA ? 'passed' : 'failed');
    
    await takeScreenshot(page, 'landing-page');
    
    // 2. AUTHENTICATION TESTS
    await logSection('Authentication Tests');
    
    // Test login with admin credentials
    await page.goto(`${TEST_CONFIG.baseUrl}/login`);
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[type="email"]', TEST_CONFIG.adminCredentials.email);
    await page.fill('input[type="password"]', TEST_CONFIG.adminCredentials.password);
    await page.click('button:has-text("Sign in")');
    
    await page.waitForTimeout(5000);
    
    const afterLoginUrl = page.url();
    const loginSuccess = afterLoginUrl.includes('dashboard');
    
    await logTest('Admin login', loginSuccess ? 'passed' : 'failed', afterLoginUrl);
    
    if (!loginSuccess) {
      const loginErrors = await checkForErrors(page);
      if (loginErrors.length > 0) {
        testResults.errors.push(`Login failed: ${loginErrors.join(', ')}`);
      }
      await takeScreenshot(page, 'login-failed');
    } else {
      await takeScreenshot(page, 'dashboard-after-login');
    }
    
    // 3. DASHBOARD NAVIGATION TESTS
    if (loginSuccess) {
      await logSection('Dashboard Navigation Tests');
      
      const dashboardSections = [
        { name: 'Campaigns', path: '/campaigns' },
        { name: 'Leads', path: '/leads' },
        { name: 'Inbox', path: '/inbox' },
        { name: 'Templates', path: '/templates' },
        { name: 'Analytics', path: '/analytics' },
        { name: 'Settings', path: '/settings' },
      ];
      
      for (const section of dashboardSections) {
        try {
          await page.click(`text="${section.name}"`);
          await page.waitForLoadState('networkidle', { timeout: 10000 });
          await page.waitForTimeout(2000);
          
          const currentUrl = page.url();
          const navigationSuccess = currentUrl.includes(section.path);
          
          const errors = await checkForErrors(page);
          const hasErrors = errors.length > 0;
          
          await logTest(
            `Navigate to ${section.name}`,
            navigationSuccess && !hasErrors ? 'passed' : 'failed',
            hasErrors ? errors[0] : ''
          );
          
          if (navigationSuccess) {
            await takeScreenshot(page, `dashboard-${section.name.toLowerCase()}`);
          }
          
        } catch (error) {
          await logTest(`Navigate to ${section.name}`, 'failed', error.message);
        }
      }
      
      // 4. FEATURE TESTS
      await logSection('Feature Tests');
      
      // Test Campaigns
      await page.goto(`${TEST_CONFIG.baseUrl}/campaigns`);
      await page.waitForLoadState('networkidle');
      
      const campaignCount = await page.locator('[data-testid="campaign-card"], .campaign-item').count();
      await logTest('Campaign list display', campaignCount > 0 ? 'passed' : 'failed', `Found ${campaignCount} campaigns`);
      
      const hasNewCampaignButton = await page.locator('button:has-text("New Campaign"), a:has-text("New Campaign")').first().isVisible();
      await logTest('New Campaign button', hasNewCampaignButton ? 'passed' : 'failed');
      
      // Test Leads
      await page.goto(`${TEST_CONFIG.baseUrl}/leads`);
      await page.waitForLoadState('networkidle');
      
      const leadRows = await page.locator('tbody tr, [role="row"]').count();
      await logTest('Leads table display', leadRows > 0 ? 'passed' : 'failed', `Found ${leadRows} leads`);
      
      // Test Templates
      await page.goto(`${TEST_CONFIG.baseUrl}/templates`);
      await page.waitForLoadState('networkidle');
      
      const templateCount = await page.locator('[data-testid="template-card"], .template-item').count();
      await logTest('Templates display', templateCount > 0 ? 'passed' : 'failed', `Found ${templateCount} templates`);
      
      // 5. API HEALTH CHECKS
      await logSection('API Health Checks');
      
      const apiEndpoints = [
        '/api/health',
        '/api/test-auth',
        '/api/platform/stats',
      ];
      
      for (const endpoint of apiEndpoints) {
        const response = await page.evaluate(async (url) => {
          try {
            const res = await fetch(url);
            return { status: res.status, ok: res.ok };
          } catch (error) {
            return { status: 0, ok: false, error: error.message };
          }
        }, `${TEST_CONFIG.baseUrl}${endpoint}`);
        
        await logTest(
          `API ${endpoint}`,
          response.ok ? 'passed' : 'failed',
          `Status: ${response.status}`
        );
      }
      
      // 6. USER INTERACTION TESTS
      await logSection('User Interaction Tests');
      
      // Test user menu
      const userMenuButton = await page.locator('button:has(img[alt*="avatar"]), button[aria-label*="profile"]').first();
      if (await userMenuButton.isVisible()) {
        await userMenuButton.click();
        await page.waitForTimeout(1000);
        
        const hasLogout = await page.locator('text=/sign out|log out|logout/i').first().isVisible();
        await logTest('User menu dropdown', hasLogout ? 'passed' : 'failed');
        
        await takeScreenshot(page, 'user-menu');
      } else {
        await logTest('User menu dropdown', 'failed', 'User menu button not found');
      }
      
      // 7. ERROR HANDLING TESTS
      await logSection('Error Handling Tests');
      
      // Test 404 page
      await page.goto(`${TEST_CONFIG.baseUrl}/non-existent-page`);
      await page.waitForLoadState('networkidle');
      
      const has404 = await page.locator('text=/404|not found/i').first().isVisible();
      await logTest('404 error page', has404 ? 'passed' : 'failed');
    }
    
    // 8. PERFORMANCE SUMMARY
    await logSection('Performance Summary');
    
    console.log(`Landing Page Load: ${testResults.performance.landing?.loadTime || 'N/A'}ms`);
    console.log(`First Contentful Paint: ${testResults.performance.landing?.firstContentfulPaint || 'N/A'}ms`);
    
  } catch (error) {
    console.error(`${colors.red}Test execution failed: ${error.message}${colors.reset}`);
    testResults.errors.push(error.message);
  } finally {
    // Generate final report
    testResults.endTime = new Date();
    testResults.duration = testResults.endTime - testResults.startTime;
    
    await logSection('Test Summary');
    
    console.log(`${colors.bright}Total Tests: ${testResults.summary.total}${colors.reset}`);
    console.log(`${colors.green}✅ Passed: ${testResults.summary.passed}${colors.reset}`);
    console.log(`${colors.red}❌ Failed: ${testResults.summary.failed}${colors.reset}`);
    console.log(`${colors.yellow}⏭️  Skipped: ${testResults.summary.skipped}${colors.reset}`);
    console.log(`\nDuration: ${Math.round(testResults.duration / 1000)}s`);
    
    if (testResults.errors.length > 0) {
      console.log(`\n${colors.red}Errors:${colors.reset}`);
      testResults.errors.forEach(error => console.log(`  - ${error}`));
    }
    
    // Save detailed report
    const reportPath = `test-results/comprehensive-report-${Date.now()}.json`;
    await fs.mkdir('test-results', { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(testResults, null, 2));
    console.log(`\n${colors.blue}Detailed report saved to: ${reportPath}${colors.reset}`);
    
    // Recommendations
    if (testResults.summary.failed > 0) {
      await logSection('Recommendations');
      
      if (testResults.errors.some(e => e.includes('login') || e.includes('auth'))) {
        console.log('- Check authentication credentials and session handling');
      }
      
      if (testResults.errors.some(e => e.includes('timeout'))) {
        console.log('- Consider increasing timeouts or optimizing page load times');
      }
      
      if (testResults.summary.failed > testResults.summary.total * 0.3) {
        console.log('- High failure rate detected. Review infrastructure and API health');
      }
    }
    
    console.log('\n🎯 Test run complete!');
    console.log('Browser will remain open for manual inspection...');
    console.log('Press Ctrl+C to exit\n');
    
    // Keep browser open
    await new Promise(() => {});
  }
}

// Run the tests
runComprehensiveTests().catch(console.error);