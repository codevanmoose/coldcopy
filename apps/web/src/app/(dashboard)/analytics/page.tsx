'use client'

import { useQuery } from '@tanstack/react-query'
import { useWorkspace } from '@/hooks/use-workspace'
import { api } from '@/lib/api-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DatePickerWithRange } from '@/components/ui/date-range-picker'
import { CampaignMetrics } from '@/components/analytics/campaign-metrics'
import { EmailEngagementChart } from '@/components/analytics/email-engagement-chart'
import { LeadConversionFunnel } from '@/components/analytics/lead-conversion-funnel'
import { ResponseTimeChart } from '@/components/analytics/response-time-chart'
import { TeamPerformance } from '@/components/analytics/team-performance'
import { ABTestResults } from '@/components/analytics/ab-test-results'
import { ReplyDetectionDashboard } from '@/components/analytics/reply-detection-dashboard'
import { 
  TrendingUp, 
  Mail, 
  Users, 
  Clock, 
  BarChart3,
  Download,
  RefreshCw,
  MessageSquare
} from 'lucide-react'
import { DateRange } from 'react-day-picker'
import { useState } from 'react'
import { addDays } from 'date-fns'

export default function AnalyticsPage() {
  const { workspace } = useWorkspace()
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: addDays(new Date(), -30),
    to: new Date(),
  })

  // Fetch overall metrics
  const { data: overallMetrics, isLoading: metricsLoading, refetch } = useQuery({
    queryKey: ['analytics-overview', workspace?.id, dateRange],
    queryFn: async () => {
      if (!workspace) return null

      const params: any = {}
      if (dateRange?.from) params.startDate = dateRange.from.toISOString()
      if (dateRange?.to) params.endDate = dateRange.to.toISOString()

      const response = await api.analytics.overview(workspace.id, params)
      if (response.error) throw new Error(response.error)
      return response.data
    },
    enabled: !!workspace,
  })

  const exportData = async () => {
    if (!workspace || !dateRange?.from || !dateRange?.to) return

    const response = await fetch('/api/analytics/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: workspace.id,
        startDate: dateRange.from.toISOString(),
        endDate: dateRange.to.toISOString(),
      }),
    })

    if (response.ok) {
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `analytics-${dateRange.from.toISOString().split('T')[0]}-to-${dateRange.to.toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    }
  }

  const metricCards = [
    {
      title: 'Total Emails Sent',
      value: overallMetrics?.total_emails_sent || 0,
      change: overallMetrics?.emails_sent_change || 0,
      icon: Mail,
      color: 'text-blue-600',
    },
    {
      title: 'Average Open Rate',
      value: `${overallMetrics?.avg_open_rate || 0}%`,
      change: overallMetrics?.open_rate_change || 0,
      icon: TrendingUp,
      color: 'text-green-600',
    },
    {
      title: 'Average Reply Rate',
      value: `${overallMetrics?.avg_reply_rate || 0}%`,
      change: overallMetrics?.reply_rate_change || 0,
      icon: Users,
      color: 'text-purple-600',
    },
    {
      title: 'Avg Response Time',
      value: overallMetrics?.avg_response_time || '0h',
      change: overallMetrics?.response_time_change || 0,
      icon: Clock,
      color: 'text-orange-600',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">
            Track your campaign performance and team productivity
          </p>
        </div>
        <div className="flex items-center gap-4">
          <DatePickerWithRange
            date={dateRange}
            onDateChange={setDateRange}
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={metricsLoading}
          >
            <RefreshCw className={`h-4 w-4 ${metricsLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={exportData}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metricCards.map((metric) => (
          <Card key={metric.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {metric.title}
              </CardTitle>
              <metric.icon className={`h-4 w-4 ${metric.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value}</div>
              <p className="text-xs text-muted-foreground">
                {metric.change >= 0 ? '+' : ''}{metric.change}% from last period
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detailed Analytics */}
      <Tabs defaultValue="campaigns" className="space-y-4">
        <TabsList>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
          <TabsTrigger value="conversions">Conversions</TabsTrigger>
          <TabsTrigger value="replies">Reply Detection</TabsTrigger>
          <TabsTrigger value="team">Team Performance</TabsTrigger>
          <TabsTrigger value="experiments">A/B Tests</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="space-y-4">
          <CampaignMetrics 
            workspaceId={workspace?.id} 
            dateRange={dateRange}
          />
        </TabsContent>

        <TabsContent value="engagement" className="space-y-4">
          <EmailEngagementChart 
            workspaceId={workspace?.id} 
            dateRange={dateRange}
          />
          <ResponseTimeChart 
            workspaceId={workspace?.id} 
            dateRange={dateRange}
          />
        </TabsContent>

        <TabsContent value="conversions" className="space-y-4">
          <LeadConversionFunnel 
            workspaceId={workspace?.id} 
            dateRange={dateRange}
          />
        </TabsContent>

        <TabsContent value="replies" className="space-y-4">
          <ReplyDetectionDashboard 
            workspaceId={workspace?.id || ''} 
          />
        </TabsContent>

        <TabsContent value="team" className="space-y-4">
          <TeamPerformance 
            workspaceId={workspace?.id} 
            dateRange={dateRange}
          />
        </TabsContent>

        <TabsContent value="experiments" className="space-y-4">
          <ABTestResults 
            workspaceId={workspace?.id} 
            dateRange={dateRange}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}