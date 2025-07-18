'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { 
  TrendingUp, 
  TrendingDown,
  Mail,
  MousePointer,
  MessageSquare,
  Users,
  Clock,
  CheckCircle2
} from 'lucide-react'
import { DateRange } from 'react-day-picker'

interface CampaignMetricsProps {
  workspaceId?: string
  dateRange?: DateRange
}

export function CampaignMetrics({ workspaceId, dateRange }: CampaignMetricsProps) {

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['campaign-metrics', workspaceId, dateRange],
    queryFn: async () => {
      if (!workspaceId) return []

      const params: any = {}
      if (dateRange?.from) params.startDate = dateRange.from.toISOString()
      if (dateRange?.to) params.endDate = dateRange.to.toISOString()
      params.includeMetrics = true

      const response = await api.analytics.campaigns(workspaceId, params)
      if (response.error) throw new Error(response.error)
      
      return response.data
    },
    enabled: !!workspaceId,
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'scheduled': return 'bg-blue-100 text-blue-800'
      case 'paused': return 'bg-yellow-100 text-yellow-800'
      case 'completed': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getRateIcon = (current: number, benchmark: number) => {
    if (current >= benchmark) {
      return <TrendingUp className="h-4 w-4 text-green-600" />
    }
    return <TrendingDown className="h-4 w-4 text-red-600" />
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">
            Loading campaign metrics...
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaign Performance</CardTitle>
        <CardDescription>
          Detailed metrics for all your email campaigns
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaign</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Sent</TableHead>
              <TableHead className="text-center">Open Rate</TableHead>
              <TableHead className="text-center">Click Rate</TableHead>
              <TableHead className="text-center">Reply Rate</TableHead>
              <TableHead>Progress</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns?.map((campaign) => (
              <TableRow key={campaign.id}>
                <TableCell className="font-medium">
                  <div>
                    <p>{campaign.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {campaign.type === 'one_time' ? 'One-time' : 'Sequence'}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={getStatusColor(campaign.status)}>
                    {campaign.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    {campaign.metrics.sent}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    {campaign.metrics.openRate}%
                    {getRateIcon(parseFloat(campaign.metrics.openRate), 25)}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    {campaign.metrics.clickRate}%
                    {getRateIcon(parseFloat(campaign.metrics.clickRate), 3)}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    {campaign.metrics.replyRate}%
                    {getRateIcon(parseFloat(campaign.metrics.replyRate), 5)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="w-32">
                    <Progress 
                      value={campaign.metrics.sent > 0 ? 
                        (campaign.metrics.sent / campaign.total_recipients * 100) : 0
                      } 
                      className="h-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {campaign.metrics.sent} / {campaign.total_recipients}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {(!campaigns || campaigns.length === 0) && (
          <div className="text-center py-8 text-muted-foreground">
            No campaigns found for the selected date range
          </div>
        )}
      </CardContent>
    </Card>
  )
}