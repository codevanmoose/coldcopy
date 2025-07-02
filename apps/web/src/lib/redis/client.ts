// Redis client with graceful fallback
let redisClient: any = null
let redisError: string | null = null

export async function getRedisClient() {
  if (redisClient) return redisClient
  if (redisError) return null

  try {
    // Check if we have Upstash credentials
    const hasUpstashConfig = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
    const hasKvUrl = !!process.env.KV_REST_API_URL
    const hasRedisUrl = !!process.env.REDIS_URL
    
    if (hasUpstashConfig) {
      const { Redis } = await import('@upstash/redis')
      redisClient = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      })
    } else if (hasKvUrl) {
      // Vercel KV integration
      const { Redis } = await import('@upstash/redis')
      redisClient = new Redis({
        url: process.env.KV_REST_API_URL!,
        token: process.env.KV_REST_API_TOKEN!,
      })
    } else if (hasRedisUrl && !process.env.REDIS_URL?.includes('localhost')) {
      // Valid Redis URL (not localhost)
      const url = new URL(process.env.REDIS_URL!)
      const token = url.password || url.username
      const restUrl = `https://${url.hostname}`
      
      const { Redis } = await import('@upstash/redis')
      redisClient = new Redis({
        url: restUrl,
        token: token,
      })
    } else {
      redisError = 'Redis not configured'
      return null
    }

    // Test the connection
    await redisClient.ping()
    console.log('✅ Redis connected successfully')
    return redisClient
    
  } catch (error: any) {
    console.log('⚠️ Redis connection failed:', error.message)
    redisError = error.message
    redisClient = null
    return null
  }
}

export async function setCache(key: string, value: any, ttlSeconds?: number) {
  const client = await getRedisClient()
  if (!client) return false
  
  try {
    if (ttlSeconds) {
      await client.set(key, JSON.stringify(value), { ex: ttlSeconds })
    } else {
      await client.set(key, JSON.stringify(value))
    }
    return true
  } catch (error) {
    console.error('Cache set error:', error)
    return false
  }
}

export async function getCache(key: string) {
  const client = await getRedisClient()
  if (!client) return null
  
  try {
    const value = await client.get(key)
    return value ? JSON.parse(value) : null
  } catch (error) {
    console.error('Cache get error:', error)
    return null
  }
}

export async function delCache(key: string) {
  const client = await getRedisClient()
  if (!client) return false
  
  try {
    await client.del(key)
    return true
  } catch (error) {
    console.error('Cache delete error:', error)
    return false
  }
}

export function isRedisConnected() {
  return redisClient !== null
}