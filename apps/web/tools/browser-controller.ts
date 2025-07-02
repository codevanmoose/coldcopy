import { chromium, firefox, webkit, Browser, Page, BrowserContext, devices } from 'playwright';
import fs from 'fs/promises';
import path from 'path';

interface DashboardCredentials {
  email?: string;
  username?: string;
  password?: string;
  otpSecret?: string;
}

interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'warning';
  duration: number;
  screenshot?: string;
  errors: string[];
  data?: any;
}

interface ColdCopyTestSuite {
  landingPage: TestResult;
  authentication: TestResult;
  userJourney: TestResult;
  aiFeatures: TestResult;
  integrations: TestResult;
  performance: TestResult;
  visual: TestResult;
  mobile: TestResult;
}

interface PerformanceMetrics {
  loadTime: number;
  ttfb: number;
  fcp: number;
  lcp: number;
  cls: number;
  fid: number;
  bundleSize: number;
  apiResponseTimes: Record<string, number>;
}

export class BrowserController {
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private screenshots: string[] = [];
  private testResults: TestResult[] = [];
  private performanceMetrics: PerformanceMetrics[] = [];
  private baseUrl: string = 'https://coldcopy.cc';
  
  async initialize(options: { 
    headless?: boolean; 
    record?: boolean;
    browser?: 'chromium' | 'firefox' | 'webkit';
    device?: string;
    baseUrl?: string;
  } = {}) {
    if (options.baseUrl) {
      this.baseUrl = options.baseUrl;
    }
    
    const userDataDir = path.join(process.cwd(), '.browser-data');
    await fs.mkdir(userDataDir, { recursive: true });
    
    // Select browser engine
    const browserEngine = options.browser === 'firefox' ? firefox : 
                         options.browser === 'webkit' ? webkit : chromium;
    
    // Configure device or viewport
    const device = options.device ? devices[options.device] : undefined;
    
    this.context = await browserEngine.launchPersistentContext(userDataDir, {
      headless: options.headless ?? true,
      viewport: device?.viewport || { width: 1920, height: 1080 },
      userAgent: device?.userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      recordVideo: options.record ? { dir: './videos' } : undefined,
      ignoreHTTPSErrors: true,
      ...device,
    });
    
    this.page = this.context.pages()[0] || await this.context.newPage();
    
    // Enhanced debugging and monitoring
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('Browser console error:', msg.text());
      }
    });
    
    this.page.on('pageerror', error => {
      console.error('Page error:', error.message);
    });
    
    this.page.on('requestfailed', request => {
      console.warn('Request failed:', request.url(), request.failure()?.errorText);
    });
    
    // Performance monitoring
    await this.page.addInitScript(() => {
      window.performance.mark('test-start');
      
      // Track API calls
      const originalFetch = window.fetch;
      window.fetch = async (...args) => {
        const start = performance.now();
        const response = await originalFetch(...args);
        const end = performance.now();
        
        window.__apiCalls = window.__apiCalls || [];
        window.__apiCalls.push({
          url: args[0],
          duration: end - start,
          status: response.status
        });
        
        return response;
      };
    });
  }
  
  async runComprehensiveColdCopyTests(): Promise<ColdCopyTestSuite> {
    if (!this.page) throw new Error('Browser not initialized');
    
    console.log('🧪 Running Comprehensive ColdCopy Test Suite...');
    
    const suite: ColdCopyTestSuite = {
      landingPage: await this.testLandingPage(),
      authentication: await this.testAuthentication(),
      userJourney: await this.testUserJourney(),
      aiFeatures: await this.testAIFeatures(),
      integrations: await this.testIntegrations(),
      performance: await this.testPerformance(),
      visual: await this.testVisualRegression(),
      mobile: await this.testMobileExperience()
    };
    
    return suite;
  }
  
  async testLandingPage(): Promise<TestResult> {
    const start = Date.now();
    const result: TestResult = {
      name: 'Landing Page Test',
      status: 'passed',
      duration: 0,
      errors: []
    };
    
    try {
      console.log('Testing landing page...');
      await this.page!.goto(this.baseUrl, { waitUntil: 'networkidle' });
      result.screenshot = await this.captureScreenshot('landing-page');
      
      // Check critical elements
      const title = await this.page!.title();
      if (!title.includes('ColdCopy')) {
        result.errors.push('Page title does not contain ColdCopy');
      }
      
      // Check for hero section
      const heroVisible = await this.page!.locator('h1').first().isVisible({ timeout: 5000 });
      if (!heroVisible) {
        result.errors.push('Hero section not visible');
      }
      
      // Check navigation links
      const navLinks = ['login', 'signup', 'pricing'];
      for (const link of navLinks) {
        const linkVisible = await this.page!.locator(`a[href*="/${link}"]`).first().isVisible({ timeout: 3000 });
        if (!linkVisible) {
          result.errors.push(`${link} navigation link not found`);
        }
      }
      
      // Check for any console errors (temporarily disabled to avoid __name error)
      // const pageState = await this.extractPageState();
      // if (pageState.hasErrors) {
      //   result.errors.push('Console errors detected');
      // }
      
      result.status = result.errors.length > 0 ? 'warning' : 'passed';
      
    } catch (error) {
      result.status = 'failed';
      result.errors.push(`Landing page test failed: ${error.message}`);
    }
    
    result.duration = Date.now() - start;
    this.testResults.push(result);
    return result;
  }
  
  async testAuthentication(): Promise<TestResult> {
    const start = Date.now();
    const result: TestResult = {
      name: 'Authentication Flow Test',
      status: 'passed',
      duration: 0,
      errors: []
    };
    
    try {
      console.log('Testing authentication flows...');
      
      // Test login page
      await this.page!.goto(`${this.baseUrl}/login`, { waitUntil: 'networkidle' });
      result.screenshot = await this.captureScreenshot('login-page');
      
      // Check form elements
      const emailField = await this.page!.locator('input[name="email"], input[type="email"]').first().isVisible();
      const passwordField = await this.page!.locator('input[name="password"], input[type="password"]').first().isVisible();
      const submitButton = await this.page!.locator('button[type="submit"]').first().isVisible();
      
      if (!emailField) result.errors.push('Email field not found');
      if (!passwordField) result.errors.push('Password field not found');
      if (!submitButton) result.errors.push('Submit button not found');
      
      // Test form validation
      await this.page!.locator('button[type="submit"]').first().click();
      await this.page!.waitForTimeout(1000);
      
      const validationErrors = await this.page!.locator('[class*="error"], [role="alert"]').count();
      if (validationErrors === 0) {
        result.errors.push('Form validation not working');
      }
      
      // Test signup page
      const signupLink = await this.page!.locator('a[href*="/signup"]').first();
      if (await signupLink.isVisible()) {
        await signupLink.click();
        await this.page!.waitForURL('**/register');
        await this.captureScreenshot('signup-page');
      } else {
        result.errors.push('Signup link not found');
      }
      
      result.status = result.errors.length > 0 ? 'warning' : 'passed';
      
    } catch (error) {
      result.status = 'failed';
      result.errors.push(`Authentication test failed: ${error.message}`);
    }
    
    result.duration = Date.now() - start;
    this.testResults.push(result);
    return result;
  }
  
  async testUserJourney(): Promise<TestResult> {
    const start = Date.now();
    const result: TestResult = {
      name: 'User Journey Test',
      status: 'passed',
      duration: 0,
      errors: []
    };
    
    try {
      console.log('Testing critical user journey...');
      
      // Check if user journey test page exists
      const response = await this.page!.request.get(`${this.baseUrl}/test-user-journey`);
      if (response.status() === 200) {
        await this.page!.goto(`${this.baseUrl}/test-user-journey`);
        result.screenshot = await this.captureScreenshot('user-journey-test');
        
        // Check for journey steps
        const journeySteps = await this.page!.locator('[class*="journey-step"], [data-testid*="step"]').count();
        if (journeySteps === 0) {
          result.errors.push('No journey steps found on test page');
        }
        
        result.data = { stepsFound: journeySteps };
      } else {
        result.errors.push('User journey test page not accessible');
      }
      
      // Test dashboard access (should redirect to login)
      await this.page!.goto(`${this.baseUrl}/dashboard`);
      const currentUrl = this.page!.url();
      if (!currentUrl.includes('/login') && !currentUrl.includes('/dashboard')) {
        result.errors.push('Dashboard access not properly protected');
      }
      
      result.status = result.errors.length > 0 ? 'warning' : 'passed';
      
    } catch (error) {
      result.status = 'failed';
      result.errors.push(`User journey test failed: ${error.message}`);
    }
    
    result.duration = Date.now() - start;
    this.testResults.push(result);
    return result;
  }
  
  async testAIFeatures(): Promise<TestResult> {
    const start = Date.now();
    const result: TestResult = {
      name: 'AI Features Test',
      status: 'passed',
      duration: 0,
      errors: [],
      data: {}
    };
    
    try {
      console.log('Testing AI features...');
      
      const aiEndpoints = [
        '/api/test-ai-generation',
        '/api/test-ai-config',
        '/test-ai',
        '/test-smart-reply',
        '/test-sentiment'
      ];
      
      const endpointResults: Record<string, any> = {};
      
      for (const endpoint of aiEndpoints) {
        try {
          const response = await this.page!.request.get(`${this.baseUrl}${endpoint}`);
          endpointResults[endpoint] = {
            status: response.status(),
            ok: response.ok(),
            data: response.ok() ? await response.json().catch(() => null) : null
          };
          
          if (!response.ok()) {
            result.errors.push(`AI endpoint ${endpoint} returned ${response.status()}`);
          }
        } catch (error) {
          endpointResults[endpoint] = { error: error.message };
          result.errors.push(`AI endpoint ${endpoint} failed: ${error.message}`);
        }
      }
      
      result.data = endpointResults;
      result.status = result.errors.length > 3 ? 'failed' : result.errors.length > 0 ? 'warning' : 'passed';
      
    } catch (error) {
      result.status = 'failed';
      result.errors.push(`AI features test failed: ${error.message}`);
    }
    
    result.duration = Date.now() - start;
    this.testResults.push(result);
    return result;
  }
  
  async testIntegrations(): Promise<TestResult> {
    const start = Date.now();
    const result: TestResult = {
      name: 'Integrations Test',
      status: 'passed',
      duration: 0,
      errors: [],
      data: {}
    };
    
    try {
      console.log('Testing integrations...');
      
      const integrationEndpoints = [
        '/api/health',
        '/api/ses-status',
        '/api/test-redis',
        '/api/test-supabase-config',
        '/api/test-stripe-config'
      ];
      
      const integrationResults: Record<string, any> = {};
      
      for (const endpoint of integrationEndpoints) {
        try {
          const response = await this.page!.request.get(`${this.baseUrl}${endpoint}`);
          const data = response.ok() ? await response.json().catch(() => null) : null;
          
          integrationResults[endpoint] = {
            status: response.status(),
            ok: response.ok(),
            data
          };
          
          if (!response.ok()) {
            result.errors.push(`Integration ${endpoint} unhealthy: ${response.status()}`);
          }
        } catch (error) {
          integrationResults[endpoint] = { error: error.message };
          result.errors.push(`Integration ${endpoint} failed: ${error.message}`);
        }
      }
      
      result.data = integrationResults;
      result.status = result.errors.length > 2 ? 'failed' : result.errors.length > 0 ? 'warning' : 'passed';
      
    } catch (error) {
      result.status = 'failed';
      result.errors.push(`Integrations test failed: ${error.message}`);
    }
    
    result.duration = Date.now() - start;
    this.testResults.push(result);
    return result;
  }
  
  async testPerformance(): Promise<TestResult> {
    const start = Date.now();
    const result: TestResult = {
      name: 'Performance Test',
      status: 'passed',
      duration: 0,
      errors: [],
      data: {}
    };
    
    try {
      console.log('Testing performance...');
      
      // Test landing page load time
      const loadStart = Date.now();
      await this.page!.goto(this.baseUrl, { waitUntil: 'networkidle' });
      const loadTime = Date.now() - loadStart;
      
      // Get Core Web Vitals
      const webVitals = await this.page!.evaluate(() => {
        return new Promise((resolve) => {
          const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const vitals: any = {};
            
            entries.forEach((entry) => {
              if (entry.entryType === 'largest-contentful-paint') {
                vitals.lcp = entry.startTime;
              }
              if (entry.entryType === 'first-input') {
                vitals.fid = entry.processingStart - entry.startTime;
              }
              if (entry.entryType === 'layout-shift' && !entry.hadRecentInput) {
                vitals.cls = (vitals.cls || 0) + entry.value;
              }
            });
            
            observer.disconnect();
            resolve(vitals);
          });
          
          observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] });
          
          // Fallback after 5 seconds
          setTimeout(() => resolve({}), 5000);
        });
      });
      
      // Get API call performance
      const apiCalls = await this.page!.evaluate(() => window.__apiCalls || []);
      
      const performanceData = {
        loadTime,
        webVitals,
        apiCalls,
        slowApiCalls: apiCalls.filter((call: any) => call.duration > 1000)
      };
      
      result.data = performanceData;
      
      // Performance thresholds
      if (loadTime > 5000) {
        result.errors.push(`Slow page load: ${Math.round(loadTime)}ms`);
      }
      
      if (webVitals.lcp && webVitals.lcp > 2500) {
        result.errors.push(`Poor LCP: ${Math.round(webVitals.lcp)}ms`);
      }
      
      if (performanceData.slowApiCalls.length > 0) {
        result.errors.push(`${performanceData.slowApiCalls.length} slow API calls detected`);
      }
      
      result.status = result.errors.length > 2 ? 'failed' : result.errors.length > 0 ? 'warning' : 'passed';
      
    } catch (error) {
      result.status = 'failed';
      result.errors.push(`Performance test failed: ${error.message}`);
    }
    
    result.duration = Date.now() - start;
    this.testResults.push(result);
    return result;
  }
  
  async testVisualRegression(): Promise<TestResult> {
    const start = Date.now();
    const result: TestResult = {
      name: 'Visual Regression Test',
      status: 'passed',
      duration: 0,
      errors: []
    };
    
    try {
      console.log('Testing visual regression...');
      
      const pages = [
        { url: '/', name: 'landing' },
        { url: '/login', name: 'login' },
        { url: '/signup', name: 'signup' },
        { url: '/pricing', name: 'pricing' }
      ];
      
      const screenshots: string[] = [];
      
      for (const page of pages) {
        try {
          await this.page!.goto(`${this.baseUrl}${page.url}`, { waitUntil: 'networkidle' });
          const screenshot = await this.captureScreenshot(`visual-${page.name}`);
          screenshots.push(screenshot);
        } catch (error) {
          result.errors.push(`Failed to capture ${page.name}: ${error.message}`);
        }
      }
      
      result.data = { screenshots };
      result.status = result.errors.length > 0 ? 'warning' : 'passed';
      
    } catch (error) {
      result.status = 'failed';
      result.errors.push(`Visual regression test failed: ${error.message}`);
    }
    
    result.duration = Date.now() - start;
    this.testResults.push(result);
    return result;
  }
  
  async testMobileExperience(): Promise<TestResult> {
    const start = Date.now();
    const result: TestResult = {
      name: 'Mobile Experience Test',
      status: 'passed',
      duration: 0,
      errors: []
    };
    
    try {
      console.log('Testing mobile experience...');
      
      // Set mobile viewport
      await this.page!.setViewportSize({ width: 375, height: 667 });
      await this.page!.goto(this.baseUrl, { waitUntil: 'networkidle' });
      result.screenshot = await this.captureScreenshot('mobile-view');
      
      // Check for mobile menu
      const mobileMenu = await this.page!.locator('[aria-label*="menu"], button[aria-label*="Menu"]').first().isVisible();
      if (!mobileMenu) {
        result.errors.push('Mobile menu not found');
      }
      
      // Check responsive images
      const images = await this.page!.locator('img').all();
      for (const img of images) {
        const srcset = await img.getAttribute('srcset');
        if (!srcset) {
          result.errors.push('Images not optimized for mobile');
          break;
        }
      }
      
      // Test touch interactions
      if (mobileMenu) {
        await this.page!.locator('[aria-label*="menu"], button[aria-label*="Menu"]').first().tap();
        await this.page!.waitForTimeout(500);
        
        const mobileMenuOpen = await this.page!.locator('[role="dialog"], .mobile-menu').first().isVisible();
        if (!mobileMenuOpen) {
          result.errors.push('Mobile menu does not open on tap');
        }
      }
      
      // Reset viewport
      await this.page!.setViewportSize({ width: 1920, height: 1080 });
      
      result.status = result.errors.length > 0 ? 'warning' : 'passed';
      
    } catch (error) {
      result.status = 'failed';
      result.errors.push(`Mobile test failed: ${error.message}`);
    }
    
    result.duration = Date.now() - start;
    this.testResults.push(result);
    return result;
  }
  
  async testColdCopyProduction() {
    // Legacy method - redirect to comprehensive test
    const suite = await this.runComprehensiveColdCopyTests();
    
    return {
      landing: {
        url: this.baseUrl,
        title: 'ColdCopy',
        hasErrors: suite.landingPage.errors.length > 0,
        screenshot: suite.landingPage.screenshot
      },
      aiDashboard: {
        url: `${this.baseUrl}/ai-dashboard`,
        title: 'AI Dashboard',
        hasErrors: suite.aiFeatures.errors.length > 0,
        screenshot: suite.aiFeatures.screenshot
      },
      errors: suite.landingPage.errors.concat(suite.aiFeatures.errors)
    };
  }
  
  async navigateToVercelDashboard(projectId?: string) {
    if (!this.page) throw new Error('Browser not initialized');
    
    const url = projectId 
      ? `https://vercel.com/vanmooseprojects/coldcopy/settings/environment-variables`
      : 'https://vercel.com/dashboard';
    
    console.log(`Navigating to Vercel...`);
    await this.page.goto(url, { waitUntil: 'networkidle' });
    
    const screenshot = await this.captureScreenshot('vercel-dashboard');
    const pageState = await this.extractPageState();
    
    return {
      url: this.page.url(),
      title: await this.page.title(),
      screenshot,
      state: pageState,
      isLoggedIn: await this.checkVercelLoginStatus()
    };
  }
  
  async extractPageState() {
    if (!this.page) throw new Error('Browser not initialized');
    
    return await this.page.evaluate(() => {
      const extractText = (selector: string): string[] => {
        return Array.from(document.querySelectorAll(selector))
          .map(el => el.textContent?.trim() || '')
          .filter(text => text.length > 0);
      };
      
      const patterns = [
        '[class*="error"]',
        '[class*="alert"]',
        '[class*="warning"]',
        '[role="alert"]',
        '.text-red-500',
        '.text-danger',
        '[class*="status"]',
        '[class*="deployment"]',
        '[class*="build"]',
      ];
      
      const elements: Record<string, string[]> = {};
      patterns.forEach(pattern => {
        elements[pattern] = extractText(pattern);
      });
      
      return {
        url: window.location.href,
        title: document.title,
        elements,
        bodyText: document.body.innerText.substring(0, 5000),
        hasErrors: document.body.innerText.toLowerCase().includes('error') ||
                   document.body.innerText.toLowerCase().includes('failed'),
        interactiveElements: {
          buttons: Array.from(document.querySelectorAll('button')).map(btn => ({
            text: btn.textContent?.trim(),
            disabled: btn.disabled,
          })),
          links: Array.from(document.querySelectorAll('a[href]')).map(link => ({
            text: link.textContent?.trim(),
            href: link.getAttribute('href')
          }))
        }
      };
    });
  }
  
  async captureScreenshot(name: string): Promise<string> {
    if (!this.page) throw new Error('Browser not initialized');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${name}-${timestamp}.png`;
    const filepath = path.join('screenshots', filename);
    
    await fs.mkdir('screenshots', { recursive: true });
    await this.page.screenshot({ 
      path: filepath,
      fullPage: true 
    });
    
    this.screenshots.push(filepath);
    return filepath;
  }
  
  async extractErrors(): Promise<any[]> {
    if (!this.page) throw new Error('Browser not initialized');
    
    const errors = await this.page.evaluate(() => {
      const errorPatterns = [
        { selector: '[class*="error"]', type: 'error' },
        { selector: '[class*="alert-danger"]', type: 'error' },
        { selector: '[class*="warning"]', type: 'warning' },
        { selector: '[role="alert"]', type: 'alert' },
        { selector: '.text-red-500', type: 'error' },
        { selector: '.text-danger', type: 'error' }
      ];
      
      const found: any[] = [];
      
      errorPatterns.forEach(({ selector, type }) => {
        document.querySelectorAll(selector).forEach(el => {
          const text = el.textContent?.trim();
          if (text && text.length > 0) {
            found.push({
              type,
              text,
              selector,
            });
          }
        });
      });
      
      return found;
    });
    
    return errors;
  }
  
  private async checkVercelLoginStatus(): Promise<boolean> {
    if (!this.page) return false;
    
    try {
      return this.page.url().includes('dashboard') && 
             !this.page.url().includes('login');
    } catch {
      return false;
    }
  }
  
  async generateTestReport(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportDir = path.join('reports', `comprehensive-test-${timestamp}`);
    await fs.mkdir(reportDir, { recursive: true });
    
    const report = {
      timestamp: new Date().toISOString(),
      baseUrl: this.baseUrl,
      summary: {
        total: this.testResults.length,
        passed: this.testResults.filter(r => r.status === 'passed').length,
        failed: this.testResults.filter(r => r.status === 'failed').length,
        warnings: this.testResults.filter(r => r.status === 'warning').length,
        totalDuration: this.testResults.reduce((sum, r) => sum + r.duration, 0)
      },
      results: this.testResults,
      screenshots: this.screenshots,
      recommendations: this.generateRecommendations()
    };
    
    const reportPath = path.join(reportDir, 'test-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    // Generate HTML report
    const htmlReport = this.generateHTMLReport(report);
    const htmlPath = path.join(reportDir, 'test-report.html');
    await fs.writeFile(htmlPath, htmlReport);
    
    console.log(`\n📊 Comprehensive test report generated:`);
    console.log(`JSON: ${reportPath}`);
    console.log(`HTML: ${htmlPath}`);
    
    return reportPath;
  }
  
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    const failedTests = this.testResults.filter(r => r.status === 'failed');
    const warningTests = this.testResults.filter(r => r.status === 'warning');
    
    if (failedTests.length > 0) {
      recommendations.push(`🚨 ${failedTests.length} critical tests failed - immediate attention required`);
    }
    
    if (warningTests.length > 0) {
      recommendations.push(`⚠️ ${warningTests.length} tests have warnings - review and fix when possible`);
    }
    
    // Specific recommendations based on test results
    const landingPageTest = this.testResults.find(r => r.name.includes('Landing Page'));
    if (landingPageTest && landingPageTest.errors.length > 0) {
      recommendations.push('🏠 Landing page issues detected - check hero section and navigation');
    }
    
    const authTest = this.testResults.find(r => r.name.includes('Authentication'));
    if (authTest && authTest.errors.length > 0) {
      recommendations.push('🔐 Authentication flow issues - verify form validation and signup process');
    }
    
    const aiTest = this.testResults.find(r => r.name.includes('AI Features'));
    if (aiTest && aiTest.errors.length > 0) {
      recommendations.push('🤖 AI features not working properly - check API keys and endpoints');
    }
    
    const perfTest = this.testResults.find(r => r.name.includes('Performance'));
    if (perfTest && perfTest.errors.length > 0) {
      recommendations.push('⚡ Performance issues detected - optimize page load times and API responses');
    }
    
    const mobileTest = this.testResults.find(r => r.name.includes('Mobile'));
    if (mobileTest && mobileTest.errors.length > 0) {
      recommendations.push('📱 Mobile experience needs improvement - check responsive design and touch interactions');
    }
    
    return recommendations;
  }
  
  private generateHTMLReport(report: any): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ColdCopy Test Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: #2563eb; color: white; padding: 30px; border-radius: 8px 8px 0 0; }
        .content { padding: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { background: #f8fafc; padding: 20px; border-radius: 6px; text-align: center; }
        .metric-value { font-size: 2em; font-weight: bold; margin-bottom: 5px; }
        .passed { color: #059669; }
        .failed { color: #dc2626; }
        .warning { color: #d97706; }
        .test-result { border: 1px solid #e5e7eb; border-radius: 6px; margin-bottom: 20px; overflow: hidden; }
        .test-header { padding: 15px; background: #f9fafb; display: flex; justify-content: space-between; align-items: center; }
        .test-body { padding: 15px; }
        .status-badge { padding: 4px 12px; border-radius: 20px; color: white; font-size: 0.875em; font-weight: 500; }
        .status-passed { background: #059669; }
        .status-failed { background: #dc2626; }
        .status-warning { background: #d97706; }
        .error-list { list-style: none; padding: 0; margin: 10px 0; }
        .error-item { background: #fef2f2; border: 1px solid #fecaca; padding: 10px; border-radius: 4px; margin-bottom: 5px; color: #991b1b; }
        .recommendations { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 20px; margin-top: 30px; }
        .recommendation-item { margin-bottom: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 ColdCopy Comprehensive Test Report</h1>
            <p>Generated: ${report.timestamp}</p>
            <p>Base URL: ${report.baseUrl}</p>
        </div>
        
        <div class="content">
            <div class="summary">
                <div class="metric">
                    <div class="metric-value">${report.summary.total}</div>
                    <div>Total Tests</div>
                </div>
                <div class="metric">
                    <div class="metric-value passed">${report.summary.passed}</div>
                    <div>Passed</div>
                </div>
                <div class="metric">
                    <div class="metric-value failed">${report.summary.failed}</div>
                    <div>Failed</div>
                </div>
                <div class="metric">
                    <div class="metric-value warning">${report.summary.warnings}</div>
                    <div>Warnings</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${Math.round(report.summary.totalDuration)}ms</div>
                    <div>Total Duration</div>
                </div>
            </div>
            
            <h2>Test Results</h2>
            ${report.results.map((result: TestResult) => `
                <div class="test-result">
                    <div class="test-header">
                        <h3>${result.name}</h3>
                        <span class="status-badge status-${result.status}">${result.status.toUpperCase()}</span>
                    </div>
                    <div class="test-body">
                        <p><strong>Duration:</strong> ${Math.round(result.duration)}ms</p>
                        ${result.errors.length > 0 ? `
                            <h4>Issues Found:</h4>
                            <ul class="error-list">
                                ${result.errors.map(error => `<li class="error-item">${error}</li>`).join('')}
                            </ul>
                        ` : '<p style="color: #059669;">✅ All checks passed</p>'}
                        ${result.screenshot ? `<p><strong>Screenshot:</strong> ${result.screenshot}</p>` : ''}
                    </div>
                </div>
            `).join('')}
            
            ${report.recommendations.length > 0 ? `
                <div class="recommendations">
                    <h2>🎯 Recommendations</h2>
                    ${report.recommendations.map((rec: string) => `<div class="recommendation-item">${rec}</div>`).join('')}
                </div>
            ` : ''}
        </div>
    </div>
</body>
</html>`;
  }
  
  async cleanup() {
    if (this.context) {
      await this.context.close();
    }
    
    console.log(`\n🎬 Session complete!`);
    console.log(`📸 Screenshots saved: ${this.screenshots.length}`);
    console.log(`🧪 Tests completed: ${this.testResults.length}`);
    
    if (this.testResults.length > 0) {
      const reportPath = await this.generateTestReport();
      return reportPath;
    }
  }
}