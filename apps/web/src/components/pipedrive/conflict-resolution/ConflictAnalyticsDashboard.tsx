'use client';

import React, { useState, useEffect } from 'react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Clock,
  Brain,
  Zap,
  GitBranch,
  Activity,
  BarChart3,
  PieChartIcon,
  Calendar,
  Download,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConflictMetrics {
  period: string;
  totalConflicts: number;
  resolvedConflicts: number;
  pendingConflicts: number;
  autoResolved: number;
  manualResolved: number;
  aiResolved: number;
  avgResolutionTime: number;
  conflictsByType: Record<string, number>;
  conflictsBySeverity: Record<string, number>;
  conflictsByEntity: Record<string, number>;
  topConflictedFields: Array<{ field: string; count: number }>;
  resolutionStrategies: Record<string, number>;
  successRate: number;
  performanceTrend: Array<{
    date: string;
    conflicts: number;
    resolved: number;
    avgTime: number;
  }>;
}

interface ConflictAnalyticsDashboardProps {
  workspaceId: string;
  onRefresh?: () => void;
}

export function ConflictAnalyticsDashboard({ 
  workspaceId, 
  onRefresh 
}: ConflictAnalyticsDashboardProps) {
  const [metrics, setMetrics] = useState<ConflictMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadMetrics();
  }, [workspaceId, timeRange]);

  const loadMetrics = async () => {
    setIsLoading(true);
    try {
      // Simulate API call - replace with actual implementation
      const mockMetrics: ConflictMetrics = generateMockMetrics(timeRange);
      setMetrics(mockMetrics);
    } catch (error) {
      console.error('Failed to load metrics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    loadMetrics();
    onRefresh?.();
  };

  const handleExport = () => {
    if (!metrics) return;
    
    const csv = convertMetricsToCSV(metrics);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conflict-analytics-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading || !metrics) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const pieColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  const resolutionTrend = calculateTrend(
    metrics.performanceTrend.map(d => d.resolved)
  );

  const conflictTrend = calculateTrend(
    metrics.performanceTrend.map(d => d.conflicts)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Conflict Resolution Analytics</h2>
          <p className="text-gray-500 mt-1">
            Monitor and analyze data synchronization conflicts
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline" size="icon" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          
          <Button variant="outline" size="icon" onClick={handleExport}>
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Total Conflicts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{metrics.totalConflicts}</span>
              <div className={cn(
                "flex items-center gap-1 text-sm",
                conflictTrend > 0 ? "text-red-600" : "text-green-600"
              )}>
                {conflictTrend > 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                {Math.abs(conflictTrend)}%
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Resolution Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{metrics.successRate.toFixed(1)}%</span>
              <div className={cn(
                "flex items-center gap-1 text-sm",
                resolutionTrend > 0 ? "text-green-600" : "text-red-600"
              )}>
                {resolutionTrend > 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                {Math.abs(resolutionTrend)}%
              </div>
            </div>
            <Progress value={metrics.successRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Avg Resolution Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">
                {formatDuration(metrics.avgResolutionTime)}
              </span>
              <Clock className="h-5 w-5 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Pending Review
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{metrics.pendingConflicts}</span>
              <AlertCircle className="h-5 w-5 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="distribution">Distribution</TabsTrigger>
          <TabsTrigger value="fields">Field Analysis</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Resolution Methods</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-blue-500" />
                      <span className="text-sm">Automatic</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{metrics.autoResolved}</span>
                      <Progress 
                        value={(metrics.autoResolved / metrics.resolvedConflicts) * 100} 
                        className="w-24 h-2"
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Brain className="h-4 w-4 text-purple-500" />
                      <span className="text-sm">AI Assisted</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{metrics.aiResolved}</span>
                      <Progress 
                        value={(metrics.aiResolved / metrics.resolvedConflicts) * 100} 
                        className="w-24 h-2"
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Manual</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{metrics.manualResolved}</span>
                      <Progress 
                        value={(metrics.manualResolved / metrics.resolvedConflicts) * 100} 
                        className="w-24 h-2"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Conflict Types</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={Object.entries(metrics.conflictsByType).map(([type, count]) => ({
                        name: type,
                        value: count
                      }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {Object.entries(metrics.conflictsByType).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {Object.entries(metrics.conflictsByType).map(([type, count], index) => (
                    <div key={type} className="flex items-center gap-2 text-sm">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: pieColors[index % pieColors.length] }}
                      />
                      <span className="text-gray-600">{type}:</span>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Entity Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={Object.entries(metrics.conflictsByEntity).map(([entity, count]) => ({
                  entity,
                  conflicts: count,
                  resolved: Math.floor(count * metrics.successRate / 100)
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="entity" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="conflicts" fill="#3b82f6" name="Total Conflicts" />
                  <Bar dataKey="resolved" fill="#10b981" name="Resolved" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Conflict Trends</CardTitle>
              <CardDescription>
                Daily conflict detection and resolution trends
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={metrics.performanceTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="conflicts" 
                    stackId="1"
                    stroke="#ef4444" 
                    fill="#fca5a5" 
                    name="Conflicts Detected"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="resolved" 
                    stackId="2"
                    stroke="#10b981" 
                    fill="#86efac" 
                    name="Conflicts Resolved"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resolution Time Trend</CardTitle>
              <CardDescription>
                Average time to resolve conflicts over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={metrics.performanceTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => formatDuration(value)} />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="avgTime" 
                    stroke="#8b5cf6" 
                    strokeWidth={2}
                    name="Avg Resolution Time"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="distribution" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Severity Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={Object.entries(metrics.conflictsBySeverity).map(([severity, count]) => ({
                        name: severity,
                        value: count
                      }))}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {Object.entries(metrics.conflictsBySeverity).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={getSeverityColor(_.toString())} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Resolution Strategies</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(metrics.resolutionStrategies)
                    .sort(([, a], [, b]) => b - a)
                    .map(([strategy, count]) => (
                      <div key={strategy} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{formatStrategyName(strategy)}</span>
                          <span className="text-gray-500">{count}</span>
                        </div>
                        <Progress 
                          value={(count / metrics.resolvedConflicts) * 100} 
                          className="h-2"
                        />
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="fields" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Most Conflicted Fields</CardTitle>
              <CardDescription>
                Fields that frequently have conflicts during synchronization
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {metrics.topConflictedFields.map((field, index) => (
                  <div key={field.field} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="w-8 h-8 rounded-full p-0 flex items-center justify-center">
                        {index + 1}
                      </Badge>
                      <span className="font-medium">{field.field}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500">{field.count} conflicts</span>
                      <Progress 
                        value={(field.count / metrics.topConflictedFields[0].count) * 100} 
                        className="w-32 h-2"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Field Conflict Patterns</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={metrics.topConflictedFields.slice(0, 8).map(field => ({
                  field: field.field,
                  conflicts: field.count,
                  severity: Math.random() * 100 // This would be actual severity data
                }))}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="field" />
                  <PolarRadiusAxis />
                  <Radar 
                    name="Conflicts" 
                    dataKey="conflicts" 
                    stroke="#3b82f6" 
                    fill="#3b82f6" 
                    fillOpacity={0.6} 
                  />
                  <Radar 
                    name="Severity" 
                    dataKey="severity" 
                    stroke="#ef4444" 
                    fill="#ef4444" 
                    fillOpacity={0.6} 
                  />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">
                  Cache Hit Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">87.3%</span>
                  <Zap className="h-5 w-5 text-yellow-500" />
                </div>
                <Progress value={87.3} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">
                  Processing Speed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">145/s</span>
                  <Activity className="h-5 w-5 text-green-500" />
                </div>
                <p className="text-xs text-gray-500 mt-2">Entities per second</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">
                  Queue Size
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">1,247</span>
                  <BarChart3 className="h-5 w-5 text-blue-500" />
                </div>
                <p className="text-xs text-gray-500 mt-2">Pending items</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">System Performance Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">CPU Usage</span>
                    <span className="text-sm text-gray-500">32%</span>
                  </div>
                  <Progress value={32} />
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Memory Usage</span>
                    <span className="text-sm text-gray-500">2.4 GB / 8 GB</span>
                  </div>
                  <Progress value={30} />
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Queue Saturation</span>
                    <span className="text-sm text-gray-500">45%</span>
                  </div>
                  <Progress value={45} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Helper functions
function calculateTrend(values: number[]): number {
  if (values.length < 2) return 0;
  const recent = values.slice(-3).reduce((a, b) => a + b, 0) / 3;
  const previous = values.slice(-6, -3).reduce((a, b) => a + b, 0) / 3;
  return Math.round(((recent - previous) / previous) * 100);
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

function getSeverityColor(severity: string): string {
  switch (severity.toLowerCase()) {
    case 'critical': return '#ef4444';
    case 'high': return '#f97316';
    case 'medium': return '#f59e0b';
    case 'low': return '#3b82f6';
    default: return '#6b7280';
  }
}

function formatStrategyName(strategy: string): string {
  return strategy
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function convertMetricsToCSV(metrics: ConflictMetrics): string {
  const rows = [
    ['Metric', 'Value'],
    ['Total Conflicts', metrics.totalConflicts],
    ['Resolved Conflicts', metrics.resolvedConflicts],
    ['Pending Conflicts', metrics.pendingConflicts],
    ['Success Rate', `${metrics.successRate}%`],
    ['Average Resolution Time', formatDuration(metrics.avgResolutionTime)],
    ['Auto Resolved', metrics.autoResolved],
    ['Manual Resolved', metrics.manualResolved],
    ['AI Resolved', metrics.aiResolved],
  ];

  return rows.map(row => row.join(',')).join('\n');
}

// Mock data generator - replace with actual API implementation
function generateMockMetrics(timeRange: string): ConflictMetrics {
  const days = timeRange === '24h' ? 1 : timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
  
  const performanceTrend = Array.from({ length: days }, (_, i) => ({
    date: format(subDays(new Date(), days - i - 1), 'MMM dd'),
    conflicts: Math.floor(Math.random() * 100) + 50,
    resolved: Math.floor(Math.random() * 80) + 40,
    avgTime: Math.floor(Math.random() * 5000) + 1000
  }));

  const totalConflicts = performanceTrend.reduce((sum, d) => sum + d.conflicts, 0);
  const resolvedConflicts = performanceTrend.reduce((sum, d) => sum + d.resolved, 0);

  return {
    period: timeRange,
    totalConflicts,
    resolvedConflicts,
    pendingConflicts: totalConflicts - resolvedConflicts,
    autoResolved: Math.floor(resolvedConflicts * 0.6),
    manualResolved: Math.floor(resolvedConflicts * 0.25),
    aiResolved: Math.floor(resolvedConflicts * 0.15),
    avgResolutionTime: 3500,
    conflictsByType: {
      'Field': Math.floor(totalConflicts * 0.4),
      'Deletion': Math.floor(totalConflicts * 0.15),
      'Creation': Math.floor(totalConflicts * 0.2),
      'Relationship': Math.floor(totalConflicts * 0.15),
      'Schema': Math.floor(totalConflicts * 0.1)
    },
    conflictsBySeverity: {
      'Critical': Math.floor(totalConflicts * 0.1),
      'High': Math.floor(totalConflicts * 0.25),
      'Medium': Math.floor(totalConflicts * 0.4),
      'Low': Math.floor(totalConflicts * 0.25)
    },
    conflictsByEntity: {
      'Person': Math.floor(totalConflicts * 0.35),
      'Deal': Math.floor(totalConflicts * 0.3),
      'Organization': Math.floor(totalConflicts * 0.2),
      'Activity': Math.floor(totalConflicts * 0.15)
    },
    topConflictedFields: [
      { field: 'email', count: Math.floor(totalConflicts * 0.15) },
      { field: 'phone', count: Math.floor(totalConflicts * 0.12) },
      { field: 'name', count: Math.floor(totalConflicts * 0.1) },
      { field: 'value', count: Math.floor(totalConflicts * 0.08) },
      { field: 'stage_id', count: Math.floor(totalConflicts * 0.07) },
      { field: 'custom_field_1', count: Math.floor(totalConflicts * 0.06) },
      { field: 'owner_id', count: Math.floor(totalConflicts * 0.05) },
      { field: 'status', count: Math.floor(totalConflicts * 0.04) }
    ],
    resolutionStrategies: {
      'latest_wins': Math.floor(resolvedConflicts * 0.35),
      'pipedrive_wins': Math.floor(resolvedConflicts * 0.25),
      'field_level_merge': Math.floor(resolvedConflicts * 0.2),
      'manual': Math.floor(resolvedConflicts * 0.15),
      'ai_resolution': Math.floor(resolvedConflicts * 0.05)
    },
    successRate: (resolvedConflicts / totalConflicts) * 100,
    performanceTrend
  };
}