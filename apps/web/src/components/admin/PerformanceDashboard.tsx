'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Zap,
  Database,
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  HardDrive,
  Cpu,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { cache } from '@/lib/cache/redis';
import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/stores/auth';
import { toast } from 'sonner';

interface QueryStat {
  query: string;
  calls: number;
  total_time: number;
  mean_time: number;
  max_time: number;
}

interface TableSize {
  table_name: string;
  total_size: string;
  table_size: string;
  indexes_size: string;
  rows_estimate: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  hitRate: number;
}

export function PerformanceDashboard() {
  const { workspace } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [queryStats, setQueryStats] = useState<QueryStat[]>([]);
  const [tableSizes, setTableSizes] = useState<TableSize[]>([]);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [connectionStats, setConnectionStats] = useState<any>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const supabase = createClient();

  useEffect(() => {
    loadPerformanceData();
    const interval = setInterval(loadPerformanceData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [workspace?.id]);

  const loadPerformanceData = async () => {
    if (!workspace?.id) return;

    try {
      setLoading(true);

      // Get query statistics
      const { data: queries } = await supabase.rpc('analyze_slow_queries', {
        threshold_ms: 100,
      });
      setQueryStats(queries || []);

      // Get table sizes
      const { data: sizes } = await supabase.rpc('get_table_sizes');
      setTableSizes(sizes || []);

      // Get cache statistics
      const stats = cache.getStats();
      setCacheStats(stats);

      // Get connection statistics
      const { data: connections } = await supabase
        .from('v_connection_stats')
        .select('*')
        .single();
      setConnectionStats(connections);

      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to load performance data:', error);
      toast.error('Failed to load performance metrics');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshMaterializedViews = async () => {
    setRefreshing(true);
    try {
      await supabase.rpc('refresh_materialized_views');
      toast.success('Materialized views refreshed successfully');
      await loadPerformanceData();
    } catch (error) {
      console.error('Failed to refresh materialized views:', error);
      toast.error('Failed to refresh materialized views');
    } finally {
      setRefreshing(false);
    }
  };

  const handleClearCache = async () => {
    if (!confirm('Are you sure you want to clear all cache? This may temporarily impact performance.')) {
      return;
    }

    try {
      await cache.clear();
      cache.resetStats();
      toast.success('Cache cleared successfully');
      await loadPerformanceData();
    } catch (error) {
      console.error('Failed to clear cache:', error);
      toast.error('Failed to clear cache');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Prepare chart data
  const queryChartData = queryStats.slice(0, 10).map(q => ({
    query: q.query.substring(0, 50) + '...',
    avgTime: Math.round(q.mean_time),
    calls: q.calls,
  }));

  const tableSizeData = tableSizes.slice(0, 10).map(t => ({
    name: t.table_name.split('.')[1] || t.table_name,
    size: parseInt(t.total_size),
    rows: t.rows_estimate,
  }));

  const cacheChartData = cacheStats ? [
    { name: 'Hits', value: cacheStats.hits, color: '#10b981' },
    { name: 'Misses', value: cacheStats.misses, color: '#ef4444' },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Performance Dashboard</h2>
          <p className="text-muted-foreground">
            Monitor database queries, caching, and system performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            Last refresh: {lastRefresh.toLocaleTimeString()}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={loadPerformanceData}
            disabled={loading}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {cacheStats ? `${(cacheStats.hitRate * 100).toFixed(1)}%` : '0%'}
            </div>
            <Progress 
              value={cacheStats ? cacheStats.hitRate * 100 : 0} 
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {cacheStats?.hits || 0} hits / {cacheStats?.misses || 0} misses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Connections</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {connectionStats?.active_connections || 0} / {connectionStats?.total_connections || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {connectionStats?.idle_connections || 0} idle
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Slow Queries</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queryStats.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Queries slower than 100ms
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Database Size</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tableSizes[0]?.total_size || '0 MB'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Across {tableSizes.length} tables
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="queries" className="space-y-4">
        <TabsList>
          <TabsTrigger value="queries">Query Performance</TabsTrigger>
          <TabsTrigger value="cache">Cache Statistics</TabsTrigger>
          <TabsTrigger value="storage">Storage Usage</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
        </TabsList>

        <TabsContent value="queries" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Slowest Queries</CardTitle>
              <CardDescription>
                Top 10 queries by average execution time
              </CardDescription>
            </CardHeader>
            <CardContent>
              {queryChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={queryChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="query" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="avgTime" fill="#8884d8" name="Avg Time (ms)" />
                    <Bar dataKey="calls" fill="#82ca9d" name="Calls" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No slow queries detected
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4">
            {queryStats.slice(0, 5).map((query, index) => (
              <Card key={index}>
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <code className="text-sm bg-muted p-2 rounded flex-1 mr-4">
                        {query.query}
                      </code>
                      <Badge variant={query.mean_time > 1000 ? 'destructive' : 'secondary'}>
                        {query.mean_time.toFixed(0)}ms
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>Calls: {query.calls}</span>
                      <span>Total: {(query.total_time / 1000).toFixed(1)}s</span>
                      <span>Max: {query.max_time.toFixed(0)}ms</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="cache" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Cache Hit/Miss Ratio</CardTitle>
              </CardHeader>
              <CardContent>
                {cacheChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={cacheChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {cacheChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No cache data available
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cache Operations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Total Operations</span>
                    <span className="font-medium">
                      {cacheStats ? cacheStats.hits + cacheStats.misses + cacheStats.sets : 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Sets</span>
                    <span className="font-medium">{cacheStats?.sets || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Deletes</span>
                    <span className="font-medium">{cacheStats?.deletes || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Errors</span>
                    <Badge variant={cacheStats?.errors ? 'destructive' : 'secondary'}>
                      {cacheStats?.errors || 0}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="storage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Table Sizes</CardTitle>
              <CardDescription>
                Storage usage by table
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {tableSizes.slice(0, 10).map((table, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {table.table_name.split('.')[1] || table.table_name}
                      </span>
                      <div className="flex items-center gap-4">
                        <Badge variant="outline">{table.total_size}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {table.rows_estimate.toLocaleString()} rows
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Table: {table.table_size}</span>
                      <span>•</span>
                      <span>Indexes: {table.indexes_size}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Maintenance Actions</CardTitle>
              <CardDescription>
                Optimize database performance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">Refresh Materialized Views</h4>
                    <p className="text-sm text-muted-foreground">
                      Update pre-computed analytics data
                    </p>
                  </div>
                  <Button
                    onClick={handleRefreshMaterializedViews}
                    disabled={refreshing}
                  >
                    {refreshing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Refreshing...
                      </>
                    ) : (
                      'Refresh Views'
                    )}
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">Clear Redis Cache</h4>
                    <p className="text-sm text-muted-foreground">
                      Remove all cached data (may impact performance temporarily)
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    onClick={handleClearCache}
                  >
                    Clear Cache
                  </Button>
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Automated maintenance tasks run in the background:
                    <ul className="mt-2 space-y-1 text-sm">
                      <li>• Materialized views refresh every hour</li>
                      <li>• Old data cleanup runs weekly</li>
                      <li>• Partition creation runs monthly</li>
                      <li>• Vacuum and analyze run automatically</li>
                    </ul>
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}