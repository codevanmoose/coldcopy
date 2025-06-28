import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface OnboardingStepStatus {
  id: string
  title: string
  description: string
  completed: boolean
  required: boolean
  estimatedTime: string
  completedAt?: string
  value?: string | number
}

interface OnboardingStatus {
  totalSteps: number
  completedSteps: number
  requiredSteps: number
  completedRequiredSteps: number
  progressPercentage: number
  requiredProgressPercentage: number
  isComplete: boolean
  nextStep?: OnboardingStepStatus
  steps: OnboardingStepStatus[]
}

const ONBOARDING_STEPS = [
  {
    id: 'workspace-setup',
    title: 'Complete Workspace Setup',
    description: 'Configure your workspace name, timezone, and preferences',
    required: true,
    estimatedTime: '2 min'
  },
  {
    id: 'email-configuration',
    title: 'Connect Email Account',
    description: 'Set up email sending with Gmail, Outlook, or SMTP',
    required: true,
    estimatedTime: '5 min'
  },
  {
    id: 'import-leads',
    title: 'Import Your First Leads',
    description: 'Upload a CSV file or connect your CRM to import prospects',
    required: true,
    estimatedTime: '3 min'
  },
  {
    id: 'create-campaign',
    title: 'Create Your First Campaign',
    description: 'Build a multi-step email sequence with AI assistance',
    required: true,
    estimatedTime: '10 min'
  },
  {
    id: 'invite-team',
    title: 'Invite Team Members',
    description: 'Add colleagues to collaborate on your campaigns',
    required: false,
    estimatedTime: '2 min'
  },
  {
    id: 'launch-campaign',
    title: 'Launch Your First Campaign',
    description: 'Review and start your outreach campaign',
    required: true,
    estimatedTime: '1 min'
  }
]

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's workspace
    const { data: profile } = await supabase
      .from('profiles')
      .select('workspace_id')
      .eq('id', user.id)
      .single()

    if (!profile?.workspace_id) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    const workspaceId = profile.workspace_id

    // Check completion status for each step
    const stepStatuses = await Promise.all(
      ONBOARDING_STEPS.map(async (step) => {
        const { completed, value, completedAt } = await checkStepCompletion(step.id, workspaceId, supabase)
        
        return {
          ...step,
          completed,
          value,
          completedAt
        } as OnboardingStepStatus
      })
    )

    // Calculate progress
    const totalSteps = stepStatuses.length
    const completedSteps = stepStatuses.filter(step => step.completed).length
    const requiredSteps = stepStatuses.filter(step => step.required).length
    const completedRequiredSteps = stepStatuses.filter(step => step.required && step.completed).length
    const progressPercentage = Math.round((completedSteps / totalSteps) * 100)
    const requiredProgressPercentage = Math.round((completedRequiredSteps / requiredSteps) * 100)
    const isComplete = completedRequiredSteps === requiredSteps

    // Find next step
    const nextStep = stepStatuses.find(step => step.required && !step.completed)

    const status: OnboardingStatus = {
      totalSteps,
      completedSteps,
      requiredSteps,
      completedRequiredSteps,
      progressPercentage,
      requiredProgressPercentage,
      isComplete,
      nextStep,
      steps: stepStatuses
    }

    return NextResponse.json(status)
  } catch (error) {
    console.error('Onboarding status error:', error)
    return NextResponse.json(
      { error: 'Failed to get onboarding status' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { stepId, completed = true } = await request.json()

    if (!stepId) {
      return NextResponse.json({ error: 'Step ID required' }, { status: 400 })
    }

    // Get user's workspace
    const { data: profile } = await supabase
      .from('profiles')
      .select('workspace_id')
      .eq('id', user.id)
      .single()

    if (!profile?.workspace_id) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    // Record step completion
    const { error } = await supabase
      .from('onboarding_progress')
      .upsert({
        workspace_id: profile.workspace_id,
        user_id: user.id,
        step_id: stepId,
        completed,
        completed_at: completed ? new Date().toISOString() : null
      })

    if (error) {
      console.error('Failed to update onboarding progress:', error)
      return NextResponse.json(
        { error: 'Failed to update progress' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Onboarding update error:', error)
    return NextResponse.json(
      { error: 'Failed to update onboarding progress' },
      { status: 500 }
    )
  }
}

async function checkStepCompletion(
  stepId: string, 
  workspaceId: string, 
  supabase: any
): Promise<{ completed: boolean; value?: string | number; completedAt?: string }> {
  try {
    // First check if manually marked as complete
    const { data: progress } = await supabase
      .from('onboarding_progress')
      .select('completed, completed_at')
      .eq('workspace_id', workspaceId)
      .eq('step_id', stepId)
      .single()

    if (progress?.completed) {
      return {
        completed: true,
        completedAt: progress.completed_at
      }
    }

    // Check actual completion based on data
    switch (stepId) {
      case 'workspace-setup':
        const { data: workspace } = await supabase
          .from('workspaces')
          .select('name, timezone, updated_at')
          .eq('id', workspaceId)
          .single()
        
        const completed = !!(workspace?.name && workspace?.timezone)
        return {
          completed,
          value: workspace?.name,
          completedAt: completed ? workspace?.updated_at : undefined
        }

      case 'email-configuration':
        const { data: emailAccounts } = await supabase
          .from('email_accounts')
          .select('id, email, created_at')
          .eq('workspace_id', workspaceId)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
        
        const hasEmail = (emailAccounts?.length || 0) > 0
        return {
          completed: hasEmail,
          value: emailAccounts?.[0]?.email,
          completedAt: hasEmail ? emailAccounts[0]?.created_at : undefined
        }

      case 'import-leads':
        const { data: leads, count: leadCount } = await supabase
          .from('leads')
          .select('id, created_at', { count: 'exact' })
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false })
          .limit(1)
        
        const hasLeads = (leadCount || 0) > 0
        return {
          completed: hasLeads,
          value: leadCount || 0,
          completedAt: hasLeads ? leads?.[0]?.created_at : undefined
        }

      case 'create-campaign':
        const { data: campaigns, count: campaignCount } = await supabase
          .from('campaigns')
          .select('id, name, created_at', { count: 'exact' })
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false })
          .limit(1)
        
        const hasCampaigns = (campaignCount || 0) > 0
        return {
          completed: hasCampaigns,
          value: campaigns?.[0]?.name || campaignCount,
          completedAt: hasCampaigns ? campaigns?.[0]?.created_at : undefined
        }

      case 'invite-team':
        const { data: members, count: memberCount } = await supabase
          .from('workspace_members')
          .select('id, created_at', { count: 'exact' })
          .eq('workspace_id', workspaceId)
        
        const hasTeam = (memberCount || 0) > 1 // More than just the owner
        return {
          completed: hasTeam,
          value: memberCount || 0,
          completedAt: hasTeam ? members?.[1]?.created_at : undefined // Second member's join date
        }

      case 'launch-campaign':
        const { data: activeCampaigns, count: activeCount } = await supabase
          .from('campaigns')
          .select('id, name, created_at', { count: 'exact' })
          .eq('workspace_id', workspaceId)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
        
        const hasActiveCampaign = (activeCount || 0) > 0
        return {
          completed: hasActiveCampaign,
          value: activeCampaigns?.[0]?.name || activeCount,
          completedAt: hasActiveCampaign ? activeCampaigns?.[0]?.created_at : undefined
        }

      default:
        return { completed: false }
    }
  } catch (error) {
    console.error(`Failed to check ${stepId} completion:`, error)
    return { completed: false }
  }
}