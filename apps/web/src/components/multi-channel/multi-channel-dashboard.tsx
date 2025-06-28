'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
  ResponsiveContainer 
} from 'recharts'
import { 
  Mail,
  MessageSquare,
  Users,
  TrendingUp,
  Activity,
  Send,
  Reply,
  Eye,
  MousePointer,
  Phone,
  Plus,
  Settings,
  Play,
  Pause,
  RefreshCw,
  Filter,
  Download,
  Zap,
  Target,
  BarChart3,
  Calendar,
  Clock,
  CheckCircle,
  AlertTriangle,
  X as TwitterIcon,
  Linkedin,
  Smartphone
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { linkedInService } from '@/lib/integrations/linkedin/linkedin-service'
import { twitterService } from '@/lib/integrations/twitter/twitter-service'
import { smsService } from '@/lib/integrations/sms/sms-service'

interface ChannelMetrics {
  channel: 'email' | 'linkedin' | 'twitter' | 'sms'
  isConnected: boolean
  totalCampaigns: number
  activeCampaigns: number
  totalSent: number
  delivered: number
  opened: number
  clicked: number
  replied: number
  engagementRate: number
  conversionRate: number
  cost: number
  limits: {
    current: number
    daily: number
    remaining: number
  }
}

interface UnifiedCampaign {
  id: string
  name: string
  channels: string[]
  status: 'draft' | 'active' | 'paused' | 'completed'
  targetAudience: number
  totalSent: number
  engagementRate: number
  conversionRate: number
  cost: number
  startDate: Date
  endDate?: Date
  lastActivity: Date
}

interface RecentActivity {
  id: string
  type: 'sent' | 'delivered' | 'opened' | 'clicked' | 'replied' | 'connected' | 'followed'
  channel: 'email' | 'linkedin' | 'twitter' | 'sms'
  contactName?: string
  contactIdentifier: string
  campaignName: string
  timestamp: Date
  metadata?: any
}

const CHANNEL_COLORS = {
  email: '#3b82f6',
  linkedin: '#0077b5',
  twitter: '#1da1f2',
  sms: '#10b981'
}

const CHANNEL_ICONS = {
  email: Mail,
  linkedin: Linkedin,
  twitter: TwitterIcon,
  sms: Smartphone
}

export function MultiChannelDashboard() {
  const { workspace } = useAuthStore()
  const [timeRange, setTimeRange] = useState('30d')
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['email', 'linkedin', 'twitter', 'sms'])
  const [refreshKey, setRefreshKey] = useState(0)

  // Fetch channel metrics
  const { data: channelMetrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['multi-channel-metrics', workspace?.id, timeRange, refreshKey],
    queryFn: async () => {
      if (!workspace) return []
      
      // Simulate fetching metrics from different channels
      const metrics: ChannelMetrics[] = [
        {
          channel: 'email',
          isConnected: true,
          totalCampaigns: 15,
          activeCampaigns: 4,
          totalSent: 12500,
          delivered: 12100,
          opened: 3025,
          clicked: 605,
          replied: 121,
          engagementRate: 25.0,
          conversionRate: 4.8,
          cost: 125.50,
          limits: { current: 850, daily: 1000, remaining: 150 }
        },
        {
          channel: 'linkedin',
          isConnected: true,
          totalCampaigns: 8,
          activeCampaigns: 2,
          totalSent: 450,
          delivered: 445,
          opened: 312,
          clicked: 89,
          replied: 34,
          engagementRate: 69.9,
          conversionRate: 7.6,
          cost: 0,
          limits: { current: 45, daily: 50, remaining: 5 }
        },
        {
          channel: 'twitter',
          isConnected: true,
          totalCampaigns: 6,
          activeCampaigns: 1,
          totalSent: 890,
          delivered: 890,
          opened: 623,
          clicked: 156,
          replied: 45,
          engagementRate: 70.0,
          conversionRate: 5.1,
          cost: 0,
          limits: { current: 78, daily: 100, remaining: 22 }
        },
        {
          channel: 'sms',
          isConnected: false,
          totalCampaigns: 3,
          activeCampaigns: 0,
          totalSent: 1250,
          delivered: 1235,
          opened: 1180,
          clicked: 89,
          replied: 156,
          engagementRate: 95.5,
          conversionRate: 12.5,
          cost: 187.50,
          limits: { current: 0, daily: 500, remaining: 500 }
        }
      ]
      
      return metrics
    },
    enabled: !!workspace,
  })

  // Fetch unified campaigns
  const { data: unifiedCampaigns, isLoading: campaignsLoading } = useQuery({
    queryKey: ['unified-campaigns', workspace?.id, refreshKey],
    queryFn: async () => {
      if (!workspace) return []
      
      // Simulate unified campaign data
      const campaigns: UnifiedCampaign[] = [
        {
          id: '1',
          name: 'Q1 Product Launch',
          channels: ['email', 'linkedin', 'twitter'],
          status: 'active',
          targetAudience: 2500,
          totalSent: 8900,
          engagementRate: 32.5,
          conversionRate: 6.2,
          cost: 245.75,
          startDate: new Date('2024-01-15'),
          lastActivity: new Date()
        },
        {
          id: '2',
          name: 'Enterprise Outreach',
          channels: ['email', 'linkedin'],
          status: 'active',
          targetAudience: 500,
          totalSent: 1800,
          engagementRate: 45.8,
          conversionRate: 12.3,
          cost: 89.50,
          startDate: new Date('2024-01-20'),
          lastActivity: new Date()
        },
        {
          id: '3',
          name: 'SMB Holiday Campaign',
          channels: ['email', 'sms'],
          status: 'completed',
          targetAudience: 5000,
          totalSent: 12000,
          engagementRate: 28.7,
          conversionRate: 4.1,
          cost: 450.25,
          startDate: new Date('2023-12-01'),
          endDate: new Date('2023-12-31'),
          lastActivity: new Date('2023-12-31')
        }
      ]
      
      return campaigns
    },
    enabled: !!workspace,
  })

  // Fetch recent activity
  const { data: recentActivity, isLoading: activityLoading } = useQuery({
    queryKey: ['recent-activity', workspace?.id, refreshKey],
    queryFn: async () => {
      if (!workspace) return []
      
      // Simulate recent activity data
      const activities: RecentActivity[] = [
        {
          id: '1',
          type: 'replied',
          channel: 'linkedin',
          contactName: 'John Smith',
          contactIdentifier: 'john.smith@company.com',
          campaignName: 'Enterprise Outreach',
          timestamp: new Date(Date.now() - 5 * 60 * 1000)
        },
        {
          id: '2',
          type: 'clicked',
          channel: 'email',
          contactName: 'Sarah Johnson',
          contactIdentifier: 'sarah.j@startup.io',
          campaignName: 'Q1 Product Launch',
          timestamp: new Date(Date.now() - 12 * 60 * 1000)
        },
        {
          id: '3',
          type: 'connected',
          channel: 'linkedin',
          contactName: 'Mike Chen',
          contactIdentifier: 'mike.chen@tech.com',
          campaignName: 'Enterprise Outreach',
          timestamp: new Date(Date.now() - 18 * 60 * 1000)
        },
        {
          id: '4',
          type: 'opened',
          channel: 'email',
          contactName: 'Lisa Wong',
          contactIdentifier: 'l.wong@business.net',
          campaignName: 'Q1 Product Launch',
          timestamp: new Date(Date.now() - 25 * 60 * 1000)
        },
        {
          id: '5',
          type: 'followed',
          channel: 'twitter',
          contactIdentifier: '@startup_ceo',
          campaignName: 'Industry Engagement',
          timestamp: new Date(Date.now() - 35 * 60 * 1000)
        }
      ]
      
      return activities
    },
    enabled: !!workspace,
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1)
  }

  const getChannelIcon = (channel: string) => {
    const Icon = CHANNEL_ICONS[channel as keyof typeof CHANNEL_ICONS]
    return Icon ? <Icon className="h-4 w-4" /> : <Activity className="h-4 w-4" />
  }

  const getChannelColor = (channel: string) => {
    return CHANNEL_COLORS[channel as keyof typeof CHANNEL_COLORS] || '#6b7280'
  }

  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
    return `${Math.floor(diffMins / 1440)}d ago`
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'sent': return <Send className="h-3 w-3" />
      case 'delivered': return <CheckCircle className="h-3 w-3" />
      case 'opened': return <Eye className="h-3 w-3" />
      case 'clicked': return <MousePointer className="h-3 w-3" />
      case 'replied': return <Reply className="h-3 w-3" />
      case 'connected': return <Users className="h-3 w-3" />
      case 'followed': return <Plus className="h-3 w-3" />
      default: return <Activity className="h-3 w-3" />
    }
  }

  if (metricsLoading || campaignsLoading || activityLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading multi-channel dashboard...
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Target className="h-8 w-8 text-primary" />
            Multi-Channel Outreach
          </h1>
          <p className="text-muted-foreground">
            Unified dashboard for email, LinkedIn, Twitter, and SMS campaigns
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="3m">Last 3 months</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Campaign
          </Button>
        </div>
      </div>

      {/* Channel Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {channelMetrics?.map((channel) => {
          const Icon = CHANNEL_ICONS[channel.channel]
          
          return (
            <Card key={channel.channel}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium capitalize flex items-center gap-2">
                  <Icon className="h-4 w-4" style={{ color: getChannelColor(channel.channel) }} />
                  {channel.channel}
                </CardTitle>
                <Badge variant={channel.isConnected ? 'default' : 'secondary'}>
                  {channel.isConnected ? 'Connected' : 'Disconnected'}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{channel.totalSent.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  {channel.engagementRate.toFixed(1)}% engagement
                </p>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span>Daily Limit</span>
                    <span>{channel.limits.current}/{channel.limits.daily}</span>
                  </div>
                  <Progress 
                    value={(channel.limits.current / channel.limits.daily) * 100} 
                    className="h-2" 
                  />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Channel Performance Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Channel Performance</CardTitle>
                <CardDescription>Engagement rates by channel</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={channelMetrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="channel" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="engagementRate" fill="#8884d8" name="Engagement Rate %" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Recent Activity
                </CardTitle>
                <CardDescription>Latest engagement across all channels</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentActivity?.slice(0, 8).map((activity) => (
                    <div key={activity.id} className="flex items-center gap-3 text-sm">
                      <div 
                        className="p-1 rounded-full"
                        style={{ backgroundColor: `${getChannelColor(activity.channel)}20` }}
                      >
                        {getActivityIcon(activity.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">
                          {activity.contactName || activity.contactIdentifier}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {activity.type} • {activity.campaignName}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        {getChannelIcon(activity.channel)}
                        {formatTimeAgo(activity.timestamp)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Summary Metrics */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Total Outreach</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {channelMetrics?.reduce((sum, ch) => sum + ch.totalSent, 0).toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">
                  Across all channels
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Avg Engagement</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {channelMetrics?.reduce((sum, ch) => sum + ch.engagementRate, 0) / (channelMetrics?.length || 1)}%
                </div>
                <div className="text-xs text-muted-foreground">
                  Weighted average
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Total Cost</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${channelMetrics?.reduce((sum, ch) => sum + ch.cost, 0).toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground">
                  This period
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Campaigns Tab */}
        <TabsContent value="campaigns" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Unified Campaigns</h3>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Multi-Channel Campaign
            </Button>
          </div>

          <div className="grid gap-4">
            {unifiedCampaigns?.map((campaign) => (
              <Card key={campaign.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{campaign.name}</CardTitle>
                      <CardDescription>
                        {campaign.channels.length} channels • {campaign.targetAudience.toLocaleString()} contacts
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        campaign.status === 'active' ? 'default' :
                        campaign.status === 'completed' ? 'secondary' :
                        campaign.status === 'paused' ? 'destructive' : 'outline'
                      }>
                        {campaign.status}
                      </Badge>
                      <Button variant="outline" size="sm">
                        {campaign.status === 'active' ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                      </Button>
                      <Button variant="outline" size="sm">
                        <Settings className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Channels:</span>
                        <div className="flex gap-1">
                          {campaign.channels.map((channel) => (
                            <div 
                              key={channel}
                              className="p-1 rounded"
                              style={{ backgroundColor: `${getChannelColor(channel)}20` }}
                            >
                              {getChannelIcon(channel)}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Sent:</span>
                        <span className="ml-2 font-medium">{campaign.totalSent.toLocaleString()}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Cost:</span>
                        <span className="ml-2 font-medium">${campaign.cost.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm">
                        <span className="text-muted-foreground">Engagement:</span>
                        <span className="ml-2 font-medium">{campaign.engagementRate.toFixed(1)}%</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Conversion:</span>
                        <span className="ml-2 font-medium">{campaign.conversionRate.toFixed(1)}%</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Last Activity:</span>
                        <span className="ml-2 font-medium">{formatTimeAgo(campaign.lastActivity)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Channel Distribution</CardTitle>
                <CardDescription>Messages sent by channel</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={channelMetrics}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ channel, totalSent }) => `${channel}: ${totalSent}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="totalSent"
                    >
                      {channelMetrics?.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getChannelColor(entry.channel)} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Conversion Rates</CardTitle>
                <CardDescription>Conversion performance by channel</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={channelMetrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="channel" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="conversionRate" fill="#10b981" name="Conversion Rate %" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Channel Comparison Table */}
          <Card>
            <CardHeader>
              <CardTitle>Channel Performance Comparison</CardTitle>
              <CardDescription>Detailed metrics across all channels</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Channel</th>
                      <th className="text-right p-2">Sent</th>
                      <th className="text-right p-2">Delivered</th>
                      <th className="text-right p-2">Opened</th>
                      <th className="text-right p-2">Clicked</th>
                      <th className="text-right p-2">Replied</th>
                      <th className="text-right p-2">Engagement</th>
                      <th className="text-right p-2">Conversion</th>
                      <th className="text-right p-2">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {channelMetrics?.map((channel) => (
                      <tr key={channel.channel} className="border-b">
                        <td className="p-2">
                          <div className="flex items-center gap-2 capitalize">
                            {getChannelIcon(channel.channel)}
                            {channel.channel}
                          </div>
                        </td>
                        <td className="text-right p-2">{channel.totalSent.toLocaleString()}</td>
                        <td className="text-right p-2">{channel.delivered.toLocaleString()}</td>
                        <td className="text-right p-2">{channel.opened.toLocaleString()}</td>
                        <td className="text-right p-2">{channel.clicked.toLocaleString()}</td>
                        <td className="text-right p-2">{channel.replied.toLocaleString()}</td>
                        <td className="text-right p-2">{channel.engagementRate.toFixed(1)}%</td>
                        <td className="text-right p-2">{channel.conversionRate.toFixed(1)}%</td>
                        <td className="text-right p-2">${channel.cost.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Live Activity Feed</CardTitle>
              <CardDescription>Real-time engagement across all channels</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity?.map((activity) => (
                  <div key={activity.id} className="flex items-center gap-4 p-3 border rounded-lg">
                    <div 
                      className="p-2 rounded-full"
                      style={{ backgroundColor: `${getChannelColor(activity.channel)}20` }}
                    >
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">
                        {activity.contactName || activity.contactIdentifier}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {activity.type} via {activity.channel} • {activity.campaignName}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatTimeAgo(activity.timestamp)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {channelMetrics?.map((channel) => (
              <Card key={channel.channel}>
                <CardHeader>
                  <CardTitle className="capitalize flex items-center gap-2">
                    {getChannelIcon(channel.channel)}
                    {channel.channel} Settings
                  </CardTitle>
                  <CardDescription>
                    Configure {channel.channel} integration and limits
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Status</span>
                    <Badge variant={channel.isConnected ? 'default' : 'secondary'}>
                      {channel.isConnected ? 'Connected' : 'Disconnected'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Daily Limit</span>
                    <span className="text-sm font-medium">{channel.limits.daily}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1">
                      Configure
                    </Button>
                    {!channel.isConnected && (
                      <Button size="sm" className="flex-1">
                        Connect
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}