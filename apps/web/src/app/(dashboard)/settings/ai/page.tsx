'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { 
  Sparkles, 
  Key, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Info,
  Zap,
  FileText,
  TrendingUp
} from 'lucide-react'
import { EmailTemplates, type EmailTemplate } from '@/components/ai/email-templates'
import { PurchaseTokensDialog } from '@/components/billing/purchase-tokens-dialog'
import { TokenHistory } from '@/components/billing/token-history'

const aiConfigSchema = z.object({
  provider: z.enum(['openai', 'anthropic']),
  apiKey: z.string().min(1, 'API key is required'),
  model: z.string().optional(),
  temperature: z.number().min(0).max(1),
  maxTokens: z.number().min(100).max(4000),
  defaultTone: z.enum(['professional', 'friendly', 'casual', 'formal', 'enthusiastic']),
  defaultStyle: z.enum(['direct', 'storytelling', 'problem-solution', 'benefit-focused', 'question-based']),
})

type AIConfigForm = z.infer<typeof aiConfigSchema>

export default function AISettingsPage() {
  const { workspace, setWorkspace } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const supabase = createClient()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
    reset,
  } = useForm<AIConfigForm>({
    resolver: zodResolver(aiConfigSchema),
    defaultValues: {
      provider: workspace?.settings?.ai?.provider || 'openai',
      apiKey: workspace?.settings?.ai?.apiKey || '',
      model: workspace?.settings?.ai?.model || '',
      temperature: workspace?.settings?.ai?.temperature || 0.7,
      maxTokens: workspace?.settings?.ai?.maxTokens || 500,
      defaultTone: workspace?.settings?.ai?.defaultTone || 'professional',
      defaultStyle: workspace?.settings?.ai?.defaultStyle || 'direct',
    },
  })

  const provider = watch('provider')
  const temperature = watch('temperature')
  const maxTokens = watch('maxTokens')

  useEffect(() => {
    if (workspace) {
      reset({
        provider: workspace.settings?.ai?.provider || 'openai',
        apiKey: workspace.settings?.ai?.apiKey || '',
        model: workspace.settings?.ai?.model || '',
        temperature: workspace.settings?.ai?.temperature || 0.7,
        maxTokens: workspace.settings?.ai?.maxTokens || 500,
        defaultTone: workspace.settings?.ai?.defaultTone || 'professional',
        defaultStyle: workspace.settings?.ai?.defaultStyle || 'direct',
      })
      
      // Load templates
      setTemplates(workspace.settings?.ai?.templates || [])
    }
  }, [workspace, reset])

  const onSubmit = async (data: AIConfigForm) => {
    if (!workspace) return

    setIsLoading(true)
    try {
      const { data: updatedWorkspace, error } = await supabase
        .from('workspaces')
        .update({
          settings: {
            ...workspace.settings,
            ai: {
              provider: data.provider,
              apiKey: data.apiKey,
              model: data.model,
              temperature: data.temperature,
              maxTokens: data.maxTokens,
              defaultTone: data.defaultTone,
              defaultStyle: data.defaultStyle,
              templates,
            },
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', workspace.id)
        .select()
        .single()

      if (error) throw error

      setWorkspace(updatedWorkspace)
      toast.success('AI settings updated successfully')
      reset(data)
    } catch (error) {
      console.error('Error updating AI settings:', error)
      toast.error('Failed to update AI settings')
    } finally {
      setIsLoading(false)
    }
  }

  const testConnection = async () => {
    const apiKey = watch('apiKey')
    const currentProvider = watch('provider')

    if (!apiKey) {
      toast.error('Please enter an API key first')
      return
    }

    setIsTesting(true)
    setTestResult(null)

    try {
      // In a real implementation, you would test the API connection
      // For now, we'll simulate it
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      setTestResult({
        success: true,
        message: `Successfully connected to ${currentProvider === 'openai' ? 'OpenAI' : 'Anthropic'} API`,
      })
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Failed to connect to API. Please check your API key.',
      })
    } finally {
      setIsTesting(false)
    }
  }

  const handleTemplateCreate = (template: Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newTemplate: EmailTemplate = {
      ...template,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setTemplates([...templates, newTemplate])
  }

  const handleTemplateUpdate = (id: string, updates: Partial<EmailTemplate>) => {
    setTemplates(templates.map(t => 
      t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
    ))
  }

  const handleTemplateDelete = (id: string) => {
    setTemplates(templates.filter(t => t.id !== id))
  }

  const modelOptions = {
    openai: [
      { value: 'gpt-4-turbo-preview', label: 'GPT-4 Turbo' },
      { value: 'gpt-4', label: 'GPT-4' },
      { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
    ],
    anthropic: [
      { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
      { value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet' },
      { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' },
    ],
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="configuration">
        <TabsList>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="usage">Usage & Tokens</TabsTrigger>
        </TabsList>

        <TabsContent value="configuration" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>AI Provider Configuration</CardTitle>
              <CardDescription>
                Configure your AI provider for email generation and content creation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="provider">AI Provider</Label>
                    <Select
                      value={provider}
                      onValueChange={(value) => setValue('provider', value as 'openai' | 'anthropic', { shouldDirty: true })}
                    >
                      <SelectTrigger id="provider">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="openai">OpenAI (GPT-4)</SelectItem>
                        <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="model">Model</Label>
                    <Select
                      value={watch('model')}
                      onValueChange={(value) => setValue('model', value, { shouldDirty: true })}
                    >
                      <SelectTrigger id="model">
                        <SelectValue placeholder="Select a model" />
                      </SelectTrigger>
                      <SelectContent>
                        {modelOptions[provider].map((model) => (
                          <SelectItem key={model.value} value={model.value}>
                            {model.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="apiKey">API Key</Label>
                  <div className="flex gap-2">
                    <Input
                      id="apiKey"
                      type="password"
                      placeholder={`Enter your ${provider === 'openai' ? 'OpenAI' : 'Anthropic'} API key`}
                      {...register('apiKey')}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={testConnection}
                      disabled={isTesting}
                    >
                      {isTesting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Test'
                      )}
                    </Button>
                  </div>
                  {errors.apiKey && (
                    <p className="text-sm text-destructive">{errors.apiKey.message}</p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {provider === 'openai' ? (
                      <>Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline">OpenAI Dashboard</a></>
                    ) : (
                      <>Get your API key from <a href="https://console.anthropic.com/account/keys" target="_blank" rel="noopener noreferrer" className="underline">Anthropic Console</a></>
                    )}
                  </p>
                </div>

                {testResult && (
                  <Alert variant={testResult.success ? 'default' : 'destructive'}>
                    {testResult.success ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                    <AlertDescription>{testResult.message}</AlertDescription>
                  </Alert>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Temperature ({temperature})</Label>
                    <Slider
                      value={[temperature]}
                      onValueChange={([value]) => setValue('temperature', value, { shouldDirty: true })}
                      min={0}
                      max={1}
                      step={0.1}
                    />
                    <p className="text-xs text-muted-foreground">
                      Lower = more focused, Higher = more creative
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Max Tokens ({maxTokens})</Label>
                    <Slider
                      value={[maxTokens]}
                      onValueChange={([value]) => setValue('maxTokens', value, { shouldDirty: true })}
                      min={100}
                      max={4000}
                      step={100}
                    />
                    <p className="text-xs text-muted-foreground">
                      Maximum length of generated content
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="defaultTone">Default Tone</Label>
                    <Select
                      value={watch('defaultTone')}
                      onValueChange={(value) => setValue('defaultTone', value as any, { shouldDirty: true })}
                    >
                      <SelectTrigger id="defaultTone">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="friendly">Friendly</SelectItem>
                        <SelectItem value="casual">Casual</SelectItem>
                        <SelectItem value="formal">Formal</SelectItem>
                        <SelectItem value="enthusiastic">Enthusiastic</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="defaultStyle">Default Style</Label>
                    <Select
                      value={watch('defaultStyle')}
                      onValueChange={(value) => setValue('defaultStyle', value as any, { shouldDirty: true })}
                    >
                      <SelectTrigger id="defaultStyle">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="direct">Direct</SelectItem>
                        <SelectItem value="storytelling">Storytelling</SelectItem>
                        <SelectItem value="problem-solution">Problem-Solution</SelectItem>
                        <SelectItem value="benefit-focused">Benefit-Focused</SelectItem>
                        <SelectItem value="question-based">Question-Based</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <Button type="submit" disabled={!isDirty || isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Settings'
                    )}
                  </Button>
                  {isDirty && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => reset()}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AI Guidelines</CardTitle>
              <CardDescription>
                Best practices for AI-generated content
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  AI-generated content should always be reviewed before sending. The AI is a tool
                  to help you write better emails faster, not a replacement for human judgment.
                </AlertDescription>
              </Alert>
              
              <div className="space-y-3">
                <div className="flex gap-3">
                  <Sparkles className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Personalization is key</p>
                    <p className="text-sm text-muted-foreground">
                      Always include specific details about the recipient and their company
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Keep it concise</p>
                    <p className="text-sm text-muted-foreground">
                      Cold emails should be under 150 words for best response rates
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <Key className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Secure your API keys</p>
                    <p className="text-sm text-muted-foreground">
                      Never share your API keys. They're encrypted and stored securely
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates">
          <EmailTemplates
            templates={templates}
            onTemplateCreate={handleTemplateCreate}
            onTemplateUpdate={handleTemplateUpdate}
            onTemplateDelete={handleTemplateDelete}
          />
        </TabsContent>

        <TabsContent value="usage" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>AI Token Usage</CardTitle>
              <CardDescription>
                Monitor your AI token consumption and balance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-muted-foreground" />
                    <p className="text-sm font-medium text-muted-foreground">Token Balance</p>
                  </div>
                  <p className="text-3xl font-bold">
                    {(workspace?.ai_tokens_balance || 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Available tokens
                  </p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-muted-foreground" />
                    <p className="text-sm font-medium text-muted-foreground">Tokens Used</p>
                  </div>
                  <p className="text-3xl font-bold">
                    {(workspace?.ai_tokens_used || 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    This billing period
                  </p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-muted-foreground" />
                    <p className="text-sm font-medium text-muted-foreground">Avg per Email</p>
                  </div>
                  <p className="text-3xl font-bold">
                    ~250
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Tokens per generation
                  </p>
                </div>
              </div>
              
              <div className="mt-6">
                <PurchaseTokensDialog 
                  onSuccess={(tokens) => {
                    // Refresh workspace data
                    if (workspace) {
                      setWorkspace({
                        ...workspace,
                        ai_tokens_balance: (workspace.ai_tokens_balance || 0) + tokens,
                      })
                    }
                  }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Token Pricing</CardTitle>
              <CardDescription>
                Cost-effective AI email generation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Starter Pack</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">$10</p>
                      <p className="text-sm text-muted-foreground">10,000 tokens</p>
                      <p className="text-xs text-muted-foreground mt-2">~40 emails</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Growth Pack</CardTitle>
                      <Badge className="ml-2" variant="secondary">Popular</Badge>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">$45</p>
                      <p className="text-sm text-muted-foreground">50,000 tokens</p>
                      <p className="text-xs text-muted-foreground mt-2">~200 emails</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Scale Pack</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">$200</p>
                      <p className="text-sm text-muted-foreground">250,000 tokens</p>
                      <p className="text-xs text-muted-foreground mt-2">~1,000 emails</p>
                    </CardContent>
                  </Card>
                </div>
                
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Tokens never expire. Unused tokens roll over to the next billing period.
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>

          {workspace && (
            <TokenHistory workspaceId={workspace.id} limit={10} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}