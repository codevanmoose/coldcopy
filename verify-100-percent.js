#!/usr/bin/env node

/**
 * ColdCopy Platform 100% Verification Script
 * Run this to verify all systems are operational
 */

const https = require('https');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Test results tracking
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

// Helper functions
function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function success(message) {
  passedTests++;
  log(`✅ ${message}`, colors.green);
}

function fail(message) {
  failedTests++;
  log(`❌ ${message}`, colors.red);
}

function info(message) {
  log(`ℹ️  ${message}`, colors.cyan);
}

function section(title) {
  console.log('\n' + '='.repeat(60));
  log(title, colors.bright + colors.blue);
  console.log('='.repeat(60) + '\n');
}

// Test functions
async function checkUrl(url, testName) {
  totalTests++;
  return new Promise((resolve) => {
    https.get(url, (res) => {
      if (res.statusCode >= 200 && res.statusCode < 400) {
        success(`${testName}: ${url} (Status: ${res.statusCode})`);
        resolve(true);
      } else {
        fail(`${testName}: ${url} (Status: ${res.statusCode})`);
        resolve(false);
      }
    }).on('error', (err) => {
      fail(`${testName}: ${url} (Error: ${err.message})`);
      resolve(false);
    });
  });
}

async function checkVercelEnv() {
  totalTests++;
  try {
    const { stdout } = await execAsync('vercel env ls production 2>/dev/null | grep -E "(SUPABASE|OPENAI|ANTHROPIC|AWS|STRIPE)" | wc -l');
    const count = parseInt(stdout.trim());
    if (count >= 10) {
      success(`Vercel Environment Variables: ${count} critical variables configured`);
      return true;
    } else {
      fail(`Vercel Environment Variables: Only ${count} critical variables found (need at least 10)`);
      return false;
    }
  } catch (error) {
    fail(`Vercel Environment Variables: Unable to check (${error.message})`);
    return false;
  }
}

async function checkSupabaseConnection() {
  totalTests++;
  const supabaseUrl = 'https://zicipvpablahehxstbfr.supabase.co';
  return checkUrl(`${supabaseUrl}/rest/v1/`, 'Supabase Database Connection');
}

async function checkDeploymentStatus() {
  totalTests++;
  try {
    const { stdout } = await execAsync('vercel list --prod 2>/dev/null | head -n 5');
    if (stdout.includes('coldcopy')) {
      success('Vercel Deployment: Production deployment found');
      info('Latest deployments:\n' + stdout);
      return true;
    } else {
      fail('Vercel Deployment: No production deployment found');
      return false;
    }
  } catch (error) {
    fail(`Vercel Deployment: Unable to check (${error.message})`);
    return false;
  }
}

async function checkAPIEndpoints() {
  const endpoints = [
    '/api/health',
    '/api/auth/session',
    '/api/workspaces',
    '/api/leads',
    '/api/campaigns',
    '/api/templates',
    '/api/analytics/overview'
  ];

  section('API Endpoint Tests');
  
  for (const endpoint of endpoints) {
    await checkUrl(`https://coldcopy.cc${endpoint}`, `API Endpoint ${endpoint}`);
  }
}

async function checkCriticalPages() {
  const pages = [
    { url: 'https://coldcopy.cc', name: 'Landing Page' },
    { url: 'https://coldcopy.cc/login', name: 'Login Page' },
    { url: 'https://coldcopy.cc/signup', name: 'Signup Page' },
    { url: 'https://coldcopy.cc/dashboard', name: 'Dashboard (redirect expected)' }
  ];

  section('Critical Pages Tests');
  
  for (const page of pages) {
    await checkUrl(page.url, page.name);
  }
}

// Main verification function
async function runVerification() {
  console.clear();
  log(`
╔═══════════════════════════════════════════════════════════╗
║          ColdCopy Platform 100% Verification              ║
║                    January 8, 2025                        ║
╚═══════════════════════════════════════════════════════════╝
`, colors.bright + colors.cyan);

  section('1. Infrastructure Tests');
  await checkUrl('https://coldcopy.cc', 'Production Domain');
  await checkSupabaseConnection();
  await checkVercelEnv();
  await checkDeploymentStatus();

  section('2. Critical Pages Tests');
  await checkCriticalPages();

  section('3. API Endpoint Tests');
  await checkAPIEndpoints();

  section('4. Database Tables Check');
  info('Run the complete-database-setup.sql script in Supabase to ensure all tables exist');
  info('Tables required: workspaces, users, leads, campaigns, email_templates, etc.');

  section('5. Environment Variables Summary');
  info('Critical variables that should be configured:');
  console.log(`
  ${colors.yellow}Essential:${colors.reset}
  ✓ NEXT_PUBLIC_SUPABASE_URL
  ✓ NEXT_PUBLIC_SUPABASE_ANON_KEY
  ✓ SUPABASE_SERVICE_ROLE_KEY
  ✓ JWT_SECRET / NEXTAUTH_SECRET
  
  ${colors.yellow}AI Services:${colors.reset}
  ✓ OPENAI_API_KEY
  ✓ ANTHROPIC_API_KEY
  
  ${colors.yellow}Email (AWS SES):${colors.reset}
  ✓ AWS_ACCESS_KEY_ID
  ✓ AWS_SECRET_ACCESS_KEY
  ✓ AWS_REGION
  
  ${colors.yellow}Payments:${colors.reset}
  ✓ STRIPE_SECRET_KEY
  ✓ STRIPE_WEBHOOK_SECRET
  `);

  section('6. Action Items for 100%');
  console.log(`
  ${colors.yellow}Remaining Steps:${colors.reset}
  
  1. ${colors.cyan}Database Setup (if not done):${colors.reset}
     - Go to Supabase SQL Editor
     - Run: complete-database-setup.sql
     - Verify all tables are created
  
  2. ${colors.cyan}AWS SES Production (if needed):${colors.reset}
     - Submit production access request
     - Use template in AWS_SES_PRODUCTION_REQUEST_TEMPLATE.md
     - Wait 24-48 hours for approval
  
  3. ${colors.cyan}Test Core Features:${colors.reset}
     - Create admin account: node setup-admin.js
     - Login at https://coldcopy.cc/login
     - Create a test campaign
     - Add a test lead
     - Send a test email
  `);

  // Final Summary
  section('Verification Summary');
  const percentComplete = Math.round((passedTests / totalTests) * 100);
  
  console.log(`
  Total Tests: ${totalTests}
  Passed: ${colors.green}${passedTests}${colors.reset}
  Failed: ${colors.red}${failedTests}${colors.reset}
  
  Platform Status: ${colors.bright}${percentComplete}% Operational${colors.reset}
  `);

  if (percentComplete === 100) {
    log('\n🎉 CONGRATULATIONS! ColdCopy is 100% READY! 🎉', colors.bright + colors.green);
    log('The platform is fully operational and ready for customers!', colors.green);
  } else if (percentComplete >= 95) {
    log(`\n🚀 Platform is ${percentComplete}% ready - Can launch in beta mode!`, colors.bright + colors.yellow);
    log('Minor issues detected but platform is functional for users.', colors.yellow);
  } else {
    log(`\n⚠️  Platform is only ${percentComplete}% ready - Issues need attention`, colors.bright + colors.red);
    log('Please resolve the failed tests before launching.', colors.red);
  }

  // Quick links
  section('Quick Links');
  console.log(`
  🌐 Production Site: ${colors.cyan}https://coldcopy.cc${colors.reset}
  📊 Supabase Dashboard: ${colors.cyan}https://supabase.com/dashboard/project/zicipvpablahehxstbfr${colors.reset}
  🚀 Vercel Dashboard: ${colors.cyan}https://vercel.com/vanmooseprojects/coldcopy${colors.reset}
  📧 AWS SES Console: ${colors.cyan}https://console.aws.amazon.com/ses/${colors.reset}
  `);
}

// Run the verification
runVerification().catch(console.error);