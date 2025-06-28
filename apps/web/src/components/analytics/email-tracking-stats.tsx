'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Eye, 
  MousePointer, 
  Clock, 
  TrendingUp,
  Users,
  Mail
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface EmailTrackingStatsProps {
  campaignId?: string
  emailId?: string
  workspaceId: string
}

export function EmailTrackingStats({ campaignId, emailId, workspaceId }: EmailTrackingStatsProps) {

  const { data: stats, isLoading } = useQuery({
    queryKey: ['email-tracking-stats', campaignId, emailId],
    queryFn: async () => {
      if (emailId) {
        // Single email stats
        const response = await api.analytics.emailEvents(workspaceId, emailId)
        if (response.error) throw new Error(response.error)
        return response.data
      } else if (campaignId) {
        // Campaign stats
        const response = await api.analytics.campaignTracking(workspaceId, campaignId)
        if (response.error) throw new Error(response.error)
        return response.data
      }
    },
    enabled: !!workspaceId && (!!campaignId || !!emailId),
  })

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <div className="animate-pulse text-muted-foreground">
            Loading tracking data...
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!stats) {
    return null
  }

  const openRate = stats.sent > 0 ? (stats.opened / stats.sent * 100) : 0
  const clickRate = stats.sent > 0 ? (stats.clicked / stats.sent * 100) : 0
  const replyRate = stats.sent > 0 ? (stats.replied / stats.sent * 100) : 0

  return (
    <div className="space-y-4">
      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Emails Sent</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.sent}</div>
            <p className="text-xs text-muted-foreground">
              Total recipients
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Rate</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {stats.opened} opened
            </p>
            <Progress value={openRate} className="h-2 mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Click Rate</CardTitle>
            <MousePointer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clickRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {stats.clicked} clicked {stats.clickCount > stats.clicked && `(${stats.clickCount} total clicks)`}
            </p>
            <Progress value={clickRate} className="h-2 mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reply Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{replyRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {stats.replied} replied
            </p>
            <Progress value={replyRate} className="h-2 mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Engagement Timeline */}
      {emailId && stats.firstOpenTime && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Engagement Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.firstOpenTime && (
                <div className="flex items-center gap-3">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">First Opened</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(stats.firstOpenTime), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              )}
              
              {stats.lastClickTime && (
                <div className="flex items-center gap-3">
                  <MousePointer className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Last Click</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(stats.lastClickTime), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              )}

              {stats.clickedLinks && stats.clickedLinks.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Clicked Links</p>
                  {stats.clickedLinks.map((link: string, index: number) => (
                    <div key={index} className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        Click {index + 1}
                      </Badge>
                      <p className="text-xs text-muted-foreground truncate flex-1">
                        {link}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Campaign Level Insights */}
      {campaignId && stats.topLinks && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Performing Links</CardTitle>
            <CardDescription>
              Links with the most clicks across all emails
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.topLinks.map((link: any, index: number) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{link.url}</p>
                    <p className="text-xs text-muted-foreground">
                      {link.unique_clicks} unique clicks • {link.total_clicks} total
                    </p>
                  </div>
                  <Badge variant={index === 0 ? 'default' : 'secondary'}>
                    #{index + 1}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}