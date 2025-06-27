import { Page, Locator } from '@playwright/test'
import { BasePage } from './base.page'

/**
 * Page Object Model for Billing and Subscription management
 */
export class BillingPage extends BasePage {
  // Subscription overview elements
  get currentPlanCard(): Locator {
    return this.page.locator('[data-testid="current-plan-card"]')
  }

  get planName(): Locator {
    return this.page.locator('[data-testid="plan-name"]')
  }

  get planPrice(): Locator {
    return this.page.locator('[data-testid="plan-price"]')
  }

  get billingCycle(): Locator {
    return this.page.locator('[data-testid="billing-cycle"]')
  }

  get nextBillingDate(): Locator {
    return this.page.locator('[data-testid="next-billing-date"]')
  }

  get subscriptionStatus(): Locator {
    return this.page.locator('[data-testid="subscription-status"]')
  }

  // Trial elements
  get trialBanner(): Locator {
    return this.page.locator('[data-testid="trial-banner"]')
  }

  get trialDaysRemaining(): Locator {
    return this.page.locator('[data-testid="trial-days-remaining"]')
  }

  get upgradeTrialButton(): Locator {
    return this.page.locator('button[data-testid="upgrade-trial"]')
  }

  get extendTrialButton(): Locator {
    return this.page.locator('button[data-testid="extend-trial"]')
  }

  // Plan selection elements
  get planCards(): Locator {
    return this.page.locator('[data-testid="plan-card"]')
  }

  get selectPlanButtons(): Locator {
    return this.page.locator('button[data-testid^="select-plan-"]')
  }

  get planComparison(): Locator {
    return this.page.locator('[data-testid="plan-comparison"]')
  }

  get monthlyToggle(): Locator {
    return this.page.locator('input[data-testid="monthly-toggle"]')
  }

  get yearlyToggle(): Locator {
    return this.page.locator('input[data-testid="yearly-toggle"]')
  }

  get billingFrequencyToggle(): Locator {
    return this.page.locator('[data-testid="billing-frequency-toggle"]')
  }

  // Payment method elements
  get paymentMethodsSection(): Locator {
    return this.page.locator('[data-testid="payment-methods-section"]')
  }

  get addPaymentMethodButton(): Locator {
    return this.page.locator('button[data-testid="add-payment-method"]')
  }

  get paymentMethodCards(): Locator {
    return this.page.locator('[data-testid="payment-method-card"]')
  }

  get defaultPaymentMethod(): Locator {
    return this.page.locator('[data-testid="default-payment-method"]')
  }

  get setDefaultButtons(): Locator {
    return this.page.locator('button[data-testid^="set-default-"]')
  }

  get deletePaymentMethodButtons(): Locator {
    return this.page.locator('button[data-testid^="delete-payment-method-"]')
  }

  // Add payment method form elements
  get cardNumberInput(): Locator {
    return this.page.locator('input[name="cardNumber"]')
  }

  get expiryInput(): Locator {
    return this.page.locator('input[name="expiry"]')
  }

  get cvcInput(): Locator {
    return this.page.locator('input[name="cvc"]')
  }

  get cardholderNameInput(): Locator {
    return this.page.locator('input[name="cardholderName"]')
  }

  get billingAddressInput(): Locator {
    return this.page.locator('input[name="billingAddress"]')
  }

  get billingCityInput(): Locator {
    return this.page.locator('input[name="billingCity"]')
  }

  get billingStateInput(): Locator {
    return this.page.locator('input[name="billingState"]')
  }

  get billingZipInput(): Locator {
    return this.page.locator('input[name="billingZip"]')
  }

  get billingCountrySelect(): Locator {
    return this.page.locator('select[name="billingCountry"]')
  }

  get savePaymentMethodButton(): Locator {
    return this.page.locator('button[data-testid="save-payment-method"]')
  }

  // Usage and limits elements
  get usageSection(): Locator {
    return this.page.locator('[data-testid="usage-section"]')
  }

  get emailsSentProgress(): Locator {
    return this.page.locator('[data-testid="emails-sent-progress"]')
  }

  get leadsProgress(): Locator {
    return this.page.locator('[data-testid="leads-progress"]')
  }

  get storageProgress(): Locator {
    return this.page.locator('[data-testid="storage-progress"]')
  }

  get usageAlerts(): Locator {
    return this.page.locator('[data-testid="usage-alerts"]')
  }

  // Invoice elements
  get invoicesSection(): Locator {
    return this.page.locator('[data-testid="invoices-section"]')
  }

  get invoiceTable(): Locator {
    return this.page.locator('[data-testid="invoice-table"]')
  }

  get invoiceRows(): Locator {
    return this.page.locator('[data-testid="invoice-row"]')
  }

  get downloadInvoiceButtons(): Locator {
    return this.page.locator('button[data-testid^="download-invoice-"]')
  }

  get invoiceStatusBadges(): Locator {
    return this.page.locator('[data-testid^="invoice-status-"]')
  }

  // Subscription management elements
  get upgradePlanButton(): Locator {
    return this.page.locator('button[data-testid="upgrade-plan"]')
  }

  get downgradePlanButton(): Locator {
    return this.page.locator('button[data-testid="downgrade-plan"]')
  }

  get changeBillingCycleButton(): Locator {
    return this.page.locator('button[data-testid="change-billing-cycle"]')
  }

  get cancelSubscriptionButton(): Locator {
    return this.page.locator('button[data-testid="cancel-subscription"]')
  }

  get reactivateSubscriptionButton(): Locator {
    return this.page.locator('button[data-testid="reactivate-subscription"]')
  }

  // Billing portal elements
  get customerPortalButton(): Locator {
    return this.page.locator('button[data-testid="customer-portal"]')
  }

  get updateBillingInfoButton(): Locator {
    return this.page.locator('button[data-testid="update-billing-info"]')
  }

  // Confirmation dialogs
  get confirmUpgradeDialog(): Locator {
    return this.page.locator('[data-testid="confirm-upgrade-dialog"]')
  }

  get confirmDowngradeDialog(): Locator {
    return this.page.locator('[data-testid="confirm-downgrade-dialog"]')
  }

  get confirmCancellationDialog(): Locator {
    return this.page.locator('[data-testid="confirm-cancellation-dialog"]')
  }

  get confirmUpgradeButton(): Locator {
    return this.page.locator('button[data-testid="confirm-upgrade"]')
  }

  get confirmDowngradeButton(): Locator {
    return this.page.locator('button[data-testid="confirm-downgrade"]')
  }

  get confirmCancellationButton(): Locator {
    return this.page.locator('button[data-testid="confirm-cancellation"]')
  }

  // Promo code elements
  get promoCodeInput(): Locator {
    return this.page.locator('input[data-testid="promo-code"]')
  }

  get applyPromoCodeButton(): Locator {
    return this.page.locator('button[data-testid="apply-promo-code"]')
  }

  get activePromoCodes(): Locator {
    return this.page.locator('[data-testid="active-promo-codes"]')
  }

  // Actions
  async goToBilling(): Promise<void> {
    await this.goto('/settings/billing')
  }

  async selectPlan(planName: string, billingCycle: 'monthly' | 'yearly' = 'monthly'): Promise<void> {
    // Toggle billing cycle if needed
    if (billingCycle === 'yearly') {
      await this.yearlyToggle.check()
    } else {
      await this.monthlyToggle.check()
    }
    
    await this.waitForPageLoad()
    
    // Select the plan
    await this.page.click(`button[data-testid="select-plan-${planName}"]`)
    await this.waitForPageLoad()
  }

  async upgradePlan(newPlanName: string): Promise<void> {
    await this.selectPlan(newPlanName)
    await this.confirmUpgradeDialog.waitFor()
    await this.confirmUpgradeButton.click()
    await this.waitForPageLoad()
  }

  async downgradePlan(newPlanName: string): Promise<void> {
    await this.selectPlan(newPlanName)
    await this.confirmDowngradeDialog.waitFor()
    await this.confirmDowngradeButton.click()
    await this.waitForPageLoad()
  }

  async addPaymentMethod(paymentData: {
    cardNumber: string
    expiry: string
    cvc: string
    cardholderName: string
    address: string
    city: string
    state: string
    zip: string
    country: string
  }): Promise<void> {
    await this.addPaymentMethodButton.click()
    
    await this.cardNumberInput.fill(paymentData.cardNumber)
    await this.expiryInput.fill(paymentData.expiry)
    await this.cvcInput.fill(paymentData.cvc)
    await this.cardholderNameInput.fill(paymentData.cardholderName)
    await this.billingAddressInput.fill(paymentData.address)
    await this.billingCityInput.fill(paymentData.city)
    await this.billingStateInput.fill(paymentData.state)
    await this.billingZipInput.fill(paymentData.zip)
    await this.billingCountrySelect.selectOption(paymentData.country)
    
    await this.savePaymentMethodButton.click()
    await this.waitForPageLoad()
  }

  async setDefaultPaymentMethod(paymentMethodId: string): Promise<void> {
    await this.page.click(`button[data-testid="set-default-${paymentMethodId}"]`)
    await this.waitForPageLoad()
  }

  async deletePaymentMethod(paymentMethodId: string): Promise<void> {
    await this.page.click(`button[data-testid="delete-payment-method-${paymentMethodId}"]`)
    await this.page.click('button[data-testid="confirm-delete"]')
    await this.waitForPageLoad()
  }

  async downloadInvoice(invoiceId: string): Promise<void> {
    await this.page.click(`button[data-testid="download-invoice-${invoiceId}"]`)
  }

  async cancelSubscription(reason?: string): Promise<void> {
    await this.cancelSubscriptionButton.click()
    await this.confirmCancellationDialog.waitFor()
    
    if (reason) {
      await this.page.fill('textarea[data-testid="cancellation-reason"]', reason)
    }
    
    await this.confirmCancellationButton.click()
    await this.waitForPageLoad()
  }

  async reactivateSubscription(): Promise<void> {
    await this.reactivateSubscriptionButton.click()
    await this.page.click('button[data-testid="confirm-reactivation"]')
    await this.waitForPageLoad()
  }

  async changeBillingCycle(newCycle: 'monthly' | 'yearly'): Promise<void> {
    await this.changeBillingCycleButton.click()
    
    if (newCycle === 'yearly') {
      await this.page.click('button[data-testid="switch-to-yearly"]')
    } else {
      await this.page.click('button[data-testid="switch-to-monthly"]')
    }
    
    await this.page.click('button[data-testid="confirm-billing-change"]')
    await this.waitForPageLoad()
  }

  async applyPromoCode(code: string): Promise<void> {
    await this.promoCodeInput.fill(code)
    await this.applyPromoCodeButton.click()
    await this.waitForPageLoad()
  }

  async openCustomerPortal(): Promise<Page> {
    const [newPage] = await Promise.all([
      this.page.context().waitForEvent('page'),
      this.customerPortalButton.click()
    ])
    
    await newPage.waitForLoadState('networkidle')
    return newPage
  }

  async upgradeFromTrial(planName: string): Promise<void> {
    await this.upgradeTrialButton.click()
    await this.selectPlan(planName)
    await this.confirmUpgradeButton.click()
    await this.waitForPageLoad()
  }

  async extendTrial(): Promise<void> {
    await this.extendTrialButton.click()
    await this.page.click('button[data-testid="confirm-trial-extension"]')
    await this.waitForPageLoad()
  }

  // Data retrieval methods
  async getCurrentPlan(): Promise<{
    name: string
    price: string
    cycle: string
    status: string
  }> {
    const name = await this.planName.textContent() || ''
    const price = await this.planPrice.textContent() || ''
    const cycle = await this.billingCycle.textContent() || ''
    const status = await this.subscriptionStatus.textContent() || ''
    
    return { name, price, cycle, status }
  }

  async getUsageStats(): Promise<{
    emailsSent: { current: number; limit: number }
    leads: { current: number; limit: number }
    storage: { current: number; limit: number }
  }> {
    const emailsText = await this.emailsSentProgress.textContent() || '0/0'
    const leadsText = await this.leadsProgress.textContent() || '0/0'
    const storageText = await this.storageProgress.textContent() || '0/0'
    
    const parseUsage = (text: string) => {
      const [current, limit] = text.split('/').map(s => parseInt(s.replace(/[^0-9]/g, '')))
      return { current: current || 0, limit: limit || 0 }
    }
    
    return {
      emailsSent: parseUsage(emailsText),
      leads: parseUsage(leadsText),
      storage: parseUsage(storageText)
    }
  }

  async getInvoices(): Promise<Array<{
    id: string
    date: string
    amount: string
    status: string
  }>> {
    const invoiceRows = await this.invoiceRows.all()
    const invoices = []
    
    for (const row of invoiceRows) {
      const id = await row.getAttribute('data-invoice-id') || ''
      const date = await row.locator('[data-testid="invoice-date"]').textContent() || ''
      const amount = await row.locator('[data-testid="invoice-amount"]').textContent() || ''
      const status = await row.locator('[data-testid="invoice-status"]').textContent() || ''
      
      invoices.push({ id, date, amount, status })
    }
    
    return invoices
  }

  async getPaymentMethods(): Promise<Array<{
    id: string
    type: string
    last4: string
    expiry: string
    isDefault: boolean
  }>> {
    const methodCards = await this.paymentMethodCards.all()
    const methods = []
    
    for (const card of methodCards) {
      const id = await card.getAttribute('data-payment-method-id') || ''
      const type = await card.locator('[data-testid="card-type"]').textContent() || ''
      const last4 = await card.locator('[data-testid="card-last4"]').textContent() || ''
      const expiry = await card.locator('[data-testid="card-expiry"]').textContent() || ''
      const isDefault = await card.locator('[data-testid="default-badge"]').isVisible()
      
      methods.push({ id, type, last4, expiry, isDefault })
    }
    
    return methods
  }

  async getTrialInfo(): Promise<{
    daysRemaining: number
    isActive: boolean
  } | null> {
    const isTrialActive = await this.trialBanner.isVisible()
    
    if (!isTrialActive) {
      return null
    }
    
    const daysText = await this.trialDaysRemaining.textContent() || '0'
    const daysRemaining = parseInt(daysText.replace(/[^0-9]/g, ''))
    
    return {
      daysRemaining,
      isActive: true
    }
  }

  // Validation helpers
  async expectPlan(expectedPlan: {
    name?: string
    price?: string
    cycle?: string
    status?: string
  }): Promise<void> {
    if (expectedPlan.name) {
      await this.expectText('[data-testid="plan-name"]', expectedPlan.name)
    }
    
    if (expectedPlan.price) {
      await this.expectText('[data-testid="plan-price"]', expectedPlan.price)
    }
    
    if (expectedPlan.cycle) {
      await this.expectText('[data-testid="billing-cycle"]', expectedPlan.cycle)
    }
    
    if (expectedPlan.status) {
      await this.expectText('[data-testid="subscription-status"]', expectedPlan.status)
    }
  }

  async expectPaymentMethodAdded(): Promise<void> {
    await this.expectText('[data-testid="success-message"]', 'Payment method added successfully')
  }

  async expectPaymentMethodDeleted(): Promise<void> {
    await this.expectText('[data-testid="success-message"]', 'Payment method deleted successfully')
  }

  async expectPlanUpgraded(): Promise<void> {
    await this.expectText('[data-testid="success-message"]', 'Plan upgraded successfully')
  }

  async expectPlanDowngraded(): Promise<void> {
    await this.expectText('[data-testid="success-message"]', 'Plan downgraded successfully')
  }

  async expectSubscriptionCancelled(): Promise<void> {
    await this.expectText('[data-testid="subscription-status"]', 'Cancelled')
  }

  async expectSubscriptionReactivated(): Promise<void> {
    await this.expectText('[data-testid="subscription-status"]', 'Active')
  }

  async expectTrialUpgraded(): Promise<void> {
    await this.expectHidden('[data-testid="trial-banner"]')
    await this.expectText('[data-testid="subscription-status"]', 'Active')
  }

  async expectPromoCodeApplied(): Promise<void> {
    await this.expectText('[data-testid="success-message"]', 'Promo code applied successfully')
  }

  async expectPromoCodeError(errorMessage?: string): Promise<void> {
    await this.expectVisible('[data-testid="error-message"]')
    if (errorMessage) {
      await this.expectText('[data-testid="error-message"]', errorMessage)
    }
  }

  async expectUsageLimitWarning(): Promise<void> {
    await this.expectVisible('[data-testid="usage-warning"]')
  }

  async expectBillingCycleChanged(): Promise<void> {
    await this.expectText('[data-testid="success-message"]', 'Billing cycle updated successfully')
  }

  // Form validation helpers
  async expectPaymentMethodValidationError(): Promise<void> {
    await this.expectVisible('[data-testid="payment-method-error"]')
  }

  async expectCardValidationError(): Promise<void> {
    await this.expectVisible('[data-testid="card-validation-error"]')
  }

  async expectBillingAddressRequired(): Promise<void> {
    await this.expectVisible('[data-testid="billing-address-error"]')
  }
}