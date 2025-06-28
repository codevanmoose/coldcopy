'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  Activity,
  Users,
  Wifi,
  WifiOff,
  Globe,
  MessageSquare,
  Mail,
  Campaign,
  Clock
} from 'lucide-react'
import { usePresence, useRealtimeNotifications } from '@/hooks/use-realtime'
import { PresenceIndicator } from './presence-indicator'
import { ActivityFeed } from './activity-feed'
import { formatDistanceToNow } from 'date-fns'

interface RealtimeDashboardProps {
  isConnected: boolean
  className?: string
}

export function RealtimeDashboard({ isConnected, className = '' }: RealtimeDashboardProps) {
  const { presenceUsers, onlineUserCount } = usePresence()
  const { notifications, unreadCount } = useRealtimeNotifications()

  // Calculate activity metrics
  const recentActivity = notifications.slice(0, 10)
  const activityByType = recentActivity.reduce((acc, event) => {
    acc[event.table] = (acc[event.table] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const onlineUsers = presenceUsers.filter(u => u.status === 'online')
  const awayUsers = presenceUsers.filter(u => u.status === 'away')
  const busyUsers = presenceUsers.filter(u => u.status === 'busy')

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Connection Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            {isConnected ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-500" />
            )}
            Real-time Status
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
            <Badge variant={isConnected ? 'default' : 'destructive'}>
              {isConnected ? 'Live' : 'Offline'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Team Presence */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4" />
            Team Presence
            <Badge variant="outline" className="ml-auto">
              {onlineUserCount} online
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          {presenceUsers.length > 0 ? (
            <>
              {onlineUsers.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Online ({onlineUsers.length})</p>
                  <PresenceIndicator users={onlineUsers} maxVisible={5} showNames />
                </div>
              )}
              
              {awayUsers.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Away ({awayUsers.length})</p>
                  <PresenceIndicator users={awayUsers} maxVisible={3} showNames />
                </div>
              )}
              
              {busyUsers.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Busy ({busyUsers.length})</p>
                  <PresenceIndicator users={busyUsers} maxVisible={3} showNames />
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-2">
              No team members online
            </p>
          )}
        </CardContent>
      </Card>

      {/* Activity Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Recent Activity
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-auto">
                {unreadCount} new
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          {Object.keys(activityByType).length > 0 ? (
            <div className="grid grid-cols-2 gap-2 text-sm">
              {activityByType.leads && (
                <div className="flex items-center gap-2">
                  <Users className="h-3 w-3 text-blue-500" />
                  <span className="text-muted-foreground">Leads:</span>
                  <span className="font-medium">{activityByType.leads}</span>
                </div>
              )}
              {activityByType.campaigns && (
                <div className="flex items-center gap-2">
                  <Campaign className="h-3 w-3 text-purple-500" />
                  <span className="text-muted-foreground">Campaigns:</span>
                  <span className="font-medium">{activityByType.campaigns}</span>
                </div>
              )}
              {activityByType.email_messages && (
                <div className="flex items-center gap-2">
                  <Mail className="h-3 w-3 text-green-500" />
                  <span className="text-muted-foreground">Messages:</span>
                  <span className="font-medium">{activityByType.email_messages}</span>
                </div>
              )}
              {activityByType.email_threads && (
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-3 w-3 text-orange-500" />
                  <span className="text-muted-foreground">Threads:</span>
                  <span className="font-medium">{activityByType.email_threads}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-2">
              No recent activity
            </p>
          )}

          {recentActivity.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                {recentActivity.slice(0, 3).map((event, index) => (
                  <div key={index} className="text-xs text-muted-foreground">
                    <span className="font-medium">
                      {event.table.replace('_', ' ')} {event.action.toLowerCase()}
                    </span>
                    {event.new_record?.created_at && (
                      <span className="ml-2">
                        {formatDistanceToNow(new Date(event.new_record.created_at))} ago
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* System Health */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Globe className="h-4 w-4" />
            System Health
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Real-time Connection</span>
              <Badge variant={isConnected ? 'default' : 'destructive'} className="text-xs">
                {isConnected ? 'Healthy' : 'Disconnected'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Active Users</span>
              <span className="font-medium">{onlineUserCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Recent Events</span>
              <span className="font-medium">{notifications.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Last Update</span>
              <span className="font-medium flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {notifications.length > 0 
                  ? formatDistanceToNow(new Date(notifications[0].new_record?.created_at || Date.now())) + ' ago'
                  : 'None'
                }
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}