'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Mail,
  MessageSquare,
  Smartphone,
  Users,
  Settings,
  Plus,
  Minus,
  Clock,
  Target,
  Zap,
  Calendar,
  Send,
  Eye,
  AlertTriangle,
  CheckCircle,
  X as TwitterIcon,
  Linkedin,
  ArrowRight,
  Shuffle,
  Filter,
  Copy,
  Save,
  Play
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { toast } from 'sonner'

interface CampaignChannel {
  channel: 'email' | 'linkedin' | 'twitter' | 'sms'
  isEnabled: boolean
  messageTemplate: string
  personalizationFields: string[]
  delay: number // hours between channels
  limits: {
    dailyLimit: number
    totalLimit?: number
  }
  settings: Record<string, any>
}

interface CampaignSequence {
  step: number
  channels: CampaignChannel[]
  triggerType: 'immediate' | 'delay' | 'condition'
  triggerValue?: number | string
  conditions?: {
    type: 'opened' | 'clicked' | 'replied' | 'connected' | 'no_response'
    timeframe: number // hours
  }[]
}

interface UnifiedCampaignData {
  name: string
  description: string
  targetAudience: {
    leadLists: string[]
    filters: {
      tags?: string[]
      companies?: string[]
      jobTitles?: string[]
      industries?: string[]
      locations?: string[]
      customFields?: Record<string, any>
    }
    size: number
  }
  sequence: CampaignSequence[]
  scheduling: {
    startImmediately: boolean
    scheduledStart?: Date
    timezone: string
    respectQuietHours: boolean
    quietHours: {
      start: string
      end: string
    }
    allowedDays: string[]
  }
  tracking: {
    trackOpens: boolean
    trackClicks: boolean
    trackReplies: boolean
    trackSocialEngagement: boolean
  }
  compliance: {
    includeUnsubscribe: boolean
    respectOptOuts: boolean
    includeComplianceFooter: boolean
  }
}

const CHANNEL_CONFIG = {
  email: {
    name: 'Email',
    icon: Mail,
    color: '#3b82f6',
    defaultTemplate: 'Hi {firstName},\n\nI noticed your work at {company} and thought you might be interested in...\n\nBest regards,\n{senderName}',
    personalizationFields: ['firstName', 'lastName', 'company', 'jobTitle', 'industry', 'location'],
    limits: { dailyLimit: 100, totalLimit: 1000 }
  },
  linkedin: {
    name: 'LinkedIn',
    icon: Linkedin,
    color: '#0077b5',
    defaultTemplate: 'Hi {firstName}, I came across your profile and was impressed by your experience at {company}. I\'d love to connect and share something that might interest you.',
    personalizationFields: ['firstName', 'lastName', 'company', 'jobTitle', 'skills', 'mutualConnections'],
    limits: { dailyLimit: 20, totalLimit: 100 }
  },
  twitter: {
    name: 'Twitter/X',
    icon: TwitterIcon,
    color: '#1da1f2',
    defaultTemplate: 'Hi @{username}, loved your recent post about {topic}. Would love to connect!',
    personalizationFields: ['username', 'displayName', 'bio', 'location', 'followerCount'],
    limits: { dailyLimit: 50, totalLimit: 200 }
  },
  sms: {
    name: 'SMS',
    icon: Smartphone,
    color: '#10b981',
    defaultTemplate: 'Hi {firstName}, this is {senderName} from {company}. I have something that might interest you. Can we chat?',
    personalizationFields: ['firstName', 'lastName', 'company', 'phone'],
    limits: { dailyLimit: 25, totalLimit: 100 }
  }
}

export function UnifiedCampaignBuilder() {
  const { workspace } = useAuthStore()
  const [campaignData, setCampaignData] = useState<UnifiedCampaignData>({
    name: '',
    description: '',
    targetAudience: {
      leadLists: [],
      filters: {},
      size: 0
    },
    sequence: [
      {
        step: 1,
        channels: Object.entries(CHANNEL_CONFIG).map(([key, config]) => ({
          channel: key as keyof typeof CHANNEL_CONFIG,
          isEnabled: key === 'email',
          messageTemplate: config.defaultTemplate,
          personalizationFields: config.personalizationFields,
          delay: 0,
          limits: config.limits,
          settings: {}
        })),
        triggerType: 'immediate'
      }
    ],
    scheduling: {
      startImmediately: true,
      timezone: 'UTC',
      respectQuietHours: true,
      quietHours: { start: '18:00', end: '09:00' },
      allowedDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
    },
    tracking: {
      trackOpens: true,
      trackClicks: true,
      trackReplies: true,
      trackSocialEngagement: true
    },
    compliance: {
      includeUnsubscribe: true,
      respectOptOuts: true,
      includeComplianceFooter: true
    }
  })

  const [currentStep, setCurrentStep] = useState(0)
  const [selectedSequenceStep, setSelectedSequenceStep] = useState(0)

  const createCampaignMutation = useMutation({
    mutationFn: async (data: UnifiedCampaignData) => {
      if (!workspace) throw new Error('No workspace selected')
      
      // Here you would call your API to create the unified campaign
      const response = await fetch('/api/campaigns/multi-channel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspace_id: workspace.id,
          ...data,
        }),
      })
      
      if (!response.ok) throw new Error('Failed to create campaign')
      return response.json()
    },
    onSuccess: () => {
      toast.success('Multi-channel campaign created successfully!')
    },
    onError: (error) => {
      toast.error(`Failed to create campaign: ${error.message}`)
    },
  })

  const addSequenceStep = () => {
    setCampaignData(prev => ({
      ...prev,
      sequence: [
        ...prev.sequence,
        {
          step: prev.sequence.length + 1,
          channels: Object.entries(CHANNEL_CONFIG).map(([key, config]) => ({
            channel: key as keyof typeof CHANNEL_CONFIG,
            isEnabled: false,
            messageTemplate: config.defaultTemplate,
            personalizationFields: config.personalizationFields,
            delay: 24,
            limits: config.limits,
            settings: {}
          })),
          triggerType: 'delay',
          triggerValue: 24
        }
      ]
    }))
  }

  const removeSequenceStep = (stepIndex: number) => {
    setCampaignData(prev => ({
      ...prev,
      sequence: prev.sequence.filter((_, index) => index !== stepIndex)
        .map((step, index) => ({ ...step, step: index + 1 }))
    }))
  }

  const updateSequenceStep = (stepIndex: number, updates: Partial<CampaignSequence>) => {
    setCampaignData(prev => ({
      ...prev,
      sequence: prev.sequence.map((step, index) => 
        index === stepIndex ? { ...step, ...updates } : step
      )
    }))
  }

  const updateChannelInStep = (stepIndex: number, channelIndex: number, updates: Partial<CampaignChannel>) => {
    setCampaignData(prev => ({
      ...prev,
      sequence: prev.sequence.map((step, sIndex) => 
        sIndex === stepIndex ? {
          ...step,
          channels: step.channels.map((channel, cIndex) =>
            cIndex === channelIndex ? { ...channel, ...updates } : channel
          )
        } : step
      )
    }))
  }

  const handleSubmit = () => {
    if (!campaignData.name.trim()) {
      toast.error('Please enter a campaign name')
      return
    }

    if (campaignData.sequence.every(step => 
      step.channels.every(channel => !channel.isEnabled)
    )) {
      toast.error('Please enable at least one channel in your campaign')
      return
    }

    createCampaignMutation.mutate(campaignData)
  }

  const getEnabledChannelsCount = () => {
    return campaignData.sequence.reduce((total, step) => 
      total + step.channels.filter(channel => channel.isEnabled).length, 0
    )
  }

  const getEstimatedReach = () => {
    return campaignData.targetAudience.size * getEnabledChannelsCount()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Create Multi-Channel Campaign</h2>
          <p className="text-muted-foreground">
            Build unified outreach campaigns across email, LinkedIn, Twitter, and SMS
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Save className="h-4 w-4 mr-2" />
            Save Draft
          </Button>
          <Button onClick={handleSubmit} disabled={createCampaignMutation.isPending}>
            {createCampaignMutation.isPending ? (
              <>
                <div className="h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Launch Campaign
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Campaign Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Campaign Overview</CardTitle>
          <CardDescription>Basic campaign information and targeting</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="campaignName">Campaign Name *</Label>
              <Input
                id="campaignName"
                value={campaignData.name}
                onChange={(e) => setCampaignData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Q1 Product Launch Campaign"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="targetSize">Target Audience Size</Label>
              <Input
                id="targetSize"
                type="number"
                value={campaignData.targetAudience.size}
                onChange={(e) => setCampaignData(prev => ({
                  ...prev,
                  targetAudience: { ...prev.targetAudience, size: parseInt(e.target.value) || 0 }
                }))}
                placeholder="1000"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={campaignData.description}
              onChange={(e) => setCampaignData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe your campaign goals and strategy..."
              className="min-h-20"
            />
          </div>

          {/* Quick Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center p-3 border rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{campaignData.sequence.length}</div>
              <div className="text-sm text-muted-foreground">Sequence Steps</div>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <div className="text-2xl font-bold text-green-600">{getEnabledChannelsCount()}</div>
              <div className="text-sm text-muted-foreground">Active Channels</div>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{getEstimatedReach().toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Est. Total Reach</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Campaign Sequence Builder */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Campaign Sequence</CardTitle>
              <CardDescription>Design your multi-channel outreach flow</CardDescription>
            </div>
            <Button onClick={addSequenceStep} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add Step
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {campaignData.sequence.map((step, stepIndex) => (
              <div key={stepIndex} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Step {step.step}</Badge>
                    <Select
                      value={step.triggerType}
                      onValueChange={(value: any) => updateSequenceStep(stepIndex, { triggerType: value })}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="immediate">Immediate</SelectItem>
                        <SelectItem value="delay">Delay</SelectItem>
                        <SelectItem value="condition">Condition</SelectItem>
                      </SelectContent>
                    </Select>
                    {step.triggerType === 'delay' && (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          value={step.triggerValue}
                          onChange={(e) => updateSequenceStep(stepIndex, { triggerValue: parseInt(e.target.value) })}
                          className="w-16"
                          min="1"
                        />
                        <span className="text-sm text-muted-foreground">hours</span>
                      </div>
                    )}
                  </div>
                  {stepIndex > 0 && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => removeSequenceStep(stepIndex)}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {step.channels.map((channel, channelIndex) => {
                    const config = CHANNEL_CONFIG[channel.channel]
                    const Icon = config.icon

                    return (
                      <Card key={channelIndex} className={`${channel.isEnabled ? 'ring-2 ring-primary' : 'opacity-60'}`}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4" style={{ color: config.color }} />
                              <span className="font-medium">{config.name}</span>
                            </div>
                            <Switch
                              checked={channel.isEnabled}
                              onCheckedChange={(checked) => 
                                updateChannelInStep(stepIndex, channelIndex, { isEnabled: checked })
                              }
                            />
                          </div>
                        </CardHeader>
                        {channel.isEnabled && (
                          <CardContent className="space-y-3">
                            <div className="space-y-2">
                              <Label className="text-xs">Message Template</Label>
                              <Textarea
                                value={channel.messageTemplate}
                                onChange={(e) => 
                                  updateChannelInStep(stepIndex, channelIndex, { messageTemplate: e.target.value })
                                }
                                className="text-xs min-h-16"
                                placeholder={config.defaultTemplate}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">Daily Limit</Label>
                              <Input
                                type="number"
                                value={channel.limits.dailyLimit}
                                onChange={(e) => 
                                  updateChannelInStep(stepIndex, channelIndex, {
                                    limits: { ...channel.limits, dailyLimit: parseInt(e.target.value) || 0 }
                                  })
                                }
                                className="text-xs"
                                min="1"
                              />
                            </div>
                            {stepIndex > 0 && (
                              <div className="space-y-2">
                                <Label className="text-xs">Delay (hours)</Label>
                                <Input
                                  type="number"
                                  value={channel.delay}
                                  onChange={(e) => 
                                    updateChannelInStep(stepIndex, channelIndex, { delay: parseInt(e.target.value) || 0 })
                                  }
                                  className="text-xs"
                                  min="0"
                                />
                              </div>
                            )}
                          </CardContent>
                        )}
                      </Card>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Campaign Settings */}
      <Tabs defaultValue="scheduling" className="space-y-4">
        <TabsList>
          <TabsTrigger value="scheduling">Scheduling</TabsTrigger>
          <TabsTrigger value="tracking">Tracking</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
        </TabsList>

        <TabsContent value="scheduling">
          <Card>
            <CardHeader>
              <CardTitle>Scheduling Settings</CardTitle>
              <CardDescription>Configure when and how your campaign runs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={campaignData.scheduling.startImmediately}
                  onCheckedChange={(checked) => 
                    setCampaignData(prev => ({
                      ...prev,
                      scheduling: { ...prev.scheduling, startImmediately: checked }
                    }))
                  }
                />
                <Label>Start campaign immediately</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={campaignData.scheduling.respectQuietHours}
                  onCheckedChange={(checked) => 
                    setCampaignData(prev => ({
                      ...prev,
                      scheduling: { ...prev.scheduling, respectQuietHours: checked }
                    }))
                  }
                />
                <Label>Respect quiet hours</Label>
              </div>

              {campaignData.scheduling.respectQuietHours && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Quiet Hours Start</Label>
                    <Input
                      type="time"
                      value={campaignData.scheduling.quietHours.start}
                      onChange={(e) => 
                        setCampaignData(prev => ({
                          ...prev,
                          scheduling: {
                            ...prev.scheduling,
                            quietHours: { ...prev.scheduling.quietHours, start: e.target.value }
                          }
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Quiet Hours End</Label>
                    <Input
                      type="time"
                      value={campaignData.scheduling.quietHours.end}
                      onChange={(e) => 
                        setCampaignData(prev => ({
                          ...prev,
                          scheduling: {
                            ...prev.scheduling,
                            quietHours: { ...prev.scheduling.quietHours, end: e.target.value }
                          }
                        }))
                      }
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Allowed Days</Label>
                <div className="flex flex-wrap gap-2">
                  {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
                    <Badge
                      key={day}
                      variant={campaignData.scheduling.allowedDays.includes(day) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => {
                        setCampaignData(prev => ({
                          ...prev,
                          scheduling: {
                            ...prev.scheduling,
                            allowedDays: prev.scheduling.allowedDays.includes(day)
                              ? prev.scheduling.allowedDays.filter(d => d !== day)
                              : [...prev.scheduling.allowedDays, day]
                          }
                        }))
                      }}
                    >
                      {day.charAt(0).toUpperCase() + day.slice(1)}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tracking">
          <Card>
            <CardHeader>
              <CardTitle>Tracking & Analytics</CardTitle>
              <CardDescription>Configure what engagement metrics to track</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(campaignData.tracking).map(([key, value]) => (
                <div key={key} className="flex items-center space-x-2">
                  <Switch
                    checked={value}
                    onCheckedChange={(checked) => 
                      setCampaignData(prev => ({
                        ...prev,
                        tracking: { ...prev.tracking, [key]: checked }
                      }))
                    }
                  />
                  <Label>
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </Label>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance">
          <Card>
            <CardHeader>
              <CardTitle>Compliance Settings</CardTitle>
              <CardDescription>Ensure your campaign meets legal requirements</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(campaignData.compliance).map(([key, value]) => (
                <div key={key} className="flex items-center space-x-2">
                  <Switch
                    checked={value}
                    onCheckedChange={(checked) => 
                      setCampaignData(prev => ({
                        ...prev,
                        compliance: { ...prev.compliance, [key]: checked }
                      }))
                    }
                  />
                  <Label>
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </Label>
                </div>
              ))}

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Ensure compliance with GDPR, CAN-SPAM, TCPA, and other applicable regulations.
                  Review all message templates and targeting criteria before launching.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}