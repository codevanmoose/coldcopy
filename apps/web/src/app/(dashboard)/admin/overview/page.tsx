"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Users,
  Building2,
  DollarSign,
  Zap,
  Activity,
  Database,
  Mail,
  Server,
  Shield,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  UserPlus,
  Settings,
  RefreshCw,
  Download,
  Send,
  Ban,
  Key,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// Mock data interfaces
interface SystemHealthStatus {
  service: string;
  status: "operational" | "degraded" | "down";
  uptime: number;
  lastChecked: Date;
  responseTime: number;
}

interface ActivityItem {
  id: string;
  type: "user_signup" | "workspace_created" | "payment_received" | "campaign_launched" | "error" | "admin_action";
  title: string;
  description: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

interface MetricData {
  totalUsers: number;
  userChange: number;
  totalWorkspaces: number;
  workspaceChange: number;
  monthlyRevenue: number;
  revenueChange: number;
  activeCampaigns: number;
  campaignChange: number;
}

interface UsageData {
  date: string;
  users: number;
  emails: number;
  apiCalls: number;
}

interface RevenueData {
  month: string;
  revenue: number;
  subscriptions: number;
  tokenPurchases: number;
}

interface UserGrowthData {
  date: string;
  newUsers: number;
  activeUsers: number;
  churnedUsers: number;
}

interface PlanDistribution {
  plan: string;
  count: number;
  percentage: number;
  color: string;
}

export default function AdminOverviewPage() {
  const [metrics, setMetrics] = useState<MetricData>({
    totalUsers: 2847,
    userChange: 12.5,
    totalWorkspaces: 423,
    workspaceChange: 8.3,
    monthlyRevenue: 48392,
    revenueChange: 15.2,
    activeCampaigns: 1289,
    campaignChange: -2.1,
  });

  const [systemHealth, setSystemHealth] = useState<SystemHealthStatus[]>([
    {
      service: "API Server",
      status: "operational",
      uptime: 99.98,
      lastChecked: new Date(),
      responseTime: 45,
    },
    {
      service: "Database (Supabase)",
      status: "operational",
      uptime: 99.99,
      lastChecked: new Date(),
      responseTime: 12,
    },
    {
      service: "Redis Cache",
      status: "operational",
      uptime: 100,
      lastChecked: new Date(),
      responseTime: 2,
    },
    {
      service: "Email Delivery (SES)",
      status: "degraded",
      uptime: 98.5,
      lastChecked: new Date(),
      responseTime: 125,
    },
    {
      service: "Background Jobs (Celery)",
      status: "operational",
      uptime: 99.7,
      lastChecked: new Date(),
      responseTime: 88,
    },
    {
      service: "File Storage (DO Spaces)",
      status: "operational",
      uptime: 100,
      lastChecked: new Date(),
      responseTime: 65,
    },
  ]);

  const [activities, setActivities] = useState<ActivityItem[]>([
    {
      id: "1",
      type: "user_signup",
      title: "New user signup",
      description: "john.doe@company.com joined via organic search",
      timestamp: new Date(Date.now() - 5 * 60 * 1000),
      metadata: { plan: "Growth", source: "organic" },
    },
    {
      id: "2",
      type: "workspace_created",
      title: "Workspace created",
      description: "Acme Corp workspace created with 5 team members",
      timestamp: new Date(Date.now() - 15 * 60 * 1000),
      metadata: { teamSize: 5 },
    },
    {
      id: "3",
      type: "payment_received",
      title: "Payment received",
      description: "$299 from TechStartup Inc for Enterprise plan",
      timestamp: new Date(Date.now() - 30 * 60 * 1000),
      metadata: { amount: 299, plan: "Enterprise" },
    },
    {
      id: "4",
      type: "campaign_launched",
      title: "Large campaign launched",
      description: "Campaign with 5,000 leads started by SalesForce Pro",
      timestamp: new Date(Date.now() - 45 * 60 * 1000),
      metadata: { leadCount: 5000 },
    },
    {
      id: "5",
      type: "error",
      title: "Email delivery issue",
      description: "High bounce rate detected for domain xyz.com",
      timestamp: new Date(Date.now() - 60 * 60 * 1000),
      metadata: { bounceRate: 15.5 },
    },
    {
      id: "6",
      type: "admin_action",
      title: "Admin action",
      description: "GDPR data export completed for user@example.com",
      timestamp: new Date(Date.now() - 90 * 60 * 1000),
      metadata: { requestType: "data_export" },
    },
  ]);

  const [usageData] = useState<UsageData[]>([
    { date: "Mon", users: 450, emails: 12000, apiCalls: 25000 },
    { date: "Tue", users: 480, emails: 13500, apiCalls: 27000 },
    { date: "Wed", users: 520, emails: 14200, apiCalls: 29000 },
    { date: "Thu", users: 490, emails: 13800, apiCalls: 28000 },
    { date: "Fri", users: 530, emails: 15500, apiCalls: 31000 },
    { date: "Sat", users: 380, emails: 9000, apiCalls: 20000 },
    { date: "Sun", users: 360, emails: 8500, apiCalls: 18000 },
  ]);

  const [revenueData] = useState<RevenueData[]>([
    { month: "Jan", revenue: 32000, subscriptions: 28000, tokenPurchases: 4000 },
    { month: "Feb", revenue: 35000, subscriptions: 30000, tokenPurchases: 5000 },
    { month: "Mar", revenue: 38000, subscriptions: 33000, tokenPurchases: 5000 },
    { month: "Apr", revenue: 42000, subscriptions: 36000, tokenPurchases: 6000 },
    { month: "May", revenue: 45000, subscriptions: 39000, tokenPurchases: 6000 },
    { month: "Jun", revenue: 48392, subscriptions: 41000, tokenPurchases: 7392 },
  ]);

  const [userGrowthData] = useState<UserGrowthData[]>([
    { date: "Week 1", newUsers: 120, activeUsers: 2100, churnedUsers: 45 },
    { date: "Week 2", newUsers: 135, activeUsers: 2200, churnedUsers: 38 },
    { date: "Week 3", newUsers: 150, activeUsers: 2350, churnedUsers: 42 },
    { date: "Week 4", newUsers: 142, activeUsers: 2450, churnedUsers: 35 },
  ]);

  const [planDistribution] = useState<PlanDistribution[]>([
    { plan: "Free", count: 892, percentage: 31.3, color: "#94a3b8" },
    { plan: "Starter", count: 745, percentage: 26.2, color: "#60a5fa" },
    { plan: "Growth", count: 685, percentage: 24.1, color: "#34d399" },
    { plan: "Enterprise", count: 525, percentage: 18.4, color: "#a78bfa" },
  ]);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate refresh
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsRefreshing(false);
  };

  const getStatusColor = (status: SystemHealthStatus["status"]) => {
    switch (status) {
      case "operational":
        return "text-green-500";
      case "degraded":
        return "text-yellow-500";
      case "down":
        return "text-red-500";
    }
  };

  const getStatusIcon = (status: SystemHealthStatus["status"]) => {
    switch (status) {
      case "operational":
        return <CheckCircle className="h-4 w-4" />;
      case "degraded":
        return <AlertCircle className="h-4 w-4" />;
      case "down":
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getActivityIcon = (type: ActivityItem["type"]) => {
    switch (type) {
      case "user_signup":
        return <UserPlus className="h-4 w-4" />;
      case "workspace_created":
        return <Building2 className="h-4 w-4" />;
      case "payment_received":
        return <DollarSign className="h-4 w-4" />;
      case "campaign_launched":
        return <Send className="h-4 w-4" />;
      case "error":
        return <AlertCircle className="h-4 w-4" />;
      case "admin_action":
        return <Shield className="h-4 w-4" />;
    }
  };

  const getActivityColor = (type: ActivityItem["type"]) => {
    switch (type) {
      case "user_signup":
        return "bg-blue-100 text-blue-800";
      case "workspace_created":
        return "bg-purple-100 text-purple-800";
      case "payment_received":
        return "bg-green-100 text-green-800";
      case "campaign_launched":
        return "bg-indigo-100 text-indigo-800";
      case "error":
        return "bg-red-100 text-red-800";
      case "admin_action":
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Overview</h1>
          <p className="text-muted-foreground">
            Monitor system health, user activity, and key metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalUsers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.userChange > 0 ? (
                <span className="text-green-600 flex items-center">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  +{metrics.userChange}% from last month
                </span>
              ) : (
                <span className="text-red-600 flex items-center">
                  <TrendingDown className="h-3 w-3 mr-1" />
                  {metrics.userChange}% from last month
                </span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Workspaces</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalWorkspaces}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600 flex items-center">
                <TrendingUp className="h-3 w-3 mr-1" />
                +{metrics.workspaceChange}% from last month
              </span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${metrics.monthlyRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600 flex items-center">
                <TrendingUp className="h-3 w-3 mr-1" />
                +{metrics.revenueChange}% from last month
              </span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.activeCampaigns.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.campaignChange > 0 ? (
                <span className="text-green-600 flex items-center">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  +{metrics.campaignChange}% from last month
                </span>
              ) : (
                <span className="text-red-600 flex items-center">
                  <TrendingDown className="h-3 w-3 mr-1" />
                  {metrics.campaignChange}% from last month
                </span>
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* System Health */}
      <Card>
        <CardHeader>
          <CardTitle>System Health</CardTitle>
          <CardDescription>Real-time monitoring of critical services</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {systemHealth.map((service) => (
              <div key={service.service} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`flex items-center ${getStatusColor(service.status)}`}>
                    {getStatusIcon(service.status)}
                  </div>
                  <div>
                    <p className="font-medium">{service.service}</p>
                    <p className="text-sm text-muted-foreground">
                      {service.uptime}% uptime • {service.responseTime}ms response time
                    </p>
                  </div>
                </div>
                <Badge
                  variant={
                    service.status === "operational"
                      ? "default"
                      : service.status === "degraded"
                      ? "secondary"
                      : "destructive"
                  }
                >
                  {service.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Charts and Analytics */}
      <Tabs defaultValue="usage" className="space-y-4">
        <TabsList>
          <TabsTrigger value="usage">System Usage</TabsTrigger>
          <TabsTrigger value="revenue">Revenue Trends</TabsTrigger>
          <TabsTrigger value="growth">User Growth</TabsTrigger>
          <TabsTrigger value="distribution">Plan Distribution</TabsTrigger>
        </TabsList>

        <TabsContent value="usage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Weekly Usage Patterns</CardTitle>
              <CardDescription>User activity, emails sent, and API usage</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={usageData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="users" stroke="#8b5cf6" name="Active Users" />
                  <Line type="monotone" dataKey="emails" stroke="#10b981" name="Emails Sent" />
                  <Line type="monotone" dataKey="apiCalls" stroke="#3b82f6" name="API Calls" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Breakdown</CardTitle>
              <CardDescription>Monthly revenue from subscriptions and token purchases</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="subscriptions"
                    stackId="1"
                    stroke="#8b5cf6"
                    fill="#8b5cf6"
                    name="Subscriptions"
                  />
                  <Area
                    type="monotone"
                    dataKey="tokenPurchases"
                    stackId="1"
                    stroke="#10b981"
                    fill="#10b981"
                    name="Token Purchases"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="growth" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Growth & Retention</CardTitle>
              <CardDescription>New signups, active users, and churn</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={userGrowthData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="newUsers" fill="#3b82f6" name="New Users" />
                  <Bar dataKey="activeUsers" fill="#10b981" name="Active Users" />
                  <Bar dataKey="churnedUsers" fill="#ef4444" name="Churned Users" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="distribution" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Plan Distribution</CardTitle>
              <CardDescription>Current distribution of users across pricing plans</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={planDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ percentage }) => `${percentage.toFixed(1)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {planDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-4">
                  {planDistribution.map((plan) => (
                    <div key={plan.plan} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: plan.color }}
                        />
                        <span className="font-medium">{plan.plan}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{plan.count}</p>
                        <p className="text-sm text-muted-foreground">{plan.percentage}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest system events and user actions</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-4">
                {activities.map((activity) => (
                  <div key={activity.id} className="flex items-start space-x-3">
                    <div
                      className={`rounded-full p-2 ${getActivityColor(activity.type)}`}
                    >
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium">{activity.title}</p>
                      <p className="text-xs text-muted-foreground">{activity.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common administrative tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start">
                <UserPlus className="h-4 w-4 mr-2" />
                Create Admin User
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Ban className="h-4 w-4 mr-2" />
                Suspend User Account
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Key className="h-4 w-4 mr-2" />
                Rotate API Keys
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Database className="h-4 w-4 mr-2" />
                Trigger Backup
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Mail className="h-4 w-4 mr-2" />
                Clear Email Queue
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Settings className="h-4 w-4 mr-2" />
                System Configuration
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Shield className="h-4 w-4 mr-2" />
                Security Audit
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Activity className="h-4 w-4 mr-2" />
                Performance Monitoring
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Alerts */}
      {systemHealth.some((s) => s.status !== "operational") && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Some services are experiencing issues. Please check the system health panel for details.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}