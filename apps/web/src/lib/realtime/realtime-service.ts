import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { toast } from 'sonner'

export interface RealtimeEvent {
  table: string
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  old_record?: any
  new_record?: any
  workspace_id?: string
}

export interface PresenceUser {
  user_id: string
  email: string
  name?: string
  avatar?: string
  online_at: string
  current_page?: string
  status?: 'online' | 'away' | 'busy'
}

export interface RealtimeSubscriptionOptions {
  workspaceId: string
  userId?: string
  onTableChange?: (event: RealtimeEvent) => void
  onPresenceSync?: (users: PresenceUser[]) => void
  onPresenceJoin?: (user: PresenceUser) => void
  onPresenceLeave?: (user: PresenceUser) => void
  tables?: string[]
  trackPresence?: boolean
}

export class RealtimeService {
  private supabase = createClient()
  private channels: Map<string, RealtimeChannel> = new Map()
  private presenceData: PresenceUser | null = null

  /**
   * Subscribe to real-time changes for a workspace
   */
  subscribe(channelName: string, options: RealtimeSubscriptionOptions): RealtimeChannel {
    // Remove existing channel if it exists
    this.unsubscribe(channelName)

    const channel = this.supabase.channel(channelName)

    // Set up table change listeners
    if (options.tables && options.onTableChange) {
      options.tables.forEach(table => {
        channel.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table,
            filter: `workspace_id=eq.${options.workspaceId}`,
          },
          (payload: RealtimePostgresChangesPayload<any>) => {
            const event: RealtimeEvent = {
              table,
              action: payload.eventType as any,
              old_record: payload.old,
              new_record: payload.new,
              workspace_id: options.workspaceId,
            }
            
            options.onTableChange?.(event)
            this.handleGlobalNotifications(event)
          }
        )
      })
    }

    // Set up presence tracking
    if (options.trackPresence && options.userId) {
      this.presenceData = {
        user_id: options.userId,
        email: '', // Will be filled by caller
        online_at: new Date().toISOString(),
        current_page: window.location.pathname,
        status: 'online',
      }

      channel.on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const users = this.extractPresenceUsers(state)
        options.onPresenceSync?.(users)
      })

      channel.on('presence', { event: 'join' }, ({ newPresences }) => {
        const users = this.extractPresenceUsers({ new: newPresences })
        users.forEach(user => options.onPresenceJoin?.(user))
      })

      channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
        const users = this.extractPresenceUsers({ left: leftPresences })
        users.forEach(user => options.onPresenceLeave?.(user))
      })
    }

    // Subscribe to the channel
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`✅ Subscribed to ${channelName}`)
        
        // Track presence if enabled
        if (options.trackPresence && this.presenceData) {
          await channel.track(this.presenceData)
        }
      } else if (status === 'CHANNEL_ERROR') {
        console.error(`❌ Failed to subscribe to ${channelName}`)
      }
    })

    this.channels.set(channelName, channel)
    return channel
  }

  /**
   * Unsubscribe from a channel
   */
  unsubscribe(channelName: string) {
    const channel = this.channels.get(channelName)
    if (channel) {
      this.supabase.removeChannel(channel)
      this.channels.delete(channelName)
      console.log(`🔌 Unsubscribed from ${channelName}`)
    }
  }

  /**
   * Unsubscribe from all channels
   */
  unsubscribeAll() {
    this.channels.forEach((_, channelName) => {
      this.unsubscribe(channelName)
    })
  }

  /**
   * Update presence data
   */
  async updatePresence(channelName: string, data: Partial<PresenceUser>) {
    const channel = this.channels.get(channelName)
    if (channel && this.presenceData) {
      this.presenceData = { ...this.presenceData, ...data }
      await channel.track(this.presenceData)
    }
  }

  /**
   * Send a broadcast message to all users in a channel
   */
  async broadcast(channelName: string, event: string, payload: any) {
    const channel = this.channels.get(channelName)
    if (channel) {
      await channel.send({
        type: 'broadcast',
        event,
        payload,
      })
    }
  }

  /**
   * Get active users in a channel
   */
  getPresenceUsers(channelName: string): PresenceUser[] {
    const channel = this.channels.get(channelName)
    if (!channel) return []

    const state = channel.presenceState()
    return this.extractPresenceUsers(state)
  }

  /**
   * Check if a user is online
   */
  isUserOnline(channelName: string, userId: string): boolean {
    const users = this.getPresenceUsers(channelName)
    return users.some(user => user.user_id === userId)
  }

  private extractPresenceUsers(state: any): PresenceUser[] {
    const users: PresenceUser[] = []
    
    Object.keys(state).forEach(key => {
      const presences = state[key]
      if (Array.isArray(presences)) {
        presences.forEach(presence => {
          users.push(presence as PresenceUser)
        })
      }
    })

    // Remove duplicates and sort by online_at
    const uniqueUsers = users.filter((user, index, self) => 
      index === self.findIndex(u => u.user_id === user.user_id)
    )

    return uniqueUsers.sort((a, b) => 
      new Date(b.online_at).getTime() - new Date(a.online_at).getTime()
    )
  }

  private handleGlobalNotifications(event: RealtimeEvent) {
    // Global notification logic for important events
    switch (event.table) {
      case 'email_threads':
        if (event.action === 'INSERT' && event.new_record) {
          // Don't show notification for threads created by current user
          const isInbound = event.new_record.last_message_from !== 'system'
          if (isInbound) {
            toast.info('New conversation started', {
              description: `Subject: ${event.new_record.subject}`,
            })
          }
        }
        break

      case 'email_messages':
        if (event.action === 'INSERT' && event.new_record) {
          const isInbound = event.new_record.direction === 'inbound'
          if (isInbound) {
            toast.info('New message received', {
              description: `From: ${event.new_record.from_email}`,
            })
          }
        }
        break

      case 'campaigns':
        if (event.action === 'UPDATE' && event.new_record && event.old_record) {
          const oldStatus = event.old_record.status
          const newStatus = event.new_record.status
          
          if (oldStatus !== newStatus) {
            toast.success(`Campaign ${newStatus}`, {
              description: event.new_record.name,
            })
          }
        }
        break

      case 'leads':
        if (event.action === 'INSERT' && event.new_record) {
          toast.success('New lead added', {
            description: `${event.new_record.name || event.new_record.email}`,
          })
        }
        break

      case 'subscriptions':
        if (event.action === 'UPDATE' && event.new_record && event.old_record) {
          const oldStatus = event.old_record.status
          const newStatus = event.new_record.status
          
          if (oldStatus !== newStatus && newStatus === 'active') {
            toast.success('Subscription activated', {
              description: 'Your subscription is now active',
            })
          }
        }
        break
    }
  }
}

// Export singleton instance
export const realtimeService = new RealtimeService()

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    realtimeService.unsubscribeAll()
  })
}