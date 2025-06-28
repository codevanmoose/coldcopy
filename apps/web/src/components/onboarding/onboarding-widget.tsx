'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { 
  CheckCircle2, 
  Circle, 
  ArrowRight,
  X,
  RotateCcw,
  ExternalLink
} from 'lucide-react'
import Link from 'next/link'
import { useSupabase } from '@/lib/supabase/client'

interface OnboardingWidgetProps {
  className?: string
  onDismiss?: () => void
  variant?: 'default' | 'compact' | 'minimal'
}

interface OnboardingProgress {
  totalSteps: number
  completedSteps: number
  requiredSteps: number
  completedRequiredSteps: number
  nextStep?: {
    id: string
    title: string
    description: string
    href: string
    estimatedTime: string
  }
  isComplete: boolean
}

const ONBOARDING_STEPS = [
  {
    id: 'workspace-setup',
    title: 'Complete Workspace Setup',
    description: 'Configure your workspace settings',
    href: '/settings/workspace',
    required: true,
    estimatedTime: '2 min'
  },
  {
    id: 'email-configuration',
    title: 'Connect Email Account',
    description: 'Set up email sending',
    href: '/settings/email',
    required: true,
    estimatedTime: '5 min'
  },
  {
    id: 'import-leads',
    title: 'Import Your First Leads',
    description: 'Upload or import prospects',
    href: '/leads/import',
    required: true,
    estimatedTime: '3 min'
  },
  {
    id: 'create-campaign',
    title: 'Create Your First Campaign',
    description: 'Build an email sequence',
    href: '/campaigns/new',
    required: true,
    estimatedTime: '10 min'
  },
  {
    id: 'invite-team',
    title: 'Invite Team Members',
    description: 'Add colleagues to collaborate',
    href: '/settings/team',
    required: false,
    estimatedTime: '2 min'
  },
  {
    id: 'launch-campaign',
    title: 'Launch Your First Campaign',
    description: 'Start your outreach',
    href: '/campaigns',
    required: true,
    estimatedTime: '1 min'
  }
]

export function OnboardingWidget({ className, onDismiss, variant = 'default' }: OnboardingWidgetProps) {
  const [progress, setProgress] = useState<OnboardingProgress | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDismissed, setIsDismissed] = useState(false)
  const supabase = useSupabase()

  useEffect(() => {
    // Check if widget was previously dismissed
    const dismissed = localStorage.getItem('coldcopy-onboarding-widget-dismissed')
    if (dismissed === 'true') {
      setIsDismissed(true)
      return
    }

    checkOnboardingProgress()
  }, [])

  const checkOnboardingProgress = async () => {
    setIsLoading(true)
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('workspace_id')
        .eq('id', user.id)
        .single()

      if (!profile?.workspace_id) return

      const workspaceId = profile.workspace_id
      const completionStatus = await Promise.all(
        ONBOARDING_STEPS.map(async (step) => ({
          ...step,
          completed: await checkStepCompletion(step.id, workspaceId)
        }))
      )

      const totalSteps = ONBOARDING_STEPS.length
      const completedSteps = completionStatus.filter(s => s.completed).length
      const requiredSteps = ONBOARDING_STEPS.filter(s => s.required).length
      const completedRequiredSteps = completionStatus.filter(s => s.required && s.completed).length
      const nextStep = completionStatus.find(s => s.required && !s.completed)

      setProgress({
        totalSteps,
        completedSteps,
        requiredSteps,
        completedRequiredSteps,
        nextStep,
        isComplete: completedRequiredSteps === requiredSteps
      })
    } catch (error) {
      console.error('Failed to check onboarding progress:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const checkStepCompletion = async (stepId: string, workspaceId: string): Promise<boolean> => {
    try {
      switch (stepId) {
        case 'workspace-setup':
          const { data: workspace } = await supabase
            .from('workspaces')
            .select('name, timezone')
            .eq('id', workspaceId)
            .single()
          return !!(workspace?.name && workspace?.timezone)

        case 'email-configuration':
          const { data: emailConfig } = await supabase
            .from('email_accounts')
            .select('id')
            .eq('workspace_id', workspaceId)
            .eq('status', 'active')
            .limit(1)
          return (emailConfig?.length || 0) > 0

        case 'import-leads':
          const { data: leads } = await supabase
            .from('leads')
            .select('id')
            .eq('workspace_id', workspaceId)
            .limit(1)
          return (leads?.length || 0) > 0

        case 'create-campaign':
          const { data: campaigns } = await supabase
            .from('campaigns')
            .select('id')
            .eq('workspace_id', workspaceId)
            .limit(1)
          return (campaigns?.length || 0) > 0

        case 'invite-team':
          const { data: members } = await supabase
            .from('workspace_members')
            .select('id')
            .eq('workspace_id', workspaceId)
          return (members?.length || 0) > 1

        case 'launch-campaign':
          const { data: activeCampaigns } = await supabase
            .from('campaigns')
            .select('id')
            .eq('workspace_id', workspaceId)
            .eq('status', 'active')
            .limit(1)
          return (activeCampaigns?.length || 0) > 0

        default:
          return false
      }
    } catch (error) {
      console.error(`Failed to check ${stepId} completion:`, error)
      return false
    }
  }

  const handleDismiss = () => {
    setIsDismissed(true)
    localStorage.setItem('coldcopy-onboarding-widget-dismissed', 'true')
    onDismiss?.()
  }

  const handleReset = () => {
    setIsDismissed(false)
    localStorage.removeItem('coldcopy-onboarding-widget-dismissed')
  }

  // Don't show if loading, dismissed, or no progress data
  if (isLoading || isDismissed || !progress) {
    return null
  }

  // Don't show if onboarding is complete
  if (progress.isComplete) {
    return null
  }

  const progressPercentage = (progress.completedRequiredSteps / progress.requiredSteps) * 100

  if (variant === 'minimal') {
    return (
      <div className={`flex items-center space-x-3 p-3 bg-blue-50 rounded-lg border border-blue-200 ${className}`}>
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-blue-900">
              Getting Started
            </span>
            <Badge variant="secondary" className="text-xs">
              {progress.completedRequiredSteps}/{progress.requiredSteps}
            </Badge>
          </div>
          <Progress value={progressPercentage} className="h-1 mt-1" />
        </div>
        {progress.nextStep && (
          <Link href={progress.nextStep.href}>
            <Button size="sm" variant="outline">
              Continue
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        )}
        <Button variant="ghost" size="sm" onClick={handleDismiss}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold">Getting Started</h3>
              <p className="text-xs text-muted-foreground">
                {progress.completedRequiredSteps} of {progress.requiredSteps} steps completed
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleDismiss}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <Progress value={progressPercentage} className="h-2 mb-3" />
          
          {progress.nextStep && (
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">
                  {progress.nextStep.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {progress.nextStep.estimatedTime}
                </p>
              </div>
              <Link href={progress.nextStep.href}>
                <Button size="sm" className="ml-2">
                  Continue
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  // Default variant
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Welcome to ColdCopy!</CardTitle>
            <CardDescription>
              Complete your setup to start sending effective cold emails
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={handleDismiss}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Required steps completed</span>
            <span className="font-medium">
              {progress.completedRequiredSteps} of {progress.requiredSteps}
            </span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>

        {progress.nextStep && (
          <div className="p-3 bg-blue-50 rounded-lg">
            <div className="flex items-start space-x-3">
              <Circle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-medium text-blue-900 mb-1">
                  Next: {progress.nextStep.title}
                </h4>
                <p className="text-xs text-blue-700 mb-2">
                  {progress.nextStep.description}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-blue-600">
                    Estimated time: {progress.nextStep.estimatedTime}
                  </span>
                  <Link href={progress.nextStep.href}>
                    <Button size="sm" variant="outline">
                      Get Started
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t">
          <Link href="/onboarding">
            <Button variant="ghost" size="sm" className="text-xs">
              View Full Checklist
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
          <Button
            variant="ghost" 
            size="sm" 
            onClick={handleReset}
            className="text-xs text-muted-foreground"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Reset Progress
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Hook for managing onboarding widget state
export function useOnboardingWidget() {
  const [isVisible, setIsVisible] = useState(true)
  const [isDismissed, setIsDismissed] = useState(false)

  useEffect(() => {
    const dismissed = localStorage.getItem('coldcopy-onboarding-widget-dismissed')
    if (dismissed === 'true') {
      setIsDismissed(true)
      setIsVisible(false)
    }
  }, [])

  const dismissWidget = () => {
    setIsDismissed(true)
    setIsVisible(false)
    localStorage.setItem('coldcopy-onboarding-widget-dismissed', 'true')
  }

  const showWidget = () => {
    setIsDismissed(false)
    setIsVisible(true)
    localStorage.removeItem('coldcopy-onboarding-widget-dismissed')
  }

  const resetWidget = () => {
    setIsDismissed(false)
    setIsVisible(true)
    localStorage.removeItem('coldcopy-onboarding-widget-dismissed')
  }

  return {
    isVisible: isVisible && !isDismissed,
    isDismissed,
    dismissWidget,
    showWidget,
    resetWidget
  }
}