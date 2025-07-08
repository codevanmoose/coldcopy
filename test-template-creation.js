const { chromium } = require('playwright');

async function testTemplateCreation() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Monitor API calls
  page.on('response', response => {
    if (response.url().includes('/api/') && response.url().includes('template')) {
      console.log(`API: ${response.status()} ${response.url()}`);
    }
  });

  console.log('🔍 Testing Template Creation...\n');

  try {
    // Login
    console.log('1. Logging in...');
    await page.goto('https://www.coldcopy.cc/login');
    await page.fill('input[type="email"]', 'jaspervanmoose@gmail.com');
    await page.fill('input[type="password"]', 'okkenbollen33');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    console.log('✅ Logged in successfully');

    // Navigate to templates
    console.log('\n2. Navigating to Templates page...');
    await page.goto('https://www.coldcopy.cc/templates');
    await page.waitForLoadState('networkidle');
    
    // Check page title
    const pageTitle = await page.textContent('h1').catch(() => '');
    console.log(`   Page title: "${pageTitle}"`);

    // Look for Create Template button
    console.log('\n3. Looking for Create Template button...');
    await page.waitForTimeout(2000);
    
    // Try different selectors
    const createButton = await page.getByRole('button', { name: /create template|new template|add template/i }).first();
    
    if (await createButton.isVisible()) {
      console.log('✅ Found Create Template button');
      
      // Click it
      await createButton.click();
      console.log('✅ Clicked Create Template button');
      
      // Wait for form/page
      await page.waitForTimeout(2000);
      
      // Check if we're on a new page or modal
      const currentUrl = page.url();
      console.log(`   Current URL: ${currentUrl}`);
      
      // Look for template form fields
      const nameInput = await page.locator('input[name="name"], input[placeholder*="name" i]').first();
      const subjectInput = await page.locator('input[name="subject"], input[placeholder*="subject" i]').first();
      
      if (await nameInput.isVisible() || await subjectInput.isVisible()) {
        console.log('✅ Template form opened');
        
        // Fill the form
        console.log('\n4. Filling template form...');
        
        if (await nameInput.isVisible()) {
          await nameInput.fill('Test Template');
          console.log('   ✅ Filled template name');
        }
        
        if (await subjectInput.isVisible()) {
          await subjectInput.fill('Meeting with {{company}}');
          console.log('   ✅ Filled subject with variable');
        }
        
        // Look for content editor
        const contentEditor = await page.locator('textarea, [contenteditable="true"], .ProseMirror').first();
        if (await contentEditor.isVisible()) {
          await contentEditor.click();
          await contentEditor.fill('Hi {{first_name}},\n\nI hope this email finds you well...');
          console.log('   ✅ Filled email content');
        }
        
        // Try to save
        console.log('\n5. Saving template...');
        const saveButton = await page.getByRole('button', { name: /save|create|submit/i }).last();
        if (await saveButton.isVisible()) {
          await saveButton.click();
          console.log('   Clicked save button');
          
          // Wait for response
          await page.waitForTimeout(3000);
          
          // Check for success/error
          const toast = await page.locator('[role="alert"], .sonner-toast').first().textContent().catch(() => '');
          if (toast) {
            console.log(`   📢 Response: "${toast}"`);
          }
        }
      }
    } else {
      console.log('❌ Could not find Create Template button');
      await page.screenshot({ path: 'templates-page.png' });
    }

  } catch (error) {
    console.error('❌ Test error:', error.message);
    await page.screenshot({ path: 'template-error.png' });
  } finally {
    console.log('\n✅ Test completed.');
    await page.waitForTimeout(5000);
    await browser.close();
  }
}

testTemplateCreation();