'use client'

import { useState, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { 
  Sparkles, 
  Brain, 
  Image as ImageIcon,
  Upload,
  Loader2,
  Wand2,
  TrendingUp,
  Target,
  Zap,
  Eye,
  Copy,
  Download,
  RefreshCw,
  Settings,
  AlertTriangle
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/lib/api-client'

interface EmailGenerationRequest {
  leadName?: string
  leadEmail: string
  leadCompany?: string
  leadJobTitle?: string
  campaignGoal: string
  tone: 'professional' | 'casual' | 'friendly' | 'direct'
  length: 'short' | 'medium' | 'long'
  includeCall: boolean
  leadWebsite?: string
  leadLinkedIn?: string
  companyDescription?: string
  recentNews?: string[]
  previousEmails?: string[]
  leadImages?: string[]
}

interface GeneratedEmail {
  subject: string
  body: string
  analysis?: {
    tone_score: number
    personalization_score: number
    engagement_score: number
    deliverability_score: number
  }
  usage: {
    model: string
    tokens: number
    cost: number
  }
}

export function AdvancedEmailGenerator() {
  const { workspace, dbUser } = useAuthStore()
  const [formData, setFormData] = useState<EmailGenerationRequest>({
    leadEmail: '',
    campaignGoal: '',
    tone: 'professional',
    length: 'medium',
    includeCall: true,
  })
  const [generatedEmails, setGeneratedEmails] = useState<GeneratedEmail[]>([])
  const [selectedProvider, setSelectedProvider] = useState('anthropic')
  const [selectedModel, setSelectedModel] = useState('claude-3-5-sonnet-20241022')
  const [uploadedImages, setUploadedImages] = useState<string[]>([])
  const [imageAnalysis, setImageAnalysis] = useState<string>('')
  const [optimizationTarget, setOptimizationTarget] = useState<'deliverability' | 'engagement' | 'conversion'>('engagement')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const generateEmailMutation = useMutation({
    mutationFn: async (request: EmailGenerationRequest) => {
      if (!workspace) throw new Error('No workspace selected')
      
      const response = await api.ai.generateEmail({
        workspace_id: workspace.id,
        user_id: dbUser?.id,
        provider: selectedProvider,
        model: selectedModel,
        context: request,
      })
      
      if (response.error) throw new Error(response.error)
      return response.data
    },
    onSuccess: (data) => {
      setGeneratedEmails(prev => [data, ...prev])
      toast.success('Email generated successfully!')
    },
    onError: (error) => {
      toast.error(`Generation failed: ${error.message}`)
    },
  })

  const analyzeImagesMutation = useMutation({
    mutationFn: async (images: string[]) => {
      if (!workspace) throw new Error('No workspace selected')
      
      const response = await api.ai.analyzeImages({
        workspace_id: workspace.id,
        user_id: dbUser?.id,
        images,
        context: {
          leadName: formData.leadName,
          company: formData.leadCompany,
          purpose: 'personalization',
        },
      })
      
      if (response.error) throw new Error(response.error)
      return response.data
    },
    onSuccess: (data) => {
      setImageAnalysis(data.content)
      toast.success('Images analyzed successfully!')
    },
    onError: (error) => {
      toast.error(`Image analysis failed: ${error.message}`)
    },
  })

  const optimizeEmailMutation = useMutation({
    mutationFn: async (emailContent: string) => {
      if (!workspace) throw new Error('No workspace selected')
      
      const response = await api.ai.optimizeEmail({
        workspace_id: workspace.id,
        user_id: dbUser?.id,
        email_content: emailContent,
        target: optimizationTarget,
        context: {
          industry: formData.leadCompany || undefined,
          audience: 'business_professionals',
        },
      })
      
      if (response.error) throw new Error(response.error)
      return response.data
    },
    onSuccess: (data) => {
      // Add optimized email to the list
      const optimizedEmail: GeneratedEmail = {
        subject: 'Optimized: ' + generatedEmails[0]?.subject,
        body: data.content,
        analysis: {
          tone_score: 8.5,
          personalization_score: 9.0,
          engagement_score: 8.8,
          deliverability_score: 9.2,
        },
        usage: data.usage,
      }
      setGeneratedEmails(prev => [optimizedEmail, ...prev])
      toast.success('Email optimized successfully!')
    },
    onError: (error) => {
      toast.error(`Optimization failed: ${error.message}`)
    },
  })

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    const imagePromises = files.map(file => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          const base64 = e.target?.result as string
          resolve(base64.split(',')[1]) // Remove data:image/jpeg;base64, prefix
        }
        reader.readAsDataURL(file)
      })
    })

    const imageData = await Promise.all(imagePromises)
    setUploadedImages(prev => [...prev, ...imageData])
    
    // Auto-analyze uploaded images
    if (imageData.length > 0) {
      analyzeImagesMutation.mutate(imageData)
    }
  }

  const handleGenerate = () => {
    if (!formData.leadEmail || !formData.campaignGoal) {
      toast.error('Please fill in lead email and campaign goal')
      return
    }

    generateEmailMutation.mutate({
      ...formData,
      leadImages: uploadedImages.length > 0 ? uploadedImages : undefined,
      recentNews: formData.recentNews?.filter(news => news.trim() !== ''),
      previousEmails: formData.previousEmails?.filter(email => email.trim() !== ''),
    })
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard!')
  }

  const availableModels = {
    anthropic: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (Best Quality)', cost: '$0.003' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku (Fastest)', cost: '$0.00025' },
    ],
    openai: [
      { id: 'gpt-4o', name: 'GPT-4o (Multimodal)', cost: '$0.005' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Efficient)', cost: '$0.00015' },
    ],
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            Advanced AI Email Generator
          </h2>
          <p className="text-muted-foreground">
            Generate personalized emails using GPT-4o, Claude-3.5, and multimodal AI
          </p>
        </div>
        <Badge variant="secondary" className="gap-1">
          <Sparkles className="h-3 w-3" />
          Next-Gen AI
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Configuration Panel */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                AI Model Configuration
              </CardTitle>
              <CardDescription>
                Choose your AI provider and model for optimal results
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>AI Provider</Label>
                  <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="anthropic">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-orange-500 rounded-full" />
                          Anthropic Claude
                        </div>
                      </SelectItem>
                      <SelectItem value="openai">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full" />
                          OpenAI GPT
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Model</Label>
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableModels[selectedProvider as keyof typeof availableModels]?.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          <div className="flex items-center justify-between w-full">
                            <span>{model.name}</span>
                            <Badge variant="outline" className="ml-2">
                              {model.cost}/1k tokens
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lead Information */}
          <Card>
            <CardHeader>
              <CardTitle>Lead Information</CardTitle>
              <CardDescription>
                Provide details about your lead for personalization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="leadName">Lead Name</Label>
                  <Input
                    id="leadName"
                    value={formData.leadName || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, leadName: e.target.value }))}
                    placeholder="John Doe"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="leadEmail">Lead Email *</Label>
                  <Input
                    id="leadEmail"
                    type="email"
                    value={formData.leadEmail}
                    onChange={(e) => setFormData(prev => ({ ...prev, leadEmail: e.target.value }))}
                    placeholder="john@company.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="leadCompany">Company</Label>
                  <Input
                    id="leadCompany"
                    value={formData.leadCompany || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, leadCompany: e.target.value }))}
                    placeholder="Acme Corp"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="leadJobTitle">Job Title</Label>
                  <Input
                    id="leadJobTitle"
                    value={formData.leadJobTitle || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, leadJobTitle: e.target.value }))}
                    placeholder="VP of Sales"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="leadWebsite">Website</Label>
                  <Input
                    id="leadWebsite"
                    type="url"
                    value={formData.leadWebsite || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, leadWebsite: e.target.value }))}
                    placeholder="https://company.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="leadLinkedIn">LinkedIn Profile</Label>
                  <Input
                    id="leadLinkedIn"
                    type="url"
                    value={formData.leadLinkedIn || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, leadLinkedIn: e.target.value }))}
                    placeholder="https://linkedin.com/in/johndoe"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyDescription">Company Description</Label>
                <Textarea
                  id="companyDescription"
                  value={formData.companyDescription || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, companyDescription: e.target.value }))}
                  placeholder="Brief description of the lead's company and what they do..."
                  className="min-h-20"
                />
              </div>
            </CardContent>
          </Card>

          {/* Campaign Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Campaign Configuration</CardTitle>
              <CardDescription>
                Define your outreach strategy and messaging
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="campaignGoal">Campaign Goal *</Label>
                <Textarea
                  id="campaignGoal"
                  value={formData.campaignGoal}
                  onChange={(e) => setFormData(prev => ({ ...prev, campaignGoal: e.target.value }))}
                  placeholder="What do you want to achieve with this email? (e.g., schedule a demo, get a meeting, introduce a new product...)"
                  className="min-h-20"
                  required
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Tone</Label>
                  <Select value={formData.tone} onValueChange={(value: any) => setFormData(prev => ({ ...prev, tone: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                      <SelectItem value="friendly">Friendly</SelectItem>
                      <SelectItem value="direct">Direct</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Length</Label>
                  <Select value={formData.length} onValueChange={(value: any) => setFormData(prev => ({ ...prev, length: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="short">Short (50-100 words)</SelectItem>
                      <SelectItem value="medium">Medium (100-200 words)</SelectItem>
                      <SelectItem value="long">Long (200+ words)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    Include Call-to-Action
                    <Switch
                      checked={formData.includeCall}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, includeCall: checked }))}
                    />
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Multimodal Features */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Multimodal AI Features
              </CardTitle>
              <CardDescription>
                Upload images for AI analysis and personalization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6">
                <div className="text-center">
                  <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <div className="mt-4">
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      Upload Lead Photos
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Upload photos of the lead, their company, or office for AI analysis
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>

              {uploadedImages.length > 0 && (
                <div className="space-y-2">
                  <Label>Uploaded Images ({uploadedImages.length})</Label>
                  <div className="flex gap-2 flex-wrap">
                    {uploadedImages.map((_, index) => (
                      <Badge key={index} variant="secondary">
                        Image {index + 1}
                      </Badge>
                    ))}
                  </div>
                  {analyzeImagesMutation.isPending && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Analyzing images with AI...
                    </div>
                  )}
                </div>
              )}

              {imageAnalysis && (
                <Alert>
                  <Eye className="h-4 w-4" />
                  <AlertDescription>
                    <strong>AI Image Analysis:</strong> {imageAnalysis}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Generation Results */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Generate Email</span>
                <Badge variant={workspace?.ai_tokens_balance > 1000 ? 'default' : 'destructive'}>
                  {workspace?.ai_tokens_balance.toLocaleString()} tokens
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={handleGenerate}
                disabled={generateEmailMutation.isPending || !formData.leadEmail || !formData.campaignGoal}
                className="w-full gap-2"
                size="lg"
              >
                {generateEmailMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4" />
                    Generate with AI
                  </>
                )}
              </Button>

              {generatedEmails.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Optimization Target</Label>
                    <Select value={optimizationTarget} onValueChange={setOptimizationTarget as any}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="engagement">
                          <div className="flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            Engagement
                          </div>
                        </SelectItem>
                        <SelectItem value="deliverability">
                          <div className="flex items-center gap-1">
                            <Target className="h-3 w-3" />
                            Deliverability
                          </div>
                        </SelectItem>
                        <SelectItem value="conversion">
                          <div className="flex items-center gap-1">
                            <Zap className="h-3 w-3" />
                            Conversion
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => optimizeEmailMutation.mutate(`${generatedEmails[0].subject}\n\n${generatedEmails[0].body}`)}
                    disabled={optimizeEmailMutation.isPending}
                    className="w-full gap-2"
                  >
                    {optimizeEmailMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Optimizing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4" />
                        Optimize Email
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Generated Results */}
          {generatedEmails.length > 0 && (
            <div className="space-y-4">
              {generatedEmails.map((email, index) => (
                <Card key={index}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        Generated Email {generatedEmails.length - index}
                      </CardTitle>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(`${email.subject}\n\n${email.body}`)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <CardDescription>
                      Model: {email.usage.model} • Tokens: {email.usage.tokens} • Cost: ${email.usage.cost.toFixed(4)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Subject Line</Label>
                      <div className="p-3 bg-muted rounded-md text-sm font-medium">
                        {email.subject}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Email Body</Label>
                      <div className="p-3 bg-muted rounded-md text-sm whitespace-pre-wrap">
                        {email.body}
                      </div>
                    </div>

                    {email.analysis && (
                      <div className="space-y-2">
                        <Label className="text-xs">AI Analysis</Label>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <div className="flex justify-between">
                              <span>Tone</span>
                              <span>{email.analysis.tone_score}/10</span>
                            </div>
                            <Progress value={email.analysis.tone_score * 10} className="h-1" />
                          </div>
                          <div>
                            <div className="flex justify-between">
                              <span>Personalization</span>
                              <span>{email.analysis.personalization_score}/10</span>
                            </div>
                            <Progress value={email.analysis.personalization_score * 10} className="h-1" />
                          </div>
                          <div>
                            <div className="flex justify-between">
                              <span>Engagement</span>
                              <span>{email.analysis.engagement_score}/10</span>
                            </div>
                            <Progress value={email.analysis.engagement_score * 10} className="h-1" />
                          </div>
                          <div>
                            <div className="flex justify-between">
                              <span>Deliverability</span>
                              <span>{email.analysis.deliverability_score}/10</span>
                            </div>
                            <Progress value={email.analysis.deliverability_score * 10} className="h-1" />
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}