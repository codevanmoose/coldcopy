import Redis from 'ioredis'
import { compress, decompress } from 'lz-string'

interface CacheOptions {
  ttl?: number // Time to live in seconds
  compress?: boolean // Whether to compress large values
  namespace?: string // Cache namespace
}

interface CacheStats {
  hits: number
  misses: number
  hitRate: number
  totalKeys: number
  memoryUsage: string
}

export class RedisManager {
  private client: Redis | null = null
  private isConnected = false
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private stats = { hits: 0, misses: 0 }

  constructor(private config: {
    url?: string
    host?: string
    port?: number
    password?: string
    db?: number
    maxRetries?: number
    retryDelayMs?: number
  } = {}) {}

  async connect(): Promise<void> {
    if (this.isConnected) return

    try {
      if (this.config.url) {
        this.client = new Redis(this.config.url)
      } else {
        this.client = new Redis({
          host: this.config.host || 'localhost',
          port: this.config.port || 6379,
          password: this.config.password,
          db: this.config.db || 0,
          retryStrategy: (times) => {
            if (times > this.maxReconnectAttempts) {
              return null // Stop retrying
            }
            return Math.min(times * 1000, 5000)
          }
        })
      }

      this.client.on('error', (err) => {
        console.error('Redis Client Error:', err)
        this.isConnected = false
      })

      this.client.on('connect', () => {
        console.log('Connected to Redis')
        this.isConnected = true
        this.reconnectAttempts = 0
      })

      this.client.on('reconnecting', () => {
        console.log('Reconnecting to Redis...')
        this.reconnectAttempts++
      })

      // ioredis connects automatically, no need to call connect()
    } catch (error) {
      console.error('Failed to connect to Redis:', error)
      throw error
    }
  }

  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.quit()
      this.isConnected = false
    }
  }

  private generateKey(key: string, namespace?: string): string {
    const prefix = namespace ? `${namespace}:` : 'coldcopy:'
    return `${prefix}${key}`
  }

  private shouldCompress(value: string, options: CacheOptions): boolean {
    return options.compress !== false && value.length > 1024 // Compress if > 1KB
  }

  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    if (!this.isConnected || !this.client) {
      console.warn('Redis not connected, skipping cache get')
      this.stats.misses++
      return null
    }

    try {
      const redisKey = this.generateKey(key, options.namespace)
      let value = await this.client.get(redisKey)

      if (value === null) {
        this.stats.misses++
        return null
      }

      // Check if value was compressed
      if (value.startsWith('LZ:')) {
        value = decompress(value.slice(3))
        if (!value) {
          console.error('Failed to decompress cached value')
          this.stats.misses++
          return null
        }
      }

      this.stats.hits++
      return JSON.parse(value)
    } catch (error) {
      console.error(`Redis get error for key ${key}:`, error)
      this.stats.misses++
      return null
    }
  }

  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<boolean> {
    if (!this.isConnected || !this.client) {
      console.warn('Redis not connected, skipping cache set')
      return false
    }

    try {
      const redisKey = this.generateKey(key, options.namespace)
      let serializedValue = JSON.stringify(value)

      // Compress large values
      if (this.shouldCompress(serializedValue, options)) {
        const compressed = compress(serializedValue)
        if (compressed) {
          serializedValue = `LZ:${compressed}`
        }
      }

      if (options.ttl) {
        await this.client.setEx(redisKey, options.ttl, serializedValue)
      } else {
        await this.client.set(redisKey, serializedValue)
      }

      return true
    } catch (error) {
      console.error(`Redis set error for key ${key}:`, error)
      return false
    }
  }

  async del(key: string, options: CacheOptions = {}): Promise<boolean> {
    if (!this.isConnected || !this.client) {
      return false
    }

    try {
      const redisKey = this.generateKey(key, options.namespace)
      const result = await this.client.del(redisKey)
      return result > 0
    } catch (error) {
      console.error(`Redis delete error for key ${key}:`, error)
      return false
    }
  }

  async exists(key: string, options: CacheOptions = {}): Promise<boolean> {
    if (!this.isConnected || !this.client) {
      return false
    }

    try {
      const redisKey = this.generateKey(key, options.namespace)
      const result = await this.client.exists(redisKey)
      return result > 0
    } catch (error) {
      console.error(`Redis exists error for key ${key}:`, error)
      return false
    }
  }

  async expire(key: string, ttl: number, options: CacheOptions = {}): Promise<boolean> {
    if (!this.isConnected || !this.client) {
      return false
    }

    try {
      const redisKey = this.generateKey(key, options.namespace)
      const result = await this.client.expire(redisKey, ttl)
      return result
    } catch (error) {
      console.error(`Redis expire error for key ${key}:`, error)
      return false
    }
  }

  async mget<T>(keys: string[], options: CacheOptions = {}): Promise<(T | null)[]> {
    if (!this.isConnected || !this.client || keys.length === 0) {
      return keys.map(() => null)
    }

    try {
      const redisKeys = keys.map(key => this.generateKey(key, options.namespace))
      const values = await this.client.mGet(redisKeys)

      return values.map((value, index) => {
        if (value === null) {
          this.stats.misses++
          return null
        }

        try {
          // Handle compressed values
          let processedValue = value
          if (value.startsWith('LZ:')) {
            const decompressed = decompress(value.slice(3))
            if (!decompressed) {
              this.stats.misses++
              return null
            }
            processedValue = decompressed
          }

          this.stats.hits++
          return JSON.parse(processedValue)
        } catch (error) {
          console.error(`Error parsing cached value for key ${keys[index]}:`, error)
          this.stats.misses++
          return null
        }
      })
    } catch (error) {
      console.error('Redis mget error:', error)
      return keys.map(() => {
        this.stats.misses++
        return null
      })
    }
  }

  async mset<T>(keyValuePairs: Array<[string, T]>, options: CacheOptions = {}): Promise<boolean> {
    if (!this.isConnected || !this.client || keyValuePairs.length === 0) {
      return false
    }

    try {
      const redisData: string[] = []

      for (const [key, value] of keyValuePairs) {
        const redisKey = this.generateKey(key, options.namespace)
        let serializedValue = JSON.stringify(value)

        if (this.shouldCompress(serializedValue, options)) {
          const compressed = compress(serializedValue)
          if (compressed) {
            serializedValue = `LZ:${compressed}`
          }
        }

        redisData.push(redisKey, serializedValue)
      }

      await this.client.mSet(redisData)

      // Set expiration if specified
      if (options.ttl) {
        const expirePromises = keyValuePairs.map(([key]) =>
          this.expire(key, options.ttl!, options)
        )
        await Promise.all(expirePromises)
      }

      return true
    } catch (error) {
      console.error('Redis mset error:', error)
      return false
    }
  }

  async invalidatePattern(pattern: string, options: CacheOptions = {}): Promise<number> {
    if (!this.isConnected || !this.client) {
      return 0
    }

    try {
      const redisPattern = this.generateKey(pattern, options.namespace)
      const keys = await this.client.keys(redisPattern)
      
      if (keys.length === 0) {
        return 0
      }

      const result = await this.client.del(keys)
      return result
    } catch (error) {
      console.error('Redis invalidate pattern error:', error)
      return 0
    }
  }

  async getStats(): Promise<CacheStats> {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100
      : 0

    let totalKeys = 0
    let memoryUsage = '0B'

    if (this.isConnected && this.client) {
      try {
        const info = await this.client.info('memory')
        const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/)
        if (memoryMatch) {
          memoryUsage = memoryMatch[1].trim()
        }

        totalKeys = await this.client.dbSize()
      } catch (error) {
        console.error('Error getting Redis stats:', error)
      }
    }

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: Math.round(hitRate * 100) / 100,
      totalKeys,
      memoryUsage
    }
  }

  async resetStats(): Promise<void> {
    this.stats = { hits: 0, misses: 0 }
  }

  async ping(): Promise<boolean> {
    if (!this.isConnected || !this.client) {
      return false
    }

    try {
      const result = await this.client.ping()
      return result === 'PONG'
    } catch (error) {
      console.error('Redis ping error:', error)
      return false
    }
  }

  async flushNamespace(namespace: string): Promise<boolean> {
    if (!this.isConnected || !this.client) {
      return false
    }

    try {
      const pattern = `${namespace}:*`
      const keys = await this.client.keys(pattern)
      
      if (keys.length === 0) {
        return true
      }

      await this.client.del(keys)
      return true
    } catch (error) {
      console.error('Redis flush namespace error:', error)
      return false
    }
  }

  // Health check method
  async health(): Promise<{
    connected: boolean
    latency?: number
    error?: string
  }> {
    if (!this.isConnected || !this.client) {
      return { connected: false, error: 'Not connected' }
    }

    try {
      const start = Date.now()
      await this.client.ping()
      const latency = Date.now() - start

      return { connected: true, latency }
    } catch (error) {
      return { 
        connected: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }
}

// Create singleton instance
const redisManager = new RedisManager({
  url: process.env.REDIS_URL,
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : undefined,
  password: process.env.REDIS_PASSWORD,
  db: process.env.REDIS_DB ? parseInt(process.env.REDIS_DB) : undefined,
})

// Auto-connect on startup
if (typeof window === 'undefined') { // Only on server side
  redisManager.connect().catch(console.error)
}

export default redisManager
export type { RedisManager }