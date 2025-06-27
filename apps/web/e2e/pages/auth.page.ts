import { Page, Locator } from '@playwright/test'
import { BasePage } from './base.page'

/**
 * Page Object Model for Authentication pages
 */
export class AuthPage extends BasePage {
  // Login page elements
  get emailInput(): Locator {
    return this.page.locator('input[name="email"]')
  }

  get passwordInput(): Locator {
    return this.page.locator('input[name="password"]')
  }

  get loginButton(): Locator {
    return this.page.locator('button[type="submit"]')
  }

  get signUpLink(): Locator {
    return this.page.locator('a[href="/signup"]')
  }

  get forgotPasswordLink(): Locator {
    return this.page.locator('a[href="/forgot-password"]')
  }

  // Sign up page elements
  get fullNameInput(): Locator {
    return this.page.locator('input[name="fullName"]')
  }

  get confirmPasswordInput(): Locator {
    return this.page.locator('input[name="confirmPassword"]')
  }

  get signUpButton(): Locator {
    return this.page.locator('button[type="submit"]')
  }

  get termsCheckbox(): Locator {
    return this.page.locator('input[name="acceptTerms"]')
  }

  get privacyCheckbox(): Locator {
    return this.page.locator('input[name="acceptPrivacy"]')
  }

  get loginLink(): Locator {
    return this.page.locator('a[href="/login"]')
  }

  // Email verification elements
  get verificationMessage(): Locator {
    return this.page.locator('[data-testid="verification-message"]')
  }

  get resendEmailButton(): Locator {
    return this.page.locator('button[data-testid="resend-email"]')
  }

  get verificationCodeInput(): Locator {
    return this.page.locator('input[name="verificationCode"]')
  }

  get verifyButton(): Locator {
    return this.page.locator('button[data-testid="verify-button"]')
  }

  // Password reset elements
  get resetEmailInput(): Locator {
    return this.page.locator('input[name="resetEmail"]')
  }

  get sendResetButton(): Locator {
    return this.page.locator('button[data-testid="send-reset"]')
  }

  get newPasswordInput(): Locator {
    return this.page.locator('input[name="newPassword"]')
  }

  get confirmNewPasswordInput(): Locator {
    return this.page.locator('input[name="confirmNewPassword"]')
  }

  get resetPasswordButton(): Locator {
    return this.page.locator('button[data-testid="reset-password"]')
  }

  // Actions
  async goToLogin(): Promise<void> {
    await this.goto('/login')
  }

  async goToSignUp(): Promise<void> {
    await this.goto('/signup')
  }

  async login(email: string, password: string): Promise<void> {
    await this.goToLogin()
    await this.emailInput.fill(email)
    await this.passwordInput.fill(password)
    await this.loginButton.click()
    await this.waitForPageLoad()
  }

  async signUp(userData: {
    email: string
    password: string
    fullName: string
    confirmPassword?: string
  }): Promise<void> {
    await this.goToSignUp()
    
    await this.emailInput.fill(userData.email)
    await this.passwordInput.fill(userData.password)
    await this.fullNameInput.fill(userData.fullName)
    
    if (userData.confirmPassword) {
      await this.confirmPasswordInput.fill(userData.confirmPassword)
    }
    
    // Accept terms and privacy policy
    await this.termsCheckbox.check()
    await this.privacyCheckbox.check()
    
    await this.signUpButton.click()
    await this.waitForPageLoad()
  }

  async verifyEmail(code: string): Promise<void> {
    await this.verificationCodeInput.fill(code)
    await this.verifyButton.click()
    await this.waitForPageLoad()
  }

  async resendVerificationEmail(): Promise<void> {
    await this.resendEmailButton.click()
    await this.waitForText('Verification email sent')
  }

  async requestPasswordReset(email: string): Promise<void> {
    await this.goto('/forgot-password')
    await this.resetEmailInput.fill(email)
    await this.sendResetButton.click()
    await this.waitForText('Reset email sent')
  }

  async resetPassword(newPassword: string, confirmPassword?: string): Promise<void> {
    await this.newPasswordInput.fill(newPassword)
    await this.confirmNewPasswordInput.fill(confirmPassword || newPassword)
    await this.resetPasswordButton.click()
    await this.waitForPageLoad()
  }

  async switchToSignUp(): Promise<void> {
    await this.signUpLink.click()
    await this.waitForUrl('/signup')
  }

  async switchToLogin(): Promise<void> {
    await this.loginLink.click()
    await this.waitForUrl('/login')
  }

  // Validation helpers
  async expectLoginSuccess(): Promise<void> {
    await this.expectUrl(/\/dashboard/)
  }

  async expectSignUpSuccess(): Promise<void> {
    await this.expectUrl(/\/signup\/verify-email/)
    await this.expectVisible('[data-testid="verification-message"]')
  }

  async expectEmailVerificationSuccess(): Promise<void> {
    await this.expectUrl(/\/dashboard/)
  }

  async expectPasswordResetSuccess(): Promise<void> {
    await this.expectUrl(/\/login/)
    await this.expectText('[data-testid="success-message"]', 'Password reset successful')
  }

  async expectLoginError(errorMessage?: string): Promise<void> {
    await this.expectVisible('[data-testid="error-message"]')
    if (errorMessage) {
      await this.expectText('[data-testid="error-message"]', errorMessage)
    }
  }

  async expectSignUpError(errorMessage?: string): Promise<void> {
    await this.expectVisible('[data-testid="error-message"]')
    if (errorMessage) {
      await this.expectText('[data-testid="error-message"]', errorMessage)
    }
  }

  // Form validation helpers
  async expectEmailValidationError(): Promise<void> {
    await this.expectVisible('input[name="email"]:invalid')
  }

  async expectPasswordValidationError(): Promise<void> {
    await this.expectVisible('input[name="password"]:invalid')
  }

  async expectPasswordMatchError(): Promise<void> {
    await this.expectText('[data-testid="password-match-error"]', 'Passwords do not match')
  }

  async expectTermsValidationError(): Promise<void> {
    await this.expectText('[data-testid="terms-error"]', 'You must accept the terms')
  }

  // Social auth helpers (if implemented)
  get googleSignInButton(): Locator {
    return this.page.locator('button[data-testid="google-signin"]')
  }

  get githubSignInButton(): Locator {
    return this.page.locator('button[data-testid="github-signin"]')
  }

  async signInWithGoogle(): Promise<void> {
    await this.googleSignInButton.click()
    // Handle OAuth flow - would need to be mocked in tests
  }

  async signInWithGitHub(): Promise<void> {
    await this.githubSignInButton.click()
    // Handle OAuth flow - would need to be mocked in tests
  }

  // Remember me functionality
  get rememberMeCheckbox(): Locator {
    return this.page.locator('input[name="rememberMe"]')
  }

  async loginWithRememberMe(email: string, password: string): Promise<void> {
    await this.goToLogin()
    await this.emailInput.fill(email)
    await this.passwordInput.fill(password)
    await this.rememberMeCheckbox.check()
    await this.loginButton.click()
    await this.waitForPageLoad()
  }

  // Two-factor authentication (if implemented)
  get twoFactorCodeInput(): Locator {
    return this.page.locator('input[name="twoFactorCode"]')
  }

  get verifyTwoFactorButton(): Locator {
    return this.page.locator('button[data-testid="verify-2fa"]')
  }

  async enterTwoFactorCode(code: string): Promise<void> {
    await this.twoFactorCodeInput.fill(code)
    await this.verifyTwoFactorButton.click()
    await this.waitForPageLoad()
  }

  // Session management
  async checkAuthState(): Promise<boolean> {
    try {
      await this.page.goto('/dashboard')
      await this.waitForUrl('/dashboard')
      return true
    } catch {
      return false
    }
  }

  async signOut(): Promise<void> {
    await this.page.click('button[aria-label="User menu"]')
    await this.page.click('text=Sign out')
    await this.waitForUrl('/')
  }
}