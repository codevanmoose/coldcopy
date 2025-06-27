'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
} from 'recharts';
import {
  Users,
  MessageSquare,
  TrendingUp,
  Eye,
  Clock,
  Target,
  Zap,
  ChevronUp,
  ChevronDown,
  MoreVertical,
  Calendar,
  Filter,
  Download,
  RefreshCw,
  Info,
  Award,
  AlertCircle,
} from 'lucide-react';
import { format, subDays, startOfWeek, endOfWeek } from 'date-fns';
import { useAuthStore } from '@/stores/auth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  EngagementMetrics,
  LinkedInProfileEngagement,
  LinkedInCampaignAnalytics,
  LinkedInEngagementPattern,
} from '@/lib/integrations/linkedin/analytics-service';

interface LinkedInAnalyticsDashboardProps {
  className?: string;
}

const ENGAGEMENT_COLORS = {
  cold: '#94a3b8',
  warm: '#fbbf24',
  hot: '#f97316',
  champion: '#22c55e',
};

const CHART_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316'];

export function LinkedInAnalyticsDashboard({ className }: LinkedInAnalyticsDashboardProps) {
  const { workspace } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState<EngagementMetrics | null>(null);
  const [topProfiles, setTopProfiles] = useState<LinkedInProfileEngagement[]>([]);
  const [campaigns, setCampaigns] = useState<LinkedInCampaignAnalytics[]>([]);
  const [patterns, setPatterns] = useState<LinkedInEngagementPattern[]>([]);
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [selectedTimeRange, setSelectedTimeRange] = useState('week');

  useEffect(() => {
    if (workspace?.id) {
      fetchAllData();
    }
  }, [workspace?.id]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchMetrics(),
        fetchTopProfiles(),
        fetchCampaigns(),
        fetchPatterns(),
        fetchHistoricalData(),
      ]);
    } catch (error) {
      console.error('Error fetching LinkedIn analytics:', error);
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const fetchMetrics = async () => {
    if (!workspace?.id) return;

    try {
      const response = await fetch(`/api/linkedin/analytics/metrics?workspace_id=${workspace.id}`);
      if (!response.ok) throw new Error('Failed to fetch metrics');
      
      const data = await response.json();
      setMetrics(data.metrics);
    } catch (error) {
      console.error('Error fetching metrics:', error);
    }
  };

  const fetchTopProfiles = async () => {
    if (!workspace?.id) return;

    try {
      const response = await fetch(
        `/api/linkedin/analytics/profiles?workspace_id=${workspace.id}&top_engaged=true&limit=5`
      );
      if (!response.ok) throw new Error('Failed to fetch profiles');
      
      const data = await response.json();
      setTopProfiles(data.profiles || []);
    } catch (error) {
      console.error('Error fetching profiles:', error);
    }
  };

  const fetchCampaigns = async () => {
    if (!workspace?.id) return;

    try {
      const response = await fetch(`/api/linkedin/analytics/campaigns?workspace_id=${workspace.id}`);
      if (!response.ok) throw new Error('Failed to fetch campaigns');
      
      const data = await response.json();
      setCampaigns(data.campaigns || []);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    }
  };

  const fetchPatterns = async () => {
    if (!workspace?.id) return;

    try {
      const response = await fetch(`/api/linkedin/analytics/patterns?workspace_id=${workspace.id}`);
      if (!response.ok) throw new Error('Failed to fetch patterns');
      
      const data = await response.json();
      setPatterns(data.patterns || []);
    } catch (error) {
      console.error('Error fetching patterns:', error);
    }
  };

  const fetchHistoricalData = async () => {
    if (!workspace?.id) return;

    // Simulate historical data for charts
    const days = selectedTimeRange === 'week' ? 7 : selectedTimeRange === 'month' ? 30 : 90;
    const data = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(new Date(), i);
      data.push({
        date: format(date, 'MMM dd'),
        messages_sent: Math.floor(Math.random() * 50) + 20,
        messages_opened: Math.floor(Math.random() * 40) + 15,
        messages_replied: Math.floor(Math.random() * 20) + 5,
        connections_made: Math.floor(Math.random() * 15) + 3,
      });
    }
    
    setHistoricalData(data);
  };

  const refreshData = async () => {
    if (!workspace?.id || refreshing) return;

    setRefreshing(true);
    try {
      // Calculate today's analytics
      await fetch('/api/linkedin/analytics/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspace.id }),
      });

      // Refresh all data
      await fetchAllData();
      toast.success('Analytics refreshed successfully');
    } catch (error) {
      console.error('Error refreshing analytics:', error);
      toast.error('Failed to refresh analytics');
    } finally {
      setRefreshing(false);
    }
  };

  const getEngagementLevelColor = (level: string) => {
    return ENGAGEMENT_COLORS[level as keyof typeof ENGAGEMENT_COLORS] || '#94a3b8';
  };

  const getPatternIcon = (type: string) => {
    switch (type) {
      case 'optimal_send_time':
        return Clock;
      case 'effective_message_length':
        return MessageSquare;
      case 'successful_sequence':
        return Target;
      case 'high_response_industry':
        return Users;
      case 'engagement_trigger':
        return Zap;
      case 'conversion_path':
        return TrendingUp;
      default:
        return Info;
    }
  };

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center p-8', className)}>
        <div className="text-center space-y-2">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">LinkedIn Analytics</h2>
          <p className="text-muted-foreground">
            Track and optimize your LinkedIn outreach performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshData}
            disabled={refreshing}
          >
            <RefreshCw className={cn('mr-2 h-4 w-4', refreshing && 'animate-spin')} />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Metrics Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Messages Sent</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.daily_messages_sent || 0}</div>
            <p className="text-xs text-muted-foreground">
              Today's outreach
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Rate</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.overall_open_rate?.toFixed(1) || 0}%
            </div>
            <Progress 
              value={metrics?.overall_open_rate || 0} 
              className="mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reply Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.overall_reply_rate?.toFixed(1) || 0}%
            </div>
            <Progress 
              value={metrics?.overall_reply_rate || 0} 
              className="mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Connections</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.daily_connections_accepted || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics?.overall_connection_rate?.toFixed(1) || 0}% acceptance rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
        <TabsList>
          <TabsTrigger value="week">Last 7 Days</TabsTrigger>
          <TabsTrigger value="month">Last 30 Days</TabsTrigger>
          <TabsTrigger value="quarter">Last 90 Days</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedTimeRange} className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Engagement Trends */}
            <Card>
              <CardHeader>
                <CardTitle>Engagement Trends</CardTitle>
                <CardDescription>
                  Message performance over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={historicalData}>
                    <defs>
                      <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorOpened" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorReplied" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="messages_sent"
                      stroke="#6366f1"
                      fillOpacity={1}
                      fill="url(#colorSent)"
                      name="Sent"
                    />
                    <Area
                      type="monotone"
                      dataKey="messages_opened"
                      stroke="#8b5cf6"
                      fillOpacity={1}
                      fill="url(#colorOpened)"
                      name="Opened"
                    />
                    <Area
                      type="monotone"
                      dataKey="messages_replied"
                      stroke="#22c55e"
                      fillOpacity={1}
                      fill="url(#colorReplied)"
                      name="Replied"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Connection Growth */}
            <Card>
              <CardHeader>
                <CardTitle>Connection Growth</CardTitle>
                <CardDescription>
                  New connections over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={historicalData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Bar dataKey="connections_made" fill="#6366f1" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Top Engaged Profiles */}
      <Card>
        <CardHeader>
          <CardTitle>Top Engaged Profiles</CardTitle>
          <CardDescription>
            Most responsive LinkedIn connections
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {topProfiles.map((profile) => (
              <div
                key={profile.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-muted/50"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{profile.profile?.name || 'Unknown'}</p>
                    <p className="text-sm text-muted-foreground">
                      {profile.profile?.headline || 'No headline'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      Score: {profile.engagement_score}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {profile.total_messages_replied} replies
                    </p>
                  </div>
                  <Badge
                    variant="secondary"
                    style={{ backgroundColor: getEngagementLevelColor(profile.engagement_level) }}
                    className="text-white"
                  >
                    {profile.engagement_level}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Engagement Patterns */}
      {patterns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Engagement Patterns</CardTitle>
            <CardDescription>
              AI-detected insights for optimization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {patterns.map((pattern, index) => {
                const Icon = getPatternIcon(pattern.pattern_type);
                
                return (
                  <Alert key={index}>
                    <Icon className="h-4 w-4" />
                    <AlertDescription>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{pattern.pattern_name}</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {pattern.pattern_description}
                          </p>
                          {pattern.recommended_action && (
                            <p className="text-sm mt-2 text-primary">
                              💡 {pattern.recommended_action}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <Badge variant="secondary">
                            {pattern.success_rate.toFixed(0)}% success
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {pattern.confidence_level.toFixed(0)}% confidence
                          </p>
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Campaign Performance */}
      {campaigns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Campaign Performance</CardTitle>
            <CardDescription>
              LinkedIn campaign metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {campaigns.slice(0, 5).map((campaign) => (
                <div
                  key={campaign.campaign_id}
                  className="flex items-center justify-between p-4 rounded-lg border"
                >
                  <div>
                    <p className="font-medium">{campaign.campaign?.name || 'Campaign'}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span>{campaign.total_messages_sent} sent</span>
                      <span>{campaign.messages_opened} opened</span>
                      <span>{campaign.messages_replied} replied</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="text-sm font-medium">
                          {campaign.reply_rate?.toFixed(1) || 0}%
                        </p>
                        <p className="text-xs text-muted-foreground">Reply Rate</p>
                      </div>
                      <div className="w-px h-8 bg-border" />
                      <div>
                        <p className="text-sm font-medium">
                          {campaign.open_rate?.toFixed(1) || 0}%
                        </p>
                        <p className="text-xs text-muted-foreground">Open Rate</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}