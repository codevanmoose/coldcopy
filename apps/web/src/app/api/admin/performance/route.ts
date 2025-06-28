import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { QueryOptimizer, PerformanceMonitor, ConnectionPoolMonitor } from '@/lib/performance/query-optimizer';

export async function GET(request: NextRequest) {
  try {
    // Check admin authentication
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if user is admin
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
    
    if (!profile || !['super_admin', 'workspace_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const { searchParams } = new URL(request.url);
    const metric = searchParams.get('metric');
    
    switch (metric) {
      case 'overview':
        return await getPerformanceOverview();
      case 'tables':
        return await getTableStats();
      case 'indexes':
        return await getIndexStats();
      case 'slow-queries':
        return await getSlowQueries(request);
      case 'suggestions':
        return await getOptimizationSuggestions();
      case 'connections':
        return await getConnectionStats();
      case 'database':
        return await getDatabaseMetrics();
      case 'trends':
        return await getPerformanceTrends(request);
      default:
        return await getPerformanceOverview();
    }
  } catch (error) {
    console.error('Performance API error:', error);
    return NextResponse.json(
      { error: 'Failed to get performance metrics' },
      { status: 500 }
    );
  }
}

async function getPerformanceOverview() {
  const supabase = createClient();
  
  // Get overview metrics
  const { data: overview } = await supabase
    .from('performance_overview')
    .select('*');
  
  // Get basic statistics
  const [tableStats, connectionStats, databaseMetrics] = await Promise.all([
    QueryOptimizer.getTableStats(),
    ConnectionPoolMonitor.getPoolStats(),
    getDatabaseMetricsData(),
  ]);
  
  return NextResponse.json({
    overview: overview || [],
    summary: {
      totalTables: tableStats.length,
      ...connectionStats,
      ...databaseMetrics,
    },
    timestamp: new Date().toISOString(),
  });
}

async function getTableStats() {
  const stats = await QueryOptimizer.getTableStats();
  
  return NextResponse.json({
    tables: stats,
    summary: {
      totalTables: stats.length,
      totalSize: stats.reduce((sum, table) => {
        // Parse size string and sum (simplified)
        return sum + parseFloat(table.totalSize.replace(/[^\d.]/g, ''));
      }, 0),
      largestTable: stats[0]?.tableName || 'N/A',
    },
    timestamp: new Date().toISOString(),
  });
}

async function getIndexStats() {
  const stats = await QueryOptimizer.getIndexStats();
  
  // Analyze index usage
  const unusedIndexes = stats.filter(idx => idx.indexScans === 0);
  const lowUsageIndexes = stats.filter(idx => idx.indexScans > 0 && idx.indexScans < 10);
  
  return NextResponse.json({
    indexes: stats,
    analysis: {
      totalIndexes: stats.length,
      unusedIndexes: unusedIndexes.length,
      lowUsageIndexes: lowUsageIndexes.length,
      recommendations: [
        ...unusedIndexes.map(idx => ({
          type: 'drop_unused',
          indexName: idx.indexName,
          tableName: idx.tableName,
          reason: 'Index has never been used',
          impact: 'Low risk - will reduce storage and improve write performance',
        })),
        ...lowUsageIndexes.map(idx => ({
          type: 'review_usage',
          indexName: idx.indexName,
          tableName: idx.tableName,
          reason: `Index used only ${idx.indexScans} times`,
          impact: 'Consider if this index is necessary',
        })),
      ],
    },
    timestamp: new Date().toISOString(),
  });
}

async function getSlowQueries(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const threshold = parseInt(searchParams.get('threshold') || '1000');
  
  const queries = await QueryOptimizer.findSlowQueries(threshold);
  
  return NextResponse.json({
    slowQueries: queries,
    analysis: {
      totalSlowQueries: queries.length,
      avgExecutionTime: queries.length > 0 
        ? queries.reduce((sum, q) => sum + q.executionTime, 0) / queries.length 
        : 0,
      recommendations: queries.slice(0, 5).map(query => ({
        query: query.query.substring(0, 100) + '...',
        executionTime: query.executionTime,
        suggestion: generateQuerySuggestion(query),
      })),
    },
    timestamp: new Date().toISOString(),
  });
}

async function getOptimizationSuggestions() {
  const suggestions = await QueryOptimizer.suggestIndexes();
  
  return NextResponse.json({
    suggestions,
    summary: {
      totalSuggestions: suggestions.length,
      highImpact: suggestions.filter(s => s.estimatedImprovement.includes('High')).length,
      mediumImpact: suggestions.filter(s => s.estimatedImprovement.includes('Medium')).length,
      lowImpact: suggestions.filter(s => s.estimatedImprovement.includes('Low')).length,
    },
    timestamp: new Date().toISOString(),
  });
}

async function getConnectionStats() {
  const [poolStats, idleConnections] = await Promise.all([
    ConnectionPoolMonitor.getPoolStats(),
    ConnectionPoolMonitor.checkConnectionLeaks(),
  ]);
  
  return NextResponse.json({
    pool: poolStats,
    potentialLeaks: idleConnections.potentialLeaks,
    analysis: {
      connectionUtilization: (poolStats.activeConnections / poolStats.maxConnections) * 100,
      healthStatus: getConnectionHealthStatus(poolStats),
      recommendations: generateConnectionRecommendations(poolStats, idleConnections),
    },
    timestamp: new Date().toISOString(),
  });
}

async function getDatabaseMetrics() {
  const metrics = await getDatabaseMetricsData();
  
  return NextResponse.json({
    metrics,
    timestamp: new Date().toISOString(),
  });
}

async function getPerformanceTrends(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const hours = parseInt(searchParams.get('hours') || '24');
  
  const supabase = createClient();
  const { data: trends } = await supabase.rpc('get_query_performance_trends', {
    hours_back: hours
  });
  
  return NextResponse.json({
    trends: trends || [],
    period: `${hours} hours`,
    timestamp: new Date().toISOString(),
  });
}

// Helper functions

async function getDatabaseMetricsData() {
  const supabase = createClient();
  const { data } = await supabase.rpc('get_database_metrics');
  return data?.[0] || {};
}

function generateQuerySuggestion(query: any): string {
  if (query.executionTime > 5000) {
    return 'Query takes over 5 seconds. Consider adding indexes or optimizing the query structure.';
  } else if (query.executionTime > 1000) {
    return 'Query takes over 1 second. Review WHERE clauses and JOIN conditions.';
  } else if (query.rowCount > 100000) {
    return 'Query returns many rows. Consider pagination or result limiting.';
  }
  return 'Consider optimizing this query for better performance.';
}

function getConnectionHealthStatus(poolStats: any): 'healthy' | 'warning' | 'critical' {
  const utilization = (poolStats.activeConnections / poolStats.maxConnections) * 100;
  
  if (utilization > 90) return 'critical';
  if (utilization > 70) return 'warning';
  return 'healthy';
}

function generateConnectionRecommendations(poolStats: any, idleConnections: any): string[] {
  const recommendations: string[] = [];
  const utilization = (poolStats.activeConnections / poolStats.maxConnections) * 100;
  
  if (utilization > 90) {
    recommendations.push('Connection pool is near capacity. Consider increasing max_connections or optimizing query performance.');
  }
  
  if (idleConnections.potentialLeaks.length > 0) {
    recommendations.push(`Found ${idleConnections.potentialLeaks.length} long-running idle connections. Check for connection leaks in your application.`);
  }
  
  if (poolStats.waitingClients > 0) {
    recommendations.push('Clients are waiting for connections. Consider connection pooling or increasing pool size.');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Connection pool is healthy.');
  }
  
  return recommendations;
}

// POST endpoint for running query analysis
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if user is admin
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
    
    if (!profile || !['super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const { query, action } = await request.json();
    
    switch (action) {
      case 'analyze':
        if (!query) {
          return NextResponse.json({ error: 'Query required' }, { status: 400 });
        }
        
        const analysis = await QueryOptimizer.analyzeQuery(query);
        return NextResponse.json({ analysis });
        
      case 'vacuum':
        // Run VACUUM ANALYZE on all tables
        const { data: vacuumResult } = await supabase.rpc('vacuum_all_tables');
        return NextResponse.json({ 
          success: true, 
          message: 'VACUUM ANALYZE completed',
          result: vacuumResult 
        });
        
      case 'reset-stats':
        // Reset pg_stat_statements
        await supabase.rpc('reset_query_stats');
        return NextResponse.json({ 
          success: true, 
          message: 'Query statistics reset' 
        });
        
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Performance action error:', error);
    return NextResponse.json(
      { error: 'Failed to execute performance action' },
      { status: 500 }
    );
  }
}