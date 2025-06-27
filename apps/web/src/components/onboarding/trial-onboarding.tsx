'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Mail, 
  Sparkles, 
  TrendingUp, 
  Clock, 
  CheckCircle,
  CreditCard,
  ArrowRight,
  Users,
  Zap
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { useWorkspace } from '@/hooks/use-workspace'
import { supabase } from '@/lib/supabase/client'
import { loadStripe } from '@stripe/stripe-js'
import { cn } from '@/lib/utils'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface TrialOnboardingProps {
  open?: boolean
  onComplete?: () => void
}

const ONBOARDING_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to ColdCopy',
    description: 'Start your 14-day free trial',
  },
  {
    id: 'features',
    title: 'Explore Key Features',
    description: 'Discover what makes ColdCopy powerful',
  },
  {
    id: 'limits',
    title: 'Trial Limits',
    description: 'Understand your trial capabilities',
  },
  {
    id: 'payment',
    title: 'Payment Method (Optional)',
    description: 'Add a payment method for uninterrupted service',
  },
]

const KEY_FEATURES = [
  {
    icon: Mail,
    title: 'Smart Email Campaigns',
    description: 'Send personalized cold emails at scale with AI-powered content',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  {
    icon: Sparkles,
    title: 'AI Email Generation',
    description: 'Create compelling emails with our advanced AI assistant',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
  {
    icon: Users,
    title: 'Lead Enrichment',
    description: 'Enrich your leads with detailed contact and company data',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
  },
  {
    icon: TrendingUp,
    title: 'Advanced Analytics',
    description: 'Track opens, clicks, and responses with detailed insights',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
  },
]

const TRIAL_LIMITS = [
  { metric: 'Emails per month', limit: '1,000', icon: Mail },
  { metric: 'Lead enrichments', limit: '100', icon: Users },
  { metric: 'AI email generations', limit: '50', icon: Sparkles },
  { metric: 'Team members', limit: '3', icon: Users },
]

export function TrialOnboarding({ open = true, onComplete }: TrialOnboardingProps) {
  const router = useRouter()
  const { workspace } = useWorkspace()
  const [currentStep, setCurrentStep] = useState(0)
  const [isOpen, setIsOpen] = useState(open)
  const [isAddingPayment, setIsAddingPayment] = useState(false)
  const [hasPaymentMethod, setHasPaymentMethod] = useState(false)

  useEffect(() => {
    checkOnboardingStatus()
    checkPaymentMethod()
  }, [workspace?.id])

  const checkOnboardingStatus = async () => {
    if (!workspace?.id) return

    const onboardingKey = `trial-onboarding-completed-${workspace.id}`
    const completed = localStorage.getItem(onboardingKey)
    
    if (completed) {
      setIsOpen(false)
    }
  }

  const checkPaymentMethod = async () => {
    if (!workspace?.id) return

    try {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('id')
        .eq('workspace_id', workspace.id)
        .single()

      if (data) {
        setHasPaymentMethod(true)
      }
    } catch (error) {
      // No payment method found
    }
  }

  const handleNext = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      completeOnboarding()
    }
  }

  const handleSkip = () => {
    completeOnboarding()
  }

  const completeOnboarding = () => {
    const onboardingKey = `trial-onboarding-completed-${workspace?.id}`
    localStorage.setItem(onboardingKey, 'true')
    setIsOpen(false)
    onComplete?.()
  }

  const handleAddPaymentMethod = async () => {
    setIsAddingPayment(true)
    
    try {
      const response = await fetch('/api/billing/payment-methods', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspaceId: workspace?.id,
          returnUrl: window.location.href,
        }),
      })

      const { url } = await response.json()
      
      if (url) {
        window.location.href = url
      }
    } catch (error) {
      console.error('Error adding payment method:', error)
    } finally {
      setIsAddingPayment(false)
    }
  }

  const renderStepContent = () => {
    switch (ONBOARDING_STEPS[currentStep].id) {
      case 'welcome':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Zap className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-2">Welcome to ColdCopy!</h3>
              <p className="text-muted-foreground">
                You're starting your 14-day free trial. Let's show you what ColdCopy can do.
              </p>
            </div>
            
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <Clock className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-semibold">14 Days of Full Access</p>
                    <p className="text-sm text-muted-foreground">
                      Experience all features without limitations during your trial
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>Cancel anytime</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>Full feature access</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>Premium support</span>
              </div>
            </div>
          </div>
        )

      case 'features':
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold mb-2">Powerful Features at Your Fingertips</h3>
              <p className="text-muted-foreground">
                Everything you need to run successful cold email campaigns
              </p>
            </div>

            <div className="grid gap-4">
              {KEY_FEATURES.map((feature) => (
                <Card key={feature.title} className="border-0 shadow-sm">
                  <CardContent className="flex items-start gap-4 pt-6">
                    <div className={cn("p-2 rounded-lg", feature.bgColor)}>
                      <feature.icon className={cn("h-5 w-5", feature.color)} />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold mb-1">{feature.title}</h4>
                      <p className="text-sm text-muted-foreground">
                        {feature.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )

      case 'limits':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-bold mb-2">Generous Trial Limits</h3>
              <p className="text-muted-foreground">
                Plenty of resources to test and validate ColdCopy for your needs
              </p>
            </div>

            <div className="grid gap-4">
              {TRIAL_LIMITS.map((limit) => (
                <div key={limit.metric} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <limit.icon className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">{limit.metric}</span>
                  </div>
                  <Badge variant="secondary" className="text-lg px-3">
                    {limit.limit}
                  </Badge>
                </div>
              ))}
            </div>

            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="pt-6">
                <p className="text-sm text-amber-800">
                  <strong>Pro tip:</strong> These limits reset when you upgrade to a paid plan. 
                  Start testing with confidence!
                </p>
              </CardContent>
            </Card>
          </div>
        )

      case 'payment':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-bold mb-2">Add Payment Method (Optional)</h3>
              <p className="text-muted-foreground">
                Ensure uninterrupted service when your trial ends
              </p>
            </div>

            {hasPaymentMethod ? (
              <Card className="border-green-200 bg-green-50">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium text-green-800">Payment method added</p>
                      <p className="text-sm text-green-700">
                        You're all set! Your service will continue seamlessly after the trial.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="space-y-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                          <div>
                            <p className="font-medium">No charges during trial</p>
                            <p className="text-sm text-muted-foreground">
                              Your card won't be charged until after your trial ends
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                          <div>
                            <p className="font-medium">Cancel anytime</p>
                            <p className="text-sm text-muted-foreground">
                              Cancel before your trial ends and you won't be charged
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                          <div>
                            <p className="font-medium">Special trial pricing</p>
                            <p className="text-sm text-muted-foreground">
                              Get 20% off your first month when you add a payment method now
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Button 
                    className="w-full" 
                    size="lg"
                    onClick={handleAddPaymentMethod}
                    disabled={isAddingPayment}
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    {isAddingPayment ? 'Setting up...' : 'Add Payment Method'}
                  </Button>
                </div>
              </>
            )}

            <p className="text-center text-sm text-muted-foreground">
              You can always add a payment method later from your billing settings
            </p>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between mb-4">
            <div>
              <DialogTitle>{ONBOARDING_STEPS[currentStep].title}</DialogTitle>
              <DialogDescription>
                {ONBOARDING_STEPS[currentStep].description}
              </DialogDescription>
            </div>
            <Badge variant="secondary">
              Step {currentStep + 1} of {ONBOARDING_STEPS.length}
            </Badge>
          </div>
          <Progress value={((currentStep + 1) / ONBOARDING_STEPS.length) * 100} className="h-2" />
        </DialogHeader>

        <div className="mt-6">
          {renderStepContent()}
        </div>

        <div className="flex justify-between items-center mt-8">
          <Button
            variant="ghost"
            onClick={handleSkip}
            className="text-muted-foreground"
          >
            Skip tour
          </Button>
          
          <div className="flex gap-2">
            {currentStep > 0 && (
              <Button
                variant="outline"
                onClick={() => setCurrentStep(currentStep - 1)}
              >
                Back
              </Button>
            )}
            <Button onClick={handleNext}>
              {currentStep === ONBOARDING_STEPS.length - 1 ? (
                <>
                  Get Started
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}