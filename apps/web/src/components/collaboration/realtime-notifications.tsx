'use client'

import { useState, useEffect } from 'react'
import { 
  Bell, 
  X, 
  Check, 
  AlertCircle, 
  Info, 
  CheckCircle, 
  Clock,
  Eye,
  EyeOff,
  Settings
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useCollaboration } from './collaboration-provider'

interface NotificationItemProps {
  notification: any // RealtimeNotification type
  onMarkAsRead: (id: string) => void
  onDismiss: (id: string) => void
}

function NotificationItem({ notification, onMarkAsRead, onDismiss }: NotificationItemProps) {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'border-l-red-500 bg-red-50 dark:bg-red-950/20'
      case 'high': return 'border-l-orange-500 bg-orange-50 dark:bg-orange-950/20'
      case 'normal': return 'border-l-blue-500 bg-blue-50 dark:bg-blue-950/20'
      case 'low': return 'border-l-gray-500 bg-gray-50 dark:bg-gray-950/20'
      default: return 'border-l-gray-300'
    }
  }

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent': return <AlertCircle className="w-4 h-4 text-red-600" />
      case 'high': return <AlertCircle className="w-4 h-4 text-orange-600" />
      case 'normal': return <Info className="w-4 h-4 text-blue-600" />
      case 'low': return <CheckCircle className="w-4 h-4 text-gray-600" />
      default: return <Info className="w-4 h-4 text-gray-600" />
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    
    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    
    return date.toLocaleDateString()
  }

  return (
    <div className={`
      border-l-4 p-3 space-y-2
      ${getPriorityColor(notification.priority)}
      ${!notification.read_at ? 'font-medium' : 'opacity-75'}
    `}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 pt-0.5">
            {getPriorityIcon(notification.priority)}
          </div>
          
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium line-clamp-1">
              {notification.title}
            </h4>
            
            {notification.message && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {notification.message}
              </p>
            )}

            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="text-xs">
                {notification.notification_type}
              </Badge>
              
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>{formatTimeAgo(notification.created_at)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {!notification.read_at && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onMarkAsRead(notification.id)}
              className="h-8 w-8 p-0"
            >
              <Eye className="w-4 h-4" />
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDismiss(notification.id)}
            className="h-8 w-8 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export function RealtimeNotifications({ className = '' }: { className?: string }) {
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [settings, setSettings] = useState({
    enableBrowserNotifications: true,
    enableSounds: false,
    autoMarkAsRead: true,
    showOnlyUnread: false
  })

  // Mock notifications for demo - in real app, get from collaboration service
  useEffect(() => {
    // Simulate real-time notifications
    const mockNotifications = [
      {
        id: '1',
        title: 'Campaign "Q4 Outreach" completed',
        message: 'Your campaign has finished sending to 150 leads',
        notification_type: 'campaign_complete',
        priority: 'normal',
        created_at: new Date(Date.now() - 5 * 60000).toISOString(),
        read_at: null
      },
      {
        id: '2',
        title: 'New reply received',
        message: 'John Smith replied to your email about product demo',
        notification_type: 'email_reply',
        priority: 'high',
        created_at: new Date(Date.now() - 15 * 60000).toISOString(),
        read_at: null
      },
      {
        id: '3',
        title: 'Lead qualification updated',
        message: 'Sarah Connor has been marked as "Hot Lead"',
        notification_type: 'lead_update',
        priority: 'normal',
        created_at: new Date(Date.now() - 30 * 60000).toISOString(),
        read_at: new Date(Date.now() - 25 * 60000).toISOString()
      },
      {
        id: '4',
        title: 'Team member joined',
        message: 'Mike Johnson joined your workspace',
        notification_type: 'team_update',
        priority: 'low',
        created_at: new Date(Date.now() - 60 * 60000).toISOString(),
        read_at: null
      }
    ]

    setNotifications(mockNotifications)
    setUnreadCount(mockNotifications.filter(n => !n.read_at).length)
  }, [])

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(n => 
        n.id === id 
          ? { ...n, read_at: new Date().toISOString() }
          : n
      )
    )
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const markAllAsRead = () => {
    const now = new Date().toISOString()
    setNotifications(prev => 
      prev.map(n => ({ ...n, read_at: n.read_at || now }))
    )
    setUnreadCount(0)
  }

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
    setUnreadCount(prev => {
      const notification = notifications.find(n => n.id === id)
      return notification && !notification.read_at ? prev - 1 : prev
    })
  }

  const clearAll = () => {
    setNotifications([])
    setUnreadCount(0)
  }

  const filteredNotifications = settings.showOnlyUnread 
    ? notifications.filter(n => !n.read_at)
    : notifications

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`relative ${className}`}
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-96 p-0" side="bottom" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <p className="text-sm text-muted-foreground">
                {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="text-xs"
              >
                <Check className="w-4 h-4 mr-1" />
                Mark all read
              </Button>
            )}
          </div>
        </div>

        {/* Settings panel */}
        <div className="p-2 border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch
                checked={settings.showOnlyUnread}
                onCheckedChange={(checked) => 
                  setSettings(prev => ({ ...prev, showOnlyUnread: checked }))
                }
                size="sm"
              />
              <span className="text-xs text-muted-foreground">Show only unread</span>
            </div>
            
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="text-xs text-destructive hover:text-destructive"
              >
                Clear all
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="h-96">
          {filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Bell className="w-12 h-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No notifications</p>
              <p className="text-sm text-muted-foreground">
                {settings.showOnlyUnread 
                  ? 'No unread notifications' 
                  : 'You\'re all caught up!'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-0">
              {filteredNotifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={markAsRead}
                  onDismiss={dismissNotification}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Notification settings */}
        <div className="p-4 border-t bg-muted/30">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Browser notifications</span>
              <Switch
                checked={settings.enableBrowserNotifications}
                onCheckedChange={(checked) => 
                  setSettings(prev => ({ ...prev, enableBrowserNotifications: checked }))
                }
                size="sm"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm">Sound alerts</span>
              <Switch
                checked={settings.enableSounds}
                onCheckedChange={(checked) => 
                  setSettings(prev => ({ ...prev, enableSounds: checked }))
                }
                size="sm"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm">Auto mark as read</span>
              <Switch
                checked={settings.autoMarkAsRead}
                onCheckedChange={(checked) => 
                  setSettings(prev => ({ ...prev, autoMarkAsRead: checked }))
                }
                size="sm"
              />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// Notification toast for urgent alerts
export function NotificationToast() {
  const [activeToasts, setActiveToasts] = useState<any[]>([])

  // Mock urgent notification system
  useEffect(() => {
    // In real app, this would listen to urgent notifications from collaboration service
    const interval = setInterval(() => {
      // Simulate urgent notification occasionally
      if (Math.random() < 0.1) { // 10% chance every 10 seconds
        const urgentNotification = {
          id: Date.now().toString(),
          title: 'Urgent: Campaign Failed',
          message: 'Email delivery failed for "Q4 Outreach" campaign',
          priority: 'urgent',
          type: 'campaign_error',
          timestamp: new Date().toISOString()
        }
        
        setActiveToasts(prev => [...prev, urgentNotification])
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
          setActiveToasts(prev => prev.filter(t => t.id !== urgentNotification.id))
        }, 5000)
      }
    }, 10000)

    return () => clearInterval(interval)
  }, [])

  const dismissToast = (id: string) => {
    setActiveToasts(prev => prev.filter(t => t.id !== id))
  }

  if (activeToasts.length === 0) {
    return null
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {activeToasts.map((toast) => (
        <Card key={toast.id} className="w-80 border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <CardTitle className="text-sm text-red-800 dark:text-red-200">
                    {toast.title}
                  </CardTitle>
                  <CardDescription className="text-xs text-red-600 dark:text-red-300">
                    {toast.message}
                  </CardDescription>
                </div>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => dismissToast(toast.id)}
                className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}