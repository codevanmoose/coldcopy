'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { 
  CheckCircle2, 
  Circle, 
  ArrowRight,
  Users,
  Mail,
  Target,
  Upload,
  Settings,
  Play,
  ExternalLink,
  RefreshCw,
  X
} from 'lucide-react'
import Link from 'next/link'
import { useSupabase } from '@/lib/supabase/client'

interface ChecklistItem {
  id: string
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  action: {
    label: string
    href: string
  }
  required: boolean
  estimatedTime: string
  completed?: boolean
  value?: string | number
}

interface OnboardingChecklistProps {
  className?: string
  onClose?: () => void
  compact?: boolean
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: 'workspace-setup',
    title: 'Complete Workspace Setup',
    description: 'Configure your workspace name, timezone, and preferences',
    icon: Settings,
    action: {
      label: 'Configure Workspace',
      href: '/settings/workspace'
    },
    required: true,
    estimatedTime: '2 min'
  },
  {
    id: 'email-configuration',
    title: 'Connect Email Account',
    description: 'Set up email sending with Gmail, Outlook, or SMTP',
    icon: Mail,
    action: {
      label: 'Setup Email',
      href: '/settings/email'
    },
    required: true,
    estimatedTime: '5 min'
  },
  {
    id: 'import-leads',
    title: 'Import Your First Leads',
    description: 'Upload a CSV file or connect your CRM to import prospects',
    icon: Upload,
    action: {
      label: 'Import Leads',
      href: '/leads/import'
    },
    required: true,
    estimatedTime: '3 min'
  },
  {
    id: 'create-campaign',
    title: 'Create Your First Campaign',
    description: 'Build a multi-step email sequence with AI assistance',
    icon: Target,
    action: {
      label: 'Create Campaign',
      href: '/campaigns/new'
    },
    required: true,
    estimatedTime: '10 min'
  },
  {
    id: 'invite-team',
    title: 'Invite Team Members',
    description: 'Add colleagues to collaborate on your campaigns',
    icon: Users,
    action: {
      label: 'Invite Team',
      href: '/settings/team'
    },
    required: false,
    estimatedTime: '2 min'
  },
  {
    id: 'launch-campaign',
    title: 'Launch Your First Campaign',
    description: 'Review and start your outreach campaign',
    icon: Play,
    action: {
      label: 'Launch Campaign',
      href: '/campaigns'
    },
    required: true,
    estimatedTime: '1 min'
  }
]

export function OnboardingChecklist({ className, onClose, compact = false }: OnboardingChecklistProps) {
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>(CHECKLIST_ITEMS)
  const [isLoading, setIsLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const supabase = useSupabase()

  // Calculate progress
  const completedItems = checklistItems.filter(item => item.completed)
  const requiredItems = checklistItems.filter(item => item.required)
  const completedRequiredItems = requiredItems.filter(item => item.completed)
  const totalProgress = (completedItems.length / checklistItems.length) * 100
  const requiredProgress = (completedRequiredItems.length / requiredItems.length) * 100
  const isOnboardingComplete = completedRequiredItems.length === requiredItems.length

  // Estimated time remaining
  const remainingItems = checklistItems.filter(item => !item.completed && item.required)
  const estimatedTimeRemaining = remainingItems.reduce((total, item) => {
    const minutes = parseInt(item.estimatedTime.replace(' min', ''))
    return total + minutes
  }, 0)

  // Load checklist progress
  useEffect(() => {
    checkProgress()
  }, [])

  const checkProgress = async () => {
    setIsLoading(true)
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get user's workspace
      const { data: profile } = await supabase
        .from('profiles')
        .select('workspace_id')
        .eq('id', user.id)
        .single()

      if (!profile?.workspace_id) return

      const workspaceId = profile.workspace_id

      // Check each item's completion status
      const updatedItems = await Promise.all(
        CHECKLIST_ITEMS.map(async (item) => {
          const completed = await checkItemCompletion(item.id, workspaceId)
          return { ...item, completed }
        })
      )

      setChecklistItems(updatedItems)
      setLastRefresh(new Date())
    } catch (error) {
      console.error('Failed to check onboarding progress:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const checkItemCompletion = async (itemId: string, workspaceId: string): Promise<boolean> => {
    try {
      switch (itemId) {
        case 'workspace-setup':
          const { data: workspace } = await supabase
            .from('workspaces')
            .select('name, timezone, settings')
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
          
          return (members?.length || 0) > 1 // More than just the owner

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
      console.error(`Failed to check ${itemId} completion:`, error)
      return false
    }
  }

  const handleRefresh = () => {
    checkProgress()
  }

  if (compact) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Getting Started</CardTitle>
              <CardDescription>
                {completedRequiredItems.length} of {requiredItems.length} required steps completed
              </CardDescription>
            </div>
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Progress value={requiredProgress} className="h-2" />
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2">
            {checklistItems.filter(item => item.required && !item.completed).slice(0, 2).map((item) => (
              <div key={item.id} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Circle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{item.title}</span>
                </div>
                <Link href={item.action.href}>
                  <Button variant="ghost" size="sm">
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            ))}
          </div>
          {isOnboardingComplete && (
            <div className="mt-4 p-3 bg-green-50 rounded-lg text-center">
              <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto mb-1" />
              <p className="text-sm text-green-700 font-medium">
                Onboarding Complete!
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <span>Getting Started with ColdCopy</span>
              {isOnboardingComplete && (
                <Badge variant="secondary" className="bg-green-100 text-green-700">
                  Complete
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Follow these steps to set up your cold outreach campaigns
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {completedItems.length} of {checklistItems.length} steps completed
            </span>
            {!isOnboardingComplete && (
              <span>
                ~{estimatedTimeRemaining} min remaining
              </span>
            )}
          </div>
          <Progress value={totalProgress} className="h-2" />
          <div className="text-xs text-muted-foreground">
            Required progress: {completedRequiredItems.length} of {requiredItems.length} 
            ({Math.round(requiredProgress)}%)
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {checklistItems.map((item, index) => (
            <div key={item.id} className="space-y-3">
              <div className={`flex items-start space-x-3 p-3 rounded-lg border ${
                item.completed 
                  ? 'bg-green-50 border-green-200' 
                  : item.required 
                    ? 'bg-blue-50 border-blue-200' 
                    : 'bg-gray-50 border-gray-200'
              }`}>
                <div className="flex-shrink-0 mt-0.5">
                  {item.completed ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <item.icon className="h-4 w-4 text-muted-foreground" />
                    <h4 className="text-sm font-medium">{item.title}</h4>
                    {item.required && (
                      <Badge variant="secondary" className="text-xs">
                        Required
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {item.estimatedTime}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {item.description}
                  </p>
                </div>

                <div className="flex-shrink-0">
                  {item.completed ? (
                    <Badge variant="secondary" className="bg-green-100 text-green-700">
                      Done
                    </Badge>
                  ) : (
                    <Link href={item.action.href}>
                      <Button variant="outline" size="sm" className="text-xs">
                        {item.action.label}
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </Button>
                    </Link>
                  )}
                </div>
              </div>

              {index < checklistItems.length - 1 && (
                <Separator className="ml-8" />
              )}
            </div>
          ))}
        </div>

        {isOnboardingComplete && (
          <div className="mt-6 p-4 bg-green-50 rounded-lg text-center">
            <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <h3 className="text-lg font-semibold text-green-800 mb-1">
              Congratulations! 🎉
            </h3>
            <p className="text-sm text-green-700 mb-3">
              You've completed the essential setup for ColdCopy. You're ready to start your cold outreach campaigns!
            </p>
            <div className="flex justify-center space-x-2">
              <Link href="/campaigns">
                <Button size="sm">
                  View Campaigns
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
              <Link href="/analytics">
                <Button variant="outline" size="sm">
                  View Analytics
                </Button>
              </Link>
            </div>
          </div>
        )}

        {!isOnboardingComplete && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <ArrowRight className="h-4 w-4 text-blue-600" />
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-blue-800 mb-1">
                  Next Step
                </h4>
                <p className="text-sm text-blue-700">
                  Complete the required steps to unlock the full power of ColdCopy's AI-driven outreach platform.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
          Last updated: {lastRefresh.toLocaleTimeString()}
        </div>
      </CardContent>
    </Card>
  )
}