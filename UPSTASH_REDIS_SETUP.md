# 🚀 Upstash Redis Setup Guide for ColdCopy

## Overview
This guide walks through setting up Upstash Redis for production caching in ColdCopy. Upstash is a serverless Redis solution that's perfect for Vercel deployments.

## Why Upstash?
- **Serverless**: Pay per request, no fixed costs
- **Global**: Edge locations for low latency
- **Vercel Integration**: One-click setup
- **Cost Effective**: Free tier includes 10,000 commands/day

## Setup Steps

### 1. Create Upstash Account
1. Go to [upstash.com](https://upstash.com)
2. Sign up with GitHub or Email
3. Verify your email

### 2. Create Redis Database
1. Click "Create Database"
2. Choose configuration:
   - **Name**: `coldcopy-production`
   - **Region**: `US-East-1` (or closest to your users)
   - **Type**: `Regional` (for production)
   - **Eviction**: Enable with `allkeys-lru`
   - **TLS**: Enabled (default)

### 3. Get Connection Details
After creation, you'll see:
```
UPSTASH_REDIS_REST_URL=https://YOUR-DATABASE.upstash.io
UPSTASH_REDIS_REST_TOKEN=YOUR-TOKEN
```

### 4. Add to Vercel Environment Variables

#### Option A: Via Vercel Dashboard
1. Go to your [Vercel project settings](https://vercel.com/vanmooseprojects/coldcopy/settings/environment-variables)
2. Add these variables:
   ```
   UPSTASH_REDIS_REST_URL=https://YOUR-DATABASE.upstash.io
   UPSTASH_REDIS_REST_TOKEN=YOUR-TOKEN
   REDIS_URL=redis://default:YOUR-TOKEN@YOUR-DATABASE.upstash.io:PORT
   ```
3. Click "Save" for each
4. Redeploy for changes to take effect

#### Option B: Via Vercel CLI
```bash
vercel env add UPSTASH_REDIS_REST_URL production
vercel env add UPSTASH_REDIS_REST_TOKEN production
vercel env add REDIS_URL production
```

#### Option C: Via Vercel Integration
1. Go to [Vercel Integrations](https://vercel.com/integrations/upstash)
2. Click "Add Integration"
3. Select your ColdCopy project
4. Authorize Upstash
5. Environment variables added automatically!

### 5. Update Code Configuration

The code is already set up to use Redis when available. The connection logic in `apps/api/services/cache/redis_cache.py` will automatically use Upstash when the environment variables are present.

### 6. Verify Connection

Create a test endpoint to verify Redis is working:

```typescript
// apps/web/src/app/api/test-redis/route.ts
import { NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

export async function GET() {
  try {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      return NextResponse.json({ 
        status: 'not_configured',
        message: 'Upstash Redis environment variables not set' 
      })
    }

    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })

    // Test write
    await redis.set('test:connection', new Date().toISOString(), { ex: 60 })
    
    // Test read
    const value = await redis.get('test:connection')
    
    // Get info
    const info = await redis.dbsize()

    return NextResponse.json({
      status: 'connected',
      testValue: value,
      dbSize: info,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: error.message
    }, { status: 500 })
  }
}
```

Visit `https://coldcopy.cc/api/test-redis` to verify connection.

## What Gets Cached

ColdCopy uses Redis for caching:

### 1. **Lead Enrichment Data** (30-day TTL)
- Company information
- Contact details  
- Technology stack
- Reduces API costs by ~80%

### 2. **AI Responses** (7-day TTL)
- Generated email content
- Smart reply suggestions
- Reduces AI API costs by ~60%

### 3. **Campaign Analytics** (5-minute TTL)
- Real-time metrics
- Aggregated stats
- Improves dashboard load time by 10x

### 4. **User Sessions** (24-hour TTL)
- Authentication tokens
- Workspace context
- Reduces database queries

### 5. **API Rate Limiting** (Rolling window)
- Request counts
- Quota tracking
- Prevents abuse

## Cost Estimation

### Upstash Pricing
- **Free Tier**: 10,000 commands/day
- **Pay as you go**: $0.2 per 100K commands

### Expected Usage (500 users)
- Lead enrichment: ~5,000 commands/day
- AI caching: ~3,000 commands/day
- Analytics: ~15,000 commands/day
- Sessions: ~10,000 commands/day
- **Total**: ~33,000 commands/day

### Monthly Cost
- First 10,000 commands: Free
- Additional 23,000 commands: ~$1.38/day
- **Total**: ~$41/month

### Cost Savings
- Lead enrichment API savings: ~$2,000/month
- AI API savings: ~$1,500/month
- Database cost reduction: ~$90/month
- **Net savings**: ~$3,549/month

## Monitoring

### Upstash Console
1. Go to [console.upstash.com](https://console.upstash.com)
2. Select your database
3. View metrics:
   - Commands per second
   - Bandwidth usage
   - Key statistics
   - Error rates

### Custom Monitoring Endpoint
```typescript
// apps/web/src/app/api/redis-stats/route.ts
export async function GET() {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  })

  const [dbSize, info] = await Promise.all([
    redis.dbsize(),
    redis.info()
  ])

  return NextResponse.json({
    dbSize,
    info,
    cacheHitRate: await calculateHitRate(redis),
    topKeys: await getTopKeys(redis)
  })
}
```

## Best Practices

### 1. **Key Naming Convention**
```
{namespace}:{type}:{identifier}
```
Examples:
- `lead:enrichment:john@example.com`
- `ai:email:workspace123:template456`
- `analytics:campaign:789:daily`

### 2. **TTL Strategy**
- Short-lived data: 5-60 minutes
- Medium-lived data: 1-7 days
- Long-lived data: 7-30 days
- Always set TTL to prevent memory bloat

### 3. **Error Handling**
```typescript
try {
  const cached = await redis.get(key)
  if (cached) return cached
} catch (error) {
  console.error('Redis error:', error)
  // Fallback to direct database/API call
}
```

### 4. **Cache Warming**
For critical data, implement cache warming:
```typescript
// Run on deployment or schedule
async function warmCache() {
  const criticalKeys = await getCriticalKeys()
  for (const key of criticalKeys) {
    await refreshCache(key)
  }
}
```

## Troubleshooting

### Connection Refused
- Check environment variables are set correctly
- Verify Upstash database is active
- Check TLS/SSL settings

### High Latency
- Use closest regional database
- Implement local caching layer
- Batch operations when possible

### Memory Issues
- Enable eviction policy
- Reduce TTL for large objects
- Monitor key sizes

### Rate Limiting
- Implement exponential backoff
- Use connection pooling
- Batch operations

## Next Steps

1. **Create Upstash account** and database
2. **Add environment variables** to Vercel
3. **Deploy** to activate Redis caching
4. **Monitor** cache hit rates and adjust TTLs
5. **Optimize** based on usage patterns

## Support Resources
- [Upstash Documentation](https://docs.upstash.com)
- [Vercel Integration Guide](https://vercel.com/docs/storage/vercel-kv)
- [Redis Best Practices](https://redis.io/docs/manual/patterns/)
- [ColdCopy Redis Implementation](./apps/api/docs/redis_caching.md)