'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { 
  collaborationService, 
  UserPresence, 
  ResourceLock, 
  ActivityItem, 
  RealtimeNotification 
} from '@/lib/collaboration/collaboration-service'

interface CollaborationContextType {
  isInitialized: boolean
  currentPresence: UserPresence[]
  currentLocks: ResourceLock[]
  recentActivity: ActivityItem[]
  
  // Presence methods
  updatePresence: (status: 'online' | 'away' | 'busy' | 'offline', options?: any) => Promise<boolean>
  isUserOnline: (userId: string) => boolean
  getUserPresence: (userId: string) => UserPresence | undefined
  
  // Lock methods
  acquireResourceLock: (resourceType: string, resourceId: string, lockType?: 'editing' | 'viewing' | 'processing', options?: any) => Promise<any>
  releaseResourceLock: (resourceType: string, resourceId: string, lockType?: 'editing' | 'viewing' | 'processing') => Promise<boolean>
  isResourceLocked: (resourceType: string, resourceId: string, lockType?: 'editing' | 'viewing' | 'processing') => Promise<any>
  getResourceLocks: (resourceType: string, resourceId: string) => Promise<ResourceLock[]>
  
  // Activity methods
  logActivity: (activityType: string, resourceType: string, resourceId: string, resourceName: string, options?: any) => Promise<boolean>
  getActivityFeed: (limit?: number) => Promise<ActivityItem[]>
}

const CollaborationContext = createContext<CollaborationContextType | null>(null)

interface CollaborationProviderProps {
  children: ReactNode
  workspaceId: string
  userId: string
}

export function CollaborationProvider({ children, workspaceId, userId }: CollaborationProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false)
  const [currentPresence, setCurrentPresence] = useState<UserPresence[]>([])
  const [currentLocks, setCurrentLocks] = useState<ResourceLock[]>([])
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([])
  const [notifications, setNotifications] = useState<RealtimeNotification[]>([])

  useEffect(() => {
    initializeCollaboration()
    
    return () => {
      collaborationService.cleanup()
    }
  }, [workspaceId, userId])

  const initializeCollaboration = async () => {
    if (!workspaceId || !userId) {
      console.warn('Collaboration provider: Missing workspaceId or userId')
      return
    }

    try {
      const initialized = await collaborationService.initialize(workspaceId, userId)
      setIsInitialized(initialized)

      if (initialized) {
        console.log('Collaboration provider: Initialized successfully')
        
        // Set up event listeners
        setupEventListeners()
        
        // Load initial activity
        const activities = await collaborationService.getActivityFeed(20)
        setRecentActivity(activities)
      }
    } catch (error) {
      console.error('Collaboration provider: Initialization failed', error)
      setIsInitialized(false)
    }
  }

  const setupEventListeners = () => {
    // Presence updates
    const unsubscribePresence = collaborationService.onPresenceUpdate((presence) => {
      setCurrentPresence(presence)
      console.log('Collaboration provider: Presence updated', presence)
    })

    // Lock updates
    const unsubscribeLocks = collaborationService.onLockUpdate((locks) => {
      setCurrentLocks(locks)
      console.log('Collaboration provider: Locks updated', locks)
    })

    // Activity updates
    const unsubscribeActivity = collaborationService.onActivityUpdate((activities) => {
      setRecentActivity(prev => {
        // Merge new activities with existing ones
        const merged = [...activities, ...prev]
        
        // Remove duplicates and sort by created_at
        const unique = merged.filter((item, index, arr) => 
          arr.findIndex(other => other.id === item.id) === index
        )
        
        return unique
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 50) // Keep only latest 50 activities
      })
    })

    // Notification updates
    const unsubscribeNotifications = collaborationService.onNotification((notification) => {
      setNotifications(prev => [notification, ...prev.slice(0, 9)]) // Keep latest 10 notifications
      
      // Show browser notification if permission granted
      if (Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.message,
          icon: '/icon-192.png',
          tag: notification.id
        })
      }
    })

    // Return cleanup function
    return () => {
      unsubscribePresence()
      unsubscribeLocks()
      unsubscribeActivity()
      unsubscribeNotifications()
    }
  }

  // Wrapper methods for collaboration service
  const updatePresence = async (
    status: 'online' | 'away' | 'busy' | 'offline', 
    options: any = {}
  ): Promise<boolean> => {
    return await collaborationService.updatePresence(status, options)
  }

  const isUserOnline = (userId: string): boolean => {
    return collaborationService.isUserOnline(userId)
  }

  const getUserPresence = (userId: string): UserPresence | undefined => {
    return collaborationService.getUserPresence(userId)
  }

  const acquireResourceLock = async (
    resourceType: string,
    resourceId: string,
    lockType: 'editing' | 'viewing' | 'processing' = 'editing',
    options: any = {}
  ): Promise<any> => {
    return await collaborationService.acquireResourceLock(resourceType, resourceId, lockType, options)
  }

  const releaseResourceLock = async (
    resourceType: string,
    resourceId: string,
    lockType: 'editing' | 'viewing' | 'processing' = 'editing'
  ): Promise<boolean> => {
    return await collaborationService.releaseResourceLock(resourceType, resourceId, lockType)
  }

  const isResourceLocked = async (
    resourceType: string,
    resourceId: string,
    lockType: 'editing' | 'viewing' | 'processing' = 'editing'
  ): Promise<any> => {
    return await collaborationService.isResourceLocked(resourceType, resourceId, lockType)
  }

  const getResourceLocks = async (
    resourceType: string,
    resourceId: string
  ): Promise<ResourceLock[]> => {
    return await collaborationService.getResourceLocks(resourceType, resourceId)
  }

  const logActivity = async (
    activityType: string,
    resourceType: string,
    resourceId: string,
    resourceName: string,
    options: any = {}
  ): Promise<boolean> => {
    return await collaborationService.logActivity(activityType, resourceType, resourceId, resourceName, options)
  }

  const getActivityFeed = async (limit: number = 50): Promise<ActivityItem[]> => {
    return await collaborationService.getActivityFeed(limit)
  }

  const contextValue: CollaborationContextType = {
    isInitialized,
    currentPresence,
    currentLocks,
    recentActivity,
    updatePresence,
    isUserOnline,
    getUserPresence,
    acquireResourceLock,
    releaseResourceLock,
    isResourceLocked,
    getResourceLocks,
    logActivity,
    getActivityFeed
  }

  return (
    <CollaborationContext.Provider value={contextValue}>
      {children}
    </CollaborationContext.Provider>
  )
}

// Hook to use collaboration context
export function useCollaboration(): CollaborationContextType {
  const context = useContext(CollaborationContext)
  
  if (!context) {
    throw new Error('useCollaboration must be used within a CollaborationProvider')
  }
  
  return context
}

// Hook for presence only
export function usePresence(): {
  currentPresence: UserPresence[]
  isUserOnline: (userId: string) => boolean
  getUserPresence: (userId: string) => UserPresence | undefined
  updatePresence: (status: 'online' | 'away' | 'busy' | 'offline', options?: any) => Promise<boolean>
} {
  const { currentPresence, isUserOnline, getUserPresence, updatePresence } = useCollaboration()
  
  return {
    currentPresence,
    isUserOnline,
    getUserPresence,
    updatePresence
  }
}

// Hook for resource locks only
export function useResourceLocks(resourceType?: string, resourceId?: string): {
  currentLocks: ResourceLock[]
  acquireResourceLock: (resourceType: string, resourceId: string, lockType?: 'editing' | 'viewing' | 'processing', options?: any) => Promise<any>
  releaseResourceLock: (resourceType: string, resourceId: string, lockType?: 'editing' | 'viewing' | 'processing') => Promise<boolean>
  isResourceLocked: (resourceType: string, resourceId: string, lockType?: 'editing' | 'viewing' | 'processing') => Promise<any>
  getResourceLocks: (resourceType: string, resourceId: string) => Promise<ResourceLock[]>
  isCurrentResourceLocked: boolean
  currentResourceLocks: ResourceLock[]
} {
  const { 
    currentLocks, 
    acquireResourceLock, 
    releaseResourceLock, 
    isResourceLocked, 
    getResourceLocks 
  } = useCollaboration()
  
  const isCurrentResourceLocked = resourceType && resourceId 
    ? currentLocks.some(lock => 
        lock.resource_type === resourceType && 
        lock.resource_id === resourceId
      )
    : false
  
  const currentResourceLocks = resourceType && resourceId
    ? currentLocks.filter(lock => 
        lock.resource_type === resourceType && 
        lock.resource_id === resourceId
      )
    : []
  
  return {
    currentLocks,
    acquireResourceLock,
    releaseResourceLock,
    isResourceLocked,
    getResourceLocks,
    isCurrentResourceLocked,
    currentResourceLocks
  }
}

// Hook for activity feed only
export function useActivityFeed(): {
  recentActivity: ActivityItem[]
  logActivity: (activityType: string, resourceType: string, resourceId: string, resourceName: string, options?: any) => Promise<boolean>
  getActivityFeed: (limit?: number) => Promise<ActivityItem[]>
} {
  const { recentActivity, logActivity, getActivityFeed } = useCollaboration()
  
  return {
    recentActivity,
    logActivity,
    getActivityFeed
  }
}