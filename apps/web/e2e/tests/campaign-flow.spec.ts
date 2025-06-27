import { test, expect } from '@playwright/test'
import { faker } from '@faker-js/faker'
import { CampaignPage } from '../pages/campaign.page'
import { AuthPage } from '../pages/auth.page'
import { visualRegressionHelpers } from '../helpers/visual-regression'
import path from 'path'

test.describe('Campaign Creation & Execution', () => {
  let campaignPage: CampaignPage
  let authPage: AuthPage

  test.beforeEach(async ({ page }) => {
    campaignPage = new CampaignPage(page)
    authPage = new AuthPage(page)
    
    // Login as authenticated user
    await authPage.login('test@example.com', 'password123')
  })

  test.describe('Campaign Creation', () => {
    test('should create a new campaign successfully', async ({ page }) => {
      const campaignData = {
        name: `Test Campaign ${faker.string.uuid()}`,
        description: faker.lorem.sentence(),
        type: 'email_sequence'
      }

      await campaignPage.createCampaign(campaignData)
      await campaignPage.expectCampaignCreated()
      
      // Take screenshot of created campaign
      await visualRegressionHelpers.takeScreenshot(page, 'campaign-created')
    })

    test('should validate required campaign fields', async ({ page }) => {
      await campaignPage.goToNewCampaign()
      
      // Try to save without required fields
      await campaignPage.saveCampaignButton.click()
      
      await campaignPage.expectVisible('[data-testid="name-error"]')
      await expect(page.locator('[data-testid="name-error"]')).toContainText('Campaign name is required')
    })

    test('should handle campaign name uniqueness', async ({ page }) => {
      const campaignName = `Duplicate Campaign ${faker.string.uuid()}`
      
      // Create first campaign
      await campaignPage.createCampaign({
        name: campaignName,
        description: 'First campaign',
        type: 'email_sequence'
      })
      
      // Try to create campaign with same name
      await campaignPage.createCampaign({
        name: campaignName,
        description: 'Second campaign',
        type: 'email_sequence'
      })
      
      await campaignPage.expectVisible('[data-testid="error-message"]')
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Campaign name already exists')
    })
  })

  test.describe('Lead Import via CSV', () => {
    test('should import leads from CSV file', async ({ page }) => {
      // Create test CSV file content
      const csvContent = `email,firstName,lastName,company,title
john.doe@example.com,John,Doe,Acme Corp,CEO
jane.smith@example.com,Jane,Smith,Tech Co,CTO
bob.wilson@example.com,Bob,Wilson,StartupXYZ,Founder`
      
      // Create temporary CSV file
      const csvPath = path.join(__dirname, '../fixtures/test-leads.csv')
      await page.context().addInitScript(() => {
        // Mock file system for testing
        window.testCSVContent = csvContent
      })
      
      // Create campaign first
      const campaignData = {
        name: `CSV Import Test ${faker.string.uuid()}`,
        description: 'Test campaign for CSV import',
        type: 'email_sequence'
      }
      await campaignPage.createCampaign(campaignData)
      
      // Import leads with column mapping
      const columnMapping = {
        'email': 'email',
        'firstName': 'first_name',
        'lastName': 'last_name',
        'company': 'company',
        'title': 'job_title'
      }
      
      // Mock the file upload for testing
      await page.route('**/api/leads/import', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            imported: 3,
            skipped: 0,
            errors: []
          })
        })
      })
      
      await campaignPage.importLeadsFromCSV(csvPath, columnMapping)
      await campaignPage.expectLeadsImported(3)
      
      // Take screenshot of import results
      await visualRegressionHelpers.takeScreenshot(page, 'leads-imported')
    })

    test('should handle CSV validation errors', async ({ page }) => {
      // Create invalid CSV content
      const invalidCSV = `email,name
invalid-email,John Doe
valid@email.com,Jane Doe
,Missing Email`
      
      // Mock API response with validation errors
      await page.route('**/api/leads/import', async (route) => {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            errors: [
              { row: 1, field: 'email', message: 'Invalid email format' },
              { row: 3, field: 'email', message: 'Email is required' }
            ]
          })
        })
      })
      
      const csvPath = path.join(__dirname, '../fixtures/invalid-leads.csv')
      
      // Try to import invalid CSV
      await campaignPage.goToNewCampaign()
      await campaignPage.importLeadsButton.click()
      await campaignPage.csvFileUpload.setInputFiles(csvPath)
      await campaignPage.confirmImportButton.click()
      
      // Verify error handling
      await campaignPage.expectVisible('[data-testid="import-errors"]')
      await expect(page.locator('[data-testid="import-errors"]')).toContainText('Invalid email format')
    })

    test('should preview CSV data before import', async ({ page }) => {
      const csvPath = path.join(__dirname, '../fixtures/test-leads.csv')
      
      await campaignPage.goToNewCampaign()
      await campaignPage.importLeadsButton.click()
      await campaignPage.csvFileUpload.setInputFiles(csvPath)
      
      // Wait for preview to load
      await campaignPage.expectVisible('[data-testid="import-preview-table"]')
      
      // Verify preview shows correct data
      const previewTable = page.locator('[data-testid="import-preview-table"]')
      await expect(previewTable).toContainText('john.doe@example.com')
      await expect(previewTable).toContainText('John')
      await expect(previewTable).toContainText('Acme Corp')
      
      // Take screenshot of preview
      await visualRegressionHelpers.takeScreenshot(page, 'csv-preview')
    })

    test('should handle large CSV files', async ({ page }) => {
      // Mock progress updates for large import
      let progressCount = 0
      await page.route('**/api/leads/import/progress', async (route) => {
        progressCount += 20
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            progress: Math.min(progressCount, 100),
            processed: progressCount * 10,
            total: 1000
          })
        })
      })
      
      await page.route('**/api/leads/import', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            imported: 1000,
            skipped: 0,
            errors: []
          })
        })
      })
      
      const largeCsvPath = path.join(__dirname, '../fixtures/large-leads.csv')
      
      await campaignPage.goToNewCampaign()
      await campaignPage.importLeadsFromCSV(largeCsvPath, {
        'email': 'email',
        'name': 'full_name'
      })
      
      // Verify progress bar is shown
      await campaignPage.expectVisible('[data-testid="import-progress"]')
      await campaignPage.expectLeadsImported(1000)
    })
  })

  test.describe('AI Email Generation', () => {
    test('should generate email content with AI', async ({ page }) => {
      // Mock AI generation API
      await page.route('**/api/ai/generate-email', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            subject: 'Personalized Subject Line',
            body: 'Dear {{firstName}},\n\nThis is a personalized email generated by AI...\n\nBest regards,\n{{senderName}}'
          })
        })
      })
      
      // Create campaign and navigate to email generation
      const campaignData = {
        name: `AI Email Test ${faker.string.uuid()}`,
        description: 'Test AI email generation',
        type: 'email_sequence'
      }
      await campaignPage.createCampaign(campaignData)
      
      // Generate email with AI
      const prompt = 'Create a professional outreach email for potential customers interested in our software solution'
      const generatedContent = await campaignPage.generateEmailWithAI(prompt, {
        tone: 'professional',
        length: 'medium'
      })
      
      // Verify generated content
      expect(generatedContent).toContain('{{firstName}}')
      expect(generatedContent).toContain('{{senderName}}')
      
      await campaignPage.expectEmailGenerated()
      await visualRegressionHelpers.takeScreenshot(page, 'ai-email-generated')
    })

    test('should handle different email tones and lengths', async ({ page }) => {
      const tones = ['professional', 'casual', 'friendly', 'urgent']
      const lengths = ['short', 'medium', 'long']
      
      for (const tone of tones) {
        for (const length of lengths) {
          // Mock different responses based on tone and length
          await page.route('**/api/ai/generate-email', async (route) => {
            const requestBody = await route.request().postDataJSON()
            
            let responseBody = 'Standard email content'
            if (requestBody.tone === 'urgent') {
              responseBody = 'URGENT: Time-sensitive email content'
            } else if (requestBody.tone === 'casual') {
              responseBody = 'Hey there! Casual email content'
            }
            
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                subject: `${tone} subject`,
                body: responseBody
              })
            })
          })
          
          const content = await campaignPage.generateEmailWithAI(
            'Generate an email',
            { tone, length }
          )
          
          // Verify tone is reflected in content
          if (tone === 'urgent') {
            expect(content).toContain('URGENT')
          } else if (tone === 'casual') {
            expect(content).toContain('Hey')
          }
        }
      }
    })

    test('should handle AI generation errors', async ({ page }) => {
      // Mock API error
      await page.route('**/api/ai/generate-email', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'AI service temporarily unavailable'
          })
        })
      })
      
      await campaignPage.goToNewCampaign()
      await campaignPage.generateEmailButton.click()
      await campaignPage.emailPromptInput.fill('Generate an email')
      await campaignPage.generateEmailContentButton.click()
      
      // Verify error handling
      await campaignPage.expectVisible('[data-testid="error-message"]')
      await expect(page.locator('[data-testid="error-message"]')).toContainText('AI service temporarily unavailable')
    })

    test('should allow regenerating email content', async ({ page }) => {
      let generationCount = 0
      await page.route('**/api/ai/generate-email', async (route) => {
        generationCount++
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            subject: `Generated Subject ${generationCount}`,
            body: `Generated content version ${generationCount}`
          })
        })
      })
      
      await campaignPage.goToNewCampaign()
      await campaignPage.generateEmailWithAI('Generate an email')
      
      // Regenerate content
      await campaignPage.regenerateEmailButton.click()
      await page.waitForResponse('**/api/ai/generate-email')
      
      // Verify new content is generated
      const newContent = await campaignPage.generatedEmailPreview.textContent()
      expect(newContent).toContain('version 2')
    })
  })

  test.describe('Campaign Sequence Creation', () => {
    test('should build multi-step email sequence', async ({ page }) => {
      const sequence = [
        {
          subject: 'Introduction Email',
          body: 'Hi {{firstName}}, introducing our solution...',
          delay: 0,
          delayUnit: 'days'
        },
        {
          subject: 'Follow-up Email',
          body: 'Hi {{firstName}}, following up on my previous email...',
          delay: 3,
          delayUnit: 'days'
        },
        {
          subject: 'Final Follow-up',
          body: 'Hi {{firstName}}, last chance to connect...',
          delay: 7,
          delayUnit: 'days'
        }
      ]
      
      // Create campaign
      const campaignData = {
        name: `Sequence Test ${faker.string.uuid()}`,
        description: 'Test email sequence',
        type: 'email_sequence'
      }
      await campaignPage.createCampaign(campaignData)
      
      // Build sequence
      await campaignPage.buildEmailSequence(sequence)
      await campaignPage.expectSequenceBuilt(3)
      
      // Take screenshot of sequence builder
      await visualRegressionHelpers.takeScreenshot(page, 'email-sequence-built')
    })

    test('should validate sequence step delays', async ({ page }) => {
      await campaignPage.goToNewCampaign()
      await campaignPage.addEmailStepButton.click()
      
      // Try to set invalid delay
      await page.fill('input[name="stepDelay"]', '-1')
      await campaignPage.saveCampaignButton.click()
      
      await campaignPage.expectVisible('[data-testid="delay-error"]')
      await expect(page.locator('[data-testid="delay-error"]')).toContainText('Delay must be positive')
    })

    test('should allow reordering sequence steps', async ({ page }) => {
      const sequence = [
        { subject: 'First', body: 'First email', delay: 0, delayUnit: 'days' },
        { subject: 'Second', body: 'Second email', delay: 1, delayUnit: 'days' },
        { subject: 'Third', body: 'Third email', delay: 2, delayUnit: 'days' }
      ]
      
      await campaignPage.goToNewCampaign()
      await campaignPage.buildEmailSequence(sequence)
      
      // Drag and drop to reorder (simulate)
      await campaignPage.dragAndDrop(
        '[data-testid="email-step-2"]',
        '[data-testid="email-step-0"]'
      )
      
      // Verify reordering
      const firstStep = page.locator('[data-testid="email-step-0"] input[name="emailSubject"]')
      await expect(firstStep).toHaveValue('Third')
    })

    test('should handle personalization variables', async ({ page }) => {
      await campaignPage.goToNewCampaign()
      
      const emailBody = 'Hi {{firstName}} from {{company}}, I hope this email finds you well...'
      await campaignPage.emailBodyEditor.fill(emailBody)
      
      // Verify personalization variables are highlighted
      await campaignPage.expectVisible('[data-testid="personalization-variables"]')
      await expect(page.locator('[data-testid="personalization-variables"]')).toContainText('firstName')
      await expect(page.locator('[data-testid="personalization-variables"]')).toContainText('company')
    })
  })

  test.describe('Campaign Launch and Monitoring', () => {
    test('should launch campaign successfully', async ({ page }) => {
      // Create and set up campaign
      const campaignData = {
        name: `Launch Test ${faker.string.uuid()}`,
        description: 'Test campaign launch',
        type: 'email_sequence'
      }
      await campaignPage.createCampaign(campaignData)
      
      // Add sample sequence
      const sequence = [{
        subject: 'Test Email',
        body: 'Hi {{firstName}}, this is a test email.',
        delay: 0,
        delayUnit: 'days'
      }]
      await campaignPage.buildEmailSequence(sequence)
      
      // Mock leads data
      await page.route('**/api/campaigns/*/leads', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: '1', email: 'test1@example.com', firstName: 'John' },
            { id: '2', email: 'test2@example.com', firstName: 'Jane' }
          ])
        })
      })
      
      // Add leads
      await campaignPage.selectAllLeads()
      
      // Configure settings
      await campaignPage.configureCampaignSettings({
        dailyLimit: 50,
        sendingSchedule: 'business_hours',
        timezone: 'America/New_York',
        trackOpens: true,
        trackClicks: true,
        trackReplies: true
      })
      
      // Launch campaign
      await campaignPage.launchCampaign()
      await campaignPage.expectCampaignLaunched()
      
      // Take screenshot of launched campaign
      await visualRegressionHelpers.takeScreenshot(page, 'campaign-launched')
    })

    test('should display campaign analytics', async ({ page }) => {
      // Mock analytics data
      await page.route('**/api/campaigns/*/analytics', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            emailsSent: 150,
            openRate: 25.5,
            clickRate: 5.2,
            replyRate: 3.1,
            bounceRate: 2.0
          })
        })
      })
      
      const campaignId = 'test-campaign-123'
      await page.goto(`/campaigns/${campaignId}`)
      
      // Verify analytics display
      await campaignPage.expectCampaignStats({
        emailsSent: 150,
        openRate: 25.5,
        clickRate: 5.2,
        replyRate: 3.1
      })
      
      // Take screenshot of analytics
      await visualRegressionHelpers.takeScreenshot(page, 'campaign-analytics')
    })

    test('should handle campaign pause and resume', async ({ page }) => {
      const campaignId = 'test-campaign-123'
      await page.goto(`/campaigns/${campaignId}`)
      
      // Mock API responses
      await page.route(`**/api/campaigns/${campaignId}/pause`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        })
      })
      
      await page.route(`**/api/campaigns/${campaignId}/resume`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        })
      })
      
      // Pause campaign
      await campaignPage.pauseCampaign()
      await campaignPage.expectCampaignPaused()
      
      // Resume campaign
      await campaignPage.resumeCampaign()
      await campaignPage.expectCampaignLaunched()
    })

    test('should stop campaign permanently', async ({ page }) => {
      const campaignId = 'test-campaign-123'
      await page.goto(`/campaigns/${campaignId}`)
      
      await page.route(`**/api/campaigns/${campaignId}/stop`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        })
      })
      
      await campaignPage.stopCampaign()
      await campaignPage.expectCampaignStopped()
    })
  })

  test.describe('Email Tracking and Analytics', () => {
    test('should track email opens', async ({ page }) => {
      // Mock tracking data
      await page.route('**/api/campaigns/*/tracking', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            opens: [
              { leadId: '1', timestamp: '2024-01-01T10:00:00Z', location: 'New York, NY' },
              { leadId: '2', timestamp: '2024-01-01T11:00:00Z', location: 'San Francisco, CA' }
            ]
          })
        })
      })
      
      const campaignId = 'test-campaign-123'
      await page.goto(`/campaigns/${campaignId}/tracking`)
      
      // Verify tracking data display
      await campaignPage.expectVisible('[data-testid="open-tracking-table"]')
      await expect(page.locator('[data-testid="open-tracking-table"]')).toContainText('New York, NY')
      await expect(page.locator('[data-testid="open-tracking-table"]')).toContainText('San Francisco, CA')
    })

    test('should track email clicks', async ({ page }) => {
      await page.route('**/api/campaigns/*/tracking', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            clicks: [
              { leadId: '1', url: 'https://example.com/product', timestamp: '2024-01-01T10:05:00Z' },
              { leadId: '2', url: 'https://example.com/contact', timestamp: '2024-01-01T11:10:00Z' }
            ]
          })
        })
      })
      
      const campaignId = 'test-campaign-123'
      await page.goto(`/campaigns/${campaignId}/tracking`)
      
      await campaignPage.expectVisible('[data-testid="click-tracking-table"]')
      await expect(page.locator('[data-testid="click-tracking-table"]')).toContainText('https://example.com/product')
    })

    test('should track email replies', async ({ page }) => {
      await page.route('**/api/campaigns/*/tracking', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            replies: [
              { leadId: '1', subject: 'Re: Introduction', timestamp: '2024-01-01T10:30:00Z' },
              { leadId: '2', subject: 'Re: Follow-up', timestamp: '2024-01-01T11:45:00Z' }
            ]
          })
        })
      })
      
      const campaignId = 'test-campaign-123'
      await page.goto(`/campaigns/${campaignId}/tracking`)
      
      await campaignPage.expectVisible('[data-testid="reply-tracking-table"]')
      await expect(page.locator('[data-testid="reply-tracking-table"]')).toContainText('Re: Introduction')
    })

    test('should handle bounce and complaint tracking', async ({ page }) => {
      await page.route('**/api/campaigns/*/tracking', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            bounces: [
              { leadId: '3', type: 'hard', reason: 'Invalid email address' }
            ],
            complaints: [
              { leadId: '4', type: 'spam', reason: 'Marked as spam' }
            ]
          })
        })
      })
      
      const campaignId = 'test-campaign-123'
      await page.goto(`/campaigns/${campaignId}/tracking`)
      
      await campaignPage.expectVisible('[data-testid="bounce-tracking-table"]')
      await expect(page.locator('[data-testid="bounce-tracking-table"]')).toContainText('Invalid email address')
      
      await campaignPage.expectVisible('[data-testid="complaint-tracking-table"]')
      await expect(page.locator('[data-testid="complaint-tracking-table"]')).toContainText('Marked as spam')
    })
  })

  test.describe('Performance and Load Testing', () => {
    test('should handle high-volume email sending', async ({ page }) => {
      // Mock high-volume campaign
      await page.route('**/api/campaigns/*/send', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            emailsQueued: 10000
          })
        })
      })
      
      const campaignData = {
        name: `High Volume Test ${faker.string.uuid()}`,
        description: 'High volume email test',
        type: 'email_sequence'
      }
      await campaignPage.createCampaign(campaignData)
      
      // Configure for high volume
      await campaignPage.configureCampaignSettings({
        dailyLimit: 1000,
        sendingSchedule: '24_7',
        timezone: 'UTC',
        trackOpens: true,
        trackClicks: true,
        trackReplies: true
      })
      
      await campaignPage.launchCampaign()
      
      // Verify system handles high volume
      await campaignPage.expectText('[data-testid="emails-queued"]', '10,000')
    })

    test('should perform well with large datasets', async ({ page }) => {
      // Mock large dataset response
      await page.route('**/api/campaigns', async (route) => {
        const campaigns = Array.from({ length: 1000 }, (_, i) => ({
          id: `campaign-${i}`,
          name: `Campaign ${i}`,
          status: 'active',
          emailsSent: Math.floor(Math.random() * 1000),
          openRate: Math.random() * 100
        }))
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(campaigns)
        })
      })
      
      const startTime = Date.now()
      await campaignPage.goToCampaigns()
      await page.waitForLoadState('networkidle')
      const loadTime = Date.now() - startTime
      
      // Should load large dataset within reasonable time
      expect(loadTime).toBeLessThan(5000)
      
      // Verify pagination or virtualization is working
      const visibleRows = await campaignPage.campaignRows.count()
      expect(visibleRows).toBeLessThanOrEqual(50) // Should not render all 1000 rows
    })
  })

  test.describe('Visual Regression', () => {
    test('should match visual snapshots for campaign pages', async ({ page }) => {
      const pages = [
        { url: '/campaigns', name: 'campaigns-list' },
        { url: '/campaigns/new', name: 'campaign-creation' },
        { url: '/campaigns/123', name: 'campaign-details' },
        { url: '/campaigns/123/analytics', name: 'campaign-analytics' }
      ]
      
      for (const pageInfo of pages) {
        await page.goto(pageInfo.url)
        await page.waitForLoadState('networkidle')
        await visualRegressionHelpers.takeScreenshot(page, pageInfo.name)
      }
    })

    test('should test responsive design for campaign interface', async ({ page }) => {
      await visualRegressionHelpers.testResponsive(
        page,
        '/campaigns',
        'campaigns-responsive'
      )
      
      await visualRegressionHelpers.testResponsive(
        page,
        '/campaigns/new',
        'campaign-creation-responsive'
      )
    })
  })

  test.describe('Accessibility', () => {
    test('should be keyboard navigable', async ({ page }) => {
      await campaignPage.goToCampaigns()
      
      // Test keyboard navigation through campaign list
      await page.keyboard.press('Tab') // Search input
      await page.keyboard.press('Tab') // Filter select
      await page.keyboard.press('Tab') // Create button
      await page.keyboard.press('Enter') // Activate create button
      
      await campaignPage.expectUrl('/campaigns/new')
    })

    test('should have proper ARIA labels for complex components', async ({ page }) => {
      await campaignPage.goToNewCampaign()
      
      // Check sequence builder accessibility
      const sequenceBuilder = page.locator('[data-testid="sequence-builder"]')
      await expect(sequenceBuilder).toHaveAttribute('role', 'region')
      await expect(sequenceBuilder).toHaveAttribute('aria-label', 'Email sequence builder')
      
      // Check campaign analytics accessibility
      await page.goto('/campaigns/123')
      const statsCards = page.locator('[data-testid="campaign-stats-card"]')
      await expect(statsCards.first()).toHaveAttribute('role', 'region')
    })
  })
})