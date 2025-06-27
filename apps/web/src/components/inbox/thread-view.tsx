'use client'

import { useState, useRef, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { toast } from 'sonner'
import { format, formatDistanceToNow } from 'date-fns'
import { 
  X, 
  MoreVertical, 
  Send, 
  Archive,
  Trash2,
  Tag,
  User,
  Clock,
  CheckCheck,
  AlertCircle,
  Paperclip,
  Smile,
  AtSign,
  Bold,
  Italic,
  Link,
  Quote,
  Sparkles
} from 'lucide-react'
import { GenerateEmailDialog } from '@/components/ai/generate-email-dialog'

interface EmailThread {
  id: string
  subject: string
  status: 'open' | 'closed' | 'archived' | 'spam'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  assigned_to?: string
  lead?: {
    id: string
    name?: string
    email: string
    company?: string
    title?: string
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
  user?: {
    id: string
    email: string
    name?: string
  }
}

interface ThreadViewProps {
  thread: EmailThread
  currentUser?: any
  onUpdateThread: (updates: Partial<EmailThread>) => void
  onClose: () => void
}

export function ThreadView({ thread, currentUser, onUpdateThread, onClose }: ThreadViewProps) {
  const [replyContent, setReplyContent] = useState('')
  const [isReplying, setIsReplying] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()
  const supabase = createClient()

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [thread.messages])

  // Send reply
  const sendReplyMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!thread.lead) throw new Error('No lead associated with thread')

      // Create message record
      const { data: message, error: messageError } = await supabase
        .from('email_messages')
        .insert({
          thread_id: thread.id,
          direction: 'outbound',
          from_email: currentUser?.email || 'noreply@coldcopy.cc',
          from_name: currentUser?.name || currentUser?.email,
          to_emails: [thread.lead.email],
          subject: `Re: ${thread.subject}`,
          body_text: content,
          body_html: `<p>${content.replace(/\n/g, '<br>')}</p>`,
          sent_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (messageError) throw messageError

      // Send actual email via API
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: [thread.lead.email],
          subject: `Re: ${thread.subject}`,
          content,
          recipientNames: [thread.lead.name],
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send email')
      }

      return message
    },
    onSuccess: () => {
      setReplyContent('')
      setIsReplying(false)
      queryClient.invalidateQueries({ queryKey: ['inbox-threads'] })
      toast.success('Reply sent successfully')
    },
    onError: (error) => {
      console.error('Reply error:', error)
      toast.error('Failed to send reply')
    },
  })

  const handleSendReply = () => {
    if (!replyContent.trim()) return
    sendReplyMutation.mutate(replyContent)
  }

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    }
    return email?.slice(0, 2).toUpperCase() || '??'
  }

  const assignToMeMutation = useMutation({
    mutationFn: async () => {
      onUpdateThread({ assigned_to: currentUser?.id })
    },
  })

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-4">
          <Avatar className="h-10 w-10">
            <AvatarImage src={thread.lead?.email ? `https://api.dicebear.com/7.x/initials/svg?seed=${thread.lead.email}` : undefined} />
            <AvatarFallback>
              {getInitials(thread.lead?.name, thread.lead?.email)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="font-semibold">{thread.lead?.name || thread.lead?.email || 'Unknown'}</h2>
            <p className="text-sm text-muted-foreground">
              {thread.lead?.company && `${thread.lead.company} • `}
              {thread.lead?.title && `${thread.lead.title} • `}
              {thread.lead?.email}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {thread.status === 'open' ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onUpdateThread({ status: 'closed' })}
            >
              <CheckCheck className="mr-2 h-4 w-4" />
              Mark as Closed
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onUpdateThread({ status: 'open' })}
            >
              Reopen
            </Button>
          )}

          {!thread.assigned_to && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => assignToMeMutation.mutate()}
            >
              <User className="mr-2 h-4 w-4" />
              Assign to Me
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Tag className="mr-2 h-4 w-4" />
                Add Tags
              </DropdownMenuItem>
              <DropdownMenuItem>
                <AlertCircle className="mr-2 h-4 w-4" />
                Change Priority
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Archive className="mr-2 h-4 w-4" />
                Archive Thread
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Thread
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Subject */}
      <div className="px-4 py-3 border-b border-border">
        <h3 className="font-medium">{thread.subject}</h3>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="space-y-4">
          {thread.messages?.map((message, index) => {
            const isInbound = message.direction === 'inbound'
            const isLastMessage = index === thread.messages!.length - 1
            
            return (
              <div key={message.id} className="space-y-2">
                {index > 0 && <Separator />}
                
                <div className={`flex gap-3 ${isInbound ? '' : 'flex-row-reverse'}`}>
                  <Avatar className="h-8 w-8">
                    <AvatarImage 
                      src={`https://api.dicebear.com/7.x/initials/svg?seed=${message.from_email}`} 
                    />
                    <AvatarFallback>
                      {getInitials(message.from_name, message.from_email)}
                    </AvatarFallback>
                  </Avatar>

                  <div className={`flex-1 ${isInbound ? '' : 'flex flex-col items-end'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">
                        {message.from_name || message.from_email}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(message.received_at), 'MMM d, h:mm a')}
                      </span>
                      {!isInbound && (
                        <Badge variant="secondary" className="text-xs">
                          Sent
                        </Badge>
                      )}
                    </div>

                    <div className={`rounded-lg p-3 ${
                      isInbound 
                        ? 'bg-muted' 
                        : 'bg-primary text-primary-foreground'
                    }`}>
                      <div 
                        className="text-sm whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{ 
                          __html: message.body_html || message.body_text || '' 
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </ScrollArea>

      {/* Reply Box */}
      <div className="border-t border-border p-4">
        <div className="space-y-4">
          {!isReplying ? (
            <div className="flex gap-2">
              <Button onClick={() => setIsReplying(true)} className="flex-1">
                <Send className="mr-2 h-4 w-4" />
                Reply
              </Button>
              <GenerateEmailDialog
                leadInfo={{
                  name: thread.lead?.name,
                  email: thread.lead?.email || '',
                  title: thread.lead?.title,
                  company: thread.lead?.company,
                }}
                onGenerated={(subject, body) => {
                  setReplyContent(body)
                  setIsReplying(true)
                }}
                trigger={
                  <Button variant="outline">
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Reply
                  </Button>
                }
              />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    Replying to {thread.lead?.name || thread.lead?.email}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsReplying(false)
                      setReplyContent('')
                    }}
                  >
                    Cancel
                  </Button>
                </div>
                
                <Textarea
                  placeholder="Type your reply..."
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  rows={6}
                  className="resize-none"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-between">
                <TooltipProvider>
                  <div className="flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" disabled>
                          <Bold className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Bold</TooltipContent>
                    </Tooltip>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" disabled>
                          <Italic className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Italic</TooltipContent>
                    </Tooltip>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" disabled>
                          <Link className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Insert Link</TooltipContent>
                    </Tooltip>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" disabled>
                          <Paperclip className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Attach File</TooltipContent>
                    </Tooltip>
                  </div>
                </TooltipProvider>

                <Button 
                  onClick={handleSendReply}
                  disabled={!replyContent.trim() || sendReplyMutation.isPending}
                >
                  {sendReplyMutation.isPending ? (
                    <>Sending...</>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send Reply
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}