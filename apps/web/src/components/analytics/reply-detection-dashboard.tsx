'use client'

import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DatePickerWithRange } from '@/components/ui/date-range-picker'
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts'
import { 
  MessageSquare,
  Mail,
  AlertCircle,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Eye,
  ExternalLink,
  User,
  Filter,
  Search
} from 'lucide-react'
import { DateRange } from 'react-day-picker'
import { formatDistanceToNow, format, subDays } from 'date-fns'
import { cn } from '@/lib/utils'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface ReplyDetectionDashboardProps {
  workspaceId: string
}

interface ReplyMetrics {
  totalProcessed: number
  replyRate: number
  autoReplyRate: number
  bounceRate: number
  genuineReplyRate: number
  avgReplyScore: number
}

interface RecentReply {
  id: string
  lead_id: string
  lead_name?: string
  lead_email: string
  subject: string
  reply_type: 'genuine_reply' | 'auto_reply' | 'bounce' | 'out_of_office'
  reply_score: number
  timestamp: string
  campaign_id?: string
  campaign_name?: string
  thread_id?: string
}

interface ReplyScoreDistribution {
  score_range: string
  count: number
  percentage: number
}

export function ReplyDetectionDashboard({ workspaceId }: ReplyDetectionDashboardProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  })
  const [replyTypeFilter, setReplyTypeFilter] = useState<string>('all')
  const [minScoreFilter, setMinScoreFilter] = useState<number>(0)
  const [campaignFilter, setCampaignFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [realtimeChannel, setRealtimeChannel] = useState<RealtimeChannel | null>(null)

  // Fetch overall metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['reply-metrics', workspaceId, dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_reply_detection_metrics', {
          p_workspace_id: workspaceId,
          p_start_date: dateRange?.from?.toISOString(),
          p_end_date: dateRange?.to?.toISOString(),
        })

      if (error) throw error

      return data as ReplyMetrics
    },
    enabled: !!workspaceId,
  })

  // Fetch recent replies
  const { data: recentReplies, isLoading: repliesLoading } = useQuery({
    queryKey: ['recent-replies', workspaceId, dateRange, replyTypeFilter, minScoreFilter, campaignFilter, searchQuery],
    queryFn: async () => {
      let query = supabase
        .from('email_events')
        .select(`
          id,
          created_at,
          metadata,
          campaign_emails!inner(
            id,
            subject,
            campaign_id,
            campaigns(id, name),
            leads!inner(id, name, email)
          )
        `)
        .eq('event_type', 'replied')
        .eq('campaign_emails.campaigns.workspace_id', workspaceId)
        .gte('created_at', dateRange?.from?.toISOString() || '')
        .lte('created_at', dateRange?.to?.toISOString() || '')
        .order('created_at', { ascending: false })
        .limit(100)

      if (replyTypeFilter !== 'all') {
        query = query.eq('metadata->>reply_type', replyTypeFilter)
      }

      if (minScoreFilter > 0) {
        query = query.gte('metadata->>reply_score', minScoreFilter)
      }

      if (campaignFilter !== 'all') {
        query = query.eq('campaign_emails.campaign_id', campaignFilter)
      }

      if (searchQuery) {
        query = query.or(`campaign_emails.leads.email.ilike.%${searchQuery}%,campaign_emails.leads.name.ilike.%${searchQuery}%`)
      }

      const { data, error } = await query

      if (error) throw error

      return data.map((event: any) => ({
        id: event.id,
        lead_id: event.campaign_emails.leads.id,
        lead_name: event.campaign_emails.leads.name,
        lead_email: event.campaign_emails.leads.email,
        subject: event.campaign_emails.subject,
        reply_type: event.metadata?.reply_type || 'genuine_reply',
        reply_score: event.metadata?.reply_score || 0,
        timestamp: event.created_at,
        campaign_id: event.campaign_emails.campaign_id,
        campaign_name: event.campaign_emails.campaigns?.name,
        thread_id: event.metadata?.thread_id,
      })) as RecentReply[]
    },
    enabled: !!workspaceId,
  })

  // Fetch reply trends
  const { data: replyTrends, isLoading: trendsLoading } = useQuery({
    queryKey: ['reply-trends', workspaceId, dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_reply_trends', {
          p_workspace_id: workspaceId,
          p_start_date: dateRange?.from?.toISOString(),
          p_end_date: dateRange?.to?.toISOString(),
        })

      if (error) throw error

      return data.map((item: any) => ({
        date: format(new Date(item.date), 'MMM dd'),
        genuine: item.genuine_replies,
        autoReply: item.auto_replies,
        bounce: item.bounces,
        outOfOffice: item.out_of_office,
        total: item.total_replies,
      }))
    },
    enabled: !!workspaceId,
  })

  // Fetch reply score distribution
  const { data: scoreDistribution, isLoading: distributionLoading } = useQuery({
    queryKey: ['reply-score-distribution', workspaceId, dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_reply_score_distribution', {
          p_workspace_id: workspaceId,
          p_start_date: dateRange?.from?.toISOString(),
          p_end_date: dateRange?.to?.toISOString(),
        })

      if (error) throw error

      return data as ReplyScoreDistribution[]
    },
    enabled: !!workspaceId,
  })

  // Fetch campaigns for filter
  const { data: campaigns } = useQuery({
    queryKey: ['campaigns-list', workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaigns')
        .select('id, name')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data
    },
    enabled: !!workspaceId,
  })

  // Set up real-time subscriptions
  useEffect(() => {
    if (!workspaceId) return

    const channel = supabase
      .channel(`reply-detection-${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'email_events',
          filter: `event_type=eq.replied`,
        },
        () => {
          // Refetch queries when new replies come in
          queryClient.invalidateQueries({ queryKey: ['reply-metrics', workspaceId] })
          queryClient.invalidateQueries({ queryKey: ['recent-replies', workspaceId] })
          queryClient.invalidateQueries({ queryKey: ['reply-trends', workspaceId] })
          queryClient.invalidateQueries({ queryKey: ['reply-score-distribution', workspaceId] })
        }
      )
      .subscribe()

    setRealtimeChannel(channel)

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [workspaceId, supabase, queryClient])

  const getReplyTypeIcon = (type: string) => {
    switch (type) {
      case 'genuine_reply':
        return <MessageSquare className="h-4 w-4 text-green-600" />
      case 'auto_reply':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />
      case 'bounce':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'out_of_office':
        return <Clock className="h-4 w-4 text-blue-600" />
      default:
        return <Mail className="h-4 w-4 text-gray-600" />
    }
  }

  const getReplyTypeBadge = (type: string) => {
    const config = {
      genuine_reply: { label: 'Genuine Reply', className: 'bg-green-100 text-green-800' },
      auto_reply: { label: 'Auto-Reply', className: 'bg-yellow-100 text-yellow-800' },
      bounce: { label: 'Bounce', className: 'bg-red-100 text-red-800' },
      out_of_office: { label: 'Out of Office', className: 'bg-blue-100 text-blue-800' },
    }

    const { label, className } = config[type as keyof typeof config] || { label: type, className: 'bg-gray-100 text-gray-800' }

    return <Badge className={className}>{label}</Badge>
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    if (score >= 40) return 'text-orange-600'
    return 'text-red-600'
  }

  return (
    <div className="space-y-6">
      {/* Header with Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Reply Detection Dashboard</h2>
            <p className="text-muted-foreground">
              Monitor and analyze email replies with AI-powered detection
            </p>
          </div>
          <DatePickerWithRange
            date={dateRange}
            onDateChange={setDateRange}
          />
        </div>

        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={replyTypeFilter} onValueChange={setReplyTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All reply types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All reply types</SelectItem>
                <SelectItem value="genuine_reply">Genuine Replies</SelectItem>
                <SelectItem value="auto_reply">Auto-Replies</SelectItem>
                <SelectItem value="bounce">Bounces</SelectItem>
                <SelectItem value="out_of_office">Out of Office</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Select value={minScoreFilter.toString()} onValueChange={(v) => setMinScoreFilter(parseInt(v))}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Min reply score" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">All scores</SelectItem>
                <SelectItem value="20">20+ score</SelectItem>
                <SelectItem value="40">40+ score</SelectItem>
                <SelectItem value="60">60+ score</SelectItem>
                <SelectItem value="80">80+ score</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Select value={campaignFilter} onValueChange={setCampaignFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All campaigns" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All campaigns</SelectItem>
                {campaigns?.map((campaign) => (
                  <SelectItem key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 max-w-sm">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by lead name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Overview */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Processed</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalProcessed || 0}</div>
            <p className="text-xs text-muted-foreground">
              Emails analyzed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reply Rate</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.replyRate?.toFixed(1) || 0}%</div>
            <Progress value={metrics?.replyRate || 0} className="h-2 mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Genuine Replies</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.genuineReplyRate?.toFixed(1) || 0}%</div>
            <Progress value={metrics?.genuineReplyRate || 0} className="h-2 mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Auto-Replies</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.autoReplyRate?.toFixed(1) || 0}%</div>
            <Progress value={metrics?.autoReplyRate || 0} className="h-2 mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bounce Rate</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.bounceRate?.toFixed(1) || 0}%</div>
            <Progress value={metrics?.bounceRate || 0} className="h-2 mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Reply Trends Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Reply Trends Over Time</CardTitle>
            <CardDescription>
              Daily breakdown of reply types
            </CardDescription>
          </CardHeader>
          <CardContent>
            {trendsLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-pulse text-muted-foreground">
                  Loading reply trends...
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={replyTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="genuine" 
                    stroke="#10b981" 
                    name="Genuine"
                    strokeWidth={2}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="autoReply" 
                    stroke="#eab308" 
                    name="Auto-Reply"
                    strokeWidth={2}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="bounce" 
                    stroke="#ef4444" 
                    name="Bounce"
                    strokeWidth={2}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="outOfOffice" 
                    stroke="#3b82f6" 
                    name="Out of Office"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Reply Score Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Reply Score Distribution</CardTitle>
            <CardDescription>
              Quality scores of detected replies
            </CardDescription>
          </CardHeader>
          <CardContent>
            {distributionLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-pulse text-muted-foreground">
                  Loading score distribution...
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={scoreDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="score_range" />
                  <YAxis />
                  <Tooltip />
                  <Bar 
                    dataKey="count" 
                    fill="#8884d8"
                    name="Replies"
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Replies Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Replies</CardTitle>
          <CardDescription>
            Latest detected replies with classification and scoring
          </CardDescription>
        </CardHeader>
        <CardContent>
          {repliesLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-pulse text-muted-foreground">
                Loading recent replies...
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentReplies?.map((reply) => (
                  <TableRow key={reply.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{reply.lead_name || 'Unknown'}</p>
                          <p className="text-sm text-muted-foreground">{reply.lead_email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="max-w-[300px] truncate">{reply.subject}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getReplyTypeIcon(reply.reply_type)}
                        {getReplyTypeBadge(reply.reply_type)}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={cn("font-semibold", getScoreColor(reply.reply_score))}>
                        {reply.reply_score}
                      </span>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{reply.campaign_name || 'N/A'}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(reply.timestamp), { addSuffix: true })}
                      </p>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {reply.thread_id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(`/inbox?thread=${reply.thread_id}`, '_blank')}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(`/leads/${reply.lead_id}`, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {(!recentReplies || recentReplies.length === 0) && (
              <div className="text-center py-8 text-muted-foreground">
                No replies found matching your filters
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}