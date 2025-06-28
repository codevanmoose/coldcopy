'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { formatDistanceToNow } from 'date-fns'
import { 
  Activity,
  Bell,
  BellOff,
  Mail,
  User,
  Campaign,
  MessageSquare,
  Plus,
  Edit,
  Trash2,
  Play,
  Pause,
  X
} from 'lucide-react'
import { useRealtimeNotifications } from '@/hooks/use-realtime'
import type { RealtimeEvent } from '@/lib/realtime/realtime-service'

interface ActivityFeedProps {
  className?: string
  maxItems?: number
}

export function ActivityFeed({ className = '', maxItems = 20 }: ActivityFeedProps) {
  const { notifications, unreadCount, markAsRead, clearAll } = useRealtimeNotifications()
  const [isMinimized, setIsMinimized] = useState(false)

  const getActivityIcon = (event: RealtimeEvent) => {
    const iconMap = {
      leads: User,
      campaigns: Campaign,
      email_threads: MessageSquare,
      email_messages: Mail,
    }
    
    const Icon = iconMap[event.table as keyof typeof iconMap] || Activity
    return <Icon className="h-4 w-4" />
  }

  const getActivityColor = (event: RealtimeEvent) => {
    const colorMap = {
      INSERT: 'text-green-600',
      UPDATE: 'text-blue-600',
      DELETE: 'text-red-600',
    }
    
    return colorMap[event.action] || 'text-muted-foreground'
  }

  const getActivityDescription = (event: RealtimeEvent) => {
    const { table, action, new_record, old_record } = event
    
    switch (table) {
      case 'leads':
        if (action === 'INSERT') {
          return `New lead added: ${new_record?.name || new_record?.email}`
        }
        if (action === 'UPDATE') {
          return `Lead updated: ${new_record?.name || new_record?.email}`
        }
        if (action === 'DELETE') {
          return `Lead deleted: ${old_record?.name || old_record?.email}`
        }
        break
        
      case 'campaigns':
        if (action === 'INSERT') {
          return `New campaign created: ${new_record?.name}`
        }
        if (action === 'UPDATE') {
          const statusChanged = old_record?.status !== new_record?.status
          if (statusChanged) {
            return `Campaign ${new_record?.status}: ${new_record?.name}`
          }
          return `Campaign updated: ${new_record?.name}`
        }
        if (action === 'DELETE') {
          return `Campaign deleted: ${old_record?.name}`
        }
        break
        
      case 'email_threads':
        if (action === 'INSERT') {
          return `New conversation started: ${new_record?.subject}`
        }
        if (action === 'UPDATE') {
          return `Conversation updated: ${new_record?.subject}`
        }
        break
        
      case 'email_messages':
        if (action === 'INSERT') {
          const isInbound = new_record?.direction === 'inbound'
          return isInbound 
            ? `New message from: ${new_record?.from_email}`
            : `Message sent to: ${new_record?.to_emails?.[0]}`
        }
        break
        
      default:
        return `${table} ${action.toLowerCase()}`
    }
    
    return `${table} ${action.toLowerCase()}`
  }

  const displayedNotifications = notifications.slice(0, maxItems)

  if (isMinimized) {
    return (
      <Card className={`w-80 ${className}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              <CardTitle className="text-sm">Activity</CardTitle>
              {unreadCount > 0 && (
                <Badge variant="destructive" className="h-5 text-xs">
                  {unreadCount}
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMinimized(false)}
            >
              <Bell className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className={`w-80 ${className}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            <CardTitle className="text-sm">Live Activity</CardTitle>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="h-5 text-xs">
                {unreadCount}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              disabled={notifications.length === 0}
            >
              <X className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMinimized(true)}
            >
              <BellOff className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <CardDescription className="text-xs">
          Real-time workspace activity
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-96">
          {displayedNotifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No recent activity
            </div>
          ) : (
            <div className="space-y-1">
              {displayedNotifications.map((event, index) => {
                const eventId = `${event.table}_${event.action}_${event.new_record?.id || index}`
                
                return (
                  <div
                    key={eventId}
                    className="flex items-start gap-3 p-3 hover:bg-muted/50 border-b border-border last:border-0 cursor-pointer"
                    onClick={() => markAsRead(eventId)}
                  >
                    <div className={`mt-1 ${getActivityColor(event)}`}>
                      {getActivityIcon(event)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">
                        {getActivityDescription(event)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(event.new_record?.created_at || Date.now()))} ago
                      </p>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${getActivityColor(event)}`}
                    >
                      {event.action}
                    </Badge>
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}