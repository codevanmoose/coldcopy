'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  CreditCard,
  DollarSign,
  Calendar,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  ExternalLink,
  Zap,
  Mail,
  Users,
  TrendingUp
} from 'lucide-react'
import { UsageDashboard } from './usage-dashboard'
import { LoadingSpinner, ErrorState } from '@/components/ui/loading-states'
import { toast } from 'sonner'

interface Subscription {
  workspace_id: string
  workspace_name: string
  stripe_customer_id?: string
  subscription_status: string
  subscription_plan: string
  trial_ends_at?: string
  stripe_data?: {
    id: string
    status: string
    current_period_start: Date
    current_period_end: Date
    trial_end?: Date
    upcoming_invoice?: {
      amount_due: number
      currency: string
      period_start: Date
      period_end: Date
    }
    items: Array<{
      id: string
      price: {
        id: string
        nickname: string
        unit_amount: number
        currency: string
        type: string
      }
    }>
  }
}

interface PricingPlan {
  id: string
  name: string
  price: number
  interval: string
  features: string[]
  popular?: boolean
}

const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    interval: 'month',
    features: [
      '100 AI tokens/month',
      '50 emails/month',
      '10 lead enrichments/month',
      'Basic analytics',
      'Email support'
    ]
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 29,
    interval: 'month',
    features: [
      '5,000 AI tokens/month',
      '1,000 emails/month',
      '500 lead enrichments/month',
      'Advanced analytics',
      'Email + chat support',
      'Basic integrations'
    ]
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 99,
    interval: 'month',
    popular: true,
    features: [
      '25,000 AI tokens/month',
      '10,000 emails/month',
      '2,500 lead enrichments/month',
      'Premium analytics',
      'Priority support',
      'All integrations',
      'Team collaboration'
    ]
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 299,
    interval: 'month',
    features: [
      'Unlimited AI tokens',
      'Unlimited emails',
      'Unlimited lead enrichments',
      'Custom analytics',
      'Dedicated support',
      'Custom integrations',
      'White-label features',
      'SSO & advanced security'
    ]
  }
]

export function BillingDashboard() {
  const [loading, setLoading] = useState(true)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [showPlanDialog, setShowPlanDialog] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [processingUpgrade, setProcessingUpgrade] = useState(false)
  const [syncingUsage, setSyncingUsage] = useState(false)

  useEffect(() => {
    loadSubscriptionData()
  }, [])

  const loadSubscriptionData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/billing/subscription')
      
      if (!response.ok) {
        throw new Error('Failed to load subscription data')
      }

      const data = await response.json()
      setSubscription(data.subscription)
    } catch (error) {
      console.error('Error loading subscription:', error)
      toast.error('Failed to load subscription data')
    } finally {
      setLoading(false)
    }
  }

  const handlePlanUpgrade = async (planId: string) => {
    try {
      setProcessingUpgrade(true)
      
      // Get the price ID for the plan (this would come from your backend)
      const priceId = `price_${planId}` // Replace with actual Stripe price IDs
      
      const response = await fetch('/api/billing/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price_id: priceId })
      })

      if (!response.ok) {
        throw new Error('Failed to update subscription')
      }

      const data = await response.json()
      toast.success(data.message)
      setShowPlanDialog(false)
      await loadSubscriptionData()
    } catch (error: any) {
      console.error('Error upgrading plan:', error)
      toast.error(error.message || 'Failed to upgrade plan')
    } finally {
      setProcessingUpgrade(false)
    }
  }

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? It will remain active until the end of the current billing period.')) {
      return
    }

    try {
      const response = await fetch('/api/billing/subscription', {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to cancel subscription')
      }

      const data = await response.json()
      toast.success(data.message)
      await loadSubscriptionData()
    } catch (error: any) {
      console.error('Error cancelling subscription:', error)
      toast.error(error.message || 'Failed to cancel subscription')
    }
  }

  const handleSyncUsage = async () => {
    try {
      setSyncingUsage(true)
      
      const response = await fetch('/api/billing/sync-usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })

      if (!response.ok) {
        throw new Error('Failed to sync usage data')
      }

      const data = await response.json()
      toast.success(`${data.synced_records} usage records synced to Stripe`)
      
      if (data.failed_records > 0) {
        toast.warning(`${data.failed_records} records failed to sync`)
      }
    } catch (error: any) {
      console.error('Error syncing usage:', error)
      toast.error(error.message || 'Failed to sync usage data')
    } finally {
      setSyncingUsage(false)
    }
  }

  const openBillingPortal = async () => {
    try {
      const response = await fetch('/api/billing/portal', {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error('Failed to create billing portal session')
      }

      const data = await response.json()
      window.open(data.url, '_blank')
    } catch (error: any) {
      console.error('Error opening billing portal:', error)
      toast.error(error.message || 'Failed to open billing portal')
    }
  }

  const formatCurrency = (amount: number, currency: string = 'usd') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amount / 100)
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active': return 'default'
      case 'trialing': return 'secondary'
      case 'past_due': return 'destructive'
      case 'cancelled': return 'outline'
      case 'free': return 'outline'
      default: return 'outline'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="h-4 w-4" />
      case 'trialing': return <Clock className="h-4 w-4" />
      case 'past_due': return <AlertTriangle className="h-4 w-4" />
      case 'cancelled': return <XCircle className="h-4 w-4" />
      default: return <CreditCard className="h-4 w-4" />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!subscription) {
    return (
      <ErrorState
        description="Failed to load billing information"
        retry={loadSubscriptionData}
      />
    )
  }

  const isTrialing = subscription.subscription_status === 'trialing'
  const trialEndsAt = subscription.trial_ends_at ? new Date(subscription.trial_ends_at) : null
  const daysUntilTrialEnd = trialEndsAt ? Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Billing & Usage</h1>
          <p className="text-muted-foreground">
            Manage your subscription and monitor usage across all features
          </p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={handleSyncUsage} variant="outline" disabled={syncingUsage}>
            <RefreshCw className={`h-4 w-4 mr-2 ${syncingUsage ? 'animate-spin' : ''}`} />
            Sync Usage
          </Button>
          {subscription.stripe_customer_id && (
            <Button onClick={openBillingPortal} variant="outline">
              <ExternalLink className="h-4 w-4 mr-2" />
              Billing Portal
            </Button>
          )}
        </div>
      </div>

      {/* Trial Alert */}
      {isTrialing && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Free Trial Active</AlertTitle>
          <AlertDescription>
            Your free trial ends in {daysUntilTrialEnd} days. Upgrade to continue using premium features.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="usage">Usage Analytics</TabsTrigger>
          <TabsTrigger value="plans">Plans & Pricing</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Current Subscription */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CreditCard className="h-5 w-5 mr-2" />
                Current Subscription
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl font-bold capitalize">
                      {subscription.subscription_plan}
                    </span>
                    <Badge variant={getStatusBadgeVariant(subscription.subscription_status)}>
                      {getStatusIcon(subscription.subscription_status)}
                      <span className="ml-1 capitalize">{subscription.subscription_status}</span>
                    </Badge>
                  </div>
                  <p className="text-muted-foreground">
                    Workspace: {subscription.workspace_name}
                  </p>
                </div>
                <div className="text-right">
                  {subscription.stripe_data?.upcoming_invoice && (
                    <div>
                      <p className="text-2xl font-bold">
                        {formatCurrency(
                          subscription.stripe_data.upcoming_invoice.amount_due,
                          subscription.stripe_data.upcoming_invoice.currency
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Next billing: {subscription.stripe_data.upcoming_invoice.period_end.toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {subscription.stripe_data && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium">Current Period</p>
                    <p className="text-sm text-muted-foreground">
                      {subscription.stripe_data.current_period_start.toLocaleDateString()} - {subscription.stripe_data.current_period_end.toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Subscription Items</p>
                    <div className="space-y-1">
                      {subscription.stripe_data.items.map(item => (
                        <p key={item.id} className="text-sm text-muted-foreground">
                          {item.price.nickname || item.price.id}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <Separator />

              <div className="flex justify-between">
                <Button 
                  onClick={() => setShowPlanDialog(true)}
                  variant="default"
                >
                  {subscription.subscription_plan === 'free' ? 'Upgrade Plan' : 'Change Plan'}
                </Button>
                {subscription.subscription_status === 'active' && subscription.subscription_plan !== 'free' && (
                  <Button 
                    onClick={handleCancelSubscription}
                    variant="outline"
                  >
                    Cancel Subscription
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Usage Overview */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">AI Tokens</CardTitle>
                <Zap className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">12.5K</div>
                <p className="text-xs text-muted-foreground">
                  +15% from last month
                </p>
                <Progress value={45} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Emails Sent</CardTitle>
                <Mail className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">2.1K</div>
                <p className="text-xs text-muted-foreground">
                  +8% from last month
                </p>
                <Progress value={21} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Leads Enriched</CardTitle>
                <Users className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">847</div>
                <p className="text-xs text-muted-foreground">
                  +22% from last month
                </p>
                <Progress value={34} className="mt-2" />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="usage">
          <UsageDashboard />
        </TabsContent>

        <TabsContent value="plans" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {PRICING_PLANS.map(plan => (
              <Card key={plan.id} className={`relative ${plan.popular ? 'border-primary' : ''}`}>
                {plan.popular && (
                  <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                    <Badge variant="default">Most Popular</Badge>
                  </div>
                )}
                <CardHeader>
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>
                    <span className="text-3xl font-bold">${plan.price}</span>
                    <span className="text-muted-foreground">/{plan.interval}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-center text-sm">
                        <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    variant={subscription.subscription_plan === plan.id ? 'outline' : 'default'}
                    disabled={subscription.subscription_plan === plan.id}
                    onClick={() => {
                      setSelectedPlan(plan.id)
                      setShowPlanDialog(true)
                    }}
                  >
                    {subscription.subscription_plan === plan.id ? 'Current Plan' : 
                     plan.price === 0 ? 'Downgrade' : 'Upgrade'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Plan Change Dialog */}
      <Dialog open={showPlanDialog} onOpenChange={setShowPlanDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Subscription Plan</DialogTitle>
            <DialogDescription>
              {selectedPlan && selectedPlan !== subscription.subscription_plan && (
                <>
                  You're about to change from {subscription.subscription_plan} to {selectedPlan} plan.
                  The change will be prorated and reflected in your next invoice.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPlanDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => selectedPlan && handlePlanUpgrade(selectedPlan)}
              disabled={processingUpgrade || !selectedPlan}
            >
              {processingUpgrade && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
              Confirm Change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}