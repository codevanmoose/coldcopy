import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Check environment variables
    const hasUpstashConfig = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
    const hasKvUrl = !!process.env.KV_REST_API_URL
    const hasRedisUrl = !!process.env.REDIS_URL
    
    console.log('Environment check:', { hasUpstashConfig, hasKvUrl, hasRedisUrl })
    console.log('UPSTASH_REDIS_REST_URL:', process.env.UPSTASH_REDIS_REST_URL?.substring(0, 20) + '...')
    console.log('UPSTASH_REDIS_REST_TOKEN:', process.env.UPSTASH_REDIS_REST_TOKEN?.substring(0, 10) + '...')
    
    if (!hasUpstashConfig) {
      return NextResponse.json({
        status: 'error',
        message: 'Upstash environment variables not found',
        env: {
          hasUpstashConfig,
          hasKvUrl,
          hasRedisUrl,
          url: process.env.UPSTASH_REDIS_REST_URL ? 'SET' : 'NOT SET',
          token: process.env.UPSTASH_REDIS_REST_TOKEN ? 'SET' : 'NOT SET'
        }
      })
    }
    
    // Try to create Redis client directly
    const { Redis } = await import('@upstash/redis')
    const redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
    
    console.log('Redis client created successfully')
    
    // Test ping
    const pingResult = await redisClient.ping()
    console.log('Ping result:', pingResult)
    
    // Test set/get
    const testKey = 'debug:test:' + Date.now()
    await redisClient.set(testKey, 'Hello Redis!')
    const value = await redisClient.get(testKey)
    await redisClient.del(testKey)
    
    return NextResponse.json({
      status: 'success',
      message: 'Redis connection successful',
      test: {
        ping: pingResult,
        setValue: 'Hello Redis!',
        getValue: value,
        match: value === 'Hello Redis!'
      },
      config: {
        url: process.env.UPSTASH_REDIS_REST_URL?.substring(0, 30) + '...',
        tokenLength: process.env.UPSTASH_REDIS_REST_TOKEN?.length
      }
    })
    
  } catch (error: any) {
    console.error('Redis debug error:', error)
    
    return NextResponse.json({
      status: 'error',
      message: 'Redis connection failed',
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 5),
      env: {
        hasUpstashUrl: !!process.env.UPSTASH_REDIS_REST_URL,
        hasUpstashToken: !!process.env.UPSTASH_REDIS_REST_TOKEN,
        urlPreview: process.env.UPSTASH_REDIS_REST_URL?.substring(0, 30) + '...'
      }
    }, { status: 500 })
  }
}