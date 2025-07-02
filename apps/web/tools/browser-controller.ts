import { chromium, Browser, Page, BrowserContext } from 'playwright';
import fs from 'fs/promises';
import path from 'path';

interface DashboardCredentials {
  email?: string;
  username?: string;
  password?: string;
  otpSecret?: string;
}

export class BrowserController {
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private screenshots: string[] = [];
  
  async initialize(options: { headless?: boolean; record?: boolean } = {}) {
    const userDataDir = path.join(process.cwd(), '.browser-data');
    await fs.mkdir(userDataDir, { recursive: true });
    
    this.context = await chromium.launchPersistentContext(userDataDir, {
      headless: options.headless ?? true,
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      recordVideo: options.record ? { dir: './videos' } : undefined,
      ignoreHTTPSErrors: true,
    });
    
    this.page = this.context.pages()[0] || await this.context.newPage();
    
    // Enhanced debugging
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('Browser console error:', msg.text());
      }
    });
    
    this.page.on('pageerror', error => {
      console.error('Page error:', error.message);
    });
  }
  
  async testColdCopyProduction() {
    if (!this.page) throw new Error('Browser not initialized');
    
    console.log('🧪 Testing ColdCopy Production...');
    
    // Navigate to production site
    await this.page.goto('https://www.coldcopy.cc', { waitUntil: 'networkidle' });
    await this.captureScreenshot('coldcopy-landing');
    
    // Extract page state
    const pageState = await this.extractPageState();
    
    // Check for AI dashboard
    await this.page.goto('https://www.coldcopy.cc/ai-dashboard', { waitUntil: 'networkidle' });
    await this.captureScreenshot('coldcopy-ai-dashboard');
    
    const aiDashboardState = await this.extractPageState();
    
    return {
      landing: {
        url: pageState.url,
        title: pageState.title,
        hasErrors: pageState.hasErrors,
        screenshot: this.screenshots[0]
      },
      aiDashboard: {
        url: aiDashboardState.url,
        title: aiDashboardState.title,
        hasErrors: aiDashboardState.hasErrors,
        screenshot: this.screenshots[1]
      },
      errors: await this.extractErrors()
    };
  }
  
  async navigateToVercelDashboard(projectId?: string) {
    if (!this.page) throw new Error('Browser not initialized');
    
    const url = projectId 
      ? `https://vercel.com/vanmooseprojects/coldcopy/settings/environment-variables`
      : 'https://vercel.com/dashboard';
    
    console.log(`Navigating to Vercel...`);
    await this.page.goto(url, { waitUntil: 'networkidle' });
    
    const screenshot = await this.captureScreenshot('vercel-dashboard');
    const pageState = await this.extractPageState();
    
    return {
      url: this.page.url(),
      title: await this.page.title(),
      screenshot,
      state: pageState,
      isLoggedIn: await this.checkVercelLoginStatus()
    };
  }
  
  async extractPageState() {
    if (!this.page) throw new Error('Browser not initialized');
    
    return await this.page.evaluate(() => {
      const extractText = (selector: string): string[] => {
        return Array.from(document.querySelectorAll(selector))
          .map(el => el.textContent?.trim() || '')
          .filter(text => text.length > 0);
      };
      
      const patterns = [
        '[class*="error"]',
        '[class*="alert"]',
        '[class*="warning"]',
        '[role="alert"]',
        '.text-red-500',
        '.text-danger',
        '[class*="status"]',
        '[class*="deployment"]',
        '[class*="build"]',
      ];
      
      const elements: Record<string, string[]> = {};
      patterns.forEach(pattern => {
        elements[pattern] = extractText(pattern);
      });
      
      return {
        url: window.location.href,
        title: document.title,
        elements,
        bodyText: document.body.innerText.substring(0, 5000),
        hasErrors: document.body.innerText.toLowerCase().includes('error') ||
                   document.body.innerText.toLowerCase().includes('failed'),
        interactiveElements: {
          buttons: Array.from(document.querySelectorAll('button')).map(btn => ({
            text: btn.textContent?.trim(),
            disabled: btn.disabled,
          })),
          links: Array.from(document.querySelectorAll('a[href]')).map(link => ({
            text: link.textContent?.trim(),
            href: link.getAttribute('href')
          }))
        }
      };
    });
  }
  
  async captureScreenshot(name: string): Promise<string> {
    if (!this.page) throw new Error('Browser not initialized');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${name}-${timestamp}.png`;
    const filepath = path.join('screenshots', filename);
    
    await fs.mkdir('screenshots', { recursive: true });
    await this.page.screenshot({ 
      path: filepath,
      fullPage: true 
    });
    
    this.screenshots.push(filepath);
    return filepath;
  }
  
  async extractErrors(): Promise<any[]> {
    if (!this.page) throw new Error('Browser not initialized');
    
    const errors = await this.page.evaluate(() => {
      const errorPatterns = [
        { selector: '[class*="error"]', type: 'error' },
        { selector: '[class*="alert-danger"]', type: 'error' },
        { selector: '[class*="warning"]', type: 'warning' },
        { selector: '[role="alert"]', type: 'alert' },
        { selector: '.text-red-500', type: 'error' },
        { selector: '.text-danger', type: 'error' }
      ];
      
      const found: any[] = [];
      
      errorPatterns.forEach(({ selector, type }) => {
        document.querySelectorAll(selector).forEach(el => {
          const text = el.textContent?.trim();
          if (text && text.length > 0) {
            found.push({
              type,
              text,
              selector,
            });
          }
        });
      });
      
      return found;
    });
    
    return errors;
  }
  
  private async checkVercelLoginStatus(): Promise<boolean> {
    if (!this.page) return false;
    
    try {
      return this.page.url().includes('dashboard') && 
             !this.page.url().includes('login');
    } catch {
      return false;
    }
  }
  
  async cleanup() {
    if (this.context) {
      await this.context.close();
    }
    
    console.log(`Session complete. Screenshots saved: ${this.screenshots.join(', ')}`);
  }
}