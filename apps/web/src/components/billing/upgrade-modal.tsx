'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Loader2, AlertCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import type { SubscriptionPlan } from '@/lib/billing/types'

interface UpgradeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentPlan?: SubscriptionPlan | null
  workspaceId: string
}

interface ProrationPreview {
  immediateCharge: number
  nextInvoiceAmount: number
  creditsApplied: number
  description: string
}

export function UpgradeModal({ 
  open, 
  onOpenChange, 
  currentPlan,
  workspaceId 
}: UpgradeModalProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [selectedPlanSlug, setSelectedPlanSlug] = useState<string>('')
  const [isYearly, setIsYearly] = useState(false)
  const [showProration, setShowProration] = useState(false)

  // Fetch available plans
  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const response = await fetch('/api/billing/plans')
      if (!response.ok) throw new Error('Failed to fetch plans')
      return response.json() as Promise<SubscriptionPlan[]>
    }
  })

  // Fetch proration preview
  const { data: prorationPreview, isLoading: prorationLoading } = useQuery({
    queryKey: ['proration-preview', selectedPlanSlug, isYearly],
    queryFn: async () => {
      if (!selectedPlanSlug || selectedPlanSlug === currentPlan?.slug) return null
      
      const response = await fetch('/api/billing/subscription/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-workspace-id': workspaceId
        },
        body: JSON.stringify({
          planSlug: selectedPlanSlug,
          isYearly
        })
      })
      
      if (!response.ok) throw new Error('Failed to fetch proration preview')
      return response.json() as Promise<ProrationPreview>
    },
    enabled: !!selectedPlanSlug && selectedPlanSlug !== currentPlan?.slug
  })

  // Upgrade subscription mutation
  const upgradeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/billing/subscription', {
        method: currentPlan ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-workspace-id': workspaceId
        },
        body: JSON.stringify({
          planSlug: selectedPlanSlug,
          isYearly
        })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to update subscription')
      }
      
      return response.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['billing-summary'] })
      onOpenChange(false)
      
      // If payment is required, redirect to payment
      if (data.requiresAction && data.clientSecret) {
        router.push(`/settings/billing/payment?client_secret=${data.clientSecret}`)
      }
    }
  })

  const availablePlans = plans?.filter(plan => 
    plan.isActive && plan.slug !== 'free' && plan.slug !== currentPlan?.slug
  ) || []

  const selectedPlan = availablePlans.find(plan => plan.slug === selectedPlanSlug)
  const upgradePrice = selectedPlan 
    ? (isYearly ? selectedPlan.priceYearly : selectedPlan.priceMonthly)
    : 0

  const isDowngrade = selectedPlan && currentPlan && 
    (isYearly ? selectedPlan.priceYearly : selectedPlan.priceMonthly) < 
    (currentPlan.priceYearly || currentPlan.priceMonthly)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {currentPlan ? 'Change Subscription Plan' : 'Choose a Plan'}
          </DialogTitle>
          <DialogDescription>
            Select the plan that best fits your needs. You can change anytime.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Billing Period Toggle */}
          <div className="flex items-center justify-center gap-4 p-4 bg-muted/50 rounded-lg">
            <span className={cn(
              "text-sm font-medium",
              !isYearly && "text-foreground",
              isYearly && "text-muted-foreground"
            )}>
              Monthly
            </span>
            <Switch
              checked={isYearly}
              onCheckedChange={setIsYearly}
            />
            <span className={cn(
              "text-sm font-medium",
              isYearly && "text-foreground",
              !isYearly && "text-muted-foreground"
            )}>
              Yearly
              <Badge variant="secondary" className="ml-2">
                Save 20%
              </Badge>
            </span>
          </div>

          {/* Plan Selection */}
          {plansLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <RadioGroup
              value={selectedPlanSlug}
              onValueChange={setSelectedPlanSlug}
              className="space-y-4"
            >
              {availablePlans.map((plan) => {
                const price = isYearly ? plan.priceYearly : plan.priceMonthly
                const displayPrice = isYearly && price > 0 ? price / 12 : price
                
                return (
                  <Label
                    key={plan.slug}
                    htmlFor={plan.slug}
                    className="cursor-pointer"
                  >
                    <Card className={cn(
                      "transition-all",
                      selectedPlanSlug === plan.slug && "border-primary ring-2 ring-primary ring-offset-2"
                    )}>
                      <CardHeader className="pb-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <RadioGroupItem 
                              value={plan.slug} 
                              id={plan.slug}
                              className="mt-1"
                            />
                            <div className="space-y-1">
                              <CardTitle className="text-lg">
                                {plan.name}
                                {plan.isPopular && (
                                  <Badge variant="secondary" className="ml-2">
                                    Popular
                                  </Badge>
                                )}
                              </CardTitle>
                              <CardDescription>
                                {plan.description}
                              </CardDescription>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold">
                              ${displayPrice}
                              <span className="text-sm font-normal text-muted-foreground">
                                /mo
                              </span>
                            </div>
                            {isYearly && price > 0 && (
                              <div className="text-sm text-muted-foreground">
                                ${price} billed annually
                              </div>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-2 md:grid-cols-2">
                          {plan.features.slice(0, 6).map((feature, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <Check className="h-4 w-4 text-green-500 shrink-0" />
                              <span className="text-sm">{feature}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </Label>
                )
              })}
            </RadioGroup>
          )}

          {/* Proration Preview */}
          {selectedPlanSlug && prorationPreview && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium">Billing Preview:</p>
                  <div className="text-sm space-y-1">
                    {prorationPreview.immediateCharge > 0 && (
                      <p>Due today: ${(prorationPreview.immediateCharge / 100).toFixed(2)}</p>
                    )}
                    {prorationPreview.creditsApplied > 0 && (
                      <p>Credits applied: ${(prorationPreview.creditsApplied / 100).toFixed(2)}</p>
                    )}
                    <p>Next invoice: ${(prorationPreview.nextInvoiceAmount / 100).toFixed(2)}</p>
                  </div>
                  {prorationPreview.description && (
                    <p className="text-sm text-muted-foreground mt-2">
                      {prorationPreview.description}
                    </p>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Downgrade Warning */}
          {isDowngrade && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You are downgrading your plan. Some features may become unavailable. 
                The change will take effect at the end of your current billing period.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={upgradeMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => upgradeMutation.mutate()}
            disabled={!selectedPlanSlug || upgradeMutation.isPending}
          >
            {upgradeMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {isDowngrade ? 'Downgrade' : 'Upgrade'} Plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}