import { test as base, expect } from '@playwright/test'
import { faker } from '@faker-js/faker'

// Define fixtures
export type AuthFixtures = {
  authenticatedPage: any
  testUser: {
    email: string
    password: string
    fullName: string
  }
}

// Extend base test with auth fixtures
export const test = base.extend<AuthFixtures>({
  // Create a test user
  testUser: async ({}, use) => {
    const user = {
      email: faker.internet.email(),
      password: faker.internet.password({ length: 12 }),
      fullName: faker.person.fullName(),
    }
    
    // Use the test user
    await use(user)
    
    // Cleanup would go here if needed
  },

  // Authenticated page fixture
  authenticatedPage: async ({ page, testUser }, use) => {
    // Go to login page
    await page.goto('/login')
    
    // Fill in login form
    await page.fill('input[name="email"]', testUser.email)
    await page.fill('input[name="password"]', testUser.password)
    
    // Submit form
    await page.click('button[type="submit"]')
    
    // Wait for redirect to dashboard
    await page.waitForURL('/dashboard')
    
    // Verify we're authenticated
    await expect(page.locator('text=Dashboard')).toBeVisible()
    
    // Use the authenticated page
    await use(page)
    
    // Sign out after test
    await page.click('button[aria-label="User menu"]')
    await page.click('text=Sign out')
  },
})

export { expect } from '@playwright/test'

// Helper functions for auth tests
export const authHelpers = {
  // Sign up a new user
  async signUp(page: any, user: any) {
    await page.goto('/signup')
    await page.fill('input[name="email"]', user.email)
    await page.fill('input[name="password"]', user.password)
    await page.fill('input[name="fullName"]', user.fullName)
    await page.click('button[type="submit"]')
    await page.waitForURL('/signup/verify-email')
  },

  // Sign in an existing user
  async signIn(page: any, email: string, password: string) {
    await page.goto('/login')
    await page.fill('input[name="email"]', email)
    await page.fill('input[name="password"]', password)
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')
  },

  // Sign out
  async signOut(page: any) {
    await page.click('button[aria-label="User menu"]')
    await page.click('text=Sign out')
    await page.waitForURL('/')
  },

  // Check if user is authenticated
  async isAuthenticated(page: any) {
    try {
      await page.locator('button[aria-label="User menu"]').waitFor({ timeout: 5000 })
      return true
    } catch {
      return false
    }
  },

  // Wait for auth state
  async waitForAuthState(page: any, expectedState: 'authenticated' | 'unauthenticated') {
    if (expectedState === 'authenticated') {
      await page.waitForSelector('button[aria-label="User menu"]')
    } else {
      await page.waitForURL('/(login|signup|/)')
    }
  },
}