const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('1. Navigating to ColdCopy...');
    await page.goto('https://www.coldcopy.cc');
    
    console.log('2. Going to login page...');
    await page.goto('https://www.coldcopy.cc/login');
    await page.waitForLoadState('networkidle');
    
    console.log('3. Logging in...');
    await page.fill('input[type="email"]', 'jaspervanmoose@gmail.com');
    await page.fill('input[type="password"]', 'okkenbollen33');
    await page.click('button[type="submit"]');
    
    console.log('4. Waiting for dashboard...');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    
    console.log('5. Navigating to new campaign page...');
    await page.goto('https://www.coldcopy.cc/campaigns/new');
    await page.waitForLoadState('networkidle');
    
    console.log('6. Filling campaign details...');
    // Step 1: Campaign Details
    await page.fill('input[name="name"]', 'Test Campaign Form');
    await page.fill('textarea[name="description"]', 'Testing the campaign creation form');
    
    console.log('7. Moving to step 2 (Email Content)...');
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(1000);
    
    console.log('8. Checking for email content fields...');
    // Check if the sequence builder is visible
    const sequenceBuilder = await page.isVisible('text="Email Content"');
    console.log('Email Content section visible:', sequenceBuilder);
    
    // Check for subject and body fields
    const subjectField = await page.isVisible('input[placeholder="Enter email subject..."]');
    const bodyField = await page.isVisible('textarea[placeholder="Enter email content..."]');
    
    console.log('Subject field visible:', subjectField);
    console.log('Body field visible:', bodyField);
    
    // Check if there are any errors in console
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('Console error:', msg.text());
      }
    });
    
    // Take a screenshot of the current state
    await page.screenshot({ path: 'campaign-form-step2.png', fullPage: true });
    console.log('Screenshot saved as campaign-form-step2.png');
    
    // Check if accordion is expanded
    const accordionExpanded = await page.isVisible('.space-y-4 [data-state="open"]');
    console.log('Accordion expanded:', accordionExpanded);
    
    // If accordion is not expanded, try to expand it
    if (!accordionExpanded) {
      console.log('9. Trying to expand accordion...');
      const accordionTrigger = await page.$('button[aria-expanded="false"]');
      if (accordionTrigger) {
        await accordionTrigger.click();
        await page.waitForTimeout(500);
        
        // Check again for fields
        const subjectFieldAfter = await page.isVisible('input[placeholder="Enter email subject..."]');
        const bodyFieldAfter = await page.isVisible('textarea[placeholder="Enter email content..."]');
        
        console.log('After clicking accordion:');
        console.log('Subject field visible:', subjectFieldAfter);
        console.log('Body field visible:', bodyFieldAfter);
      }
    }
    
    // Check if "Add First Email" button is present
    const addFirstEmailBtn = await page.isVisible('button:has-text("Add First Email")');
    console.log('Add First Email button visible:', addFirstEmailBtn);
    
    if (addFirstEmailBtn) {
      console.log('10. Clicking Add First Email button...');
      await page.click('button:has-text("Add First Email")');
      await page.waitForTimeout(1000);
      
      // Check again for fields
      const subjectFieldFinal = await page.isVisible('input[placeholder="Enter email subject..."]');
      const bodyFieldFinal = await page.isVisible('textarea[placeholder="Enter email content..."]');
      
      console.log('After adding first email:');
      console.log('Subject field visible:', subjectFieldFinal);
      console.log('Body field visible:', bodyFieldFinal);
      
      await page.screenshot({ path: 'campaign-form-after-add.png', fullPage: true });
      console.log('Screenshot saved as campaign-form-after-add.png');
    }
    
  } catch (error) {
    console.error('Error during test:', error);
    await page.screenshot({ path: 'campaign-form-error.png', fullPage: true });
  }
  
  // Keep browser open for manual inspection
  console.log('\nTest complete. Browser will remain open for inspection.');
  console.log('Press Ctrl+C to close.');
  
  await new Promise(() => {}); // Keep script running
})();