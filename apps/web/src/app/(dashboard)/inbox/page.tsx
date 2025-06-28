'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { 
  Search, 
  Inbox as InboxIcon,
  Send,
  Archive,
  Trash2,
  Star,
  Tag,
  Filter,
  MoreVertical,
  CheckCheck,
  Clock,
  AlertCircle,
  Users as UsersIcon,
  Wifi,
  WifiOff
} from 'lucide-react'
import { ThreadList } from '@/components/inbox/thread-list'
import { ThreadView } from '@/components/inbox/thread-view'
import { ThreadFilters } from '@/components/inbox/thread-filters'
import { useRealtimeSubscription, usePresence } from '@/hooks/use-realtime'

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
  messages?: EmailMessage[]
  participants?: ThreadParticipant[]
}

interface EmailMessage {
  id: string
  thread_id: string
  direction: 'inbound' | 'outbound'
  from_email: string
  from_name?: string
  to_emails: string[]
  subject: string
  body_text?: string
  body_html?: string
  is_read: boolean
  received_at: string
}

interface ThreadParticipant {
  user_id: string
  role: 'viewer' | 'responder' | 'owner'
  last_seen_at?: string
  user?: {
    id: string
    email: string
    name?: string
  }
}

type InboxFilter = 'all' | 'unread' | 'assigned' | 'unassigned' | 'closed'

export default function InboxPage() {
  const { workspace, dbUser } = useAuthStore()
  const [selectedThread, setSelectedThread] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<InboxFilter>('all')
  const queryClient = useQueryClient()

  // Fetch threads
  const { data: threads = [], isLoading } = useQuery({
    queryKey: ['inbox-threads', workspace?.id, filter, searchQuery],
    queryFn: async () => {
      if (!workspace) return []

      const params: any = {
        filter,
        search: searchQuery,
        assignedTo: filter === 'assigned' ? dbUser?.id : undefined,
      }

      const response = await api.inbox.threads.list(workspace.id, params)
      if (response.error) throw new Error(response.error)
      return response.data as EmailThread[]
    },
    enabled: !!workspace,
  })

  // Set up real-time subscriptions for inbox updates
  const { isConnected } = useRealtimeSubscription({
    channelName: `inbox:${workspace?.id}`,
    tables: ['email_threads', 'email_messages'],
    trackPresence: true,
    onTableChange: (event) => {
      console.log('Inbox change:', event)
      queryClient.invalidateQueries({ queryKey: ['inbox-threads'] })
      
      // Handle new messages
      if (event.table === 'email_messages' && event.action === 'INSERT' && event.new_record) {
        const isInbound = event.new_record.direction === 'inbound'
        if (isInbound && event.new_record.from_email) {
          toast.info('New message received', {
            description: `From: ${event.new_record.from_email}`,
          })
        }
      }
    },
  })

  // Track team presence
  const { presenceUsers, onlineUserCount } = usePresence()

  // Mark thread as read
  const markAsReadMutation = useMutation({
    mutationFn: async (threadId: string) => {
      if (!workspace) throw new Error('No workspace')
      
      const response = await api.inbox.threads.markRead(workspace.id, threadId)
      if (response.error) throw new Error(response.error)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox-threads'] })
    },
  })

  // Update thread status
  const updateThreadMutation = useMutation({
    mutationFn: async ({ 
      threadId, 
      updates 
    }: { 
      threadId: string
      updates: Partial<EmailThread> 
    }) => {
      if (!workspace) throw new Error('No workspace')
      
      const response = await api.inbox.threads.update(workspace.id, threadId, updates)
      if (response.error) throw new Error(response.error)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox-threads'] })
      toast.success('Thread updated')
    },
  })

  const selectedThreadData = threads.find(t => t.id === selectedThread)

  // Calculate inbox stats
  const stats = {
    total: threads.length,
    unread: threads.filter(t => !t.is_read).length,
    assigned: threads.filter(t => t.assigned_to === dbUser?.id).length,
    urgent: threads.filter(t => t.priority === 'urgent').length,
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Thread List */}
      <div className="w-96 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <InboxIcon className="h-6 w-6" />
              Inbox
              {isConnected ? (
                <Wifi className="h-4 w-4 text-green-500" title="Real-time connected" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-500" title="Real-time disconnected" />
              )}
            </h1>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{stats.unread} unread</Badge>
              {onlineUserCount > 1 && (
                <Badge variant="outline" className="gap-1">
                  <UsersIcon className="h-3 w-3" />
                  {onlineUserCount} online
                </Badge>
              )}
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Tabs value={filter} onValueChange={(v) => setFilter(v as InboxFilter)}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="unread">
                Unread {stats.unread > 0 && `(${stats.unread})`}
              </TabsTrigger>
              <TabsTrigger value="assigned">Mine</TabsTrigger>
              <TabsTrigger value="unassigned">Unassigned</TabsTrigger>
              <TabsTrigger value="closed">Closed</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <ScrollArea className="flex-1">
          <ThreadList
            threads={threads}
            selectedThread={selectedThread}
            onSelectThread={(threadId) => {
              setSelectedThread(threadId)
              markAsReadMutation.mutate(threadId)
            }}
            currentUserId={dbUser?.id}
          />
        </ScrollArea>

        {/* Quick Stats */}
        <div className="p-4 border-t border-border bg-muted/50">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Response Time</p>
              <p className="font-medium">~2 hours</p>
            </div>
            <div>
              <p className="text-muted-foreground">Active Convos</p>
              <p className="font-medium">{stats.total - threads.filter(t => t.status === 'closed').length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Thread View */}
      <div className="flex-1 flex flex-col">
        {selectedThreadData ? (
          <ThreadView
            thread={selectedThreadData}
            currentUser={dbUser}
            onUpdateThread={(updates) => 
              updateThreadMutation.mutate({ 
                threadId: selectedThreadData.id, 
                updates 
              })
            }
            onClose={() => setSelectedThread(null)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <InboxIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                Select a conversation to view
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}