const { chromium } = require('playwright');

(async () => {
  console.log('🧪 Testing ColdCopy Campaign Features\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 300 
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true
  });
  
  const page = await context.newPage();
  
  // Capture console messages
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`Browser ERROR:`, msg.text());
    }
  });
  
  try {
    // Login first
    console.log('1. Logging in as admin...');
    await page.goto('https://www.coldcopy.cc/login');
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[type="email"]', 'jaspervanmoose@gmail.com');
    await page.fill('input[type="password"]', 'okkenbollen33');
    await page.click('button:has-text("Sign in")');
    
    await page.waitForTimeout(5000);
    
    if (!page.url().includes('dashboard')) {
      console.log('❌ Login failed');
      return;
    }
    
    console.log('✅ Login successful\n');
    
    // Navigate to campaigns
    console.log('2. Testing Campaign Section...');
    await page.click('text="Campaigns"');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    const campaignsUrl = page.url();
    console.log('Current URL:', campaignsUrl);
    
    // Check for campaigns list
    console.log('\n3. Checking existing campaigns...');
    const campaignCards = await page.locator('[data-testid="campaign-card"], .campaign-item, .campaign-card, tbody tr').count();
    console.log(`Found ${campaignCards} campaigns`);
    
    // Look for New Campaign button
    console.log('\n4. Looking for New Campaign button...');
    const newCampaignButton = await page.locator('button:has-text("New Campaign"), a:has-text("New Campaign"), button:has-text("Create Campaign")').first();
    
    if (await newCampaignButton.isVisible()) {
      console.log('✅ Found New Campaign button');
      await page.screenshot({ path: 'campaigns-list.png' });
      
      // Click to create new campaign
      console.log('\n5. Creating new campaign...');
      await newCampaignButton.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      
      const newCampaignUrl = page.url();
      console.log('New campaign URL:', newCampaignUrl);
      
      // Check if we're on the new campaign page
      if (newCampaignUrl.includes('new')) {
        console.log('✅ Navigated to new campaign page');
        
        // Look for form fields
        console.log('\n6. Checking campaign form fields...');
        
        const nameInput = await page.locator('input[name="name"], input[placeholder*="campaign" i], input[placeholder*="name" i]').first();
        const hasNameInput = await nameInput.isVisible();
        console.log('Campaign name input:', hasNameInput ? '✅' : '❌');
        
        if (hasNameInput) {
          await nameInput.fill('Test Campaign ' + Date.now());
        }
        
        // Check for other fields
        const subjectInput = await page.locator('input[name="subject"], input[placeholder*="subject" i]').first();
        const hasSubjectInput = await subjectInput.isVisible();
        console.log('Subject line input:', hasSubjectInput ? '✅' : '❌');
        
        if (hasSubjectInput) {
          await subjectInput.fill('Test Subject Line');
        }
        
        // Check for email body editor
        const bodyEditor = await page.locator('textarea[name="body"], [contenteditable="true"], .email-editor, .editor').first();
        const hasBodyEditor = await bodyEditor.isVisible();
        console.log('Email body editor:', hasBodyEditor ? '✅' : '❌');
        
        if (hasBodyEditor) {
          await bodyEditor.fill('This is a test email body content.');
        }
        
        // Look for AI generation button
        console.log('\n7. Checking AI features...');
        const aiButton = await page.locator('button:has-text("AI"), button:has-text("Generate"), button[aria-label*="AI"]').first();
        const hasAIButton = await aiButton.isVisible();
        console.log('AI generation button:', hasAIButton ? '✅' : '❌');
        
        await page.screenshot({ path: 'new-campaign-form.png' });
        
        // Check for save/create button
        const saveButton = await page.locator('button:has-text("Save"), button:has-text("Create"), button:has-text("Draft")').first();
        const hasSaveButton = await saveButton.isVisible();
        console.log('Save/Create button:', hasSaveButton ? '✅' : '❌');
        
      } else {
        console.log('❌ Failed to navigate to new campaign page');
      }
      
    } else {
      console.log('❌ New Campaign button not found');
    }
    
    // Test campaign analytics
    console.log('\n8. Testing campaign analytics...');
    await page.goto('https://www.coldcopy.cc/campaigns');
    await page.waitForLoadState('networkidle');
    
    // Click on first campaign if available
    const firstCampaign = await page.locator('[data-testid="campaign-card"], .campaign-item, tbody tr').first();
    if (await firstCampaign.isVisible()) {
      await firstCampaign.click();
      await page.waitForTimeout(3000);
      
      // Check for analytics/metrics
      const metrics = ['Sent', 'Opens', 'Clicks', 'Replies'];
      console.log('\nCampaign metrics:');
      for (const metric of metrics) {
        const hasMetric = await page.locator(`text=/${metric}/i`).first().isVisible();
        console.log(`${metric}:`, hasMetric ? '✅' : '❌');
      }
      
      await page.screenshot({ path: 'campaign-details.png' });
    }
    
    // Check for errors
    console.log('\n9. Checking for errors...');
    const errors = await page.locator('.text-destructive, .text-red-600, [role="alert"]').all();
    if (errors.length > 0) {
      console.log('⚠️  Found error messages:');
      for (const error of errors) {
        const text = await error.textContent();
        console.log('  -', text);
      }
    } else {
      console.log('✅ No error messages found');
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    await page.screenshot({ path: 'campaign-test-error.png' });
  }
  
  console.log('\n✅ Campaign feature test complete!');
  console.log('\nScreenshots saved. Browser will remain open for inspection.');
  console.log('Press Ctrl+C to close.\n');
  
  // Keep browser open
  await new Promise(() => {});
})();