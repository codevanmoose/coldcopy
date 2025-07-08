// Test specific API endpoints that are failing
const fetch = require('node-fetch');

(async () => {
  console.log('🔍 Testing specific API endpoints...');
  
  // Get a valid session token first
  const loginResponse = await fetch('https://zicipvpablahehxstbfr.supabase.co/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppY2lwdnBhYmxhaGVoeHN0YmZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwMDY3NTEsImV4cCI6MjA2NjU4Mjc1MX0.4i08GOhX0UPWjv4YdLRBXXEi2WMYiFgAica8LM9fRB8'
    },
    body: JSON.stringify({
      email: 'jaspervanmoose@gmail.com',
      password: 'ColdCopy2025!'
    })
  });
  
  if (!loginResponse.ok) {
    console.error('❌ Could not authenticate for API testing');
    return;
  }
  
  const authData = await loginResponse.json();
  const token = authData.access_token;
  
  console.log('✅ Got authentication token');
  
  // Test the failing endpoints
  const endpointsToTest = [
    '/api/workspaces',
    '/api/leads',
    '/api/templates', 
    '/api/campaigns',
    '/api/test-ai-config'
  ];
  
  for (const endpoint of endpointsToTest) {
    console.log(`📋 Testing: ${endpoint}`);
    
    try {
      const response = await fetch(`https://coldcopy.cc${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`Status: ${response.status}`);
      
      if (response.status === 404) {
        console.log(`❌ ${endpoint} - Not Found (endpoint doesn't exist)`);
      } else if (response.status === 405) {
        console.log(`❌ ${endpoint} - Method Not Allowed`);
      } else if (response.status === 401) {
        console.log(`❌ ${endpoint} - Unauthorized (auth issue)`);
      } else if (response.status === 400) {
        const errorText = await response.text();
        console.log(`❌ ${endpoint} - Bad Request:`, errorText.substring(0, 100));
      } else if (response.status >= 500) {
        console.log(`❌ ${endpoint} - Server Error`);
      } else if (response.status === 200) {
        console.log(`✅ ${endpoint} - Working`);
      } else {
        console.log(`⚠️  ${endpoint} - Unexpected status: ${response.status}`);
      }
      
    } catch (error) {
      console.log(`❌ ${endpoint} - Network Error:`, error.message);
    }
  }
  
  // Test specific workspace endpoint with workspace ID
  console.log('📋 Testing workspace-specific endpoints...');
  
  const workspaceId = '7cc2a5a5-2980-4b87-8d00-a26489b9970e';
  
  const workspaceEndpoints = [
    `/api/workspaces/${workspaceId}/leads`,
    `/api/workspaces/${workspaceId}/campaigns`,
    `/api/workspaces/${workspaceId}/analytics/overview`
  ];
  
  for (const endpoint of workspaceEndpoints) {
    console.log(`📋 Testing: ${endpoint}`);
    
    try {
      const response = await fetch(`https://coldcopy.cc${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`Status: ${response.status}`);
      
      if (response.status === 200) {
        const data = await response.json();
        console.log(`✅ ${endpoint} - Working, returned:`, Object.keys(data));
      } else {
        console.log(`❌ ${endpoint} - Failed with status ${response.status}`);
      }
      
    } catch (error) {
      console.log(`❌ ${endpoint} - Network Error:`, error.message);
    }
  }
  
})();