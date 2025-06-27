'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
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
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  SmilePlus,
  Frown,
  Meh,
  Activity,
  Users,
  MessageSquare,
  Loader2,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { toast } from 'sonner';
import { ConversationThread, SentimentLevel, RiskLevel } from '@/lib/sentiment-analysis/types';

interface SentimentMetrics {
  total_threads: number;
  positive_percentage: number;
  negative_percentage: number;
  at_risk_count: number;
}

interface TrendData {
  date: string;
  positive: number;
  neutral: number;
  negative: number;
  avg_score: number;
}

export function SentimentDashboard() {
  const { workspace } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<SentimentMetrics | null>(null);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [atRiskConversations, setAtRiskConversations] = useState<ConversationThread[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState('30');

  useEffect(() => {
    if (workspace?.id) {
      loadSentimentData();
    }
  }, [workspace?.id, selectedPeriod]);

  const loadSentimentData = async () => {
    if (!workspace?.id) return;

    setLoading(true);
    try {
      const response = await fetch(
        `/api/sentiment/trends?workspace_id=${workspace.id}&days=${selectedPeriod}`
      );

      if (!response.ok) {
        throw new Error('Failed to load sentiment data');
      }

      const data = await response.json();
      setMetrics(data.metrics);
      setTrends(data.trends);
      setAtRiskConversations(data.at_risk);
    } catch (error) {
      console.error('Failed to load sentiment data:', error);
      toast.error('Failed to load sentiment analysis');
    } finally {
      setLoading(false);
    }
  };

  const getSentimentIcon = (sentiment: SentimentLevel) => {
    switch (sentiment) {
      case 'very_positive':
      case 'positive':
        return <SmilePlus className="h-5 w-5 text-green-500" />;
      case 'negative':
      case 'very_negative':
        return <Frown className="h-5 w-5 text-red-500" />;
      default:
        return <Meh className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getRiskBadge = (risk: RiskLevel) => {
    const variants: Record<RiskLevel, 'default' | 'secondary' | 'destructive'> = {
      none: 'default',
      low: 'secondary',
      medium: 'secondary',
      high: 'destructive',
      critical: 'destructive',
    };

    return (
      <Badge variant={variants[risk]} className="capitalize">
        {risk}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Prepare chart data
  const sentimentDistribution = [
    {
      name: 'Positive',
      value: metrics?.positive_percentage || 0,
      color: '#10b981',
    },
    {
      name: 'Neutral',
      value: 100 - (metrics?.positive_percentage || 0) - (metrics?.negative_percentage || 0),
      color: '#6b7280',
    },
    {
      name: 'Negative',
      value: metrics?.negative_percentage || 0,
      color: '#ef4444',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Sentiment Analysis</h2>
          <p className="text-muted-foreground">
            Monitor conversation sentiment and identify at-risk relationships
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-3 py-1 border rounded-md"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
          <Button variant="outline" size="sm" onClick={loadSentimentData}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Conversations</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.total_threads || 0}</div>
            <p className="text-xs text-muted-foreground">
              Across all channels
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Positive Sentiment</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(metrics?.positive_percentage || 0).toFixed(1)}%
            </div>
            <Progress 
              value={metrics?.positive_percentage || 0} 
              className="mt-2"
              indicatorClassName="bg-green-500"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Negative Sentiment</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(metrics?.negative_percentage || 0).toFixed(1)}%
            </div>
            <Progress 
              value={metrics?.negative_percentage || 0} 
              className="mt-2"
              indicatorClassName="bg-red-500"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">At Risk</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.at_risk_count || 0}</div>
            <p className="text-xs text-muted-foreground">
              Need immediate attention
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trends">Sentiment Trends</TabsTrigger>
          <TabsTrigger value="distribution">Distribution</TabsTrigger>
          <TabsTrigger value="at-risk">At Risk</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sentiment Over Time</CardTitle>
              <CardDescription>
                Track how conversation sentiment changes over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              {trends.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="positive"
                      stackId="1"
                      stroke="#10b981"
                      fill="#10b981"
                      name="Positive"
                    />
                    <Area
                      type="monotone"
                      dataKey="neutral"
                      stackId="1"
                      stroke="#6b7280"
                      fill="#6b7280"
                      name="Neutral"
                    />
                    <Area
                      type="monotone"
                      dataKey="negative"
                      stackId="1"
                      stroke="#ef4444"
                      fill="#ef4444"
                      name="Negative"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No sentiment data available for this period
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Average Sentiment Score</CardTitle>
              <CardDescription>
                Daily average sentiment score (-1 to 1)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {trends.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis domain={[-1, 1]} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="avg_score"
                      stroke="#8884d8"
                      strokeWidth={2}
                      name="Avg Score"
                    />
                    <Line
                      type="monotone"
                      dataKey={() => 0}
                      stroke="#000"
                      strokeDasharray="5 5"
                      name="Neutral"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No trend data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="distribution" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Sentiment Distribution</CardTitle>
                <CardDescription>
                  Overall sentiment breakdown
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={sentimentDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value.toFixed(1)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {sentimentDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sentiment by Channel</CardTitle>
                <CardDescription>
                  Compare sentiment across communication channels
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Email</span>
                    <div className="flex items-center gap-2">
                      <SmilePlus className="h-4 w-4 text-green-500" />
                      <span className="text-sm">72%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">LinkedIn</span>
                    <div className="flex items-center gap-2">
                      <SmilePlus className="h-4 w-4 text-green-500" />
                      <span className="text-sm">68%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Twitter</span>
                    <div className="flex items-center gap-2">
                      <Meh className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm">54%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="at-risk" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>At-Risk Conversations</CardTitle>
              <CardDescription>
                Conversations that need immediate attention
              </CardDescription>
            </CardHeader>
            <CardContent>
              {atRiskConversations.length > 0 ? (
                <div className="space-y-4">
                  {atRiskConversations.map((thread) => (
                    <div
                      key={thread.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start gap-4">
                        <div className="mt-1">
                          {getSentimentIcon(thread.overall_sentiment || 'neutral')}
                        </div>
                        <div className="space-y-1">
                          <p className="font-medium">
                            {thread.primary_contact_name || thread.primary_contact_email || 'Unknown'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {thread.subject || 'No subject'}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{thread.channel}</span>
                            <span>•</span>
                            <span>{thread.message_count} messages</span>
                            <span>•</span>
                            <span>Score: {(thread.sentiment_score || 0).toFixed(2)}</span>
                          </div>
                          {thread.risk_factors.length > 0 && (
                            <div className="flex items-center gap-2 mt-2">
                              <AlertTriangle className="h-3 w-3 text-yellow-500" />
                              <span className="text-xs">
                                Risk factors: {thread.risk_factors.join(', ')}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getRiskBadge(thread.risk_level || 'none')}
                        <Button variant="ghost" size="sm">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p>No at-risk conversations detected</p>
                  <p className="text-sm mt-1">All conversations are healthy!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}