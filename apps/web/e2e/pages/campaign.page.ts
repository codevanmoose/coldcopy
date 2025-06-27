import { Page, Locator } from '@playwright/test'
import { BasePage } from './base.page'

/**
 * Page Object Model for Campaign management
 */
export class CampaignPage extends BasePage {
  // Campaign list elements
  get createCampaignButton(): Locator {
    return this.page.locator('button[data-testid="create-campaign"]')
  }

  get campaignSearchInput(): Locator {
    return this.page.locator('input[data-testid="campaign-search"]')
  }

  get campaignFilterSelect(): Locator {
    return this.page.locator('select[data-testid="campaign-filter"]')
  }

  get campaignTable(): Locator {
    return this.page.locator('[data-testid="campaign-table"]')
  }

  get campaignRows(): Locator {
    return this.page.locator('[data-testid="campaign-row"]')
  }

  // Campaign creation elements
  get campaignNameInput(): Locator {
    return this.page.locator('input[name="campaignName"]')
  }

  get campaignDescriptionInput(): Locator {
    return this.page.locator('textarea[name="campaignDescription"]')
  }

  get campaignTypeSelect(): Locator {
    return this.page.locator('select[name="campaignType"]')
  }

  get saveCampaignButton(): Locator {
    return this.page.locator('button[data-testid="save-campaign"]')
  }

  // Lead import elements
  get importLeadsButton(): Locator {
    return this.page.locator('button[data-testid="import-leads"]')
  }

  get csvFileUpload(): Locator {
    return this.page.locator('input[type="file"][data-testid="csv-upload"]')
  }

  get csvMappingTable(): Locator {
    return this.page.locator('[data-testid="csv-mapping-table"]')
  }

  get columnMappingSelects(): Locator {
    return this.page.locator('select[data-testid^="column-mapping-"]')
  }

  get importPreviewTable(): Locator {
    return this.page.locator('[data-testid="import-preview-table"]')
  }

  get confirmImportButton(): Locator {
    return this.page.locator('button[data-testid="confirm-import"]')
  }

  get importProgressBar(): Locator {
    return this.page.locator('[data-testid="import-progress"]')
  }

  // Lead selection elements
  get leadSelectorDialog(): Locator {
    return this.page.locator('[data-testid="lead-selector-dialog"]')
  }

  get selectAllLeadsCheckbox(): Locator {
    return this.page.locator('input[data-testid="select-all-leads"]')
  }

  get leadCheckboxes(): Locator {
    return this.page.locator('input[data-testid^="lead-checkbox-"]')
  }

  get leadFilters(): Locator {
    return this.page.locator('[data-testid="lead-filters"]')
  }

  get addSelectedLeadsButton(): Locator {
    return this.page.locator('button[data-testid="add-selected-leads"]')
  }

  // AI email generation elements
  get generateEmailButton(): Locator {
    return this.page.locator('button[data-testid="generate-email"]')
  }

  get emailPromptInput(): Locator {
    return this.page.locator('textarea[data-testid="email-prompt"]')
  }

  get emailToneSelect(): Locator {
    return this.page.locator('select[name="emailTone"]')
  }

  get emailLengthSelect(): Locator {
    return this.page.locator('select[name="emailLength"]')
  }

  get generateEmailContentButton(): Locator {
    return this.page.locator('button[data-testid="generate-content"]')
  }

  get generatedEmailPreview(): Locator {
    return this.page.locator('[data-testid="generated-email-preview"]')
  }

  get acceptGeneratedEmailButton(): Locator {
    return this.page.locator('button[data-testid="accept-generated-email"]')
  }

  get regenerateEmailButton(): Locator {
    return this.page.locator('button[data-testid="regenerate-email"]')
  }

  // Sequence builder elements
  get sequenceBuilder(): Locator {
    return this.page.locator('[data-testid="sequence-builder"]')
  }

  get addEmailStepButton(): Locator {
    return this.page.locator('button[data-testid="add-email-step"]')
  }

  get emailSteps(): Locator {
    return this.page.locator('[data-testid^="email-step-"]')
  }

  get emailSubjectInput(): Locator {
    return this.page.locator('input[name="emailSubject"]')
  }

  get emailBodyEditor(): Locator {
    return this.page.locator('[data-testid="email-body-editor"]')
  }

  get delayInput(): Locator {
    return this.page.locator('input[name="stepDelay"]')
  }

  get delayUnitSelect(): Locator {
    return this.page.locator('select[name="delayUnit"]')
  }

  get removeStepButton(): Locator {
    return this.page.locator('button[data-testid="remove-step"]')
  }

  // Campaign settings elements
  get campaignSettingsTab(): Locator {
    return this.page.locator('[data-testid="campaign-settings-tab"]')
  }

  get dailyLimitInput(): Locator {
    return this.page.locator('input[name="dailyLimit"]')
  }

  get sendingScheduleSelect(): Locator {
    return this.page.locator('select[name="sendingSchedule"]')
  }

  get timezoneSelect(): Locator {
    return this.page.locator('select[name="timezone"]')
  }

  get trackOpensCheckbox(): Locator {
    return this.page.locator('input[name="trackOpens"]')
  }

  get trackClicksCheckbox(): Locator {
    return this.page.locator('input[name="trackClicks"]')
  }

  get trackRepliesCheckbox(): Locator {
    return this.page.locator('input[name="trackReplies"]')
  }

  // Campaign launch elements
  get launchCampaignButton(): Locator {
    return this.page.locator('button[data-testid="launch-campaign"]')
  }

  get campaignPreviewDialog(): Locator {
    return this.page.locator('[data-testid="campaign-preview-dialog"]')
  }

  get confirmLaunchButton(): Locator {
    return this.page.locator('button[data-testid="confirm-launch"]')
  }

  get campaignStatusBadge(): Locator {
    return this.page.locator('[data-testid="campaign-status"]')
  }

  // Campaign monitoring elements
  get campaignStatsCards(): Locator {
    return this.page.locator('[data-testid="campaign-stats-card"]')
  }

  get emailsSentStat(): Locator {
    return this.page.locator('[data-testid="emails-sent-stat"]')
  }

  get openRateStat(): Locator {
    return this.page.locator('[data-testid="open-rate-stat"]')
  }

  get clickRateStat(): Locator {
    return this.page.locator('[data-testid="click-rate-stat"]')
  }

  get replyRateStat(): Locator {
    return this.page.locator('[data-testid="reply-rate-stat"]')
  }

  get campaignChart(): Locator {
    return this.page.locator('[data-testid="campaign-chart"]')
  }

  // Campaign control elements
  get pauseCampaignButton(): Locator {
    return this.page.locator('button[data-testid="pause-campaign"]')
  }

  get resumeCampaignButton(): Locator {
    return this.page.locator('button[data-testid="resume-campaign"]')
  }

  get stopCampaignButton(): Locator {
    return this.page.locator('button[data-testid="stop-campaign"]')
  }

  get duplicateCampaignButton(): Locator {
    return this.page.locator('button[data-testid="duplicate-campaign"]')
  }

  get deleteCampaignButton(): Locator {
    return this.page.locator('button[data-testid="delete-campaign"]')
  }

  // Actions
  async goToCampaigns(): Promise<void> {
    await this.goto('/campaigns')
  }

  async goToNewCampaign(): Promise<void> {
    await this.goto('/campaigns/new')
  }

  async createCampaign(campaignData: {
    name: string
    description: string
    type: string
  }): Promise<void> {
    await this.goToNewCampaign()
    await this.campaignNameInput.fill(campaignData.name)
    await this.campaignDescriptionInput.fill(campaignData.description)
    await this.campaignTypeSelect.selectOption(campaignData.type)
    await this.saveCampaignButton.click()
    await this.waitForPageLoad()
  }

  async importLeadsFromCSV(filePath: string, columnMapping: Record<string, string>): Promise<void> {
    await this.importLeadsButton.click()
    await this.csvFileUpload.setInputFiles(filePath)
    await this.waitForElement('[data-testid="csv-mapping-table"]')
    
    // Map CSV columns to lead fields
    for (const [csvColumn, leadField] of Object.entries(columnMapping)) {
      await this.page.selectOption(
        `select[data-testid="column-mapping-${csvColumn}"]`,
        leadField
      )
    }
    
    await this.confirmImportButton.click()
    await this.waitForElement('[data-testid="import-progress"]')
    await this.waitForText('Import completed successfully')
  }

  async selectLeads(leadIds: string[]): Promise<void> {
    for (const leadId of leadIds) {
      await this.page.check(`input[data-testid="lead-checkbox-${leadId}"]`)
    }
    await this.addSelectedLeadsButton.click()
    await this.waitForPageLoad()
  }

  async selectAllLeads(): Promise<void> {
    await this.selectAllLeadsCheckbox.check()
    await this.addSelectedLeadsButton.click()
    await this.waitForPageLoad()
  }

  async generateEmailWithAI(prompt: string, options?: {
    tone?: string
    length?: string
  }): Promise<string> {
    await this.generateEmailButton.click()
    await this.emailPromptInput.fill(prompt)
    
    if (options?.tone) {
      await this.emailToneSelect.selectOption(options.tone)
    }
    
    if (options?.length) {
      await this.emailLengthSelect.selectOption(options.length)
    }
    
    await this.generateEmailContentButton.click()
    await this.waitForElement('[data-testid="generated-email-preview"]')
    
    // Get the generated content
    const generatedContent = await this.generatedEmailPreview.textContent()
    
    await this.acceptGeneratedEmailButton.click()
    return generatedContent || ''
  }

  async buildEmailSequence(sequence: Array<{
    subject: string
    body: string
    delay: number
    delayUnit: string
  }>): Promise<void> {
    for (let i = 0; i < sequence.length; i++) {
      const step = sequence[i]
      
      if (i > 0) {
        await this.addEmailStepButton.click()
      }
      
      // Fill step content
      const stepElement = this.page.locator(`[data-testid="email-step-${i}"]`)
      await stepElement.locator('input[name="emailSubject"]').fill(step.subject)
      await stepElement.locator('[data-testid="email-body-editor"]').fill(step.body)
      
      if (i > 0) { // First step doesn't need delay
        await stepElement.locator('input[name="stepDelay"]').fill(step.delay.toString())
        await stepElement.locator('select[name="delayUnit"]').selectOption(step.delayUnit)
      }
    }
  }

  async configureCampaignSettings(settings: {
    dailyLimit: number
    sendingSchedule: string
    timezone: string
    trackOpens: boolean
    trackClicks: boolean
    trackReplies: boolean
  }): Promise<void> {
    await this.campaignSettingsTab.click()
    
    await this.dailyLimitInput.fill(settings.dailyLimit.toString())
    await this.sendingScheduleSelect.selectOption(settings.sendingSchedule)
    await this.timezoneSelect.selectOption(settings.timezone)
    
    if (settings.trackOpens) {
      await this.trackOpensCheckbox.check()
    }
    
    if (settings.trackClicks) {
      await this.trackClicksCheckbox.check()
    }
    
    if (settings.trackReplies) {
      await this.trackRepliesCheckbox.check()
    }
  }

  async launchCampaign(): Promise<void> {
    await this.launchCampaignButton.click()
    await this.campaignPreviewDialog.waitFor()
    await this.confirmLaunchButton.click()
    await this.waitForText('Campaign launched successfully')
  }

  async pauseCampaign(): Promise<void> {
    await this.pauseCampaignButton.click()
    await this.waitForText('Campaign paused')
  }

  async resumeCampaign(): Promise<void> {
    await this.resumeCampaignButton.click()
    await this.waitForText('Campaign resumed')
  }

  async stopCampaign(): Promise<void> {
    await this.stopCampaignButton.click()
    await this.page.click('button[data-testid="confirm-stop"]')
    await this.waitForText('Campaign stopped')
  }

  async duplicateCampaign(): Promise<void> {
    await this.duplicateCampaignButton.click()
    await this.waitForText('Campaign duplicated successfully')
  }

  async deleteCampaign(): Promise<void> {
    await this.deleteCampaignButton.click()
    await this.page.click('button[data-testid="confirm-delete"]')
    await this.waitForText('Campaign deleted successfully')
  }

  async searchCampaigns(query: string): Promise<void> {
    await this.campaignSearchInput.fill(query)
    await this.waitForPageLoad()
  }

  async filterCampaigns(status: string): Promise<void> {
    await this.campaignFilterSelect.selectOption(status)
    await this.waitForPageLoad()
  }

  async openCampaign(campaignId: string): Promise<void> {
    await this.page.click(`[data-testid="campaign-row-${campaignId}"]`)
    await this.waitForUrl(`/campaigns/${campaignId}`)
  }

  // Analytics and monitoring
  async getCampaignStats(): Promise<{
    emailsSent: number
    openRate: number
    clickRate: number
    replyRate: number
  }> {
    const emailsSent = await this.emailsSentStat.textContent()
    const openRate = await this.openRateStat.textContent()
    const clickRate = await this.clickRateStat.textContent()
    const replyRate = await this.replyRateStat.textContent()
    
    return {
      emailsSent: parseInt(emailsSent || '0'),
      openRate: parseFloat(openRate?.replace('%', '') || '0'),
      clickRate: parseFloat(clickRate?.replace('%', '') || '0'),
      replyRate: parseFloat(replyRate?.replace('%', '') || '0'),
    }
  }

  async exportCampaignData(): Promise<void> {
    await this.page.click('button[data-testid="export-campaign-data"]')
    await this.waitForText('Export started')
  }

  // Validation helpers
  async expectCampaignCreated(): Promise<void> {
    await this.expectText('[data-testid="success-message"]', 'Campaign created successfully')
  }

  async expectLeadsImported(count: number): Promise<void> {
    await this.expectText('[data-testid="import-success"]', `${count} leads imported successfully`)
  }

  async expectCampaignLaunched(): Promise<void> {
    await this.expectText('[data-testid="campaign-status"]', 'Active')
  }

  async expectCampaignPaused(): Promise<void> {
    await this.expectText('[data-testid="campaign-status"]', 'Paused')
  }

  async expectCampaignStopped(): Promise<void> {
    await this.expectText('[data-testid="campaign-status"]', 'Stopped')
  }

  async expectEmailGenerated(): Promise<void> {
    await this.expectVisible('[data-testid="generated-email-preview"]')
  }

  async expectSequenceBuilt(stepCount: number): Promise<void> {
    const steps = await this.emailSteps.count()
    expect(steps).toBe(stepCount)
  }

  async expectCampaignStats(expectedStats: {
    emailsSent?: number
    openRate?: number
    clickRate?: number
    replyRate?: number
  }): Promise<void> {
    const stats = await this.getCampaignStats()
    
    if (expectedStats.emailsSent !== undefined) {
      expect(stats.emailsSent).toBeGreaterThanOrEqual(expectedStats.emailsSent)
    }
    
    if (expectedStats.openRate !== undefined) {
      expect(stats.openRate).toBeGreaterThanOrEqual(expectedStats.openRate)
    }
    
    if (expectedStats.clickRate !== undefined) {
      expect(stats.clickRate).toBeGreaterThanOrEqual(expectedStats.clickRate)
    }
    
    if (expectedStats.replyRate !== undefined) {
      expect(stats.replyRate).toBeGreaterThanOrEqual(expectedStats.replyRate)
    }
  }
}