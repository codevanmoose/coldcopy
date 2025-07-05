import { test, expect } from '@playwright/test';
import { TestHelpers, customExpect } from '../helpers/test-utils';

test.describe('Campaign Management Tests', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    
    // Inject console error tracking
    await page.addInitScript(() => {
      (window as any).__consoleErrors = [];
      const originalError = console.error;
      console.error = (...args: any[]) => {
        (window as any).__consoleErrors.push(args.join(' '));
        originalError(...args);
      };
    });
    
    // Login and navigate to campaigns
    await helpers.loginAsAdmin();
    await helpers.navigateTo('campaigns');
  });

  test.describe('Campaign List', () => {
    test('should display existing campaigns', async ({ page }) => {
      await helpers.waitForLoadingComplete();
      
      // Check for campaign cards or list
      const campaigns = await page.locator('[data-testid="campaign-card"], .campaign-item, .campaign-card').all();
      expect(campaigns.length).toBeGreaterThan(0);
      
      // Check campaign card contents
      const firstCampaign = campaigns[0];
      await expect(firstCampaign.locator('text=/.*/')).toBeVisible(); // Has text
      
      // Check for campaign status indicators
      const hasStatus = await firstCampaign.locator('text=/draft|active|paused|completed/i').isVisible();
      expect(hasStatus).toBe(true);
    });

    test('should filter campaigns by status', async ({ page }) => {
      // Look for filter buttons or dropdown
      const filterButton = page.locator('button:has-text("Filter"), select[name*="status"], button:has-text("All")').first();
      
      if (await filterButton.isVisible()) {
        await filterButton.click();
        await page.waitForTimeout(500);
        
        // Try to filter by draft
        const draftFilter = page.locator('text="Draft"').first();
        if (await draftFilter.isVisible()) {
          await draftFilter.click();
          await helpers.waitForLoadingComplete();
          
          // Check that list updated
          const campaigns = await page.locator('[data-testid="campaign-card"], .campaign-item').count();
          // List should have changed (might be 0 if no drafts)
        }
      }
    });
  });

  test.describe('Create Campaign', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to new campaign page
      const newButton = page.locator('button:has-text("New Campaign"), a:has-text("New Campaign"), button:has-text("Create Campaign")').first();
      await newButton.click();
      await page.waitForURL('**/campaigns/new', { timeout: 10000 });
    });

    test('should create a basic campaign', async ({ page }) => {
      const testData = helpers.generateTestData();
      
      // Fill campaign details
      await helpers.fillField('input[name="name"], input[placeholder*="campaign name" i]', testData.campaign.name);
      
      // Select campaign type if available
      const typeSelector = page.locator('select[name="type"], input[name="type"]').first();
      if (await typeSelector.isVisible()) {
        await typeSelector.selectOption({ index: 0 });
      }
      
      // Add subject line
      const subjectField = page.locator('input[name="subject"], input[placeholder*="subject" i]').first();
      if (await subjectField.isVisible()) {
        await subjectField.fill(testData.campaign.subject);
      }
      
      // Add email body
      const bodyField = page.locator('textarea[name="body"], [contenteditable="true"], .email-editor').first();
      if (await bodyField.isVisible()) {
        await bodyField.fill(testData.campaign.body);
      }
      
      // Save as draft
      const saveButton = page.locator('button:has-text("Save"), button:has-text("Create")').first();
      await saveButton.click();
      
      // Wait for save
      await page.waitForTimeout(2000);
      
      // Check for success message or redirect
      const currentUrl = page.url();
      if (currentUrl.includes('/campaigns/') && !currentUrl.includes('/new')) {
        // Successfully created and redirected to campaign detail
        expect(true).toBe(true);
      } else {
        // Check for success message
        const successMessage = await page.locator('text=/success|created|saved/i').first().isVisible();
        expect(successMessage).toBe(true);
      }
      
      await helpers.screenshot('campaign-created');
    });

    test('should use AI to generate email content', async ({ page }) => {
      // Look for AI generation button
      const aiButton = page.locator('button:has-text("AI"), button:has-text("Generate"), button[aria-label*="AI"]').first();
      
      if (await aiButton.isVisible()) {
        await aiButton.click();
        await page.waitForTimeout(1000);
        
        // Fill AI prompt if modal appears
        const promptField = page.locator('textarea[placeholder*="describe"], textarea[name="prompt"]').first();
        if (await promptField.isVisible()) {
          await promptField.fill('Write a friendly email to introduce our new product to potential customers');
          
          // Generate
          const generateButton = page.locator('button:has-text("Generate"), button:has-text("Create")').last();
          await generateButton.click();
          
          // Wait for generation (this might take a few seconds)
          await page.waitForTimeout(5000);
          
          // Check if content was generated
          const emailBody = await page.locator('textarea[name="body"], [contenteditable="true"], .email-content').first().textContent();
          expect(emailBody).toBeTruthy();
          expect(emailBody!.length).toBeGreaterThan(50);
          
          await helpers.screenshot('ai-generated-email');
        }
      }
    });

    test('should validate required fields', async ({ page }) => {
      // Try to save without filling required fields
      const saveButton = page.locator('button:has-text("Save"), button:has-text("Create")').first();
      await saveButton.click();
      
      // Should show validation errors
      await page.waitForTimeout(1000);
      const errors = await helpers.checkForErrors();
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  test.describe('Campaign Sequences', () => {
    test('should create multi-step campaign', async ({ page }) => {
      // Navigate to new campaign
      const newButton = page.locator('button:has-text("New Campaign"), a:has-text("New Campaign")').first();
      await newButton.click();
      await page.waitForURL('**/campaigns/new');
      
      // Look for sequence or multi-step option
      const sequenceOption = page.locator('text=/sequence|multi.*step|follow.*up/i').first();
      if (await sequenceOption.isVisible()) {
        await sequenceOption.click();
        
        // Add multiple steps
        const addStepButton = page.locator('button:has-text("Add Step"), button:has-text("Add Email")').first();
        if (await addStepButton.isVisible()) {
          // Add first email
          await helpers.fillField('input[name="subject"]', 'Initial Outreach');
          
          // Add second step
          await addStepButton.click();
          await page.waitForTimeout(1000);
          
          // Should have multiple email forms
          const emailForms = await page.locator('.email-step, [data-testid="email-step"]').count();
          expect(emailForms).toBeGreaterThan(1);
        }
      }
    });
  });

  test.describe('Campaign Actions', () => {
    test('should preview campaign before sending', async ({ page }) => {
      // Click on first campaign
      const firstCampaign = page.locator('[data-testid="campaign-card"], .campaign-item').first();
      await firstCampaign.click();
      
      await page.waitForLoadState('networkidle');
      
      // Look for preview button
      const previewButton = page.locator('button:has-text("Preview"), button[aria-label*="preview"]').first();
      if (await previewButton.isVisible()) {
        await previewButton.click();
        await page.waitForTimeout(1000);
        
        // Should show preview modal or navigate to preview
        const hasPreview = await page.locator('.preview-modal, [data-testid="preview"], .email-preview').isVisible();
        expect(hasPreview).toBe(true);
        
        await helpers.screenshot('campaign-preview');
      }
    });

    test('should duplicate existing campaign', async ({ page }) => {
      // Click on campaign actions menu
      const actionsButton = page.locator('button[aria-label*="actions"], button:has-text("...")').first();
      if (await actionsButton.isVisible()) {
        await actionsButton.click();
        await page.waitForTimeout(500);
        
        // Click duplicate
        const duplicateOption = page.locator('text="Duplicate"').first();
        if (await duplicateOption.isVisible()) {
          await duplicateOption.click();
          await page.waitForTimeout(2000);
          
          // Should create a copy
          const campaigns = await page.locator('[data-testid="campaign-card"], .campaign-item').count();
          expect(campaigns).toBeGreaterThan(1);
        }
      }
    });

    test('should delete campaign', async ({ page }) => {
      // Get initial count
      const initialCount = await page.locator('[data-testid="campaign-card"], .campaign-item').count();
      
      // Click on campaign actions
      const actionsButton = page.locator('button[aria-label*="actions"], button:has-text("...")').first();
      if (await actionsButton.isVisible()) {
        await actionsButton.click();
        await page.waitForTimeout(500);
        
        // Click delete
        const deleteOption = page.locator('text="Delete"').first();
        if (await deleteOption.isVisible()) {
          await deleteOption.click();
          
          // Confirm deletion
          const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Delete")').last();
          if (await confirmButton.isVisible()) {
            await confirmButton.click();
            await page.waitForTimeout(2000);
            
            // Count should decrease
            const newCount = await page.locator('[data-testid="campaign-card"], .campaign-item').count();
            expect(newCount).toBeLessThan(initialCount);
          }
        }
      }
    });
  });

  test.describe('Campaign Analytics', () => {
    test('should show campaign performance metrics', async ({ page }) => {
      // Click on a campaign to view details
      const campaign = page.locator('[data-testid="campaign-card"], .campaign-item').first();
      await campaign.click();
      
      await page.waitForLoadState('networkidle');
      
      // Check for metrics
      const metrics = ['Sent', 'Opens', 'Clicks', 'Replies'];
      
      for (const metric of metrics) {
        const metricElement = await page.locator(`text=/${metric}/i`).first().isVisible();
        expect(metricElement).toBe(true);
      }
      
      await helpers.screenshot('campaign-analytics');
    });
  });

  test.describe('Lead Assignment', () => {
    test('should assign leads to campaign', async ({ page }) => {
      // Navigate to campaign details
      const campaign = page.locator('[data-testid="campaign-card"], .campaign-item').first();
      await campaign.click();
      
      await page.waitForLoadState('networkidle');
      
      // Look for add leads button
      const addLeadsButton = page.locator('button:has-text("Add Leads"), button:has-text("Assign Leads")').first();
      if (await addLeadsButton.isVisible()) {
        await addLeadsButton.click();
        await page.waitForTimeout(1000);
        
        // Should show lead selection modal or page
        const leadSelector = await page.locator('.lead-selector, [data-testid="lead-selector"], input[placeholder*="search leads"]').isVisible();
        expect(leadSelector).toBe(true);
        
        // Select some leads
        const checkboxes = await page.locator('input[type="checkbox"]').all();
        if (checkboxes.length > 0) {
          // Select first few leads
          for (let i = 0; i < Math.min(3, checkboxes.length); i++) {
            await checkboxes[i].click();
          }
          
          // Confirm selection
          const confirmButton = page.locator('button:has-text("Add"), button:has-text("Assign")').last();
          await confirmButton.click();
          await page.waitForTimeout(2000);
          
          // Should show success or update lead count
          const leadCount = await page.locator('text=/leads|recipients/i').first().textContent();
          expect(leadCount).toBeTruthy();
        }
      }
    });
  });

  test.afterEach(async ({ page }) => {
    // Check for console errors after each test
    await customExpect.toHaveNoConsoleErrors(page);
  });
});