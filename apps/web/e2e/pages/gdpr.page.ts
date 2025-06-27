import { Page, Locator } from '@playwright/test'
import { BasePage } from './base.page'

/**
 * Page Object Model for GDPR Compliance features
 */
export class GDPRPage extends BasePage {
  // Cookie consent banner elements
  get cookieBanner(): Locator {
    return this.page.locator('[data-testid="cookie-banner"]')
  }

  get acceptAllCookiesButton(): Locator {
    return this.page.locator('button[data-testid="accept-all-cookies"]')
  }

  get rejectAllCookiesButton(): Locator {
    return this.page.locator('button[data-testid="reject-all-cookies"]')
  }

  get customizeCookiesButton(): Locator {
    return this.page.locator('button[data-testid="customize-cookies"]')
  }

  get cookiePreferencesDialog(): Locator {
    return this.page.locator('[data-testid="cookie-preferences-dialog"]')
  }

  get essentialCookiesToggle(): Locator {
    return this.page.locator('input[data-testid="essential-cookies-toggle"]')
  }

  get analyticsCookiesToggle(): Locator {
    return this.page.locator('input[data-testid="analytics-cookies-toggle"]')
  }

  get marketingCookiesToggle(): Locator {
    return this.page.locator('input[data-testid="marketing-cookies-toggle"]')
  }

  get saveCookiePreferencesButton(): Locator {
    return this.page.locator('button[data-testid="save-cookie-preferences"]')
  }

  // Privacy settings elements
  get privacySettingsPage(): Locator {
    return this.page.locator('[data-testid="privacy-settings-page"]')
  }

  get dataProcessingConsent(): Locator {
    return this.page.locator('input[data-testid="data-processing-consent"]')
  }

  get marketingConsent(): Locator {
    return this.page.locator('input[data-testid="marketing-consent"]')
  }

  get analyticsConsent(): Locator {
    return this.page.locator('input[data-testid="analytics-consent"]')
  }

  get savePrivacySettingsButton(): Locator {
    return this.page.locator('button[data-testid="save-privacy-settings"]')
  }

  // Data export elements
  get dataExportSection(): Locator {
    return this.page.locator('[data-testid="data-export-section"]')
  }

  get requestDataExportButton(): Locator {
    return this.page.locator('button[data-testid="request-data-export"]')
  }

  get dataExportForm(): Locator {
    return this.page.locator('[data-testid="data-export-form"]')
  }

  get exportDataTypesCheckboxes(): Locator {
    return this.page.locator('input[name="exportDataTypes"]')
  }

  get exportFormatSelect(): Locator {
    return this.page.locator('select[data-testid="export-format"]')
  }

  get exportReasonTextarea(): Locator {
    return this.page.locator('textarea[data-testid="export-reason"]')
  }

  get submitExportRequestButton(): Locator {
    return this.page.locator('button[data-testid="submit-export-request"]')
  }

  get exportRequestStatus(): Locator {
    return this.page.locator('[data-testid="export-request-status"]')
  }

  get downloadExportButton(): Locator {
    return this.page.locator('button[data-testid="download-export"]')
  }

  // Data deletion elements
  get dataDeletionSection(): Locator {
    return this.page.locator('[data-testid="data-deletion-section"]')
  }

  get requestDataDeletionButton(): Locator {
    return this.page.locator('button[data-testid="request-data-deletion"]')
  }

  get dataDeletionForm(): Locator {
    return this.page.locator('[data-testid="data-deletion-form"]')
  }

  get deletionDataTypesCheckboxes(): Locator {
    return this.page.locator('input[name="deletionDataTypes"]')
  }

  get deletionReasonTextarea(): Locator {
    return this.page.locator('textarea[data-testid="deletion-reason"]')
  }

  get confirmDeletionCheckbox(): Locator {
    return this.page.locator('input[data-testid="confirm-deletion"]')
  }

  get submitDeletionRequestButton(): Locator {
    return this.page.locator('button[data-testid="submit-deletion-request"]')
  }

  get deletionRequestStatus(): Locator {
    return this.page.locator('[data-testid="deletion-request-status"]')
  }

  // Consent withdrawal elements
  get consentManagementSection(): Locator {
    return this.page.locator('[data-testid="consent-management-section"]')
  }

  get activeConsents(): Locator {
    return this.page.locator('[data-testid="active-consents"]')
  }

  get withdrawConsentButtons(): Locator {
    return this.page.locator('button[data-testid^="withdraw-consent-"]')
  }

  get consentWithdrawalDialog(): Locator {
    return this.page.locator('[data-testid="consent-withdrawal-dialog"]')
  }

  get withdrawalReasonSelect(): Locator {
    return this.page.locator('select[data-testid="withdrawal-reason"]')
  }

  get withdrawalDetailsTextarea(): Locator {
    return this.page.locator('textarea[data-testid="withdrawal-details"]')
  }

  get confirmWithdrawalButton(): Locator {
    return this.page.locator('button[data-testid="confirm-withdrawal"]')
  }

  // Unsubscribe elements
  get unsubscribePage(): Locator {
    return this.page.locator('[data-testid="unsubscribe-page"]')
  }

  get unsubscribeReasonSelect(): Locator {
    return this.page.locator('select[data-testid="unsubscribe-reason"]')
  }

  get unsubscribeTypesCheckboxes(): Locator {
    return this.page.locator('input[name="unsubscribeTypes"]')
  }

  get unsubscribeAllButton(): Locator {
    return this.page.locator('button[data-testid="unsubscribe-all"]')
  }

  get selectiveUnsubscribeButton(): Locator {
    return this.page.locator('button[data-testid="selective-unsubscribe"]')
  }

  get unsubscribeConfirmation(): Locator {
    return this.page.locator('[data-testid="unsubscribe-confirmation"]')
  }

  get resubscribeButton(): Locator {
    return this.page.locator('button[data-testid="resubscribe"]')
  }

  // GDPR requests management (admin)
  get gdprRequestsTable(): Locator {
    return this.page.locator('[data-testid="gdpr-requests-table"]')
  }

  get gdprRequestRows(): Locator {
    return this.page.locator('[data-testid="gdpr-request-row"]')
  }

  get processRequestButtons(): Locator {
    return this.page.locator('button[data-testid^="process-request-"]')
  }

  get requestDetailsDialog(): Locator {
    return this.page.locator('[data-testid="request-details-dialog"]')
  }

  get approveRequestButton(): Locator {
    return this.page.locator('button[data-testid="approve-request"]')
  }

  get rejectRequestButton(): Locator {
    return this.page.locator('button[data-testid="reject-request"]')
  }

  get requestNotesTextarea(): Locator {
    return this.page.locator('textarea[data-testid="request-notes"]')
  }

  // Data retention settings
  get dataRetentionSettings(): Locator {
    return this.page.locator('[data-testid="data-retention-settings"]')
  }

  get retentionPeriodSelect(): Locator {
    return this.page.locator('select[data-testid="retention-period"]')
  }

  get autoDeleteToggle(): Locator {
    return this.page.locator('input[data-testid="auto-delete-toggle"]')
  }

  get saveRetentionSettingsButton(): Locator {
    return this.page.locator('button[data-testid="save-retention-settings"]')
  }

  // Actions
  async goToPrivacySettings(): Promise<void> {
    await this.goto('/settings/privacy')
  }

  async goToDataProcessing(): Promise<void> {
    await this.goto('/settings/data-processing')
  }

  async goToUnsubscribe(token?: string): Promise<void> {
    const url = token ? `/unsubscribe?token=${token}` : '/unsubscribe'
    await this.goto(url)
  }

  async goToGDPRAdmin(): Promise<void> {
    await this.goto('/admin/gdpr')
  }

  async acceptAllCookies(): Promise<void> {
    await this.acceptAllCookiesButton.click()
    await this.waitForElement('[data-testid="cookie-consent-confirmed"]')
  }

  async rejectAllCookies(): Promise<void> {
    await this.rejectAllCookiesButton.click()
    await this.waitForElement('[data-testid="cookie-consent-confirmed"]')
  }

  async customizeCookieConsent(preferences: {
    essential: boolean
    analytics: boolean
    marketing: boolean
  }): Promise<void> {
    await this.customizeCookiesButton.click()
    await this.cookiePreferencesDialog.waitFor()
    
    if (preferences.analytics) {
      await this.analyticsCookiesToggle.check()
    } else {
      await this.analyticsCookiesToggle.uncheck()
    }
    
    if (preferences.marketing) {
      await this.marketingCookiesToggle.check()
    } else {
      await this.marketingCookiesToggle.uncheck()
    }
    
    await this.saveCookiePreferencesButton.click()
    await this.waitForPageLoad()
  }

  async updatePrivacyConsents(consents: {
    dataProcessing?: boolean
    marketing?: boolean
    analytics?: boolean
  }): Promise<void> {
    await this.goToPrivacySettings()
    
    if (consents.dataProcessing !== undefined) {
      if (consents.dataProcessing) {
        await this.dataProcessingConsent.check()
      } else {
        await this.dataProcessingConsent.uncheck()
      }
    }
    
    if (consents.marketing !== undefined) {
      if (consents.marketing) {
        await this.marketingConsent.check()
      } else {
        await this.marketingConsent.uncheck()
      }
    }
    
    if (consents.analytics !== undefined) {
      if (consents.analytics) {
        await this.analyticsConsent.check()
      } else {
        await this.analyticsConsent.uncheck()
      }
    }
    
    await this.savePrivacySettingsButton.click()
    await this.waitForPageLoad()
  }

  async requestDataExport(options: {
    dataTypes: string[]
    format: string
    reason: string
  }): Promise<void> {
    await this.goToDataProcessing()
    await this.requestDataExportButton.click()
    await this.dataExportForm.waitFor()
    
    // Select data types
    for (const dataType of options.dataTypes) {
      await this.page.check(`input[name="exportDataTypes"][value="${dataType}"]`)
    }
    
    await this.exportFormatSelect.selectOption(options.format)
    await this.exportReasonTextarea.fill(options.reason)
    
    await this.submitExportRequestButton.click()
    await this.waitForPageLoad()
  }

  async requestDataDeletion(options: {
    dataTypes: string[]
    reason: string
  }): Promise<void> {
    await this.goToDataProcessing()
    await this.requestDataDeletionButton.click()
    await this.dataDeletionForm.waitFor()
    
    // Select data types
    for (const dataType of options.dataTypes) {
      await this.page.check(`input[name="deletionDataTypes"][value="${dataType}"]`)
    }
    
    await this.deletionReasonTextarea.fill(options.reason)
    await this.confirmDeletionCheckbox.check()
    
    await this.submitDeletionRequestButton.click()
    await this.waitForPageLoad()
  }

  async withdrawConsent(consentType: string, reason: string): Promise<void> {
    await this.goToPrivacySettings()
    await this.page.click(`button[data-testid="withdraw-consent-${consentType}"]`)
    await this.consentWithdrawalDialog.waitFor()
    
    await this.withdrawalReasonSelect.selectOption(reason)
    await this.withdrawalDetailsTextarea.fill(`Withdrawing ${consentType} consent for reason: ${reason}`)
    
    await this.confirmWithdrawalButton.click()
    await this.waitForPageLoad()
  }

  async unsubscribeFromEmails(options: {
    reason: string
    types?: string[]
    unsubscribeAll?: boolean
  }): Promise<void> {
    await this.unsubscribeReasonSelect.selectOption(options.reason)
    
    if (options.unsubscribeAll) {
      await this.unsubscribeAllButton.click()
    } else if (options.types) {
      // Select specific types
      for (const type of options.types) {
        await this.page.check(`input[name="unsubscribeTypes"][value="${type}"]`)
      }
      await this.selectiveUnsubscribeButton.click()
    }
    
    await this.waitForElement('[data-testid="unsubscribe-confirmation"]')
  }

  async resubscribeToEmails(): Promise<void> {
    await this.resubscribeButton.click()
    await this.waitForPageLoad()
  }

  async downloadDataExport(): Promise<void> {
    await this.downloadExportButton.click()
  }

  // Admin actions
  async processGDPRRequest(requestId: string, action: 'approve' | 'reject', notes?: string): Promise<void> {
    await this.goToGDPRAdmin()
    await this.page.click(`button[data-testid="process-request-${requestId}"]`)
    await this.requestDetailsDialog.waitFor()
    
    if (notes) {
      await this.requestNotesTextarea.fill(notes)
    }
    
    if (action === 'approve') {
      await this.approveRequestButton.click()
    } else {
      await this.rejectRequestButton.click()
    }
    
    await this.waitForPageLoad()
  }

  async configureDataRetention(options: {
    period: string
    autoDelete: boolean
  }): Promise<void> {
    await this.goToDataProcessing()
    await this.retentionPeriodSelect.selectOption(options.period)
    
    if (options.autoDelete) {
      await this.autoDeleteToggle.check()
    } else {
      await this.autoDeleteToggle.uncheck()
    }
    
    await this.saveRetentionSettingsButton.click()
    await this.waitForPageLoad()
  }

  // Data retrieval methods
  async getCookieConsent(): Promise<{
    essential: boolean
    analytics: boolean
    marketing: boolean
  }> {
    const essential = await this.essentialCookiesToggle.isChecked()
    const analytics = await this.analyticsCookiesToggle.isChecked()
    const marketing = await this.marketingCookiesToggle.isChecked()
    
    return { essential, analytics, marketing }
  }

  async getPrivacyConsents(): Promise<{
    dataProcessing: boolean
    marketing: boolean
    analytics: boolean
  }> {
    const dataProcessing = await this.dataProcessingConsent.isChecked()
    const marketing = await this.marketingConsent.isChecked()
    const analytics = await this.analyticsConsent.isChecked()
    
    return { dataProcessing, marketing, analytics }
  }

  async getExportRequestStatus(): Promise<string> {
    return await this.exportRequestStatus.textContent() || ''
  }

  async getDeletionRequestStatus(): Promise<string> {
    return await this.deletionRequestStatus.textContent() || ''
  }

  async getGDPRRequests(): Promise<Array<{
    id: string
    type: string
    status: string
    requestedAt: string
  }>> {
    const requestRows = await this.gdprRequestRows.all()
    const requests = []
    
    for (const row of requestRows) {
      const id = await row.getAttribute('data-request-id') || ''
      const type = await row.locator('[data-testid="request-type"]').textContent() || ''
      const status = await row.locator('[data-testid="request-status"]').textContent() || ''
      const requestedAt = await row.locator('[data-testid="request-date"]').textContent() || ''
      
      requests.push({ id, type, status, requestedAt })
    }
    
    return requests
  }

  // Validation helpers
  async expectCookieConsentRequired(): Promise<void> {
    await this.expectVisible('[data-testid="cookie-banner"]')
  }

  async expectCookieConsentSaved(): Promise<void> {
    await this.expectText('[data-testid="success-message"]', 'Cookie preferences saved')
  }

  async expectPrivacySettingsSaved(): Promise<void> {
    await this.expectText('[data-testid="success-message"]', 'Privacy settings updated')
  }

  async expectDataExportRequested(): Promise<void> {
    await this.expectText('[data-testid="success-message"]', 'Data export request submitted')
  }

  async expectDataDeletionRequested(): Promise<void> {
    await this.expectText('[data-testid="success-message"]', 'Data deletion request submitted')
  }

  async expectConsentWithdrawn(): Promise<void> {
    await this.expectText('[data-testid="success-message"]', 'Consent withdrawn successfully')
  }

  async expectUnsubscribeSuccess(): Promise<void> {
    await this.expectVisible('[data-testid="unsubscribe-confirmation"]')
    await this.expectText('[data-testid="unsubscribe-confirmation"]', 'Successfully unsubscribed')
  }

  async expectResubscribeSuccess(): Promise<void> {
    await this.expectText('[data-testid="success-message"]', 'Successfully resubscribed')
  }

  async expectExportReady(): Promise<void> {
    await this.expectText('[data-testid="export-request-status"]', 'Ready for download')
    await this.expectVisible('[data-testid="download-export"]')
  }

  async expectDeletionCompleted(): Promise<void> {
    await this.expectText('[data-testid="deletion-request-status"]', 'Completed')
  }

  async expectGDPRRequestProcessed(): Promise<void> {
    await this.expectText('[data-testid="success-message"]', 'Request processed successfully')
  }

  async expectDataRetentionUpdated(): Promise<void> {
    await this.expectText('[data-testid="success-message"]', 'Data retention settings updated')
  }

  // Form validation helpers
  async expectExportRequestValidationError(): Promise<void> {
    await this.expectVisible('[data-testid="export-validation-error"]')
  }

  async expectDeletionConfirmationRequired(): Promise<void> {
    await this.expectVisible('[data-testid="deletion-confirmation-error"]')
  }

  async expectWithdrawalReasonRequired(): Promise<void> {
    await this.expectVisible('[data-testid="withdrawal-reason-error"]')
  }

  async expectUnsubscribeReasonRequired(): Promise<void> {
    await this.expectVisible('[data-testid="unsubscribe-reason-error"]')
  }

  // Cookie utilities
  async hasCookieConsent(): Promise<boolean> {
    try {
      const consent = await this.getLocalStorageItem('cookie-consent')
      return consent !== null
    } catch {
      return false
    }
  }

  async clearCookieConsent(): Promise<void> {
    await this.page.evaluate(() => {
      localStorage.removeItem('cookie-consent')
      sessionStorage.removeItem('cookie-consent')
    })
  }

  async setCookieConsent(consent: {
    essential: boolean
    analytics: boolean
    marketing: boolean
  }): Promise<void> {
    await this.setLocalStorageItem('cookie-consent', JSON.stringify(consent))
  }
}