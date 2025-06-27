"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, ScatterPlot, Scatter
} from "recharts"
import { 
  Users, Mail, DollarSign, Database, Activity, TrendingUp, 
  Download, RefreshCw, Calendar, Globe, Zap, AlertTriangle
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface SystemMetrics {
  totalUsers: number
  activeUsers: number
  emailsSent: number
  revenue: number
  apiCalls: number
  storageUsed: number
  uptime: number
  errorRate: number
}

interface UsageData {
  date: string
  users: number
  emails: number
  api_calls: number
  revenue: number
}

interface WorkspaceStats {
  id: string
  name: string
  users: number
  campaigns: number
  emailsSent: number
  revenue: number
  status: 'active' | 'trial' | 'suspended'
  plan: 'free' | 'starter' | 'growth' | 'enterprise'
}

export default function AdminAnalyticsPage() {
  const [metrics, setMetrics] = useState<SystemMetrics>({
    totalUsers: 0,
    activeUsers: 0,
    emailsSent: 0,
    revenue: 0,
    apiCalls: 0,
    storageUsed: 0,
    uptime: 0,
    errorRate: 0
  })
  const [usageData, setUsageData] = useState<UsageData[]>([])
  const [workspaceStats, setWorkspaceStats] = useState<WorkspaceStats[]>([])
  const [timeRange, setTimeRange] = useState("7d")
  const [isLoading, setIsLoading] = useState(true)

  // Mock data
  useEffect(() => {
    const mockMetrics: SystemMetrics = {
      totalUsers: 1247,
      activeUsers: 892,
      emailsSent: 156789,
      revenue: 24580,
      apiCalls: 2847593,
      storageUsed: 75.4,
      uptime: 99.97,
      errorRate: 0.12
    }

    const mockUsageData: UsageData[] = [
      { date: "2024-01-01", users: 1100, emails: 12500, api_calls: 245000, revenue: 22000 },
      { date: "2024-01-02", users: 1120, emails: 13200, api_calls: 258000, revenue: 22400 },
      { date: "2024-01-03", users: 1135, emails: 14100, api_calls: 267000, revenue: 22800 },
      { date: "2024-01-04", users: 1158, emails: 15300, api_calls: 278000, revenue: 23200 },
      { date: "2024-01-05", users: 1174, emails: 16200, api_calls: 289000, revenue: 23600 },
      { date: "2024-01-06", users: 1192, emails: 17100, api_calls: 295000, revenue: 24000 },
      { date: "2024-01-07", users: 1247, emails: 18900, api_calls: 312000, revenue: 24580 }
    ]

    const mockWorkspaces: WorkspaceStats[] = [
      {
        id: "ws-1",
        name: "TechCorp Solutions",
        users: 15,
        campaigns: 8,
        emailsSent: 25600,
        revenue: 299,
        status: "active",
        plan: "growth"
      },
      {
        id: "ws-2",
        name: "StartupCo",
        users: 5,
        campaigns: 3,
        emailsSent: 12400,
        revenue: 99,
        status: "active",
        plan: "starter"
      },
      {
        id: "ws-3",
        name: "Enterprise Corp",
        users: 45,
        campaigns: 22,
        emailsSent: 89300,
        revenue: 999,
        status: "active",
        plan: "enterprise"
      },
      {
        id: "ws-4",
        name: "Marketing Agency",
        users: 12,
        campaigns: 6,
        emailsSent: 18700,
        revenue: 199,
        status: "trial",
        plan: "growth"
      },
      {
        id: "ws-5",
        name: "Suspended Workspace",
        users: 3,
        campaigns: 1,
        emailsSent: 2100,
        revenue: 0,
        status: "suspended",
        plan: "free"
      }
    ]

    setMetrics(mockMetrics)
    setUsageData(mockUsageData)
    setWorkspaceStats(mockWorkspaces)
    setIsLoading(false)
  }, [timeRange])

  const planDistribution = [
    { name: "Free", value: 45, color: "#94a3b8" },
    { name: "Starter", value: 30, color: "#3b82f6" },
    { name: "Growth", value: 20, color: "#10b981" },
    { name: "Enterprise", value: 5, color: "#f59e0b" }
  ]

  const getStatusBadge = (status: string) => {
    const badges = {
      'active': <Badge className="bg-green-500">Active</Badge>,
      'trial': <Badge variant="secondary">Trial</Badge>,
      'suspended': <Badge variant="destructive">Suspended</Badge>
    }
    return badges[status as keyof typeof badges] || <Badge variant="outline">{status}</Badge>
  }

  const getPlanBadge = (plan: string) => {
    const badges = {
      'free': <Badge variant="outline">Free</Badge>,
      'starter': <Badge className="bg-blue-500">Starter</Badge>,
      'growth': <Badge className="bg-green-500">Growth</Badge>,
      'enterprise': <Badge className="bg-yellow-500">Enterprise</Badge>
    }
    return badges[plan as keyof typeof badges] || <Badge variant="outline">{plan}</Badge>
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Analytics</h1>
          <p className="text-muted-foreground">Monitor system performance and usage</p>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">24 Hours</SelectItem>
              <SelectItem value="7d">7 Days</SelectItem>
              <SelectItem value="30d">30 Days</SelectItem>
              <SelectItem value="90d">90 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
          <Button variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="w-4 h-4" />
              Active Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.activeUsers.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">
              {metrics.totalUsers.toLocaleString()} total
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Emails Sent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.emailsSent.toLocaleString()}</div>
            <div className="text-sm text-green-600">+12.5% from last week</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${metrics.revenue.toLocaleString()}</div>
            <div className="text-sm text-green-600">+8.3% from last month</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="w-4 h-4" />
              API Calls
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(metrics.apiCalls / 1000000).toFixed(1)}M</div>
            <div className="text-sm text-muted-foreground">
              Error rate: {metrics.errorRate}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Health */}
      <Card>
        <CardHeader>
          <CardTitle>System Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Uptime</span>
                <span className="text-sm text-green-600">{metrics.uptime}%</span>
              </div>
              <Progress value={metrics.uptime} className="h-2" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Storage Used</span>
                <span className="text-sm">{metrics.storageUsed}%</span>
              </div>
              <Progress value={metrics.storageUsed} className="h-2" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Error Rate</span>
                <span className="text-sm text-red-600">{metrics.errorRate}%</span>
              </div>
              <Progress value={metrics.errorRate} className="h-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="usage" className="space-y-4">
        <TabsList>
          <TabsTrigger value="usage">Usage Trends</TabsTrigger>
          <TabsTrigger value="revenue">Revenue Analytics</TabsTrigger>
          <TabsTrigger value="workspaces">Workspace Performance</TabsTrigger>
          <TabsTrigger value="plans">Plan Distribution</TabsTrigger>
        </TabsList>

        <TabsContent value="usage" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>User Growth</CardTitle>
                <CardDescription>Active users over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={usageData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="users" stroke="#3b82f6" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Email Volume</CardTitle>
                <CardDescription>Daily email sends</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={usageData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="emails" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>API Usage</CardTitle>
              <CardDescription>API calls per day</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={usageData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="api_calls" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.6} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Trends</CardTitle>
              <CardDescription>Daily revenue over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={usageData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value) => [`$${value}`, 'Revenue']} />
                  <Line type="monotone" dataKey="revenue" stroke="#ef4444" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workspaces" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Workspaces</CardTitle>
              <CardDescription>Performance by workspace</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Workspace</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Users</TableHead>
                    <TableHead>Campaigns</TableHead>
                    <TableHead>Emails Sent</TableHead>
                    <TableHead>Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workspaceStats.map((workspace) => (
                    <TableRow key={workspace.id}>
                      <TableCell className="font-medium">{workspace.name}</TableCell>
                      <TableCell>{getPlanBadge(workspace.plan)}</TableCell>
                      <TableCell>{getStatusBadge(workspace.status)}</TableCell>
                      <TableCell>{workspace.users}</TableCell>
                      <TableCell>{workspace.campaigns}</TableCell>
                      <TableCell>{workspace.emailsSent.toLocaleString()}</TableCell>
                      <TableCell>${workspace.revenue}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Plan Distribution</CardTitle>
                <CardDescription>Users by plan type</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={planDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={120}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {planDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Plan Metrics</CardTitle>
                <CardDescription>Breakdown by plan</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {planDistribution.map((plan) => (
                  <div key={plan.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: plan.color }}
                      />
                      <span className="font-medium">{plan.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{plan.value}%</div>
                      <div className="text-sm text-muted-foreground">
                        {Math.round(metrics.totalUsers * plan.value / 100)} users
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}