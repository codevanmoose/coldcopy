'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TrialOnboarding } from '@/components/onboarding/trial-onboarding'
import { useWorkspace } from '@/hooks/use-workspace'
import { supabase } from '@/lib/supabase/client'
import { 
  Users, 
  Mail, 
  Target, 
  TrendingUp,
  Send,
  MousePointerClick,
  MessageSquare,
  UserPlus
} from 'lucide-react'

const stats = [
  {
    title: 'Total Leads',
    value: '2,451',
    change: '+12.5%',
    icon: Users,
    trend: 'up',
  },
  {
    title: 'Emails Sent',
    value: '8,234',
    change: '+23.1%',
    icon: Send,
    trend: 'up',
  },
  {
    title: 'Open Rate',
    value: '42.3%',
    change: '+2.4%',
    icon: Mail,
    trend: 'up',
  },
  {
    title: 'Reply Rate',
    value: '8.7%',
    change: '-0.8%',
    icon: MessageSquare,
    trend: 'down',
  },
]

const recentActivity = [
  {
    id: 1,
    type: 'reply',
    lead: 'John Doe',
    company: 'Acme Inc',
    campaign: 'Q4 Outreach',
    time: '5 minutes ago',
  },
  {
    id: 2,
    type: 'opened',
    lead: 'Jane Smith',
    company: 'TechCorp',
    campaign: 'Product Launch',
    time: '15 minutes ago',
  },
  {
    id: 3,
    type: 'clicked',
    lead: 'Mike Johnson',
    company: 'StartupXYZ',
    campaign: 'Q4 Outreach',
    time: '1 hour ago',
  },
  {
    id: 4,
    type: 'new_lead',
    lead: 'Sarah Williams',
    company: 'BigCo',
    campaign: 'Product Launch',
    time: '2 hours ago',
  },
]

export default function DashboardPage() {
  const { workspace } = useWorkspace()
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [isNewUser, setIsNewUser] = useState(false)

  useEffect(() => {
    checkIfNewUser()
  }, [workspace?.id])

  const checkIfNewUser = async () => {
    if (!workspace?.id) return

    try {
      // Check if user has completed onboarding
      const onboardingKey = `trial-onboarding-completed-${workspace.id}`
      const completed = localStorage.getItem(onboardingKey)
      
      if (!completed) {
        // Check if this is a trial user
        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('status, created_at')
          .eq('workspace_id', workspace.id)
          .single()
        
        if (subscription?.status === 'trialing') {
          const createdAt = new Date(subscription.created_at)
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
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
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Campaign Performance</CardTitle>
            <CardDescription>
              Your active campaigns this month
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Q4 Outreach</p>
                  <p className="text-xs text-muted-foreground">
                    324 emails sent · 45% open rate
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Target className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Active</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Product Launch</p>
                  <p className="text-xs text-muted-foreground">
                    189 emails sent · 38% open rate
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Target className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Active</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Re-engagement</p>
                  <p className="text-xs text-muted-foreground">
                    567 emails scheduled
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Target className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm font-medium">Scheduled</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Latest interactions from your campaigns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center space-x-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                    {activity.type === 'reply' && <MessageSquare className="h-4 w-4 text-primary" />}
                    {activity.type === 'opened' && <Mail className="h-4 w-4 text-primary" />}
                    {activity.type === 'clicked' && <MousePointerClick className="h-4 w-4 text-primary" />}
                    {activity.type === 'new_lead' && <UserPlus className="h-4 w-4 text-primary" />}
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm">
                      <span className="font-medium">{activity.lead}</span>
                      {activity.type === 'reply' && ' replied to'}
                      {activity.type === 'opened' && ' opened'}
                      {activity.type === 'clicked' && ' clicked a link in'}
                      {activity.type === 'new_lead' && ' was added to'}
                      {' '}
                      <span className="text-muted-foreground">{activity.campaign}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {activity.company} · {activity.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </>
  )
}

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(' ')
}