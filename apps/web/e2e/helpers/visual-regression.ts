import { Page, expect } from '@playwright/test'

export interface ScreenshotOptions {
  fullPage?: boolean
  clip?: { x: number; y: number; width: number; height: number }
  mask?: string[]
  animations?: 'disabled' | 'allow'
  caret?: 'hide' | 'initial'
}

// Visual regression testing helpers
export const visualRegressionHelpers = {
  // Take a screenshot with default options
  async takeScreenshot(
    page: Page, 
    name: string, 
    options: ScreenshotOptions = {}
  ) {
    const defaultOptions: ScreenshotOptions = {
      fullPage: false,
      animations: 'disabled',
      caret: 'hide',
      ...options,
    }

    // Wait for animations to complete
    if (defaultOptions.animations === 'disabled') {
      await page.addStyleTag({
        content: `
          *, *::before, *::after {
            animation-duration: 0s !important;
            animation-delay: 0s !important;
            transition-duration: 0s !important;
            transition-delay: 0s !important;
          }
        `,
      })
    }

    // Hide dynamic content by default
    const dynamicSelectors = [
      '[data-testid="timestamp"]',
      '[data-testid="user-avatar"]',
      '.date-display',
      '.time-display',
      ...(options.mask || []),
    ]

    // Take screenshot
    await expect(page).toHaveScreenshot(name, {
      fullPage: defaultOptions.fullPage,
      clip: defaultOptions.clip,
      mask: dynamicSelectors.map(selector => page.locator(selector)),
      animations: defaultOptions.animations,
      caret: defaultOptions.caret,
    })
  },

  // Compare component screenshots
  async compareComponent(
    page: Page,
    componentSelector: string,
    name: string,
    options: ScreenshotOptions = {}
  ) {
    const component = page.locator(componentSelector)
    await component.waitFor({ state: 'visible' })
    
    // Get component bounding box
    const box = await component.boundingBox()
    if (!box) throw new Error(`Component ${componentSelector} not found`)

    await this.takeScreenshot(page, name, {
      ...options,
      clip: {
        x: box.x - 10, // Add some padding
        y: box.y - 10,
        width: box.width + 20,
        height: box.height + 20,
      },
    })
  },

  // Test responsive designs
  async testResponsive(
    page: Page,
    url: string,
    name: string,
    viewports = [
      { width: 375, height: 667, name: 'mobile' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 1440, height: 900, name: 'desktop' },
    ]
  ) {
    for (const viewport of viewports) {
      await page.setViewportSize({ 
        width: viewport.width, 
        height: viewport.height 
      })
      await page.goto(url)
      await page.waitForLoadState('networkidle')
      
      await this.takeScreenshot(
        page, 
        `${name}-${viewport.name}`, 
        { fullPage: true }
      )
    }
  },

  // Test dark mode
  async testDarkMode(page: Page, name: string) {
    // Light mode screenshot
    await page.emulateMedia({ colorScheme: 'light' })
    await this.takeScreenshot(page, `${name}-light`, { fullPage: true })

    // Dark mode screenshot
    await page.emulateMedia({ colorScheme: 'dark' })
    await this.takeScreenshot(page, `${name}-dark`, { fullPage: true })
  },

  // Test hover states
  async testHoverStates(
    page: Page,
    elements: { selector: string; name: string }[]
  ) {
    for (const element of elements) {
      const el = page.locator(element.selector)
      await el.waitFor({ state: 'visible' })
      
      // Normal state
      await this.compareComponent(page, element.selector, `${element.name}-normal`)
      
      // Hover state
      await el.hover()
      await page.waitForTimeout(100) // Wait for hover effects
      await this.compareComponent(page, element.selector, `${element.name}-hover`)
    }
  },

  // Test form states
  async testFormStates(page: Page, formSelector: string, name: string) {
    const form = page.locator(formSelector)
    
    // Empty state
    await this.compareComponent(page, formSelector, `${name}-empty`)
    
    // Filled state
    const inputs = await form.locator('input, textarea, select').all()
    for (const input of inputs) {
      const type = await input.getAttribute('type')
      const tagName = await input.evaluate(el => el.tagName.toLowerCase())
      
      if (type === 'checkbox' || type === 'radio') {
        await input.check()
      } else if (tagName === 'select') {
        await input.selectOption({ index: 1 })
      } else {
        await input.fill('Test value')
      }
    }
    await this.compareComponent(page, formSelector, `${name}-filled`)
    
    // Error state (if form has validation)
    await form.locator('button[type="submit"]').click()
    await page.waitForTimeout(500) // Wait for validation
    await this.compareComponent(page, formSelector, `${name}-error`)
  },

  // Test loading states
  async testLoadingStates(
    page: Page,
    triggerSelector: string,
    containerSelector: string,
    name: string
  ) {
    // Intercept API calls to delay them
    await page.route('**/api/**', async (route) => {
      await page.waitForTimeout(2000) // Delay API calls
      await route.continue()
    })

    // Trigger loading state
    await page.click(triggerSelector)
    
    // Capture loading state immediately
    await this.compareComponent(page, containerSelector, `${name}-loading`)
    
    // Wait for loaded state
    await page.waitForLoadState('networkidle')
    await this.compareComponent(page, containerSelector, `${name}-loaded`)
  },

  // Test animation sequences
  async testAnimationSequence(
    page: Page,
    triggerSelector: string,
    containerSelector: string,
    name: string,
    steps = 5
  ) {
    const container = page.locator(containerSelector)
    
    // Trigger animation
    await page.click(triggerSelector)
    
    // Capture animation frames
    for (let i = 0; i < steps; i++) {
      await page.waitForTimeout(100 * i) // Adjust timing as needed
      await this.compareComponent(
        page, 
        containerSelector, 
        `${name}-step-${i}`,
        { animations: 'allow' }
      )
    }
  },
}