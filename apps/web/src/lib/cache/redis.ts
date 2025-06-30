import { Redis } from 'ioredis';
import { LRUCache } from 'lru-cache';

// Types
interface CacheOptions {
  ttl?: number; // Time to live in seconds
  refreshOnGet?: boolean; // Refresh TTL on get
  compress?: boolean; // Compress large values
}

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  hitRate: number;
}

// Redis connection configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  reconnectOnError: (err: Error) => {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      return true;
    }
    return false;
  },
};

// Create Redis client lazily
let redis: Redis | null = null;

const getRedisClient = () => {
  if (!redis) {
    // Skip Redis in build time
    if (process.env.NEXT_PHASE === 'phase-production-build' || (process.env.NODE_ENV === 'production' && !process.env.REDIS_URL)) {
      return null;
    }
    
    redis = new Redis(redisConfig);
    
    // Setup error handling
    redis.on('error', (err) => {
      console.error('Redis Client Error:', err);
      stats.errors++;
    });

    redis.on('connect', () => {
      console.log('Redis Client Connected');
    });

    redis.on('reconnecting', () => {
      console.log('Reconnecting to Redis...');
    });
  }
  return redis;
};

// In-memory LRU cache for hot data
const memoryCache = new LRUCache<string, any>({
  max: 1000, // Maximum number of items
  ttl: 1000 * 60, // 1 minute default TTL
  updateAgeOnGet: true,
  updateAgeOnHas: true,
});

// Cache statistics
const stats: CacheStats = {
  hits: 0,
  misses: 0,
  sets: 0,
  deletes: 0,
  errors: 0,
  get hitRate() {
    const total = this.hits + this.misses;
    return total > 0 ? this.hits / total : 0;
  },
};

export class CacheService {
  private static instance: CacheService;
  private defaultTTL = 3600; // 1 hour
  private compressionThreshold = 1024; // 1KB

  private constructor() {
    // Redis client is created lazily
  }

  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    try {
      // Check memory cache first
      const memValue = memoryCache.get(key);
      if (memValue !== undefined) {
        stats.hits++;
        return memValue;
      }

      // Check Redis
      const redisClient = getRedisClient();
      if (!redisClient) return null;
      
      const value = await redisClient.get(key);
      if (!value) {
        stats.misses++;
        return null;
      }

      stats.hits++;
      let parsed: T;

      // Decompress if needed
      if (value.startsWith('COMPRESSED:')) {
        const compressed = value.substring(11);
        const decompressed = await this.decompress(compressed);
        parsed = JSON.parse(decompressed);
      } else {
        parsed = JSON.parse(value);
      }

      // Store in memory cache
      memoryCache.set(key, parsed);

      // Refresh TTL if requested
      if (options?.refreshOnGet && options.ttl) {
        await redisClient.expire(key, options.ttl);
      }

      return parsed;
    } catch (error) {
      console.error('Cache get error:', error);
      stats.errors++;
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(
    key: string,
    value: T,
    options?: CacheOptions
  ): Promise<boolean> {
    try {
      const ttl = options?.ttl || this.defaultTTL;
      let serialized = JSON.stringify(value);

      // Compress if over threshold
      if (options?.compress && serialized.length > this.compressionThreshold) {
        const compressed = await this.compress(serialized);
        serialized = `COMPRESSED:${compressed}`;
      }

      // Set in Redis
      const redisClient = getRedisClient();
      if (!redisClient) {
        // If Redis is not available, only use memory cache
        memoryCache.set(key, value, { ttl: ttl * 1000 });
        return true;
      }
      
      await redisClient.setex(key, ttl, serialized);

      // Set in memory cache
      memoryCache.set(key, value, { ttl: ttl * 1000 });

      stats.sets++;
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      stats.errors++;
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string | string[]): Promise<boolean> {
    try {
      const keys = Array.isArray(key) ? key : [key];
      
      // Delete from memory cache
      keys.forEach(k => memoryCache.delete(k));

      // Delete from Redis
      const redisClient = getRedisClient();
      if (redisClient && keys.length > 0) {
        await redisClient.del(...keys);
      }

      stats.deletes += keys.length;
      return true;
    } catch (error) {
      console.error('Cache delete error:', error);
      stats.errors++;
      return false;
    }
  }

  /**
   * Delete keys by pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    try {
      const redisClient = getRedisClient();
      if (!redisClient) return 0;
      
      const keys = await redisClient.keys(pattern);
      if (keys.length === 0) return 0;

      // Delete from memory cache
      keys.forEach(k => memoryCache.delete(k));

      // Delete from Redis
      await redisClient.del(...keys);
      
      stats.deletes += keys.length;
      return keys.length;
    } catch (error) {
      console.error('Cache delete pattern error:', error);
      stats.errors++;
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      // Check memory cache first
      if (memoryCache.has(key)) {
        return true;
      }

      const redisClient = getRedisClient();
      if (!redisClient) return false;
      
      const exists = await redisClient.exists(key);
      return exists === 1;
    } catch (error) {
      console.error('Cache exists error:', error);
      stats.errors++;
      return false;
    }
  }

  /**
   * Get remaining TTL for key
   */
  async ttl(key: string): Promise<number> {
    try {
      const redisClient = getRedisClient();
      if (!redisClient) return -1;
      
      const ttl = await redisClient.ttl(key);
      return ttl;
    } catch (error) {
      console.error('Cache TTL error:', error);
      return -1;
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    try {
      memoryCache.clear();
      const redisClient = getRedisClient();
      if (redisClient) {
        await redisClient.flushdb();
      }
      console.log('Cache cleared');
    } catch (error) {
      console.error('Cache clear error:', error);
      stats.errors++;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...stats };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    stats.hits = 0;
    stats.misses = 0;
    stats.sets = 0;
    stats.deletes = 0;
    stats.errors = 0;
  }

  /**
   * Compress data
   */
  private async compress(data: string): Promise<string> {
    // Simple compression using Node.js zlib
    const { promisify } = require('util');
    const zlib = require('zlib');
    const gzip = promisify(zlib.gzip);
    
    const compressed = await gzip(data);
    return compressed.toString('base64');
  }

  /**
   * Decompress data
   */
  private async decompress(data: string): Promise<string> {
    const { promisify } = require('util');
    const zlib = require('zlib');
    const gunzip = promisify(zlib.gunzip);
    
    const buffer = Buffer.from(data, 'base64');
    const decompressed = await gunzip(buffer);
    return decompressed.toString();
  }
}

// Export singleton instance
export const cache = CacheService.getInstance();

// Cache key generators
export const cacheKeys = {
  // User and workspace
  user: (userId: string) => `user:${userId}`,
  workspace: (workspaceId: string) => `workspace:${workspaceId}`,
  workspaceMembers: (workspaceId: string) => `workspace:${workspaceId}:members`,
  
  // Leads
  lead: (leadId: string) => `lead:${leadId}`,
  leadsByWorkspace: (workspaceId: string, page: number = 1) => 
    `leads:workspace:${workspaceId}:page:${page}`,
  leadEnrichment: (leadId: string) => `lead:${leadId}:enrichment`,
  
  // Campaigns
  campaign: (campaignId: string) => `campaign:${campaignId}`,
  campaignsByWorkspace: (workspaceId: string) => `campaigns:workspace:${workspaceId}`,
  campaignPerformance: (campaignId: string) => `campaign:${campaignId}:performance`,
  
  // Analytics
  workspaceAnalytics: (workspaceId: string, period: string) => 
    `analytics:workspace:${workspaceId}:${period}`,
  campaignAnalytics: (campaignId: string, period: string) => 
    `analytics:campaign:${campaignId}:${period}`,
  leadEngagement: (leadId: string) => `analytics:lead:${leadId}:engagement`,
  
  // AI and suggestions
  aiResponse: (prompt: string, model: string) => 
    `ai:${model}:${Buffer.from(prompt).toString('base64').substring(0, 32)}`,
  smartReply: (messageId: string) => `smart-reply:${messageId}`,
  
  // Integrations
  linkedinProfile: (profileId: string) => `linkedin:profile:${profileId}`,
  twitterProfile: (profileId: string) => `twitter:profile:${profileId}`,
  hubspotContact: (contactId: string) => `hubspot:contact:${contactId}`,
  
  // Email deliverability
  domainReputation: (domain: string) => `deliverability:domain:${domain}`,
  spamScore: (contentHash: string) => `deliverability:spam:${contentHash}`,
  deliverabilityMetrics: (workspaceId: string) => `deliverability:metrics:${workspaceId}`,
  
  // Sales intelligence
  intentSignals: (workspaceId: string, leadId: string) => 
    `intent:${workspaceId}:${leadId}`,
  websiteVisitors: (workspaceId: string, date: string) => 
    `visitors:${workspaceId}:${date}`,
};

// Cache decorators for methods
export function Cacheable(options?: CacheOptions) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // Generate cache key based on method name and arguments
      const cacheKey = `method:${target.constructor.name}:${propertyKey}:${JSON.stringify(args)}`;
      
      // Try to get from cache
      const cached = await cache.get(cacheKey, options);
      if (cached !== null) {
        return cached;
      }

      // Execute original method
      const result = await originalMethod.apply(this, args);
      
      // Cache the result
      if (result !== null && result !== undefined) {
        await cache.set(cacheKey, result, options);
      }

      return result;
    };

    return descriptor;
  };
}

// Cache invalidation helper
export function InvalidateCache(patterns: string[]) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // Execute original method
      const result = await originalMethod.apply(this, args);
      
      // Invalidate cache patterns
      for (const pattern of patterns) {
        await cache.deletePattern(pattern);
      }

      return result;
    };

    return descriptor;
  };
}