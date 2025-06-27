import { test, expect } from '@playwright/test'

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('has title', async ({ page }) => {
    await expect(page).toHaveTitle(/ColdCopy/)
  })

  test('has hero section', async ({ page }) => {
    const hero = page.locator('section').first()
    await expect(hero).toBeVisible()
    
    // Check for main heading
    const heading = hero.locator('h1')
    await expect(heading).toBeVisible()
    await expect(heading).toContainText(/cold email|outreach|email automation/i)
  })

  test('has navigation links', async ({ page }) => {
    const nav = page.locator('nav')
    
    // Check for login link
    const loginLink = nav.locator('a[href="/login"]')
    await expect(loginLink).toBeVisible()
    
    // Check for signup link
    const signupLink = nav.locator('a[href="/signup"]')
    await expect(signupLink).toBeVisible()
    
    // Check for pricing link
    const pricingLink = nav.locator('a[href="/pricing"]')
    await expect(pricingLink).toBeVisible()
  })

  test('navigation works', async ({ page }) => {
    // Click on pricing
    await page.click('a[href="/pricing"]')
    await expect(page).toHaveURL('/pricing')
    
    // Go back to home
    await page.click('a[href="/"]')
    await expect(page).toHaveURL('/')
    
    // Click on login
    await page.click('a[href="/login"]')
    await expect(page).toHaveURL('/login')
  })

  test('responsive menu works on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    
    // Mobile menu button should be visible
    const menuButton = page.locator('button[aria-label="Toggle menu"]')
    await expect(menuButton).toBeVisible()
    
    // Desktop nav should be hidden
    const desktopNav = page.locator('nav.hidden.md\\:flex')
    await expect(desktopNav).not.toBeVisible()
    
    // Click menu button
    await menuButton.click()
    
    // Mobile menu should appear
    const mobileMenu = page.locator('[role="dialog"]')
    await expect(mobileMenu).toBeVisible()
  })

  test('footer has required links', async ({ page }) => {
    const footer = page.locator('footer')
    
    // Legal links
    await expect(footer.locator('a[href="/privacy-policy"]')).toBeVisible()
    await expect(footer.locator('a[href="/terms-of-service"]')).toBeVisible()
    
    // Check copyright notice
    await expect(footer).toContainText(/© \d{4} ColdCopy/i)
  })
})