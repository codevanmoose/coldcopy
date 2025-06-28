import { NextRequest, NextResponse } from 'next/server';
import { register, MetricsCollector } from '@/lib/monitoring/metrics';

export async function GET(request: NextRequest) {
  try {
    // Check for Prometheus scraping auth token
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.PROMETHEUS_AUTH_TOKEN;
    
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Update gauge metrics before export
    await updateSystemMetrics();

    // Get metrics in Prometheus format
    const metrics = await MetricsCollector.getMetrics();
    
    return new NextResponse(metrics, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Metrics export error:', error);
    return NextResponse.json(
      { error: 'Failed to export metrics' },
      { status: 500 }
    );
  }
}

/**
 * Update system gauge metrics before export
 */
async function updateSystemMetrics() {
  try {
    // Get database metrics
    const databaseMetrics = await getDatabaseMetrics();
    
    // Get cache metrics
    const cacheMetrics = await getCacheMetrics();
    
    // Get queue metrics
    const queueMetrics = await getQueueMetrics();

    // Update gauge metrics
    MetricsCollector.updateGaugeMetrics({
      databaseConnections: databaseMetrics.activeConnections,
      emailQueueSize: queueMetrics.emailQueueSize,
    });

    // Update cache metrics
    if (cacheMetrics.redis) {
      const { cacheSize } = await import('@/lib/monitoring/metrics');
      cacheSize.labels('redis').set(cacheMetrics.redis.memoryUsage);
    }

    if (cacheMetrics.memory) {
      const { cacheSize } = await import('@/lib/monitoring/metrics');
      cacheSize.labels('memory').set(cacheMetrics.memory.size);
    }

  } catch (error) {
    console.error('Failed to update system metrics:', error);
  }
}

/**
 * Get current database metrics
 */
async function getDatabaseMetrics() {
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = createClient();
    
    // Get active connections count
    const { data: connections } = await supabase
      .from('pg_stat_activity')
      .select('count(*)')
      .eq('state', 'active')
      .neq('pid', 'pg_backend_pid()');

    return {
      activeConnections: connections?.[0]?.count || 0,
    };
  } catch (error) {
    console.error('Failed to get database metrics:', error);
    return { activeConnections: 0 };
  }
}

/**
 * Get current cache metrics
 */
async function getCacheMetrics() {
  try {
    const cacheMetrics = {
      redis: null as any,
      memory: null as any,
    };

    // Get Redis metrics if available
    try {
      const { CacheService } = await import('@/lib/cache/redis');
      const stats = await CacheService.getInstance().getStats();
      cacheMetrics.redis = {
        memoryUsage: stats.memoryUsage || 0,
        keyCount: stats.keyCount || 0,
      };
    } catch (error) {
      // Redis not available
    }

    // Get memory cache metrics if available
    try {
      // This would depend on your memory cache implementation
      cacheMetrics.memory = {
        size: 0, // Placeholder
      };
    } catch (error) {
      // Memory cache not available
    }

    return cacheMetrics;
  } catch (error) {
    console.error('Failed to get cache metrics:', error);
    return { redis: null, memory: null };
  }
}

/**
 * Get current queue metrics
 */
async function getQueueMetrics() {
  try {
    // Get queue sizes
    let emailQueueSize = 0;

    try {
      const { emailQueue } = await import('@/lib/queue');
      emailQueueSize = await emailQueue.count();
    } catch (error) {
      // Queue not available
    }

    return {
      emailQueueSize,
    };
  } catch (error) {
    console.error('Failed to get queue metrics:', error);
    return { emailQueueSize: 0 };
  }
}