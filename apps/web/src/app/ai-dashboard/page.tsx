'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useWorkspace } from '@/hooks/use-workspace'
import { 
  Sparkles, 
  Mail, 
  MessageSquare, 
  Brain, 
  Calendar,
  TrendingUp,
  Image,
  Zap,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react'

interface AIFeature {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  status: 'active' | 'beta' | 'coming-soon'
  testUrl?: string
  capabilities: string[]
}

const AI_FEATURES: AIFeature[] = [
  {
    id: 'email-generation',
    name: 'AI Email Generation',
    description: 'Generate personalized cold emails using GPT-4 and Claude',
    icon: <Mail className="h-5 w-5" />,
    status: 'active',
    testUrl: '/test-ai',
    capabilities: [
      'Multi-model support (GPT-4, Claude)',
      'Personalization based on lead data',
      'Tone and length customization',
      'Campaign goal optimization',
    ],
  },
  {
    id: 'smart-reply',
    name: 'Smart Reply Suggestions',
    description: 'AI-powered reply suggestions that match tone and context',
    icon: <MessageSquare className="h-5 w-5" />,
    status: 'active',
    testUrl: '/test-smart-reply',
    capabilities: [
      '3-5 contextual reply options',
      'Tone matching',
      'Intent detection',
      'Conversation history awareness',
    ],
  },
  {
    id: 'sentiment-analysis',
    name: 'Sentiment Analysis',
    description: 'Real-time emotion and sentiment detection in conversations',
    icon: <Brain className="h-5 w-5" />,
    status: 'active',
    testUrl: '/test-sentiment',
    capabilities: [
      '8 emotion categories',
      'Urgency detection',
      'Engagement scoring',
      'Action item extraction',
    ],
  },
  {
    id: 'meeting-scheduler',
    name: 'AI Meeting Scheduler',
    description: 'Automatically detect and schedule meetings from email',
    icon: <Calendar className="h-5 w-5" />,
    status: 'active',
    capabilities: [
      'Meeting intent detection',
      'Calendar integration',
      'Timezone handling',
      'Automated confirmations',
    ],
  },
  {
    id: 'lead-scoring',
    name: 'AI Lead Scoring',
    description: 'Intelligent lead scoring based on behavior and engagement',
    icon: <TrendingUp className="h-5 w-5" />,
    status: 'active',
    capabilities: [
      'Behavioral analysis',
      'Engagement tracking',
      'Predictive scoring',
      'Real-time updates',
    ],
  },
  {
    id: 'image-analysis',
    name: 'Lead Image Analysis',
    description: 'Extract insights from LinkedIn profiles and company images',
    icon: <Image className="h-5 w-5" />,
    status: 'active',
    capabilities: [
      'Profile photo analysis',
      'Company culture insights',
      'Industry detection',
      'Personalization hints',
    ],
  },
  {
    id: 'content-optimization',
    name: 'Email Content Optimization',
    description: 'AI-powered suggestions to improve deliverability and engagement',
    icon: <Zap className="h-5 w-5" />,
    status: 'active',
    capabilities: [
      'Spam score reduction',
      'Subject line optimization',
      'CTA improvement',
      'Readability enhancement',
    ],
  },
]

export default function AIDashboardPage() {
  const { workspace } = useWorkspace()
  const [apiStatus, setApiStatus] = useState<{
    openai: boolean | null
    anthropic: boolean | null
  }>({ openai: null, anthropic: null })

  const checkAPIStatus = async () => {
    try {
      const response = await fetch('/api/test-ai-config')
      const data = await response.json()
      setApiStatus({
        openai: data.config?.openai?.configured || false,
        anthropic: data.config?.anthropic?.configured || false,
      })
    } catch (error) {
      console.error('Failed to check API status:', error)
      setApiStatus({ openai: false, anthropic: false })
    }
  }

  useState(() => {
    checkAPIStatus()
  })

  const getStatusBadge = (status: AIFeature['status']) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500">Active</Badge>
      case 'beta':
        return <Badge className="bg-blue-500">Beta</Badge>
      case 'coming-soon':
        return <Badge variant="outline">Coming Soon</Badge>
    }
  }

  const getAPIStatusIcon = (status: boolean | null) => {
    if (status === null) return <AlertCircle className="h-4 w-4 text-gray-400" />
    return status ? 
      <CheckCircle2 className="h-4 w-4 text-green-500" /> : 
      <XCircle className="h-4 w-4 text-red-500" />
  }

  return (
    <div className="container max-w-6xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Sparkles className="h-8 w-8 text-purple-500" />
          AI Features Dashboard
        </h1>
        <p className="text-gray-600">
          Explore and test all AI-powered features in ColdCopy
        </p>
      </div>

      {/* API Status Card */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>AI Provider Status</CardTitle>
          <CardDescription>
            Configuration status of AI providers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-2">
                <img src="/openai-logo.png" alt="OpenAI" className="h-6 w-6" />
                <span className="font-medium">OpenAI (GPT-4)</span>
              </div>
              <div className="flex items-center gap-2">
                {getAPIStatusIcon(apiStatus.openai)}
                <span className="text-sm text-gray-600">
                  {apiStatus.openai === null ? 'Checking...' : 
                   apiStatus.openai ? 'Configured' : 'Not Configured'}
                </span>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-2">
                <img src="/anthropic-logo.png" alt="Anthropic" className="h-6 w-6" />
                <span className="font-medium">Anthropic (Claude)</span>
              </div>
              <div className="flex items-center gap-2">
                {getAPIStatusIcon(apiStatus.anthropic)}
                <span className="text-sm text-gray-600">
                  {apiStatus.anthropic === null ? 'Checking...' : 
                   apiStatus.anthropic ? 'Configured' : 'Not Configured'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="mt-4 flex gap-2">
            <Button variant="outline" size="sm" onClick={checkAPIStatus}>
              Refresh Status
            </Button>
            <Link href="/test-ai-providers">
              <Button size="sm">
                Test All Providers
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Token Usage */}
      {workspace && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>AI Token Usage</CardTitle>
            <CardDescription>
              Monthly token consumption and limits
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Tokens Used</span>
                  <span>50,000 / 1,000,000</span>
                </div>
                <Progress value={5} />
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Estimated Cost</span>
                <span>$25.00 / $500.00</span>
              </div>
              <Button variant="outline" size="sm" className="w-full">
                Purchase More Tokens
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {AI_FEATURES.map((feature) => (
          <Card key={feature.id} className="relative overflow-hidden">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                    {feature.icon}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{feature.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {feature.description}
                    </CardDescription>
                  </div>
                </div>
                {getStatusBadge(feature.status)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="space-y-2">
                  {feature.capabilities.map((capability, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>{capability}</span>
                    </div>
                  ))}
                </div>
                
                {feature.testUrl && feature.status === 'active' && (
                  <Link href={feature.testUrl}>
                    <Button className="w-full" size="sm">
                      Test Feature
                    </Button>
                  </Link>
                )}
                
                {feature.status === 'coming-soon' && (
                  <Button className="w-full" size="sm" disabled>
                    Coming Soon
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/campaigns/new">
              <Button variant="outline" className="w-full">
                Create AI Campaign
              </Button>
            </Link>
            <Link href="/templates/editor">
              <Button variant="outline" className="w-full">
                Design Email Template
              </Button>
            </Link>
            <Link href="/settings/ai">
              <Button variant="outline" className="w-full">
                Configure AI Settings
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}