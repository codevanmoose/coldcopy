import { NextResponse } from 'next/server'
import { getRedisClient, setCache, getCache, delCache, isRedisConnected } from '@/lib/redis/client'

export async function GET() {
  try {
    // Try to get Redis client
    const client = await getRedisClient()
    
    if (!client) {
      // Check what configuration we have
      const hasUpstashConfig = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
      const hasKvConfig = !!process.env.KV_REST_API_URL
      const hasRedisUrl = !!process.env.REDIS_URL
      
      let message = 'Redis not configured'
      let hint = 'Configure Redis to enable caching'
      
      if (hasRedisUrl && process.env.REDIS_URL?.includes('localhost')) {
        message = 'Redis URL points to localhost'
        hint = 'Use Vercel KV integration or configure Upstash Redis'
      }
      
      return NextResponse.json({
        status: 'not_configured',
        message,
        hint,
        availableConfig: {
          upstash: hasUpstashConfig,
          vercelKv: hasKvConfig,
          redisUrl: hasRedisUrl,
          redisUrlValue: hasRedisUrl ? process.env.REDIS_URL : undefined
        },
        recommendations: [
          'Option 1: Use Vercel KV integration (easiest)',
          'Option 2: Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN',
          'Option 3: Platform works without Redis (just no caching optimization)'
        ]
      })
    }

    // Test Redis operations
    const testKey = 'test:connection:' + Date.now()
    const testValue = {
      timestamp: new Date().toISOString(),
      message: 'ColdCopy Redis connection successful'
    }
    
    // Test write
    const writeSuccess = await setCache(testKey, testValue, 60)
    if (!writeSuccess) {
      throw new Error('Failed to write to cache')
    }
    
    // Test read
    const retrievedValue = await getCache(testKey)
    
    // Test delete
    await delCache(testKey)
    
    // Get database size if possible
    let dbSize = 0
    try {
      dbSize = await client.dbsize()
    } catch (e) {
      // Some Redis providers don't support dbsize
      dbSize = -1
    }

    return NextResponse.json({
      status: 'connected',
      message: 'Redis connection successful',
      test: {
        written: testValue,
        retrieved: retrievedValue,
        match: JSON.stringify(testValue) === JSON.stringify(retrievedValue)
      },
      stats: {
        totalKeys: dbSize,
        timestamp: new Date().toISOString()
      },
      info: {
        connected: isRedisConnected(),
        provider: 'Upstash Redis'
      }
    })
    
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: 'Redis connection error',
      error: error.message,
      hint: 'Check Redis configuration and credentials'
    }, { status: 500 })
  }
}