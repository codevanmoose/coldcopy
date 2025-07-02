import { test, expect, Page } from '@playwright/test';
import { BrowserController } from '../../tools/browser-controller';
import { DashboardDiagnostics } from '../../tools/dashboard-diagnostics';
import { faker } from '@faker-js/faker';

// Test configuration
const PRODUCTION_URL = process.env.PLAYWRIGHT_BASE_URL || 'https://coldcopy.cc';
const TEST_TIMEOUT = 120000; // 2 minutes per test

test.describe('ColdCopy Production Health Suite', () => {
  let browserController: BrowserController;
  let diagnostics: DashboardDiagnostics;

  test.beforeAll(async () => {
    browserController = new BrowserController();
    diagnostics = new DashboardDiagnostics(PRODUCTION_URL);
    
    await browserController.initialize({ 
      headless: true, 
      record: true,
      baseUrl: PRODUCTION_URL 
    });
    await diagnostics.initialize({ headless: true });
  });

  test.afterAll(async () => {
    await browserController.cleanup();
    await diagnostics.cleanup();
  });

  test('Complete Infrastructure Health Check', async () => {
    test.setTimeout(TEST_TIMEOUT);
    
    console.log('🏥 Running complete infrastructure health check...');
    
    const healthReport = await diagnostics.runFullInfrastructureDiagnostics();
    
    // Log results for debugging
    console.log('\n📊 Infrastructure Health Results:');
    console.log(`Overall Status: ${healthReport.overall}`);
    console.log(`Vercel: ${healthReport.vercel.status}`);
    console.log(`Supabase: ${healthReport.supabase.status}`);
    console.log(`Redis: ${healthReport.redis.status}`);
    console.log(`Stripe: ${healthReport.stripe.status}`);
    console.log(`SES: ${healthReport.ses.status}`);
    console.log(`OpenAI: ${healthReport.aiServices.openai.status}`);
    console.log(`Anthropic: ${healthReport.aiServices.anthropic.status}`);

    // Generate infrastructure report
    await diagnostics.generateInfrastructureReport(healthReport);

    // Assertions
    expect(healthReport.vercel.status).not.toBe('critical');
    expect(healthReport.supabase.status).not.toBe('critical');
    
    // These are warnings if they fail, not critical
    if (healthReport.redis.status === 'critical') {
      console.warn('⚠️ Redis is not working - performance may be reduced');
    }
    
    if (healthReport.ses.status === 'critical') {
      console.warn('⚠️ SES is not configured - email features disabled');
    }

    // AI services - at least one should work
    const aiWorking = healthReport.aiServices.openai.status !== 'critical' || 
                     healthReport.aiServices.anthropic.status !== 'critical';
    expect(aiWorking).toBe(true);

    expect(['healthy', 'degraded']).toContain(healthReport.overall);
  });

  test('Comprehensive User Journey Test', async () => {
    test.setTimeout(TEST_TIMEOUT);
    
    console.log('🚀 Running comprehensive user journey test...');
    
    const testSuite = await browserController.runComprehensiveColdCopyTests();
    
    // Log results
    console.log('\n🧪 Test Suite Results:');
    Object.entries(testSuite).forEach(([testName, result]) => {
      console.log(`${testName}: ${result.status} (${Math.round(result.duration)}ms)`);
      if (result.errors.length > 0) {
        console.log(`  Errors: ${result.errors.join(', ')}`);
      }
    });

    // Generate comprehensive report
    await browserController.generateTestReport();

    // Assertions - landing page and auth must work
    expect(testSuite.landingPage.status).not.toBe('failed');
    expect(testSuite.authentication.status).not.toBe('failed');
    
    // Performance should be reasonable
    expect(testSuite.performance.status).not.toBe('failed');
    
    // Mobile experience should work
    expect(testSuite.mobile.status).not.toBe('failed');
    
    // At least some AI features should work
    if (testSuite.aiFeatures.status === 'failed') {
      console.warn('⚠️ AI features not working - check API keys');
    }
  });

  test('Critical User Flows - End to End', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    
    console.log('🎭 Testing critical user flows...');
    
    // Test 1: Landing page to signup
    await test.step('Landing page navigation', async () => {
      await page.goto(PRODUCTION_URL);
      await expect(page).toHaveTitle(/ColdCopy/);
      
      // Check critical elements
      await expect(page.locator('h1').first()).toBeVisible();
      
      // Check CTA buttons
      const ctaButtons = page.locator('text=/start|get started|sign up|try/i');
      await expect(ctaButtons.first()).toBeVisible();
    });

    await test.step('Navigation to signup', async () => {
      // Try multiple ways to get to signup
      let signupReached = false;
      
      try {
        await page.click('text=/start free|get started|sign up/i');
        await page.waitForURL('**/signup', { timeout: 5000 });
        signupReached = true;
      } catch {
        try {
          await page.goto(`${PRODUCTION_URL}/signup`);
          signupReached = true;
        } catch {
          // Last resort - check if signup link exists
          const signupLink = page.locator('a[href*="/signup"]');
          if (await signupLink.isVisible()) {
            await signupLink.click();
            signupReached = true;
          }
        }
      }
      
      expect(signupReached).toBe(true);
    });

    await test.step('Signup form validation', async () => {
      // Test form validation without actually creating an account
      await page.locator('button[type="submit"]').first().click();
      
      // Should show validation errors
      const errorMessages = page.locator('[class*="error"], [role="alert"], text=/required|invalid/i');
      await expect(errorMessages.first()).toBeVisible({ timeout: 3000 });
    });

    // Test 2: Login page functionality
    await test.step('Login page access', async () => {
      await page.goto(`${PRODUCTION_URL}/login`);
      
      // Check form elements
      await expect(page.locator('input[name="email"], input[type="email"]').first()).toBeVisible();
      await expect(page.locator('input[name="password"], input[type="password"]').first()).toBeVisible();
      await expect(page.locator('button[type="submit"]').first()).toBeVisible();
    });

    // Test 3: Pricing page (if exists)
    await test.step('Pricing page check', async () => {
      const response = await page.request.get(`${PRODUCTION_URL}/pricing`);
      if (response.ok()) {
        await page.goto(`${PRODUCTION_URL}/pricing`);
        await expect(page.locator('text=/pricing|plan|price/i').first()).toBeVisible();
      } else {
        console.log('ℹ️ Pricing page not found - may be integrated elsewhere');
      }
    });

    // Test 4: Protected routes redirect
    await test.step('Protected routes redirect to login', async () => {
      await page.goto(`${PRODUCTION_URL}/dashboard`);
      
      // Should redirect to login or show login form
      const currentUrl = page.url();
      const isProtected = currentUrl.includes('/login') || 
                         currentUrl.includes('/signin') ||
                         await page.locator('text=/sign in|login/i').first().isVisible();
      
      expect(isProtected).toBe(true);
    });
  });

  test('AI Features Functionality Test', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    
    console.log('🤖 Testing AI features...');
    
    // Test AI generation endpoints
    const aiTests = await diagnostics.testAIGenerationEndToEnd();
    
    console.log('AI Test Results:');
    console.log(`GPT-4: ${aiTests.gpt4.status}`);
    console.log(`Claude: ${aiTests.claude.status}`);
    
    // At least one AI service should work
    const anyAIWorking = aiTests.gpt4.status !== 'critical' || aiTests.claude.status !== 'critical';
    
    if (!anyAIWorking) {
      console.warn('⚠️ No AI services working - check API keys and configuration');
    }
    
    // Check if AI test pages are accessible
    const aiTestPages = ['/test-ai', '/test-smart-reply', '/test-sentiment'];
    
    for (const testPage of aiTestPages) {
      await test.step(`Check ${testPage} accessibility`, async () => {
        const response = await page.request.get(`${PRODUCTION_URL}${testPage}`);
        if (response.ok()) {
          await page.goto(`${PRODUCTION_URL}${testPage}`);
          await expect(page.locator('h1, h2, [data-testid*="title"]').first()).toBeVisible();
          console.log(`✅ ${testPage} is accessible`);
        } else {
          console.log(`ℹ️ ${testPage} not found (${response.status()})`);
        }
      });
    }
  });

  test('Performance and Core Web Vitals', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    
    console.log('⚡ Testing performance and Core Web Vitals...');
    
    // Measure page load performance
    const startTime = Date.now();
    await page.goto(PRODUCTION_URL, { waitUntil: 'networkidle' });
    const loadTime = Date.now() - startTime;
    
    console.log(`Page load time: ${loadTime}ms`);
    
    // Get Core Web Vitals
    const vitals = await page.evaluate(() => {
      return new Promise((resolve) => {
        const vitals: any = {};
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'largest-contentful-paint') {
              vitals.lcp = entry.startTime;
            }
            if (entry.entryType === 'first-input') {
              vitals.fid = (entry as any).processingStart - entry.startTime;
            }
            if (entry.entryType === 'layout-shift' && !(entry as any).hadRecentInput) {
              vitals.cls = (vitals.cls || 0) + (entry as any).value;
            }
          }
        });
        
        observer.observe({ 
          entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] 
        });
        
        // Resolve after a short delay
        setTimeout(() => {
          observer.disconnect();
          resolve(vitals);
        }, 3000);
      });
    });
    
    console.log('Core Web Vitals:', vitals);
    
    // Performance assertions
    expect(loadTime).toBeLessThan(10000); // 10 seconds max
    
    if (vitals.lcp) {
      expect(vitals.lcp).toBeLessThan(4000); // 4 seconds LCP
    }
    
    if (vitals.cls) {
      expect(vitals.cls).toBeLessThan(0.25); // Good CLS score
    }
  });

  test('Mobile Responsiveness', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    
    console.log('📱 Testing mobile responsiveness...');
    
    // Test different mobile viewports
    const mobileDevices = [
      { name: 'iPhone SE', width: 375, height: 667 },
      { name: 'iPhone 12', width: 390, height: 844 },
      { name: 'iPad', width: 768, height: 1024 }
    ];
    
    for (const device of mobileDevices) {
      await test.step(`Test ${device.name} (${device.width}x${device.height})`, async () => {
        await page.setViewportSize({ width: device.width, height: device.height });
        await page.goto(PRODUCTION_URL);
        
        // Check if page renders without horizontal scroll
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        expect(bodyWidth).toBeLessThanOrEqual(device.width + 50); // Allow 50px tolerance
        
        // Check for mobile menu or navigation
        const hasNavigation = await page.locator('nav, [role="navigation"], button[aria-label*="menu"]').first().isVisible();
        expect(hasNavigation).toBe(true);
        
        // Take screenshot for visual verification
        await page.screenshot({ 
          path: `screenshots/mobile-${device.name.toLowerCase().replace(' ', '-')}.png`,
          fullPage: true 
        });
      });
    }
    
    // Reset viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
  });

  test('SEO and Accessibility Basics', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    
    console.log('🔍 Testing SEO and accessibility...');
    
    await page.goto(PRODUCTION_URL);
    
    // SEO checks
    await test.step('SEO meta tags', async () => {
      const title = await page.title();
      expect(title.length).toBeGreaterThan(10);
      expect(title.length).toBeLessThan(70);
      
      const description = await page.locator('meta[name="description"]').getAttribute('content');
      if (description) {
        expect(description.length).toBeGreaterThan(120);
        expect(description.length).toBeLessThan(160);
      }
      
      const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
      expect(ogTitle).toBeTruthy();
    });
    
    // Basic accessibility checks
    await test.step('Accessibility basics', async () => {
      // Check for lang attribute
      const htmlLang = await page.locator('html').getAttribute('lang');
      expect(htmlLang).toBeTruthy();
      
      // Check for heading structure
      const h1Count = await page.locator('h1').count();
      expect(h1Count).toBeGreaterThanOrEqual(1);
      expect(h1Count).toBeLessThanOrEqual(3);
      
      // Check for alt text on images
      const imagesWithoutAlt = await page.locator('img:not([alt])').count();
      if (imagesWithoutAlt > 0) {
        console.warn(`⚠️ ${imagesWithoutAlt} images without alt text found`);
      }
      
      // Check for proper form labels
      const inputsWithoutLabels = await page.locator('input:not([aria-label]):not([aria-labelledby])').count();
      const labeledInputs = await page.locator('input + label, label + input').count();
      
      if (inputsWithoutLabels > labeledInputs) {
        console.warn(`⚠️ Some form inputs may lack proper labels`);
      }
    });
  });

  test('Security Headers and HTTPS', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    
    console.log('🔒 Testing security headers and HTTPS...');
    
    const response = await page.request.get(PRODUCTION_URL);
    const headers = Object.fromEntries(
      Object.entries(response.headers()).map(([key, value]) => [key.toLowerCase(), value])
    );
    
    // HTTPS check
    expect(response.url()).toMatch(/^https:/);
    
    // Security headers
    expect(headers['strict-transport-security']).toBeTruthy();
    
    if (headers['x-content-type-options']) {
      expect(headers['x-content-type-options']).toBe('nosniff');
    }
    
    if (headers['x-frame-options']) {
      expect(['DENY', 'SAMEORIGIN'].some(option => 
        headers['x-frame-options'].toUpperCase().includes(option)
      )).toBe(true);
    }
    
    // Content Security Policy (optional but recommended)
    if (headers['content-security-policy']) {
      console.log('✅ Content Security Policy found');
    } else {
      console.log('ℹ️ No Content Security Policy detected');
    }
    
    console.log('Security headers check completed');
  });

  test('Error Handling and 404 Pages', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    
    console.log('🚫 Testing error handling...');
    
    // Test 404 page
    await test.step('404 page handling', async () => {
      const response = await page.goto(`${PRODUCTION_URL}/this-page-definitely-does-not-exist-12345`);
      
      // Should return 404 or redirect gracefully
      if (response && response.status() === 404) {
        // Check if there's a proper 404 page
        const has404Content = await page.locator('text=/404|not found|page not found/i').first().isVisible();
        expect(has404Content).toBe(true);
        
        // Should have a way to get back home
        const homeLink = page.locator('a[href="/"], a[href="' + PRODUCTION_URL + '"]');
        await expect(homeLink.first()).toBeVisible();
      } else {
        // If it redirects, that's also acceptable
        console.log('ℹ️ 404 redirects to another page (acceptable behavior)');
      }
    });
    
    // Test API error handling
    await test.step('API error handling', async () => {
      const response = await page.request.get(`${PRODUCTION_URL}/api/nonexistent-endpoint-12345`);
      expect(response.status()).toBeGreaterThanOrEqual(400);
      expect(response.status()).toBeLessThan(500);
    });
  });
});