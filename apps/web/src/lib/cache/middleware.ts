import { NextRequest, NextResponse } from 'next/server';
import { cache, cacheKeys } from './redis';

interface CacheMiddlewareOptions {
  ttl?: number;
  key?: (req: NextRequest) => string;
  condition?: (req: NextRequest) => boolean;
  varyBy?: string[]; // Headers to vary cache by
}

/**
 * Cache middleware for API routes
 */
export function withCache(options: CacheMiddlewareOptions = {}) {
  return (handler: (req: NextRequest) => Promise<NextResponse>) => {
    return async (req: NextRequest) => {
      // Check if caching should be applied
      if (options.condition && !options.condition(req)) {
        return handler(req);
      }

      // Only cache GET requests by default
      if (req.method !== 'GET') {
        return handler(req);
      }

      // Generate cache key
      const cacheKey = options.key
        ? options.key(req)
        : generateCacheKey(req, options.varyBy);

      // Try to get from cache
      const cachedResponse = await cache.get<any>(cacheKey);
      if (cachedResponse) {
        // Return cached response
        return new NextResponse(
          JSON.stringify(cachedResponse.body),
          {
            status: cachedResponse.status || 200,
            headers: {
              ...cachedResponse.headers,
              'X-Cache': 'HIT',
              'X-Cache-Key': cacheKey,
            },
          }
        );
      }

      // Execute handler
      const response = await handler(req);

      // Cache successful responses only
      if (response.status >= 200 && response.status < 300) {
        try {
          const body = await response.json();
          const cacheData = {
            body,
            status: response.status,
            headers: Object.fromEntries(response.headers.entries()),
          };

          await cache.set(cacheKey, cacheData, { ttl: options.ttl || 300 }); // 5 minutes default

          // Return response with cache headers
          return new NextResponse(JSON.stringify(body), {
            status: response.status,
            headers: {
              ...Object.fromEntries(response.headers.entries()),
              'X-Cache': 'MISS',
              'X-Cache-Key': cacheKey,
            },
          });
        } catch (error) {
          // If we can't parse the response, just return it
          return response;
        }
      }

      return response;
    };
  };
}

/**
 * Generate cache key from request
 */
function generateCacheKey(req: NextRequest, varyBy: string[] = []): string {
  const url = new URL(req.url);
  const parts = [
    'api',
    url.pathname,
    url.search,
  ];

  // Add vary headers
  varyBy.forEach(header => {
    const value = req.headers.get(header);
    if (value) {
      parts.push(`${header}:${value}`);
    }
  });

  return parts.join(':');
}

/**
 * Invalidate cache for specific patterns
 */
export async function invalidateCache(patterns: string[]): Promise<number> {
  let totalDeleted = 0;
  
  for (const pattern of patterns) {
    const deleted = await cache.deletePattern(pattern);
    totalDeleted += deleted;
  }

  return totalDeleted;
}

/**
 * Cache warming function
 */
export async function warmCache(
  requests: Array<{
    url: string;
    key: string;
    ttl?: number;
  }>
): Promise<void> {
  const promises = requests.map(async ({ url, key, ttl }) => {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        await cache.set(key, data, { ttl });
      }
    } catch (error) {
      console.error(`Failed to warm cache for ${url}:`, error);
    }
  });

  await Promise.all(promises);
}

/**
 * Cache invalidation patterns for different operations
 */
export const invalidationPatterns = {
  // Workspace changes
  workspace: (workspaceId: string) => [
    `workspace:${workspaceId}*`,
    `*:workspace:${workspaceId}:*`,
  ],

  // Lead changes
  lead: (workspaceId: string, leadId?: string) => {
    const patterns = [`leads:workspace:${workspaceId}:*`];
    if (leadId) {
      patterns.push(`lead:${leadId}*`);
      patterns.push(`analytics:lead:${leadId}:*`);
    }
    return patterns;
  },

  // Campaign changes
  campaign: (workspaceId: string, campaignId?: string) => {
    const patterns = [
      `campaigns:workspace:${workspaceId}*`,
      `analytics:workspace:${workspaceId}:*`,
    ];
    if (campaignId) {
      patterns.push(`campaign:${campaignId}*`);
      patterns.push(`analytics:campaign:${campaignId}:*`);
    }
    return patterns;
  },

  // Analytics refresh
  analytics: (workspaceId: string) => [
    `analytics:workspace:${workspaceId}:*`,
    `analytics:campaign:*`,
  ],

  // Integration changes
  integration: (workspaceId: string, integrationType: string) => [
    `${integrationType}:*`,
    `workspace:${workspaceId}:${integrationType}:*`,
  ],
};

/**
 * Response cache headers
 */
export function setCacheHeaders(
  response: NextResponse,
  maxAge: number = 300,
  sMaxAge: number = 3600,
  staleWhileRevalidate: number = 86400
): NextResponse {
  response.headers.set(
    'Cache-Control',
    `public, max-age=${maxAge}, s-maxage=${sMaxAge}, stale-while-revalidate=${staleWhileRevalidate}`
  );
  return response;
}

/**
 * Edge caching for static data
 */
export function withEdgeCache(
  handler: (req: NextRequest) => Promise<NextResponse>,
  options: {
    revalidate?: number;
    tags?: string[];
  } = {}
) {
  return async (req: NextRequest) => {
    const response = await handler(req);
    
    // Set cache headers for edge caching
    if (options.revalidate) {
      response.headers.set(
        'Cache-Control',
        `public, s-maxage=${options.revalidate}, stale-while-revalidate`
      );
    }

    // Add cache tags for targeted invalidation
    if (options.tags && options.tags.length > 0) {
      response.headers.set('Cache-Tag', options.tags.join(','));
    }

    return response;
  };
}