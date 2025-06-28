#!/usr/bin/env tsx

/**
 * Deployment Verification Script
 * Run this after deployment to verify everything is working correctly
 * Usage: npx tsx scripts/deployment-verify.ts
 */

import { createClient } from '@supabase/supabase-js'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://coldcopy.cc'
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.coldcopy.cc'
const TRACKING_URL = process.env.TRACKING_DOMAIN || 'https://track.coldcopy.cc'

interface TestResult {
  name: string
  status: 'pass' | 'fail' | 'warn'
  message?: string
  duration?: number
}

const tests: TestResult[] = []

async function runTest(
  name: string,
  testFn: () => Promise<void>
): Promise<void> {
  const start = Date.now()
  try {
    await testFn()
    tests.push({
      name,
      status: 'pass',
      duration: Date.now() - start,
    })
  } catch (error) {
    tests.push({
      name,
      status: 'fail',
      message: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - start,
    })
  }
}

async function testHealthCheck() {
  const response = await fetch(`${APP_URL}/api/health`)
  if (!response.ok) throw new Error(`Health check failed: ${response.status}`)
  const data = await response.json()
  if (data.status !== 'ok') throw new Error('Health check returned invalid status')
}

async function testStaticAssets() {
  const assets = [
    '/favicon.ico',
    '/manifest.json',
    '/robots.txt',
    '/sitemap.xml',
  ]
  
  for (const asset of assets) {
    const response = await fetch(`${APP_URL}${asset}`)
    if (!response.ok) throw new Error(`Asset ${asset} not found`)
  }
}

async function testAPIEndpoints() {
  // Test CORS headers
  const response = await fetch(`${APP_URL}/api/health`, {
    headers: {
      'Origin': 'https://example.com'
    }
  })
  
  const headers = response.headers
  if (!headers.get('x-content-type-options')) {
    throw new Error('Security headers not set')
  }
}

async function testDatabase() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('Supabase environment variables not set')
  }
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
  
  // Test database connection
  const { error } = await supabase.from('workspaces').select('count').limit(1)
  if (error) throw new Error(`Database connection failed: ${error.message}`)
}

async function testCronEndpoints() {
  const cronEndpoints = [
    '/api/cron/billing/trial',
    '/api/cron/data-retention',
    '/api/cron/lead-scoring',
    '/api/cron/workflow-execution',
    '/api/cron/email-warmup',
    '/api/cron/analytics-refresh',
    '/api/cron/cache-warming',
  ]
  
  for (const endpoint of cronEndpoints) {
    const response = await fetch(`${APP_URL}${endpoint}`)
    // Should return 401 without proper auth
    if (response.status !== 401) {
      throw new Error(`Cron endpoint ${endpoint} is not properly secured`)
    }
  }
}

async function testEmailTracking() {
  const response = await fetch(`${TRACKING_URL}/pixel/test.png`)
  // Should redirect or return an image
  if (response.status !== 200 && response.status !== 301 && response.status !== 302) {
    throw new Error(`Email tracking not working: ${response.status}`)
  }
}

async function testSSL() {
  const response = await fetch(APP_URL)
  if (!response.url.startsWith('https://')) {
    throw new Error('SSL not properly configured')
  }
}

async function testPerformance() {
  const start = Date.now()
  const response = await fetch(APP_URL)
  const duration = Date.now() - start
  
  if (duration > 2000) {
    throw new Error(`Homepage load time too slow: ${duration}ms`)
  }
  
  // Check if response is cached
  const cacheStatus = response.headers.get('x-vercel-cache')
  if (cacheStatus === 'MISS' || cacheStatus === 'STALE') {
    console.warn('Homepage not cached')
  }
}

async function runAllTests() {
  console.log('🚀 ColdCopy Deployment Verification\n')
  console.log(`App URL: ${APP_URL}`)
  console.log(`API URL: ${API_URL}`)
  console.log(`Tracking URL: ${TRACKING_URL}\n`)
  
  await runTest('Health Check', testHealthCheck)
  await runTest('Static Assets', testStaticAssets)
  await runTest('API Endpoints', testAPIEndpoints)
  await runTest('Database Connection', testDatabase)
  await runTest('Cron Endpoints Security', testCronEndpoints)
  await runTest('Email Tracking', testEmailTracking)
  await runTest('SSL Certificate', testSSL)
  await runTest('Performance', testPerformance)
  
  // Print results
  console.log('\n📊 Test Results:\n')
  
  const passed = tests.filter(t => t.status === 'pass').length
  const failed = tests.filter(t => t.status === 'fail').length
  const warned = tests.filter(t => t.status === 'warn').length
  
  tests.forEach(test => {
    const icon = test.status === 'pass' ? '✅' : test.status === 'fail' ? '❌' : '⚠️'
    const duration = test.duration ? ` (${test.duration}ms)` : ''
    console.log(`${icon} ${test.name}${duration}`)
    if (test.message) {
      console.log(`   → ${test.message}`)
    }
  })
  
  console.log('\n' + '='.repeat(50))
  console.log(`Total: ${tests.length} | ✅ Passed: ${passed} | ❌ Failed: ${failed} | ⚠️ Warnings: ${warned}`)
  
  if (failed > 0) {
    console.log('\n❌ Deployment verification failed!')
    process.exit(1)
  } else if (warned > 0) {
    console.log('\n⚠️ Deployment verified with warnings')
    process.exit(0)
  } else {
    console.log('\n✅ Deployment verified successfully!')
    process.exit(0)
  }
}

// Run tests
runAllTests().catch(error => {
  console.error('Verification script error:', error)
  process.exit(1)
})