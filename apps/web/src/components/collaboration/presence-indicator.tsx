'use client'

import { useState, useEffect } from 'react'
import { 
  Users, 
  Circle, 
  Monitor, 
  Smartphone, 
  Tablet,
  Clock,
  Eye,
  Edit,
  Settings
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { usePresence, useResourceLocks } from './collaboration-provider'
import { UserPresence, ResourceLock } from '@/lib/collaboration/collaboration-service'

interface PresenceIndicatorProps {
  userId?: string
  className?: string
  showStatus?: boolean
  showDevice?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function PresenceIndicator({ 
  userId, 
  className = '', 
  showStatus = true,
  showDevice = false,
  size = 'md' 
}: PresenceIndicatorProps) {
  const { getUserPresence, isUserOnline } = usePresence()
  const presence = userId ? getUserPresence(userId) : null
  const online = userId ? isUserOnline(userId) : false

  if (!userId || !presence) {
    return null
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500'
      case 'away': return 'bg-yellow-500'
      case 'busy': return 'bg-red-500'
      case 'offline': return 'bg-gray-400'
      default: return 'bg-gray-400'
    }
  }

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'mobile': return <Smartphone className="w-3 h-3" />
      case 'tablet': return <Tablet className="w-3 h-3" />
      case 'desktop': 
      default: return <Monitor className="w-3 h-3" />
    }
  }

  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10'
  }

  const statusSizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3'
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`relative inline-flex ${className}`}>
            <Avatar className={sizeClasses[size]}>
              <AvatarImage 
                src={presence.user_profiles?.avatar_url} 
                alt={`${presence.user_profiles?.first_name} ${presence.user_profiles?.last_name}`}
              />
              <AvatarFallback className="text-xs">
                {presence.user_profiles?.first_name?.[0]}{presence.user_profiles?.last_name?.[0]}
              </AvatarFallback>
            </Avatar>
            
            {showStatus && (
              <div 
                className={`
                  absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-white dark:border-gray-800
                  ${statusSizeClasses[size]} ${getStatusColor(presence.status)}
                `}
              />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${getStatusColor(presence.status)}`} />
              <span className="font-medium">
                {presence.user_profiles?.first_name} {presence.user_profiles?.last_name}
              </span>
            </div>
            
            <div className="text-xs text-muted-foreground space-y-1">
              <div className="flex items-center gap-1">
                <Circle className="w-3 h-3" />
                <span className="capitalize">{presence.status}</span>
                {presence.custom_status && (
                  <span className="text-xs">• {presence.custom_status}</span>
                )}
              </div>
              
              {showDevice && (
                <div className="flex items-center gap-1">
                  {getDeviceIcon(presence.device_type)}
                  <span className="capitalize">{presence.device_type}</span>
                </div>
              )}
              
              {presence.current_page && (
                <div className="flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  <span>Viewing {presence.current_page}</span>
                </div>
              )}
              
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>
                  Last seen {new Date(presence.last_seen).toLocaleTimeString()}
                </span>
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Team presence overview component
export function TeamPresence({ className = '' }: { className?: string }) {
  const { currentPresence } = usePresence()
  const [showAll, setShowAll] = useState(false)

  const onlineUsers = currentPresence.filter(p => p.status !== 'offline')
  const displayUsers = showAll ? onlineUsers : onlineUsers.slice(0, 5)
  const remainingCount = onlineUsers.length - 5

  if (onlineUsers.length === 0) {
    return null
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex items-center -space-x-2">
        {displayUsers.map((presence) => (
          <PresenceIndicator
            key={presence.user_id}
            userId={presence.user_id}
            size="sm"
            className="ring-2 ring-white dark:ring-gray-800"
          />
        ))}
        
        {!showAll && remainingCount > 0 && (
          <button
            onClick={() => setShowAll(true)}
            className="
              flex items-center justify-center w-6 h-6 
              bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700
              rounded-full text-xs font-medium border-2 border-white dark:border-gray-800
              transition-colors
            "
          >
            +{remainingCount}
          </button>
        )}
      </div>
      
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <Users className="w-4 h-4" />
        <span>{onlineUsers.length} online</span>
      </div>
    </div>
  )
}

// Resource collaborators component
export function ResourceCollaborators({ 
  resourceType, 
  resourceId, 
  className = '' 
}: {
  resourceType: string
  resourceId: string
  className?: string
}) {
  const { currentPresence } = usePresence()
  const { currentResourceLocks } = useResourceLocks(resourceType, resourceId)

  // Find users currently viewing/editing this resource
  const collaborators = currentPresence.filter(presence => 
    presence.current_resource_type === resourceType && 
    presence.current_resource_id === resourceId
  )

  const editingUsers = currentResourceLocks.filter(lock => lock.lock_type === 'editing')
  const viewingUsers = collaborators.filter(user => 
    !editingUsers.some(lock => lock.locked_by_user_id === user.user_id)
  )

  if (collaborators.length === 0) {
    return null
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {editingUsers.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex items-center -space-x-2">
            {editingUsers.map((lock) => {
              const presence = currentPresence.find(p => p.user_id === lock.locked_by_user_id)
              return presence ? (
                <PresenceIndicator
                  key={lock.locked_by_user_id}
                  userId={lock.locked_by_user_id}
                  size="sm"
                  className="ring-2 ring-white dark:ring-gray-800"
                />
              ) : null
            })}
          </div>
          <Badge variant="destructive" className="text-xs">
            <Edit className="w-3 h-3 mr-1" />
            Editing
          </Badge>
        </div>
      )}

      {viewingUsers.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex items-center -space-x-2">
            {viewingUsers.slice(0, 3).map((presence) => (
              <PresenceIndicator
                key={presence.user_id}
                userId={presence.user_id}
                size="sm"
                className="ring-2 ring-white dark:ring-gray-800"
              />
            ))}
            {viewingUsers.length > 3 && (
              <div className="
                flex items-center justify-center w-6 h-6 
                bg-gray-100 dark:bg-gray-800 rounded-full text-xs font-medium 
                border-2 border-white dark:border-gray-800
              ">
                +{viewingUsers.length - 3}
              </div>
            )}
          </div>
          <Badge variant="secondary" className="text-xs">
            <Eye className="w-3 h-3 mr-1" />
            Viewing
          </Badge>
        </div>
      )}
    </div>
  )
}

// Presence status selector
export function PresenceStatusSelector({ className = '' }: { className?: string }) {
  const { getUserPresence, updatePresence } = usePresence()
  const [isOpen, setIsOpen] = useState(false)
  
  // Assuming current user - in real app, get from auth context
  const currentUserId = 'current-user-id' // Replace with actual current user ID
  const currentPresence = getUserPresence(currentUserId)

  const statuses = [
    { value: 'online', label: 'Online', color: 'bg-green-500', description: 'Available for collaboration' },
    { value: 'away', label: 'Away', color: 'bg-yellow-500', description: 'Stepped away temporarily' },
    { value: 'busy', label: 'Busy', color: 'bg-red-500', description: 'Do not disturb' },
    { value: 'offline', label: 'Offline', color: 'bg-gray-400', description: 'Not available' }
  ]

  const handleStatusChange = async (status: 'online' | 'away' | 'busy' | 'offline') => {
    await updatePresence(status)
    setIsOpen(false)
  }

  if (!currentPresence) {
    return null
  }

  const currentStatus = statuses.find(s => s.value === currentPresence.status) || statuses[0]

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`flex items-center gap-2 ${className}`}
        >
          <div className={`w-2 h-2 rounded-full ${currentStatus.color}`} />
          <span className="text-sm">{currentStatus.label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56" side="bottom" align="start">
        <div className="space-y-1">
          <div className="text-sm font-medium mb-2">Set your status</div>
          {statuses.map((status) => (
            <button
              key={status.value}
              onClick={() => handleStatusChange(status.value as any)}
              className="
                w-full flex items-center gap-3 px-2 py-2 text-sm
                hover:bg-muted rounded-md transition-colors
              "
            >
              <div className={`w-3 h-3 rounded-full ${status.color}`} />
              <div className="flex-1 text-left">
                <div className="font-medium">{status.label}</div>
                <div className="text-xs text-muted-foreground">{status.description}</div>
              </div>
              {currentPresence.status === status.value && (
                <Circle className="w-4 h-4 fill-current" />
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}