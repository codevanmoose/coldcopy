'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { 
  ArrowLeft, 
  ArrowRight, 
  Mail, 
  Users, 
  Clock,
  Sparkles,
  Save,
  Loader2
} from 'lucide-react'
import { CampaignSequenceBuilder } from '@/components/campaigns/sequence-builder'
import { LeadSelector } from '@/components/campaigns/lead-selector'
import { CampaignScheduler } from '@/components/campaigns/campaign-scheduler'

const campaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required'),
  description: z.string().optional(),
  type: z.enum(['sequence', 'one-off', 'drip']),
})

type CampaignForm = z.infer<typeof campaignSchema>

interface EmailSequence {
  id: string
  subject: string
  body: string
  delayDays: number
  delayHours: number
  condition?: {
    type: 'always' | 'no_reply' | 'no_open' | 'opened' | 'clicked'
    value?: string
  }
}

export default function NewCampaignPage() {
  const router = useRouter()
  const { workspace } = useAuthStore()
  const [currentStep, setCurrentStep] = useState(1)
  const [isCreating, setIsCreating] = useState(false)
  const [sequences, setSequences] = useState<EmailSequence[]>([])
  const [selectedLeads, setSelectedLeads] = useState<string[]>([])
  const [scheduleSettings, setScheduleSettings] = useState({
    startDate: new Date().toISOString().split('T')[0],
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    dailyLimit: 50,
    sendBetween: { start: '09:00', end: '17:00' },
    excludeWeekends: true,
  })
  

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CampaignForm>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      type: 'sequence',
    },
  })

  const campaignType = watch('type')
  const totalSteps = 4

  const createCampaign = async (data: CampaignForm) => {
    if (!workspace) return

    setIsCreating(true)
    try {
      // Create campaign with sequences and leads
      const campaignData = {
        name: data.name,
        description: data.description,
        type: data.type,
        status: 'draft',
        timezone: scheduleSettings.timezone,
        schedule_settings: scheduleSettings,
        daily_limit: scheduleSettings.dailyLimit,
        sequences: sequences.map((seq, index) => ({
          sequence_number: index + 1,
          name: `Step ${index + 1}`,
          subject: seq.subject,
          body: seq.body,
          delay_days: seq.delayDays,
          delay_hours: seq.delayHours,
          condition_type: seq.condition?.type || 'always',
          condition_value: seq.condition?.value,
        })),
        lead_ids: selectedLeads,
      }

      const response = await api.campaigns.create(workspace.id, campaignData)
      
      if (response.error) throw new Error(response.error)
      
      const campaign = response.data

      toast.success('Campaign created successfully!')
      router.push(`/campaigns/${campaign.id}`)
    } catch (error) {
      console.error('Campaign creation error:', error)
      toast.error('Failed to create campaign')
    } finally {
      setIsCreating(false)
    }
  }

  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const onSubmit = (data: CampaignForm) => {
    if (currentStep === totalSteps) {
      createCampaign(data)
    } else {
      nextStep()
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/campaigns')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Create New Campaign</h1>
          <p className="text-muted-foreground mt-1">
            Set up your email campaign in a few simple steps
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Step {currentStep} of {totalSteps}</span>
          <span>{Math.round((currentStep / totalSteps) * 100)}% Complete</span>
        </div>
        <Progress value={(currentStep / totalSteps) * 100} />
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Step 1: Campaign Details */}
        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Campaign Details</CardTitle>
              <CardDescription>
                Basic information about your campaign
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Campaign Name</Label>
                <Input
                  id="name"
                  placeholder="Q4 Outreach Campaign"
                  {...register('name')}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Describe the goal and target audience for this campaign..."
                  rows={3}
                  {...register('description')}
                />
              </div>

              <div className="space-y-3">
                <Label>Campaign Type</Label>
                <RadioGroup
                  value={campaignType}
                  onValueChange={(value) => setValue('type', value as any)}
                >
                  <div className="flex items-center space-x-3 p-4 rounded-lg border cursor-pointer hover:bg-accent">
                    <RadioGroupItem value="sequence" id="sequence" />
                    <Label htmlFor="sequence" className="flex-1 cursor-pointer">
                      <div className="font-medium">Email Sequence</div>
                      <div className="text-sm text-muted-foreground">
                        Multi-step campaign with follow-ups and conditions
                      </div>
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-3 p-4 rounded-lg border cursor-pointer hover:bg-accent">
                    <RadioGroupItem value="one-off" id="one-off" />
                    <Label htmlFor="one-off" className="flex-1 cursor-pointer">
                      <div className="font-medium">One-off Campaign</div>
                      <div className="text-sm text-muted-foreground">
                        Single email sent to all recipients
                      </div>
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-3 p-4 rounded-lg border cursor-pointer hover:bg-accent">
                    <RadioGroupItem value="drip" id="drip" />
                    <Label htmlFor="drip" className="flex-1 cursor-pointer">
                      <div className="font-medium">Drip Campaign</div>
                      <div className="text-sm text-muted-foreground">
                        Time-based email series regardless of engagement
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Email Sequences */}
        {currentStep === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>
                <div className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Email Content
                </div>
              </CardTitle>
              <CardDescription>
                {campaignType === 'sequence' 
                  ? 'Create your email sequence with follow-ups'
                  : campaignType === 'drip'
                  ? 'Set up your drip email series'
                  : 'Compose your email'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CampaignSequenceBuilder
                sequences={sequences}
                onSequencesChange={setSequences}
                campaignType={campaignType}
              />
            </CardContent>
          </Card>
        )}

        {/* Step 3: Select Leads */}
        {currentStep === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Select Recipients
                </div>
              </CardTitle>
              <CardDescription>
                Choose which leads will receive this campaign
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LeadSelector
                selectedLeads={selectedLeads}
                onSelectionChange={setSelectedLeads}
                workspaceId={workspace?.id || ''}
              />
            </CardContent>
          </Card>
        )}

        {/* Step 4: Schedule */}
        {currentStep === 4 && (
          <Card>
            <CardHeader>
              <CardTitle>
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Schedule Campaign
                </div>
              </CardTitle>
              <CardDescription>
                Configure when and how your emails will be sent
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CampaignScheduler
                settings={scheduleSettings}
                onSettingsChange={setScheduleSettings}
              />
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 1}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>

          {currentStep < totalSteps ? (
            <Button type="submit">
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button type="submit" disabled={isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Create Campaign
                </>
              )}
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}