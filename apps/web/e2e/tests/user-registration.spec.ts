import { test, expect } from '@playwright/test'
import { faker } from '@faker-js/faker'
import { AuthPage } from '../pages/auth.page'
import { OnboardingPage } from '../pages/onboarding.page'
import { visualRegressionHelpers } from '../helpers/visual-regression'

test.describe('User Registration & Onboarding', () => {
  let authPage: AuthPage
  let onboardingPage: OnboardingPage

  test.beforeEach(async ({ page }) => {
    authPage = new AuthPage(page)
    onboardingPage = new OnboardingPage(page)
    
    // Clear any existing auth state
    await authPage.clearStorage()
  })

  test.describe('Sign Up Flow', () => {
    test('should complete successful user registration', async ({ page }) => {
      const userData = {
        email: faker.internet.email(),
        password: 'SecurePassword123!',
        fullName: faker.person.fullName(),
        confirmPassword: 'SecurePassword123!'
      }

      // Take screenshot of sign up page
      await authPage.goToSignUp()
      await visualRegressionHelpers.takeScreenshot(page, 'signup-page-initial')

      // Fill and submit sign up form
      await authPage.signUp(userData)

      // Verify redirect to email verification
      await authPage.expectSignUpSuccess()
      await visualRegressionHelpers.takeScreenshot(page, 'email-verification-page')

      // Check accessibility
      await authPage.checkAccessibility()
    })

    test('should validate email format', async ({ page }) => {
      await authPage.goToSignUp()
      
      await authPage.emailInput.fill('invalid-email')
      await authPage.passwordInput.fill('password123')
      await authPage.fullNameInput.fill('Test User')
      await authPage.termsCheckbox.check()
      await authPage.privacyCheckbox.check()
      
      await authPage.signUpButton.click()
      await authPage.expectEmailValidationError()
    })

    test('should validate password strength', async ({ page }) => {
      await authPage.goToSignUp()
      
      await authPage.emailInput.fill(faker.internet.email())
      await authPage.passwordInput.fill('weak')
      await authPage.confirmPasswordInput.fill('weak')
      await authPage.fullNameInput.fill('Test User')
      
      await authPage.signUpButton.click()
      await authPage.expectPasswordValidationError()
    })

    test('should validate password confirmation match', async ({ page }) => {
      await authPage.goToSignUp()
      
      await authPage.emailInput.fill(faker.internet.email())
      await authPage.passwordInput.fill('SecurePassword123!')
      await authPage.confirmPasswordInput.fill('DifferentPassword123!')
      await authPage.fullNameInput.fill('Test User')
      
      await authPage.signUpButton.click()
      await authPage.expectPasswordMatchError()
    })

    test('should require terms and privacy acceptance', async ({ page }) => {
      await authPage.goToSignUp()
      
      await authPage.emailInput.fill(faker.internet.email())
      await authPage.passwordInput.fill('SecurePassword123!')
      await authPage.confirmPasswordInput.fill('SecurePassword123!')
      await authPage.fullNameInput.fill('Test User')
      
      await authPage.signUpButton.click()
      await authPage.expectTermsValidationError()
    })

    test('should handle duplicate email registration', async ({ page }) => {
      const email = faker.internet.email()
      
      // First registration
      await authPage.signUp({
        email,
        password: 'SecurePassword123!',
        fullName: 'First User'
      })
      
      // Clear storage and try to register again with same email
      await authPage.clearStorage()
      await authPage.goToSignUp()
      
      await authPage.signUp({
        email, // Same email
        password: 'DifferentPassword123!',
        fullName: 'Second User'
      })
      
      await authPage.expectSignUpError('Email already exists')
    })

    test('should work on mobile devices', async ({ page, isMobile }) => {
      test.skip(!isMobile, 'Mobile-specific test')
      
      await authPage.goToSignUp()
      await visualRegressionHelpers.takeScreenshot(page, 'signup-page-mobile')
      
      const userData = {
        email: faker.internet.email(),
        password: 'SecurePassword123!',
        fullName: faker.person.fullName()
      }
      
      await authPage.signUp(userData)
      await authPage.expectSignUpSuccess()
    })
  })

  test.describe('Email Verification', () => {
    test('should verify email with valid code', async ({ page }) => {
      // Mock verification code
      const verificationCode = '123456'
      
      // Mock API response for verification
      await page.route('**/api/auth/verify-email', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        })
      })
      
      // Complete sign up first
      const userData = {
        email: faker.internet.email(),
        password: 'SecurePassword123!',
        fullName: faker.person.fullName()
      }
      await authPage.signUp(userData)
      
      // Verify email
      await authPage.verifyEmail(verificationCode)
      await authPage.expectEmailVerificationSuccess()
    })

    test('should handle invalid verification code', async ({ page }) => {
      // Mock API response for invalid code
      await page.route('**/api/auth/verify-email', async (route) => {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Invalid verification code' })
        })
      })
      
      const userData = {
        email: faker.internet.email(),
        password: 'SecurePassword123!',
        fullName: faker.person.fullName()
      }
      await authPage.signUp(userData)
      
      await authPage.verifyEmail('000000')
      await authPage.expectVisible('[data-testid="error-message"]')
    })

    test('should resend verification email', async ({ page }) => {
      // Mock API responses
      await page.route('**/api/auth/resend-verification', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        })
      })
      
      const userData = {
        email: faker.internet.email(),
        password: 'SecurePassword123!',
        fullName: faker.person.fullName()
      }
      await authPage.signUp(userData)
      
      await authPage.resendVerificationEmail()
      await authPage.expectText('[data-testid="success-message"]', 'Verification email sent')
    })
  })

  test.describe('Complete Onboarding Flow', () => {
    test('should complete full onboarding process', async ({ page }) => {
      // Complete registration first
      const userData = {
        email: faker.internet.email(),
        password: 'SecurePassword123!',
        fullName: faker.person.fullName()
      }
      
      await authPage.signUp(userData)
      
      // Mock email verification
      await page.route('**/api/auth/verify-email', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        })
      })
      
      await authPage.verifyEmail('123456')
      
      // Complete onboarding
      const onboardingData = {
        workspace: {
          name: faker.company.name(),
          description: faker.company.catchPhrase(),
          industry: 'Technology',
          companySize: '1-10'
        },
        profile: {
          firstName: faker.person.firstName(),
          lastName: faker.person.lastName(),
          jobTitle: faker.person.jobTitle(),
          phone: faker.phone.number(),
          timezone: 'America/New_York'
        },
        preferences: {
          goals: ['lead-generation', 'customer-outreach'],
          emailVolume: '100-500',
          useCase: 'sales',
          teamSize: '5'
        },
        email: {
          provider: 'gmail'
        }
      }
      
      await onboardingPage.completeFullOnboarding(onboardingData)
      await onboardingPage.expectOnboardingComplete()
      
      // Take final screenshot
      await visualRegressionHelpers.takeScreenshot(page, 'onboarding-complete')
    })

    test('should handle workspace creation', async ({ page }) => {
      // Skip to onboarding for this test
      await page.goto('/onboarding')
      
      const workspaceData = {
        name: faker.company.name(),
        description: faker.company.catchPhrase(),
        industry: 'Technology',
        companySize: '1-10'
      }
      
      await onboardingPage.createWorkspace(workspaceData)
      await onboardingPage.expectWorkspaceCreated()
    })

    test('should handle profile completion', async ({ page }) => {
      await page.goto('/onboarding/profile')
      
      const profileData = {
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        jobTitle: faker.person.jobTitle(),
        timezone: 'America/New_York'
      }
      
      await onboardingPage.completeProfile(profileData)
      await onboardingPage.expectProfileSaved()
    })

    test('should allow skipping onboarding', async ({ page }) => {
      await page.goto('/onboarding')
      await onboardingPage.skipOnboarding()
      await onboardingPage.expectUrl('/dashboard')
    })

    test('should handle navigation between onboarding steps', async ({ page }) => {
      await page.goto('/onboarding')
      
      // Test forward navigation
      await onboardingPage.getStartedButton.click()
      await onboardingPage.expectOnboardingStep(1)
      
      await onboardingPage.goToNextStep()
      await onboardingPage.expectOnboardingStep(2)
      
      // Test backward navigation
      await onboardingPage.goToPreviousStep()
      await onboardingPage.expectOnboardingStep(1)
    })
  })

  test.describe('Trial Setup', () => {
    test('should start trial without payment method', async ({ page }) => {
      await page.goto('/onboarding/trial')
      
      await onboardingPage.startTrial('professional')
      await onboardingPage.expectTrialStarted()
    })

    test('should add payment method during onboarding', async ({ page }) => {
      await page.goto('/onboarding/payment')
      
      const paymentData = {
        cardNumber: '4242424242424242',
        expiry: '12/25',
        cvc: '123',
        name: 'Test User',
        address: '123 Test St, Test City, TS 12345'
      }
      
      await onboardingPage.addPaymentMethod(paymentData)
      await onboardingPage.expectPaymentMethodAdded()
    })

    test('should handle payment method validation', async ({ page }) => {
      await page.goto('/onboarding/payment')
      
      const invalidPaymentData = {
        cardNumber: '1234',
        expiry: '01/20',
        cvc: '12',
        name: '',
        address: ''
      }
      
      await onboardingPage.addPaymentMethod(invalidPaymentData)
      await onboardingPage.expectPaymentMethodError()
    })
  })

  test.describe('Email Configuration', () => {
    test('should configure email settings', async ({ page }) => {
      await page.goto('/onboarding/email')
      
      const emailConfig = {
        provider: 'gmail'
      }
      
      await onboardingPage.configureEmail(emailConfig)
      await onboardingPage.expectEmailConfigured()
    })

    test('should test email configuration', async ({ page }) => {
      await page.goto('/onboarding/email')
      
      // Mock test email API
      await page.route('**/api/email/test', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        })
      })
      
      const emailConfig = {
        provider: 'custom',
        server: 'smtp.example.com',
        port: '587',
        username: 'test@example.com',
        password: 'password'
      }
      
      await onboardingPage.configureEmail(emailConfig)
      await onboardingPage.testEmailConfiguration()
    })

    test('should handle email configuration errors', async ({ page }) => {
      await page.goto('/onboarding/email')
      
      // Mock error response
      await page.route('**/api/email/test', async (route) => {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Invalid SMTP configuration' })
        })
      })
      
      const invalidConfig = {
        provider: 'custom',
        server: 'invalid.server',
        port: 'invalid',
        username: 'invalid',
        password: 'invalid'
      }
      
      await onboardingPage.configureEmail(invalidConfig)
      await onboardingPage.expectEmailConfigurationError()
    })
  })

  test.describe('Visual Regression', () => {
    test('should match visual snapshots for all onboarding steps', async ({ page }) => {
      const steps = [
        { url: '/signup', name: 'signup' },
        { url: '/login', name: 'login' },
        { url: '/onboarding', name: 'onboarding-welcome' },
        { url: '/onboarding/workspace', name: 'onboarding-workspace' },
        { url: '/onboarding/profile', name: 'onboarding-profile' },
        { url: '/onboarding/preferences', name: 'onboarding-preferences' },
        { url: '/onboarding/email', name: 'onboarding-email' },
        { url: '/onboarding/payment', name: 'onboarding-payment' },
        { url: '/onboarding/trial', name: 'onboarding-trial' }
      ]
      
      for (const step of steps) {
        await page.goto(step.url)
        await page.waitForLoadState('networkidle')
        await visualRegressionHelpers.takeScreenshot(page, step.name)
      }
    })

    test('should test responsive design for registration', async ({ page }) => {
      await visualRegressionHelpers.testResponsive(
        page,
        '/signup',
        'signup-responsive'
      )
    })

    test('should test dark mode for auth pages', async ({ page }) => {
      await page.goto('/signup')
      await visualRegressionHelpers.testDarkMode(page, 'signup-dark-mode')
      
      await page.goto('/login')
      await visualRegressionHelpers.testDarkMode(page, 'login-dark-mode')
    })
  })

  test.describe('Accessibility', () => {
    test('should be accessible with keyboard navigation', async ({ page }) => {
      await authPage.goToSignUp()
      
      // Test tab navigation
      await page.keyboard.press('Tab') // Email field
      await page.keyboard.press('Tab') // Password field
      await page.keyboard.press('Tab') // Confirm password field
      await page.keyboard.press('Tab') // Full name field
      await page.keyboard.press('Tab') // Terms checkbox
      await page.keyboard.press('Space') // Check terms
      await page.keyboard.press('Tab') // Privacy checkbox
      await page.keyboard.press('Space') // Check privacy
      await page.keyboard.press('Tab') // Submit button
      
      // Verify we can interact with form using only keyboard
      await authPage.expectVisible('input[name="acceptTerms"]:checked')
      await authPage.expectVisible('input[name="acceptPrivacy"]:checked')
    })

    test('should have proper ARIA labels and roles', async ({ page }) => {
      await authPage.goToSignUp()
      
      // Check for proper ARIA attributes
      const emailInput = page.locator('input[name="email"]')
      await expect(emailInput).toHaveAttribute('aria-label')
      
      const submitButton = page.locator('button[type="submit"]')
      await expect(submitButton).toHaveAttribute('role', 'button')
    })

    test('should announce form validation errors to screen readers', async ({ page }) => {
      await authPage.goToSignUp()
      
      await authPage.signUpButton.click()
      
      // Check for aria-live regions or aria-describedby attributes
      const errorMessage = page.locator('[data-testid="error-message"]')
      await expect(errorMessage).toHaveAttribute('aria-live', 'polite')
    })
  })

  test.describe('Performance', () => {
    test('should load registration page quickly', async ({ page }) => {
      const startTime = Date.now()
      await authPage.goToSignUp()
      await page.waitForLoadState('networkidle')
      const loadTime = Date.now() - startTime
      
      expect(loadTime).toBeLessThan(3000) // Should load within 3 seconds
    })

    test('should handle large number of form submissions', async ({ page }) => {
      // Test form submission performance
      const submissions = []
      
      for (let i = 0; i < 5; i++) {
        const userData = {
          email: faker.internet.email(),
          password: 'SecurePassword123!',
          fullName: faker.person.fullName()
        }
        
        const startTime = Date.now()
        await authPage.signUp(userData)
        const endTime = Date.now()
        
        submissions.push(endTime - startTime)
        
        // Reset for next iteration
        await authPage.clearStorage()
        await authPage.goToSignUp()
      }
      
      const averageTime = submissions.reduce((a, b) => a + b, 0) / submissions.length
      expect(averageTime).toBeLessThan(5000) // Average should be under 5 seconds
    })
  })
})