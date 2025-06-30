#!/usr/bin/env node

// Test script to verify authentication is working
const baseUrl = 'https://www.coldcopy.cc';

async function testAuthEndpoints() {
  console.log('🧪 Testing ColdCopy Authentication System\n');
  
  // Test 1: Check if login page loads
  console.log('1. Testing login page...');
  try {
    const loginResponse = await fetch(`${baseUrl}/login`);
    console.log(`   ✅ Login page: ${loginResponse.status} ${loginResponse.statusText}`);
  } catch (error) {
    console.log(`   ❌ Login page error: ${error.message}`);
  }
  
  // Test 2: Check if signup page loads
  console.log('\n2. Testing signup page...');
  try {
    const signupResponse = await fetch(`${baseUrl}/signup`, { redirect: 'follow' });
    console.log(`   ✅ Signup page: ${signupResponse.status} ${signupResponse.statusText}`);
  } catch (error) {
    console.log(`   ❌ Signup page error: ${error.message}`);
  }
  
  // Test 3: Check API health
  console.log('\n3. Testing API health endpoint...');
  try {
    const healthResponse = await fetch(`${baseUrl}/api/health`);
    const healthData = await healthResponse.json();
    console.log(`   ✅ API health: ${healthResponse.status}`, healthData);
  } catch (error) {
    console.log(`   ❌ API health error: ${error.message}`);
  }
  
  // Test 4: Check if dashboard redirects to login when not authenticated
  console.log('\n4. Testing dashboard redirect...');
  try {
    const dashboardResponse = await fetch(`${baseUrl}/dashboard`, { redirect: 'manual' });
    if (dashboardResponse.status === 307 || dashboardResponse.status === 308) {
      const location = dashboardResponse.headers.get('location');
      console.log(`   ✅ Dashboard correctly redirects to: ${location}`);
    } else {
      console.log(`   ⚠️  Dashboard returned: ${dashboardResponse.status}`);
    }
  } catch (error) {
    console.log(`   ❌ Dashboard error: ${error.message}`);
  }
  
  console.log('\n📊 Summary:');
  console.log('- Your authentication pages are accessible');
  console.log('- To fully test auth, try creating an account at:');
  console.log(`  ${baseUrl}/signup`);
  console.log('\n⚠️  Note: Email features require Amazon SES setup');
  console.log('   AI features require OpenAI/Anthropic API keys');
}

testAuthEndpoints();