'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from 'sonner'
import { format } from 'date-fns'
import { 
  Search, 
  Plus, 
  MoreHorizontal, 
  Play, 
  Pause, 
  Copy, 
  Trash2,
  Users,
  Mail,
  Clock,
  TrendingUp,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react'

interface Campaign {
  id: string
  name: string
  type: 'sequence' | 'one-off' | 'drip'
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived'
  created_at: string
  updated_at: string
  metrics?: {
    total_leads: number
    sent: number
    opened: number
    clicked: number
    replied: number
  }
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

export default function CampaignsPage() {
  const { workspace } = useAuthStore()
  const [searchQuery, setSearchQuery] = useState('')
  const queryClient = useQueryClient()
  const supabase = createClient()

  // Fetch campaigns
  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['campaigns', workspace?.id, searchQuery],
    queryFn: async () => {
      if (!workspace) return []

      let query = supabase
        .from('campaigns')
        .select(`
          *,
          campaign_leads!inner(count),
          email_events(count)
        `)
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false })

      if (searchQuery) {
        query = query.ilike('name', `%${searchQuery}%`)
      }

      const { data, error } = await query

      if (error) throw error

      // Transform data to include metrics
      return data.map((campaign: any) => ({
        ...campaign,
        metrics: {
          total_leads: campaign.campaign_leads?.[0]?.count || 0,
          sent: campaign.email_events?.filter((e: any) => e.event_type === 'sent').length || 0,
          opened: campaign.email_events?.filter((e: any) => e.event_type === 'opened').length || 0,
          clicked: campaign.email_events?.filter((e: any) => e.event_type === 'clicked').length || 0,
          replied: campaign.email_events?.filter((e: any) => e.event_type === 'replied').length || 0,
        },
      }))
    },
    enabled: !!workspace,
  })

  // Update campaign status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ campaignId, status }: { campaignId: string; status: string }) => {
      const { error } = await supabase
        .from('campaigns')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', campaignId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      toast.success('Campaign status updated')
    },
    onError: (error) => {
      console.error('Status update error:', error)
      toast.error('Failed to update campaign status')
    },
  })

  // Delete campaign mutation
  const deleteCampaignMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', campaignId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      toast.success('Campaign deleted')
    },
    onError: (error) => {
      console.error('Delete error:', error)
      toast.error('Failed to delete campaign')
    },
  })

  const calculateMetrics = (campaigns: Campaign[]) => {
    const active = campaigns.filter(c => c.status === 'active').length
    const totalLeads = campaigns.reduce((sum, c) => sum + (c.metrics?.total_leads || 0), 0)
    const totalSent = campaigns.reduce((sum, c) => sum + (c.metrics?.sent || 0), 0)
    const avgOpenRate = totalSent > 0
      ? (campaigns.reduce((sum, c) => sum + (c.metrics?.opened || 0), 0) / totalSent * 100)
      : 0

    return { active, totalLeads, totalSent, avgOpenRate }
  }

  const metrics = calculateMetrics(campaigns)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Campaigns</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage your email campaigns
          </p>
        </div>
        <Link href="/campaigns/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Campaign
          </Button>
        </Link>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
            <Play className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.active}</div>
            <p className="text-xs text-muted-foreground">
              Currently running
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalLeads.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Across all campaigns
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Emails Sent</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalSent.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Total delivered
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Open Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.avgOpenRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Across all campaigns
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Campaigns Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Campaigns</CardTitle>
          <CardDescription>
            View and manage your email campaigns
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search campaigns..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-8">
              <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">No campaigns yet</p>
              <Link href="/campaigns/new">
                <Button variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Campaign
                </Button>
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-center">Leads</TableHead>
                  <TableHead className="text-center">Sent</TableHead>
                  <TableHead className="text-center">Open Rate</TableHead>
                  <TableHead className="text-center">Reply Rate</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => {
                  const status = statusConfig[campaign.status as keyof typeof statusConfig]
                  const StatusIcon = status.icon
                  const openRate = campaign.metrics?.sent 
                    ? (campaign.metrics.opened / campaign.metrics.sent * 100).toFixed(1)
                    : '0'
                  const replyRate = campaign.metrics?.sent
                    ? (campaign.metrics.replied / campaign.metrics.sent * 100).toFixed(1)
                    : '0'

                  return (
                    <TableRow key={campaign.id}>
                      <TableCell>
                        <Link 
                          href={`/campaigns/${campaign.id}`}
                          className="font-medium hover:underline"
                        >
                          {campaign.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`p-1 rounded ${status.bgColor}`}>
                            <StatusIcon className={`h-3 w-3 ${status.color}`} />
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {status.label}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {campaign.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {campaign.metrics?.total_leads || 0}
                      </TableCell>
                      <TableCell className="text-center">
                        {campaign.metrics?.sent || 0}
                      </TableCell>
                      <TableCell className="text-center">
                        {openRate}%
                      </TableCell>
                      <TableCell className="text-center">
                        {replyRate}%
                      </TableCell>
                      <TableCell>
                        {format(new Date(campaign.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                              <Link href={`/campaigns/${campaign.id}`}>
                                View Details
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/campaigns/${campaign.id}/edit`}>
                                Edit Campaign
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {campaign.status === 'draft' && (
                              <DropdownMenuItem
                                onClick={() => updateStatusMutation.mutate({
                                  campaignId: campaign.id,
                                  status: 'active'
                                })}
                              >
                                <Play className="mr-2 h-4 w-4" />
                                Start Campaign
                              </DropdownMenuItem>
                            )}
                            {campaign.status === 'active' && (
                              <DropdownMenuItem
                                onClick={() => updateStatusMutation.mutate({
                                  campaignId: campaign.id,
                                  status: 'paused'
                                })}
                              >
                                <Pause className="mr-2 h-4 w-4" />
                                Pause Campaign
                              </DropdownMenuItem>
                            )}
                            {campaign.status === 'paused' && (
                              <DropdownMenuItem
                                onClick={() => updateStatusMutation.mutate({
                                  campaignId: campaign.id,
                                  status: 'active'
                                })}
                              >
                                <Play className="mr-2 h-4 w-4" />
                                Resume Campaign
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem>
                              <Copy className="mr-2 h-4 w-4" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                if (window.confirm('Are you sure you want to delete this campaign?')) {
                                  deleteCampaignMutation.mutate(campaign.id)
                                }
                              }}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}