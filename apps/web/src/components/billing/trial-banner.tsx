'use client'

import { useState, useEffect } from 'react'
import { X, AlertCircle, Zap, Clock } from 'lucide-react'
import { differenceInDays, isAfter } from 'date-fns'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useWorkspace } from '@/hooks/use-workspace'
import { supabase } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface TrialBannerProps {
  className?: string
}

export function TrialBanner({ className }: TrialBannerProps) {
  const router = useRouter()
  const { workspace } = useWorkspace()
  const [subscription, setSubscription] = useState<any>(null)
  const [isDismissed, setIsDismissed] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSubscription()
    checkDismissalStatus()
  }, [workspace?.id])

  const loadSubscription = async () => {
    if (!workspace?.id) return

    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select(`
          *,
          plan:subscription_plans(*)
        `)
        .eq('workspace_id', workspace.id)
        .single()

      if (error) throw error
      setSubscription(data)
    } catch (error) {
      console.error('Error loading subscription:', error)
    } finally {
      setLoading(false)
    }
  }

  const checkDismissalStatus = () => {
    const dismissalKey = `trial-banner-dismissed-${workspace?.id}`
    const dismissedDate = localStorage.getItem(dismissalKey)
    
    if (dismissedDate) {
      const today = new Date().toDateString()
      const dismissed = new Date(dismissedDate).toDateString()
      
      // Reset dismissal if it's a new day
      if (today !== dismissed) {
        localStorage.removeItem(dismissalKey)
        setIsDismissed(false)
      } else {
        setIsDismissed(true)
      }
    }
  }

  const handleDismiss = () => {
    const dismissalKey = `trial-banner-dismissed-${workspace?.id}`
    localStorage.setItem(dismissalKey, new Date().toISOString())
    setIsDismissed(true)
  }

  const handleUpgrade = () => {
    router.push('/settings/billing')
  }

  if (loading || isDismissed || !subscription) {
    return null
  }

  // Only show banner for trialing subscriptions
  if (subscription.status !== 'trialing' || !subscription.trial_end) {
    return null
  }

  const trialEndDate = new Date(subscription.trial_end)
  const daysRemaining = differenceInDays(trialEndDate, new Date())
  const isExpired = isAfter(new Date(), trialEndDate)
  const isEndingSoon = daysRemaining <= 3 && daysRemaining >= 0

  if (isExpired) {
    return (
      <Alert className={cn("border-red-200 bg-red-50", className)}>
        <AlertCircle className="h-4 w-4 text-red-600" />
        <AlertDescription className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-800">
            <span className="font-medium">Your trial has expired.</span>
            <span>Upgrade now to continue using all features.</span>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <Button
              size="sm"
              variant="default"
              onClick={handleUpgrade}
              className="bg-red-600 hover:bg-red-700"
            >
              <Zap className="h-3 w-3 mr-1" />
              Upgrade Now
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDismiss}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    )
  }

  if (isEndingSoon) {
    return (
      <Alert className={cn("border-amber-200 bg-amber-50", className)}>
        <Clock className="h-4 w-4 text-amber-600" />
        <AlertDescription className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-800">
            <span className="font-medium">
              {daysRemaining === 0 
                ? 'Trial ends today!' 
                : `Only ${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} left in your trial.`
              }
            </span>
            <span>Upgrade to keep access to all features.</span>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <Button
              size="sm"
              variant="default"
              onClick={handleUpgrade}
              className="bg-amber-600 hover:bg-amber-700"
            >
              <Zap className="h-3 w-3 mr-1" />
              Upgrade Now
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDismiss}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Alert className={cn("border-blue-200 bg-blue-50", className)}>
      <Zap className="h-4 w-4 text-blue-600" />
      <AlertDescription className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-blue-800">
          <span className="font-medium">{daysRemaining} days remaining in your trial.</span>
          <span>Unlock all features with a paid plan.</span>
        </div>
        <div className="flex items-center gap-2 ml-4">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleUpgrade}
          >
            View Plans
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDismiss}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}