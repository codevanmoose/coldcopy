import { test, expect } from '@playwright/test';
import { TestHelpers, TEST_CREDENTIALS, customExpect } from '../helpers/test-utils';

test.describe('Authentication Tests', () => {
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
  });

  test.describe('Admin Login', () => {
    test('should successfully login as admin', async ({ page }) => {
      await helpers.loginAsAdmin();
      
      // Verify we're on dashboard
      await expect(page).toHaveURL(/.*dashboard/);
      
      // Check for user greeting or dashboard elements
      await helpers.expectVisible('h1, h2', 'Dashboard should have a heading');
      
      // Take screenshot
      await helpers.screenshot('admin-dashboard-after-login');
      
      // Check for console errors
      await customExpect.toHaveNoConsoleErrors(page);
    });

    test('should show error with invalid credentials', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      
      await helpers.fillField('input[type="email"]', 'invalid@example.com');
      await helpers.fillField('input[type="password"]', 'wrongpassword');
      await page.click('button:has-text("Sign in")');
      
      // Wait for error message
      await page.waitForTimeout(2000);
      
      // Check for error
      const errors = await helpers.checkForErrors();
      expect(errors.length).toBeGreaterThan(0);
      
      // Should still be on login page
      await expect(page).toHaveURL(/.*login/);
    });

    test('should maintain session after page refresh', async ({ page }) => {
      await helpers.loginAsAdmin();
      
      // Refresh page
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Should still be on dashboard
      await expect(page).toHaveURL(/.*dashboard/);
      
      // Check auth status via API
      const authStatus = await helpers.callAPI('/api/test-auth');
      expect(authStatus.data?.hasSession).toBe(true);
    });

    test('should successfully logout', async ({ page }) => {
      await helpers.loginAsAdmin();
      await helpers.logout();
      
      // Should be redirected to login
      await expect(page).toHaveURL(/.*login/);
      
      // Try to access dashboard - should redirect to login
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/.*login/);
    });
  });

  test.describe('User Signup', () => {
    test('should create new account and show email verification', async ({ page }) => {
      const userData = TEST_CREDENTIALS.testUser;
      
      await helpers.signUp(userData);
      
      // Check current URL
      const currentUrl = page.url();
      
      // Should either be on verify-email page or show verification message
      if (currentUrl.includes('verify-email')) {
        await helpers.expectVisible('text=/verify|confirm/i', 'Should show verification message');
        await helpers.screenshot('email-verification-page');
      } else {
        // Check for any success or error messages
        const pageContent = await page.textContent('body');
        expect(pageContent).toMatch(/verify|confirm|check.*email/i);
      }
      
      // Check for console errors
      await customExpect.toHaveNoConsoleErrors(page);
    });

    test('should validate signup form fields', async ({ page }) => {
      await page.goto('/signup');
      await page.waitForLoadState('networkidle');
      
      // Try to submit empty form
      await page.click('button:has-text("Start free trial")');
      
      // Should show validation errors
      await page.waitForTimeout(1000);
      
      // Fill partial form
      await helpers.fillField('input[type="email"]', 'invalidemail');
      await page.click('button:has-text("Start free trial")');
      
      // Check for email validation error
      const errors = await helpers.checkForErrors();
      expect(errors.length).toBeGreaterThan(0);
    });

    test('should prevent duplicate email signup', async ({ page }) => {
      // Try to sign up with admin email
      await helpers.signUp({
        email: TEST_CREDENTIALS.admin.email,
        password: 'TestPassword123!',
        fullName: 'Duplicate User',
        workspace: 'Duplicate Workspace',
      });
      
      // Should show error
      await page.waitForTimeout(2000);
      const errors = await helpers.checkForErrors();
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.toLowerCase().includes('exist') || e.toLowerCase().includes('already'))).toBe(true);
    });
  });

  test.describe('Password Reset', () => {
    test('should navigate to password reset page', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      
      // Click forgot password link
      const forgotPasswordLink = page.locator('a:has-text("Forgot password"), text=/forgot.*password/i');
      if (await forgotPasswordLink.isVisible()) {
        await forgotPasswordLink.click();
        await page.waitForLoadState('networkidle');
        
        // Should be on reset password page
        await expect(page).toHaveURL(/.*reset|forgot/);
        await helpers.expectVisible('input[type="email"]', 'Should have email input for reset');
      }
    });
  });

  test.describe('Session Management', () => {
    test('should redirect to login when accessing protected routes without auth', async ({ page }) => {
      const protectedRoutes = ['/dashboard', '/campaigns', '/leads', '/inbox', '/settings'];
      
      for (const route of protectedRoutes) {
        await page.goto(route);
        await page.waitForLoadState('networkidle');
        
        // Should redirect to login
        await expect(page).toHaveURL(/.*login/, `Should redirect to login when accessing ${route}`);
      }
    });

    test('should redirect to dashboard when logged in user visits login page', async ({ page }) => {
      // First login
      await helpers.loginAsAdmin();
      
      // Try to go to login page
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      
      // Should redirect to dashboard
      await expect(page).toHaveURL(/.*dashboard/);
    });
  });

  test.describe('Authentication Performance', () => {
    test('login page should load quickly', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      
      await customExpect.toLoadWithinTime(page, 3000);
      
      const performance = await helpers.measurePerformance();
      expect(performance.firstContentfulPaint).toBeLessThan(1500);
    });
  });
});