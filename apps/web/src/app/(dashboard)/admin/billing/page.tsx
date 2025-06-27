"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"
import { 
  Search, MoreVertical, TrendingUp, TrendingDown, DollarSign,
  CreditCard, AlertCircle, CheckCircle, Clock, Users,
  BarChart3, Calendar, Download, RefreshCw, Zap,
  XCircle, ArrowUpRight, ArrowDownRight, Activity
} from "lucide-react"
import { format, formatDistanceToNow, subDays, startOfMonth, endOfMonth } from "date-fns"
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts"

interface WorkspaceBilling {
  workspace_id: string
  workspace_name: string
  owner_email: string
  subscription_status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'paused'
  plan_name: string
  plan_price: number
  mrr: number
  next_billing_date: string
  created_at: string
  trial_ends_at?: string
  stripe_customer_id: string
  payment_method?: {
    brand: string
    last4: string
  }
  usage: {
    emails_sent: number
    emails_limit: number
    leads_enriched: number
    enrichment_credits: number
    ai_tokens_used: number
    ai_tokens_limit: number
  }
}

interface RevenueMetrics {
  mrr: number
  arr: number
  total_revenue: number
  active_subscriptions: number
  trial_conversions: number
  churn_rate: number
  growth_rate: number
  arpu: number
}

interface ChartData {
  date: string
  revenue: number
  subscriptions: number
  churn: number
}

const MOCK_BILLING_DATA: WorkspaceBilling[] = [
  {
    workspace_id: "1",
    workspace_name: "TechCorp Solutions",
    owner_email: "admin@techcorp.com",
    subscription_status: "active",
    plan_name: "Professional",
    plan_price: 99,
    mrr: 99,
    next_billing_date: new Date(Date.now() + 86400000 * 15).toISOString(),
    created_at: new Date(Date.now() - 86400000 * 90).toISOString(),
    stripe_customer_id: "cus_123456",
    payment_method: {
      brand: "visa",
      last4: "4242"
    },
    usage: {
      emails_sent: 12500,
      emails_limit: 25000,
      leads_enriched: 850,
      enrichment_credits: 1000,
      ai_tokens_used: 45000,
      ai_tokens_limit: 100000
    }
  },
  {
    workspace_id: "2",
    workspace_name: "Growth Agency",
    owner_email: "billing@growthagency.com",
    subscription_status: "active",
    plan_name: "Enterprise",
    plan_price: 299,
    mrr: 299,
    next_billing_date: new Date(Date.now() + 86400000 * 8).toISOString(),
    created_at: new Date(Date.now() - 86400000 * 180).toISOString(),
    stripe_customer_id: "cus_234567",
    payment_method: {
      brand: "mastercard",
      last4: "5555"
    },
    usage: {
      emails_sent: 85000,
      emails_limit: 100000,
      leads_enriched: 4200,
      enrichment_credits: 5000,
      ai_tokens_used: 380000,
      ai_tokens_limit: 500000
    }
  },
  {
    workspace_id: "3",
    workspace_name: "StartupHub",
    owner_email: "founders@startuphub.io",
    subscription_status: "trialing",
    plan_name: "Starter",
    plan_price: 29,
    mrr: 0,
    next_billing_date: new Date(Date.now() + 86400000 * 7).toISOString(),
    trial_ends_at: new Date(Date.now() + 86400000 * 7).toISOString(),
    created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
    stripe_customer_id: "cus_345678",
    usage: {
      emails_sent: 450,
      emails_limit: 5000,
      leads_enriched: 20,
      enrichment_credits: 100,
      ai_tokens_used: 2500,
      ai_tokens_limit: 10000
    }
  },
  {
    workspace_id: "4",
    workspace_name: "Sales Masters",
    owner_email: "admin@salesmasters.com",
    subscription_status: "past_due",
    plan_name: "Professional",
    plan_price: 99,
    mrr: 99,
    next_billing_date: new Date(Date.now() - 86400000 * 3).toISOString(),
    created_at: new Date(Date.now() - 86400000 * 365).toISOString(),
    stripe_customer_id: "cus_456789",
    payment_method: {
      brand: "amex",
      last4: "0005"
    },
    usage: {
      emails_sent: 18000,
      emails_limit: 25000,
      leads_enriched: 900,
      enrichment_credits: 1000,
      ai_tokens_used: 67000,
      ai_tokens_limit: 100000
    }
  }
]

export default function AdminBillingPage() {
  const [billingData, setBillingData] = useState<WorkspaceBilling[]>([])
  const [metrics, setMetrics] = useState<RevenueMetrics>({
    mrr: 0,
    arr: 0,
    total_revenue: 0,
    active_subscriptions: 0,
    trial_conversions: 0,
    churn_rate: 0,
    growth_rate: 0,
    arpu: 0
  })
  const [chartData, setChartData] = useState<ChartData[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [planFilter, setPlanFilter] = useState("all")
  const [isLoading, setIsLoading] = useState(true)
  const [selectedWorkspace, setSelectedWorkspace] = useState<WorkspaceBilling | null>(null)

  useEffect(() => {
    loadBillingData()
    generateChartData()
  }, [])

  const loadBillingData = async () => {
    setIsLoading(true)
    try {
      // In a real app, this would be an API call
      setBillingData(MOCK_BILLING_DATA)
      
      // Calculate metrics
      const activeSubscriptions = MOCK_BILLING_DATA.filter(d => d.subscription_status === 'active')
      const mrr = activeSubscriptions.reduce((sum, d) => sum + d.mrr, 0)
      const arr = mrr * 12
      
      setMetrics({
        mrr,
        arr,
        total_revenue: 45680, // Mock historical revenue
        active_subscriptions: activeSubscriptions.length,
        trial_conversions: 68.5,
        churn_rate: 5.2,
        growth_rate: 12.8,
        arpu: mrr / activeSubscriptions.length
      })
    } catch (error) {
      toast.error("Failed to load billing data")
    } finally {
      setIsLoading(false)
    }
  }

  const generateChartData = () => {
    // Generate mock chart data for the last 30 days
    const data: ChartData[] = []
    for (let i = 29; i >= 0; i--) {
      const date = subDays(new Date(), i)
      data.push({
        date: format(date, 'MMM dd'),
        revenue: Math.floor(Math.random() * 2000 + 3000),
        subscriptions: Math.floor(Math.random() * 10 + 40),
        churn: Math.floor(Math.random() * 3 + 1)
      })
    }
    setChartData(data)
  }

  const filteredBillingData = billingData.filter(workspace => {
    const matchesSearch = 
      workspace.workspace_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      workspace.owner_email.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === "all" || workspace.subscription_status === statusFilter
    const matchesPlan = planFilter === "all" || workspace.plan_name.toLowerCase() === planFilter

    return matchesSearch && matchesStatus && matchesPlan
  })

  const getStatusBadge = (status: string) => {
    const badges = {
      'active': <Badge className="bg-green-500">Active</Badge>,
      'trialing': <Badge className="bg-blue-500">Trial</Badge>,
      'past_due': <Badge className="bg-red-500">Past Due</Badge>,
      'canceled': <Badge variant="secondary">Canceled</Badge>,
      'paused': <Badge variant="outline">Paused</Badge>
    }
    return badges[status as keyof typeof badges] || <Badge variant="outline">{status}</Badge>
  }

  const handleRefundSubscription = async (workspaceId: string) => {
    try {
      // API call would go here
      toast.success("Refund processed successfully")
    } catch (error) {
      toast.error("Failed to process refund")
    }
  }

  const handlePauseSubscription = async (workspaceId: string) => {
    try {
      // API call would go here
      toast.success("Subscription paused")
    } catch (error) {
      toast.error("Failed to pause subscription")
    }
  }

  const handleExtendTrial = async (workspaceId: string, days: number) => {
    try {
      // API call would go here
      toast.success(`Trial extended by ${days} days`)
    } catch (error) {
      toast.error("Failed to extend trial")
    }
  }

  const exportBillingReport = () => {
    toast.success("Billing report exported")
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Loading billing data...
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Billing Management</h1>
          <p className="text-muted-foreground">Monitor revenue and manage workspace subscriptions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportBillingReport}>
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
          <Button onClick={loadBillingData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Revenue Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              Monthly Recurring Revenue
              <DollarSign className="w-4 h-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${metrics.mrr.toLocaleString()}</div>
            <div className="flex items-center text-sm text-green-600 mt-1">
              <TrendingUp className="w-3 h-3 mr-1" />
              {metrics.growth_rate}% vs last month
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              Annual Recurring Revenue
              <Activity className="w-4 h-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${metrics.arr.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground mt-1">
              ${(metrics.arr / 12).toFixed(0)}/month average
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              Active Subscriptions
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.active_subscriptions}</div>
            <div className="flex items-center text-sm text-blue-600 mt-1">
              <Zap className="w-3 h-3 mr-1" />
              {metrics.trial_conversions}% trial conversion
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              Churn Rate
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.churn_rate}%</div>
            <div className="flex items-center text-sm text-red-600 mt-1">
              <TrendingDown className="w-3 h-3 mr-1" />
              0.3% vs last month
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
            <CardDescription>Daily revenue over the last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#3b82f6" 
                  fill="#93bbfc" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Subscription Activity</CardTitle>
            <CardDescription>New subscriptions vs churn</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="subscriptions" 
                  stroke="#10b981" 
                  name="New Subscriptions"
                />
                <Line 
                  type="monotone" 
                  dataKey="churn" 
                  stroke="#ef4444" 
                  name="Churned"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Subscription Management */}
      <Card>
        <CardHeader>
          <CardTitle>Workspace Subscriptions</CardTitle>
          <CardDescription>Manage individual workspace billing</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search workspaces..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="trialing">Trial</SelectItem>
                <SelectItem value="past_due">Past Due</SelectItem>
                <SelectItem value="canceled">Canceled</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
              </SelectContent>
            </Select>
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plans</SelectItem>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="starter">Starter</SelectItem>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Subscriptions Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Workspace</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>MRR</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Next Billing</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBillingData.map((workspace) => (
                <TableRow key={workspace.workspace_id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{workspace.workspace_name}</div>
                      <div className="text-sm text-muted-foreground">{workspace.owner_email}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {workspace.stripe_customer_id}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(workspace.subscription_status)}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{workspace.plan_name}</div>
                      <div className="text-sm text-muted-foreground">${workspace.plan_price}/mo</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">${workspace.mrr}</div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        <Mail className="w-3 h-3" />
                        {workspace.usage.emails_sent.toLocaleString()} / {workspace.usage.emails_limit.toLocaleString()}
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-3 h-3" />
                        {workspace.usage.leads_enriched} / {workspace.usage.enrichment_credits}
                      </div>
                      <div className="flex items-center gap-2">
                        <Zap className="w-3 h-3" />
                        {(workspace.usage.ai_tokens_used / 1000).toFixed(1)}k / {(workspace.usage.ai_tokens_limit / 1000).toFixed(0)}k
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="text-sm">
                        {workspace.trial_ends_at ? (
                          <>
                            Trial ends {formatDistanceToNow(new Date(workspace.trial_ends_at), { addSuffix: true })}
                          </>
                        ) : (
                          format(new Date(workspace.next_billing_date), 'MMM dd, yyyy')
                        )}
                      </div>
                      {workspace.payment_method && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {workspace.payment_method.brand} •••• {workspace.payment_method.last4}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Dialog>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DialogTrigger asChild>
                            <DropdownMenuItem>
                              <CreditCard className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                          </DialogTrigger>
                          {workspace.subscription_status === 'trialing' && (
                            <DropdownMenuItem onClick={() => handleExtendTrial(workspace.workspace_id, 7)}>
                              <Calendar className="w-4 h-4 mr-2" />
                              Extend Trial
                            </DropdownMenuItem>
                          )}
                          {workspace.subscription_status === 'active' && (
                            <DropdownMenuItem onClick={() => handlePauseSubscription(workspace.workspace_id)}>
                              <Clock className="w-4 h-4 mr-2" />
                              Pause Subscription
                            </DropdownMenuItem>
                          )}
                          {workspace.subscription_status === 'past_due' && (
                            <DropdownMenuItem className="text-orange-600">
                              <AlertCircle className="w-4 h-4 mr-2" />
                              Send Payment Reminder
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem 
                            className="text-red-600"
                            onClick={() => handleRefundSubscription(workspace.workspace_id)}
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            Issue Refund
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Billing Details - {workspace.workspace_name}</DialogTitle>
                          <DialogDescription>
                            Complete billing information and usage details
                          </DialogDescription>
                        </DialogHeader>
                        <Tabs defaultValue="overview" className="mt-4">
                          <TabsList>
                            <TabsTrigger value="overview">Overview</TabsTrigger>
                            <TabsTrigger value="usage">Usage</TabsTrigger>
                            <TabsTrigger value="invoices">Invoices</TabsTrigger>
                            <TabsTrigger value="actions">Actions</TabsTrigger>
                          </TabsList>
                          <TabsContent value="overview" className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label>Workspace Name</Label>
                                <p className="font-medium">{workspace.workspace_name}</p>
                              </div>
                              <div>
                                <Label>Owner Email</Label>
                                <p className="font-medium">{workspace.owner_email}</p>
                              </div>
                              <div>
                                <Label>Subscription Status</Label>
                                <div className="mt-1">{getStatusBadge(workspace.subscription_status)}</div>
                              </div>
                              <div>
                                <Label>Plan</Label>
                                <p className="font-medium">{workspace.plan_name} - ${workspace.plan_price}/mo</p>
                              </div>
                              <div>
                                <Label>Customer Since</Label>
                                <p className="font-medium">{format(new Date(workspace.created_at), 'MMM dd, yyyy')}</p>
                              </div>
                              <div>
                                <Label>Lifetime Value</Label>
                                <p className="font-medium">${(workspace.mrr * 12).toLocaleString()}</p>
                              </div>
                            </div>
                          </TabsContent>
                          <TabsContent value="usage" className="space-y-4">
                            <div className="space-y-3">
                              <div>
                                <div className="flex justify-between mb-1">
                                  <Label>Emails Sent</Label>
                                  <span className="text-sm text-muted-foreground">
                                    {workspace.usage.emails_sent.toLocaleString()} / {workspace.usage.emails_limit.toLocaleString()}
                                  </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div 
                                    className="bg-blue-600 h-2 rounded-full"
                                    style={{ width: `${(workspace.usage.emails_sent / workspace.usage.emails_limit) * 100}%` }}
                                  />
                                </div>
                              </div>
                              <div>
                                <div className="flex justify-between mb-1">
                                  <Label>Lead Enrichment</Label>
                                  <span className="text-sm text-muted-foreground">
                                    {workspace.usage.leads_enriched} / {workspace.usage.enrichment_credits}
                                  </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div 
                                    className="bg-green-600 h-2 rounded-full"
                                    style={{ width: `${(workspace.usage.leads_enriched / workspace.usage.enrichment_credits) * 100}%` }}
                                  />
                                </div>
                              </div>
                              <div>
                                <div className="flex justify-between mb-1">
                                  <Label>AI Tokens</Label>
                                  <span className="text-sm text-muted-foreground">
                                    {workspace.usage.ai_tokens_used.toLocaleString()} / {workspace.usage.ai_tokens_limit.toLocaleString()}
                                  </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div 
                                    className="bg-purple-600 h-2 rounded-full"
                                    style={{ width: `${(workspace.usage.ai_tokens_used / workspace.usage.ai_tokens_limit) * 100}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          </TabsContent>
                          <TabsContent value="invoices">
                            <p className="text-muted-foreground">Invoice history would be displayed here</p>
                          </TabsContent>
                          <TabsContent value="actions" className="space-y-4">
                            <div className="space-y-2">
                              {workspace.subscription_status === 'trialing' && (
                                <Button className="w-full" onClick={() => handleExtendTrial(workspace.workspace_id, 7)}>
                                  <Calendar className="w-4 h-4 mr-2" />
                                  Extend Trial by 7 Days
                                </Button>
                              )}
                              <Button variant="outline" className="w-full">
                                <CreditCard className="w-4 h-4 mr-2" />
                                Update Payment Method
                              </Button>
                              <Button variant="outline" className="w-full">
                                <DollarSign className="w-4 h-4 mr-2" />
                                Apply Credit
                              </Button>
                              {workspace.subscription_status === 'active' && (
                                <Button 
                                  variant="outline" 
                                  className="w-full"
                                  onClick={() => handlePauseSubscription(workspace.workspace_id)}
                                >
                                  <Clock className="w-4 h-4 mr-2" />
                                  Pause Subscription
                                </Button>
                              )}
                              <Button 
                                variant="destructive" 
                                className="w-full"
                                onClick={() => handleRefundSubscription(workspace.workspace_id)}
                              >
                                <XCircle className="w-4 h-4 mr-2" />
                                Issue Refund
                              </Button>
                            </div>
                          </TabsContent>
                        </Tabs>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}