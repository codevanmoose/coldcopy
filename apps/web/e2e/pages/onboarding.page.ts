import { Page, Locator } from '@playwright/test'
import { BasePage } from './base.page'

/**
 * Page Object Model for Onboarding flow
 */
export class OnboardingPage extends BasePage {
  // Welcome step elements
  get welcomeTitle(): Locator {
    return this.page.locator('[data-testid="welcome-title"]')
  }

  get getStartedButton(): Locator {
    return this.page.locator('button[data-testid="get-started"]')
  }

  get skipOnboardingLink(): Locator {
    return this.page.locator('a[data-testid="skip-onboarding"]')
  }

  // Workspace setup elements
  get workspaceNameInput(): Locator {
    return this.page.locator('input[name="workspaceName"]')
  }

  get workspaceDescriptionInput(): Locator {
    return this.page.locator('textarea[name="workspaceDescription"]')
  }

  get industrySelect(): Locator {
    return this.page.locator('select[name="industry"]')
  }

  get companySizeSelect(): Locator {
    return this.page.locator('select[name="companySize"]')
  }

  get createWorkspaceButton(): Locator {
    return this.page.locator('button[data-testid="create-workspace"]')
  }

  // Profile completion elements
  get firstNameInput(): Locator {
    return this.page.locator('input[name="firstName"]')
  }

  get lastNameInput(): Locator {
    return this.page.locator('input[name="lastName"]')
  }

  get jobTitleInput(): Locator {
    return this.page.locator('input[name="jobTitle"]')
  }

  get phoneInput(): Locator {
    return this.page.locator('input[name="phone"]')
  }

  get timezoneSelect(): Locator {
    return this.page.locator('select[name="timezone"]')
  }

  get avatarUpload(): Locator {
    return this.page.locator('input[type="file"][data-testid="avatar-upload"]')
  }

  get saveProfileButton(): Locator {
    return this.page.locator('button[data-testid="save-profile"]')
  }

  // Goals and preferences elements
  get goalCheckboxes(): Locator {
    return this.page.locator('input[name="goals"]')
  }

  get expectedEmailVolumeSelect(): Locator {
    return this.page.locator('select[name="expectedEmailVolume"]')
  }

  get primaryUseCase(): Locator {
    return this.page.locator('select[name="primaryUseCase"]')
  }

  get teamSizeInput(): Locator {
    return this.page.locator('input[name="teamSize"]')
  }

  get savePreferencesButton(): Locator {
    return this.page.locator('button[data-testid="save-preferences"]')
  }

  // Email configuration elements
  get emailProviderSelect(): Locator {
    return this.page.locator('select[name="emailProvider"]')
  }

  get smtpServerInput(): Locator {
    return this.page.locator('input[name="smtpServer"]')
  }

  get smtpPortInput(): Locator {
    return this.page.locator('input[name="smtpPort"]')
  }

  get smtpUsernameInput(): Locator {
    return this.page.locator('input[name="smtpUsername"]')
  }

  get smtpPasswordInput(): Locator {
    return this.page.locator('input[name="smtpPassword"]')
  }

  get testEmailButton(): Locator {
    return this.page.locator('button[data-testid="test-email"]')
  }

  get saveEmailConfigButton(): Locator {
    return this.page.locator('button[data-testid="save-email-config"]')
  }

  // Payment method elements (optional)
  get addPaymentMethodButton(): Locator {
    return this.page.locator('button[data-testid="add-payment-method"]')
  }

  get cardNumberInput(): Locator {
    return this.page.locator('input[name="cardNumber"]')
  }

  get expiryInput(): Locator {
    return this.page.locator('input[name="expiry"]')
  }

  get cvcInput(): Locator {
    return this.page.locator('input[name="cvc"]')
  }

  get billingNameInput(): Locator {
    return this.page.locator('input[name="billingName"]')
  }

  get billingAddressInput(): Locator {
    return this.page.locator('input[name="billingAddress"]')
  }

  get savePaymentMethodButton(): Locator {
    return this.page.locator('button[data-testid="save-payment-method"]')
  }

  get skipPaymentButton(): Locator {
    return this.page.locator('button[data-testid="skip-payment"]')
  }

  // Trial setup elements
  get startTrialButton(): Locator {
    return this.page.locator('button[data-testid="start-trial"]')
  }

  get trialPlanSelect(): Locator {
    return this.page.locator('select[name="trialPlan"]')
  }

  get trialDurationInfo(): Locator {
    return this.page.locator('[data-testid="trial-duration-info"]')
  }

  // Progress indicators
  get progressBar(): Locator {
    return this.page.locator('[data-testid="progress-bar"]')
  }

  get stepIndicator(): Locator {
    return this.page.locator('[data-testid="step-indicator"]')
  }

  get nextButton(): Locator {
    return this.page.locator('button[data-testid="next-step"]')
  }

  get previousButton(): Locator {
    return this.page.locator('button[data-testid="previous-step"]')
  }

  get finishButton(): Locator {
    return this.page.locator('button[data-testid="finish-onboarding"]')
  }

  // Actions
  async startOnboarding(): Promise<void> {
    await this.goto('/onboarding')
    await this.getStartedButton.click()
    await this.waitForPageLoad()
  }

  async skipOnboarding(): Promise<void> {
    await this.skipOnboardingLink.click()
    await this.waitForUrl('/dashboard')
  }

  async createWorkspace(workspaceData: {
    name: string
    description: string
    industry: string
    companySize: string
  }): Promise<void> {
    await this.workspaceNameInput.fill(workspaceData.name)
    await this.workspaceDescriptionInput.fill(workspaceData.description)
    await this.industrySelect.selectOption(workspaceData.industry)
    await this.companySizeSelect.selectOption(workspaceData.companySize)
    await this.createWorkspaceButton.click()
    await this.waitForPageLoad()
  }

  async completeProfile(profileData: {
    firstName: string
    lastName: string
    jobTitle: string
    phone?: string
    timezone: string
    avatar?: string
  }): Promise<void> {
    await this.firstNameInput.fill(profileData.firstName)
    await this.lastNameInput.fill(profileData.lastName)
    await this.jobTitleInput.fill(profileData.jobTitle)
    
    if (profileData.phone) {
      await this.phoneInput.fill(profileData.phone)
    }
    
    await this.timezoneSelect.selectOption(profileData.timezone)
    
    if (profileData.avatar) {
      await this.avatarUpload.setInputFiles(profileData.avatar)
    }
    
    await this.saveProfileButton.click()
    await this.waitForPageLoad()
  }

  async setGoalsAndPreferences(preferences: {
    goals: string[]
    emailVolume: string
    useCase: string
    teamSize: string
  }): Promise<void> {
    // Select goals
    for (const goal of preferences.goals) {
      await this.page.check(`input[name="goals"][value="${goal}"]`)
    }
    
    await this.expectedEmailVolumeSelect.selectOption(preferences.emailVolume)
    await this.primaryUseCase.selectOption(preferences.useCase)
    await this.teamSizeInput.fill(preferences.teamSize)
    
    await this.savePreferencesButton.click()
    await this.waitForPageLoad()
  }

  async configureEmail(emailConfig: {
    provider: string
    server?: string
    port?: string
    username?: string
    password?: string
  }): Promise<void> {
    await this.emailProviderSelect.selectOption(emailConfig.provider)
    
    if (emailConfig.provider === 'custom') {
      await this.smtpServerInput.fill(emailConfig.server || '')
      await this.smtpPortInput.fill(emailConfig.port || '')
      await this.smtpUsernameInput.fill(emailConfig.username || '')
      await this.smtpPasswordInput.fill(emailConfig.password || '')
    }
    
    await this.saveEmailConfigButton.click()
    await this.waitForPageLoad()
  }

  async testEmailConfiguration(): Promise<void> {
    await this.testEmailButton.click()
    await this.waitForText('Test email sent successfully')
  }

  async addPaymentMethod(paymentData: {
    cardNumber: string
    expiry: string
    cvc: string
    name: string
    address: string
  }): Promise<void> {
    await this.addPaymentMethodButton.click()
    await this.cardNumberInput.fill(paymentData.cardNumber)
    await this.expiryInput.fill(paymentData.expiry)
    await this.cvcInput.fill(paymentData.cvc)
    await this.billingNameInput.fill(paymentData.name)
    await this.billingAddressInput.fill(paymentData.address)
    await this.savePaymentMethodButton.click()
    await this.waitForPageLoad()
  }

  async skipPaymentMethod(): Promise<void> {
    await this.skipPaymentButton.click()
    await this.waitForPageLoad()
  }

  async startTrial(planName?: string): Promise<void> {
    if (planName) {
      await this.trialPlanSelect.selectOption(planName)
    }
    await this.startTrialButton.click()
    await this.waitForPageLoad()
  }

  async goToNextStep(): Promise<void> {
    await this.nextButton.click()
    await this.waitForPageLoad()
  }

  async goToPreviousStep(): Promise<void> {
    await this.previousButton.click()
    await this.waitForPageLoad()
  }

  async finishOnboarding(): Promise<void> {
    await this.finishButton.click()
    await this.waitForUrl('/dashboard')
  }

  async completeFullOnboarding(data: {
    workspace: {
      name: string
      description: string
      industry: string
      companySize: string
    }
    profile: {
      firstName: string
      lastName: string
      jobTitle: string
      phone?: string
      timezone: string
    }
    preferences: {
      goals: string[]
      emailVolume: string
      useCase: string
      teamSize: string
    }
    email: {
      provider: string
      server?: string
      port?: string
      username?: string
      password?: string
    }
    payment?: {
      cardNumber: string
      expiry: string
      cvc: string
      name: string
      address: string
    }
    trialPlan?: string
  }): Promise<void> {
    await this.startOnboarding()
    await this.createWorkspace(data.workspace)
    await this.completeProfile(data.profile)
    await this.setGoalsAndPreferences(data.preferences)
    await this.configureEmail(data.email)
    
    if (data.payment) {
      await this.addPaymentMethod(data.payment)
    } else {
      await this.skipPaymentMethod()
    }
    
    await this.startTrial(data.trialPlan)
    await this.finishOnboarding()
  }

  // Validation helpers
  async expectOnboardingStep(stepNumber: number): Promise<void> {
    await this.expectText('[data-testid="current-step"]', stepNumber.toString())
  }

  async expectProgressPercentage(percentage: number): Promise<void> {
    await this.expectText('[data-testid="progress-percentage"]', `${percentage}%`)
  }

  async expectWorkspaceCreated(): Promise<void> {
    await this.expectText('[data-testid="success-message"]', 'Workspace created successfully')
  }

  async expectProfileSaved(): Promise<void> {
    await this.expectText('[data-testid="success-message"]', 'Profile saved successfully')
  }

  async expectEmailConfigured(): Promise<void> {
    await this.expectText('[data-testid="success-message"]', 'Email configuration saved')
  }

  async expectPaymentMethodAdded(): Promise<void> {
    await this.expectText('[data-testid="success-message"]', 'Payment method added successfully')
  }

  async expectTrialStarted(): Promise<void> {
    await this.expectText('[data-testid="trial-status"]', 'Trial active')
  }

  async expectOnboardingComplete(): Promise<void> {
    await this.expectUrl('/dashboard')
    await this.expectText('[data-testid="welcome-message"]', 'Welcome to ColdCopy!')
  }

  // Form validation helpers
  async expectWorkspaceNameRequired(): Promise<void> {
    await this.expectText('[data-testid="workspace-name-error"]', 'Workspace name is required')
  }

  async expectEmailConfigurationError(): Promise<void> {
    await this.expectText('[data-testid="email-config-error"]', 'Invalid email configuration')
  }

  async expectPaymentMethodError(): Promise<void> {
    await this.expectText('[data-testid="payment-error"]', 'Invalid payment information')
  }
}