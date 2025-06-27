'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { 
  Mail, 
  User, 
  Clock, 
  CheckCheck,
  AlertCircle,
  Star
} from 'lucide-react'

interface EmailThread {
  id: string
  subject: string
  status: 'open' | 'closed' | 'archived' | 'spam'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  assigned_to?: string
  last_message_at: string
  last_message_from?: string
  message_count: number
  is_read: boolean
  tags: string[]
  lead?: {
    id: string
    name?: string
    email: string
    company?: string
  }
  assigned_user?: {
    id: string
    email: string
    name?: string
  }
}

interface ThreadListProps {
  threads: EmailThread[]
  selectedThread: string | null
  onSelectThread: (threadId: string) => void
  currentUserId?: string
}

const priorityConfig = {
  low: { color: 'text-gray-500', bgColor: 'bg-gray-100' },
  normal: { color: 'text-blue-600', bgColor: 'bg-blue-100' },
  high: { color: 'text-orange-600', bgColor: 'bg-orange-100' },
  urgent: { color: 'text-red-600', bgColor: 'bg-red-100' },
}

export function ThreadList({ 
  threads, 
  selectedThread, 
  onSelectThread,
  currentUserId 
}: ThreadListProps) {
  const getInitials = (name?: string, email?: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    }
    return email?.slice(0, 2).toUpperCase() || '??'
  }

  const getThreadPreview = (thread: EmailThread) => {
    // In a real app, this would show the last message preview
    return `From ${thread.last_message_from || 'Unknown'} • ${thread.message_count} message${thread.message_count !== 1 ? 's' : ''}`
  }

  if (threads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4">
        <Mail className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground text-center">
          No conversations yet
        </p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-border">
      {threads.map((thread) => {
        const isAssignedToMe = thread.assigned_to === currentUserId
        const priorityStyle = priorityConfig[thread.priority]
        
        return (
          <div
            key={thread.id}
            onClick={() => onSelectThread(thread.id)}
            className={cn(
              'p-4 hover:bg-accent cursor-pointer transition-colors',
              selectedThread === thread.id && 'bg-accent',
              !thread.is_read && 'bg-blue-50/50'
            )}
          >
            <div className="flex items-start gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={thread.lead?.email ? `https://api.dicebear.com/7.x/initials/svg?seed=${thread.lead.email}` : undefined} />
                <AvatarFallback>
                  {getInitials(thread.lead?.name, thread.lead?.email)}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className={cn(
                        'font-medium truncate',
                        !thread.is_read && 'font-semibold'
                      )}>
                        {thread.lead?.name || thread.lead?.email || 'Unknown'}
                      </h3>
                      {thread.lead?.company && (
                        <span className="text-xs text-muted-foreground">
                          {thread.lead.company}
                        </span>
                      )}
                    </div>
                    <p className={cn(
                      'text-sm truncate',
                      !thread.is_read ? 'font-medium' : 'text-muted-foreground'
                    )}>
                      {thread.subject}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1">
                      {getThreadPreview(thread)}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(thread.last_message_at), { addSuffix: true })}
                    </span>
                    
                    <div className="flex items-center gap-1">
                      {thread.priority !== 'normal' && (
                        <div className={cn(
                          'p-1 rounded',
                          priorityStyle.bgColor
                        )}>
                          <AlertCircle className={cn('h-3 w-3', priorityStyle.color)} />
                        </div>
                      )}
                      
                      {isAssignedToMe && (
                        <Badge variant="secondary" className="text-xs px-1 py-0">
                          Me
                        </Badge>
                      )}
                      
                      {thread.status === 'closed' && (
                        <CheckCheck className="h-4 w-4 text-green-600" />
                      )}
                    </div>
                  </div>
                </div>

                {thread.tags.length > 0 && (
                  <div className="flex gap-1 mt-2">
                    {thread.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {thread.tags.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{thread.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}