import { test, expect } from '@playwright/test'
import { faker } from '@faker-js/faker'
import { BillingPage } from '../pages/billing.page'
import { AuthPage } from '../pages/auth.page'
import { visualRegressionHelpers } from '../helpers/visual-regression'

test.describe('Billing & Subscription Flow', () => {
  let billingPage: BillingPage
  let authPage: AuthPage

  test.beforeEach(async ({ page }) => {
    billingPage = new BillingPage(page)
    authPage = new AuthPage(page)
    
    // Login as authenticated user
    await authPage.login('test@example.com', 'password123')
  })

  test.describe('Trial to Paid Conversion', () => {
    test('should upgrade from trial to paid plan', async ({ page }) => {
      // Mock trial user state
      await page.route('**/api/billing/subscription', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            plan: 'trial',
            status: 'trialing',
            trialEndsAt: '2024-12-31T23:59:59Z',
            daysRemaining: 14
          })
        })
      })

      await billingPage.goToBilling()
      
      // Verify trial state
      const trialInfo = await billingPage.getTrialInfo()
      expect(trialInfo?.isActive).toBe(true)
      expect(trialInfo?.daysRemaining).toBe(14)
      
      // Take screenshot of trial state
      await visualRegressionHelpers.takeScreenshot(page, 'trial-billing-page')
      
      // Mock upgrade API
      await page.route('**/api/billing/subscription/upgrade', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            subscription: {
              plan: 'professional',
              status: 'active',
              nextBillingDate: '2024-02-01T00:00:00Z'
            }
          })
        })
      })
      
      // Upgrade to professional plan
      await billingPage.upgradeFromTrial('professional')
      await billingPage.expectTrialUpgraded()
      
      // Verify new plan state
      await billingPage.expectPlan({
        name: 'Professional',
        status: 'Active'
      })
      
      // Take screenshot of upgraded state
      await visualRegressionHelpers.takeScreenshot(page, 'trial-upgraded')
    })

    test('should handle payment failure during trial upgrade', async ({ page }) => {
      // Mock payment failure
      await page.route('**/api/billing/subscription/upgrade', async (route) => {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Payment method declined'
          })
        })
      })
      
      await billingPage.goToBilling()
      
      // Try to upgrade
      await billingPage.upgradeTrialButton.click()
      await billingPage.selectPlan('professional')
      await billingPage.confirmUpgradeButton.click()
      
      // Verify error handling
      await billingPage.expectVisible('[data-testid="error-message"]')
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Payment method declined')
    })

    test('should extend trial period', async ({ page }) => {
      // Mock trial extension API
      await page.route('**/api/billing/trial/extend', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            newTrialEndDate: '2024-12-31T23:59:59Z',
            daysAdded: 7
          })
        })
      })
      
      await billingPage.goToBilling()
      await billingPage.extendTrial()
      
      // Verify trial extension
      await billingPage.expectText('[data-testid="success-message"]', 'Trial extended successfully')
    })

    test('should show trial expiration warnings', async ({ page }) => {
      // Mock trial about to expire
      await page.route('**/api/billing/subscription', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            plan: 'trial',
            status: 'trialing',
            trialEndsAt: '2024-01-03T23:59:59Z',
            daysRemaining: 2
          })
        })
      })
      
      await billingPage.goToBilling()
      
      // Verify warning is shown
      await billingPage.expectVisible('[data-testid="trial-expiring-warning"]')
      await expect(page.locator('[data-testid="trial-expiring-warning"]')).toContainText('2 days remaining')
    })
  })

  test.describe('Plan Upgrade/Downgrade', () => {
    test('should upgrade to higher tier plan', async ({ page }) => {
      // Mock current basic plan
      await page.route('**/api/billing/subscription', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            plan: 'basic',
            status: 'active',
            price: '$29/month'
          })
        })
      })
      
      // Mock upgrade API
      await page.route('**/api/billing/subscription/upgrade', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            subscription: {
              plan: 'professional',
              status: 'active',
              price: '$99/month'
            }
          })
        })
      })
      
      await billingPage.goToBilling()
      
      // Verify current plan
      await billingPage.expectPlan({
        name: 'Basic',
        price: '$29/month'
      })
      
      // Upgrade to professional
      await billingPage.upgradePlan('professional')
      await billingPage.expectPlanUpgraded()
      
      // Verify new plan
      await billingPage.expectPlan({
        name: 'Professional',
        price: '$99/month'
      })
    })

    test('should downgrade to lower tier plan', async ({ page }) => {
      // Mock current professional plan
      await page.route('**/api/billing/subscription', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            plan: 'professional',
            status: 'active',
            price: '$99/month'
          })
        })
      })
      
      // Mock downgrade API
      await page.route('**/api/billing/subscription/downgrade', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            subscription: {
              plan: 'basic',
              status: 'active',
              price: '$29/month'
            },
            effectiveDate: '2024-02-01T00:00:00Z'
          })
        })
      })
      
      await billingPage.goToBilling()
      
      // Downgrade to basic
      await billingPage.downgradePlan('basic')
      await billingPage.expectPlanDowngraded()
      
      // Verify downgrade confirmation
      await billingPage.expectText('[data-testid="downgrade-notice"]', 'Downgrade will take effect at the end of your current billing period')
    })

    test('should show plan comparison when upgrading', async ({ page }) => {
      await billingPage.goToBilling()
      await billingPage.upgradePlanButton.click()
      
      // Verify plan comparison is visible
      await billingPage.expectVisible('[data-testid="plan-comparison"]')
      
      // Verify all plans are shown
      const planCards = await billingPage.planCards.count()
      expect(planCards).toBeGreaterThan(1)
      
      // Take screenshot of plan comparison
      await visualRegressionHelpers.takeScreenshot(page, 'plan-comparison')
    })

    test('should handle billing cycle changes', async ({ page }) => {
      // Mock billing cycle change API
      await page.route('**/api/billing/subscription/billing-cycle', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            newCycle: 'yearly',
            savings: 240
          })
        })
      })
      
      await billingPage.goToBilling()
      await billingPage.changeBillingCycle('yearly')
      await billingPage.expectBillingCycleChanged()
      
      // Verify savings message
      await billingPage.expectText('[data-testid="savings-message"]', 'You\'ll save $240 per year')
    })

    test('should calculate prorated charges', async ({ page }) => {
      // Mock proration calculation
      await page.route('**/api/billing/subscription/preview', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            currentCharges: 50.00,
            newCharges: 99.00,
            prorationCredit: -15.50,
            totalDue: 33.50
          })
        })
      })
      
      await billingPage.goToBilling()
      await billingPage.upgradePlanButton.click()
      await billingPage.selectPlan('professional')
      
      // Verify proration display
      await billingPage.expectVisible('[data-testid="proration-details"]')
      await billingPage.expectText('[data-testid="total-due"]', '$33.50')
    })
  })

  test.describe('Payment Method Management', () => {
    test('should add new payment method', async ({ page }) => {
      // Mock Stripe elements
      await page.addInitScript(() => {
        // Mock Stripe for testing
        window.Stripe = () => ({
          elements: () => ({
            create: () => ({
              mount: () => {},
              on: () => {},
              clear: () => {}
            })
          }),
          createToken: () => Promise.resolve({
            token: { id: 'tok_test_123' }
          })
        })
      })
      
      // Mock add payment method API
      await page.route('**/api/billing/payment-methods', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            paymentMethod: {
              id: 'pm_test_123',
              type: 'Visa',
              last4: '4242',
              expiry: '12/25'
            }
          })
        })
      })
      
      await billingPage.goToBilling()
      
      const paymentData = {
        cardNumber: '4242424242424242',
        expiry: '12/25',
        cvc: '123',
        cardholderName: 'John Doe',
        address: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zip: '12345',
        country: 'US'
      }
      
      await billingPage.addPaymentMethod(paymentData)
      await billingPage.expectPaymentMethodAdded()
      
      // Verify payment method appears in list
      const paymentMethods = await billingPage.getPaymentMethods()
      expect(paymentMethods).toContainEqual(
        expect.objectContaining({
          type: 'Visa',
          last4: '4242'
        })
      )
    })

    test('should set default payment method', async ({ page }) => {
      // Mock multiple payment methods
      await page.route('**/api/billing/payment-methods', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'pm_1',
              type: 'Visa',
              last4: '4242',
              expiry: '12/25',
              isDefault: true
            },
            {
              id: 'pm_2',
              type: 'Mastercard',
              last4: '5555',
              expiry: '11/26',
              isDefault: false
            }
          ])
        })
      })
      
      // Mock set default API
      await page.route('**/api/billing/payment-methods/pm_2/default', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        })
      })
      
      await billingPage.goToBilling()
      await billingPage.setDefaultPaymentMethod('pm_2')
      
      // Verify success message
      await billingPage.expectText('[data-testid="success-message"]', 'Default payment method updated')
    })

    test('should delete payment method', async ({ page }) => {
      // Mock delete API
      await page.route('**/api/billing/payment-methods/pm_1', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        })
      })
      
      await billingPage.goToBilling()
      await billingPage.deletePaymentMethod('pm_1')
      await billingPage.expectPaymentMethodDeleted()
    })

    test('should validate payment method information', async ({ page }) => {
      await billingPage.goToBilling()
      await billingPage.addPaymentMethodButton.click()
      
      // Try to save with invalid card number
      const invalidPaymentData = {
        cardNumber: '1234',
        expiry: '01/20',
        cvc: '12',
        cardholderName: '',
        address: '',
        city: '',
        state: '',
        zip: '',
        country: 'US'
      }
      
      await billingPage.addPaymentMethod(invalidPaymentData)
      await billingPage.expectCardValidationError()
    })

    test('should require billing address for certain countries', async ({ page }) => {
      await billingPage.goToBilling()
      await billingPage.addPaymentMethodButton.click()
      
      // Select country that requires full address
      await billingPage.billingCountrySelect.selectOption('FR')
      
      const paymentData = {
        cardNumber: '4242424242424242',
        expiry: '12/25',
        cvc: '123',
        cardholderName: 'John Doe',
        address: '',
        city: '',
        state: '',
        zip: '',
        country: 'FR'
      }
      
      await billingPage.addPaymentMethod(paymentData)
      await billingPage.expectBillingAddressRequired()
    })
  })

  test.describe('Invoice Management', () => {
    test('should display invoice history', async ({ page }) => {
      // Mock invoices
      await page.route('**/api/billing/invoices', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'in_test_123',
              date: '2024-01-01',
              amount: '$99.00',
              status: 'paid',
              downloadUrl: '/invoices/in_test_123.pdf'
            },
            {
              id: 'in_test_124',
              date: '2023-12-01',
              amount: '$99.00',
              status: 'paid',
              downloadUrl: '/invoices/in_test_124.pdf'
            }
          ])
        })
      })
      
      await billingPage.goToBilling()
      
      // Verify invoices are displayed
      const invoices = await billingPage.getInvoices()
      expect(invoices).toHaveLength(2)
      expect(invoices[0]).toMatchObject({
        amount: '$99.00',
        status: 'paid'
      })
      
      // Take screenshot of invoice list
      await visualRegressionHelpers.takeScreenshot(page, 'invoice-history')
    })

    test('should download invoice PDF', async ({ page }) => {
      // Mock download
      const downloadPromise = page.waitForEvent('download')
      
      await page.route('**/api/billing/invoices/in_test_123/download', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/pdf',
          body: Buffer.from('PDF content')
        })
      })
      
      await billingPage.goToBilling()
      await billingPage.downloadInvoice('in_test_123')
      
      const download = await downloadPromise
      expect(download.suggestedFilename()).toContain('invoice')
    })

    test('should handle failed invoice payments', async ({ page }) => {
      // Mock failed invoice
      await page.route('**/api/billing/invoices', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'in_failed_123',
              date: '2024-01-01',
              amount: '$99.00',
              status: 'payment_failed',
              retryUrl: '/billing/retry-payment/in_failed_123'
            }
          ])
        })
      })
      
      await billingPage.goToBilling()
      
      // Verify failed payment is shown
      await billingPage.expectVisible('[data-testid="failed-payment-banner"]')
      await billingPage.expectText('[data-testid="failed-payment-banner"]', 'Payment failed')
      
      // Verify retry button is available
      await billingPage.expectVisible('button[data-testid="retry-payment"]')
    })

    test('should show upcoming invoice preview', async ({ page }) => {
      // Mock upcoming invoice
      await page.route('**/api/billing/invoices/upcoming', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            amount: '$99.00',
            date: '2024-02-01',
            items: [
              { description: 'Professional Plan', amount: '$99.00' }
            ]
          })
        })
      })
      
      await billingPage.goToBilling()
      
      // Verify upcoming invoice is shown
      await billingPage.expectVisible('[data-testid="upcoming-invoice"]')
      await billingPage.expectText('[data-testid="upcoming-invoice-amount"]', '$99.00')
    })
  })

  test.describe('Subscription Cancellation', () => {
    test('should cancel subscription', async ({ page }) => {
      // Mock cancellation API
      await page.route('**/api/billing/subscription/cancel', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            cancelAt: '2024-02-01T00:00:00Z'
          })
        })
      })
      
      await billingPage.goToBilling()
      
      const cancellationReason = 'Found a better alternative'
      await billingPage.cancelSubscription(cancellationReason)
      await billingPage.expectSubscriptionCancelled()
      
      // Verify cancellation details
      await billingPage.expectText('[data-testid="cancellation-notice"]', 'Your subscription will end on February 1, 2024')
    })

    test('should offer retention incentives during cancellation', async ({ page }) => {
      await billingPage.goToBilling()
      await billingPage.cancelSubscriptionButton.click()
      
      // Verify retention offers are shown
      await billingPage.expectVisible('[data-testid="retention-offers"]')
      await billingPage.expectVisible('[data-testid="discount-offer"]')
      await billingPage.expectVisible('[data-testid="feature-reminder"]')
      
      // Take screenshot of retention flow
      await visualRegressionHelpers.takeScreenshot(page, 'retention-offers')
    })

    test('should reactivate cancelled subscription', async ({ page }) => {
      // Mock reactivation API
      await page.route('**/api/billing/subscription/reactivate', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            nextBillingDate: '2024-02-01T00:00:00Z'
          })
        })
      })
      
      // Mock cancelled subscription state
      await page.route('**/api/billing/subscription', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            plan: 'professional',
            status: 'cancelled',
            cancelAt: '2024-02-01T00:00:00Z'
          })
        })
      })
      
      await billingPage.goToBilling()
      await billingPage.reactivateSubscription()
      await billingPage.expectSubscriptionReactivated()
    })

    test('should handle immediate cancellation for trial users', async ({ page }) => {
      // Mock trial cancellation API
      await page.route('**/api/billing/subscription/cancel', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            immediate: true
          })
        })
      })
      
      await billingPage.goToBilling()
      await billingPage.cancelSubscription()
      
      // Verify immediate cancellation
      await billingPage.expectText('[data-testid="cancellation-notice"]', 'Your trial has been cancelled immediately')
    })
  })

  test.describe('Usage Monitoring', () => {
    test('should display current usage statistics', async ({ page }) => {
      // Mock usage data
      await page.route('**/api/billing/usage', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            emailsSent: { current: 1250, limit: 2000 },
            leads: { current: 8500, limit: 10000 },
            storage: { current: 2.5, limit: 5.0 }
          })
        })
      })
      
      await billingPage.goToBilling()
      
      const usage = await billingPage.getUsageStats()
      expect(usage.emailsSent.current).toBe(1250)
      expect(usage.emailsSent.limit).toBe(2000)
      expect(usage.leads.current).toBe(8500)
      expect(usage.leads.limit).toBe(10000)
      
      // Take screenshot of usage display
      await visualRegressionHelpers.takeScreenshot(page, 'usage-statistics')
    })

    test('should show usage warnings when approaching limits', async ({ page }) => {
      // Mock high usage
      await page.route('**/api/billing/usage', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            emailsSent: { current: 1900, limit: 2000 },
            leads: { current: 9800, limit: 10000 },
            storage: { current: 4.8, limit: 5.0 }
          })
        })
      })
      
      await billingPage.goToBilling()
      await billingPage.expectUsageLimitWarning()
      
      // Verify upgrade suggestion
      await billingPage.expectVisible('[data-testid="upgrade-suggestion"]')
    })

    test('should handle usage overage billing', async ({ page }) => {
      // Mock overage charges
      await page.route('**/api/billing/usage', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            emailsSent: { current: 2150, limit: 2000 },
            overageCharges: {
              emails: { amount: 15.00, rate: 0.10 }
            }
          })
        })
      })
      
      await billingPage.goToBilling()
      
      // Verify overage charges are displayed
      await billingPage.expectVisible('[data-testid="overage-charges"]')
      await billingPage.expectText('[data-testid="overage-amount"]', '$15.00')
    })
  })

  test.describe('Promo Codes', () => {
    test('should apply valid promo code', async ({ page }) => {
      // Mock promo code API
      await page.route('**/api/billing/promo-codes/apply', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            discount: {
              amount: 20,
              type: 'percent',
              duration: '3 months'
            }
          })
        })
      })
      
      await billingPage.goToBilling()
      await billingPage.applyPromoCode('SAVE20')
      await billingPage.expectPromoCodeApplied()
      
      // Verify discount is shown
      await billingPage.expectText('[data-testid="active-discount"]', '20% off for 3 months')
    })

    test('should handle invalid promo code', async ({ page }) => {
      // Mock invalid promo code
      await page.route('**/api/billing/promo-codes/apply', async (route) => {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Invalid or expired promo code'
          })
        })
      })
      
      await billingPage.goToBilling()
      await billingPage.applyPromoCode('INVALID123')
      await billingPage.expectPromoCodeError('Invalid or expired promo code')
    })

    test('should show promo code already applied message', async ({ page }) => {
      // Mock already applied error
      await page.route('**/api/billing/promo-codes/apply', async (route) => {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Promo code already applied'
          })
        })
      })
      
      await billingPage.goToBilling()
      await billingPage.applyPromoCode('SAVE20')
      await billingPage.expectPromoCodeError('Promo code already applied')
    })
  })

  test.describe('Customer Portal Integration', () => {
    test('should open Stripe customer portal', async ({ page }) => {
      // Mock portal URL
      await page.route('**/api/billing/portal', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            url: 'https://billing.stripe.com/p/session_test_123'
          })
        })
      })
      
      await billingPage.goToBilling()
      const portalPage = await billingPage.openCustomerPortal()
      
      // Verify portal opens
      expect(portalPage.url()).toContain('billing.stripe.com')
    })

    test('should handle portal access errors', async ({ page }) => {
      // Mock portal error
      await page.route('**/api/billing/portal', async (route) => {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Portal access temporarily unavailable'
          })
        })
      })
      
      await billingPage.goToBilling()
      await billingPage.customerPortalButton.click()
      
      await billingPage.expectVisible('[data-testid="error-message"]')
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Portal access temporarily unavailable')
    })
  })

  test.describe('Visual Regression', () => {
    test('should match visual snapshots for billing pages', async ({ page }) => {
      const billingPages = [
        { url: '/settings/billing', name: 'billing-overview' },
        { url: '/settings/billing/plans', name: 'billing-plans' },
        { url: '/settings/billing/payment-methods', name: 'payment-methods' },
        { url: '/settings/billing/invoices', name: 'billing-invoices' }
      ]
      
      for (const pageInfo of billingPages) {
        await page.goto(pageInfo.url)
        await page.waitForLoadState('networkidle')
        await visualRegressionHelpers.takeScreenshot(page, pageInfo.name)
      }
    })

    test('should test responsive design for billing interface', async ({ page }) => {
      await visualRegressionHelpers.testResponsive(
        page,
        '/settings/billing',
        'billing-responsive'
      )
    })

    test('should test plan comparison modal', async ({ page }) => {
      await billingPage.goToBilling()
      await billingPage.upgradePlanButton.click()
      
      await visualRegressionHelpers.takeScreenshot(page, 'plan-comparison-modal')
    })
  })

  test.describe('Accessibility', () => {
    test('should be keyboard navigable', async ({ page }) => {
      await billingPage.goToBilling()
      
      // Test keyboard navigation through billing sections
      await page.keyboard.press('Tab') // Current plan section
      await page.keyboard.press('Tab') // Upgrade button
      await page.keyboard.press('Tab') // Payment methods section
      await page.keyboard.press('Tab') // Add payment method button
      
      // Verify focus is visible
      const focusedElement = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))
      expect(focusedElement).toBe('add-payment-method')
    })

    test('should have proper ARIA labels for billing components', async ({ page }) => {
      await billingPage.goToBilling()
      
      // Check usage progress bars
      const usageProgress = page.locator('[data-testid="emails-sent-progress"]')
      await expect(usageProgress).toHaveAttribute('role', 'progressbar')
      await expect(usageProgress).toHaveAttribute('aria-label')
      
      // Check plan cards
      const planCard = page.locator('[data-testid="current-plan-card"]')
      await expect(planCard).toHaveAttribute('role', 'region')
    })

    test('should announce billing changes to screen readers', async ({ page }) => {
      await billingPage.goToBilling()
      
      // Mock successful plan upgrade
      await page.route('**/api/billing/subscription/upgrade', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        })
      })
      
      await billingPage.upgradePlan('professional')
      
      // Check for aria-live region
      const successMessage = page.locator('[data-testid="success-message"]')
      await expect(successMessage).toHaveAttribute('aria-live', 'polite')
    })
  })

  test.describe('Performance', () => {
    test('should load billing page quickly', async ({ page }) => {
      const startTime = Date.now()
      await billingPage.goToBilling()
      await page.waitForLoadState('networkidle')
      const loadTime = Date.now() - startTime
      
      expect(loadTime).toBeLessThan(3000)
    })

    test('should handle large invoice history efficiently', async ({ page }) => {
      // Mock large invoice dataset
      const invoices = Array.from({ length: 1000 }, (_, i) => ({
        id: `invoice_${i}`,
        date: `2024-${String(i % 12 + 1).padStart(2, '0')}-01`,
        amount: `$${99 + (i % 50)}.00`,
        status: i % 10 === 0 ? 'payment_failed' : 'paid'
      }))
      
      await page.route('**/api/billing/invoices', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(invoices)
        })
      })
      
      const startTime = Date.now()
      await billingPage.goToBilling()
      await page.waitForSelector('[data-testid="invoice-table"]')
      const loadTime = Date.now() - startTime
      
      expect(loadTime).toBeLessThan(5000)
      
      // Verify pagination is implemented
      const visibleRows = await billingPage.invoiceRows.count()
      expect(visibleRows).toBeLessThanOrEqual(50) // Should not render all 1000 invoices
    })
  })
})