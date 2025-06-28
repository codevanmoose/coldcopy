#!/usr/bin/env tsx

/**
 * Redis Cache Testing Script
 * Tests the Redis cache implementation and performance
 */

import { Redis } from 'ioredis';
import { performance } from 'perf_hooks';

// Test configuration
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const TEST_ITERATIONS = 1000;
const TEST_DATA_SIZE = 1024; // 1KB

// Parse Redis URL
function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379'),
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    tls: parsed.protocol === 'rediss:' ? {} : undefined,
  };
}

// Create Redis client
const redisConfig = parseRedisUrl(REDIS_URL);
const redis = new Redis(redisConfig);

// Test results
interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

// Helper to run a test
async function runTest(
  name: string,
  testFn: () => Promise<void>
): Promise<void> {
  console.log(`\nRunning: ${name}`);
  const start = performance.now();
  
  try {
    await testFn();
    const duration = performance.now() - start;
    results.push({ name, passed: true, duration });
    console.log(`✅ Passed (${duration.toFixed(2)}ms)`);
  } catch (error) {
    const duration = performance.now() - start;
    results.push({ 
      name, 
      passed: false, 
      duration,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    console.log(`❌ Failed: ${error}`);
  }
}

// Test functions
async function testConnection() {
  const pong = await redis.ping();
  if (pong !== 'PONG') {
    throw new Error('Invalid ping response');
  }
}

async function testBasicOperations() {
  // SET and GET
  await redis.set('test:key', 'test-value');
  const value = await redis.get('test:key');
  if (value !== 'test-value') {
    throw new Error('GET returned wrong value');
  }
  
  // EXISTS
  const exists = await redis.exists('test:key');
  if (exists !== 1) {
    throw new Error('EXISTS returned wrong value');
  }
  
  // DEL
  await redis.del('test:key');
  const afterDel = await redis.exists('test:key');
  if (afterDel !== 0) {
    throw new Error('DEL failed');
  }
}

async function testTTL() {
  // Set with TTL
  await redis.setex('test:ttl', 2, 'expires-soon');
  
  // Check TTL
  const ttl = await redis.ttl('test:ttl');
  if (ttl <= 0 || ttl > 2) {
    throw new Error('TTL not set correctly');
  }
  
  // Wait and check expiration
  await new Promise(resolve => setTimeout(resolve, 2100));
  const expired = await redis.exists('test:ttl');
  if (expired !== 0) {
    throw new Error('Key did not expire');
  }
}

async function testDataTypes() {
  // Hash
  await redis.hset('test:hash', 'field1', 'value1', 'field2', 'value2');
  const hashValue = await redis.hget('test:hash', 'field1');
  if (hashValue !== 'value1') {
    throw new Error('Hash get failed');
  }
  
  // List
  await redis.lpush('test:list', 'item1', 'item2', 'item3');
  const listLen = await redis.llen('test:list');
  if (listLen !== 3) {
    throw new Error('List length wrong');
  }
  
  // Set
  await redis.sadd('test:set', 'member1', 'member2', 'member1');
  const setSize = await redis.scard('test:set');
  if (setSize !== 2) {
    throw new Error('Set size wrong');
  }
  
  // Cleanup
  await redis.del('test:hash', 'test:list', 'test:set');
}

async function testPipeline() {
  const pipeline = redis.pipeline();
  
  for (let i = 0; i < 100; i++) {
    pipeline.set(`test:pipeline:${i}`, `value-${i}`);
  }
  
  const results = await pipeline.exec();
  if (!results || results.length !== 100) {
    throw new Error('Pipeline execution failed');
  }
  
  // Cleanup
  const keys = [];
  for (let i = 0; i < 100; i++) {
    keys.push(`test:pipeline:${i}`);
  }
  await redis.del(...keys);
}

async function testPerformance() {
  const data = 'x'.repeat(TEST_DATA_SIZE);
  const operations = {
    set: [] as number[],
    get: [] as number[],
    del: [] as number[],
  };
  
  // Warm up
  for (let i = 0; i < 10; i++) {
    await redis.set(`warmup:${i}`, data);
    await redis.get(`warmup:${i}`);
    await redis.del(`warmup:${i}`);
  }
  
  // Test SET performance
  for (let i = 0; i < TEST_ITERATIONS; i++) {
    const start = performance.now();
    await redis.set(`perf:${i}`, data);
    operations.set.push(performance.now() - start);
  }
  
  // Test GET performance
  for (let i = 0; i < TEST_ITERATIONS; i++) {
    const start = performance.now();
    await redis.get(`perf:${i}`);
    operations.get.push(performance.now() - start);
  }
  
  // Test DEL performance
  for (let i = 0; i < TEST_ITERATIONS; i++) {
    const start = performance.now();
    await redis.del(`perf:${i}`);
    operations.del.push(performance.now() - start);
  }
  
  // Calculate statistics
  const stats = Object.entries(operations).map(([op, times]) => {
    const sorted = times.sort((a, b) => a - b);
    return {
      operation: op,
      avg: times.reduce((a, b) => a + b, 0) / times.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    };
  });
  
  console.log('\nPerformance Statistics (ms):');
  console.table(stats);
  
  // Check if performance meets targets
  const avgSet = stats.find(s => s.operation === 'set')?.avg || 0;
  const avgGet = stats.find(s => s.operation === 'get')?.avg || 0;
  
  if (avgSet > 5 || avgGet > 5) {
    throw new Error('Performance below target (>5ms average)');
  }
}

async function testMemoryUsage() {
  // Get initial memory
  const infoStart = await redis.info('memory');
  const usedStart = parseInt(infoStart.match(/used_memory:(\d+)/)?.[1] || '0');
  
  // Add 1000 keys
  for (let i = 0; i < 1000; i++) {
    await redis.set(`mem:test:${i}`, 'x'.repeat(1024)); // 1KB each
  }
  
  // Get memory after
  const infoEnd = await redis.info('memory');
  const usedEnd = parseInt(infoEnd.match(/used_memory:(\d+)/)?.[1] || '0');
  
  const memoryIncrease = usedEnd - usedStart;
  const expectedMin = 1000 * 1024; // At least 1MB
  
  console.log(`Memory increased by ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
  
  // Cleanup
  const keys = [];
  for (let i = 0; i < 1000; i++) {
    keys.push(`mem:test:${i}`);
  }
  await redis.del(...keys);
  
  if (memoryIncrease < expectedMin) {
    throw new Error('Memory usage calculation seems wrong');
  }
}

async function testConcurrency() {
  const promises = [];
  const concurrency = 100;
  
  // Concurrent writes
  for (let i = 0; i < concurrency; i++) {
    promises.push(
      redis.set(`concurrent:${i}`, `value-${i}`)
    );
  }
  
  await Promise.all(promises);
  
  // Verify all writes succeeded
  for (let i = 0; i < concurrency; i++) {
    const value = await redis.get(`concurrent:${i}`);
    if (value !== `value-${i}`) {
      throw new Error(`Concurrent write failed for key ${i}`);
    }
  }
  
  // Cleanup
  const keys = [];
  for (let i = 0; i < concurrency; i++) {
    keys.push(`concurrent:${i}`);
  }
  await redis.del(...keys);
}

// Main test runner
async function runAllTests() {
  console.log('🚀 ColdCopy Redis Cache Tests');
  console.log('============================');
  console.log(`Redis URL: ${REDIS_URL}`);
  console.log('');
  
  // Connection info
  try {
    const info = await redis.info('server');
    const version = info.match(/redis_version:(.+)/)?.[1];
    console.log(`Redis Version: ${version}`);
  } catch (error) {
    console.error('Failed to get Redis info:', error);
  }
  
  // Run tests
  await runTest('Connection Test', testConnection);
  await runTest('Basic Operations', testBasicOperations);
  await runTest('TTL Operations', testTTL);
  await runTest('Data Types', testDataTypes);
  await runTest('Pipeline Operations', testPipeline);
  await runTest('Performance Test', testPerformance);
  await runTest('Memory Usage', testMemoryUsage);
  await runTest('Concurrency Test', testConcurrency);
  
  // Summary
  console.log('\n📊 Test Summary');
  console.log('==============');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  
  console.log(`Total Tests: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏱️  Total Duration: ${totalDuration.toFixed(2)}ms`);
  
  if (failed > 0) {
    console.log('\nFailed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`- ${r.name}: ${r.error}`);
    });
  }
  
  // Cleanup and exit
  await redis.quit();
  process.exit(failed > 0 ? 1 : 0);
}

// Error handling
redis.on('error', (err) => {
  console.error('Redis Client Error:', err);
  process.exit(1);
});

// Run tests
runAllTests().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});