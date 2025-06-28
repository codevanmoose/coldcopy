'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { 
  ArrowRight, 
  ArrowLeft, 
  X, 
  CheckCircle2, 
  Circle,
  Users,
  Mail,
  Target,
  BarChart3,
  Settings,
  Upload,
  Sparkles,
  Play,
  BookOpen
} from 'lucide-react'

interface OnboardingStep {
  id: string
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  content: string
  action?: {
    label: string
    href: string
    variant?: 'default' | 'outline'
  }
  completed?: boolean
  required?: boolean
}

interface OnboardingTourProps {
  isOpen: boolean
  onClose: () => void
  onComplete: () => void
  initialStep?: number
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to ColdCopy!',
    description: 'Get started with AI-powered cold outreach',
    icon: Sparkles,
    content: 'ColdCopy helps you create personalized cold email campaigns that actually convert. Let\'s walk through the key features to get you up and running quickly.',
    action: {
      label: 'Get Started',
      href: '#',
      variant: 'default'
    }
  },
  {
    id: 'workspace-setup',
    title: 'Workspace Setup',
    description: 'Configure your workspace settings',
    icon: Settings,
    content: 'Set up your workspace name, timezone, and basic preferences. This helps personalize your experience and ensures emails are sent at the right times.',
    action: {
      label: 'Configure Workspace',
      href: '/settings/workspace',
      variant: 'default'
    },
    required: true
  },
  {
    id: 'team-invitation',
    title: 'Invite Team Members',
    description: 'Collaborate with your team',
    icon: Users,
    content: 'Add team members to collaborate on campaigns. Different roles are available: Campaign Manager, Outreach Specialist, and Admin.',
    action: {
      label: 'Invite Team',
      href: '/settings/team',
      variant: 'outline'
    }
  },
  {
    id: 'import-leads',
    title: 'Import Your Leads',
    description: 'Upload your prospect list',
    icon: Upload,
    content: 'Import leads from CSV files or connect your CRM. We support various formats and will help clean and validate your data.',
    action: {
      label: 'Import Leads',
      href: '/leads/import',
      variant: 'default'
    },
    required: true
  },
  {
    id: 'email-setup',
    title: 'Email Configuration',
    description: 'Connect your email account',
    icon: Mail,
    content: 'Connect your email account to send campaigns. We support Gmail, Outlook, and custom SMTP servers with authentication setup.',
    action: {
      label: 'Setup Email',
      href: '/settings/email',
      variant: 'default'
    },
    required: true
  },
  {
    id: 'create-campaign',
    title: 'Create Your First Campaign',
    description: 'Launch your outreach strategy',
    icon: Target,
    content: 'Create a multi-step email sequence with AI-generated content. Define your target audience, set follow-up rules, and schedule your campaign.',
    action: {
      label: 'Create Campaign',
      href: '/campaigns/new',
      variant: 'default'
    },
    required: true
  },
  {
    id: 'analytics-overview',
    title: 'Track Performance',
    description: 'Monitor your campaign results',
    icon: BarChart3,
    content: 'View detailed analytics including open rates, click rates, replies, and conversions. Use insights to optimize future campaigns.',
    action: {
      label: 'View Analytics',
      href: '/analytics',
      variant: 'outline'
    }
  },
  {
    id: 'launch-campaign',
    title: 'Launch Your Campaign',
    description: 'Start your outreach',
    icon: Play,
    content: 'Review your campaign settings, preview emails, and launch your first outreach campaign. Monitor progress and replies in real-time.',
    action: {
      label: 'Launch Campaign',
      href: '/campaigns',
      variant: 'default'
    }
  },
  {
    id: 'learn-more',
    title: 'Learn & Optimize',
    description: 'Master cold outreach',
    icon: BookOpen,
    content: 'Access our knowledge base for best practices, templates, and advanced strategies. Join our community for tips and support.',
    action: {
      label: 'Knowledge Base',
      href: '/help',
      variant: 'outline'
    }
  }
]

export function OnboardingTour({ isOpen, onClose, onComplete, initialStep = 0 }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(initialStep)
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)

  const step = ONBOARDING_STEPS[currentStep]
  const totalSteps = ONBOARDING_STEPS.length
  const progressPercentage = ((currentStep + 1) / totalSteps) * 100
  const requiredSteps = ONBOARDING_STEPS.filter(s => s.required)
  const completedRequiredSteps = requiredSteps.filter(s => completedSteps.has(s.id))

  // Load completed steps from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('coldcopy-onboarding-completed')
    if (saved) {
      try {
        const completed = JSON.parse(saved)
        setCompletedSteps(new Set(completed))
      } catch (error) {
        console.error('Failed to load onboarding progress:', error)
      }
    }
  }, [])

  // Save completed steps to localStorage
  useEffect(() => {
    localStorage.setItem(
      'coldcopy-onboarding-completed',
      JSON.stringify(Array.from(completedSteps))
    )
  }, [completedSteps])

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleComplete()
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleStepClick = (stepIndex: number) => {
    setCurrentStep(stepIndex)
  }

  const handleActionClick = async (action: NonNullable<OnboardingStep['action']>) => {
    if (action.href === '#') {
      handleNext()
      return
    }

    setIsLoading(true)
    
    // Mark step as completed
    setCompletedSteps(prev => new Set([...prev, step.id]))
    
    // Navigate to the action href
    window.location.href = action.href
    
    setIsLoading(false)
  }

  const handleSkip = () => {
    setCurrentStep(currentStep + 1)
  }

  const handleComplete = () => {
    // Mark onboarding as completed
    localStorage.setItem('coldcopy-onboarding-completed-at', new Date().toISOString())
    onComplete()
  }

  const markStepComplete = (stepId: string) => {
    setCompletedSteps(prev => new Set([...prev, stepId]))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <step.icon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">{step.title}</CardTitle>
                <CardDescription>{step.description}</CardDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Step {currentStep + 1} of {totalSteps}</span>
              <span>{completedRequiredSteps.length} of {requiredSteps.length} required steps completed</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Step Navigation */}
          <div className="flex flex-wrap gap-2">
            {ONBOARDING_STEPS.map((s, index) => (
              <Button
                key={s.id}
                variant={index === currentStep ? 'default' : 'outline'}
                size="sm"
                className={`relative ${completedSteps.has(s.id) ? 'border-green-500' : ''}`}
                onClick={() => handleStepClick(index)}
              >
                <span className="flex items-center space-x-1">
                  {completedSteps.has(s.id) ? (
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                  ) : (
                    <Circle className="h-3 w-3" />
                  )}
                  <span className="hidden sm:inline">{index + 1}</span>
                </span>
                {s.required && (
                  <Badge variant="secondary" className="ml-1 text-xs px-1 py-0">
                    Required
                  </Badge>
                )}
              </Button>
            ))}
          </div>

          <Separator />

          {/* Step Content */}
          <div className="space-y-4">
            <div className="prose prose-sm max-w-none">
              <p className="text-muted-foreground leading-relaxed">
                {step.content}
              </p>
            </div>

            {step.required && !completedSteps.has(step.id) && (
              <div className="flex items-center space-x-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                <Circle className="h-4 w-4" />
                <span>This step is required to get the most out of ColdCopy</span>
              </div>
            )}

            {completedSteps.has(step.id) && (
              <div className="flex items-center space-x-2 text-sm text-green-600 bg-green-50 p-3 rounded-lg">
                <CheckCircle2 className="h-4 w-4" />
                <span>Step completed! You can revisit anytime.</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4">
            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStep === 0}
                className="flex items-center space-x-1"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Previous</span>
              </Button>

              {currentStep > 0 && !step.required && (
                <Button
                  variant="ghost"
                  onClick={handleSkip}
                  className="text-muted-foreground"
                >
                  Skip Step
                </Button>
              )}
            </div>

            <div className="flex space-x-2">
              {step.action && (
                <Button
                  variant={step.action.variant || 'default'}
                  onClick={() => handleActionClick(step.action!)}
                  disabled={isLoading}
                  className="flex items-center space-x-1"
                >
                  <span>{step.action.label}</span>
                  {step.action.href !== '#' && <ArrowRight className="h-4 w-4" />}
                </Button>
              )}

              {currentStep < totalSteps - 1 ? (
                <Button
                  onClick={handleNext}
                  className="flex items-center space-x-1"
                >
                  <span>Next</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleComplete}
                  className="flex items-center space-x-1"
                >
                  <span>Complete Tour</span>
                  <CheckCircle2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Progress Summary */}
          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Your Progress</span>
              <span className="text-muted-foreground">
                {completedSteps.size} of {totalSteps} steps completed
              </span>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Required steps: {completedRequiredSteps.length} of {requiredSteps.length} completed
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Hook to manage onboarding state
export function useOnboarding() {
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false)
  const [isOnboardingCompleted, setIsOnboardingCompleted] = useState(false)

  useEffect(() => {
    // Check if onboarding was completed
    const completedAt = localStorage.getItem('coldcopy-onboarding-completed-at')
    const shouldShowOnboarding = localStorage.getItem('coldcopy-show-onboarding')
    
    if (completedAt) {
      setIsOnboardingCompleted(true)
    } else if (shouldShowOnboarding !== 'false') {
      // Show onboarding for new users
      setIsOnboardingOpen(true)
    }
  }, [])

  const showOnboarding = () => setIsOnboardingOpen(true)
  const hideOnboarding = () => setIsOnboardingOpen(false)
  
  const completeOnboarding = () => {
    setIsOnboardingOpen(false)
    setIsOnboardingCompleted(true)
    localStorage.setItem('coldcopy-onboarding-completed-at', new Date().toISOString())
  }

  const resetOnboarding = () => {
    localStorage.removeItem('coldcopy-onboarding-completed-at')
    localStorage.removeItem('coldcopy-onboarding-completed')
    localStorage.removeItem('coldcopy-show-onboarding')
    setIsOnboardingCompleted(false)
    setIsOnboardingOpen(true)
  }

  return {
    isOnboardingOpen,
    isOnboardingCompleted,
    showOnboarding,
    hideOnboarding,
    completeOnboarding,
    resetOnboarding
  }
}