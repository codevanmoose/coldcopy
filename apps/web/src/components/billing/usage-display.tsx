'use client'

import { useMemo } from 'react'
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ResponsiveContainer 
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { 
  Mail, 
  Users, 
  Sparkles, 
  TrendingUp, 
  AlertTriangle,
  Info
} from 'lucide-react'
import type { SubscriptionPlan, UsageSummary } from '@/lib/billing/types'

interface UsageDisplayProps {
  workspaceId: string
  currentPlan?: SubscriptionPlan | null
  usageData?: UsageSummary | null
}

const metricIcons = {
  emails_sent: Mail,
  leads_enriched: Users,
  ai_tokens: Sparkles,
}

const metricNames = {
  emails_sent: 'Emails Sent',
  leads_enriched: 'Leads Enriched',
  ai_tokens: 'AI Tokens',
}

export function UsageDisplay({ 
  workspaceId, 
  currentPlan, 
  usageData 
}: UsageDisplayProps) {
  // Calculate usage alerts
  const usageAlerts = useMemo(() => {
    if (!usageData) return []
    
    const alerts = []
    for (const [metric, data] of Object.entries(usageData.usage)) {
      if (data.limit && data.percentageUsed) {
        if (data.percentageUsed >= 90) {
          alerts.push({
            metric,
            level: 'critical' as const,
            message: `${metricNames[metric as keyof typeof metricNames]} usage is at ${data.percentageUsed}% of limit`
          })
        } else if (data.percentageUsed >= 75) {
          alerts.push({
            metric,
            level: 'warning' as const,
            message: `${metricNames[metric as keyof typeof metricNames]} usage is at ${data.percentageUsed}% of limit`
          })
        }
      }
    }
    return alerts
  }, [usageData])

  // Mock historical data for charts
  const mockHistoricalData = [
    { date: 'Day 1', emails: 120, leads: 25, tokens: 1200 },
    { date: 'Day 7', emails: 380, leads: 85, tokens: 3500 },
    { date: 'Day 14', emails: 620, leads: 142, tokens: 6200 },
    { date: 'Day 21', emails: 840, leads: 198, tokens: 8400 },
    { date: 'Today', emails: 950, leads: 235, tokens: 9500 },
  ]

  if (!usageData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Usage Overview</CardTitle>
          <CardDescription>
            Track your resource consumption and limits
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <p className="text-muted-foreground">Loading usage data...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Usage Alerts */}
      {usageAlerts.length > 0 && (
        <div className="space-y-2">
          {usageAlerts.map((alert, index) => (
            <Alert 
              key={index} 
              variant={alert.level === 'critical' ? 'destructive' : 'default'}
            >
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Usage Alert</AlertTitle>
              <AlertDescription>{alert.message}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Usage Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {Object.entries(usageData.usage).map(([metric, data]) => {
          const Icon = metricIcons[metric as keyof typeof metricIcons] || TrendingUp
          const name = metricNames[metric as keyof typeof metricNames] || metric
          
          return (
            <Card key={metric}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">{name}</CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <div className="text-2xl font-bold">
                      {data.quantity.toLocaleString()}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {data.limit 
                        ? `of ${data.limit.toLocaleString()} limit`
                        : 'Unlimited'
                      }
                    </p>
                  </div>
                  
                  {data.limit && (
                    <>
                      <Progress 
                        value={data.percentageUsed || 0} 
                        className="h-2"
                      />
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {data.percentageUsed?.toFixed(1)}% used
                        </span>
                        {data.percentageUsed && data.percentageUsed > 80 && (
                          <Badge 
                            variant={data.percentageUsed >= 90 ? 'destructive' : 'secondary'}
                            className="text-xs"
                          >
                            {data.limit - data.quantity} remaining
                          </Badge>
                        )}
                      </div>
                    </>
                  )}
                  
                  {data.cost > 0 && (
                    <div className="pt-2 border-t">
                      <p className="text-sm">
                        Cost: <span className="font-medium">${data.cost.toFixed(2)}</span>
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Usage Trends Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Usage Trends</CardTitle>
              <CardDescription>
                Monitor your usage patterns over time
              </CardDescription>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full" />
                <span>Emails</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full" />
                <span>Leads</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-purple-500 rounded-full" />
                <span>AI Tokens</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mockHistoricalData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="emails" 
                  stroke="#3B82F6" 
                  strokeWidth={2}
                  dot={{ fill: '#3B82F6' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="leads" 
                  stroke="#10B981" 
                  strokeWidth={2}
                  dot={{ fill: '#10B981' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="tokens" 
                  stroke="#8B5CF6" 
                  strokeWidth={2}
                  dot={{ fill: '#8B5CF6' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Projected Usage */}
      {usageData.projectedCost && (
        <Card>
          <CardHeader>
            <CardTitle>Usage Projections</CardTitle>
            <CardDescription>
              Estimated usage and costs for the current billing period
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Based on your current usage rate, we estimate your total cost this 
                  billing period will be approximately ${usageData.projectedCost.toFixed(2)}.
                </AlertDescription>
              </Alert>
              
              <div className="grid gap-4 md:grid-cols-3">
                {Object.entries(usageData.usage).map(([metric, data]) => {
                  if (!data.limit) return null
                  
                  const projectedUsage = Math.round(
                    (data.quantity / 
                    (new Date().getDate() / 30)) * 30
                  )
                  const projectedPercentage = (projectedUsage / data.limit) * 100
                  
                  return (
                    <div key={metric} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">
                          {metricNames[metric as keyof typeof metricNames]}
                        </span>
                        <span className="text-muted-foreground">
                          ~{projectedUsage.toLocaleString()} projected
                        </span>
                      </div>
                      <Progress 
                        value={Math.min(projectedPercentage, 100)} 
                        className="h-2"
                      />
                      {projectedPercentage > 100 && (
                        <p className="text-xs text-destructive">
                          Projected to exceed limit by {(projectedPercentage - 100).toFixed(0)}%
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}