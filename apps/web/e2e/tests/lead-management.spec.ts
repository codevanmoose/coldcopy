import { test, expect } from '@playwright/test'
import { faker } from '@faker-js/faker'
import { LeadsPage } from '../pages/leads.page'
import { AuthPage } from '../pages/auth.page'
import { visualRegressionHelpers } from '../helpers/visual-regression'
import path from 'path'

test.describe('Lead Management Workflow', () => {
  let leadsPage: LeadsPage
  let authPage: AuthPage

  test.beforeEach(async ({ page }) => {
    leadsPage = new LeadsPage(page)
    authPage = new AuthPage(page)
    
    // Login as authenticated user
    await authPage.login('test@example.com', 'password123')
  })

  test.describe('Lead Import and Validation', () => {
    test('should import leads from CSV with proper validation', async ({ page }) => {
      // Create test CSV content
      const csvContent = `email,firstName,lastName,company,jobTitle,phone,website
john.doe@example.com,John,Doe,Acme Corp,CEO,+1-555-0123,https://acme.com
jane.smith@techco.com,Jane,Smith,Tech Co,CTO,+1-555-0124,https://techco.com
bob.wilson@startup.com,Bob,Wilson,StartupXYZ,Founder,+1-555-0125,https://startup.com
invalid-email,Invalid,User,Bad Company,Manager,,
duplicate@example.com,Duplicate,User,Dup Corp,Employee,,`

      // Mock import API
      await page.route('**/api/leads/import', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            imported: 3,
            skipped: 1, // duplicate
            errors: 1,  // invalid email
            invalidEmails: ['invalid-email'],
            duplicates: ['duplicate@example.com']
          })
        })
      })

      await leadsPage.goToLeads()
      
      const csvPath = path.join(__dirname, '../fixtures/test-leads.csv')
      const mapping = {
        'email': 'email',
        'firstName': 'first_name',
        'lastName': 'last_name',
        'company': 'company',
        'jobTitle': 'job_title',
        'phone': 'phone',
        'website': 'website'
      }
      
      await leadsPage.importLeadsFromCSV(csvPath, mapping, {
        skipDuplicates: true,
        validateEmails: true
      })
      
      // Verify import results
      const results = await leadsPage.getImportResults()
      expect(results.imported).toBe(3)
      expect(results.skipped).toBe(1)
      expect(results.errors).toBe(1)
      
      await leadsPage.expectLeadsImported(3)
      await leadsPage.expectDuplicateLeadsSkipped(1)
      await leadsPage.expectInvalidEmailsFound(1)
      
      // Take screenshot of import results
      await visualRegressionHelpers.takeScreenshot(page, 'lead-import-results')
    })

    test('should handle large CSV import with progress tracking', async ({ page }) => {
      // Mock large import with progress updates
      let progressCount = 0
      await page.route('**/api/leads/import/progress', async (route) => {
        progressCount += 20
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            progress: Math.min(progressCount, 100),
            processed: progressCount * 50,
            total: 10000,
            estimated_time_remaining: Math.max(0, 300 - progressCount * 3)
          })
        })
      })

      await page.route('**/api/leads/import', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            imported: 9500,
            skipped: 300,
            errors: 200,
            job_id: 'import_job_123'
          })
        })
      })

      await leadsPage.goToLeads()
      
      const largeCsvPath = path.join(__dirname, '../fixtures/large-leads.csv')
      await leadsPage.importLeadsFromCSV(largeCsvPath, {
        'email': 'email',
        'name': 'full_name',
        'company': 'company'
      })
      
      // Verify progress tracking
      await leadsPage.expectVisible('[data-testid="import-progress"]')
      await leadsPage.expectLeadsImported(9500)
    })

    test('should validate CSV format and show preview', async ({ page }) => {
      await leadsPage.goToLeads()
      await leadsPage.importLeadsButton.click()
      
      const csvPath = path.join(__dirname, '../fixtures/sample-leads.csv')
      await leadsPage.csvFileUpload.setInputFiles(csvPath)
      
      // Wait for preview to load
      await leadsPage.expectVisible('[data-testid="import-preview-table"]')
      
      // Verify preview shows correct data
      const previewTable = page.locator('[data-testid="import-preview-table"]')
      await expect(previewTable).toContainText('john.doe@example.com')
      await expect(previewTable).toContainText('Acme Corp')
      
      // Test column mapping interface
      await leadsPage.expectVisible('[data-testid="column-mapping-table"]')
      
      // Take screenshot of import preview
      await visualRegressionHelpers.takeScreenshot(page, 'csv-import-preview')
    })

    test('should handle CSV import errors gracefully', async ({ page }) => {
      // Mock import error
      await page.route('**/api/leads/import', async (route) => {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Invalid CSV format',
            details: [
              { row: 1, field: 'email', message: 'Invalid email format' },
              { row: 3, field: 'phone', message: 'Invalid phone number' }
            ]
          })
        })
      })
      
      await leadsPage.goToLeads()
      
      const invalidCsvPath = path.join(__dirname, '../fixtures/invalid-leads.csv')
      
      try {
        await leadsPage.importLeadsFromCSV(invalidCsvPath, {
          'email': 'email',
          'name': 'full_name'
        })
      } catch {
        // Expected to fail
      }
      
      await leadsPage.expectImportError()
      await leadsPage.expectVisible('[data-testid="import-error-details"]')
    })
  })

  test.describe('Lead Enrichment Process', () => {
    test('should enrich leads with external data providers', async ({ page }) => {
      // Mock enrichment API
      await page.route('**/api/enrichment/enrich', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            job_id: 'enrich_job_123',
            estimated_completion: '2024-01-01T12:05:00Z'
          })
        })
      })

      // Mock enrichment results
      await page.route('**/api/enrichment/jobs/enrich_job_123', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'completed',
            results: {
              enriched: 85,
              failed: 15,
              credits_used: 85
            }
          })
        })
      })

      await leadsPage.goToLeads()
      
      // Mock leads data
      await page.route('**/api/leads', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: '1', email: 'john@acme.com', firstName: 'John', company: 'Acme' },
            { id: '2', email: 'jane@techco.com', firstName: 'Jane', company: 'TechCo' }
          ])
        })
      })
      
      const enrichmentOptions = {
        provider: 'clearbit',
        fields: ['job_title', 'company_size', 'industry', 'social_profiles'],
        leadIds: ['1', '2']
      }
      
      await leadsPage.enrichLeads(enrichmentOptions)
      await leadsPage.expectEnrichmentCompleted()
      
      // Verify enrichment results
      const results = await leadsPage.getEnrichmentResults()
      expect(results.enriched).toBe(85)
      expect(results.failed).toBe(15)
      expect(results.credits_used).toBe(85)
      
      // Take screenshot of enrichment results
      await visualRegressionHelpers.takeScreenshot(page, 'lead-enrichment-results')
    })

    test('should handle different enrichment providers', async ({ page }) => {
      const providers = ['clearbit', 'hunter', 'apollo']
      
      for (const provider of providers) {
        // Mock provider-specific response
        await page.route('**/api/enrichment/enrich', async (route) => {
          const requestBody = await route.request().postDataJSON()
          expect(requestBody.provider).toBe(provider)
          
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              provider: provider,
              job_id: `enrich_${provider}_123`
            })
          })
        })
        
        await leadsPage.enrichLeads({
          provider: provider,
          fields: ['job_title', 'company_size'],
          leadIds: ['1']
        })
        
        await leadsPage.expectEnrichmentCompleted()
      }
    })

    test('should show enrichment cost and credit usage', async ({ page }) => {
      // Mock enrichment cost calculation
      await page.route('**/api/enrichment/estimate', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            estimated_credits: 150,
            cost_per_credit: 0.05,
            total_cost: 7.50,
            available_credits: 500
          })
        })
      })
      
      await leadsPage.goToLeads()
      await leadsPage.selectAllLeads()
      await leadsPage.enrichLeadsButton.click()
      
      // Verify cost information is displayed
      await leadsPage.expectVisible('[data-testid="enrichment-cost"]')
      await leadsPage.expectText('[data-testid="estimated-credits"]', '150 credits')
      await leadsPage.expectText('[data-testid="estimated-cost"]', '$7.50')
    })

    test('should handle enrichment failures and retries', async ({ page }) => {
      // Mock failed enrichment
      await page.route('**/api/enrichment/enrich', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Enrichment provider temporarily unavailable'
          })
        })
      })
      
      await leadsPage.goToLeads()
      
      try {
        await leadsPage.enrichLeads({
          provider: 'clearbit',
          fields: ['job_title'],
          leadIds: ['1']
        })
      } catch {
        // Expected to fail
      }
      
      // Verify error handling
      await leadsPage.expectVisible('[data-testid="enrichment-error"]')
      await leadsPage.expectVisible('button[data-testid="retry-enrichment"]')
    })
  })

  test.describe('Manual Lead Editing', () => {
    test('should edit individual lead details', async ({ page }) => {
      // Mock lead data
      await page.route('**/api/leads/1', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: '1',
              email: 'john.doe@example.com',
              firstName: 'John',
              lastName: 'Doe',
              company: 'Acme Corp',
              jobTitle: 'CEO',
              phone: '+1-555-0123',
              website: 'https://acme.com',
              industry: 'Technology',
              companySize: '50-100',
              status: 'new',
              tags: 'prospect,enterprise',
              notes: 'Initial contact made'
            })
          })
        } else if (route.request().method() === 'PUT') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true })
          })
        }
      })
      
      await leadsPage.goToLeads()
      
      const updatedData = {
        firstName: 'Jonathan',
        jobTitle: 'Chief Executive Officer',
        status: 'qualified',
        tags: 'prospect,enterprise,hot-lead',
        notes: 'Very interested in our solution. Follow up scheduled.'
      }
      
      await leadsPage.editLead('1', updatedData)
      await leadsPage.expectLeadSaved()
      
      // Take screenshot of lead editing interface
      await visualRegressionHelpers.takeScreenshot(page, 'lead-editing-interface')
    })

    test('should validate required fields when editing', async ({ page }) => {
      await leadsPage.goToLeads()
      await leadsPage.openLeadDetails('1')
      
      // Clear required email field
      await leadsPage.leadEmailInput.fill('')
      await leadsPage.saveLeadButton.click()
      
      // Verify validation error
      await leadsPage.expectVisible('[data-testid="email-required-error"]')
      await expect(page.locator('[data-testid="email-required-error"]')).toContainText('Email is required')
    })

    test('should validate email format when editing', async ({ page }) => {
      await leadsPage.goToLeads()
      await leadsPage.openLeadDetails('1')
      
      await leadsPage.leadEmailInput.fill('invalid-email-format')
      await leadsPage.saveLeadButton.click()
      
      await leadsPage.expectVisible('[data-testid="email-format-error"]')
    })

    test('should handle lead deletion with confirmation', async ({ page }) => {
      // Mock delete API
      await page.route('**/api/leads/1', async (route) => {
        if (route.request().method() === 'DELETE') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true })
          })
        }
      })
      
      await leadsPage.goToLeads()
      await leadsPage.deleteLead('1')
      await leadsPage.expectLeadDeleted()
    })

    test('should support lead tagging and categorization', async ({ page }) => {
      await leadsPage.goToLeads()
      await leadsPage.openLeadDetails('1')
      
      // Test tag input with autocomplete
      await leadsPage.leadTagsInput.fill('enterprise')
      await leadsPage.expectVisible('[data-testid="tag-suggestions"]')
      
      // Add multiple tags
      await leadsPage.leadTagsInput.fill('enterprise, hot-lead, decision-maker')
      await leadsPage.saveLeadButton.click()
      
      await leadsPage.expectLeadSaved()
    })
  })

  test.describe('Bulk Operations', () => {
    test('should perform bulk status updates', async ({ page }) => {
      // Mock bulk update API
      await page.route('**/api/leads/bulk-update', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            updated: 25,
            failed: 0
          })
        })
      })
      
      await leadsPage.goToLeads()
      
      const leadIds = ['1', '2', '3', '4', '5']
      await leadsPage.bulkUpdateLeads(leadIds, {
        status: 'qualified',
        tags: 'bulk-qualified'
      })
      
      await leadsPage.expectBulkActionCompleted()
      
      // Verify success message shows count
      await leadsPage.expectText('[data-testid="bulk-success"]', '25 leads updated')
    })

    test('should perform bulk deletion', async ({ page }) => {
      // Mock bulk delete API
      await page.route('**/api/leads/bulk-delete', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            deleted: 10
          })
        })
      })
      
      await leadsPage.goToLeads()
      
      const leadIds = ['1', '2', '3']
      await leadsPage.bulkDeleteLeads(leadIds)
      await leadsPage.expectBulkActionCompleted()
    })

    test('should handle bulk operation errors', async ({ page }) => {
      // Mock partial failure
      await page.route('**/api/leads/bulk-update', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            updated: 20,
            failed: 5,
            errors: [
              { leadId: '1', error: 'Lead not found' },
              { leadId: '2', error: 'Invalid status' }
            ]
          })
        })
      })
      
      await leadsPage.goToLeads()
      
      const leadIds = Array.from({ length: 25 }, (_, i) => (i + 1).toString())
      await leadsPage.bulkUpdateLeads(leadIds, { status: 'qualified' })
      
      // Verify partial success message
      await leadsPage.expectText('[data-testid="bulk-partial-success"]', '20 updated, 5 failed')
      await leadsPage.expectVisible('[data-testid="bulk-error-details"]')
    })

    test('should allow bulk operations on filtered results', async ({ page }) => {
      await leadsPage.goToLeads()
      
      // Apply filter first
      await leadsPage.filterLeads({
        status: 'new',
        industry: 'technology'
      })
      
      // Select all filtered results
      await leadsPage.selectAllLeads()
      
      const selectedCount = await leadsPage.getSelectedLeadCount()
      expect(selectedCount).toBeGreaterThan(0)
      
      // Perform bulk action on filtered results
      await leadsPage.bulkActionsDropdown.selectOption('update')
      await leadsPage.executeBulkActionButton.click()
      
      // Verify bulk action applies only to filtered results
      await leadsPage.expectText('[data-testid="bulk-action-scope"]', 'filtered leads')
    })
  })

  test.describe('Search and Filtering', () => {
    test('should search leads by various criteria', async ({ page }) => {
      // Mock search API
      await page.route('**/api/leads/search**', async (route) => {
        const url = new URL(route.request().url())
        const query = url.searchParams.get('q')
        
        const mockResults = {
          'acme': [
            { id: '1', email: 'john@acme.com', company: 'Acme Corp' }
          ],
          'john.doe@example.com': [
            { id: '2', email: 'john.doe@example.com', firstName: 'John', lastName: 'Doe' }
          ],
          'CEO': [
            { id: '3', email: 'ceo@company.com', jobTitle: 'CEO' }
          ]
        }
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockResults[query] || [])
        })
      })
      
      await leadsPage.goToLeads()
      
      // Test company search
      await leadsPage.searchLeads('acme')
      let leadCount = await leadsPage.getLeadCount()
      expect(leadCount).toBe(1)
      
      // Test email search
      await leadsPage.searchLeads('john.doe@example.com')
      leadCount = await leadsPage.getLeadCount()
      expect(leadCount).toBe(1)
      
      // Test job title search
      await leadsPage.searchLeads('CEO')
      leadCount = await leadsPage.getLeadCount()
      expect(leadCount).toBe(1)
    })

    test('should filter leads by multiple criteria', async ({ page }) => {
      // Mock filter API
      await page.route('**/api/leads**', async (route) => {
        const url = new URL(route.request().url())
        const status = url.searchParams.get('status')
        const industry = url.searchParams.get('industry')
        
        let mockLeads = []
        if (status === 'qualified' && industry === 'technology') {
          mockLeads = [
            { id: '1', status: 'qualified', industry: 'technology' },
            { id: '2', status: 'qualified', industry: 'technology' }
          ]
        }
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockLeads)
        })
      })
      
      await leadsPage.goToLeads()
      
      await leadsPage.filterLeads({
        status: 'qualified',
        industry: 'technology',
        companySize: '50-100'
      })
      
      const leadCount = await leadsPage.getLeadCount()
      expect(leadCount).toBe(2)
      
      // Take screenshot of filtered results
      await visualRegressionHelpers.takeScreenshot(page, 'leads-filtered-results')
    })

    test('should filter by date ranges', async ({ page }) => {
      await leadsPage.goToLeads()
      
      await leadsPage.filterLeads({
        dateRange: {
          from: '2024-01-01',
          to: '2024-01-31'
        }
      })
      
      // Verify date filter is applied
      await leadsPage.expectVisible('[data-testid="active-date-filter"]')
    })

    test('should clear all filters', async ({ page }) => {
      await leadsPage.goToLeads()
      
      // Apply multiple filters
      await leadsPage.filterLeads({
        status: 'qualified',
        industry: 'technology',
        tags: 'enterprise'
      })
      
      // Clear filters
      await leadsPage.clearFilters()
      
      // Verify filters are cleared
      await leadsPage.expectHidden('[data-testid="active-filters"]')
    })

    test('should save and apply filter presets', async ({ page }) => {
      // Mock filter presets API
      await page.route('**/api/leads/filter-presets', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'qualified-tech',
              name: 'Qualified Tech Leads',
              filters: { status: 'qualified', industry: 'technology' }
            }
          ])
        })
      })
      
      await leadsPage.goToLeads()
      
      // Apply filter preset
      await page.click('[data-testid="filter-presets"]')
      await page.click('[data-testid="preset-qualified-tech"]')
      
      // Verify preset is applied
      await leadsPage.expectVisible('[data-testid="active-preset"]')
      await leadsPage.expectText('[data-testid="active-preset"]', 'Qualified Tech Leads')
    })
  })

  test.describe('Email Validation', () => {
    test('should validate email addresses in bulk', async ({ page }) => {
      // Mock validation API
      await page.route('**/api/leads/validate-emails', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            results: {
              valid: 85,
              invalid: 10,
              risky: 5,
              total: 100
            },
            details: [
              { email: 'valid@example.com', status: 'valid', score: 95 },
              { email: 'invalid@fake.com', status: 'invalid', reason: 'Domain does not exist' },
              { email: 'risky@tempmail.com', status: 'risky', reason: 'Temporary email provider' }
            ]
          })
        })
      })
      
      await leadsPage.goToLeads()
      await leadsPage.validateEmails()
      
      const results = await leadsPage.getValidationResults()
      expect(results.valid).toBe(85)
      expect(results.invalid).toBe(10)
      expect(results.risky).toBe(5)
      
      await leadsPage.expectValidationCompleted()
      
      // Take screenshot of validation results
      await visualRegressionHelpers.takeScreenshot(page, 'email-validation-results')
    })

    test('should handle real-time email validation during editing', async ({ page }) => {
      // Mock real-time validation
      await page.route('**/api/email/validate', async (route) => {
        const email = await route.request().postDataJSON().then(data => data.email)
        
        let response = { valid: true, score: 95 }
        if (email.includes('invalid')) {
          response = { valid: false, reason: 'Invalid format' }
        } else if (email.includes('risky')) {
          response = { valid: true, score: 60, risky: true, reason: 'Temporary email' }
        }
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(response)
        })
      })
      
      await leadsPage.goToLeads()
      await leadsPage.openLeadDetails('1')
      
      // Test valid email
      await leadsPage.leadEmailInput.fill('valid@example.com')
      await leadsPage.expectVisible('[data-testid="email-valid-indicator"]')
      
      // Test invalid email
      await leadsPage.leadEmailInput.fill('invalid@fake.com')
      await leadsPage.expectVisible('[data-testid="email-invalid-indicator"]')
      
      // Test risky email
      await leadsPage.leadEmailInput.fill('risky@tempmail.com')
      await leadsPage.expectVisible('[data-testid="email-risky-indicator"]')
    })

    test('should show validation history and statistics', async ({ page }) => {
      // Mock validation history
      await page.route('**/api/leads/validation-history', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'val_1',
              date: '2024-01-01',
              total_checked: 1000,
              valid: 850,
              invalid: 100,
              risky: 50,
              credits_used: 1000
            },
            {
              id: 'val_2',
              date: '2024-01-02',
              total_checked: 500,
              valid: 450,
              invalid: 30,
              risky: 20,
              credits_used: 500
            }
          ])
        })
      })
      
      await leadsPage.goToLeads()
      await page.click('[data-testid="validation-history"]')
      
      await leadsPage.expectVisible('[data-testid="validation-history-table"]')
      await leadsPage.expectText('[data-testid="total-validated"]', '1,500')
    })
  })

  test.describe('Data Export', () => {
    test('should export leads in multiple formats', async ({ page }) => {
      const formats = ['csv', 'xlsx', 'json']
      
      for (const format of formats) {
        // Mock export API
        await page.route('**/api/leads/export', async (route) => {
          const requestBody = await route.request().postDataJSON()
          expect(requestBody.format).toBe(format)
          
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              export_id: `export_${format}_123`,
              download_url: `/exports/leads.${format}`
            })
          })
        })
        
        await leadsPage.goToLeads()
        
        await leadsPage.exportLeads({
          format: format,
          fields: ['email', 'firstName', 'lastName', 'company']
        })
        
        await leadsPage.expectExportReady()
        
        // Mock download
        const downloadPromise = page.waitForEvent('download')
        await page.route(`**/exports/leads.${format}`, async (route) => {
          await route.fulfill({
            status: 200,
            contentType: format === 'csv' ? 'text/csv' : 
                         format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' :
                         'application/json',
            body: `Mock ${format} export data`
          })
        })
        
        const download = await leadsPage.downloadExport()
        expect((await download).suggestedFilename()).toContain(format)
      }
    })

    test('should export filtered results only', async ({ page }) => {
      await leadsPage.goToLeads()
      
      // Apply filters
      await leadsPage.filterLeads({
        status: 'qualified',
        industry: 'technology'
      })
      
      // Export filtered results
      await leadsPage.exportLeads({
        format: 'csv',
        fields: ['email', 'company', 'status'],
        filteredOnly: true
      })
      
      await leadsPage.expectExportReady()
    })

    test('should allow custom field selection for export', async ({ page }) => {
      await leadsPage.goToLeads()
      await leadsPage.exportLeadsButton.click()
      
      // Verify all available fields are shown
      await leadsPage.expectVisible('[data-testid="export-fields"]')
      
      const fieldCheckboxes = await leadsPage.exportFieldsCheckboxes.count()
      expect(fieldCheckboxes).toBeGreaterThan(5)
      
      // Select specific fields
      await page.check('input[name="exportFields"][value="email"]')
      await page.check('input[name="exportFields"][value="firstName"]')
      await page.check('input[name="exportFields"][value="company"]')
      
      await leadsPage.startExportButton.click()
      await leadsPage.expectExportReady()
    })
  })

  test.describe('Performance and Pagination', () => {
    test('should handle large datasets with pagination', async ({ page }) => {
      // Mock large dataset
      await page.route('**/api/leads**', async (route) => {
        const url = new URL(route.request().url())
        const page_num = parseInt(url.searchParams.get('page') || '1')
        const page_size = parseInt(url.searchParams.get('page_size') || '25')
        
        const total = 10000
        const totalPages = Math.ceil(total / page_size)
        
        const leads = Array.from({ length: page_size }, (_, i) => ({
          id: ((page_num - 1) * page_size + i + 1).toString(),
          email: `user${(page_num - 1) * page_size + i + 1}@example.com`,
          firstName: `User${(page_num - 1) * page_size + i + 1}`,
          company: `Company ${(page_num - 1) * page_size + i + 1}`
        }))
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            leads,
            pagination: {
              page: page_num,
              page_size,
              total,
              total_pages: totalPages
            }
          })
        })
      })
      
      await leadsPage.goToLeads()
      
      const paginationInfo = await leadsPage.getPaginationInfo()
      expect(paginationInfo.totalItems).toBe(10000)
      expect(paginationInfo.totalPages).toBeGreaterThan(1)
      
      // Test pagination navigation
      await leadsPage.changePage('next')
      const newPaginationInfo = await leadsPage.getPaginationInfo()
      expect(newPaginationInfo.currentPage).toBe(2)
      
      // Test page size change
      await leadsPage.changePageSize('50')
      const updatedPaginationInfo = await leadsPage.getPaginationInfo()
      expect(updatedPaginationInfo.itemsPerPage).toBe(50)
    })

    test('should load leads quickly even with large datasets', async ({ page }) => {
      const startTime = Date.now()
      await leadsPage.goToLeads()
      await page.waitForSelector('[data-testid="leads-table"]')
      const loadTime = Date.now() - startTime
      
      expect(loadTime).toBeLessThan(3000) // Should load within 3 seconds
    })

    test('should handle concurrent operations efficiently', async ({ page }) => {
      await leadsPage.goToLeads()
      
      // Start multiple operations concurrently
      const operations = [
        leadsPage.searchLeads('test'),
        leadsPage.filterLeads({ status: 'new' }),
        leadsPage.validateEmails(['1', '2', '3'])
      ]
      
      const startTime = Date.now()
      await Promise.all(operations)
      const totalTime = Date.now() - startTime
      
      expect(totalTime).toBeLessThan(10000) // Should complete within 10 seconds
    })
  })

  test.describe('Visual Regression', () => {
    test('should match visual snapshots for lead pages', async ({ page }) => {
      const leadPages = [
        { url: '/leads', name: 'leads-list' },
        { url: '/leads?filter=qualified', name: 'leads-filtered' },
        { url: '/leads/import', name: 'leads-import' },
        { url: '/leads/export', name: 'leads-export' }
      ]
      
      for (const pageInfo of leadPages) {
        await page.goto(pageInfo.url)
        await page.waitForLoadState('networkidle')
        await visualRegressionHelpers.takeScreenshot(page, pageInfo.name)
      }
    })

    test('should test responsive design for leads interface', async ({ page }) => {
      await visualRegressionHelpers.testResponsive(
        page,
        '/leads',
        'leads-responsive'
      )
    })
  })

  test.describe('Accessibility', () => {
    test('should be keyboard navigable', async ({ page }) => {
      await leadsPage.goToLeads()
      
      // Test keyboard navigation through leads table
      await page.keyboard.press('Tab') // Search input
      await page.keyboard.press('Tab') // Filter button
      await page.keyboard.press('Tab') // First lead checkbox
      await page.keyboard.press('Space') // Select lead
      
      // Verify lead is selected
      const selectedCount = await leadsPage.getSelectedLeadCount()
      expect(selectedCount).toBe(1)
    })

    test('should have proper ARIA labels for lead components', async ({ page }) => {
      await leadsPage.goToLeads()
      
      // Check table accessibility
      const leadsTable = page.locator('[data-testid="leads-table"]')
      await expect(leadsTable).toHaveAttribute('role', 'table')
      
      // Check form accessibility
      const searchInput = page.locator('[data-testid="leads-search"]')
      await expect(searchInput).toHaveAttribute('aria-label', 'Search leads')
    })

    test('should support screen reader navigation', async ({ page }) => {
      await leadsPage.goToLeads()
      
      // Check for proper heading structure
      const mainHeading = page.locator('h1')
      await expect(mainHeading).toContainText('Leads')
      
      // Check for aria-live regions for dynamic updates
      await leadsPage.searchLeads('test')
      const resultsRegion = page.locator('[data-testid="search-results"]')
      await expect(resultsRegion).toHaveAttribute('aria-live', 'polite')
    })
  })
})