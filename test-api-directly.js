// Test API endpoints directly to diagnose issues
const fetch = require('node-fetch');

(async () => {
  console.log('🔍 Testing API endpoints directly...');
  
  try {
    // Test 1: Check if API is responding
    console.log('📋 Testing: API health check...');
    const healthResponse = await fetch('https://coldcopy.cc/api/workspaces');
    console.log(`API Status: ${healthResponse.status}`);
    
    if (healthResponse.status === 401) {
      console.log('✅ API responding correctly (401 expected without auth)');
    } else if (healthResponse.status === 500) {
      console.log('❌ API returning 500 errors - likely environment issue');
      const errorText = await healthResponse.text();
      console.log('Error details:', errorText.substring(0, 200));
    }
    
    // Test 2: Check if Supabase environment is accessible
    console.log('📋 Testing: Environment variables accessibility...');
    const envTestResponse = await fetch('https://coldcopy.cc/api/health', {
      method: 'GET'
    });
    
    if (envTestResponse.status === 404) {
      console.log('⚠️  Health endpoint not found - this is normal');
    } else {
      console.log(`Health endpoint status: ${envTestResponse.status}`);
    }
    
    // Test 3: Try signup to test if auth works at all
    console.log('📋 Testing: Authentication system functionality...');
    const signupResponse = await fetch('https://coldcopy.cc/api/auth/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: `test-${Date.now()}@example.com`,
        password: 'TestPassword123!',
        firstName: 'Test',
        lastName: 'User'
      })
    });
    
    console.log(`Signup test status: ${signupResponse.status}`);
    
    if (signupResponse.status === 404) {
      console.log('⚠️  Signup endpoint not found - may use different auth flow');
    } else if (signupResponse.status === 500) {
      console.log('❌ Auth system has configuration issues');
    } else {
      console.log('✅ Auth system appears to be responding');
    }
    
  } catch (error) {
    console.error('❌ API testing failed:', error.message);
  }
})();