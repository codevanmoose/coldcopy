import { Page, Locator, expect } from '@playwright/test'

/**
 * Base Page Object Model with common functionality
 */
export abstract class BasePage {
  protected page: Page

  constructor(page: Page) {
    this.page = page
  }

  // Common elements
  get loadingSpinner(): Locator {
    return this.page.locator('[data-testid="loading-spinner"]')
  }

  get errorMessage(): Locator {
    return this.page.locator('[data-testid="error-message"]')
  }

  get successMessage(): Locator {
    return this.page.locator('[data-testid="success-message"]')
  }

  get toast(): Locator {
    return this.page.locator('[data-testid="toast"]')
  }

  // Navigation helpers
  async goto(path: string): Promise<void> {
    await this.page.goto(path)
    await this.waitForPageLoad()
  }

  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle')
    await this.waitForLoadingSpinnerToDisappear()
  }

  async waitForLoadingSpinnerToDisappear(): Promise<void> {
    try {
      await this.loadingSpinner.waitFor({ state: 'hidden', timeout: 10000 })
    } catch {
      // Spinner might not be present, continue
    }
  }

  // Form helpers
  async fillForm(fields: Record<string, string>): Promise<void> {
    for (const [name, value] of Object.entries(fields)) {
      await this.page.fill(`[name="${name}"]`, value)
    }
  }

  async submitForm(formSelector = 'form'): Promise<void> {
    await this.page.click(`${formSelector} button[type="submit"]`)
  }

  // Wait helpers
  async waitForUrl(url: string | RegExp): Promise<void> {
    await this.page.waitForURL(url)
  }

  async waitForText(text: string): Promise<void> {
    await this.page.locator(`text="${text}"`).waitFor()
  }

  async waitForElement(selector: string): Promise<void> {
    await this.page.locator(selector).waitFor()
  }

  // Validation helpers
  async expectVisible(selector: string): Promise<void> {
    await expect(this.page.locator(selector)).toBeVisible()
  }

  async expectHidden(selector: string): Promise<void> {
    await expect(this.page.locator(selector)).toBeHidden()
  }

  async expectText(selector: string, text: string): Promise<void> {
    await expect(this.page.locator(selector)).toContainText(text)
  }

  async expectUrl(url: string | RegExp): Promise<void> {
    await expect(this.page).toHaveURL(url)
  }

  // Accessibility helpers
  async checkAccessibility(): Promise<void> {
    // Check for basic accessibility violations
    const violations = await this.page.evaluate(() => {
      const issues = []
      
      // Check for images without alt text
      const images = document.querySelectorAll('img:not([alt])')
      if (images.length > 0) {
        issues.push(`${images.length} images without alt text`)
      }

      // Check for buttons without accessible names
      const buttons = document.querySelectorAll('button:not([aria-label]):not([aria-labelledby])')
      const buttonsWithoutText = Array.from(buttons).filter(btn => !btn.textContent?.trim())
      if (buttonsWithoutText.length > 0) {
        issues.push(`${buttonsWithoutText.length} buttons without accessible names`)
      }

      // Check for form inputs without labels
      const inputs = document.querySelectorAll('input:not([aria-label]):not([aria-labelledby])')
      const inputsWithoutLabels = Array.from(inputs).filter(input => {
        const id = input.getAttribute('id')
        return !id || !document.querySelector(`label[for="${id}"]`)
      })
      if (inputsWithoutLabels.length > 0) {
        issues.push(`${inputsWithoutLabels.length} form inputs without labels`)
      }

      return issues
    })

    if (violations.length > 0) {
      console.warn('Accessibility violations found:', violations)
    }
  }

  // Mobile helpers
  async tapElement(selector: string): Promise<void> {
    await this.page.locator(selector).tap()
  }

  async swipe(direction: 'left' | 'right' | 'up' | 'down'): Promise<void> {
    const viewport = this.page.viewportSize()
    if (!viewport) return

    const startX = viewport.width / 2
    const startY = viewport.height / 2
    let endX = startX
    let endY = startY

    switch (direction) {
      case 'left':
        endX = startX - 200
        break
      case 'right':
        endX = startX + 200
        break
      case 'up':
        endY = startY - 200
        break
      case 'down':
        endY = startY + 200
        break
    }

    await this.page.mouse.move(startX, startY)
    await this.page.mouse.down()
    await this.page.mouse.move(endX, endY)
    await this.page.mouse.up()
  }

  // Cookie and local storage helpers
  async clearStorage(): Promise<void> {
    await this.page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
  }

  async setLocalStorageItem(key: string, value: string): Promise<void> {
    await this.page.evaluate(
      ({ key, value }) => localStorage.setItem(key, value),
      { key, value }
    )
  }

  async getLocalStorageItem(key: string): Promise<string | null> {
    return await this.page.evaluate(
      (key) => localStorage.getItem(key),
      key
    )
  }

  // Screenshot helpers
  async takeScreenshot(name: string, options?: {
    fullPage?: boolean
    mask?: string[]
  }): Promise<void> {
    const maskLocators = options?.mask?.map(selector => 
      this.page.locator(selector)
    ) || []

    await expect(this.page).toHaveScreenshot(`${name}.png`, {
      fullPage: options?.fullPage || false,
      mask: maskLocators,
      animations: 'disabled',
    })
  }

  // Network helpers
  async interceptApiCall(
    url: string, 
    response: any,
    statusCode = 200
  ): Promise<void> {
    await this.page.route(url, async (route) => {
      await route.fulfill({
        status: statusCode,
        contentType: 'application/json',
        body: JSON.stringify(response),
      })
    })
  }

  async waitForApiCall(url: string): Promise<void> {
    await this.page.waitForResponse(url)
  }

  // Drag and drop helpers
  async dragAndDrop(
    sourceSelector: string,
    targetSelector: string
  ): Promise<void> {
    await this.page.locator(sourceSelector).dragTo(
      this.page.locator(targetSelector)
    )
  }

  // File upload helpers
  async uploadFile(
    inputSelector: string,
    filePath: string
  ): Promise<void> {
    await this.page.setInputFiles(inputSelector, filePath)
  }

  // Keyboard helpers
  async pressKey(key: string): Promise<void> {
    await this.page.keyboard.press(key)
  }

  async typeText(text: string, delay = 50): Promise<void> {
    await this.page.keyboard.type(text, { delay })
  }

  // Browser context helpers
  async openNewTab(): Promise<Page> {
    const newPage = await this.page.context().newPage()
    return newPage
  }

  async switchToTab(index: number): Promise<Page> {
    const pages = this.page.context().pages()
    return pages[index]
  }

  // Debugging helpers
  async debug(): Promise<void> {
    await this.page.pause()
  }

  async logConsoleMessages(): Promise<void> {
    this.page.on('console', (msg) => {
      console.log(`Console ${msg.type()}: ${msg.text()}`)
    })
  }

  async logNetworkErrors(): Promise<void> {
    this.page.on('response', (response) => {
      if (response.status() >= 400) {
        console.log(`Network error: ${response.status()} ${response.url()}`)
      }
    })
  }
}