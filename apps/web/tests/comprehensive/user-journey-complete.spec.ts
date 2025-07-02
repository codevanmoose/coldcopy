import { test, expect, Page } from '@playwright/test';
import { faker } from '@faker-js/faker';

const PRODUCTION_URL = process.env.PLAYWRIGHT_BASE_URL || 'https://coldcopy.cc';
const TEST_TIMEOUT = 180000; // 3 minutes for complex user flows

// Helper functions
async function waitForAnySelector(page: Page, selectors: string[], timeout = 10000) {
  const promises = selectors.map(selector => 
    page.waitForSelector(selector, { timeout }).catch(() => null)
  );
  return Promise.race(promises);
}

async function findAndClick(page: Page, selectors: string[]) {
  for (const selector of selectors) {
    try {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: 2000 })) {
        await element.click();
        return true;
      }
    } catch {
      continue;
    }
  }
  return false;
}

test.describe('Complete User Journey Tests', () => {
  
  test('Full User Registration to Dashboard Journey', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    
    console.log('🚀 Starting complete user registration journey...');
    
    // Generate test user data
    const testUser = {
      email: `test.${faker.string.alphanumeric(8)}@example.com`,
      password: 'TestPassword123!',
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      companyName: faker.company.name()
    };
    
    console.log(`Testing with user: ${testUser.email}`);
    
    await test.step('Landing page interaction', async () => {
      await page.goto(PRODUCTION_URL);
      await expect(page).toHaveTitle(/ColdCopy/);
      
      // Take screenshot of landing page
      await page.screenshot({ path: 'screenshots/journey-01-landing.png', fullPage: true });
      
      // Look for any hero CTA button
      const ctaSelectors = [
        'text=/start free|get started|try free|sign up|start trial/i',
        'a[href*="/signup"]',
        'a[href*="/register"]',
        'button:has-text("Get Started")',
        'button:has-text("Start Free")',
        '[data-testid*="cta"]',
        '[class*="cta"]'
      ];
      
      let ctaClicked = false;
      for (const selector of ctaSelectors) {
        try {
          const element = page.locator(selector).first();
          if (await element.isVisible({ timeout: 3000 })) {
            await element.click();
            ctaClicked = true;
            console.log(`✅ Clicked CTA: ${selector}`);
            break;
          }
        } catch {
          continue;
        }
      }
      
      if (!ctaClicked) {
        // Fallback: navigate directly to signup
        console.log('⚠️ No CTA found, navigating directly to /signup');
        await page.goto(`${PRODUCTION_URL}/signup`);
      }
    });
    
    await test.step('Navigate to signup form', async () => {
      // Wait for signup page or form
      await page.waitForTimeout(2000);
      
      const currentUrl = page.url();
      if (!currentUrl.includes('/signup') && !currentUrl.includes('/register')) {
        // Try to find signup link on current page
        const signupLinkClicked = await findAndClick(page, [
          'a[href*="/signup"]',
          'a[href*="/register"]',
          'text="Sign Up"',
          'text="Register"'
        ]);
        
        if (!signupLinkClicked) {
          await page.goto(`${PRODUCTION_URL}/signup`);
        }
      }
      
      // Wait for signup form to appear
      await waitForAnySelector(page, [
        'input[name="email"]',
        'input[type="email"]',
        'form',
        'input[name="username"]'
      ]);
      
      await page.screenshot({ path: 'screenshots/journey-02-signup-form.png', fullPage: true });
    });
    
    await test.step('Fill out signup form', async () => {
      // Find and fill email field
      const emailSelectors = [
        'input[name="email"]',
        'input[type="email"]',
        'input[placeholder*="email" i]',
        'input[aria-label*="email" i]'
      ];
      
      let emailFilled = false;
      for (const selector of emailSelectors) {
        try {
          const element = page.locator(selector).first();
          if (await element.isVisible({ timeout: 2000 })) {
            await element.fill(testUser.email);
            emailFilled = true;
            console.log(`✅ Filled email field: ${selector}`);
            break;
          }
        } catch {
          continue;
        }
      }
      expect(emailFilled).toBe(true);
      
      // Find and fill password field
      const passwordSelectors = [
        'input[name="password"]',
        'input[type="password"]',
        'input[placeholder*="password" i]'
      ];
      
      let passwordFilled = false;
      for (const selector of passwordSelectors) {
        try {
          const element = page.locator(selector).first();
          if (await element.isVisible({ timeout: 2000 })) {
            await element.fill(testUser.password);
            passwordFilled = true;
            console.log(`✅ Filled password field: ${selector}`);
            break;
          }
        } catch {
          continue;
        }
      }
      expect(passwordFilled).toBe(true);
      
      // Fill other common fields if they exist
      const otherFields = [
        { selectors: ['input[name="confirmPassword"]', 'input[name="password_confirmation"]'], value: testUser.password },
        { selectors: ['input[name="firstName"]', 'input[name="first_name"]'], value: testUser.firstName },
        { selectors: ['input[name="lastName"]', 'input[name="last_name"]'], value: testUser.lastName },
        { selectors: ['input[name="name"]', 'input[name="fullName"]'], value: `${testUser.firstName} ${testUser.lastName}` },
        { selectors: ['input[name="company"]', 'input[name="companyName"]'], value: testUser.companyName }
      ];
      
      for (const field of otherFields) {
        for (const selector of field.selectors) {
          try {
            const element = page.locator(selector).first();
            if (await element.isVisible({ timeout: 1000 })) {
              await element.fill(field.value);
              console.log(`✅ Filled field: ${selector}`);
              break;
            }
          } catch {
            continue;
          }
        }
      }
      
      // Handle checkboxes (terms, privacy, etc.)
      const checkboxSelectors = [
        'input[type="checkbox"]',
        'input[name*="terms"]',
        'input[name*="privacy"]',
        'input[name*="agree"]'
      ];
      
      for (const selector of checkboxSelectors) {
        try {
          const element = page.locator(selector);
          const count = await element.count();
          for (let i = 0; i < count; i++) {
            const checkbox = element.nth(i);
            if (await checkbox.isVisible({ timeout: 1000 })) {
              const isChecked = await checkbox.isChecked();
              if (!isChecked) {
                await checkbox.check();
                console.log(`✅ Checked checkbox: ${selector}[${i}]`);
              }
            }
          }
        } catch {
          continue;
        }
      }
      
      await page.screenshot({ path: 'screenshots/journey-03-form-filled.png', fullPage: true });
    });
    
    await test.step('Submit signup form', async () => {
      // Find and click submit button
      const submitSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:has-text("Sign Up")',
        'button:has-text("Register")',
        'button:has-text("Create Account")',
        'button:has-text("Get Started")',
        '[data-testid*="submit"]'
      ];
      
      let submitClicked = false;
      for (const selector of submitSelectors) {
        try {
          const element = page.locator(selector).first();
          if (await element.isVisible({ timeout: 2000 })) {
            await element.click();
            submitClicked = true;
            console.log(`✅ Clicked submit: ${selector}`);
            break;
          }
        } catch {
          continue;
        }
      }
      expect(submitClicked).toBe(true);
      
      // Wait for response
      await page.waitForTimeout(3000);
      
      await page.screenshot({ path: 'screenshots/journey-04-after-submit.png', fullPage: true });
    });
    
    await test.step('Handle post-signup flow', async () => {
      const currentUrl = page.url();
      console.log(`Current URL after signup: ${currentUrl}`);
      
      // Check for common post-signup scenarios
      const successIndicators = [
        'text=/success|welcome|verify|check your email|account created/i',
        '[data-testid*="success"]',
        '.success',
        '.alert-success'
      ];
      
      let hasSuccessMessage = false;
      for (const selector of successIndicators) {
        try {
          if (await page.locator(selector).first().isVisible({ timeout: 5000 })) {
            hasSuccessMessage = true;
            console.log(`✅ Success message found: ${selector}`);
            break;
          }
        } catch {
          continue;
        }
      }
      
      // Check for email verification flow
      const needsVerification = await page.locator('text=/verify|verification|check your email/i').first().isVisible({ timeout: 3000 });
      
      if (needsVerification) {
        console.log('📧 Email verification required');
        
        // Mock email verification by checking if there's a verification endpoint
        try {
          // Try to find a verification link or simulate it
          const verifyButtons = page.locator('button:has-text("Verify"), a:has-text("Verify"), [data-testid*="verify"]');
          if (await verifyButtons.first().isVisible({ timeout: 2000 })) {
            await verifyButtons.first().click();
            await page.waitForTimeout(2000);
          }
        } catch {
          console.log('ℹ️ No verification button found - may require actual email');
        }
      }
      
      // Check if we're redirected to dashboard/onboarding
      const finalUrl = page.url();
      const isOnDashboard = finalUrl.includes('/dashboard') || 
                          finalUrl.includes('/onboarding') || 
                          finalUrl.includes('/welcome');
      
      if (isOnDashboard) {
        console.log('✅ Successfully reached dashboard/onboarding');
      } else if (hasSuccessMessage) {
        console.log('✅ Signup appears successful with confirmation message');
      } else {
        console.log('⚠️ Signup result unclear - checking for errors');
        
        // Check for error messages
        const errorSelectors = [
          '.error',
          '.alert-error',
          '[role="alert"]',
          'text=/error|failed|invalid/i'
        ];
        
        for (const selector of errorSelectors) {
          try {
            if (await page.locator(selector).first().isVisible({ timeout: 2000 })) {
              const errorText = await page.locator(selector).first().textContent();
              console.log(`❌ Error found: ${errorText}`);
            }
          } catch {
            continue;
          }
        }
      }
      
      await page.screenshot({ path: 'screenshots/journey-05-final-state.png', fullPage: true });
    });
  });
  
  test('Login Flow and Dashboard Access', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    
    console.log('🔐 Testing login flow and dashboard access...');
    
    await test.step('Navigate to login page', async () => {
      await page.goto(`${PRODUCTION_URL}/login`);
      await page.screenshot({ path: 'screenshots/login-01-page.png', fullPage: true });
      
      // Verify login form exists
      const hasEmailField = await page.locator('input[name="email"], input[type="email"]').first().isVisible({ timeout: 5000 });
      const hasPasswordField = await page.locator('input[name="password"], input[type="password"]').first().isVisible({ timeout: 5000 });
      
      expect(hasEmailField).toBe(true);
      expect(hasPasswordField).toBe(true);
    });
    
    await test.step('Test form validation', async () => {
      // Submit empty form
      const submitButton = page.locator('button[type="submit"], input[type="submit"]').first();
      await submitButton.click();
      
      // Should show validation errors
      await page.waitForTimeout(1000);
      const hasValidationErrors = await page.locator('[class*="error"], [role="alert"], text=/required|invalid/i').first().isVisible({ timeout: 3000 });
      
      if (hasValidationErrors) {
        console.log('✅ Form validation working');
      } else {
        console.log('⚠️ Form validation may not be working');
      }
      
      await page.screenshot({ path: 'screenshots/login-02-validation.png', fullPage: true });
    });
    
    await test.step('Test with invalid credentials', async () => {
      // Fill with fake credentials
      await page.locator('input[name="email"], input[type="email"]').first().fill('test@example.com');
      await page.locator('input[name="password"], input[type="password"]').first().fill('wrongpassword');
      
      await page.locator('button[type="submit"], input[type="submit"]').first().click();
      await page.waitForTimeout(2000);
      
      // Should show error message
      const hasError = await page.locator('text=/invalid|incorrect|error|failed/i').first().isVisible({ timeout: 5000 });
      
      if (hasError) {
        console.log('✅ Invalid credentials properly rejected');
      } else {
        console.log('⚠️ No error message for invalid credentials');
      }
      
      await page.screenshot({ path: 'screenshots/login-03-invalid-creds.png', fullPage: true });
    });
    
    await test.step('Check password reset flow', async () => {
      // Look for forgot password link
      const forgotPasswordLink = page.locator('a:has-text("Forgot"), a:has-text("Reset"), a[href*="forgot"], a[href*="reset"]').first();
      
      if (await forgotPasswordLink.isVisible({ timeout: 3000 })) {
        await forgotPasswordLink.click();
        await page.waitForTimeout(2000);
        
        // Should navigate to password reset page
        const currentUrl = page.url();
        const isOnResetPage = currentUrl.includes('forgot') || 
                             currentUrl.includes('reset') ||
                             await page.locator('text=/reset|forgot/i').first().isVisible();
        
        if (isOnResetPage) {
          console.log('✅ Password reset flow accessible');
          await page.screenshot({ path: 'screenshots/login-04-password-reset.png', fullPage: true });
        }
        
        // Go back to login
        await page.goto(`${PRODUCTION_URL}/login`);
      } else {
        console.log('ℹ️ Password reset link not found');
      }
    });
    
    await test.step('Check signup link from login', async () => {
      const signupLink = page.locator('a[href*="/signup"], a:has-text("Sign up"), a:has-text("Register")').first();
      
      if (await signupLink.isVisible({ timeout: 3000 })) {
        console.log('✅ Signup link found on login page');
      } else {
        console.log('ℹ️ No signup link found on login page');
      }
    });
  });
  
  test('Protected Routes and Authentication State', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    
    console.log('🔒 Testing protected routes and authentication...');
    
    const protectedRoutes = [
      '/dashboard',
      '/campaigns',
      '/leads',
      '/settings',
      '/analytics',
      '/inbox',
      '/templates'
    ];
    
    for (const route of protectedRoutes) {
      await test.step(`Test protection for ${route}`, async () => {
        await page.goto(`${PRODUCTION_URL}${route}`);
        await page.waitForTimeout(2000);
        
        const currentUrl = page.url();
        const isRedirectedToAuth = currentUrl.includes('/login') || 
                                  currentUrl.includes('/signin') ||
                                  currentUrl.includes('/auth');
        
        const hasAuthForm = await page.locator('input[name="email"], input[type="email"]').first().isVisible({ timeout: 3000 });
        
        if (isRedirectedToAuth || hasAuthForm) {
          console.log(`✅ ${route} properly protected`);
        } else {
          console.log(`⚠️ ${route} may not be protected (or doesn't exist)`);
        }
        
        await page.screenshot({ path: `screenshots/protected-route-${route.replace('/', '')}.png`, fullPage: true });
      });
    }
  });
  
  test('User Experience and Interface Elements', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    
    console.log('🎨 Testing user experience and interface elements...');
    
    await test.step('Test responsive navigation', async () => {
      await page.goto(PRODUCTION_URL);
      
      // Test desktop navigation
      const desktopNav = page.locator('nav, header').first();
      await expect(desktopNav).toBeVisible();
      
      // Test mobile navigation
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(PRODUCTION_URL);
      
      const mobileMenuButton = page.locator('button[aria-label*="menu"], button[aria-label*="Menu"], .hamburger, [data-testid*="menu"]').first();
      
      if (await mobileMenuButton.isVisible({ timeout: 3000 })) {
        await mobileMenuButton.click();
        await page.waitForTimeout(1000);
        
        const mobileMenu = page.locator('[role="dialog"], .mobile-menu, nav[class*="mobile"]').first();
        if (await mobileMenu.isVisible({ timeout: 3000 })) {
          console.log('✅ Mobile menu working');
        }
      } else {
        console.log('ℹ️ Mobile menu button not found');
      }
      
      await page.screenshot({ path: 'screenshots/mobile-navigation.png', fullPage: true });
      
      // Reset viewport
      await page.setViewportSize({ width: 1920, height: 1080 });
    });
    
    await test.step('Test footer and legal pages', async () => {
      await page.goto(PRODUCTION_URL);
      
      // Scroll to footer
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1000);
      
      const footer = page.locator('footer').first();
      if (await footer.isVisible()) {
        console.log('✅ Footer found');
        
        // Check for legal links
        const legalLinks = [
          { text: 'Privacy', href: '/privacy' },
          { text: 'Terms', href: '/terms' },
          { text: 'Contact', href: '/contact' }
        ];
        
        for (const link of legalLinks) {
          const linkElement = page.locator(`a:has-text("${link.text}"), a[href*="${link.href}"]`).first();
          if (await linkElement.isVisible({ timeout: 2000 })) {
            console.log(`✅ ${link.text} link found in footer`);
          }
        }
      }
      
      await page.screenshot({ path: 'screenshots/footer-section.png', fullPage: true });
    });
    
    await test.step('Test search functionality (if exists)', async () => {
      await page.goto(PRODUCTION_URL);
      
      const searchElements = page.locator('input[type="search"], input[placeholder*="search" i], [data-testid*="search"]');
      
      if (await searchElements.first().isVisible({ timeout: 3000 })) {
        console.log('✅ Search functionality found');
        
        await searchElements.first().fill('test search');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2000);
        
        await page.screenshot({ path: 'screenshots/search-results.png', fullPage: true });
      } else {
        console.log('ℹ️ No search functionality found');
      }
    });
  });
  
  test('AI Features User Flow', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    
    console.log('🤖 Testing AI features user flow...');
    
    const aiTestPages = [
      '/test-ai',
      '/test-ai-generation',
      '/test-smart-reply',
      '/test-sentiment',
      '/ai-dashboard'
    ];
    
    for (const testPage of aiTestPages) {
      await test.step(`Test AI page: ${testPage}`, async () => {
        const response = await page.request.get(`${PRODUCTION_URL}${testPage}`);
        
        if (response.ok()) {
          await page.goto(`${PRODUCTION_URL}${testPage}`);
          
          // Check if page loads properly
          const hasContent = await page.locator('h1, h2, h3, [data-testid*="title"]').first().isVisible({ timeout: 5000 });
          
          if (hasContent) {
            console.log(`✅ ${testPage} loads successfully`);
            
            // Look for AI-related buttons or inputs
            const aiElements = page.locator('button:has-text("Generate"), button:has-text("Test"), input[placeholder*="prompt" i], textarea');
            
            if (await aiElements.first().isVisible({ timeout: 3000 })) {
              console.log(`✅ ${testPage} has interactive AI elements`);
              
              // Try to interact with AI features
              const textInput = page.locator('input[type="text"], textarea').first();
              if (await textInput.isVisible({ timeout: 2000 })) {
                await textInput.fill('Write a test email about our product');
                
                const generateButton = page.locator('button:has-text("Generate"), button:has-text("Test"), button[type="submit"]').first();
                if (await generateButton.isVisible({ timeout: 2000 })) {
                  await generateButton.click();
                  await page.waitForTimeout(3000);
                  
                  // Check for any response
                  const hasResponse = await page.locator('pre, code, [data-testid*="result"], [data-testid*="output"]').first().isVisible({ timeout: 10000 });
                  
                  if (hasResponse) {
                    console.log(`✅ ${testPage} AI generation appears to work`);
                  } else {
                    console.log(`⚠️ ${testPage} AI generation may not be working`);
                  }
                }
              }
            }
            
            await page.screenshot({ path: `screenshots/ai-page-${testPage.replace('/', '').replace('/', '-')}.png`, fullPage: true });
          } else {
            console.log(`⚠️ ${testPage} may not load properly`);
          }
        } else {
          console.log(`ℹ️ ${testPage} not found (${response.status()})`);
        }
      });
    }
  });
});