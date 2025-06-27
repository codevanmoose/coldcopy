'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Zap, 
  BarChart3,
  Activity,
  Building,
  AlertCircle,
  ArrowRight,
  Flame
} from 'lucide-react';
import { 
  IntentDashboardMetrics, 
  BuyingSignalAlert,
  SignalType 
} from '@/lib/sales-intelligence/types';

interface IntentDashboardProps {
  workspaceId: string;
}

export function IntentDashboard({ workspaceId }: IntentDashboardProps) {
  // Fetch dashboard metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['intent-metrics', workspaceId],
    queryFn: async () => {
      const response = await fetch(`/api/sales-intelligence/metrics?workspace_id=${workspaceId}`);
      if (!response.ok) throw new Error('Failed to fetch metrics');
      return response.json() as Promise<IntentDashboardMetrics>;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch buying signal alerts
  const { data: alerts, isLoading: alertsLoading } = useQuery({
    queryKey: ['buying-signals', workspaceId],
    queryFn: async () => {
      const response = await fetch(`/api/sales-intelligence/alerts?workspace_id=${workspaceId}`);
      if (!response.ok) throw new Error('Failed to fetch alerts');
      return response.json() as Promise<BuyingSignalAlert[]>;
    },
    refetchInterval: 30000,
  });

  const signalTypeIcons: Record<SignalType, JSX.Element> = {
    website_visit: <Activity className="h-4 w-4" />,
    content_download: <BarChart3 className="h-4 w-4" />,
    competitor_research: <Target className="h-4 w-4" />,
    funding_announced: <TrendingUp className="h-4 w-4" />,
    leadership_change: <Building className="h-4 w-4" />,
    tech_stack_change: <Zap className="h-4 w-4" />,
    hiring_surge: <TrendingUp className="h-4 w-4" />,
    expansion_news: <Building className="h-4 w-4" />,
    partnership_announcement: <Building className="h-4 w-4" />,
    product_launch: <Zap className="h-4 w-4" />,
    social_engagement: <Activity className="h-4 w-4" />,
    search_intent: <Target className="h-4 w-4" />,
  };

  const getSignalColor = (strength: number): string => {
    if (strength >= 80) return 'destructive';
    if (strength >= 60) return 'default';
    return 'secondary';
  };

  const getActionColor = (action: string): string => {
    switch (action) {
      case 'reach_out_now':
        return 'text-red-500';
      case 'nurture':
        return 'text-yellow-500';
      case 'monitor':
        return 'text-blue-500';
      default:
        return 'text-gray-500';
    }
  };

  if (metricsLoading || alertsLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-20 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Hot Leads</p>
                <p className="text-3xl font-bold">{metrics?.hot_leads || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">Ready to buy</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                <Flame className="h-6 w-6 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Signals Today</p>
                <p className="text-3xl font-bold">{metrics?.total_signals_today || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">Buying signals detected</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                <Activity className="h-6 w-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Intent Score</p>
                <p className="text-3xl font-bold">{metrics?.average_intent_score || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">Out of 100</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                <Target className="h-6 w-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Trending Up</p>
                <p className="text-3xl font-bold">{metrics?.trending_companies.length || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">Companies warming up</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="alerts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="alerts">Buying Signals</TabsTrigger>
          <TabsTrigger value="distribution">Score Distribution</TabsTrigger>
          <TabsTrigger value="trending">Trending Companies</TabsTrigger>
          <TabsTrigger value="signals">Signal Types</TabsTrigger>
        </TabsList>

        {/* Buying Signal Alerts */}
        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Real-time Buying Signals</CardTitle>
              <CardDescription>
                High-priority leads showing strong buying intent
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {alerts && alerts.length > 0 ? (
                alerts.map((alert, index) => (
                  <div
                    key={index}
                    className="flex items-start justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex gap-4">
                      <div className="mt-1">
                        {signalTypeIcons[alert.signal_type]}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{alert.lead_name}</p>
                          {alert.company_name && (
                            <span className="text-sm text-muted-foreground">
                              at {alert.company_name}
                            </span>
                          )}
                          <Badge variant={getSignalColor(alert.signal_strength)}>
                            {alert.signal_strength}% strength
                          </Badge>
                        </div>
                        <p className="text-sm font-medium">{alert.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {alert.description}
                        </p>
                        <div className="flex items-center gap-4 mt-2">
                          <span className={`text-xs font-medium ${getActionColor(alert.recommended_action)}`}>
                            {alert.recommended_action.replace('_', ' ').toUpperCase()}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(alert.detected_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button className="text-primary hover:text-primary/80">
                      <ArrowRight className="h-5 w-5" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                  <p>No buying signals detected yet</p>
                  <p className="text-sm">Signals will appear here as leads engage with your content</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Score Distribution */}
        <TabsContent value="distribution">
          <Card>
            <CardHeader>
              <CardTitle>Intent Score Distribution</CardTitle>
              <CardDescription>
                How your leads are distributed across intent levels
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {metrics?.score_distribution.map((range) => (
                <div key={range.range} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{range.range}</span>
                    <span className="text-sm text-muted-foreground">
                      {range.count} leads
                    </span>
                  </div>
                  <Progress 
                    value={(range.count / (metrics.hot_leads + 100)) * 100} 
                    className="h-2"
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trending Companies */}
        <TabsContent value="trending">
          <Card>
            <CardHeader>
              <CardTitle>Trending Companies</CardTitle>
              <CardDescription>
                Companies showing increasing engagement
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {metrics?.trending_companies.map((company, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 rounded-lg border"
                  >
                    <div className="flex items-center gap-4">
                      <Building className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{company.name || company.domain}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            Score: {company.score}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {company.recent_signals} recent signals
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <TrendingUp className="h-5 w-5 text-green-500" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Signal Types */}
        <TabsContent value="signals">
          <Card>
            <CardHeader>
              <CardTitle>Top Signal Types</CardTitle>
              <CardDescription>
                Most common buying signals detected today
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {metrics?.top_signal_types.map((signal) => (
                  <div key={signal.type} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {signalTypeIcons[signal.type]}
                        <span className="text-sm font-medium">
                          {signal.type.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{signal.count}</Badge>
                        <span className="text-sm text-muted-foreground">
                          avg strength: {signal.average_strength}%
                        </span>
                      </div>
                    </div>
                    <Progress value={signal.average_strength} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}