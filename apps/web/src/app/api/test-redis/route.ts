import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Check if Redis is configured (either Upstash REST API or standard Redis URL)
    const hasUpstashConfig = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
    const hasRedisUrl = !!process.env.REDIS_URL
    
    if (!hasUpstashConfig && !hasRedisUrl) {
      return NextResponse.json({ 
        status: 'not_configured',
        message: 'Redis environment variables not set',
        requiredVars: [
          'UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN',
          'or REDIS_URL'
        ],
        docs: 'See UPSTASH_REDIS_SETUP.md for configuration instructions'
      })
    }

    // Try to import and use Upstash Redis
    try {
      const { Redis } = await import('@upstash/redis')
      
      let redis
      
      // If we have Upstash REST API credentials, use those
      if (hasUpstashConfig) {
        redis = new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL,
          token: process.env.UPSTASH_REDIS_REST_TOKEN,
        })
      } 
      // Otherwise, try to parse the REDIS_URL for Upstash
      else if (hasRedisUrl) {
        // Upstash Redis URL format: redis://default:token@endpoint.upstash.io:port
        const url = new URL(process.env.REDIS_URL!)
        const token = url.password || url.username // Token might be in password or username field
        const restUrl = `https://${url.hostname}`
        
        redis = new Redis({
          url: restUrl,
          token: token,
        })
      }

      // Test write
      const testKey = 'test:connection:' + Date.now()
      const testValue = {
        timestamp: new Date().toISOString(),
        message: 'ColdCopy Redis connection successful'
      }
      
      await redis.set(testKey, testValue, { ex: 60 }) // Expire after 60 seconds
      
      // Test read
      const retrievedValue = await redis.get(testKey)
      
      // Get database size
      const dbSize = await redis.dbsize()
      
      // Clean up test key
      await redis.del(testKey)

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
        }
      })
    } catch (redisError: any) {
      return NextResponse.json({
        status: 'connection_error',
        message: 'Failed to connect to Redis',
        error: redisError.message,
        hint: 'Check that your Upstash credentials are correct'
      }, { status: 500 })
    }
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: 'Unexpected error',
      error: error.message
    }, { status: 500 })
  }
}