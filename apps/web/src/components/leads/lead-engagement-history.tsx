'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Mail, 
  Eye, 
  MousePointer, 
  MessageSquare,
  Send,
  X,
  AlertCircle
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface LeadEngagementHistoryProps {
  leadId: string
  leadEmail: string
}

const eventConfig = {
  sent: {
    icon: Send,
    label: 'Email Sent',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  opened: {
    icon: Eye,
    label: 'Email Opened',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  clicked: {
    icon: MousePointer,
    label: 'Link Clicked',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
  },
  replied: {
    icon: MessageSquare,
    label: 'Replied',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
  },
  bounced: {
    icon: X,
    label: 'Bounced',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
  },
  unsubscribed: {
    icon: AlertCircle,
    label: 'Unsubscribed',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
  },
}

export function LeadEngagementHistory({ leadId, leadEmail }: LeadEngagementHistoryProps) {
  const supabase = createClient()

  const { data: history, isLoading } = useQuery({
    queryKey: ['lead-engagement-history', leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_lead_engagement_history', {
          p_lead_id: leadId,
          p_limit: 50,
        })

      if (error) throw error
      return data
    },
  })

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">
            Loading engagement history...
          </div>
        </CardContent>
      </Card>
    )
  }

  const totalEvents = history?.length || 0
  const openedCount = history?.filter((e: any) => e.event_type === 'opened').length || 0
  const clickedCount = history?.filter((e: any) => e.event_type === 'clicked').length || 0
  const repliedCount = history?.filter((e: any) => e.event_type === 'replied').length || 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Engagement History</CardTitle>
        <CardDescription>
          Activity timeline for {leadEmail}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold">{totalEvents}</div>
            <p className="text-xs text-muted-foreground">Total Events</p>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{openedCount}</div>
            <p className="text-xs text-muted-foreground">Opens</p>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{clickedCount}</div>
            <p className="text-xs text-muted-foreground">Clicks</p>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{repliedCount}</div>
            <p className="text-xs text-muted-foreground">Replies</p>
          </div>
        </div>

        {/* Timeline */}
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4">
            {history && history.length > 0 ? (
              history.map((event: any, index: number) => {
                const config = eventConfig[event.event_type as keyof typeof eventConfig]
                const Icon = config?.icon || Mail

                return (
                  <div key={`${event.email_id}-${event.created_at}`} className="flex gap-3">
                    <div className={`p-2 rounded-full ${config?.bgColor || 'bg-gray-100'}`}>
                      <Icon className={`h-4 w-4 ${config?.color || 'text-gray-600'}`} />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">
                          {config?.label || event.event_type}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      
                      {event.campaign_name && (
                        <p className="text-sm text-muted-foreground">
                          Campaign: {event.campaign_name}
                        </p>
                      )}
                      
                      {event.subject && (
                        <p className="text-sm text-muted-foreground">
                          Subject: {event.subject}
                        </p>
                      )}
                      
                      {event.event_type === 'clicked' && event.metadata?.url && (
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            Clicked Link
                          </Badge>
                          <p className="text-xs text-muted-foreground truncate">
                            {event.metadata.url}
                          </p>
                        </div>
                      )}

                      {event.event_type === 'opened' && event.metadata?.user_agent && (
                        <p className="text-xs text-muted-foreground">
                          Device: {parseUserAgent(event.metadata.user_agent)}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="text-center py-8">
                <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No engagement history yet</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

function parseUserAgent(ua: string): string {
  if (ua.includes('Mobile')) return 'Mobile'
  if (ua.includes('Tablet')) return 'Tablet'
  if (ua.includes('Windows')) return 'Windows'
  if (ua.includes('Mac')) return 'Mac'
  if (ua.includes('Linux')) return 'Linux'
  return 'Unknown'
}