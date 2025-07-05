// Debug script to check campaign sequence initialization
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ 
    headless: false,
    devtools: true 
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Enable console logging
  page.on('console', msg => {
    console.log(`Browser console [${msg.type()}]:`, msg.text());
  });

  page.on('pageerror', error => {
    console.error('Page error:', error.message);
  });

  try {
    console.log('1. Navigating to login...');
    await page.goto('https://www.coldcopy.cc/login');
    
    console.log('2. Logging in...');
    await page.fill('input[type="email"]', 'jaspervanmoose@gmail.com');
    await page.fill('input[type="password"]', 'okkenbollen33');
    await page.click('button[type="submit"]');
    
    console.log('3. Waiting for dashboard...');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    
    console.log('4. Going directly to campaigns page...');
    await page.goto('https://www.coldcopy.cc/campaigns');
    await page.waitForLoadState('networkidle');
    
    console.log('5. Looking for "New Campaign" button...');
    const newCampaignBtn = await page.$('button:has-text("New Campaign"), a:has-text("New Campaign")');
    if (newCampaignBtn) {
      console.log('Found New Campaign button, clicking...');
      await newCampaignBtn.click();
      await page.waitForLoadState('networkidle');
    } else {
      console.log('New Campaign button not found, navigating directly...');
      await page.goto('https://www.coldcopy.cc/campaigns/new');
    }
    
    console.log('6. Waiting for campaign form...');
    await page.waitForSelector('input[id="name"]', { timeout: 5000 });
    
    console.log('7. Filling campaign details...');
    await page.fill('input[id="name"]', 'Debug Test Campaign');
    
    // Check initial state
    const sequences = await page.evaluate(() => {
      // Try to access React state through development tools
      const reactFiber = document.querySelector('[data-reactroot]')?._reactRootContainer?._internalRoot?.current;
      console.log('React Fiber:', reactFiber);
      return null;
    });
    
    console.log('8. Clicking Next to go to Email Content...');
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(2000);
    
    // Check what's visible on the page
    console.log('9. Checking visible elements...');
    const emailContentVisible = await page.isVisible('text="Email Content"');
    console.log('Email Content header visible:', emailContentVisible);
    
    const noEmailsMessage = await page.isVisible('text="No emails in this"');
    console.log('No emails message visible:', noEmailsMessage);
    
    const addFirstEmailBtn = await page.isVisible('button:has-text("Add First Email")');
    console.log('Add First Email button visible:', addFirstEmailBtn);
    
    const accordionItems = await page.$$('.space-y-2 [data-radix-collection-item]');
    console.log('Number of accordion items:', accordionItems.length);
    
    // Take screenshot
    await page.screenshot({ path: 'debug-sequences-state.png', fullPage: true });
    console.log('Screenshot saved as debug-sequences-state.png');
    
    // If we see the "Add First Email" button, click it
    if (addFirstEmailBtn) {
      console.log('10. Clicking "Add First Email"...');
      await page.click('button:has-text("Add First Email")');
      await page.waitForTimeout(1000);
      
      // Check again
      const subjectInput = await page.isVisible('input[placeholder="Enter email subject..."]');
      const bodyTextarea = await page.isVisible('textarea[placeholder="Enter email content..."]');
      
      console.log('After clicking Add First Email:');
      console.log('Subject input visible:', subjectInput);
      console.log('Body textarea visible:', bodyTextarea);
      
      // Check for any accordion items now
      const accordionItemsAfter = await page.$$('[data-state="open"], [data-state="closed"]');
      console.log('Accordion items after:', accordionItemsAfter.length);
      
      // Try to find and click on accordion if needed
      if (accordionItemsAfter.length > 0 && !subjectInput) {
        console.log('11. Trying to expand accordion...');
        const firstAccordion = accordionItemsAfter[0];
        await firstAccordion.click();
        await page.waitForTimeout(500);
        
        const subjectInputFinal = await page.isVisible('input[placeholder="Enter email subject..."]');
        const bodyTextareaFinal = await page.isVisible('textarea[placeholder="Enter email content..."]');
        
        console.log('After expanding accordion:');
        console.log('Subject input visible:', subjectInputFinal);
        console.log('Body textarea visible:', bodyTextareaFinal);
      }
      
      await page.screenshot({ path: 'debug-sequences-after-add.png', fullPage: true });
    }
    
  } catch (error) {
    console.error('Error:', error);
    await page.screenshot({ path: 'debug-error.png', fullPage: true });
  }
  
  console.log('\nDebug complete. Browser remains open.');
  await new Promise(() => {});
})();