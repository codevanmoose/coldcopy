'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { useWorkspace } from '@/hooks/use-workspace'
import { Loader2, CheckCircle2, XCircle, Sparkles } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'

interface TestResult {
  provider: string
  model: string
  status: 'pending' | 'testing' | 'success' | 'error'
  message?: string
  email?: {
    subject: string
    body: string
  }
  performance?: {
    responseTime: number
    tokensUsed: number
    cost: number
  }
}

const AI_PROVIDERS = [
  {
    id: 'openai',
    name: 'OpenAI',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', description: 'Most advanced multimodal model' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Faster, cost-effective' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Previous generation' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    models: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Most intelligent' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Fastest model' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Most powerful' },
    ],
  },
]

export default function TestAIProvidersPage() {
  const { workspace } = useWorkspace()
  const { toast } = useToast()
  const [testingAll, setTestingAll] = useState(false)
  const [results, setResults] = useState<TestResult[]>([])
  const [customPrompt, setCustomPrompt] = useState('')

  const defaultContext = {
    leadName: 'Sarah Johnson',
    leadEmail: 'sarah.johnson@innovatetech.com',
    leadCompany: 'InnovateTech Solutions',
    leadJobTitle: 'Director of Operations',
    campaignGoal: 'Introduce our AI-powered analytics platform that can reduce operational costs by 30%',
    tone: 'professional' as const,
    length: 'medium' as const,
    includeCall: true,
    companyDescription: 'Mid-sized tech company focused on digital transformation solutions',
    leadWebsite: 'https://innovatetech.com',
  }

  const testSingleModel = async (provider: string, model: string) => {
    const resultIndex = results.findIndex(r => r.provider === provider && r.model === model)
    const newResults = [...results]
    
    if (resultIndex === -1) {
      newResults.push({ provider, model, status: 'testing' })
    } else {
      newResults[resultIndex].status = 'testing'
    }
    setResults(newResults)

    const startTime = Date.now()

    try {
      const response = await fetch('/api/ai/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspace?.id,
          user_id: workspace?.user_id,
          provider,
          model,
          context: customPrompt ? { ...defaultContext, campaignGoal: customPrompt } : defaultContext,
        }),
      })

      const responseTime = Date.now() - startTime

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate email')
      }

      const data = await response.json()
      
      const updatedResults = [...results]
      const idx = updatedResults.findIndex(r => r.provider === provider && r.model === model)
      
      updatedResults[idx] = {
        provider,
        model,
        status: 'success',
        email: {
          subject: data.subject,
          body: data.body,
        },
        performance: {
          responseTime,
          tokensUsed: data.usage?.totalTokens || 0,
          cost: data.usage?.cost || 0,
        },
      }
      
      setResults(updatedResults)
    } catch (error) {
      const updatedResults = [...results]
      const idx = updatedResults.findIndex(r => r.provider === provider && r.model === model)
      
      updatedResults[idx] = {
        provider,
        model,
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }
      
      setResults(updatedResults)
    }
  }

  const testAllProviders = async () => {
    if (!workspace?.id) {
      toast({
        title: 'Error',
        description: 'Please select a workspace first',
        variant: 'destructive',
      })
      return
    }

    setTestingAll(true)
    setResults([])

    // Initialize all results as pending
    const allTests: TestResult[] = []
    for (const provider of AI_PROVIDERS) {
      for (const model of provider.models) {
        allTests.push({
          provider: provider.id,
          model: model.id,
          status: 'pending',
        })
      }
    }
    setResults(allTests)

    // Test each model
    for (const provider of AI_PROVIDERS) {
      for (const model of provider.models) {
        await testSingleModel(provider.id, model.id)
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    setTestingAll(false)
    toast({
      title: 'Testing Complete',
      description: 'All AI providers have been tested',
    })
  }

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'testing':
        return <Loader2 className="h-4 w-4 animate-spin" />
      default:
        return null
    }
  }

  const getStatusBadge = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-500">Working</Badge>
      case 'error':
        return <Badge variant="destructive">Failed</Badge>
      case 'testing':
        return <Badge variant="secondary">Testing...</Badge>
      default:
        return <Badge variant="outline">Pending</Badge>
    }
  }

  return (
    <div className="container max-w-6xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">AI Provider Testing Dashboard</h1>
        <p className="text-gray-600">Test all AI providers and models to ensure they are working correctly</p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Test Configuration</CardTitle>
          <CardDescription>Customize the test prompt or use the default</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Custom Campaign Goal (optional)</label>
            <Textarea
              placeholder="Leave empty to use default: 'Introduce our AI-powered analytics platform...'"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={3}
            />
          </div>
          <Button 
            onClick={testAllProviders} 
            disabled={testingAll || !workspace?.id}
            className="w-full"
            size="lg"
          >
            {testingAll ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing All Providers...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Test All AI Providers
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {AI_PROVIDERS.map((provider) => (
          <Card key={provider.id}>
            <CardHeader>
              <CardTitle>{provider.name}</CardTitle>
              <CardDescription>Test {provider.name} models</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {provider.models.map((model) => {
                  const result = results.find(r => r.provider === provider.id && r.model === model.id)
                  
                  return (
                    <div key={model.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h4 className="font-semibold flex items-center gap-2">
                            {model.name}
                            {getStatusIcon(result?.status || 'pending')}
                          </h4>
                          <p className="text-sm text-gray-600">{model.description}</p>
                        </div>
                        {getStatusBadge(result?.status || 'pending')}
                      </div>
                      
                      {result?.status === 'error' && (
                        <div className="mt-2 p-2 bg-red-50 text-red-700 rounded text-sm">
                          {result.message}
                        </div>
                      )}
                      
                      {result?.status === 'success' && result.performance && (
                        <div className="mt-2 text-sm text-gray-600">
                          <div>Response time: {result.performance.responseTime}ms</div>
                          <div>Tokens used: {result.performance.tokensUsed}</div>
                        </div>
                      )}
                      
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => testSingleModel(provider.id, model.id)}
                        disabled={result?.status === 'testing' || testingAll}
                      >
                        {result?.status === 'testing' ? (
                          <>
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            Testing...
                          </>
                        ) : (
                          'Test Model'
                        )}
                      </Button>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {results.some(r => r.status === 'success') && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Generated Emails Comparison</CardTitle>
            <CardDescription>Compare outputs from different models</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue={results.find(r => r.status === 'success')?.model}>
              <TabsList className="grid grid-cols-3 lg:grid-cols-6 w-full">
                {results
                  .filter(r => r.status === 'success')
                  .map((result) => (
                    <TabsTrigger key={`${result.provider}-${result.model}`} value={result.model}>
                      {result.model.split('-')[0].toUpperCase()}
                    </TabsTrigger>
                  ))}
              </TabsList>
              
              {results
                .filter(r => r.status === 'success' && r.email)
                .map((result) => (
                  <TabsContent key={`${result.provider}-${result.model}`} value={result.model}>
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-semibold mb-2">Subject Line:</h4>
                        <div className="p-3 bg-gray-50 rounded-md">
                          {result.email!.subject}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Email Body:</h4>
                        <div className="p-3 bg-gray-50 rounded-md whitespace-pre-wrap">
                          {result.email!.body}
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                ))}
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  )
}