'use client'

import { useState, use } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from 'sonner'
import { format } from 'date-fns'
import { 
  ArrowLeft, 
  Play, 
  Pause, 
  Edit, 
  Trash2,
  Users,
  Mail,
  Clock,
  TrendingUp,
  CheckCircle2,
  XCircle,
  AlertCircle,
  BarChart,
  Eye,
  MousePointer,
  Reply
} from 'lucide-react'

interface CampaignDetail {
  id: string
  name: string
  description?: string
  type: 'sequence' | 'one-off' | 'drip'
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived'
  created_at: string
  updated_at: string
  timezone: string
  schedule_settings: any
  daily_limit: number
  campaign_sequences: Array<{
    id: string
    sequence_number: number
    name: string
    subject: string
    body: string
    delay_days: number
    delay_hours: number
    condition_type?: string
  }>
  campaign_leads: Array<{
    id: string
    status: string
    current_sequence: number
    scheduled_at?: string
    started_at?: string
    completed_at?: string
    lead: {
      id: string
      email: string
      name?: string
      company?: string
    }
  }>
}

const statusConfig = {
  draft: {
    label: 'Draft',
    icon: Clock,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
  },
  active: {
    label: 'Active',
    icon: Play,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  paused: {
    label: 'Paused',
    icon: Pause,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle2,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  archived: {
    label: 'Archived',
    icon: XCircle,
    color: 'text-gray-500',
    bgColor: 'bg-gray-100',
  },
}

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const queryClient = useQueryClient()
  const supabase = createClient()

  // Fetch campaign details
  const { data: campaign, isLoading } = useQuery({
    queryKey: ['campaign', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaigns')
        .select(`
          *,
          campaign_sequences(*),
          campaign_leads(
            *,
            lead:leads(*)
          )
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      return data as CampaignDetail
    },
  })

  // Update campaign status
  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase
        .from('campaigns')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', id] })
      toast.success('Campaign status updated')
    },
    onError: (error) => {
      console.error('Status update error:', error)
      toast.error('Failed to update campaign status')
    },
  })

  // Delete campaign
  const deleteCampaignMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Campaign deleted')
      router.push('/campaigns')
    },
    onError: (error) => {
      console.error('Delete error:', error)
      toast.error('Failed to delete campaign')
    },
  })

  if (isLoading || !campaign) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  const status = statusConfig[campaign.status]
  const StatusIcon = status.icon

  // Calculate metrics
  const metrics = {
    totalLeads: campaign.campaign_leads.length,
    sent: campaign.campaign_leads.filter(l => ['in_progress', 'completed'].includes(l.status)).length,
    pending: campaign.campaign_leads.filter(l => l.status === 'pending').length,
    completed: campaign.campaign_leads.filter(l => l.status === 'completed').length,
    failed: campaign.campaign_leads.filter(l => l.status === 'failed').length,
  }

  const progressPercentage = metrics.totalLeads > 0 
    ? (metrics.sent / metrics.totalLeads) * 100 
    : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/campaigns')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{campaign.name}</h1>
            {campaign.description && (
              <p className="text-muted-foreground mt-1">{campaign.description}</p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 mr-4">
            <div className={`p-1.5 rounded ${status.bgColor}`}>
              <StatusIcon className={`h-4 w-4 ${status.color}`} />
            </div>
            <Badge variant="secondary">{status.label}</Badge>
          </div>
          
          {campaign.status === 'draft' && (
            <Button onClick={() => updateStatusMutation.mutate('active')}>
              <Play className="mr-2 h-4 w-4" />
              Start Campaign
            </Button>
          )}
          {campaign.status === 'active' && (
            <Button onClick={() => updateStatusMutation.mutate('paused')} variant="outline">
              <Pause className="mr-2 h-4 w-4" />
              Pause
            </Button>
          )}
          {campaign.status === 'paused' && (
            <Button onClick={() => updateStatusMutation.mutate('active')}>
              <Play className="mr-2 h-4 w-4" />
              Resume
            </Button>
          )}
          
          <Link href={`/campaigns/${id}/edit`}>
            <Button variant="outline">
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </Link>
          
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => {
              if (window.confirm('Are you sure you want to delete this campaign?')) {
                deleteCampaignMutation.mutate()
              }
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Campaign Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Overall Progress</span>
              <span className="font-medium">{Math.round(progressPercentage)}%</span>
            </div>
            <Progress value={progressPercentage} />
          </div>
          
          <div className="grid gap-4 md:grid-cols-5">
            <div className="text-center">
              <p className="text-2xl font-bold">{metrics.totalLeads}</p>
              <p className="text-sm text-muted-foreground">Total Leads</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{metrics.pending}</p>
              <p className="text-sm text-muted-foreground">Pending</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">{metrics.sent}</p>
              <p className="text-sm text-muted-foreground">In Progress</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{metrics.completed}</p>
              <p className="text-sm text-muted-foreground">Completed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{metrics.failed}</p>
              <p className="text-sm text-muted-foreground">Failed</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="sequences">
        <TabsList>
          <TabsTrigger value="sequences">Email Sequence</TabsTrigger>
          <TabsTrigger value="leads">Leads ({metrics.totalLeads})</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="sequences" className="space-y-4">
          {campaign.campaign_sequences.map((sequence, index) => (
            <Card key={sequence.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">Step {sequence.sequence_number}</Badge>
                    <CardTitle className="text-lg">{sequence.subject}</CardTitle>
                  </div>
                  {index > 0 && (
                    <Badge variant="secondary">
                      <Clock className="mr-1 h-3 w-3" />
                      Wait {sequence.delay_days}d {sequence.delay_hours}h
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {sequence.body.substring(0, 200)}...
                </p>
                {sequence.condition_type && sequence.condition_type !== 'always' && (
                  <Badge variant="outline" className="mt-2">
                    Condition: {sequence.condition_type.replace('_', ' ')}
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="leads">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Current Step</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Last Activity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaign.campaign_leads.map((campaignLead) => (
                    <TableRow key={campaignLead.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {campaignLead.lead.name || campaignLead.lead.email}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {campaignLead.lead.company}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          campaignLead.status === 'completed' ? 'default' :
                          campaignLead.status === 'failed' ? 'destructive' :
                          'secondary'
                        }>
                          {campaignLead.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        Step {campaignLead.current_sequence} of {campaign.campaign_sequences.length}
                      </TableCell>
                      <TableCell>
                        {campaignLead.started_at 
                          ? format(new Date(campaignLead.started_at), 'MMM d, yyyy')
                          : '-'
                        }
                      </TableCell>
                      <TableCell>
                        {campaignLead.completed_at
                          ? format(new Date(campaignLead.completed_at), 'MMM d, h:mm a')
                          : campaignLead.scheduled_at
                          ? `Scheduled for ${format(new Date(campaignLead.scheduled_at), 'MMM d')}`
                          : '-'
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Open Rate</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">23.5%</div>
                <p className="text-xs text-muted-foreground">
                  +2.1% from average
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Click Rate</CardTitle>
                <MousePointer className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">5.2%</div>
                <p className="text-xs text-muted-foreground">
                  -0.5% from average
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Reply Rate</CardTitle>
                <Reply className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">3.8%</div>
                <p className="text-xs text-muted-foreground">
                  +1.2% from average
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Unsubscribes</CardTitle>
                <XCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">0.3%</div>
                <p className="text-xs text-muted-foreground">
                  Within normal range
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Campaign Settings</CardTitle>
              <CardDescription>
                Configuration for this campaign
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Type</p>
                  <p className="text-sm">{campaign.type}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Created</p>
                  <p className="text-sm">{format(new Date(campaign.created_at), 'MMM d, yyyy h:mm a')}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Timezone</p>
                  <p className="text-sm">{campaign.timezone}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Daily Limit</p>
                  <p className="text-sm">{campaign.daily_limit} emails/day</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}