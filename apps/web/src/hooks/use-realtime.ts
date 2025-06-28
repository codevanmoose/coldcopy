'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '@/stores/auth'
import { realtimeService } from '@/lib/realtime/realtime-service'
import type { 
  RealtimeEvent, 
  PresenceUser, 
  RealtimeSubscriptionOptions 
} from '@/lib/realtime/realtime-service'

interface UseRealtimeSubscriptionOptions {
  channelName: string
  tables?: string[]
  trackPresence?: boolean
  onTableChange?: (event: RealtimeEvent) => void
  onPresenceSync?: (users: PresenceUser[]) => void
  onPresenceJoin?: (user: PresenceUser) => void
  onPresenceLeave?: (user: PresenceUser) => void
}

/**
 * Hook for subscribing to real-time changes
 */
export function useRealtimeSubscription(options: UseRealtimeSubscriptionOptions) {
  const { workspace, dbUser } = useAuthStore()
  const subscriptionRef = useRef<boolean>(false)

  useEffect(() => {
    if (!workspace || !dbUser || subscriptionRef.current) return

    const subscriptionOptions: RealtimeSubscriptionOptions = {
      workspaceId: workspace.id,
      userId: dbUser.id,
      tables: options.tables,
      trackPresence: options.trackPresence,
      onTableChange: options.onTableChange,
      onPresenceSync: options.onPresenceSync,
      onPresenceJoin: options.onPresenceJoin,
      onPresenceLeave: options.onPresenceLeave,
    }

    realtimeService.subscribe(options.channelName, subscriptionOptions)
    subscriptionRef.current = true

    return () => {
      realtimeService.unsubscribe(options.channelName)
      subscriptionRef.current = false
    }
  }, [workspace, dbUser, options])

  return {
    isConnected: subscriptionRef.current,
    updatePresence: (data: Partial<PresenceUser>) => 
      realtimeService.updatePresence(options.channelName, data),
    broadcast: (event: string, payload: any) => 
      realtimeService.broadcast(options.channelName, event, payload),
    getPresenceUsers: () => 
      realtimeService.getPresenceUsers(options.channelName),
    isUserOnline: (userId: string) => 
      realtimeService.isUserOnline(options.channelName, userId),
  }
}

/**
 * Hook for tracking presence in a workspace
 */
export function usePresence() {
  const { workspace, dbUser } = useAuthStore()
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([])
  const [isOnline, setIsOnline] = useState(false)

  const { updatePresence } = useRealtimeSubscription({
    channelName: `workspace:${workspace?.id}`,
    trackPresence: true,
    onPresenceSync: (users) => {
      setPresenceUsers(users)
      setIsOnline(users.some(u => u.user_id === dbUser?.id))
    },
    onPresenceJoin: (user) => {
      setPresenceUsers(prev => {
        const filtered = prev.filter(u => u.user_id !== user.user_id)
        return [...filtered, user]
      })
      if (user.user_id === dbUser?.id) setIsOnline(true)
    },
    onPresenceLeave: (user) => {
      setPresenceUsers(prev => prev.filter(u => u.user_id !== user.user_id))
      if (user.user_id === dbUser?.id) setIsOnline(false)
    },
  })

  // Update presence when page changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      updatePresence({
        current_page: window.location.pathname,
        online_at: new Date().toISOString(),
      })
    }
  }, [updatePresence])

  // Update status based on activity
  useEffect(() => {
    let timer: NodeJS.Timeout

    const updateStatus = () => {
      updatePresence({
        status: 'online',
        online_at: new Date().toISOString(),
      })
    }

    const handleActivity = () => {
      updateStatus()
      clearTimeout(timer)
      timer = setTimeout(() => {
        updatePresence({ status: 'away' })
      }, 300000) // 5 minutes
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('mousedown', handleActivity)
      window.addEventListener('mousemove', handleActivity)
      window.addEventListener('keypress', handleActivity)
      window.addEventListener('scroll', handleActivity)
      window.addEventListener('touchstart', handleActivity)

      handleActivity() // Initial call
    }

    return () => {
      clearTimeout(timer)
      if (typeof window !== 'undefined') {
        window.removeEventListener('mousedown', handleActivity)
        window.removeEventListener('mousemove', handleActivity)
        window.removeEventListener('keypress', handleActivity)
        window.removeEventListener('scroll', handleActivity)
        window.removeEventListener('touchstart', handleActivity)
      }
    }
  }, [updatePresence])

  return {
    presenceUsers,
    isOnline,
    onlineUserCount: presenceUsers.filter(u => u.status === 'online').length,
    updateStatus: (status: 'online' | 'away' | 'busy') => 
      updatePresence({ status }),
  }
}

/**
 * Hook for real-time notifications
 */
export function useRealtimeNotifications() {
  const { workspace } = useAuthStore()
  const [notifications, setNotifications] = useState<RealtimeEvent[]>([])

  useRealtimeSubscription({
    channelName: `notifications:${workspace?.id}`,
    tables: ['campaigns', 'leads', 'email_threads', 'email_messages'],
    onTableChange: (event) => {
      // Add to notifications list
      setNotifications(prev => [event, ...prev.slice(0, 49)]) // Keep last 50
    },
  })

  const markAsRead = (eventId: string) => {
    setNotifications(prev => prev.filter(n => 
      `${n.table}_${n.action}_${n.new_record?.id}` !== eventId
    ))
  }

  const clearAll = () => {
    setNotifications([])
  }

  return {
    notifications,
    unreadCount: notifications.length,
    markAsRead,
    clearAll,
  }
}

/**
 * Hook for live typing indicators
 */
export function useTypingIndicators(threadId?: string) {
  const { workspace, dbUser } = useAuthStore()
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const typingTimeoutRef = useRef<NodeJS.Timeout>()

  const { broadcast } = useRealtimeSubscription({
    channelName: `thread:${threadId}`,
    onPresenceSync: () => {
      // Reset typing indicators on sync
      setTypingUsers([])
    },
  })

  // Listen for typing events
  useEffect(() => {
    if (!threadId || !workspace) return

    const channel = realtimeService.subscribe(`typing:${threadId}`, {
      workspaceId: workspace.id,
    })

    // Listen for typing broadcasts
    channel.on('broadcast', { event: 'typing' }, ({ payload }) => {
      if (payload.userId !== dbUser?.id) {
        setTypingUsers(prev => {
          if (!prev.includes(payload.userId)) {
            return [...prev, payload.userId]
          }
          return prev
        })

        // Remove user after timeout
        setTimeout(() => {
          setTypingUsers(prev => prev.filter(u => u !== payload.userId))
        }, 3000)
      }
    })

    channel.on('broadcast', { event: 'stop_typing' }, ({ payload }) => {
      setTypingUsers(prev => prev.filter(u => u !== payload.userId))
    })

    return () => {
      realtimeService.unsubscribe(`typing:${threadId}`)
    }
  }, [threadId, workspace, dbUser])

  const startTyping = () => {
    if (!threadId || !dbUser) return

    broadcast('typing', { userId: dbUser.id })

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Auto-stop typing after 3 seconds
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping()
    }, 3000)
  }

  const stopTyping = () => {
    if (!threadId || !dbUser) return

    broadcast('stop_typing', { userId: dbUser.id })

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
  }

  return {
    typingUsers,
    startTyping,
    stopTyping,
    isTyping: typingUsers.length > 0,
  }
}