'use client'

import { useState, useEffect, useCallback, ReactNode } from 'react'
import { 
  AlertTriangle, 
  Lock, 
  Eye, 
  Edit, 
  Clock, 
  User,
  Shield,
  Unlock
} from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useResourceLocks, usePresence } from './collaboration-provider'
import { ResourceLock } from '@/lib/collaboration/collaboration-service'

interface CollisionGuardProps {
  resourceType: string
  resourceId: string
  lockType?: 'editing' | 'viewing' | 'processing'
  autoAcquire?: boolean
  autoRelease?: boolean
  autoReleaseMinutes?: number
  children: ReactNode
  onLockAcquired?: (lockId: string) => void
  onLockFailed?: (error: string, existingLock?: ResourceLock) => void
  onLockReleased?: () => void
  className?: string
}

export function CollisionGuard({
  resourceType,
  resourceId,
  lockType = 'editing',
  autoAcquire = true,
  autoRelease = true,
  autoReleaseMinutes = 30,
  children,
  onLockAcquired,
  onLockFailed,
  onLockReleased,
  className = ''
}: CollisionGuardProps) {
  const {
    acquireResourceLock,
    releaseResourceLock,
    isResourceLocked,
    getResourceLocks,
    currentResourceLocks,
    isCurrentResourceLocked
  } = useResourceLocks(resourceType, resourceId)
  
  const { getUserPresence } = usePresence()
  
  const [lockStatus, setLockStatus] = useState<{
    hasLock: boolean
    lockId?: string
    isLocked: boolean
    lockedBy?: any
    existingLock?: ResourceLock
    isLoading: boolean
    error?: string
  }>({
    hasLock: false,
    isLocked: false,
    isLoading: false
  })

  // Check lock status when component mounts or resource changes
  useEffect(() => {
    checkLockStatus()
  }, [resourceType, resourceId, lockType])

  // Auto-acquire lock when component mounts
  useEffect(() => {
    if (autoAcquire && !lockStatus.hasLock && !lockStatus.isLocked) {
      acquireLock()
    }
  }, [autoAcquire, resourceType, resourceId, lockType])

  // Auto-release lock when component unmounts
  useEffect(() => {
    return () => {
      if (autoRelease && lockStatus.hasLock) {
        releaseLock()
      }
    }
  }, [autoRelease, lockStatus.hasLock])

  const checkLockStatus = useCallback(async () => {
    setLockStatus(prev => ({ ...prev, isLoading: true }))
    
    try {
      const lockResult = await isResourceLocked(resourceType, resourceId, lockType)
      
      setLockStatus(prev => ({
        ...prev,
        isLocked: lockResult.isLocked,
        lockedBy: lockResult.lockedBy,
        existingLock: lockResult.lock,
        isLoading: false,
        error: undefined
      }))
    } catch (error) {
      console.error('Failed to check lock status:', error)
      setLockStatus(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to check lock status'
      }))
    }
  }, [resourceType, resourceId, lockType, isResourceLocked])

  const acquireLock = useCallback(async () => {
    setLockStatus(prev => ({ ...prev, isLoading: true }))
    
    try {
      const result = await acquireResourceLock(resourceType, resourceId, lockType, {
        autoReleaseMinutes,
        lockReason: `Editing ${resourceType}`
      })

      if (result.success) {
        setLockStatus(prev => ({
          ...prev,
          hasLock: true,
          lockId: result.lockId,
          isLocked: false,
          isLoading: false,
          error: undefined
        }))
        
        onLockAcquired?.(result.lockId)
      } else {
        // Check current lock status for better error info
        await checkLockStatus()
        
        setLockStatus(prev => ({
          ...prev,
          hasLock: false,
          isLoading: false,
          error: result.message || result.error
        }))
        
        onLockFailed?.(result.error || result.message, lockStatus.existingLock)
      }
    } catch (error) {
      console.error('Failed to acquire lock:', error)
      setLockStatus(prev => ({
        ...prev,
        hasLock: false,
        isLoading: false,
        error: 'Failed to acquire lock'
      }))
      
      onLockFailed?.('Failed to acquire lock')
    }
  }, [resourceType, resourceId, lockType, autoReleaseMinutes, acquireResourceLock, onLockAcquired, onLockFailed])

  const releaseLock = useCallback(async () => {
    if (!lockStatus.hasLock) return
    
    try {
      const success = await releaseResourceLock(resourceType, resourceId, lockType)
      
      if (success) {
        setLockStatus(prev => ({
          ...prev,
          hasLock: false,
          lockId: undefined,
          error: undefined
        }))
        
        onLockReleased?.()
      }
    } catch (error) {
      console.error('Failed to release lock:', error)
    }
  }, [resourceType, resourceId, lockType, lockStatus.hasLock, releaseResourceLock, onLockReleased])

  const tryAcquireLock = () => {
    acquireLock()
  }

  const forceTakeOver = async () => {
    // First release any existing lock, then acquire new one
    try {
      await releaseResourceLock(resourceType, resourceId, lockType)
      await acquireLock()
    } catch (error) {
      console.error('Failed to take over lock:', error)
    }
  }

  // Render lock conflict warning
  if (lockStatus.isLocked && !lockStatus.hasLock && lockStatus.existingLock) {
    const lockedByUser = getUserPresence(lockStatus.existingLock.locked_by_user_id)
    
    return (
      <div className={className}>
        <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    {lockedByUser && (
                      <Avatar className="w-6 h-6">
                        <AvatarImage src={lockedByUser.user_profiles?.avatar_url} />
                        <AvatarFallback className="text-xs">
                          {lockedByUser.user_profiles?.first_name?.[0]}{lockedByUser.user_profiles?.last_name?.[0]}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div>
                      <p className="font-medium text-orange-800 dark:text-orange-200">
                        Resource is currently being edited
                      </p>
                      <p className="text-sm text-orange-600 dark:text-orange-300">
                        {lockedByUser 
                          ? `${lockedByUser.user_profiles?.first_name} ${lockedByUser.user_profiles?.last_name} is editing this ${resourceType}`
                          : `Another user is editing this ${resourceType}`
                        }
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    <Lock className="w-3 h-3 mr-1" />
                    Locked
                  </Badge>
                  {lockStatus.existingLock.auto_release_at && (
                    <Badge variant="secondary" className="text-xs">
                      <Clock className="w-3 h-3 mr-1" />
                      Auto-release at {new Date(lockStatus.existingLock.auto_release_at).toLocaleTimeString()}
                    </Badge>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={checkLockStatus}
                  disabled={lockStatus.isLoading}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Only
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={tryAcquireLock}
                  disabled={lockStatus.isLoading}
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
                
                {/* Only show take over option if lock is old or user has admin permissions */}
                {lockStatus.existingLock.auto_release_at && 
                 new Date(lockStatus.existingLock.auto_release_at) < new Date() && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={forceTakeOver}
                    disabled={lockStatus.isLoading}
                  >
                    <Unlock className="w-4 h-4 mr-2" />
                    Take Over
                  </Button>
                )}
              </div>
            </div>
          </AlertDescription>
        </Alert>
        
        {/* Show children in read-only mode */}
        <div className="mt-4 opacity-75 pointer-events-none">
          {children}
        </div>
      </div>
    )
  }

  // Render loading state
  if (lockStatus.isLoading) {
    return (
      <div className={className}>
        <Alert>
          <Clock className="h-4 w-4 animate-spin" />
          <AlertDescription>
            Checking resource lock status...
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  // Render error state
  if (lockStatus.error && !lockStatus.hasLock) {
    return (
      <div className={className}>
        <Alert className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-medium text-red-800 dark:text-red-200">
                Failed to acquire editing lock
              </p>
              <p className="text-sm text-red-600 dark:text-red-300">
                {lockStatus.error}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={tryAcquireLock}
                className="mt-2"
              >
                <Edit className="w-4 h-4 mr-2" />
                Retry
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  // Render success state with lock acquired
  return (
    <div className={className}>
      {lockStatus.hasLock && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20 mb-4">
          <Shield className="h-4 w-4 text-green-600" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-green-800 dark:text-green-200">
                  You have editing access
                </p>
                <p className="text-sm text-green-600 dark:text-green-300">
                  Others will see that you're editing this {resourceType}
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                <Badge variant="default" className="bg-green-600">
                  <Edit className="w-3 h-3 mr-1" />
                  Editing
                </Badge>
                
                {autoRelease && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={releaseLock}
                    className="text-green-700 hover:text-green-800"
                  >
                    <Unlock className="w-4 h-4 mr-1" />
                    Release
                  </Button>
                )}
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      {children}
    </div>
  )
}

// Simple lock indicator for read-only views
export function LockIndicator({ 
  resourceType, 
  resourceId, 
  className = '' 
}: {
  resourceType: string
  resourceId: string
  className?: string
}) {
  const { currentResourceLocks } = useResourceLocks(resourceType, resourceId)
  const { getUserPresence } = usePresence()

  const editingLocks = currentResourceLocks.filter(lock => lock.lock_type === 'editing')
  
  if (editingLocks.length === 0) {
    return null
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {editingLocks.map((lock) => {
        const user = getUserPresence(lock.locked_by_user_id)
        return (
          <div key={lock.id} className="flex items-center gap-2">
            {user && (
              <Avatar className="w-5 h-5">
                <AvatarImage src={user.user_profiles?.avatar_url} />
                <AvatarFallback className="text-xs">
                  {user.user_profiles?.first_name?.[0]}{user.user_profiles?.last_name?.[0]}
                </AvatarFallback>
              </Avatar>
            )}
            <Badge variant="destructive" className="text-xs">
              <Lock className="w-3 h-3 mr-1" />
              Editing
            </Badge>
          </div>
        )
      })}
    </div>
  )
}