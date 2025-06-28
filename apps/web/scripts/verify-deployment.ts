#!/usr/bin/env tsx

/**
 * ColdCopy Deployment Verification Script
 * 
 * This script verifies that all critical endpoints and services are working correctly
 * after deployment to production.
 * 
 * Usage: npm run verify:deployment
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';

// Production URLs
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://coldcopy-moose.vercel.app';
const API_URL = process.env.API_URL || 'https://api.coldcopy.cc';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Test results tracking
interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  duration?: number;
}

const results: TestResult[] = [];

// Helper functions
function log(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') {
  const colors = {
    info: chalk.blue,
    success: chalk.green,
    error: chalk.red,
    warning: chalk.yellow,
  };
  console.log(colors[type](message));
}

function logTestStart(testName: string) {
  console.log(chalk.gray(`\n→ Testing ${testName}...`));
}

function logTestResult(result: TestResult) {
  const icon = result.passed ? '✓' : '✗';
  const color = result.passed ? chalk.green : chalk.red;
  const duration = result.duration ? chalk.gray(` (${result.duration}ms)`) : '';
  console.log(color(`${icon} ${result.name}${duration}`));
  if (result.message) {
    console.log(chalk.gray(`  ${result.message}`));
  }
}

async function runTest(
  name: string,
  testFn: () => Promise<{ passed: boolean; message: string }>
): Promise<void> {
  logTestStart(name);
  const startTime = Date.now();
  
  try {
    const { passed, message } = await testFn();
    const duration = Date.now() - startTime;
    const result = { name, passed, message, duration };
    results.push(result);
    logTestResult(result);
  } catch (error) {
    const duration = Date.now() - startTime;
    const result = {
      name,
      passed: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      duration,
    };
    results.push(result);
    logTestResult(result);
  }
}

// Test functions
async function testFrontendHealth(): Promise<{ passed: boolean; message: string }> {
  try {
    const response = await fetch(FRONTEND_URL, {
      method: 'GET',
      headers: { 'User-Agent': 'ColdCopy-Verification-Script' },
    });
    
    if (response.status === 200) {
      const text = await response.text();
      const hasContent = text.includes('<!DOCTYPE html>') || text.includes('<html');
      return {
        passed: hasContent,
        message: hasContent ? 'Frontend is serving HTML content' : 'Frontend returned empty response',
      };
    } else {
      return {
        passed: false,
        message: `Frontend returned status ${response.status}`,
      };
    }
  } catch (error) {
    return {
      passed: false,
      message: `Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

async function testAPIHealth(): Promise<{ passed: boolean; message: string }> {
  try {
    const response = await fetch(`${API_URL}/health`, {
      method: 'GET',
      headers: { 'User-Agent': 'ColdCopy-Verification-Script' },
    });
    
    if (response.status === 200) {
      const data = await response.json();
      return {
        passed: true,
        message: `API is healthy: ${JSON.stringify(data)}`,
      };
    } else {
      return {
        passed: false,
        message: `API returned status ${response.status}`,
      };
    }
  } catch (error) {
    return {
      passed: false,
      message: `Failed to connect to API: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

async function testSupabaseConnection(): Promise<{ passed: boolean; message: string }> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return {
      passed: false,
      message: 'Supabase environment variables not set',
    };
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // Test basic connectivity by checking auth status
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      return {
        passed: false,
        message: `Supabase error: ${error.message}`,
      };
    }
    
    return {
      passed: true,
      message: 'Supabase connection successful (no active session)',
    };
  } catch (error) {
    return {
      passed: false,
      message: `Failed to connect to Supabase: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

async function testAuthEndpoints(): Promise<{ passed: boolean; message: string }> {
  const endpoints = [
    { path: '/api/auth/session', method: 'GET', name: 'Session check' },
    { path: '/api/auth/csrf', method: 'GET', name: 'CSRF token' },
  ];
  
  const results = await Promise.all(
    endpoints.map(async (endpoint) => {
      try {
        const response = await fetch(`${FRONTEND_URL}${endpoint.path}`, {
          method: endpoint.method,
          headers: { 'User-Agent': 'ColdCopy-Verification-Script' },
        });
        return {
          name: endpoint.name,
          passed: response.status < 500,
          status: response.status,
        };
      } catch (error) {
        return {
          name: endpoint.name,
          passed: false,
          status: 0,
        };
      }
    })
  );
  
  const allPassed = results.every(r => r.passed);
  const details = results.map(r => `${r.name}: ${r.status}`).join(', ');
  
  return {
    passed: allPassed,
    message: details,
  };
}

async function testStaticAssets(): Promise<{ passed: boolean; message: string }> {
  const assets = [
    '/favicon.ico',
    '/manifest.json',
    '/_next/static/css/',
  ];
  
  const results = await Promise.all(
    assets.map(async (asset) => {
      try {
        const response = await fetch(`${FRONTEND_URL}${asset}`, {
          method: 'HEAD',
          headers: { 'User-Agent': 'ColdCopy-Verification-Script' },
        });
        return {
          asset,
          passed: response.status === 200 || response.status === 304,
          status: response.status,
        };
      } catch (error) {
        return {
          asset,
          passed: false,
          status: 0,
        };
      }
    })
  );
  
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  
  return {
    passed: passedCount === totalCount,
    message: `${passedCount}/${totalCount} static assets accessible`,
  };
}

async function testCORSHeaders(): Promise<{ passed: boolean; message: string }> {
  try {
    const response = await fetch(`${FRONTEND_URL}/api/health`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://coldcopy.cc',
        'Access-Control-Request-Method': 'GET',
      },
    });
    
    const corsHeaders = {
      'access-control-allow-origin': response.headers.get('access-control-allow-origin'),
      'access-control-allow-methods': response.headers.get('access-control-allow-methods'),
      'access-control-allow-headers': response.headers.get('access-control-allow-headers'),
    };
    
    const hasRequiredHeaders = corsHeaders['access-control-allow-origin'] !== null;
    
    return {
      passed: hasRequiredHeaders,
      message: hasRequiredHeaders 
        ? `CORS configured: ${corsHeaders['access-control-allow-origin']}`
        : 'CORS headers not properly configured',
    };
  } catch (error) {
    return {
      passed: false,
      message: `Failed to test CORS: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

async function testEnvironmentVariables(): Promise<{ passed: boolean; message: string }> {
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ];
  
  // Test by checking if the frontend exposes these in its runtime config
  try {
    const response = await fetch(FRONTEND_URL);
    const html = await response.text();
    
    // Check if Next.js runtime config is present
    const hasRuntimeConfig = html.includes('__NEXT_DATA__');
    
    return {
      passed: hasRuntimeConfig,
      message: hasRuntimeConfig 
        ? 'Frontend runtime configuration detected'
        : 'Frontend runtime configuration not found',
    };
  } catch (error) {
    return {
      passed: false,
      message: `Failed to check environment: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

async function testDatabaseConnectivity(): Promise<{ passed: boolean; message: string }> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return {
      passed: false,
      message: 'Cannot test database without Supabase credentials',
    };
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // Try to query a public table (should fail with RLS but confirm connection)
    const { error } = await supabase
      .from('workspaces')
      .select('count')
      .limit(1);
    
    // RLS error is expected and confirms database connection
    if (error && error.message.includes('row-level security')) {
      return {
        passed: true,
        message: 'Database connected (RLS policies active)',
      };
    } else if (error) {
      return {
        passed: false,
        message: `Database error: ${error.message}`,
      };
    }
    
    return {
      passed: true,
      message: 'Database connection successful',
    };
  } catch (error) {
    return {
      passed: false,
      message: `Failed to test database: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// Main execution
async function main() {
  console.clear();
  log('\n🚀 ColdCopy Deployment Verification Script\n', 'info');
  log(`Frontend URL: ${FRONTEND_URL}`, 'info');
  log(`API URL: ${API_URL}`, 'info');
  log(`Supabase URL: ${SUPABASE_URL || 'Not configured'}`, 'info');
  
  // Run all tests
  await runTest('Frontend Health Check', testFrontendHealth);
  await runTest('API Health Check', testAPIHealth);
  await runTest('Supabase Connection', testSupabaseConnection);
  await runTest('Authentication Endpoints', testAuthEndpoints);
  await runTest('Static Assets', testStaticAssets);
  await runTest('CORS Configuration', testCORSHeaders);
  await runTest('Environment Variables', testEnvironmentVariables);
  await runTest('Database Connectivity', testDatabaseConnectivity);
  
  // Summary
  console.log('\n' + chalk.gray('─'.repeat(50)));
  log('\n📊 Test Summary\n', 'info');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  
  console.log(chalk.green(`  ✓ Passed: ${passed}`));
  if (failed > 0) {
    console.log(chalk.red(`  ✗ Failed: ${failed}`));
  }
  console.log(chalk.gray(`  Total: ${total}`));
  
  const successRate = Math.round((passed / total) * 100);
  console.log(`\n  Success Rate: ${successRate}%`);
  
  if (failed > 0) {
    log('\n❌ Deployment verification failed!', 'error');
    console.log('\nFailed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(chalk.red(`  - ${r.name}: ${r.message}`));
    });
    process.exit(1);
  } else {
    log('\n✅ All deployment checks passed!', 'success');
    log('\n🎉 ColdCopy is ready for production use!\n', 'success');
  }
}

// Run the script
main().catch((error) => {
  log('\n❌ Script execution failed:', 'error');
  console.error(error);
  process.exit(1);
});