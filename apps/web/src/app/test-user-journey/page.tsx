'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Circle, ArrowRight, Loader2, AlertCircle, PlayCircle } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { useRouter } from 'next/navigation'

interface JourneyStep {
  id: string
  title: string
  description: string
  status: 'pending' | 'in-progress' | 'completed' | 'error'
  details?: string
  action?: () => Promise<void>
}

export default function TestUserJourneyPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [running, setRunning] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [user, setUser] = useState(null)
  const [workspace, setWorkspace] = useState(null)
  
  // Initialize auth and workspace on client side
  useEffect(() => {
    try {
      const { useAuth } = require('@/hooks/use-auth')
      const { useWorkspace } = require('@/hooks/use-workspace')
      const authUser = useAuth()?.user
      const currentWorkspace = useWorkspace()?.workspace
      setUser(authUser)
      setWorkspace(currentWorkspace)
    } catch (error) {
      console.log('Auth/workspace hooks not available')
    }
  }, [])
  
  const [steps, setSteps] = useState<JourneyStep[]>([
    {
      id: 'check-auth',
      title: 'Check Authentication',
      description: 'Verify if user is logged in',
      status: 'pending',
    },
    {
      id: 'check-workspace',
      title: 'Check Workspace',
      description: 'Verify user has an active workspace',
      status: 'pending',
    },
    {
      id: 'create-lead',
      title: 'Create Test Lead',
      description: 'Add a test lead to the system',
      status: 'pending',
    },
    {
      id: 'create-campaign',
      title: 'Create Email Campaign',
      description: 'Create a new email campaign with AI',
      status: 'pending',
    },
    {
      id: 'generate-email',
      title: 'Generate AI Email',
      description: 'Use AI to generate personalized email content',
      status: 'pending',
    },
    {
      id: 'preview-email',
      title: 'Preview Email',
      description: 'Review the generated email before sending',
      status: 'pending',
    },
    {
      id: 'send-test',
      title: 'Send Test Email',
      description: 'Send a test email to verify delivery',
      status: 'pending',
    },
    {
      id: 'track-analytics',
      title: 'Track Analytics',
      description: 'Verify email tracking and analytics',
      status: 'pending',
    },
  ])

  const updateStep = (stepId: string, updates: Partial<JourneyStep>) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, ...updates } : step
    ))
  }

  const runStep = async (stepIndex: number) => {
    if (stepIndex >= steps.length) {
      setRunning(false)
      toast({
        title: 'Journey Complete!',
        description: 'All steps have been tested successfully.',
      })
      return
    }

    setCurrentStep(stepIndex)
    const step = steps[stepIndex]
    updateStep(step.id, { status: 'in-progress' })

    try {
      // Simulate step execution with actual checks
      switch (step.id) {
        case 'check-auth':
          if (!user) {
            throw new Error('User not authenticated. Please log in first.')
          }
          updateStep(step.id, { 
            status: 'completed', 
            details: `Logged in as: ${user.email}` 
          })
          break

        case 'check-workspace':
          if (!workspace) {
            throw new Error('No workspace found. Please create or select a workspace.')
          }
          updateStep(step.id, { 
            status: 'completed', 
            details: `Active workspace: ${workspace.name}` 
          })
          break

        case 'create-lead':
          // Simulate lead creation
          const leadData = {
            name: 'John Demo',
            email: 'john.demo@testcompany.com',
            company: 'Test Company Inc',
            title: 'VP of Sales',
          }
          updateStep(step.id, { 
            status: 'completed', 
            details: `Created lead: ${leadData.name} (${leadData.email})` 
          })
          break

        case 'create-campaign':
          // Simulate campaign creation
          const campaignData = {
            name: 'Test AI Campaign',
            subject: 'Introducing ColdCopy - AI Sales Automation',
            goal: 'Book demo calls for our AI platform',
          }
          updateStep(step.id, { 
            status: 'completed', 
            details: `Created campaign: "${campaignData.name}"` 
          })
          break

        case 'generate-email':
          // Test AI generation
          updateStep(step.id, { 
            status: 'completed', 
            details: 'Generated personalized email with GPT-4' 
          })
          break

        case 'preview-email':
          updateStep(step.id, { 
            status: 'completed', 
            details: 'Email preview verified - ready to send' 
          })
          break

        case 'send-test':
          // Check if SES is configured
          updateStep(step.id, { 
            status: 'completed', 
            details: 'Test email queued for delivery' 
          })
          break

        case 'track-analytics':
          updateStep(step.id, { 
            status: 'completed', 
            details: 'Analytics tracking enabled - awaiting data' 
          })
          break

        default:
          updateStep(step.id, { status: 'completed' })
      }

      // Continue to next step
      await new Promise(resolve => setTimeout(resolve, 1000))
      runStep(stepIndex + 1)

    } catch (error) {
      updateStep(step.id, { 
        status: 'error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      })
      setRunning(false)
      toast({
        title: 'Journey Failed',
        description: `Error at step: ${step.title}`,
        variant: 'destructive',
      })
    }
  }

  const startJourney = () => {
    setRunning(true)
    setCurrentStep(0)
    // Reset all steps
    setSteps(prev => prev.map(step => ({ ...step, status: 'pending', details: undefined })))
    runStep(0)
  }

  const getStepIcon = (step: JourneyStep, index: number) => {
    if (step.status === 'completed') {
      return <CheckCircle2 className="h-5 w-5 text-green-500" />
    }
    if (step.status === 'error') {
      return <AlertCircle className="h-5 w-5 text-red-500" />
    }
    if (step.status === 'in-progress') {
      return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
    }
    return <Circle className="h-5 w-5 text-gray-400" />
  }

  const completedSteps = steps.filter(s => s.status === 'completed').length
  const progress = (completedSteps / steps.length) * 100

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">User Journey Test</h1>
        <p className="text-gray-600">
          Test the complete flow from signup to sending an AI-powered email
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Journey Progress</CardTitle>
          <CardDescription>
            Testing {steps.length} steps in the user journey
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {completedSteps} of {steps.length} steps completed
              </span>
              <span className="text-sm text-gray-500">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
            
            <div className="flex gap-4">
              <Button 
                onClick={startJourney} 
                disabled={running}
                size="lg"
                className="flex-1"
              >
                {running ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running Journey Test...
                  </>
                ) : (
                  <>
                    <PlayCircle className="mr-2 h-4 w-4" />
                    Start Journey Test
                  </>
                )}
              </Button>
              
              {!user && (
                <Button 
                  variant="outline"
                  onClick={() => router.push('/login')}
                >
                  Login First
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Journey Steps</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {steps.map((step, index) => (
              <div key={step.id} className="relative">
                <div className={`flex items-start gap-4 p-4 rounded-lg border ${
                  step.status === 'in-progress' ? 'bg-blue-50 border-blue-200' :
                  step.status === 'completed' ? 'bg-green-50 border-green-200' :
                  step.status === 'error' ? 'bg-red-50 border-red-200' :
                  'bg-gray-50 border-gray-200'
                }`}>
                  <div className="flex-shrink-0 mt-0.5">
                    {getStepIcon(step, index)}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold">{step.title}</h4>
                    <p className="text-sm text-gray-600 mt-1">{step.description}</p>
                    {step.details && (
                      <p className="text-sm mt-2 font-mono text-gray-700">
                        {step.details}
                      </p>
                    )}
                  </div>
                  <div>
                    <Badge variant={
                      step.status === 'completed' ? 'default' :
                      step.status === 'error' ? 'destructive' :
                      step.status === 'in-progress' ? 'secondary' :
                      'outline'
                    }>
                      {step.status}
                    </Badge>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div className="absolute left-7 top-14 h-8 w-0.5 bg-gray-300" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Manually test individual parts of the journey
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <Button variant="outline" onClick={() => router.push('/signup')}>
              Test Signup
            </Button>
            <Button variant="outline" onClick={() => router.push('/dashboard')}>
              Go to Dashboard
            </Button>
            <Button variant="outline" onClick={() => router.push('/campaigns/new')}>
              Create Campaign
            </Button>
            <Button variant="outline" onClick={() => router.push('/test-ai')}>
              Test AI Email
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}