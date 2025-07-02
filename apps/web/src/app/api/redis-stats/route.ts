import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Check if Redis is configured
    const hasUpstashConfig = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
    const hasRedisUrl = !!process.env.REDIS_URL
    
    if (!hasUpstashConfig && !hasRedisUrl) {
      return NextResponse.json({ 
        error: 'Redis not configured',
        message: 'Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN or REDIS_URL in environment variables'
      }, { status: 503 })
    }

    const { Redis } = await import('@upstash/redis')
    let redis
    
    if (hasUpstashConfig) {
      redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    } else if (hasRedisUrl) {
      const url = new URL(process.env.REDIS_URL!)
      const token = url.password || url.username
      const restUrl = `https://${url.hostname}`
      
      redis = new Redis({
        url: restUrl,
        token: token,
      })
    }

    // Get basic stats
    const dbSize = await redis.dbsize()
    
    // Sample some keys to show cache usage
    const sampleKeys: string[] = []
    const patterns = ['lead:*', 'ai:*', 'analytics:*', 'session:*']
    
    for (const pattern of patterns) {
      try {
        // Note: SCAN is not available in Upstash free tier
        // So we'll just show the patterns we're tracking
        sampleKeys.push(pattern)
      } catch (e) {
        // Ignore scan errors
      }
    }

    // Calculate estimated memory usage and costs
    const estimatedCommands = {
      daily: dbSize * 10, // Rough estimate: 10 operations per key per day
      monthly: dbSize * 10 * 30
    }

    const estimatedCosts = {
      daily: Math.max(0, (estimatedCommands.daily - 10000) * 0.000002), // $0.2 per 100k commands
      monthly: Math.max(0, (estimatedCommands.monthly - 300000) * 0.000002)
    }

    // Cache performance metrics (if we were tracking them)
    const performanceMetrics = {
      hitRate: 'Not tracked yet', // Would need to implement hit/miss tracking
      avgLatency: 'Not tracked yet',
      peakQps: 'Not tracked yet'
    }

    return NextResponse.json({
      status: 'connected',
      stats: {
        totalKeys: dbSize,
        timestamp: new Date().toISOString()
      },
      cachePatterns: patterns.map(pattern => ({
        pattern,
        description: getPatternDescription(pattern)
      })),
      usage: {
        estimatedDailyCommands: estimatedCommands.daily,
        estimatedMonthlyCommands: estimatedCommands.monthly
      },
      costs: {
        estimatedDaily: `$${estimatedCosts.daily.toFixed(2)}`,
        estimatedMonthly: `$${estimatedCosts.monthly.toFixed(2)}`,
        freeCommandsRemaining: Math.max(0, 10000 - estimatedCommands.daily)
      },
      performance: performanceMetrics,
      recommendations: getRecommendations(dbSize, estimatedCommands.daily)
    })
  } catch (error: any) {
    return NextResponse.json({
      error: 'Failed to get Redis stats',
      message: error.message
    }, { status: 500 })
  }
}

function getPatternDescription(pattern: string): string {
  const descriptions: Record<string, string> = {
    'lead:*': 'Lead enrichment data (30-day TTL)',
    'ai:*': 'AI-generated content (7-day TTL)',
    'analytics:*': 'Campaign analytics (5-minute TTL)',
    'session:*': 'User sessions (24-hour TTL)'
  }
  return descriptions[pattern] || 'Unknown pattern'
}

function getRecommendations(totalKeys: number, dailyCommands: number): string[] {
  const recommendations = []

  if (totalKeys > 100000) {
    recommendations.push('Consider implementing key expiration for old data')
  }

  if (dailyCommands > 8000) {
    recommendations.push('Approaching free tier limit. Consider upgrading or optimizing cache usage')
  }

  if (totalKeys < 100) {
    recommendations.push('Cache is underutilized. Consider caching more data types')
  }

  if (recommendations.length === 0) {
    recommendations.push('Cache usage is optimal')
  }

  return recommendations
}