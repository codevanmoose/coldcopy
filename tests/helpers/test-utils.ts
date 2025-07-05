import { Page, expect, Locator, BrowserContext } from '@playwright/test';
import * as fs from 'fs/promises';
import * as path from 'path';

// Test credentials
export const TEST_CREDENTIALS = {
  admin: {
    email: 'jaspervanmoose@gmail.com',
    password: 'okkenbollen33',
  },
  testUser: {
    email: `test.user.${Date.now()}@example.com`,
    password: 'TestPassword123!',
    fullName: 'Test User',
    workspace: `Test Workspace ${Date.now()}`,
  },
};

// API endpoints
export const API_ENDPOINTS = {
  health: '/api/health',
  auth: '/api/test-auth',
  workspaces: '/api/workspaces',
  campaigns: '/api/campaigns',
  leads: '/api/leads',
  templates: '/api/templates',
  metrics: '/api/metrics',
  platform: '/api/platform/stats',
};

export class TestHelpers {
  constructor(private page: Page) {}

  /**
   * Login as admin user
   */
  async loginAsAdmin() {
    await this.page.goto('/login');
    await this.page.waitForLoadState('networkidle');
    
    await this.page.fill('input[type="email"]', TEST_CREDENTIALS.admin.email);
    await this.page.fill('input[type="password"]', TEST_CREDENTIALS.admin.password);
    await this.page.click('button:has-text("Sign in")');
    
    // Wait for dashboard
    await this.page.waitForURL('**/dashboard', { timeout: 30000 });
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Login with custom credentials
   */
  async login(email: string, password: string) {
    await this.page.goto('/login');
    await this.page.waitForLoadState('networkidle');
    
    await this.page.fill('input[type="email"]', email);
    await this.page.fill('input[type="password"]', password);
    await this.page.click('button:has-text("Sign in")');
    
    // Wait for navigation
    await this.page.waitForTimeout(3000);
  }

  /**
   * Logout
   */
  async logout() {
    // Find and click user menu
    const userMenuButton = await this.page.locator(
      'button:has(img[alt*="avatar" i]), button[aria-label*="user" i], button[aria-label*="profile" i]'
    ).first();
    
    if (await userMenuButton.isVisible()) {
      await userMenuButton.click();
      await this.page.waitForTimeout(500);
      
      // Click logout
      await this.page.click('text=/sign out|log out|logout/i');
      await this.page.waitForURL('**/login', { timeout: 10000 });
    }
  }

  /**
   * Create a new user account
   */
  async signUp(userData: {
    email: string;
    password: string;
    fullName: string;
    workspace: string;
  }) {
    await this.page.goto('/signup');
    await this.page.waitForLoadState('networkidle');
    
    await this.page.fill('input[placeholder*="John Doe"]', userData.fullName);
    await this.page.fill('input[placeholder*="Acme Agency"]', userData.workspace);
    await this.page.fill('input[type="email"]', userData.email);
    await this.page.fill('input[type="password"]', userData.password);
    
    await this.page.click('button:has-text("Start free trial")');
    
    // Wait for response
    await this.page.waitForTimeout(5000);
  }

  /**
   * Navigate to a dashboard section
   */
  async navigateTo(section: 'campaigns' | 'leads' | 'inbox' | 'templates' | 'analytics' | 'settings') {
    await this.page.click(`a[href="/${section}"], text="${section.charAt(0).toUpperCase() + section.slice(1)}"`);
    await this.page.waitForURL(`**/${section}`, { timeout: 10000 });
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Check for errors on the page
   */
  async checkForErrors(): Promise<string[]> {
    const errors: string[] = [];
    
    // Check for error messages in UI
    const errorElements = await this.page.locator(
      '.text-destructive, .text-red-600, [role="alert"], .bg-destructive, text=/error|failed|something went wrong/i'
    ).all();
    
    for (const element of errorElements) {
      const text = await element.textContent();
      if (text) errors.push(text.trim());
    }
    
    // Check console errors
    const consoleErrors = await this.page.evaluate(() => {
      return (window as any).__consoleErrors || [];
    });
    errors.push(...consoleErrors);
    
    return errors;
  }

  /**
   * Wait for API response
   */
  async waitForAPIResponse(urlPattern: string | RegExp) {
    return this.page.waitForResponse(
      (response) =>
        urlPattern instanceof RegExp
          ? urlPattern.test(response.url())
          : response.url().includes(urlPattern)
    );
  }

  /**
   * Make API request and return response
   */
  async callAPI(endpoint: string, options?: RequestInit) {
    return this.page.evaluate(
      async ({ url, opts }) => {
        try {
          const response = await fetch(url, opts);
          const text = await response.text();
          let data;
          try {
            data = JSON.parse(text);
          } catch {
            data = text;
          }
          return {
            status: response.status,
            ok: response.ok,
            data,
            error: null,
          };
        } catch (error: any) {
          return {
            status: 0,
            ok: false,
            data: null,
            error: error.message,
          };
        }
      },
      { url: endpoint, opts: options }
    );
  }

  /**
   * Check API health
   */
  async checkAPIHealth() {
    const results: Record<string, any> = {};
    
    for (const [name, endpoint] of Object.entries(API_ENDPOINTS)) {
      const response = await this.callAPI(endpoint);
      results[name] = response;
    }
    
    return results;
  }

  /**
   * Take a screenshot with a descriptive name
   */
  async screenshot(name: string) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${name}-${timestamp}.png`;
    await this.page.screenshot({
      path: path.join('test-artifacts', filename),
      fullPage: true,
    });
    return filename;
  }

  /**
   * Measure page performance
   */
  async measurePerformance() {
    return this.page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paint = performance.getEntriesByType('paint');
      
      return {
        loadTime: navigation.loadEventEnd - navigation.fetchStart,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
        firstPaint: paint.find((p) => p.name === 'first-paint')?.startTime || 0,
        firstContentfulPaint: paint.find((p) => p.name === 'first-contentful-paint')?.startTime || 0,
        resources: performance.getEntriesByType('resource').length,
      };
    });
  }

  /**
   * Fill a form field with retry logic
   */
  async fillField(selector: string, value: string, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const field = await this.page.locator(selector).first();
        await field.waitFor({ state: 'visible', timeout: 5000 });
        await field.fill(value);
        return;
      } catch (error) {
        if (i === retries - 1) throw error;
        await this.page.waitForTimeout(1000);
      }
    }
  }

  /**
   * Click with retry logic
   */
  async clickWithRetry(selector: string, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        await this.page.click(selector, { timeout: 5000 });
        return;
      } catch (error) {
        if (i === retries - 1) throw error;
        await this.page.waitForTimeout(1000);
      }
    }
  }

  /**
   * Wait for loading indicators to disappear
   */
  async waitForLoadingComplete() {
    // Wait for spinners to disappear
    await this.page.waitForFunction(
      () => {
        const spinners = document.querySelectorAll('.animate-spin, [aria-label="Loading"]');
        return spinners.length === 0;
      },
      { timeout: 30000 }
    );
    
    // Wait for network idle
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Extract table data
   */
  async getTableData(tableSelector: string): Promise<any[]> {
    return this.page.evaluate((selector) => {
      const table = document.querySelector(selector);
      if (!table) return [];
      
      const rows = Array.from(table.querySelectorAll('tbody tr'));
      return rows.map((row) => {
        const cells = Array.from(row.querySelectorAll('td'));
        return cells.map((cell) => cell.textContent?.trim() || '');
      });
    }, tableSelector);
  }

  /**
   * Check element visibility with custom message
   */
  async expectVisible(selector: string, message?: string) {
    const element = this.page.locator(selector).first();
    await expect(element, message).toBeVisible();
  }

  /**
   * Check element text content
   */
  async expectText(selector: string, text: string | RegExp, message?: string) {
    const element = this.page.locator(selector).first();
    if (typeof text === 'string') {
      await expect(element, message).toHaveText(text);
    } else {
      await expect(element, message).toHaveText(text);
    }
  }

  /**
   * Upload a file
   */
  async uploadFile(selector: string, filePath: string) {
    const fileInput = this.page.locator(selector);
    await fileInput.setInputFiles(filePath);
  }

  /**
   * Generate test data
   */
  generateTestData() {
    const timestamp = Date.now();
    return {
      campaign: {
        name: `Test Campaign ${timestamp}`,
        subject: `Test Subject ${timestamp}`,
        body: `This is a test campaign created at ${new Date().toISOString()}`,
      },
      lead: {
        firstName: 'Test',
        lastName: `Lead${timestamp}`,
        email: `testlead${timestamp}@example.com`,
        company: `Test Company ${timestamp}`,
      },
      template: {
        name: `Test Template ${timestamp}`,
        subject: 'Test Email Subject',
        body: 'Hi {{firstName}}, This is a test email template.',
      },
    };
  }
}

/**
 * Custom assertions
 */
export const customExpect = {
  async toHaveNoConsoleErrors(page: Page) {
    const errors = await page.evaluate(() => (window as any).__consoleErrors || []);
    expect(errors, 'Page should have no console errors').toHaveLength(0);
  },

  async toLoadWithinTime(page: Page, maxTime: number) {
    const loadTime = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return nav.loadEventEnd - nav.fetchStart;
    });
    expect(loadTime, `Page should load within ${maxTime}ms`).toBeLessThan(maxTime);
  },

  async toHaveSuccessfulAPICall(response: any) {
    expect(response.ok, 'API call should be successful').toBe(true);
    expect(response.status, 'API should return 2xx status').toBeGreaterThanOrEqual(200);
    expect(response.status, 'API should return 2xx status').toBeLessThan(300);
  },
};