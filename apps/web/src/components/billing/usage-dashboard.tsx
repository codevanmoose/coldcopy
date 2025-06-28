'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import {
  Zap,
  Mail,
  Users,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Activity,
  Clock,
  Target,
  Sparkles,
  RefreshCw
} from 'lucide-react'
import { useUsageTracker } from '@/hooks/use-usage-tracker'
import { LoadingSpinner, ErrorState } from '@/components/ui/loading-states'
import { toast } from 'sonner'

interface UsageMetrics {
  aiTokens: {
    usage: number
    cost: number
    limit?: number
  }
  emailsSent: {
    usage: number
    cost: number
    limit?: number
  }
  leadsEnriched: {
    usage: number
    cost: number
    limit?: number
  }
}

export function UsageDashboard() {
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState<UsageMetrics | null>(null)
  const [usageTrends, setUsageTrends] = useState<any[]>([])
  const [featureUsage, setFeatureUsage] = useState<any[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState('30')
  const [selectedMetric, setSelectedMetric] = useState('ai_tokens')
  
  const {
    getCurrentMonthUsage,
    getUsageTrends,
    getFeatureUsage,
    getUsageLimits
  } = useUsageTracker()

  useEffect(() => {
    loadUsageData()
  }, [])

  useEffect(() => {
    if (selectedMetric && selectedPeriod) {
      loadTrends()
    }
  }, [selectedMetric, selectedPeriod])

  const loadUsageData = async () => {
    try {
      setLoading(true)
      
      const [currentUsage, features] = await Promise.all([
        getCurrentMonthUsage(),
        getFeatureUsage(30)
      ])

      // Transform the usage data
      const transformedMetrics: UsageMetrics = {
        aiTokens: currentUsage.ai_tokens || { usage: 0, cost: 0 },
        emailsSent: currentUsage.emails_sent || { usage: 0, cost: 0 },
        leadsEnriched: currentUsage.leads_enriched || { usage: 0, cost: 0 }
      }

      setMetrics(transformedMetrics)
      setFeatureUsage(features)
      
      // Load initial trends
      await loadTrends()
    } catch (error) {
      console.error('Error loading usage data:', error)
      toast.error('Failed to load usage data')
    } finally {
      setLoading(false)
    }
  }

  const loadTrends = async () => {
    try {
      const trends = await getUsageTrends(selectedMetric, parseInt(selectedPeriod))
      setUsageTrends(trends)
    } catch (error) {
      console.error('Error loading usage trends:', error)
    }
  }

  const getUsagePercentage = (usage: number, limit?: number) => {
    if (!limit) return 0
    return Math.min((usage / limit) * 100, 100)
  }

  const getUsageStatus = (usage: number, limit?: number) => {
    if (!limit) return 'unlimited'
    const percentage = (usage / limit) * 100
    if (percentage >= 95) return 'critical'
    if (percentage >= 80) return 'warning'
    return 'normal'
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }).format(amount)
  }

  const chartColors = {
    primary: '#8B5CF6',
    secondary: '#06B6D4',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!metrics) {
    return (
      <ErrorState
        description="Failed to load usage data"
        retry={loadUsageData}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Usage & Billing</h1>
          <p className="text-muted-foreground">
            Monitor your AI usage, email sending, and feature consumption
          </p>
        </div>
        <Button onClick={loadUsageData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Usage Overview Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Tokens</CardTitle>
            <Sparkles className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">
                  {formatNumber(metrics.aiTokens.usage)}
                </span>
                <Badge 
                  variant={getUsageStatus(metrics.aiTokens.usage, metrics.aiTokens.limit) === 'critical' ? 'destructive' : 'default'}
                >
                  {formatCurrency(metrics.aiTokens.cost)}
                </Badge>
              </div>
              
              {metrics.aiTokens.limit && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Usage</span>
                    <span>{formatNumber(metrics.aiTokens.limit)} limit</span>
                  </div>
                  <Progress 
                    value={getUsagePercentage(metrics.aiTokens.usage, metrics.aiTokens.limit)}
                    className="h-2"
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Emails Sent</CardTitle>
            <Mail className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">
                  {formatNumber(metrics.emailsSent.usage)}
                </span>
                <Badge variant="outline">
                  {formatCurrency(metrics.emailsSent.cost)}
                </Badge>
              </div>
              
              {metrics.emailsSent.limit && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Usage</span>
                    <span>{formatNumber(metrics.emailsSent.limit)} limit</span>
                  </div>
                  <Progress 
                    value={getUsagePercentage(metrics.emailsSent.usage, metrics.emailsSent.limit)}
                    className="h-2"
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leads Enriched</CardTitle>
            <Users className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">
                  {formatNumber(metrics.leadsEnriched.usage)}
                </span>
                <Badge variant="outline">
                  {formatCurrency(metrics.leadsEnriched.cost)}
                </Badge>
              </div>
              
              {metrics.leadsEnriched.limit && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Usage</span>
                    <span>{formatNumber(metrics.leadsEnriched.limit)} limit</span>
                  </div>
                  <Progress 
                    value={getUsagePercentage(metrics.leadsEnriched.usage, metrics.leadsEnriched.limit)}
                    className="h-2"
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trends">
            <TrendingUp className="h-4 w-4 mr-2" />
            Usage Trends
          </TabsTrigger>
          <TabsTrigger value="features">
            <Activity className="h-4 w-4 mr-2" />
            Feature Usage
          </TabsTrigger>
          <TabsTrigger value="costs">
            <DollarSign className="h-4 w-4 mr-2" />
            Cost Breakdown
          </TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Usage Trends</CardTitle>
                  <CardDescription>
                    Track your usage patterns over time
                  </CardDescription>
                </div>
                <div className="flex space-x-2">
                  <Select value={selectedMetric} onValueChange={setSelectedMetric}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ai_tokens">AI Tokens</SelectItem>
                      <SelectItem value="emails_sent">Emails Sent</SelectItem>
                      <SelectItem value="leads_enriched">Leads Enriched</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 days</SelectItem>
                      <SelectItem value="30">30 days</SelectItem>
                      <SelectItem value="90">90 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={usageTrends}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(date) => new Date(date).toLocaleDateString()}
                    />
                    <YAxis tickFormatter={formatNumber} />
                    <Tooltip 
                      labelFormatter={(date) => new Date(date).toLocaleDateString()}
                      formatter={(value: number, name: string) => [
                        name === 'usage' ? formatNumber(value) : formatCurrency(value),
                        name === 'usage' ? 'Usage' : 'Cost'
                      ]}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="usage" 
                      stroke={chartColors.primary} 
                      fill={chartColors.primary}
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="features" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Feature Usage Analytics</CardTitle>
              <CardDescription>
                See which features are used most frequently
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {featureUsage.slice(0, 10).map((feature, index) => (
                  <div key={feature.feature_name} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <div>
                        <p className="font-medium">{feature.feature_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {feature.feature_category}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{feature.usage_count}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(feature.last_used).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="costs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cost Breakdown</CardTitle>
              <CardDescription>
                Understand where your costs are coming from
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { 
                      name: 'AI Tokens', 
                      cost: metrics.aiTokens.cost,
                      usage: metrics.aiTokens.usage
                    },
                    { 
                      name: 'Emails', 
                      cost: metrics.emailsSent.cost,
                      usage: metrics.emailsSent.usage
                    },
                    { 
                      name: 'Enrichment', 
                      cost: metrics.leadsEnriched.cost,
                      usage: metrics.leadsEnriched.usage
                    }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={formatCurrency} />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Bar 
                      dataKey="cost" 
                      fill={chartColors.primary}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-600">
                    {formatCurrency(metrics.aiTokens.cost)}
                  </p>
                  <p className="text-sm text-muted-foreground">AI Processing</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCurrency(metrics.emailsSent.cost)}
                  </p>
                  <p className="text-sm text-muted-foreground">Email Delivery</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(metrics.leadsEnriched.cost)}
                  </p>
                  <p className="text-sm text-muted-foreground">Data Enrichment</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Usage Alerts */}
      {(getUsageStatus(metrics.aiTokens.usage, metrics.aiTokens.limit) !== 'normal' ||
        getUsageStatus(metrics.emailsSent.usage, metrics.emailsSent.limit) !== 'normal' ||
        getUsageStatus(metrics.leadsEnriched.usage, metrics.leadsEnriched.limit) !== 'normal') && (
        <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20">
          <CardHeader>
            <CardTitle className="flex items-center text-orange-800 dark:text-orange-400">
              <AlertTriangle className="h-5 w-5 mr-2" />
              Usage Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {getUsageStatus(metrics.aiTokens.usage, metrics.aiTokens.limit) !== 'normal' && (
                <p className="text-sm">
                  ⚠️ AI token usage is at {getUsagePercentage(metrics.aiTokens.usage, metrics.aiTokens.limit).toFixed(0)}% of your monthly limit
                </p>
              )}
              {getUsageStatus(metrics.emailsSent.usage, metrics.emailsSent.limit) !== 'normal' && (
                <p className="text-sm">
                  ⚠️ Email usage is at {getUsagePercentage(metrics.emailsSent.usage, metrics.emailsSent.limit).toFixed(0)}% of your monthly limit
                </p>
              )}
              {getUsageStatus(metrics.leadsEnriched.usage, metrics.leadsEnriched.limit) !== 'normal' && (
                <p className="text-sm">
                  ⚠️ Lead enrichment usage is at {getUsagePercentage(metrics.leadsEnriched.usage, metrics.leadsEnriched.limit).toFixed(0)}% of your monthly limit
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}