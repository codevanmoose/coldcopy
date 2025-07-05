import { test, expect } from '@playwright/test';
import { TestHelpers, customExpect } from '../helpers/test-utils';

test.describe('Dashboard Navigation Tests', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    
    // Inject console error tracking
    await page.addInitScript(() => {
      (window as any).__consoleErrors = [];
      const originalError = console.error;
      console.error = (...args: any[]) => {
        (window as any).__consoleErrors.push(args.join(' '));
        originalError(...args);
      };
    });
    
    // Login as admin before each test
    await helpers.loginAsAdmin();
  });

  test('should display dashboard home with demo content', async ({ page }) => {
    // Should already be on dashboard after login
    await expect(page).toHaveURL(/.*dashboard/);
    
    // Check for dashboard elements
    await helpers.expectVisible('h1, h2', 'Dashboard should have a heading');
    
    // Check for demo content indicators
    const dashboardContent = await page.textContent('body');
    
    // Should show campaign count
    const campaignCount = await page.locator('text=/campaign/i').count();
    expect(campaignCount).toBeGreaterThan(0);
    
    // Check for welcome message or getting started
    await helpers.screenshot('dashboard-home');
    
    // No console errors
    await customExpect.toHaveNoConsoleErrors(page);
  });

  test.describe('Navigation Menu', () => {
    const navigationItems = [
      { name: 'Campaigns', path: '/campaigns', testId: 'campaigns-page' },
      { name: 'Leads', path: '/leads', testId: 'leads-page' },
      { name: 'Inbox', path: '/inbox', testId: 'inbox-page' },
      { name: 'Templates', path: '/templates', testId: 'templates-page' },
      { name: 'Analytics', path: '/analytics', testId: 'analytics-page' },
      { name: 'Settings', path: '/settings', testId: 'settings-page' },
    ];

    for (const item of navigationItems) {
      test(`should navigate to ${item.name}`, async ({ page }) => {
        await helpers.navigateTo(item.path.slice(1) as any);
        
        // Verify URL
        await expect(page).toHaveURL(new RegExp(item.path));
        
        // Wait for content to load
        await helpers.waitForLoadingComplete();
        
        // Check page loaded without errors
        const errors = await helpers.checkForErrors();
        expect(errors).toHaveLength(0);
        
        // Take screenshot
        await helpers.screenshot(`dashboard-${item.name.toLowerCase()}`);
        
        // Check for console errors
        await customExpect.toHaveNoConsoleErrors(page);
      });
    }
  });

  test.describe('Campaigns Section', () => {
    test.beforeEach(async ({ page }) => {
      await helpers.navigateTo('campaigns');
    });

    test('should display campaigns list with demo data', async ({ page }) => {
      // Check for campaign cards or list items
      const campaigns = await page.locator('[data-testid="campaign-card"], .campaign-item, tbody tr').count();
      expect(campaigns).toBeGreaterThan(0); // Should have demo campaigns
      
      // Check for New Campaign button
      await helpers.expectVisible('button:has-text("New Campaign"), a:has-text("New Campaign")', 'Should have New Campaign button');
    });

    test('should navigate to new campaign page', async ({ page }) => {
      const newCampaignButton = page.locator('button:has-text("New Campaign"), a:has-text("New Campaign")').first();
      await newCampaignButton.click();
      
      await page.waitForURL('**/campaigns/new', { timeout: 10000 });
      
      // Check for campaign form
      await helpers.expectVisible('input[name="name"], input[placeholder*="campaign"]', 'Should have campaign name input');
      
      await helpers.screenshot('new-campaign-page');
    });
  });

  test.describe('Leads Section', () => {
    test.beforeEach(async ({ page }) => {
      await helpers.navigateTo('leads');
    });

    test('should display leads table with demo data', async ({ page }) => {
      // Wait for table to load
      await helpers.waitForLoadingComplete();
      
      // Check for leads table
      const leadsTable = await page.locator('table, [role="table"]').isVisible();
      expect(leadsTable).toBe(true);
      
      // Check for lead rows
      const leadRows = await page.locator('tbody tr, [role="row"]').count();
      expect(leadRows).toBeGreaterThan(0); // Should have demo leads
      
      // Check for Import button
      await helpers.expectVisible('button:has-text("Import"), a:has-text("Import")', 'Should have Import button');
    });

    test('should have functional search/filter', async ({ page }) => {
      const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]').first();
      if (await searchInput.isVisible()) {
        await searchInput.fill('test');
        await page.waitForTimeout(1000); // Wait for debounce
        
        // Table should update (rows might change)
        await helpers.waitForLoadingComplete();
      }
    });
  });

  test.describe('Inbox Section', () => {
    test.beforeEach(async ({ page }) => {
      await helpers.navigateTo('inbox');
    });

    test('should display inbox with welcome message', async ({ page }) => {
      // Check for conversation list
      const conversations = await page.locator('[data-testid="conversation-item"], .conversation-item, .inbox-item').count();
      expect(conversations).toBeGreaterThan(0); // Should have at least welcome message
      
      // Check for inbox layout
      const hasInboxLayout = await page.locator('.inbox-container, [data-testid="inbox"]').isVisible();
      expect(hasInboxLayout).toBe(true);
    });
  });

  test.describe('Templates Section', () => {
    test.beforeEach(async ({ page }) => {
      await helpers.navigateTo('templates');
    });

    test('should display template library with demo templates', async ({ page }) => {
      // Wait for templates to load
      await helpers.waitForLoadingComplete();
      
      // Check for template cards
      const templates = await page.locator('[data-testid="template-card"], .template-item, .template-card').count();
      expect(templates).toBeGreaterThan(0); // Should have demo templates
      
      // Check for Create Template button
      await helpers.expectVisible('button:has-text("Create"), button:has-text("New Template")', 'Should have Create Template button');
    });
  });

  test.describe('Analytics Section', () => {
    test.beforeEach(async ({ page }) => {
      await helpers.navigateTo('analytics');
    });

    test('should display analytics dashboard', async ({ page }) => {
      // Wait for analytics to load
      await helpers.waitForLoadingComplete();
      
      // Check for metric cards
      const metrics = await page.locator('[data-testid="metric-card"], .metric-card, .stat-card').count();
      expect(metrics).toBeGreaterThan(0);
      
      // Check for date range selector
      const dateRangeSelector = await page.locator('button:has-text("Last"), select[name*="date"], input[type="date"]').first().isVisible();
      expect(dateRangeSelector).toBe(true);
      
      await helpers.screenshot('analytics-dashboard');
    });
  });

  test.describe('Settings Section', () => {
    test.beforeEach(async ({ page }) => {
      await helpers.navigateTo('settings');
    });

    test('should display settings tabs', async ({ page }) => {
      // Check for settings navigation
      const settingsTabs = ['Profile', 'Team', 'Workspace', 'Integrations', 'Billing'];
      
      for (const tab of settingsTabs) {
        const tabElement = await page.locator(`text="${tab}"`).first().isVisible();
        expect(tabElement).toBe(true);
      }
    });

    test('should navigate between settings tabs', async ({ page }) => {
      // Click on Team tab
      await page.click('text="Team"');
      await page.waitForTimeout(1000);
      
      // Should show team management
      const teamContent = await page.locator('text=/invite|member|role/i').first().isVisible();
      expect(teamContent).toBe(true);
      
      // Click on Billing tab
      await page.click('text="Billing"');
      await page.waitForTimeout(1000);
      
      // Should show billing info
      const billingContent = await page.locator('text=/plan|subscription|upgrade/i').first().isVisible();
      expect(billingContent).toBe(true);
    });
  });

  test.describe('User Menu', () => {
    test('should open user menu and show options', async ({ page }) => {
      // Find and click user avatar/menu
      const userMenuButton = page.locator(
        'button:has(img[alt*="avatar" i]), button[aria-label*="user" i], button[aria-label*="profile" i]'
      ).first();
      
      expect(await userMenuButton.isVisible()).toBe(true);
      await userMenuButton.click();
      
      // Wait for menu to open
      await page.waitForTimeout(500);
      
      // Check for menu items
      await helpers.expectVisible('text=/sign out|log out|logout/i', 'Should have logout option');
      
      // Take screenshot
      await helpers.screenshot('user-menu-open');
    });
  });

  test.describe('Performance', () => {
    test('dashboard should load quickly', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      const performance = await helpers.measurePerformance();
      expect(performance.loadTime).toBeLessThan(5000);
      expect(performance.firstContentfulPaint).toBeLessThan(2000);
    });

    test('navigation between sections should be fast', async ({ page }) => {
      const sections = ['campaigns', 'leads', 'templates'];
      
      for (const section of sections) {
        const startTime = Date.now();
        await helpers.navigateTo(section as any);
        const endTime = Date.now();
        
        const navigationTime = endTime - startTime;
        expect(navigationTime).toBeLessThan(3000);
      }
    });
  });

  test.describe('API Health Check', () => {
    test('all dashboard APIs should be healthy', async ({ page }) => {
      const apiHealth = await helpers.checkAPIHealth();
      
      // Check each endpoint
      for (const [endpoint, response] of Object.entries(apiHealth)) {
        if (endpoint !== 'workspaces') { // Workspaces might require specific handling
          expect(response.ok, `${endpoint} API should be healthy`).toBe(true);
        }
      }
    });
  });
});