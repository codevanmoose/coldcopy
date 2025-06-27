'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { format } from 'date-fns'
import { 
  Zap, 
  CreditCard, 
  TrendingUp, 
  DollarSign,
  Calendar,
  Download,
  Loader2,
  AlertCircle,
  ExternalLink,
  Check,
  X
} from 'lucide-react'
import { PurchaseTokensDialog } from '@/components/billing/purchase-tokens-dialog'
import { TokenHistory } from '@/components/billing/token-history'
import { UpgradeModal } from '@/components/billing/upgrade-modal'
import { UsageDisplay } from '@/components/billing/usage-display'
import { PaymentMethodManager } from '@/components/billing/payment-method-manager'
import type { 
  Subscription, 
  SubscriptionPlan,
  BillingSummary,
  UsageSummary 
} from '@/lib/billing/types'

export default function BillingPage() {
  const { workspace, dbUser } = useAuthStore()
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState<'current' | '30d' | '90d'>('current')
  const queryClient = useQueryClient()
  const supabase = createClient()
  
  // Check if coming from trial expired redirect
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const isTrialExpired = searchParams?.get('trial_expired') === 'true'
  const isSubscriptionInactive = searchParams?.get('subscription_inactive') === 'true'

  // Fetch billing summary
  const { data: billingSummary, isLoading: summaryLoading } = useQuery({
    queryKey: ['billing-summary', workspace?.id],
    queryFn: async () => {
      if (!workspace) return null
      
      const response = await fetch('/api/billing/subscription', {
        headers: {
          'x-workspace-id': workspace.id
        }
      })
      
      if (!response.ok) throw new Error('Failed to fetch billing summary')
      
      return response.json() as Promise<BillingSummary>
    },
    enabled: !!workspace,
  })

  // Fetch usage data
  const { data: usageData, isLoading: usageLoading } = useQuery({
    queryKey: ['usage-data', workspace?.id, selectedPeriod],
    queryFn: async () => {
      if (!workspace) return null
      
      const response = await fetch(`/api/billing/usage?period=${selectedPeriod}`, {
        headers: {
          'x-workspace-id': workspace.id
        }
      })
      
      if (!response.ok) throw new Error('Failed to fetch usage data')
      
      return response.json() as Promise<UsageSummary>
    },
    enabled: !!workspace,
  })

  // Cancel subscription mutation
  const cancelSubscription = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/billing/subscription', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-workspace-id': workspace!.id
        },
        body: JSON.stringify({
          cancelAtPeriodEnd: true,
          reason: 'customer_request'
        })
      })
      
      if (!response.ok) throw new Error('Failed to cancel subscription')
      
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-summary'] })
    }
  })

  // Create portal session
  const createPortalSession = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-workspace-id': workspace!.id
        },
        body: JSON.stringify({
          returnUrl: window.location.href
        })
      })
      
      if (!response.ok) throw new Error('Failed to create portal session')
      
      const { url } = await response.json()
      return url
    },
    onSuccess: (url) => {
      window.location.href = url
    }
  })

  if (!workspace || summaryLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const subscription = billingSummary?.subscription
  const currentPlan = billingSummary?.currentPlan
  const isFreePlan = currentPlan?.slug === 'free'
  const isTrial = subscription?.status === 'trialing'
  const trialDaysRemaining = subscription?.trialEnd 
    ? Math.max(0, Math.ceil((new Date(subscription.trialEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0

  return (
    <div className="space-y-6">
      {/* Trial Expired Alert */}
      {(isTrialExpired || isSubscriptionInactive) && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>
            {isTrialExpired ? 'Your trial has expired' : 'Subscription inactive'}
          </AlertTitle>
          <AlertDescription>
            {isTrialExpired 
              ? 'Upgrade now to continue using all ColdCopy features and regain access to your campaigns.'
              : 'Your subscription is inactive. Please update your payment method or choose a new plan to continue.'
            }
          </AlertDescription>
        </Alert>
      )}
      
      {/* Limited Time Offer for Trial Users */}
      {isTrial && trialDaysRemaining <= 7 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-600" />
              <CardTitle className="text-amber-900">Limited Time Offer</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-amber-800 mb-4">
              Upgrade now and get <strong>20% off</strong> your first 3 months! 
              This exclusive offer expires when your trial ends.
            </p>
            <Button 
              onClick={() => setIsUpgradeModalOpen(true)}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Claim 20% Discount
            </Button>
          </CardContent>
        </Card>
      )}
      {/* Current Plan Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Current Plan</CardTitle>
              <CardDescription>
                Manage your subscription and billing details
              </CardDescription>
            </div>
            {!isFreePlan && (
              <Button
                variant="outline"
                onClick={() => createPortalSession.mutate()}
                disabled={createPortalSession.isPending}
              >
                {createPortalSession.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="mr-2 h-4 w-4" />
                )}
                Manage in Stripe
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-2xl font-bold">{currentPlan?.name || 'Free'}</h3>
                  {subscription?.status && (
                    <Badge variant={
                      subscription.status === 'active' ? 'default' :
                      subscription.status === 'trialing' ? 'secondary' :
                      'destructive'
                    }>
                      {subscription.status}
                    </Badge>
                  )}
                  {isTrial && (
                    <Badge variant="outline" className="border-amber-500 text-amber-700">
                      {trialDaysRemaining} days left
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {currentPlan?.description}
                </p>
              </div>
              
              <div className="text-right">
                <div className="text-2xl font-bold">
                  {isTrial ? (
                    <span className="text-green-600">Free Trial</span>
                  ) : (
                    `$${currentPlan?.priceMonthly || 0}/mo`
                  )}
                </div>
                {subscription?.currentPeriodEnd && (
                  <p className="text-sm text-muted-foreground">
                    {isTrial 
                      ? `Trial ends ${format(new Date(subscription.trialEnd || subscription.currentPeriodEnd), 'MMM d, yyyy')}`
                      : `Renews ${format(new Date(subscription.currentPeriodEnd), 'MMM d, yyyy')}`
                    }
                  </p>
                )}
              </div>
            </div>

            {/* Plan Features */}
            <div className="grid gap-2 md:grid-cols-2">
              {currentPlan?.features.slice(0, 4).map((feature, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">{feature}</span>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              {isFreePlan ? (
                <Button onClick={() => setIsUpgradeModalOpen(true)}>
                  Upgrade Plan
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setIsUpgradeModalOpen(true)}
                  >
                    Change Plan
                  </Button>
                  {subscription?.status === 'active' && !subscription.cancelAtPeriodEnd && (
                    <Button
                      variant="outline"
                      onClick={() => cancelSubscription.mutate()}
                      disabled={cancelSubscription.isPending}
                    >
                      {cancelSubscription.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Cancel Subscription
                    </Button>
                  )}
                </>
              )}
            </div>

            {subscription?.cancelAtPeriodEnd && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Subscription Ending</AlertTitle>
                <AlertDescription>
                  Your subscription will end on {format(new Date(subscription.currentPeriodEnd!), 'MMM d, yyyy')}.
                  You can reactivate it anytime before this date.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Usage Overview */}
      <UsageDisplay 
        workspaceId={workspace.id}
        currentPlan={currentPlan}
        usageData={usageData}
      />

      {/* Token Balance for backwards compatibility */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Token Balance</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {workspace.ai_tokens_balance.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Available for use
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tokens Used</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {workspace.ai_tokens_used.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              This billing period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${usageData?.totalCost || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Current period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Invoice</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${billingSummary?.upcomingInvoice?.amountDue 
                ? (billingSummary.upcomingInvoice.amountDue / 100).toFixed(2)
                : '0.00'
              }
            </div>
            <p className="text-xs text-muted-foreground">
              {billingSummary?.upcomingInvoice?.dueDate 
                ? format(new Date(billingSummary.upcomingInvoice.dueDate), 'MMM d')
                : 'No upcoming charges'
              }
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Purchase Tokens */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>AI Tokens</CardTitle>
              <CardDescription>
                Purchase additional AI tokens for email generation
              </CardDescription>
            </div>
            <PurchaseTokensDialog />
          </div>
        </CardHeader>
      </Card>

      {/* Tabs for detailed information */}
      <Tabs defaultValue="invoices">
        <TabsList>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="payment-methods">Payment Methods</TabsTrigger>
          <TabsTrigger value="history">Token History</TabsTrigger>
          <TabsTrigger value="usage-details">Usage Details</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Invoice History</CardTitle>
              <CardDescription>
                Download invoices for your records
              </CardDescription>
            </CardHeader>
            <CardContent>
              {billingSummary?.subscription ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Invoices are automatically generated for each billing period.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => createPortalSession.mutate()}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    View Invoices in Stripe
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <CreditCard className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    No invoices yet. Upgrade to a paid plan to get started.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payment-methods">
          <PaymentMethodManager 
            workspaceId={workspace.id}
            paymentMethods={billingSummary?.paymentMethods || []}
            defaultPaymentMethodId={billingSummary?.defaultPaymentMethod?.id}
          />
        </TabsContent>

        <TabsContent value="history">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Button
                variant={selectedPeriod === 'current' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedPeriod('current')}
              >
                Current Period
              </Button>
              <Button
                variant={selectedPeriod === '30d' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedPeriod('30d')}
              >
                30 days
              </Button>
              <Button
                variant={selectedPeriod === '90d' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedPeriod('90d')}
              >
                90 days
              </Button>
            </div>

            <TokenHistory workspaceId={workspace.id} />
          </div>
        </TabsContent>

        <TabsContent value="usage-details">
          <Card>
            <CardHeader>
              <CardTitle>Detailed Usage Report</CardTitle>
              <CardDescription>
                Track your resource consumption across all features
              </CardDescription>
            </CardHeader>
            <CardContent>
              {usageData && (
                <div className="space-y-6">
                  {Object.entries(usageData.usage).map(([metric, data]) => (
                    <div key={metric} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium capitalize">
                          {metric.replace('_', ' ')}
                        </h4>
                        <span className="text-sm text-muted-foreground">
                          {data.quantity.toLocaleString()} / {data.limit?.toLocaleString() || 'Unlimited'}
                        </span>
                      </div>
                      {data.limit && (
                        <Progress 
                          value={data.percentageUsed || 0} 
                          className="h-2"
                        />
                      )}
                      {data.cost > 0 && (
                        <p className="text-sm text-muted-foreground">
                          Cost: ${data.cost.toFixed(2)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Upgrade Modal */}
      <UpgradeModal
        open={isUpgradeModalOpen}
        onOpenChange={setIsUpgradeModalOpen}
        currentPlan={currentPlan}
        workspaceId={workspace.id}
      />
    </div>
  )
}