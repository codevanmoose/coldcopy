import { Page, Locator } from '@playwright/test'
import { BasePage } from './base.page'

/**
 * Page Object Model for Lead Management
 */
export class LeadsPage extends BasePage {
  // Lead list elements
  get leadsTable(): Locator {
    return this.page.locator('[data-testid="leads-table"]')
  }

  get leadRows(): Locator {
    return this.page.locator('[data-testid="lead-row"]')
  }

  get selectAllLeadsCheckbox(): Locator {
    return this.page.locator('input[data-testid="select-all-leads"]')
  }

  get leadCheckboxes(): Locator {
    return this.page.locator('input[data-testid^="lead-checkbox-"]')
  }

  get selectedLeadsCount(): Locator {
    return this.page.locator('[data-testid="selected-leads-count"]')
  }

  // Import elements
  get importLeadsButton(): Locator {
    return this.page.locator('button[data-testid="import-leads"]')
  }

  get csvFileUpload(): Locator {
    return this.page.locator('input[type="file"][data-testid="csv-upload"]')
  }

  get importDialog(): Locator {
    return this.page.locator('[data-testid="import-dialog"]')
  }

  get columnMappingTable(): Locator {
    return this.page.locator('[data-testid="column-mapping-table"]')
  }

  get columnMappingSelects(): Locator {
    return this.page.locator('select[data-testid^="column-mapping-"]')
  }

  get importPreviewTable(): Locator {
    return this.page.locator('[data-testid="import-preview-table"]')
  }

  get skipDuplicatesCheckbox(): Locator {
    return this.page.locator('input[data-testid="skip-duplicates"]')
  }

  get validateEmailsCheckbox(): Locator {
    return this.page.locator('input[data-testid="validate-emails"]')
  }

  get confirmImportButton(): Locator {
    return this.page.locator('button[data-testid="confirm-import"]')
  }

  get importProgressBar(): Locator {
    return this.page.locator('[data-testid="import-progress"]')
  }

  get importResults(): Locator {
    return this.page.locator('[data-testid="import-results"]')
  }

  // Search and filter elements
  get searchInput(): Locator {
    return this.page.locator('input[data-testid="leads-search"]')
  }

  get filterButton(): Locator {
    return this.page.locator('button[data-testid="filter-leads"]')
  }

  get filterDialog(): Locator {
    return this.page.locator('[data-testid="filter-dialog"]')
  }

  get statusFilter(): Locator {
    return this.page.locator('select[data-testid="status-filter"]')
  }

  get sourceFilter(): Locator {
    return this.page.locator('select[data-testid="source-filter"]')
  }

  get industryFilter(): Locator {
    return this.page.locator('select[data-testid="industry-filter"]')
  }

  get companySizeFilter(): Locator {
    return this.page.locator('select[data-testid="company-size-filter"]')
  }

  get tagsFilter(): Locator {
    return this.page.locator('input[data-testid="tags-filter"]')
  }

  get dateRangeFilter(): Locator {
    return this.page.locator('[data-testid="date-range-filter"]')
  }

  get applyFiltersButton(): Locator {
    return this.page.locator('button[data-testid="apply-filters"]')
  }

  get clearFiltersButton(): Locator {
    return this.page.locator('button[data-testid="clear-filters"]')
  }

  // Lead details elements
  get leadDetailsSheet(): Locator {
    return this.page.locator('[data-testid="lead-details-sheet"]')
  }

  get leadEmailInput(): Locator {
    return this.page.locator('input[name="email"]')
  }

  get leadFirstNameInput(): Locator {
    return this.page.locator('input[name="firstName"]')
  }

  get leadLastNameInput(): Locator {
    return this.page.locator('input[name="lastName"]')
  }

  get leadCompanyInput(): Locator {
    return this.page.locator('input[name="company"]')
  }

  get leadJobTitleInput(): Locator {
    return this.page.locator('input[name="jobTitle"]')
  }

  get leadPhoneInput(): Locator {
    return this.page.locator('input[name="phone"]')
  }

  get leadWebsiteInput(): Locator {
    return this.page.locator('input[name="website"]')
  }

  get leadIndustrySelect(): Locator {
    return this.page.locator('select[name="industry"]')
  }

  get leadCompanySizeSelect(): Locator {
    return this.page.locator('select[name="companySize"]')
  }

  get leadStatusSelect(): Locator {
    return this.page.locator('select[name="status"]')
  }

  get leadTagsInput(): Locator {
    return this.page.locator('input[name="tags"]')
  }

  get leadNotesTextarea(): Locator {
    return this.page.locator('textarea[name="notes"]')
  }

  get saveLeadButton(): Locator {
    return this.page.locator('button[data-testid="save-lead"]')
  }

  get deleteLeadButton(): Locator {
    return this.page.locator('button[data-testid="delete-lead"]')
  }

  // Enrichment elements
  get enrichLeadsButton(): Locator {
    return this.page.locator('button[data-testid="enrich-leads"]')
  }

  get enrichmentDialog(): Locator {
    return this.page.locator('[data-testid="enrichment-dialog"]')
  }

  get enrichmentProviderSelect(): Locator {
    return this.page.locator('select[data-testid="enrichment-provider"]')
  }

  get enrichmentFieldsCheckboxes(): Locator {
    return this.page.locator('input[name="enrichmentFields"]')
  }

  get startEnrichmentButton(): Locator {
    return this.page.locator('button[data-testid="start-enrichment"]')
  }

  get enrichmentProgress(): Locator {
    return this.page.locator('[data-testid="enrichment-progress"]')
  }

  get enrichmentResults(): Locator {
    return this.page.locator('[data-testid="enrichment-results"]')
  }

  get enrichmentHistory(): Locator {
    return this.page.locator('[data-testid="enrichment-history"]')
  }

  // Bulk operations elements
  get bulkActionsDropdown(): Locator {
    return this.page.locator('select[data-testid="bulk-actions"]')
  }

  get executeBulkActionButton(): Locator {
    return this.page.locator('button[data-testid="execute-bulk-action"]')
  }

  get bulkUpdateDialog(): Locator {
    return this.page.locator('[data-testid="bulk-update-dialog"]')
  }

  get bulkDeleteDialog(): Locator {
    return this.page.locator('[data-testid="bulk-delete-dialog"]')
  }

  get bulkStatusSelect(): Locator {
    return this.page.locator('select[data-testid="bulk-status"]')
  }

  get bulkTagsInput(): Locator {
    return this.page.locator('input[data-testid="bulk-tags"]')
  }

  get confirmBulkActionButton(): Locator {
    return this.page.locator('button[data-testid="confirm-bulk-action"]')
  }

  // Export elements
  get exportLeadsButton(): Locator {
    return this.page.locator('button[data-testid="export-leads"]')
  }

  get exportDialog(): Locator {
    return this.page.locator('[data-testid="export-dialog"]')
  }

  get exportFormatSelect(): Locator {
    return this.page.locator('select[data-testid="export-format"]')
  }

  get exportFieldsCheckboxes(): Locator {
    return this.page.locator('input[name="exportFields"]')
  }

  get includeFilteredOnlyCheckbox(): Locator {
    return this.page.locator('input[data-testid="include-filtered-only"]')
  }

  get startExportButton(): Locator {
    return this.page.locator('button[data-testid="start-export"]')
  }

  get downloadExportButton(): Locator {
    return this.page.locator('button[data-testid="download-export"]')
  }

  // Pagination elements
  get paginationInfo(): Locator {
    return this.page.locator('[data-testid="pagination-info"]')
  }

  get previousPageButton(): Locator {
    return this.page.locator('button[data-testid="previous-page"]')
  }

  get nextPageButton(): Locator {
    return this.page.locator('button[data-testid="next-page"]')
  }

  get pageSizeSelect(): Locator {
    return this.page.locator('select[data-testid="page-size"]')
  }

  // Validation elements
  get emailValidationStatus(): Locator {
    return this.page.locator('[data-testid="email-validation-status"]')
  }

  get validEmailsCount(): Locator {
    return this.page.locator('[data-testid="valid-emails-count"]')
  }

  get invalidEmailsCount(): Locator {
    return this.page.locator('[data-testid="invalid-emails-count"]')
  }

  get validateEmailsButton(): Locator {
    return this.page.locator('button[data-testid="validate-emails"]')
  }

  get validationResults(): Locator {
    return this.page.locator('[data-testid="validation-results"]')
  }

  // Actions
  async goToLeads(): Promise<void> {
    await this.goto('/leads')
  }

  async importLeadsFromCSV(filePath: string, mapping: Record<string, string>, options?: {
    skipDuplicates?: boolean
    validateEmails?: boolean
  }): Promise<void> {
    await this.importLeadsButton.click()
    await this.importDialog.waitFor()
    
    // Upload CSV file
    await this.csvFileUpload.setInputFiles(filePath)
    await this.waitForElement('[data-testid="column-mapping-table"]')
    
    // Configure column mapping
    for (const [csvColumn, leadField] of Object.entries(mapping)) {
      await this.page.selectOption(
        `select[data-testid="column-mapping-${csvColumn}"]`,
        leadField
      )
    }
    
    // Set import options
    if (options?.skipDuplicates) {
      await this.skipDuplicatesCheckbox.check()
    }
    
    if (options?.validateEmails) {
      await this.validateEmailsCheckbox.check()
    }
    
    // Confirm import
    await this.confirmImportButton.click()
    await this.waitForElement('[data-testid="import-progress"]')
    await this.waitForText('Import completed')
  }

  async searchLeads(query: string): Promise<void> {
    await this.searchInput.fill(query)
    await this.pressKey('Enter')
    await this.waitForPageLoad()
  }

  async filterLeads(filters: {
    status?: string
    source?: string
    industry?: string
    companySize?: string
    tags?: string
    dateRange?: { from: string; to: string }
  }): Promise<void> {
    await this.filterButton.click()
    await this.filterDialog.waitFor()
    
    if (filters.status) {
      await this.statusFilter.selectOption(filters.status)
    }
    
    if (filters.source) {
      await this.sourceFilter.selectOption(filters.source)
    }
    
    if (filters.industry) {
      await this.industryFilter.selectOption(filters.industry)
    }
    
    if (filters.companySize) {
      await this.companySizeFilter.selectOption(filters.companySize)
    }
    
    if (filters.tags) {
      await this.tagsFilter.fill(filters.tags)
    }
    
    if (filters.dateRange) {
      await this.page.fill('[data-testid="date-from"]', filters.dateRange.from)
      await this.page.fill('[data-testid="date-to"]', filters.dateRange.to)
    }
    
    await this.applyFiltersButton.click()
    await this.waitForPageLoad()
  }

  async clearFilters(): Promise<void> {
    await this.clearFiltersButton.click()
    await this.waitForPageLoad()
  }

  async selectLead(leadId: string): Promise<void> {
    await this.page.check(`input[data-testid="lead-checkbox-${leadId}"]`)
  }

  async selectAllLeads(): Promise<void> {
    await this.selectAllLeadsCheckbox.check()
  }

  async openLeadDetails(leadId: string): Promise<void> {
    await this.page.click(`[data-testid="lead-row-${leadId}"]`)
    await this.leadDetailsSheet.waitFor()
  }

  async editLead(leadId: string, leadData: {
    email?: string
    firstName?: string
    lastName?: string
    company?: string
    jobTitle?: string
    phone?: string
    website?: string
    industry?: string
    companySize?: string
    status?: string
    tags?: string
    notes?: string
  }): Promise<void> {
    await this.openLeadDetails(leadId)
    
    if (leadData.email) await this.leadEmailInput.fill(leadData.email)
    if (leadData.firstName) await this.leadFirstNameInput.fill(leadData.firstName)
    if (leadData.lastName) await this.leadLastNameInput.fill(leadData.lastName)
    if (leadData.company) await this.leadCompanyInput.fill(leadData.company)
    if (leadData.jobTitle) await this.leadJobTitleInput.fill(leadData.jobTitle)
    if (leadData.phone) await this.leadPhoneInput.fill(leadData.phone)
    if (leadData.website) await this.leadWebsiteInput.fill(leadData.website)
    if (leadData.industry) await this.leadIndustrySelect.selectOption(leadData.industry)
    if (leadData.companySize) await this.leadCompanySizeSelect.selectOption(leadData.companySize)
    if (leadData.status) await this.leadStatusSelect.selectOption(leadData.status)
    if (leadData.tags) await this.leadTagsInput.fill(leadData.tags)
    if (leadData.notes) await this.leadNotesTextarea.fill(leadData.notes)
    
    await this.saveLeadButton.click()
    await this.waitForPageLoad()
  }

  async deleteLead(leadId: string): Promise<void> {
    await this.openLeadDetails(leadId)
    await this.deleteLeadButton.click()
    await this.page.click('button[data-testid="confirm-delete"]')
    await this.waitForPageLoad()
  }

  async enrichLeads(options: {
    provider: string
    fields: string[]
    leadIds?: string[]
  }): Promise<void> {
    // Select leads if specified
    if (options.leadIds) {
      for (const leadId of options.leadIds) {
        await this.selectLead(leadId)
      }
    } else {
      await this.selectAllLeads()
    }
    
    await this.enrichLeadsButton.click()
    await this.enrichmentDialog.waitFor()
    
    await this.enrichmentProviderSelect.selectOption(options.provider)
    
    // Select enrichment fields
    for (const field of options.fields) {
      await this.page.check(`input[name="enrichmentFields"][value="${field}"]`)
    }
    
    await this.startEnrichmentButton.click()
    await this.waitForElement('[data-testid="enrichment-progress"]')
    await this.waitForText('Enrichment completed')
  }

  async bulkUpdateLeads(leadIds: string[], updates: {
    status?: string
    tags?: string
  }): Promise<void> {
    // Select leads
    for (const leadId of leadIds) {
      await this.selectLead(leadId)
    }
    
    await this.bulkActionsDropdown.selectOption('update')
    await this.executeBulkActionButton.click()
    await this.bulkUpdateDialog.waitFor()
    
    if (updates.status) {
      await this.bulkStatusSelect.selectOption(updates.status)
    }
    
    if (updates.tags) {
      await this.bulkTagsInput.fill(updates.tags)
    }
    
    await this.confirmBulkActionButton.click()
    await this.waitForPageLoad()
  }

  async bulkDeleteLeads(leadIds: string[]): Promise<void> {
    // Select leads
    for (const leadId of leadIds) {
      await this.selectLead(leadId)
    }
    
    await this.bulkActionsDropdown.selectOption('delete')
    await this.executeBulkActionButton.click()
    await this.bulkDeleteDialog.waitFor()
    
    await this.confirmBulkActionButton.click()
    await this.waitForPageLoad()
  }

  async exportLeads(options: {
    format: string
    fields: string[]
    filteredOnly?: boolean
  }): Promise<void> {
    await this.exportLeadsButton.click()
    await this.exportDialog.waitFor()
    
    await this.exportFormatSelect.selectOption(options.format)
    
    // Select export fields
    for (const field of options.fields) {
      await this.page.check(`input[name="exportFields"][value="${field}"]`)
    }
    
    if (options.filteredOnly) {
      await this.includeFilteredOnlyCheckbox.check()
    }
    
    await this.startExportButton.click()
    await this.waitForElement('[data-testid="download-export"]')
  }

  async downloadExport(): Promise<void> {
    const downloadPromise = this.page.waitForEvent('download')
    await this.downloadExportButton.click()
    return await downloadPromise
  }

  async validateEmails(leadIds?: string[]): Promise<void> {
    if (leadIds) {
      for (const leadId of leadIds) {
        await this.selectLead(leadId)
      }
    } else {
      await this.selectAllLeads()
    }
    
    await this.validateEmailsButton.click()
    await this.waitForElement('[data-testid="validation-results"]')
  }

  async changePage(direction: 'next' | 'previous'): Promise<void> {
    if (direction === 'next') {
      await this.nextPageButton.click()
    } else {
      await this.previousPageButton.click()
    }
    await this.waitForPageLoad()
  }

  async changePageSize(size: string): Promise<void> {
    await this.pageSizeSelect.selectOption(size)
    await this.waitForPageLoad()
  }

  // Data retrieval methods
  async getLeadCount(): Promise<number> {
    const rows = await this.leadRows.count()
    return rows
  }

  async getSelectedLeadCount(): Promise<number> {
    const countText = await this.selectedLeadsCount.textContent()
    return parseInt(countText?.replace(/[^0-9]/g, '') || '0')
  }

  async getImportResults(): Promise<{
    imported: number
    skipped: number
    errors: number
  }> {
    const resultsText = await this.importResults.textContent() || ''
    const importedMatch = resultsText.match(/(\d+) imported/)
    const skippedMatch = resultsText.match(/(\d+) skipped/)
    const errorsMatch = resultsText.match(/(\d+) errors/)
    
    return {
      imported: parseInt(importedMatch?.[1] || '0'),
      skipped: parseInt(skippedMatch?.[1] || '0'),
      errors: parseInt(errorsMatch?.[1] || '0')
    }
  }

  async getEnrichmentResults(): Promise<{
    enriched: number
    failed: number
    credits_used: number
  }> {
    const resultsText = await this.enrichmentResults.textContent() || ''
    const enrichedMatch = resultsText.match(/(\d+) enriched/)
    const failedMatch = resultsText.match(/(\d+) failed/)
    const creditsMatch = resultsText.match(/(\d+) credits used/)
    
    return {
      enriched: parseInt(enrichedMatch?.[1] || '0'),
      failed: parseInt(failedMatch?.[1] || '0'),
      credits_used: parseInt(creditsMatch?.[1] || '0')
    }
  }

  async getValidationResults(): Promise<{
    valid: number
    invalid: number
    risky: number
  }> {
    const validText = await this.validEmailsCount.textContent() || '0'
    const invalidText = await this.invalidEmailsCount.textContent() || '0'
    
    const valid = parseInt(validText.replace(/[^0-9]/g, ''))
    const invalid = parseInt(invalidText.replace(/[^0-9]/g, ''))
    
    // Risky emails might be in a separate counter
    const riskyText = await this.page.locator('[data-testid="risky-emails-count"]').textContent() || '0'
    const risky = parseInt(riskyText.replace(/[^0-9]/g, ''))
    
    return { valid, invalid, risky }
  }

  async getPaginationInfo(): Promise<{
    currentPage: number
    totalPages: number
    totalItems: number
    itemsPerPage: number
  }> {
    const infoText = await this.paginationInfo.textContent() || ''
    const match = infoText.match(/(\d+)-(\d+) of (\d+)/)
    
    if (!match) {
      return { currentPage: 1, totalPages: 1, totalItems: 0, itemsPerPage: 25 }
    }
    
    const start = parseInt(match[1])
    const end = parseInt(match[2])
    const total = parseInt(match[3])
    const itemsPerPage = end - start + 1
    const currentPage = Math.ceil(start / itemsPerPage)
    const totalPages = Math.ceil(total / itemsPerPage)
    
    return {
      currentPage,
      totalPages,
      totalItems: total,
      itemsPerPage
    }
  }

  // Validation helpers
  async expectLeadsImported(count: number): Promise<void> {
    await this.expectText('[data-testid="import-success"]', `${count} leads imported`)
  }

  async expectLeadSaved(): Promise<void> {
    await this.expectText('[data-testid="success-message"]', 'Lead saved successfully')
  }

  async expectLeadDeleted(): Promise<void> {
    await this.expectText('[data-testid="success-message"]', 'Lead deleted successfully')
  }

  async expectBulkActionCompleted(): Promise<void> {
    await this.expectText('[data-testid="success-message"]', 'Bulk action completed')
  }

  async expectEnrichmentCompleted(): Promise<void> {
    await this.expectText('[data-testid="success-message"]', 'Enrichment completed')
  }

  async expectValidationCompleted(): Promise<void> {
    await this.expectText('[data-testid="success-message"]', 'Email validation completed')
  }

  async expectExportReady(): Promise<void> {
    await this.expectVisible('[data-testid="download-export"]')
  }

  async expectImportError(): Promise<void> {
    await this.expectVisible('[data-testid="import-error"]')
  }

  async expectDuplicateLeadsSkipped(count: number): Promise<void> {
    await this.expectText('[data-testid="duplicate-skipped"]', `${count} duplicates skipped`)
  }

  async expectInvalidEmailsFound(count: number): Promise<void> {
    await this.expectText('[data-testid="invalid-emails"]', `${count} invalid emails found`)
  }
}