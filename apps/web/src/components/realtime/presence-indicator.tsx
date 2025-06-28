'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { formatDistanceToNow } from 'date-fns'
import { Circle } from 'lucide-react'
import type { PresenceUser } from '@/lib/realtime/realtime-service'

interface PresenceIndicatorProps {
  users: PresenceUser[]
  maxVisible?: number
  showNames?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function PresenceIndicator({ 
  users, 
  maxVisible = 3, 
  showNames = false,
  size = 'md' 
}: PresenceIndicatorProps) {
  const visibleUsers = users.slice(0, maxVisible)
  const hiddenCount = Math.max(0, users.length - maxVisible)

  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-10 w-10'
  }

  const statusColors = {
    online: 'bg-green-500',
    away: 'bg-yellow-500',
    busy: 'bg-red-500'
  }

  if (users.length === 0) return null

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        {visibleUsers.map((user) => (
          <Tooltip key={user.user_id}>
            <TooltipTrigger asChild>
              <div className="relative">
                <Avatar className={sizeClasses[size]}>
                  <AvatarImage 
                    src={user.avatar} 
                    alt={user.name || user.email}
                  />
                  <AvatarFallback>
                    {(user.name || user.email).charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <Circle 
                  className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 border-2 border-background rounded-full ${
                    statusColors[user.status || 'online']
                  }`}
                  fill="currentColor"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-sm">
                <p className="font-medium">{user.name || user.email}</p>
                <p className="text-muted-foreground">
                  {user.status === 'online' ? 'Active now' : 
                   user.status === 'away' ? 'Away' :
                   user.status === 'busy' ? 'Busy' : 'Unknown'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Last seen {formatDistanceToNow(new Date(user.online_at))} ago
                </p>
                {user.current_page && (
                  <p className="text-xs text-muted-foreground">
                    Viewing: {user.current_page}
                  </p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        ))}

        {hiddenCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className={`${sizeClasses[size]} rounded-full p-0 text-xs`}>
                +{hiddenCount}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>{hiddenCount} more user{hiddenCount === 1 ? '' : 's'} online</p>
            </TooltipContent>
          </Tooltip>
        )}

        {showNames && (
          <div className="ml-2 text-sm text-muted-foreground">
            {users.slice(0, 2).map(u => u.name || u.email.split('@')[0]).join(', ')}
            {users.length > 2 && ` and ${users.length - 2} more`}
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}

interface TypingIndicatorProps {
  users: string[]
  className?: string
}

export function TypingIndicator({ users, className = '' }: TypingIndicatorProps) {
  if (users.length === 0) return null

  return (
    <div className={`flex items-center gap-2 text-sm text-muted-foreground ${className}`}>
      <div className="flex space-x-1">
        <div className="flex space-x-1">
          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.3s]"></div>
          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.15s]"></div>
          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
        </div>
      </div>
      <span>
        {users.length === 1 
          ? `${users[0]} is typing...`
          : users.length === 2
          ? `${users[0]} and ${users[1]} are typing...`
          : `${users[0]} and ${users.length - 1} others are typing...`
        }
      </span>
    </div>
  )
}