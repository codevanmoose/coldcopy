'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TrialOnboarding } from '@/components/onboarding/trial-onboarding'
import { OnboardingWidget } from '@/components/onboarding/onboarding-widget'
import { AIFeaturesSection } from '@/components/dashboard/ai-features-section'
import { useWorkspace } from '@/hooks/use-workspace'
import { api } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { 
  Users, 
  Mail, 
  Target, 
  TrendingUp,
  Send,
  MousePointerClick,
  MessageSquare,
  UserPlus,
  Loader2
} from 'lucide-react'

interface AnalyticsData {
  overview: {
    total_leads: number
    leads_this_month: number
    leads_growth: number
    emails_sent: number
    emails_this_month: number
    emails_growth: number
    open_rate: number
    open_rate_change: number
    reply_rate: number
    reply_rate_change: number
    total_campaigns: number
    active_campaigns: number
    campaigns_this_month: number
  }
  recent_activity: Array<{
    id: string
    type: string
    title: string
    description: string
    time: string
    icon: string
  }>
  campaign_performance: Array<{
    id: string
    name: string
    status: string
    emails_sent: number
    open_rate: number
    reply_rate: number
  }>
}

export default function DashboardPage() {
  const { workspace } = useWorkspace()
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [isNewUser, setIsNewUser] = useState(false)
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false)

  useEffect(() => {
    if (workspace?.id) {
      checkIfNewUser()
      fetchAnalytics()
    }
  }, [workspace?.id])

  const fetchAnalytics = async () => {
    if (!workspace?.id) return

    setIsLoadingAnalytics(true)
    try {
      const response = await api.analytics.overview(workspace.id)
      if (response.data) {
        setAnalytics(response.data)
      }
    } catch (error) {
      console.error('Error fetching analytics:', error)
    } finally {
      setIsLoadingAnalytics(false)
    }
  }

  const checkIfNewUser = async () => {
    if (!workspace?.id) return

    try {
      // Check if user has completed onboarding
      const onboardingKey = `trial-onboarding-completed-${workspace.id}`
      const completed = localStorage.getItem(onboardingKey)
      
      if (!completed) {
        // Check if this is a trial user
        const response = await api.workspaces.get(workspace.id)
        
        if (response.data?.subscription?.status === 'trialing') {
          const createdAt = new Date(response.data.subscription.created_at)
          const hoursSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60)
          
          // Show onboarding if trial was created within the last 24 hours
          if (hoursSinceCreation < 24) {
            setIsNewUser(true)
            setShowOnboarding(true)
          }
        }
      }
    } catch (error) {
      console.error('Error checking user status:', error)
    }
  }

  // Generate stats from analytics data
  const getStatsFromAnalytics = () => {
    if (!analytics) return []

    return [
      {
        title: 'Total Leads',
        value: analytics.overview.total_leads.toLocaleString(),
        change: `+${analytics.overview.leads_growth}%`,
        icon: Users,
        trend: analytics.overview.leads_growth >= 0 ? 'up' : 'down',
      },
      {
        title: 'Emails Sent',
        value: analytics.overview.emails_sent.toLocaleString(),
        change: `+${analytics.overview.emails_growth}%`,
        icon: Send,
        trend: analytics.overview.emails_growth >= 0 ? 'up' : 'down',
      },
      {
        title: 'Open Rate',
        value: `${analytics.overview.open_rate}%`,
        change: `${analytics.overview.open_rate_change >= 0 ? '+' : ''}${analytics.overview.open_rate_change}%`,
        icon: Mail,
        trend: analytics.overview.open_rate_change >= 0 ? 'up' : 'down',
      },
      {
        title: 'Reply Rate',
        value: `${analytics.overview.reply_rate}%`,
        change: `${analytics.overview.reply_rate_change >= 0 ? '+' : ''}${analytics.overview.reply_rate_change}%`,
        icon: MessageSquare,
        trend: analytics.overview.reply_rate_change >= 0 ? 'up' : 'down',
      },
    ]
  }

  const formatActivityTime = (timeString: string) => {
    const time = new Date(timeString)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hours ago`
    return `${Math.floor(diffInMinutes / 1440)} days ago`
  }

  return (
    <>
      {isNewUser && (
        <TrialOnboarding 
          open={showOnboarding} 
          onComplete={() => setShowOnboarding(false)} 
        />
      )}
      
      <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here's an overview of your outreach performance.
        </p>
      </div>

      {/* Onboarding Widget */}
      <OnboardingWidget />

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="group hover:shadow-md transition-shadow cursor-pointer">
          <Link href="/campaigns/new">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Target className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Create Campaign</h3>
                  <p className="text-sm text-muted-foreground">Start a new email campaign</p>
                </div>
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="group hover:shadow-md transition-shadow cursor-pointer">
          <Link href="/leads">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <UserPlus className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <h3 className="font-semibold">Add Leads</h3>
                  <p className="text-sm text-muted-foreground">Import or add new leads</p>
                </div>
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="group hover:shadow-md transition-shadow cursor-pointer">
          <Link href="/templates">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <Mail className="h-6 w-6 text-purple-500" />
                </div>
                <div>
                  <h3 className="font-semibold">Create Template</h3>
                  <p className="text-sm text-muted-foreground">Design email templates</p>
                </div>
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="group hover:shadow-md transition-shadow cursor-pointer">
          <Link href="/analytics">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <h3 className="font-semibold">View Analytics</h3>
                  <p className="text-sm text-muted-foreground">Track performance</p>
                </div>
              </div>
            </CardContent>
          </Link>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isLoadingAnalytics ? (
          // Loading state
          [...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                <div className="h-4 w-4 bg-muted animate-pulse rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 bg-muted animate-pulse rounded mb-1" />
                <div className="h-3 w-24 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))
        ) : (
          // Real data
          getStatsFromAnalytics().map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className={cn(
                  "text-xs",
                  stat.trend === 'up' ? 'text-green-600' : 'text-red-600'
                )}>
                  {stat.change} from last month
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Campaign Performance</CardTitle>
            <CardDescription>
              Your active campaigns this month
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingAnalytics ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                      <div className="h-3 w-32 bg-muted animate-pulse rounded" />
                    </div>
                    <div className="h-6 w-16 bg-muted animate-pulse rounded" />
                  </div>
                ))}
              </div>
            ) : analytics?.campaign_performance?.length ? (
              <div className="space-y-4">
                {analytics.campaign_performance.map((campaign) => (
                  <div key={campaign.id} className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{campaign.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {campaign.emails_sent} emails sent · {campaign.open_rate}% open rate
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Target className={cn(
                        "h-4 w-4",
                        campaign.status === 'active' ? 'text-primary' : 'text-yellow-600'
                      )} />
                      <span className="text-sm font-medium capitalize">{campaign.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Target className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No campaigns yet</p>
                <p className="text-xs text-muted-foreground">Create your first campaign to see performance data</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Latest interactions from your campaigns
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingAnalytics ? (
              <div className="space-y-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <div className="h-8 w-8 bg-muted animate-pulse rounded-full" />
                    <div className="flex-1 space-y-1">
                      <div className="h-4 w-full bg-muted animate-pulse rounded" />
                      <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : analytics?.recent_activity?.length ? (
              <div className="space-y-4">
                {analytics.recent_activity.slice(0, 4).map((activity) => (
                  <div key={activity.id} className="flex items-center space-x-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                      {activity.icon === 'message-square' && <MessageSquare className="h-4 w-4 text-primary" />}
                      {activity.icon === 'mail' && <Mail className="h-4 w-4 text-primary" />}
                      {activity.icon === 'target' && <Target className="h-4 w-4 text-primary" />}
                      {activity.icon === 'user-plus' && <UserPlus className="h-4 w-4 text-primary" />}
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium">{activity.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {activity.description} · {formatActivityTime(activity.time)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No recent activity</p>
                <p className="text-xs text-muted-foreground">Activity will appear here as you use the platform</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Features Section */}
        <div className="md:col-span-2 lg:col-span-1">
          <AIFeaturesSection />
        </div>
      </div>
    </div>
    </>
  )
}

