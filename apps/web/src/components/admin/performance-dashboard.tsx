'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Activity, 
  Database, 
  Clock, 
  Zap, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  TrendingUp,
  Search,
  RefreshCw,
  Settings
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface PerformanceMetric {
  metric: string;
  value: string;
  status: 'success' | 'warning' | 'error' | 'info';
}

interface TableStat {
  tableName: string;
  rowCount: number;
  tableSize: string;
  indexSize: string;
  totalSize: string;
  lastVacuum?: string;
  lastAnalyze?: string;
  deadTuples?: number;
  liveTuples?: number;
}

interface SlowQuery {
  query: string;
  executionTime: number;
  rowCount: number;
  calls: number;
  totalTime: number;
  meanTime: number;
}

export function PerformanceDashboard() {
  const [selectedTab, setSelectedTab] = useState('overview');
  const [queryToAnalyze, setQueryToAnalyze] = useState('');
  const [refreshInterval, setRefreshInterval] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Auto-refresh setup
  useEffect(() => {
    if (refreshInterval) {
      const interval = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ['performance'] });
      }, refreshInterval * 1000);
      
      return () => clearInterval(interval);
    }
  }, [refreshInterval, queryClient]);

  // Fetch performance data
  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['performance', 'overview'],
    queryFn: () => fetchPerformanceData('overview'),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: tables, isLoading: tablesLoading } = useQuery({
    queryKey: ['performance', 'tables'],
    queryFn: () => fetchPerformanceData('tables'),
    enabled: selectedTab === 'tables',
  });

  const { data: indexes, isLoading: indexesLoading } = useQuery({
    queryKey: ['performance', 'indexes'],
    queryFn: () => fetchPerformanceData('indexes'),
    enabled: selectedTab === 'indexes',
  });

  const { data: slowQueries, isLoading: slowQueriesLoading } = useQuery({
    queryKey: ['performance', 'slow-queries'],
    queryFn: () => fetchPerformanceData('slow-queries'),
    enabled: selectedTab === 'queries',
  });

  const { data: suggestions, isLoading: suggestionsLoading } = useQuery({
    queryKey: ['performance', 'suggestions'],
    queryFn: () => fetchPerformanceData('suggestions'),
    enabled: selectedTab === 'optimization',
  });

  const { data: connections, isLoading: connectionsLoading } = useQuery({
    queryKey: ['performance', 'connections'],
    queryFn: () => fetchPerformanceData('connections'),
    enabled: selectedTab === 'connections',
  });

  // Mutations for performance actions
  const analyzeQueryMutation = useMutation({
    mutationFn: (query: string) => performanceAction('analyze', { query }),
    onSuccess: (data) => {
      toast({
        title: 'Query Analysis Complete',
        description: 'Query analysis results are ready.',
      });
    },
    onError: () => {
      toast({
        title: 'Analysis Failed',
        description: 'Failed to analyze query.',
        variant: 'destructive',
      });
    },
  });

  const vacuumMutation = useMutation({
    mutationFn: () => performanceAction('vacuum'),
    onSuccess: () => {
      toast({
        title: 'VACUUM Complete',
        description: 'Database maintenance completed successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['performance'] });
    },
    onError: () => {
      toast({
        title: 'VACUUM Failed',
        description: 'Database maintenance failed.',
        variant: 'destructive',
      });
    },
  });

  const resetStatsMutation = useMutation({
    mutationFn: () => performanceAction('reset-stats'),
    onSuccess: () => {
      toast({
        title: 'Statistics Reset',
        description: 'Query statistics have been reset.',
      });
      queryClient.invalidateQueries({ queryKey: ['performance'] });
    },
  });

  async function fetchPerformanceData(metric: string) {
    const response = await fetch(`/api/admin/performance?metric=${metric}`);
    if (!response.ok) throw new Error('Failed to fetch performance data');
    return response.json();
  }

  async function performanceAction(action: string, data?: any) {
    const response = await fetch('/api/admin/performance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...data }),
    });
    if (!response.ok) throw new Error('Performance action failed');
    return response.json();
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-600 bg-green-100';
      case 'warning': return 'text-yellow-600 bg-yellow-100';
      case 'error': return 'text-red-600 bg-red-100';
      default: return 'text-blue-600 bg-blue-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-4 w-4" />;
      case 'warning': return <AlertTriangle className="h-4 w-4" />;
      case 'error': return <XCircle className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Performance Dashboard</h2>
          <p className="text-gray-600">Monitor database performance and optimize queries</p>
        </div>
        
        <div className="flex items-center gap-2">
          <select
            value={refreshInterval || ''}
            onChange={(e) => setRefreshInterval(e.target.value ? parseInt(e.target.value) : null)}
            className="px-3 py-2 border rounded-md text-sm"
          >
            <option value="">Manual refresh</option>
            <option value="30">30 seconds</option>
            <option value="60">1 minute</option>
            <option value="300">5 minutes</option>
          </select>
          
          <Button
            variant="outline"
            size="icon"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['performance'] })}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tables">Tables</TabsTrigger>
          <TabsTrigger value="indexes">Indexes</TabsTrigger>
          <TabsTrigger value="queries">Slow Queries</TabsTrigger>
          <TabsTrigger value="optimization">Optimization</TabsTrigger>
          <TabsTrigger value="connections">Connections</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {overviewLoading ? (
            <div className="text-center py-8">Loading performance metrics...</div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {overview?.overview?.map((metric: PerformanceMetric) => (
                  <Card key={metric.metric}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">{metric.metric}</p>
                          <p className="text-2xl font-bold">{metric.value}</p>
                        </div>
                        <div className={cn('p-2 rounded-full', getStatusColor(metric.status))}>
                          {getStatusIcon(metric.status)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Database Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Total Tables:</span>
                        <span className="font-medium">{overview?.summary?.totalTables || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Active Connections:</span>
                        <span className="font-medium">{overview?.summary?.activeConnections || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Max Connections:</span>
                        <span className="font-medium">{overview?.summary?.maxConnections || 0}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Quick Actions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button
                      onClick={() => vacuumMutation.mutate()}
                      disabled={vacuumMutation.isPending}
                      className="w-full"
                    >
                      Run VACUUM ANALYZE
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => resetStatsMutation.mutate()}
                      disabled={resetStatsMutation.isPending}
                      className="w-full"
                    >
                      Reset Query Statistics
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="tables">
          <Card>
            <CardHeader>
              <CardTitle>Table Statistics</CardTitle>
              <CardDescription>Database table sizes and statistics</CardDescription>
            </CardHeader>
            <CardContent>
              {tablesLoading ? (
                <div className="text-center py-8">Loading table statistics...</div>
              ) : (
                <div className="space-y-4">
                  {tables?.tables?.map((table: TableStat) => (
                    <div key={table.tableName} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{table.tableName}</h4>
                        <Badge variant="outline">{table.totalSize}</Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                        <div>
                          <span className="block font-medium">Rows</span>
                          {table.rowCount.toLocaleString()}
                        </div>
                        <div>
                          <span className="block font-medium">Table Size</span>
                          {table.tableSize}
                        </div>
                        <div>
                          <span className="block font-medium">Index Size</span>
                          {table.indexSize}
                        </div>
                        <div>
                          <span className="block font-medium">Last Vacuum</span>
                          {table.lastVacuum ? format(new Date(table.lastVacuum), 'MMM d, HH:mm') : 'Never'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="indexes">
          <Card>
            <CardHeader>
              <CardTitle>Index Statistics</CardTitle>
              <CardDescription>Index usage and optimization recommendations</CardDescription>
            </CardHeader>
            <CardContent>
              {indexesLoading ? (
                <div className="text-center py-8">Loading index statistics...</div>
              ) : (
                <div className="space-y-6">
                  {indexes?.analysis && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">{indexes.analysis.totalIndexes}</div>
                        <div className="text-sm text-blue-600">Total Indexes</div>
                      </div>
                      <div className="text-center p-4 bg-yellow-50 rounded-lg">
                        <div className="text-2xl font-bold text-yellow-600">{indexes.analysis.unusedIndexes}</div>
                        <div className="text-sm text-yellow-600">Unused Indexes</div>
                      </div>
                      <div className="text-center p-4 bg-orange-50 rounded-lg">
                        <div className="text-2xl font-bold text-orange-600">{indexes.analysis.lowUsageIndexes}</div>
                        <div className="text-sm text-orange-600">Low Usage</div>
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-4">
                    {indexes?.analysis?.recommendations?.map((rec: any, index: number) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          <span className="font-medium">{rec.indexName}</span>
                          <Badge variant="outline">{rec.type}</Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-1">{rec.reason}</p>
                        <p className="text-sm text-gray-500">{rec.impact}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="queries">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Slow Queries</CardTitle>
                  <CardDescription>Queries taking longer than 1 second</CardDescription>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <Search className="mr-2 h-4 w-4" />
                      Analyze Query
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Query Analyzer</DialogTitle>
                      <DialogDescription>
                        Analyze a specific query for performance optimization
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <Textarea
                        value={queryToAnalyze}
                        onChange={(e) => setQueryToAnalyze(e.target.value)}
                        placeholder="Enter your SQL query here..."
                        rows={8}
                      />
                      <Button
                        onClick={() => analyzeQueryMutation.mutate(queryToAnalyze)}
                        disabled={!queryToAnalyze || analyzeQueryMutation.isPending}
                        className="w-full"
                      >
                        {analyzeQueryMutation.isPending ? 'Analyzing...' : 'Analyze Query'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {slowQueriesLoading ? (
                <div className="text-center py-8">Loading slow queries...</div>
              ) : (
                <div className="space-y-4">
                  {slowQueries?.slowQueries?.map((query: SlowQuery, index: number) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-red-500" />
                          <span className="font-medium">{query.executionTime.toFixed(2)}ms avg</span>
                        </div>
                        <Badge variant="destructive">{query.calls} calls</Badge>
                      </div>
                      <code className="text-sm bg-gray-100 p-2 rounded block mb-2 overflow-x-auto">
                        {query.query.length > 200 ? query.query.substring(0, 200) + '...' : query.query}
                      </code>
                      <div className="text-sm text-gray-600">
                        Total time: {query.totalTime.toFixed(2)}ms | Rows: {query.rowCount.toLocaleString()}
                      </div>
                    </div>
                  ))}
                  
                  {(!slowQueries?.slowQueries || slowQueries.slowQueries.length === 0) && (
                    <div className="text-center py-8 text-gray-500">
                      No slow queries found. Your database is performing well!
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="optimization">
          <Card>
            <CardHeader>
              <CardTitle>Optimization Suggestions</CardTitle>
              <CardDescription>Recommendations to improve database performance</CardDescription>
            </CardHeader>
            <CardContent>
              {suggestionsLoading ? (
                <div className="text-center py-8">Loading optimization suggestions...</div>
              ) : (
                <div className="space-y-4">
                  {suggestions?.suggestions?.map((suggestion: any, index: number) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                        <span className="font-medium">{suggestion.table}</span>
                        <Badge 
                          variant={suggestion.estimatedImprovement.includes('High') ? 'destructive' : 
                                  suggestion.estimatedImprovement.includes('Medium') ? 'default' : 'secondary'}
                        >
                          {suggestion.estimatedImprovement.split(' - ')[0]}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">{suggestion.reason}</p>
                      <p className="text-sm text-gray-500">{suggestion.estimatedImprovement}</p>
                      {suggestion.columns && (
                        <div className="mt-2">
                          <span className="text-sm font-medium">Suggested columns: </span>
                          <code className="text-sm bg-gray-100 px-1 rounded">
                            {suggestion.columns.join(', ')}
                          </code>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {(!suggestions?.suggestions || suggestions.suggestions.length === 0) && (
                    <div className="text-center py-8 text-gray-500">
                      No optimization suggestions at this time.
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="connections">
          <Card>
            <CardHeader>
              <CardTitle>Connection Pool Status</CardTitle>
              <CardDescription>Database connection monitoring and health</CardDescription>
            </CardHeader>
            <CardContent>
              {connectionsLoading ? (
                <div className="text-center py-8">Loading connection statistics...</div>
              ) : (
                <div className="space-y-6">
                  {connections?.pool && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">{connections.pool.activeConnections}</div>
                        <div className="text-sm text-blue-600">Active</div>
                      </div>
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{connections.pool.idleConnections}</div>
                        <div className="text-sm text-green-600">Idle</div>
                      </div>
                      <div className="text-center p-4 bg-yellow-50 rounded-lg">
                        <div className="text-2xl font-bold text-yellow-600">{connections.pool.waitingClients}</div>
                        <div className="text-sm text-yellow-600">Waiting</div>
                      </div>
                      <div className="text-center p-4 bg-gray-50 rounded-lg">
                        <div className="text-2xl font-bold text-gray-600">{connections.pool.maxConnections}</div>
                        <div className="text-sm text-gray-600">Max</div>
                      </div>
                    </div>
                  )}
                  
                  {connections?.analysis?.recommendations && (
                    <div className="space-y-2">
                      <h4 className="font-medium">Recommendations</h4>
                      {connections.analysis.recommendations.map((rec: string, index: number) => (
                        <div key={index} className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
                          <Activity className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                          <span className="text-sm text-blue-700">{rec}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {connections?.potentialLeaks && connections.potentialLeaks.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 text-red-600">Potential Connection Leaks</h4>
                      <div className="space-y-2">
                        {connections.potentialLeaks.map((leak: any, index: number) => (
                          <div key={index} className="border border-red-200 rounded-lg p-3 bg-red-50">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-red-700">PID {leak.pid}</span>
                              <Badge variant="destructive">{leak.duration}</Badge>
                            </div>
                            <p className="text-sm text-red-600">{leak.state}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}