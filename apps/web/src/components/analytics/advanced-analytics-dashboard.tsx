'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DatePickerWithRange } from '@/components/ui/date-range-picker'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  ScatterChart,
  Scatter
} from 'recharts'
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Mail, 
  Target, 
  DollarSign, 
  Globe, 
  Clock, 
  Download,
  RefreshCw,
  Filter,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  Zap,
  Eye,
  MousePointer,
  Reply,
  XCircle,
  AlertTriangle,
  CheckCircle,
  Brain,
  MapPin,
  Calendar,
  Star
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { advancedAnalytics, type AnalyticsTimeRange } from '@/lib/analytics/advanced-analytics-service'
import { format, subDays, subMonths, subWeeks } from 'date-fns'

interface MetricCard {
  title: string
  value: string | number
  change: number
  changeType: 'increase' | 'decrease' | 'neutral'
  icon: React.ReactNode
  description?: string
}

interface ChartData {
  [key: string]: any
}

const COLORS = [
  '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1',
  '#d084d0', '#ffb347', '#87ceeb', '#dda0dd', '#98fb98'
]

const TIME_RANGES = [
  { label: 'Last 7 days', value: '7d', days: 7 },
  { label: 'Last 30 days', value: '30d', days: 30 },
  { label: 'Last 3 months', value: '3m', days: 90 },
  { label: 'Last 6 months', value: '6m', days: 180 },
  { label: 'Last year', value: '1y', days: 365 },
]

export function AdvancedAnalyticsDashboard() {
  const { workspace } = useAuthStore()
  const [timeRange, setTimeRange] = useState('30d')
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([])
  const [refreshKey, setRefreshKey] = useState(0)

  // Calculate date range
  const getTimeRange = (range: string): AnalyticsTimeRange => {
    const now = new Date()
    const selectedRange = TIME_RANGES.find(r => r.value === range) || TIME_RANGES[1]
    const start = subDays(now, selectedRange.days)
    
    return {
      start,
      end: now,
      period: selectedRange.days <= 7 ? 'hour' : selectedRange.days <= 30 ? 'day' : 'week'
    }
  }

  const analyticsTimeRange = getTimeRange(timeRange)

  // Fetch all analytics data
  const { data: campaignAnalytics, isLoading: campaignLoading } = useQuery({
    queryKey: ['campaign-analytics', workspace?.id, timeRange, selectedCampaigns, refreshKey],
    queryFn: () => advancedAnalytics.getCampaignAnalytics(
      workspace!.id, 
      analyticsTimeRange, 
      selectedCampaigns.length > 0 ? selectedCampaigns : undefined
    ),
    enabled: !!workspace,
  })

  const { data: leadAnalytics, isLoading: leadLoading } = useQuery({
    queryKey: ['lead-analytics', workspace?.id, timeRange, refreshKey],
    queryFn: () => advancedAnalytics.getLeadAnalytics(workspace!.id, analyticsTimeRange),
    enabled: !!workspace,
  })

  const { data: emailPerformance, isLoading: emailLoading } = useQuery({
    queryKey: ['email-performance', workspace?.id, timeRange, refreshKey],
    queryFn: () => advancedAnalytics.getEmailPerformanceAnalytics(workspace!.id, analyticsTimeRange),
    enabled: !!workspace,
  })

  const { data: revenueAnalytics, isLoading: revenueLoading } = useQuery({
    queryKey: ['revenue-analytics', workspace?.id, timeRange, refreshKey],
    queryFn: () => advancedAnalytics.getRevenueAnalytics(workspace!.id, analyticsTimeRange),
    enabled: !!workspace,
  })

  const { data: advancedMetrics, isLoading: advancedLoading } = useQuery({
    queryKey: ['advanced-metrics', workspace?.id, timeRange, refreshKey],
    queryFn: () => advancedAnalytics.getAdvancedMetrics(workspace!.id, analyticsTimeRange),
    enabled: !!workspace,
  })

  const { data: geoAnalytics, isLoading: geoLoading } = useQuery({
    queryKey: ['geo-analytics', workspace?.id, timeRange, refreshKey],
    queryFn: () => advancedAnalytics.getGeoAnalytics(workspace!.id, analyticsTimeRange),
    enabled: !!workspace,
  })

  const { data: realTimeAnalytics, isLoading: realTimeLoading } = useQuery({
    queryKey: ['realtime-analytics', workspace?.id, refreshKey],
    queryFn: () => advancedAnalytics.getRealTimeAnalytics(workspace!.id),
    enabled: !!workspace,
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1)
  }

  const handleExport = async (format: 'csv' | 'pdf' | 'xlsx') => {
    if (!workspace) return
    
    try {
      const blob = await advancedAnalytics.exportAnalytics(
        workspace.id,
        analyticsTimeRange,
        format,
        ['campaigns', 'leads', 'emails', 'revenue', 'geo']
      )
      
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `analytics-${format}-${format(new Date(), 'yyyy-MM-dd')}.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  // Calculate overview metrics
  const overviewMetrics: MetricCard[] = [
    {
      title: 'Total Campaigns',
      value: campaignAnalytics?.length || 0,
      change: 12,
      changeType: 'increase',
      icon: <Target className="h-4 w-4" />,
      description: 'Active and completed campaigns',
    },
    {
      title: 'Emails Sent',
      value: emailPerformance?.total_sent?.toLocaleString() || '0',
      change: 8.5,
      changeType: 'increase',
      icon: <Mail className="h-4 w-4" />,
      description: 'Total emails sent in period',
    },
    {
      title: 'Open Rate',
      value: `${(emailPerformance?.open_rate || 0).toFixed(1)}%`,
      change: 2.3,
      changeType: 'increase',
      icon: <Eye className="h-4 w-4" />,
      description: 'Average email open rate',
    },
    {
      title: 'Reply Rate',
      value: `${(emailPerformance?.reply_rate || 0).toFixed(1)}%`,
      change: 1.2,
      changeType: 'increase',
      icon: <Reply className="h-4 w-4" />,
      description: 'Average email reply rate',
    },
    {
      title: 'Total Revenue',
      value: `$${(revenueAnalytics?.total_revenue || 0).toLocaleString()}`,
      change: 15.7,
      changeType: 'increase',
      icon: <DollarSign className="h-4 w-4" />,
      description: 'Revenue generated from campaigns',
    },
    {
      title: 'Lead Quality Score',
      value: `${(advancedMetrics?.lead_quality_score || 0).toFixed(1)}/10`,
      change: 0.5,
      changeType: 'increase',
      icon: <Star className="h-4 w-4" />,
      description: 'AI-calculated lead quality',
    },
  ]

  const isLoading = campaignLoading || leadLoading || emailLoading || revenueLoading || advancedLoading

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading advanced analytics...
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
            <BarChart3 className="h-8 w-8 text-primary" />
            Advanced Analytics
          </h1>
          <p className="text-muted-foreground">
            Comprehensive insights and performance metrics for your campaigns
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_RANGES.map(range => (
                <SelectItem key={range.value} value={range.value}>
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          
          <Select onValueChange={handleExport}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Export" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="csv">CSV</SelectItem>
              <SelectItem value="xlsx">Excel</SelectItem>
              <SelectItem value="pdf">PDF</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Overview Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {overviewMetrics.map((metric, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
              {metric.icon}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value}</div>
              <div className="flex items-center text-xs text-muted-foreground">
                {metric.changeType === 'increase' ? (
                  <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                ) : metric.changeType === 'decrease' ? (
                  <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
                ) : null}
                <span className={
                  metric.changeType === 'increase' ? 'text-green-500' :
                  metric.changeType === 'decrease' ? 'text-red-500' : ''
                }>
                  {metric.change > 0 ? '+' : ''}{metric.change}%
                </span>
                <span className="ml-1">vs previous period</span>
              </div>
              {metric.description && (
                <p className="text-xs text-muted-foreground mt-1">{metric.description}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Real-time Metrics */}
      {realTimeAnalytics && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Real-time Activity
            </CardTitle>
            <CardDescription>Live metrics and recent events</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{realTimeAnalytics.active_campaigns}</div>
                <div className="text-sm text-muted-foreground">Active Campaigns</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{realTimeAnalytics.emails_sent_today}</div>
                <div className="text-sm text-muted-foreground">Emails Sent Today</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{realTimeAnalytics.opens_last_hour}</div>
                <div className="text-sm text-muted-foreground">Opens (Last Hour)</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{realTimeAnalytics.clicks_last_hour}</div>
                <div className="text-sm text-muted-foreground">Clicks (Last Hour)</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Analytics Tabs */}
      <Tabs defaultValue="campaigns" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="emails">Email Performance</TabsTrigger>
          <TabsTrigger value="leads">Lead Analytics</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="advanced">AI Insights</TabsTrigger>
          <TabsTrigger value="geo">Geographic</TabsTrigger>
        </TabsList>

        {/* Campaign Analytics */}
        <TabsContent value="campaigns" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Campaign Performance</CardTitle>
                <CardDescription>Open and click rates by campaign</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={campaignAnalytics?.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="campaign_name" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="open_rate" fill="#8884d8" name="Open Rate %" />
                    <Bar dataKey="click_rate" fill="#82ca9d" name="Click Rate %" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Campaign ROI</CardTitle>
                <CardDescription>Return on investment by campaign</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={campaignAnalytics?.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="campaign_name" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="roi" stroke="#8884d8" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Campaign Details</CardTitle>
              <CardDescription>Detailed performance metrics for all campaigns</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {campaignAnalytics?.slice(0, 5).map((campaign, index) => (
                  <div key={campaign.campaign_id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold">{campaign.campaign_name}</h4>
                      <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'}>
                        {campaign.status}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Sent:</span>
                        <div className="font-medium">{campaign.emails_sent.toLocaleString()}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Open Rate:</span>
                        <div className="font-medium">{campaign.open_rate.toFixed(1)}%</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Click Rate:</span>
                        <div className="font-medium">{campaign.click_rate.toFixed(1)}%</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Reply Rate:</span>
                        <div className="font-medium">{campaign.reply_rate.toFixed(1)}%</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Performance */}
        <TabsContent value="emails" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Email Funnel</CardTitle>
                <CardDescription>Email engagement funnel</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Sent</span>
                      <span>{emailPerformance?.total_sent.toLocaleString()}</span>
                    </div>
                    <Progress value={100} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Delivered</span>
                      <span>{emailPerformance?.total_delivered.toLocaleString()} ({emailPerformance?.delivery_rate.toFixed(1)}%)</span>
                    </div>
                    <Progress value={emailPerformance?.delivery_rate || 0} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Opened</span>
                      <span>{emailPerformance?.total_opened.toLocaleString()} ({emailPerformance?.open_rate.toFixed(1)}%)</span>
                    </div>
                    <Progress value={emailPerformance?.open_rate || 0} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Clicked</span>
                      <span>{emailPerformance?.total_clicked.toLocaleString()} ({emailPerformance?.click_rate.toFixed(1)}%)</span>
                    </div>
                    <Progress value={emailPerformance?.click_rate || 0} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Replied</span>
                      <span>{emailPerformance?.total_replied.toLocaleString()} ({emailPerformance?.reply_rate.toFixed(1)}%)</span>
                    </div>
                    <Progress value={emailPerformance?.reply_rate || 0} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Best Performing Subjects</CardTitle>
                <CardDescription>Top subject lines by open rate</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {emailPerformance?.subject_line_performance?.slice(0, 5).map((subject, index) => (
                    <div key={index} className="border rounded-lg p-3">
                      <div className="font-medium text-sm mb-1">{subject.subject}</div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Open Rate: {subject.open_rate.toFixed(1)}%</span>
                        <span>Sent: {subject.sent_count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Optimal Send Times</CardTitle>
              <CardDescription>Best performing days and times</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-8">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{emailPerformance?.best_sending_day}</div>
                  <div className="text-sm text-muted-foreground">Best Day</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{emailPerformance?.best_sending_time}</div>
                  <div className="text-sm text-muted-foreground">Best Time</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Lead Analytics */}
        <TabsContent value="leads" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Lead Sources</CardTitle>
                <CardDescription>Distribution of lead sources</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={leadAnalytics?.lead_sources}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ source, percentage }) => `${source} (${percentage.toFixed(1)}%)`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {leadAnalytics?.lead_sources.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Lead Score Distribution</CardTitle>
                <CardDescription>Lead quality score ranges</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={leadAnalytics?.lead_score_distribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="score_range" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Total Leads</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{leadAnalytics?.total_leads.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">All leads in period</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Engagement Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{leadAnalytics?.engagement_rate.toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground">Leads that engaged</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Qualification Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{leadAnalytics?.qualification_rate.toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground">Qualified leads</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Conversion Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{leadAnalytics?.conversion_rate.toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground">Converted to customers</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Revenue Analytics */}
        <TabsContent value="revenue" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Trends</CardTitle>
                <CardDescription>Revenue over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={revenueAnalytics?.revenue_trends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Revenue']} />
                    <Area type="monotone" dataKey="revenue" stroke="#8884d8" fill="#8884d8" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue by Source</CardTitle>
                <CardDescription>Revenue attribution</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={revenueAnalytics?.revenue_by_source}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ source, percentage }) => `${source} (${percentage.toFixed(1)}%)`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="revenue"
                    >
                      {revenueAnalytics?.revenue_by_source.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Revenue']} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Total Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${revenueAnalytics?.total_revenue.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Total revenue in period</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Average Deal Size</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${revenueAnalytics?.average_deal_size.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Per deal average</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Customer LTV</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${revenueAnalytics?.customer_lifetime_value.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Lifetime value</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Pipeline Value</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${revenueAnalytics?.pipeline_value.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Open opportunities</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* AI Insights */}
        <TabsContent value="advanced" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  AI Scores
                </CardTitle>
                <CardDescription>AI-powered performance metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Engagement Score</span>
                    <span>{advancedMetrics?.engagement_score.toFixed(1)}/10</span>
                  </div>
                  <Progress value={(advancedMetrics?.engagement_score || 0) * 10} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Deliverability Score</span>
                    <span>{advancedMetrics?.deliverability_score.toFixed(1)}/10</span>
                  </div>
                  <Progress value={(advancedMetrics?.deliverability_score || 0) * 10} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Lead Quality Score</span>
                    <span>{advancedMetrics?.lead_quality_score.toFixed(1)}/10</span>
                  </div>
                  <Progress value={(advancedMetrics?.lead_quality_score || 0) * 10} className="h-2" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Next Month Prediction</CardTitle>
                <CardDescription>AI-powered performance forecast</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm">Estimated Opens</span>
                  <span className="font-medium">{advancedMetrics?.predictive_analytics.next_month_performance.estimated_opens.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Estimated Clicks</span>
                  <span className="font-medium">{advancedMetrics?.predictive_analytics.next_month_performance.estimated_clicks.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Estimated Replies</span>
                  <span className="font-medium">{advancedMetrics?.predictive_analytics.next_month_performance.estimated_replies.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Confidence Level</span>
                  <span className="font-medium">{advancedMetrics?.predictive_analytics.next_month_performance.confidence_level.toFixed(1)}%</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Optimal Send Times</CardTitle>
                <CardDescription>AI-recommended sending schedule</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {advancedMetrics?.predictive_analytics.optimal_send_times.slice(0, 3).map((time, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span>{time.day} {time.hour}:00</span>
                      <span>{time.expected_open_rate.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {advancedMetrics?.predictive_analytics.churn_risk_leads.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  Churn Risk Analysis
                </CardTitle>
                <CardDescription>Leads at risk of churning</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {advancedMetrics.predictive_analytics.churn_risk_leads.slice(0, 5).map((lead, index) => (
                    <div key={lead.lead_id} className="border rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium">{lead.lead_email}</span>
                        <Badge variant={lead.risk_score > 0.7 ? 'destructive' : 'secondary'}>
                          {(lead.risk_score * 100).toFixed(0)}% risk
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Risk factors: {lead.risk_factors.join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Geographic Analytics */}
        <TabsContent value="geo" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Performance by Region</CardTitle>
                <CardDescription>Geographic performance metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {geoAnalytics?.performance_by_region.slice(0, 5).map((region, index) => (
                    <div key={index} className="border rounded-lg p-3">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">{region.country}</span>
                        <span className="text-sm text-muted-foreground">{region.emails_sent.toLocaleString()} sent</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Open:</span>
                          <div className="font-medium">{region.open_rate.toFixed(1)}%</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Click:</span>
                          <div className="font-medium">{region.click_rate.toFixed(1)}%</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Reply:</span>
                          <div className="font-medium">{region.reply_rate.toFixed(1)}%</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Timezone Performance</CardTitle>
                <CardDescription>Best performing times by timezone</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {geoAnalytics?.timezone_performance.slice(0, 5).map((tz, index) => (
                    <div key={index} className="border rounded-lg p-3">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">{tz.timezone}</span>
                        <span className="text-sm text-muted-foreground">{tz.best_send_time}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Open Rate:</span>
                          <div className="font-medium">{tz.open_rate.toFixed(1)}%</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Click Rate:</span>
                          <div className="font-medium">{tz.click_rate.toFixed(1)}%</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}