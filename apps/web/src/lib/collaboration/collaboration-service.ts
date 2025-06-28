// Collaboration Service - Real-time presence and collision detection
'use client'

import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'

export interface UserPresence {
  id: string
  workspace_id: string
  user_id: string
  status: 'online' | 'away' | 'busy' | 'offline'
  custom_status?: string
  current_page?: string
  current_resource_type?: string
  current_resource_id?: string
  session_id: string
  device_type: 'desktop' | 'mobile' | 'tablet'
  browser?: string
  last_seen: string
  last_activity: string
  user_profiles?: {
    first_name: string
    last_name: string
    email: string
    avatar_url?: string
  }
}

export interface ResourceLock {
  id: string
  workspace_id: string
  resource_type: string
  resource_id: string
  locked_by_user_id: string
  lock_type: 'editing' | 'viewing' | 'processing'
  session_id: string
  lock_reason?: string
  acquired_at: string
  last_heartbeat: string
  auto_release_at?: string
  user_profiles?: {
    first_name: string
    last_name: string
    email: string
    avatar_url?: string
  }
}

export interface ActivityItem {
  id: string
  workspace_id: string
  user_id: string
  activity_type: string
  resource_type: string
  resource_id?: string
  resource_name?: string
  activity_data: any
  description?: string
  is_public: boolean
  created_at: string
  user_profiles?: {
    first_name: string
    last_name: string
    email: string
    avatar_url?: string
  }
}

export interface RealtimeNotification {
  id: string
  workspace_id: string
  user_id?: string
  notification_type: string
  title: string
  message?: string
  data: any
  priority: 'low' | 'normal' | 'high' | 'urgent'
  delivered_at?: string
  read_at?: string
  created_at: string
}

type PresenceCallback = (presence: UserPresence[]) => void
type LockCallback = (locks: ResourceLock[]) => void
type ActivityCallback = (activities: ActivityItem[]) => void
type NotificationCallback = (notification: RealtimeNotification) => void

export class CollaborationService {
  private static instance: CollaborationService
  private supabase: any
  private sessionId: string
  private workspaceId: string | null = null
  private userId: string | null = null
  
  // Callbacks
  private presenceCallbacks: PresenceCallback[] = []
  private lockCallbacks: LockCallback[] = []
  private activityCallbacks: ActivityCallback[] = []
  private notificationCallbacks: NotificationCallback[] = []
  
  // Subscriptions
  private presenceSubscription: any = null
  private lockSubscription: any = null
  private activitySubscription: any = null
  private notificationSubscription: any = null
  
  // State management
  private currentPresence: UserPresence[] = []
  private currentLocks: ResourceLock[] = []
  private isInitialized = false
  private heartbeatInterval: NodeJS.Timeout | null = null

  private constructor() {
    this.sessionId = uuidv4()
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  static getInstance(): CollaborationService {
    if (!CollaborationService.instance) {
      CollaborationService.instance = new CollaborationService()
    }
    return CollaborationService.instance
  }

  // Initialize collaboration service
  async initialize(workspaceId: string, userId: string): Promise<boolean> {
    if (this.isInitialized && this.workspaceId === workspaceId) {
      return true
    }

    try {
      this.workspaceId = workspaceId
      this.userId = userId

      // Set up real-time subscriptions
      await this.setupRealtimeSubscriptions()
      
      // Set initial presence
      await this.updatePresence('online')
      
      // Start heartbeat
      this.startHeartbeat()
      
      // Set up cleanup on page unload
      this.setupCleanupHandlers()
      
      this.isInitialized = true
      console.log('Collaboration service initialized for workspace:', workspaceId)
      
      return true
    } catch (error) {
      console.error('Failed to initialize collaboration service:', error)
      return false
    }
  }

  // Set up real-time subscriptions
  private async setupRealtimeSubscriptions() {
    if (!this.workspaceId) return

    // Subscribe to presence updates
    this.presenceSubscription = this.supabase
      .channel(`workspace_presence_${this.workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence',
          filter: `workspace_id=eq.${this.workspaceId}`
        },
        () => this.loadPresenceData()
      )
      .subscribe()

    // Subscribe to lock updates
    this.lockSubscription = this.supabase
      .channel(`workspace_locks_${this.workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'resource_locks',
          filter: `workspace_id=eq.${this.workspaceId}`
        },
        () => this.loadLockData()
      )
      .subscribe()

    // Subscribe to activity updates
    this.activitySubscription = this.supabase
      .channel(`workspace_activity_${this.workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_feed',
          filter: `workspace_id=eq.${this.workspaceId}`
        },
        (payload: any) => this.handleNewActivity(payload.new)
      )
      .subscribe()

    // Subscribe to notifications
    this.notificationSubscription = this.supabase
      .channel(`user_notifications_${this.userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'realtime_notifications',
          filter: `user_id=eq.${this.userId}`
        },
        (payload: any) => this.handleNewNotification(payload.new)
      )
      .subscribe()

    // Load initial data
    await Promise.all([
      this.loadPresenceData(),
      this.loadLockData(),
      this.loadActivityData()
    ])
  }

  // Update user presence
  async updatePresence(
    status: 'online' | 'away' | 'busy' | 'offline',
    options: {
      customStatus?: string
      currentPage?: string
      currentResourceType?: string
      currentResourceId?: string
      deviceType?: 'desktop' | 'mobile' | 'tablet'
      browser?: string
    } = {}
  ): Promise<boolean> {
    if (!this.workspaceId) return false

    try {
      const { error } = await this.supabase.rpc('update_user_presence', {
        p_workspace_id: this.workspaceId,
        p_status: status,
        p_custom_status: options.customStatus,
        p_current_page: options.currentPage,
        p_current_resource_type: options.currentResourceType,
        p_current_resource_id: options.currentResourceId,
        p_session_id: this.sessionId,
        p_device_type: options.deviceType || 'desktop',
        p_browser: options.browser || navigator.userAgent
      })

      if (error) {
        console.error('Failed to update presence:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error updating presence:', error)
      return false
    }
  }

  // Acquire resource lock
  async acquireResourceLock(
    resourceType: string,
    resourceId: string,
    lockType: 'editing' | 'viewing' | 'processing' = 'editing',
    options: {
      lockReason?: string
      autoReleaseMinutes?: number
    } = {}
  ): Promise<{ success: boolean; lockId?: string; error?: string; message?: string }> {
    if (!this.workspaceId) {
      return { success: false, error: 'workspace_not_set' }
    }

    try {
      const { data, error } = await this.supabase.rpc('acquire_resource_lock', {
        p_workspace_id: this.workspaceId,
        p_resource_type: resourceType,
        p_resource_id: resourceId,
        p_lock_type: lockType,
        p_session_id: this.sessionId,
        p_lock_reason: options.lockReason,
        p_auto_release_minutes: options.autoReleaseMinutes || 30
      })

      if (error) {
        console.error('Failed to acquire lock:', error)
        return { success: false, error: error.message }
      }

      return data
    } catch (error) {
      console.error('Error acquiring lock:', error)
      return { success: false, error: 'unknown_error' }
    }
  }

  // Release resource lock
  async releaseResourceLock(
    resourceType: string,
    resourceId: string,
    lockType: 'editing' | 'viewing' | 'processing' = 'editing'
  ): Promise<boolean> {
    if (!this.workspaceId) return false

    try {
      const { data, error } = await this.supabase.rpc('release_resource_lock', {
        p_workspace_id: this.workspaceId,
        p_resource_type: resourceType,
        p_resource_id: resourceId,
        p_lock_type: lockType
      })

      if (error) {
        console.error('Failed to release lock:', error)
        return false
      }

      return data
    } catch (error) {
      console.error('Error releasing lock:', error)
      return false
    }
  }

  // Log activity
  async logActivity(
    activityType: string,
    resourceType: string,
    resourceId: string,
    resourceName: string,
    options: {
      activityData?: any
      description?: string
      isPublic?: boolean
    } = {}
  ): Promise<boolean> {
    if (!this.workspaceId) return false

    try {
      const { error } = await this.supabase.rpc('log_activity', {
        p_workspace_id: this.workspaceId,
        p_activity_type: activityType,
        p_resource_type: resourceType,
        p_resource_id: resourceId,
        p_resource_name: resourceName,
        p_activity_data: options.activityData || {},
        p_description: options.description,
        p_is_public: options.isPublic !== false
      })

      if (error) {
        console.error('Failed to log activity:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error logging activity:', error)
      return false
    }
  }

  // Get resource locks for a specific resource
  async getResourceLocks(resourceType: string, resourceId: string): Promise<ResourceLock[]> {
    if (!this.workspaceId) return []

    try {
      const { data, error } = await this.supabase
        .from('resource_locks')
        .select(`
          *,
          user_profiles!locked_by_user_id (
            first_name,
            last_name,
            email,
            avatar_url
          )
        `)
        .eq('workspace_id', this.workspaceId)
        .eq('resource_type', resourceType)
        .eq('resource_id', resourceId)
        .or('auto_release_at.is.null,auto_release_at.gt.now()')

      if (error) {
        console.error('Failed to get resource locks:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error getting resource locks:', error)
      return []
    }
  }

  // Check if resource is locked by another user
  async isResourceLocked(
    resourceType: string,
    resourceId: string,
    lockType: 'editing' | 'viewing' | 'processing' = 'editing'
  ): Promise<{ isLocked: boolean; lockedBy?: UserPresence; lock?: ResourceLock }> {
    const locks = await this.getResourceLocks(resourceType, resourceId)
    const relevantLock = locks.find(lock => 
      lock.lock_type === lockType && lock.locked_by_user_id !== this.userId
    )

    if (relevantLock) {
      const lockedByUser = this.currentPresence.find(p => p.user_id === relevantLock.locked_by_user_id)
      return {
        isLocked: true,
        lockedBy: lockedByUser,
        lock: relevantLock
      }
    }

    return { isLocked: false }
  }

  // Get workspace activity feed
  async getActivityFeed(limit: number = 50): Promise<ActivityItem[]> {
    if (!this.workspaceId) return []

    try {
      const { data, error } = await this.supabase
        .from('activity_feed')
        .select(`
          *,
          user_profiles!user_id (
            first_name,
            last_name,
            email,
            avatar_url
          )
        `)
        .eq('workspace_id', this.workspaceId)
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        console.error('Failed to get activity feed:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error getting activity feed:', error)
      return []
    }
  }

  // Event handlers
  onPresenceUpdate(callback: PresenceCallback): () => void {
    this.presenceCallbacks.push(callback)
    
    // Immediately call with current data
    callback(this.currentPresence)
    
    return () => {
      this.presenceCallbacks = this.presenceCallbacks.filter(cb => cb !== callback)
    }
  }

  onLockUpdate(callback: LockCallback): () => void {
    this.lockCallbacks.push(callback)
    
    // Immediately call with current data
    callback(this.currentLocks)
    
    return () => {
      this.lockCallbacks = this.lockCallbacks.filter(cb => cb !== callback)
    }
  }

  onActivityUpdate(callback: ActivityCallback): () => void {
    this.activityCallbacks.push(callback)
    
    return () => {
      this.activityCallbacks = this.activityCallbacks.filter(cb => cb !== callback)
    }
  }

  onNotification(callback: NotificationCallback): () => void {
    this.notificationCallbacks.push(callback)
    
    return () => {
      this.notificationCallbacks = this.notificationCallbacks.filter(cb => cb !== callback)
    }
  }

  // Private methods
  private async loadPresenceData() {
    if (!this.workspaceId) return

    try {
      const { data, error } = await this.supabase
        .from('user_presence')
        .select(`
          *,
          user_profiles!user_id (
            first_name,
            last_name,
            email,
            avatar_url
          )
        `)
        .eq('workspace_id', this.workspaceId)
        .neq('status', 'offline')

      if (error) {
        console.error('Failed to load presence data:', error)
        return
      }

      this.currentPresence = data || []
      this.presenceCallbacks.forEach(callback => callback(this.currentPresence))
    } catch (error) {
      console.error('Error loading presence data:', error)
    }
  }

  private async loadLockData() {
    if (!this.workspaceId) return

    try {
      const { data, error } = await this.supabase
        .from('resource_locks')
        .select(`
          *,
          user_profiles!locked_by_user_id (
            first_name,
            last_name,
            email,
            avatar_url
          )
        `)
        .eq('workspace_id', this.workspaceId)
        .or('auto_release_at.is.null,auto_release_at.gt.now()')

      if (error) {
        console.error('Failed to load lock data:', error)
        return
      }

      this.currentLocks = data || []
      this.lockCallbacks.forEach(callback => callback(this.currentLocks))
    } catch (error) {
      console.error('Error loading lock data:', error)
    }
  }

  private async loadActivityData() {
    const activities = await this.getActivityFeed()
    this.activityCallbacks.forEach(callback => callback(activities))
  }

  private handleNewActivity(activity: ActivityItem) {
    this.activityCallbacks.forEach(callback => callback([activity]))
  }

  private handleNewNotification(notification: RealtimeNotification) {
    this.notificationCallbacks.forEach(callback => callback(notification))
  }

  private startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
    }

    // Update presence every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      this.updatePresence('online')
    }, 30000)
  }

  private setupCleanupHandlers() {
    const cleanup = () => {
      this.updatePresence('offline')
      this.cleanup()
    }

    window.addEventListener('beforeunload', cleanup)
    window.addEventListener('pagehide', cleanup)
    
    // Handle visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.updatePresence('away')
      } else {
        this.updatePresence('online')
      }
    })
  }

  // Cleanup method
  cleanup() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }

    // Unsubscribe from channels
    if (this.presenceSubscription) {
      this.supabase.removeChannel(this.presenceSubscription)
    }
    if (this.lockSubscription) {
      this.supabase.removeChannel(this.lockSubscription)
    }
    if (this.activitySubscription) {
      this.supabase.removeChannel(this.activitySubscription)
    }
    if (this.notificationSubscription) {
      this.supabase.removeChannel(this.notificationSubscription)
    }

    // Clear callbacks
    this.presenceCallbacks = []
    this.lockCallbacks = []
    this.activityCallbacks = []
    this.notificationCallbacks = []

    this.isInitialized = false
  }

  // Get current state
  getCurrentPresence(): UserPresence[] {
    return this.currentPresence
  }

  getCurrentLocks(): ResourceLock[] {
    return this.currentLocks
  }

  getSessionId(): string {
    return this.sessionId
  }

  isUserOnline(userId: string): boolean {
    return this.currentPresence.some(p => p.user_id === userId && p.status !== 'offline')
  }

  getUserPresence(userId: string): UserPresence | undefined {
    return this.currentPresence.find(p => p.user_id === userId)
  }
}

// Export singleton instance
export const collaborationService = CollaborationService.getInstance()