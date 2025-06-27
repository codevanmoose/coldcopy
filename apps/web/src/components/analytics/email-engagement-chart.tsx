'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts'
import { DateRange } from 'react-day-picker'
import { format } from 'date-fns'

interface EmailEngagementChartProps {
  workspaceId?: string
  dateRange?: DateRange
}

export function EmailEngagementChart({ workspaceId, dateRange }: EmailEngagementChartProps) {
  const supabase = createClient()

  const { data: engagementData, isLoading } = useQuery({
    queryKey: ['email-engagement', workspaceId, dateRange],
    queryFn: async () => {
      if (!workspaceId) return []

      const { data, error } = await supabase
        .rpc('get_email_engagement_over_time', {
          p_workspace_id: workspaceId,
          p_start_date: dateRange?.from?.toISOString(),
          p_end_date: dateRange?.to?.toISOString(),
        })

      if (error) throw error
      
      // Transform data for the chart
      return data.map((item: any) => ({
        date: format(new Date(item.date), 'MMM dd'),
        sent: item.emails_sent,
        opens: item.emails_opened,
        clicks: item.emails_clicked,
        replies: item.emails_replied,
        openRate: item.emails_sent > 0 ? (item.emails_opened / item.emails_sent * 100).toFixed(1) : 0,
        clickRate: item.emails_sent > 0 ? (item.emails_clicked / item.emails_sent * 100).toFixed(1) : 0,
        replyRate: item.emails_sent > 0 ? (item.emails_replied / item.emails_sent * 100).toFixed(1) : 0,
      }))
    },
    enabled: !!workspaceId,
  })

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-96">
          <div className="animate-pulse text-muted-foreground">
            Loading engagement data...
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Email Volume Over Time</CardTitle>
          <CardDescription>
            Track the number of emails sent, opened, clicked, and replied to
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={engagementData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area 
                type="monotone" 
                dataKey="sent" 
                stackId="1"
                stroke="#8884d8" 
                fill="#8884d8" 
                fillOpacity={0.6}
                name="Sent"
              />
              <Area 
                type="monotone" 
                dataKey="opens" 
                stackId="2"
                stroke="#82ca9d" 
                fill="#82ca9d" 
                fillOpacity={0.6}
                name="Opens"
              />
              <Area 
                type="monotone" 
                dataKey="clicks" 
                stackId="3"
                stroke="#ffc658" 
                fill="#ffc658" 
                fillOpacity={0.6}
                name="Clicks"
              />
              <Area 
                type="monotone" 
                dataKey="replies" 
                stackId="4"
                stroke="#ff7c7c" 
                fill="#ff7c7c" 
                fillOpacity={0.6}
                name="Replies"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Engagement Rates</CardTitle>
          <CardDescription>
            Open, click, and reply rates over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={engagementData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value) => `${value}%`} />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="openRate" 
                stroke="#82ca9d" 
                strokeWidth={2}
                name="Open Rate"
              />
              <Line 
                type="monotone" 
                dataKey="clickRate" 
                stroke="#ffc658" 
                strokeWidth={2}
                name="Click Rate"
              />
              <Line 
                type="monotone" 
                dataKey="replyRate" 
                stroke="#ff7c7c" 
                strokeWidth={2}
                name="Reply Rate"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}