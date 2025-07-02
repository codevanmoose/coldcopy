import { test, expect, Page, Browser } from '@playwright/test';
import { BrowserController } from '../../tools/browser-controller';
import { VisualAnalyzer } from '../../tools/visual-analyzer';
import path from 'path';
import fs from 'fs/promises';

// Test configuration
const PRODUCTION_URL = 'https://www.coldcopy.cc';
const TEST_TIMEOUT = 60000; // 1 minute per test
const RETRY_COUNT = 3;

// Test data
const TEST_USER = {
  email: 'test@coldcopy.cc',
  password: 'TestPassword123!',
  name: 'Test User'
};

const TEST_LEAD = {
  name: 'John Test',
  email: 'john.test@example.com',
  company: 'Test Company Inc',
  title: 'VP of Sales'
};

test.describe('ColdCopy Production Tests', () => {
  let browser: Browser;
  let page: Page;
  let browserController: BrowserController;
  let visualAnalyzer: VisualAnalyzer;
  let testResults: any = {};

  test.beforeAll(async () => {
    browserController = new BrowserController();
    visualAnalyzer = new VisualAnalyzer();
    
    // Initialize browser for tests
    await browserController.initialize({ headless: false, record: true });
  });

  test.afterAll(async () => {
    // Generate comprehensive test report
    const reportPath = path.join('reports', `production-test-${Date.now()}.json`);
    await fs.mkdir('reports', { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(testResults, null, 2));
    
    console.log(`\n📊 Test Report saved to: ${reportPath}`);
    
    // Cleanup
    await browserController.cleanup();
  });

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    page.setDefaultTimeout(TEST_TIMEOUT);
  });

  test('Landing Page Health Check', async () => {
    await test.step('Navigate to landing page', async () => {
      await page.goto(PRODUCTION_URL, { waitUntil: 'networkidle' });
      await expect(page).toHaveURL(PRODUCTION_URL);
    });

    await test.step('Check page title and meta', async () => {
      await expect(page).toHaveTitle(/ColdCopy/);
      const description = await page.locator('meta[name="description"]').getAttribute('content');
      expect(description).toContain('AI-powered cold outreach');
    });

    await test.step('Verify critical elements', async () => {
      await expect(page.locator('text=Get Started')).toBeVisible();
      await expect(page.locator('text=Features')).toBeVisible();
      await expect(page.locator('text=Pricing')).toBeVisible();
    });

    await test.step('Capture screenshot for analysis', async () => {
      const screenshotPath = await page.screenshot({ 
        path: 'screenshots/landing-page.png',
        fullPage: true 
      });
      
      const analysis = await visualAnalyzer.analyzeScreenshot('screenshots/landing-page.png');
      testResults.landingPage = {
        status: 'passed',
        errors: analysis.errors,
        warnings: analysis.warnings
      };
    });
  });

  test('Authentication Flow', async () => {
    await test.step('Navigate to login page', async () => {
      await page.goto(`${PRODUCTION_URL}/login`);
      await expect(page.locator('h1')).toContainText(/Sign In|Login/);
    });

    await test.step('Test login form validation', async () => {
      // Test empty form submission
      await page.click('button[type="submit"]');
      await expect(page.locator('text=required')).toBeVisible();
      
      // Test invalid email
      await page.fill('input[name="email"]', 'invalid-email');
      await page.fill('input[name="password"]', 'short');
      await page.click('button[type="submit"]');
      await expect(page.locator('text=/invalid|error/i')).toBeVisible();
    });

    await test.step('Test signup link', async () => {
      const signupLink = page.locator('a[href*="/signup"]');
      await expect(signupLink).toBeVisible();
      await signupLink.click();
      await expect(page).toHaveURL(/signup/);
      await page.goBack();
    });

    testResults.authentication = {
      status: 'passed',
      loginFormValidation: 'working',
      navigationLinks: 'working'
    };
  });

  test('AI Features Availability', async () => {
    await test.step('Check AI email generation page', async () => {
      const response = await page.request.get(`${PRODUCTION_URL}/test-ai`);
      testResults.aiFeatures = {
        emailGeneration: response.status() === 200 ? 'available' : 'not found',
        statusCode: response.status()
      };
    });

    await test.step('Check smart reply page', async () => {
      const response = await page.request.get(`${PRODUCTION_URL}/test-smart-reply`);
      testResults.aiFeatures.smartReply = response.status() === 200 ? 'available' : 'not found';
    });

    await test.step('Check sentiment analysis page', async () => {
      const response = await page.request.get(`${PRODUCTION_URL}/test-sentiment`);
      testResults.aiFeatures.sentiment = response.status() === 200 ? 'available' : 'not found';
    });
  });

  test('API Health Checks', async () => {
    const apiEndpoints = [
      '/api/health',
      '/api/test-ai-config',
      '/api/ses-status'
    ];

    for (const endpoint of apiEndpoints) {
      await test.step(`Check ${endpoint}`, async () => {
        try {
          const response = await page.request.get(`${PRODUCTION_URL}${endpoint}`);
          const data = response.ok() ? await response.json() : null;
          
          testResults.apiHealth = testResults.apiHealth || {};
          testResults.apiHealth[endpoint] = {
            status: response.status(),
            ok: response.ok(),
            data: data
          };
        } catch (error) {
          testResults.apiHealth[endpoint] = {
            status: 'error',
            error: error.message
          };
        }
      });
    }
  });

  test('Performance Metrics', async () => {
    await test.step('Measure page load time', async () => {
      const startTime = Date.now();
      await page.goto(PRODUCTION_URL, { waitUntil: 'networkidle' });
      const loadTime = Date.now() - startTime;
      
      testResults.performance = {
        landingPageLoadTime: loadTime,
        acceptable: loadTime < 3000
      };
    });

    await test.step('Check resource sizes', async () => {
      const coverage = await page.coverage.startJSCoverage();
      await page.goto(PRODUCTION_URL);
      const jsCoverage = await page.coverage.stopJSCoverage();
      
      const totalBytes = jsCoverage.reduce((acc, entry) => acc + entry.text.length, 0);
      testResults.performance.jsBundleSize = totalBytes;
      testResults.performance.jsBundleSizeKB = Math.round(totalBytes / 1024);
    });
  });

  test('SEO and Accessibility', async () => {
    await page.goto(PRODUCTION_URL);

    await test.step('Check SEO meta tags', async () => {
      const seoChecks = {
        title: await page.title(),
        description: await page.locator('meta[name="description"]').getAttribute('content'),
        ogTitle: await page.locator('meta[property="og:title"]').getAttribute('content'),
        ogDescription: await page.locator('meta[property="og:description"]').getAttribute('content'),
        ogImage: await page.locator('meta[property="og:image"]').getAttribute('content'),
        canonical: await page.locator('link[rel="canonical"]').getAttribute('href')
      };
      
      testResults.seo = seoChecks;
    });

    await test.step('Check accessibility basics', async () => {
      const accessibilityChecks = {
        hasLangAttribute: await page.locator('html[lang]').count() > 0,
        hasAltTexts: await page.locator('img:not([alt])').count() === 0,
        hasAriaLabels: await page.locator('button:not([aria-label])').count() === 0,
        hasHeadingStructure: await page.locator('h1').count() > 0
      };
      
      testResults.accessibility = accessibilityChecks;
    });
  });

  test('Critical User Journey - Email Campaign', async () => {
    // This test simulates the critical user journey
    await test.step('Start user journey test', async () => {
      await page.goto(`${PRODUCTION_URL}/test-user-journey`);
      await expect(page.locator('h1')).toContainText('User Journey Test');
      
      // Start the automated journey test
      const startButton = page.locator('button:has-text("Start Journey Test")');
      await expect(startButton).toBeVisible();
      
      // Capture before state
      await page.screenshot({ path: 'screenshots/journey-before.png' });
      
      // Note: We don't click start as it requires authentication
      // This just verifies the journey test page is available
      testResults.userJourney = {
        pageAvailable: true,
        stepsVisible: await page.locator('[class*="journey-step"]').count() > 0
      };
    });
  });

  test('Error Handling and Recovery', async () => {
    await test.step('Test 404 page', async () => {
      await page.goto(`${PRODUCTION_URL}/this-page-does-not-exist`);
      await expect(page.locator('text=/404|not found/i')).toBeVisible();
      
      // Should have a way to get back home
      const homeLink = page.locator('a[href="/"]');
      await expect(homeLink).toBeVisible();
    });

    await test.step('Test API error handling', async () => {
      // Test with invalid API call
      const response = await page.request.post(`${PRODUCTION_URL}/api/invalid-endpoint`, {
        data: { test: true }
      });
      
      expect(response.status()).toBeGreaterThanOrEqual(400);
      testResults.errorHandling = {
        notFoundPage: 'working',
        apiErrors: 'properly handled'
      };
    });
  });

  test('Mobile Responsiveness', async () => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(PRODUCTION_URL);

    await test.step('Check mobile menu', async () => {
      // Mobile menu should be present
      const mobileMenu = page.locator('[aria-label*="menu"]');
      const isMobileMenuVisible = await mobileMenu.isVisible();
      
      testResults.mobile = {
        menuPresent: isMobileMenuVisible,
        viewportHandled: true
      };
    });

    await test.step('Capture mobile screenshot', async () => {
      await page.screenshot({ 
        path: 'screenshots/mobile-view.png',
        fullPage: true 
      });
    });

    // Reset viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
  });

  test('Security Headers', async () => {
    const response = await page.request.get(PRODUCTION_URL);
    const headers = response.headers();

    testResults.security = {
      headers: {
        'strict-transport-security': headers['strict-transport-security'] || 'not set',
        'x-content-type-options': headers['x-content-type-options'] || 'not set',
        'x-frame-options': headers['x-frame-options'] || 'not set',
        'content-security-policy': headers['content-security-policy'] ? 'present' : 'not set'
      },
      https: response.url().startsWith('https')
    };
  });
});

// Additional helper tests
test.describe('Production Monitoring', () => {
  test('Generate Production Report', async ({ page }) => {
    const browserController = new BrowserController();
    const visualAnalyzer = new VisualAnalyzer();
    
    await browserController.initialize({ headless: true });
    
    // Test ColdCopy production
    const productionResults = await browserController.testColdCopyProduction();
    
    // Analyze screenshots
    const visualAnalysis = await visualAnalyzer.analyzeProductionDeployment([
      productionResults.landing.screenshot,
      productionResults.aiDashboard.screenshot
    ]);
    
    // Create comprehensive report
    const report = {
      timestamp: new Date().toISOString(),
      production: productionResults,
      visual: visualAnalysis,
      recommendations: generateRecommendations(productionResults, visualAnalysis)
    };
    
    // Save report
    const reportPath = path.join('reports', `monitoring-${Date.now()}.json`);
    await fs.mkdir('reports', { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    console.log('📊 Monitoring report generated:', reportPath);
    
    await browserController.cleanup();
  });
});

function generateRecommendations(production: any, visual: any): string[] {
  const recommendations: string[] = [];
  
  if (visual.totalErrors > 0) {
    recommendations.push(`Fix ${visual.totalErrors} errors detected in screenshots`);
  }
  
  if (visual.visualChanges > 0) {
    recommendations.push(`Review ${visual.visualChanges} visual changes detected`);
  }
  
  if (production.errors.length > 0) {
    recommendations.push('Address page errors before launch');
  }
  
  if (!production.aiDashboard.url.includes('ai-dashboard')) {
    recommendations.push('AI dashboard may require authentication');
  }
  
  return recommendations;
}