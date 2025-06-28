import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  max: number; // Maximum requests per window
  message?: string; // Custom error message
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
  keyGenerator?: (req: NextRequest) => Promise<string>; // Custom key generator
  skip?: (req: NextRequest) => Promise<boolean>; // Skip rate limiting for certain requests
}

interface RateLimitInfo {
  limit: number;
  current: number;
  remaining: number;
  resetAt: Date;
}

// Default rate limit configurations
export const RATE_LIMITS = {
  // Authentication endpoints
  auth: {
    signin: { windowMs: 15 * 60 * 1000, max: 5 }, // 5 attempts per 15 minutes
    signup: { windowMs: 60 * 60 * 1000, max: 3 }, // 3 signups per hour
    passwordReset: { windowMs: 60 * 60 * 1000, max: 3 }, // 3 resets per hour
  },
  
  // API endpoints
  api: {
    default: { windowMs: 60 * 1000, max: 100 }, // 100 requests per minute
    leads: { windowMs: 60 * 1000, max: 200 }, // 200 requests per minute
    campaigns: { windowMs: 60 * 1000, max: 50 }, // 50 requests per minute
    enrichment: { windowMs: 60 * 60 * 1000, max: 100 }, // 100 enrichments per hour
    ai: { windowMs: 60 * 1000, max: 20 }, // 20 AI requests per minute
    export: { windowMs: 60 * 60 * 1000, max: 10 }, // 10 exports per hour
    upload: { windowMs: 60 * 60 * 1000, max: 50 }, // 50 uploads per hour
  },
  
  // Webhook endpoints
  webhooks: {
    default: { windowMs: 60 * 1000, max: 1000 }, // 1000 webhook calls per minute
  },
  
  // Public endpoints
  public: {
    tracking: { windowMs: 60 * 1000, max: 10000 }, // 10k tracking events per minute
    unsubscribe: { windowMs: 60 * 60 * 1000, max: 100 }, // 100 unsubscribes per hour
  },
};

export class RateLimiter {
  private config: RateLimitConfig;
  private prefix: string;

  constructor(config: RateLimitConfig, prefix: string = 'rate_limit') {
    this.config = config;
    this.prefix = prefix;
  }

  async limit(request: NextRequest): Promise<{ 
    allowed: boolean; 
    info: RateLimitInfo;
    headers: Record<string, string>;
  }> {
    // Check if we should skip rate limiting
    if (this.config.skip && await this.config.skip(request)) {
      return {
        allowed: true,
        info: {
          limit: this.config.max,
          current: 0,
          remaining: this.config.max,
          resetAt: new Date(Date.now() + this.config.windowMs),
        },
        headers: {},
      };
    }

    // Generate rate limit key
    const key = await this.getKey(request);
    const windowStart = Math.floor(Date.now() / this.config.windowMs) * this.config.windowMs;
    const windowEnd = windowStart + this.config.windowMs;
    const storageKey = `${this.prefix}:${key}:${windowStart}`;

    // Get current count from Redis or in-memory store
    const current = await this.getCount(storageKey);
    const remaining = Math.max(0, this.config.max - current);
    const resetAt = new Date(windowEnd);

    const info: RateLimitInfo = {
      limit: this.config.max,
      current,
      remaining,
      resetAt,
    };

    const headers = {
      'X-RateLimit-Limit': String(this.config.max),
      'X-RateLimit-Remaining': String(remaining),
      'X-RateLimit-Reset': String(Math.floor(windowEnd / 1000)),
      'X-RateLimit-Reset-After': String(Math.floor((windowEnd - Date.now()) / 1000)),
    };

    // Check if limit exceeded
    if (current >= this.config.max) {
      headers['Retry-After'] = String(Math.floor((windowEnd - Date.now()) / 1000));
      return { allowed: false, info, headers };
    }

    // Increment counter
    await this.increment(storageKey, windowEnd);

    return { allowed: true, info, headers };
  }

  private async getKey(request: NextRequest): Promise<string> {
    if (this.config.keyGenerator) {
      return this.config.keyGenerator(request);
    }

    // Default key generator based on IP and user
    const ip = this.getClientIp(request);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      return `user:${user.id}`;
    }
    
    return `ip:${ip}`;
  }

  private getClientIp(request: NextRequest): string {
    // Check various headers for the real IP
    const forwardedFor = request.headers.get('x-forwarded-for');
    if (forwardedFor) {
      return forwardedFor.split(',')[0].trim();
    }

    const realIp = request.headers.get('x-real-ip');
    if (realIp) {
      return realIp;
    }

    const cfConnectingIp = request.headers.get('cf-connecting-ip');
    if (cfConnectingIp) {
      return cfConnectingIp;
    }

    // Fallback to a default
    return '127.0.0.1';
  }

  private async getCount(key: string): Promise<number> {
    // In production, this would use Redis
    // For now, using in-memory Map with Vercel KV or Edge Config
    // This is a simplified implementation
    
    // TODO: Implement with Redis or Vercel KV
    const count = globalThis.rateLimitStore?.get(key) || 0;
    return count;
  }

  private async increment(key: string, expireAt: number): Promise<void> {
    // In production, this would use Redis INCR with EXPIRE
    // For now, using in-memory Map
    
    // Initialize global store if not exists
    if (!globalThis.rateLimitStore) {
      globalThis.rateLimitStore = new Map();
    }

    const current = globalThis.rateLimitStore.get(key) || 0;
    globalThis.rateLimitStore.set(key, current + 1);

    // Set expiration
    setTimeout(() => {
      globalThis.rateLimitStore?.delete(key);
    }, expireAt - Date.now());
  }
}

// Middleware helper
export async function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig
): Promise<Response | null> {
  const limiter = new RateLimiter(config);
  const { allowed, info, headers } = await limiter.limit(request);

  if (!allowed) {
    return new Response(
      JSON.stringify({
        error: config.message || 'Too many requests',
        retryAfter: info.resetAt,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      }
    );
  }

  // Add rate limit headers to the request for the route handler
  Object.entries(headers).forEach(([key, value]) => {
    request.headers.set(key, value);
  });

  return null;
}

// Utility function to create a rate limiter for specific endpoints
export function createRateLimiter(
  endpoint: keyof typeof RATE_LIMITS.api | keyof typeof RATE_LIMITS.auth
): RateLimiter {
  const config = 
    RATE_LIMITS.api[endpoint as keyof typeof RATE_LIMITS.api] || 
    RATE_LIMITS.auth[endpoint as keyof typeof RATE_LIMITS.auth] ||
    RATE_LIMITS.api.default;
    
  return new RateLimiter(config);
}

// Declare global type for rate limit store
declare global {
  var rateLimitStore: Map<string, number> | undefined;
}