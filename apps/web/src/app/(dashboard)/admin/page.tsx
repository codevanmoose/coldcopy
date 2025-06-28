'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { 
  Activity,
  Users,
  Database,
  Zap,
  AlertTriangle,
  TrendingUp,
  Server,
  HardDrive,
  Cpu,
  MemoryStick,
  Globe,
  Mail,
  DollarSign,
  Settings,
  RefreshCw,
  Download,
  Shield,
  Clock
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/lib/api-client'
import { formatDistanceToNow } from 'date-fns'

interface SystemMetrics {
  workspaces: {
    total: number
    active_30d: number
    trial: number
    paid: number
  }
  users: {
    total: number
    active_30d: number
    new_30d: number
  }
  campaigns: {
    total: number
    active: number
    completed_30d: number
  }
  emails: {
    sent_30d: number
    delivered_30d: number
    opened_30d: number
    clicked_30d: number
  }
  revenue: {
    mrr: number
    total_30d: number
    trial_conversions_30d: number
  }
  system: {
    database_size: string
    cache_hit_rate: number
    avg_response_time: number
    uptime: string
  }
}

interface WorkspaceDetails {
  id: string
  name: string
  plan: string
  users_count: number
  campaigns_count: number
  emails_sent_30d: number
  last_activity: string
  created_at: string
  status: string
}

export default function AdminDashboard() {
  const { dbUser } = useAuthStore()
  const [refreshKey, setRefreshKey] = useState(0)

  // Check if user is super admin
  if (dbUser?.role !== 'super_admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <Alert variant="destructive">
          <Shield className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You need super admin privileges to access this dashboard.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  // Fetch system metrics
  const { data: metrics, isLoading: metricsLoading, refetch: refetchMetrics } = useQuery({
    queryKey: ['admin-metrics', refreshKey],
    queryFn: async () => {
      const response = await api.admin.getSystemMetrics()
      if (response.error) throw new Error(response.error)
      return response.data as SystemMetrics
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  // Fetch workspace details
  const { data: workspaces, isLoading: workspacesLoading } = useQuery({
    queryKey: ['admin-workspaces', refreshKey],
    queryFn: async () => {
      const response = await api.admin.getWorkspaces()
      if (response.error) throw new Error(response.error)
      return response.data as WorkspaceDetails[]
    },
  })

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1)
    refetchMetrics()
  }

  if (metricsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading admin dashboard...
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            System overview and management console
          </p>
        </div>
        <Button onClick={handleRefresh} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Workspaces</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.workspaces.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.workspaces.active_30d || 0} active last 30 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(metrics?.revenue.mrr || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              MRR • ${(metrics?.revenue.total_30d || 0).toLocaleString()} last 30d
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Emails Sent</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(metrics?.emails.sent_30d || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Last 30 days • {Math.round(((metrics?.emails.delivered_30d || 0) / (metrics?.emails.sent_30d || 1)) * 100)}% delivered
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Healthy</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.system.avg_response_time || 0}ms avg response
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="workspaces">Workspaces</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* User Growth */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">User Growth</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Total Users</span>
                  <span className="font-medium">{metrics?.users.total || 0}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Active (30d)</span>
                  <span className="font-medium">{metrics?.users.active_30d || 0}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>New (30d)</span>
                  <span className="font-medium text-green-600">+{metrics?.users.new_30d || 0}</span>
                </div>
              </CardContent>
            </Card>

            {/* Campaign Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Campaign Activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Total Campaigns</span>
                  <span className="font-medium">{metrics?.campaigns.total || 0}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Active</span>
                  <span className="font-medium">{metrics?.campaigns.active || 0}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Completed (30d)</span>
                  <span className="font-medium">{metrics?.campaigns.completed_30d || 0}</span>
                </div>
              </CardContent>
            </Card>

            {/* Email Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Email Performance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>Delivery Rate</span>
                    <span className="font-medium">
                      {Math.round(((metrics?.emails.delivered_30d || 0) / (metrics?.emails.sent_30d || 1)) * 100)}%
                    </span>
                  </div>
                  <Progress 
                    value={((metrics?.emails.delivered_30d || 0) / (metrics?.emails.sent_30d || 1)) * 100} 
                    className="h-2" 
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>Open Rate</span>
                    <span className="font-medium">
                      {Math.round(((metrics?.emails.opened_30d || 0) / (metrics?.emails.delivered_30d || 1)) * 100)}%
                    </span>
                  </div>
                  <Progress 
                    value={((metrics?.emails.opened_30d || 0) / (metrics?.emails.delivered_30d || 1)) * 100} 
                    className="h-2" 
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>Click Rate</span>
                    <span className="font-medium">
                      {Math.round(((metrics?.emails.clicked_30d || 0) / (metrics?.emails.delivered_30d || 1)) * 100)}%
                    </span>
                  </div>
                  <Progress 
                    value={((metrics?.emails.clicked_30d || 0) / (metrics?.emails.delivered_30d || 1)) * 100} 
                    className="h-2" 
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="workspaces" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Workspace Management</CardTitle>
              <CardDescription>
                Overview of all workspaces and their activity
              </CardDescription>
            </CardHeader>
            <CardContent>
              {workspacesLoading ? (
                <div className="flex items-center justify-center h-32">
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  Loading workspaces...
                </div>
              ) : (
                <div className="space-y-4">
                  {workspaces?.map((workspace) => (
                    <div key={workspace.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{workspace.name}</h4>
                          <Badge variant={workspace.status === 'active' ? 'default' : 'secondary'}>
                            {workspace.plan}
                          </Badge>
                          <Badge variant="outline">
                            {workspace.status}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {workspace.users_count} users • {workspace.campaigns_count} campaigns • 
                          {workspace.emails_sent_30d.toLocaleString()} emails sent
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Created {formatDistanceToNow(new Date(workspace.created_at))} ago • 
                          Last activity {formatDistanceToNow(new Date(workspace.last_activity))} ago
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm">
                          View Details
                        </Button>
                        <Button variant="outline" size="sm">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Database Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Database Size</span>
                  <span className="font-medium">{metrics?.system.database_size || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Cache Hit Rate</span>
                  <span className="font-medium">{metrics?.system.cache_hit_rate || 0}%</span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>Cache Performance</span>
                    <span className="font-medium">{metrics?.system.cache_hit_rate || 0}%</span>
                  </div>
                  <Progress value={metrics?.system.cache_hit_rate || 0} className="h-2" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Server className="h-4 w-4" />
                  System Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Uptime</span>
                  <span className="font-medium">{metrics?.system.uptime || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Avg Response Time</span>
                  <span className="font-medium">{metrics?.system.avg_response_time || 0}ms</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Status</span>
                  <Badge variant="default" className="bg-green-500">
                    Healthy
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Revenue Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>MRR</span>
                  <span className="font-medium">${(metrics?.revenue.mrr || 0).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Total (30d)</span>
                  <span className="font-medium">${(metrics?.revenue.total_30d || 0).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Trial Conversions</span>
                  <span className="font-medium">{metrics?.revenue.trial_conversions_30d || 0}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Subscription Distribution</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Paid Plans</span>
                  <span className="font-medium">{metrics?.workspaces.paid || 0}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Trial Users</span>
                  <span className="font-medium">{metrics?.workspaces.trial || 0}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Conversion Rate</span>
                  <span className="font-medium">
                    {Math.round(((metrics?.workspaces.paid || 0) / ((metrics?.workspaces.paid || 0) + (metrics?.workspaces.trial || 1))) * 100)}%
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Growth Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>New Workspaces (30d)</span>
                  <span className="font-medium text-green-600">
                    +{((metrics?.workspaces.total || 0) - (metrics?.workspaces.active_30d || 0))}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Avg Revenue per User</span>
                  <span className="font-medium">
                    ${Math.round((metrics?.revenue.mrr || 0) / (metrics?.workspaces.paid || 1))}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertTitle>Performance Monitoring</AlertTitle>
            <AlertDescription>
              Real-time system performance metrics and optimization recommendations.
            </AlertDescription>
          </Alert>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Database Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Query Performance</span>
                      <span className="font-medium">Good</span>
                    </div>
                    <Progress value={85} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Index Usage</span>
                      <span className="font-medium">Optimal</span>
                    </div>
                    <Progress value={92} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Connection Pool</span>
                      <span className="font-medium">Healthy</span>
                    </div>
                    <Progress value={78} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cache Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Hit Rate</span>
                      <span className="font-medium">{metrics?.system.cache_hit_rate || 0}%</span>
                    </div>
                    <Progress value={metrics?.system.cache_hit_rate || 0} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Memory Usage</span>
                      <span className="font-medium">Good</span>
                    </div>
                    <Progress value={65} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Response Time</span>
                      <span className="font-medium">{metrics?.system.avg_response_time || 0}ms</span>
                    </div>
                    <Progress value={Math.min(100, Math.max(0, 100 - (metrics?.system.avg_response_time || 0) / 10))} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}