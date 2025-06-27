import { test, expect } from '@playwright/test'
import { faker } from '@faker-js/faker'
import { GDPRPage } from '../pages/gdpr.page'
import { AuthPage } from '../pages/auth.page'
import { visualRegressionHelpers } from '../helpers/visual-regression'

test.describe('GDPR Compliance Journey', () => {
  let gdprPage: GDPRPage
  let authPage: AuthPage

  test.beforeEach(async ({ page }) => {
    gdprPage = new GDPRPage(page)
    authPage = new AuthPage(page)
  })

  test.describe('Cookie Consent Management', () => {
    test('should show cookie banner on first visit', async ({ page }) => {
      await gdprPage.clearCookieConsent()
      await page.goto('/')
      
      await gdprPage.expectCookieConsentRequired()
      
      // Take screenshot of cookie banner
      await visualRegressionHelpers.takeScreenshot(page, 'cookie-banner')
      
      // Check accessibility
      await gdprPage.checkAccessibility()
    })

    test('should allow accepting all cookies', async ({ page }) => {
      await gdprPage.clearCookieConsent()
      await page.goto('/')
      
      await gdprPage.acceptAllCookies()
      await gdprPage.expectCookieConsentSaved()
      
      // Verify consent is stored
      const consent = await gdprPage.getCookieConsent()
      expect(consent.essential).toBe(true)
      expect(consent.analytics).toBe(true)
      expect(consent.marketing).toBe(true)
      
      // Verify banner is hidden
      await gdprPage.expectHidden('[data-testid="cookie-banner"]')
    })

    test('should allow rejecting non-essential cookies', async ({ page }) => {
      await gdprPage.clearCookieConsent()
      await page.goto('/')
      
      await gdprPage.rejectAllCookies()
      await gdprPage.expectCookieConsentSaved()
      
      // Verify only essential cookies are accepted
      const consent = await gdprPage.getCookieConsent()
      expect(consent.essential).toBe(true)
      expect(consent.analytics).toBe(false)
      expect(consent.marketing).toBe(false)
    })

    test('should allow customizing cookie preferences', async ({ page }) => {
      await gdprPage.clearCookieConsent()
      await page.goto('/')
      
      const preferences = {
        essential: true, // Always true
        analytics: true,
        marketing: false
      }
      
      await gdprPage.customizeCookieConsent(preferences)
      await gdprPage.expectCookieConsentSaved()
      
      // Verify custom preferences are saved
      const consent = await gdprPage.getCookieConsent()
      expect(consent.analytics).toBe(true)
      expect(consent.marketing).toBe(false)
      
      // Take screenshot of custom preferences
      await visualRegressionHelpers.takeScreenshot(page, 'cookie-preferences-custom')
    })

    test('should remember cookie preferences across sessions', async ({ page, context }) => {
      await gdprPage.clearCookieConsent()
      await page.goto('/')
      
      await gdprPage.acceptAllCookies()
      
      // Open new tab in same context
      const newPage = await context.newPage()
      await newPage.goto('/')
      
      // Cookie banner should not appear
      const newGdprPage = new GDPRPage(newPage)
      await newGdprPage.expectHidden('[data-testid="cookie-banner"]')
    })

    test('should handle cookie preferences update', async ({ page }) => {
      // Set initial preferences
      await gdprPage.setCookieConsent({
        essential: true,
        analytics: false,
        marketing: false
      })
      
      await gdprPage.goToPrivacySettings()
      
      // Update preferences
      await gdprPage.customizeCookieConsent({
        essential: true,
        analytics: true,
        marketing: true
      })
      
      await gdprPage.expectCookieConsentSaved()
      
      // Verify updated preferences
      const consent = await gdprPage.getCookieConsent()
      expect(consent.analytics).toBe(true)
      expect(consent.marketing).toBe(true)
    })

    test('should work properly on mobile devices', async ({ page, isMobile }) => {
      test.skip(!isMobile, 'Mobile-specific test')
      
      await gdprPage.clearCookieConsent()
      await page.goto('/')
      
      await gdprPage.expectCookieConsentRequired()
      
      // Take mobile screenshot
      await visualRegressionHelpers.takeScreenshot(page, 'cookie-banner-mobile')
      
      // Test mobile interaction
      await gdprPage.tapElement('button[data-testid="accept-all-cookies"]')
      await gdprPage.expectCookieConsentSaved()
    })
  })

  test.describe('Data Export Request', () => {
    test('should submit data export request', async ({ page }) => {
      await authPage.login('test@example.com', 'password123')
      
      // Mock export API
      await page.route('**/api/gdpr/export', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            requestId: 'export_123',
            estimatedCompletionTime: '24 hours'
          })
        })
      })
      
      const exportOptions = {
        dataTypes: ['profile', 'campaigns', 'leads'],
        format: 'json',
        reason: 'Personal data portability under GDPR Article 20'
      }
      
      await gdprPage.requestDataExport(exportOptions)
      await gdprPage.expectDataExportRequested()
      
      // Verify request status
      const status = await gdprPage.getExportRequestStatus()
      expect(status).toContain('Processing')
      
      // Take screenshot of export request
      await visualRegressionHelpers.takeScreenshot(page, 'data-export-requested')
    })

    test('should handle export completion and download', async ({ page }) => {
      await authPage.login('test@example.com', 'password123')
      
      // Mock export ready status
      await page.route('**/api/gdpr/export/status', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'completed',
            downloadUrl: '/exports/user_data_123.json',
            expiresAt: '2024-12-31T23:59:59Z'
          })
        })
      })
      
      // Mock download
      const downloadPromise = page.waitForEvent('download')
      await page.route('**/exports/user_data_123.json', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: { id: 1, email: 'test@example.com' },
            campaigns: [],
            leads: []
          })
        })
      })
      
      await gdprPage.goToDataProcessing()
      await gdprPage.expectExportReady()
      
      await gdprPage.downloadDataExport()
      const download = await downloadPromise
      expect(download.suggestedFilename()).toContain('user_data')
    })

    test('should validate export request form', async ({ page }) => {
      await authPage.login('test@example.com', 'password123')
      await gdprPage.goToDataProcessing()
      
      await gdprPage.requestDataExportButton.click()
      
      // Try to submit without selecting data types
      await gdprPage.submitExportRequestButton.click()
      await gdprPage.expectExportRequestValidationError()
      
      // Verify error message
      await gdprPage.expectText('[data-testid="export-validation-error"]', 'Please select at least one data type')
    })

    test('should handle different export formats', async ({ page }) => {
      await authPage.login('test@example.com', 'password123')
      
      const formats = ['json', 'csv', 'xml']
      
      for (const format of formats) {
        // Mock API for each format
        await page.route('**/api/gdpr/export', async (route) => {
          const requestBody = await route.request().postDataJSON()
          expect(requestBody.format).toBe(format)
          
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              requestId: `export_${format}_123`,
              format: format
            })
          })
        })
        
        await gdprPage.requestDataExport({
          dataTypes: ['profile'],
          format: format,
          reason: `Testing ${format} export`
        })
        
        await gdprPage.expectDataExportRequested()
      }
    })

    test('should show export progress and estimated completion time', async ({ page }) => {
      await authPage.login('test@example.com', 'password123')
      
      // Mock progress updates
      let progress = 0
      await page.route('**/api/gdpr/export/status', async (route) => {
        progress += 25
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: progress >= 100 ? 'completed' : 'processing',
            progress: Math.min(progress, 100),
            estimatedTimeRemaining: Math.max(0, 60 - progress)
          })
        })
      })
      
      await gdprPage.requestDataExport({
        dataTypes: ['profile', 'campaigns'],
        format: 'json',
        reason: 'Data portability request'
      })
      
      // Check progress display
      await gdprPage.expectVisible('[data-testid="export-progress"]')
      await gdprPage.expectText('[data-testid="estimated-time"]', 'minutes remaining')
    })
  })

  test.describe('Consent Withdrawal', () => {
    test('should withdraw marketing consent', async ({ page }) => {
      await authPage.login('test@example.com', 'password123')
      
      // Mock consent withdrawal API
      await page.route('**/api/gdpr/consent/withdraw', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            consentType: 'marketing',
            withdrawnAt: '2024-01-01T12:00:00Z'
          })
        })
      })
      
      await gdprPage.withdrawConsent('marketing', 'no_longer_interested')
      await gdprPage.expectConsentWithdrawn()
      
      // Verify consent status updated
      const consents = await gdprPage.getPrivacyConsents()
      expect(consents.marketing).toBe(false)
    })

    test('should withdraw analytics consent', async ({ page }) => {
      await authPage.login('test@example.com', 'password123')
      
      await page.route('**/api/gdpr/consent/withdraw', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            consentType: 'analytics'
          })
        })
      })
      
      await gdprPage.withdrawConsent('analytics', 'privacy_concerns')
      await gdprPage.expectConsentWithdrawn()
      
      // Verify analytics tracking is disabled
      const consents = await gdprPage.getPrivacyConsents()
      expect(consents.analytics).toBe(false)
    })

    test('should require reason for consent withdrawal', async ({ page }) => {
      await authPage.login('test@example.com', 'password123')
      await gdprPage.goToPrivacySettings()
      
      await gdprPage.page.click('button[data-testid="withdraw-consent-marketing"]')
      await gdprPage.confirmWithdrawalButton.click()
      
      await gdprPage.expectWithdrawalReasonRequired()
    })

    test('should handle multiple consent withdrawals', async ({ page }) => {
      await authPage.login('test@example.com', 'password123')
      
      const consentTypes = ['marketing', 'analytics']
      
      for (const consentType of consentTypes) {
        await page.route(`**/api/gdpr/consent/withdraw`, async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              consentType: consentType
            })
          })
        })
        
        await gdprPage.withdrawConsent(consentType, 'privacy_concerns')
        await gdprPage.expectConsentWithdrawn()
      }
      
      // Verify all consents withdrawn
      const consents = await gdprPage.getPrivacyConsents()
      expect(consents.marketing).toBe(false)
      expect(consents.analytics).toBe(false)
    })
  })

  test.describe('Data Deletion Request', () => {
    test('should submit data deletion request', async ({ page }) => {
      await authPage.login('test@example.com', 'password123')
      
      // Mock deletion API
      await page.route('**/api/gdpr/delete', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            requestId: 'delete_123',
            scheduledDeletionDate: '2024-12-31T23:59:59Z'
          })
        })
      })
      
      const deletionOptions = {
        dataTypes: ['profile', 'campaigns', 'analytics'],
        reason: 'Account closure under GDPR Article 17'
      }
      
      await gdprPage.requestDataDeletion(deletionOptions)
      await gdprPage.expectDataDeletionRequested()
      
      // Verify deletion is scheduled
      const status = await gdprPage.getDeletionRequestStatus()
      expect(status).toContain('Scheduled')
      
      // Take screenshot of deletion request
      await visualRegressionHelpers.takeScreenshot(page, 'data-deletion-requested')
    })

    test('should require confirmation for data deletion', async ({ page }) => {
      await authPage.login('test@example.com', 'password123')
      await gdprPage.goToDataProcessing()
      
      await gdprPage.requestDataDeletionButton.click()
      
      // Try to submit without confirmation
      await gdprPage.page.check('input[name="deletionDataTypes"][value="profile"]')
      await gdprPage.deletionReasonTextarea.fill('Test deletion')
      await gdprPage.submitDeletionRequestButton.click()
      
      await gdprPage.expectDeletionConfirmationRequired()
    })

    test('should handle partial data deletion', async ({ page }) => {
      await authPage.login('test@example.com', 'password123')
      
      await page.route('**/api/gdpr/delete', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            requestId: 'delete_partial_123',
            retainedData: ['billing_records'],
            reason: 'Legal retention requirements'
          })
        })
      })
      
      await gdprPage.requestDataDeletion({
        dataTypes: ['profile', 'campaigns', 'billing'],
        reason: 'Partial data deletion'
      })
      
      await gdprPage.expectDataDeletionRequested()
      
      // Verify retention notice
      await gdprPage.expectText('[data-testid="retention-notice"]', 'Some data will be retained for legal compliance')
    })

    test('should show deletion grace period', async ({ page }) => {
      await authPage.login('test@example.com', 'password123')
      
      await page.route('**/api/gdpr/delete', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            requestId: 'delete_grace_123',
            gracePeriodDays: 30,
            cancellationDeadline: '2024-01-31T23:59:59Z'
          })
        })
      })
      
      await gdprPage.requestDataDeletion({
        dataTypes: ['profile'],
        reason: 'Account deletion with grace period'
      })
      
      // Verify grace period information
      await gdprPage.expectText('[data-testid="grace-period-notice"]', '30 days to cancel this request')
      await gdprPage.expectVisible('button[data-testid="cancel-deletion-request"]')
    })
  })

  test.describe('Unsubscribe Flow', () => {
    test('should unsubscribe from all emails with token', async ({ page }) => {
      const unsubscribeToken = 'token_123'
      
      // Mock unsubscribe API
      await page.route('**/api/unsubscribe', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            email: 'test@example.com',
            unsubscribedFrom: 'all'
          })
        })
      })
      
      await gdprPage.goToUnsubscribe(unsubscribeToken)
      
      await gdprPage.unsubscribeFromEmails({
        reason: 'too_many_emails',
        unsubscribeAll: true
      })
      
      await gdprPage.expectUnsubscribeSuccess()
      
      // Take screenshot of unsubscribe confirmation
      await visualRegressionHelpers.takeScreenshot(page, 'unsubscribe-success')
    })

    test('should allow selective unsubscribe', async ({ page }) => {
      const unsubscribeToken = 'token_123'
      
      await page.route('**/api/unsubscribe', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            email: 'test@example.com',
            unsubscribedFrom: ['marketing', 'newsletters']
          })
        })
      })
      
      await gdprPage.goToUnsubscribe(unsubscribeToken)
      
      await gdprPage.unsubscribeFromEmails({
        reason: 'not_relevant',
        types: ['marketing', 'newsletters']
      })
      
      await gdprPage.expectUnsubscribeSuccess()
      
      // Verify selective unsubscribe message
      await gdprPage.expectText('[data-testid="unsubscribe-details"]', 'marketing, newsletters')
    })

    test('should allow resubscribe', async ({ page }) => {
      const unsubscribeToken = 'token_123'
      
      // Mock resubscribe API
      await page.route('**/api/unsubscribe/resubscribe', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            email: 'test@example.com'
          })
        })
      })
      
      await gdprPage.goToUnsubscribe(unsubscribeToken)
      
      // First unsubscribe
      await gdprPage.unsubscribeFromEmails({
        reason: 'mistake',
        unsubscribeAll: true
      })
      
      // Then resubscribe
      await gdprPage.resubscribeToEmails()
      await gdprPage.expectResubscribeSuccess()
    })

    test('should require unsubscribe reason', async ({ page }) => {
      const unsubscribeToken = 'token_123'
      await gdprPage.goToUnsubscribe(unsubscribeToken)
      
      // Try to unsubscribe without reason
      await gdprPage.unsubscribeAllButton.click()
      await gdprPage.expectUnsubscribeReasonRequired()
    })

    test('should handle invalid unsubscribe token', async ({ page }) => {
      // Mock invalid token
      await page.route('**/api/unsubscribe', async (route) => {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Invalid or expired unsubscribe token'
          })
        })
      })
      
      await gdprPage.goToUnsubscribe('invalid_token')
      
      await gdprPage.unsubscribeFromEmails({
        reason: 'too_many_emails',
        unsubscribeAll: true
      })
      
      await gdprPage.expectVisible('[data-testid="error-message"]')
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid or expired')
    })

    test('should work without authentication', async ({ page }) => {
      // Test unsubscribe flow for non-authenticated users
      const unsubscribeToken = 'token_123'
      
      await page.route('**/api/unsubscribe', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            email: 'anonymous@example.com'
          })
        })
      })
      
      await gdprPage.goToUnsubscribe(unsubscribeToken)
      
      // Should not require login
      await gdprPage.expectVisible('[data-testid="unsubscribe-page"]')
      await gdprPage.expectHidden('[data-testid="login-required"]')
      
      await gdprPage.unsubscribeFromEmails({
        reason: 'too_many_emails',
        unsubscribeAll: true
      })
      
      await gdprPage.expectUnsubscribeSuccess()
    })
  })

  test.describe('GDPR Admin Management', () => {
    test('should display GDPR requests for admin review', async ({ page }) => {
      await authPage.login('admin@example.com', 'password123')
      
      // Mock GDPR requests
      await page.route('**/api/admin/gdpr/requests', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'req_123',
              type: 'data_export',
              status: 'pending',
              requestedAt: '2024-01-01T10:00:00Z',
              userEmail: 'user1@example.com'
            },
            {
              id: 'req_124',
              type: 'data_deletion',
              status: 'pending',
              requestedAt: '2024-01-01T11:00:00Z',
              userEmail: 'user2@example.com'
            }
          ])
        })
      })
      
      await gdprPage.goToGDPRAdmin()
      
      const requests = await gdprPage.getGDPRRequests()
      expect(requests).toHaveLength(2)
      expect(requests[0].type).toBe('data_export')
      expect(requests[1].type).toBe('data_deletion')
      
      // Take screenshot of admin interface
      await visualRegressionHelpers.takeScreenshot(page, 'gdpr-admin-dashboard')
    })

    test('should approve GDPR requests', async ({ page }) => {
      await authPage.login('admin@example.com', 'password123')
      
      // Mock approval API
      await page.route('**/api/admin/gdpr/requests/req_123/approve', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            processedAt: '2024-01-01T12:00:00Z'
          })
        })
      })
      
      await gdprPage.processGDPRRequest('req_123', 'approve', 'Request approved after verification')
      await gdprPage.expectGDPRRequestProcessed()
    })

    test('should reject GDPR requests with reason', async ({ page }) => {
      await authPage.login('admin@example.com', 'password123')
      
      // Mock rejection API
      await page.route('**/api/admin/gdpr/requests/req_124/reject', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            rejectedAt: '2024-01-01T12:00:00Z'
          })
        })
      })
      
      await gdprPage.processGDPRRequest('req_124', 'reject', 'Insufficient verification provided')
      await gdprPage.expectGDPRRequestProcessed()
    })

    test('should configure data retention policies', async ({ page }) => {
      await authPage.login('admin@example.com', 'password123')
      
      // Mock retention settings API
      await page.route('**/api/admin/gdpr/retention', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            retentionPeriod: '7_years',
            autoDeleteEnabled: true
          })
        })
      })
      
      await gdprPage.configureDataRetention({
        period: '7_years',
        autoDelete: true
      })
      
      await gdprPage.expectDataRetentionUpdated()
    })
  })

  test.describe('Visual Regression', () => {
    test('should match visual snapshots for GDPR pages', async ({ page }) => {
      const gdprPages = [
        { url: '/', action: () => gdprPage.clearCookieConsent(), name: 'cookie-banner' },
        { url: '/settings/privacy', action: () => authPage.login('test@example.com', 'password123'), name: 'privacy-settings' },
        { url: '/settings/data-processing', action: () => {}, name: 'data-processing' },
        { url: '/unsubscribe?token=test', action: () => {}, name: 'unsubscribe-page' }
      ]
      
      for (const pageInfo of gdprPages) {
        await pageInfo.action()
        await page.goto(pageInfo.url)
        await page.waitForLoadState('networkidle')
        await visualRegressionHelpers.takeScreenshot(page, pageInfo.name)
      }
    })

    test('should test responsive design for GDPR components', async ({ page }) => {
      await gdprPage.clearCookieConsent()
      await visualRegressionHelpers.testResponsive(
        page,
        '/',
        'gdpr-responsive'
      )
    })
  })

  test.describe('Accessibility', () => {
    test('should be keyboard navigable', async ({ page }) => {
      await gdprPage.clearCookieConsent()
      await page.goto('/')
      
      // Test keyboard navigation through cookie banner
      await page.keyboard.press('Tab') // Accept all button
      await page.keyboard.press('Tab') // Reject all button  
      await page.keyboard.press('Tab') // Customize button
      await page.keyboard.press('Enter') // Open preferences
      
      await gdprPage.expectVisible('[data-testid="cookie-preferences-dialog"]')
    })

    test('should have proper ARIA labels for GDPR components', async ({ page }) => {
      await gdprPage.clearCookieConsent()
      await page.goto('/')
      
      // Check cookie banner accessibility
      const cookieBanner = page.locator('[data-testid="cookie-banner"]')
      await expect(cookieBanner).toHaveAttribute('role', 'banner')
      await expect(cookieBanner).toHaveAttribute('aria-label', 'Cookie consent')
      
      // Check toggle switches
      const analyticsToggle = page.locator('[data-testid="analytics-cookies-toggle"]')
      await expect(analyticsToggle).toHaveAttribute('role', 'switch')
    })

    test('should announce consent changes to screen readers', async ({ page }) => {
      await gdprPage.clearCookieConsent()
      await page.goto('/')
      
      await gdprPage.acceptAllCookies()
      
      // Check for aria-live announcement
      const announcement = page.locator('[data-testid="consent-announcement"]')
      await expect(announcement).toHaveAttribute('aria-live', 'polite')
      await expect(announcement).toContainText('Cookie preferences saved')
    })
  })

  test.describe('Performance', () => {
    test('should load GDPR components quickly', async ({ page }) => {
      await gdprPage.clearCookieConsent()
      
      const startTime = Date.now()
      await page.goto('/')
      await gdprPage.expectVisible('[data-testid="cookie-banner"]')
      const loadTime = Date.now() - startTime
      
      expect(loadTime).toBeLessThan(2000)
    })

    test('should handle large data exports efficiently', async ({ page }) => {
      await authPage.login('test@example.com', 'password123')
      
      // Mock large data export
      await page.route('**/api/gdpr/export', async (route) => {
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 100))
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            requestId: 'large_export_123',
            estimatedSize: '500MB'
          })
        })
      })
      
      const startTime = Date.now()
      await gdprPage.requestDataExport({
        dataTypes: ['profile', 'campaigns', 'leads', 'analytics'],
        format: 'json',
        reason: 'Large data export test'
      })
      const requestTime = Date.now() - startTime
      
      expect(requestTime).toBeLessThan(5000)
      await gdprPage.expectDataExportRequested()
    })
  })
})