'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Sparkles, 
  Mail, 
  MessageSquare, 
  Brain, 
  Zap,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  TrendingUp
} from 'lucide-react'

interface AIStats {
  tokensUsed: number
  tokensLimit: number
  emailsGenerated: number
  repliesSuggested: number
  sentimentAnalyzed: number
  openAIStatus: boolean | null
  anthropicStatus: boolean | null
}

export function AIFeaturesSection() {
  const [aiStats, setAIStats] = useState<AIStats>({
    tokensUsed: 50000,
    tokensLimit: 1000000,
    emailsGenerated: 1250,
    repliesSuggested: 342,
    sentimentAnalyzed: 856,
    openAIStatus: null,
    anthropicStatus: null
  })

  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    checkAPIStatus()
  }, [])

  const checkAPIStatus = async () => {
    try {
      const response = await fetch('/api/test-ai-config')
      const data = await response.json()
      setAIStats(prev => ({
        ...prev,
        openAIStatus: data.config?.openai?.configured || false,
        anthropicStatus: data.config?.anthropic?.configured || false,
      }))
    } catch (error) {
      console.error('Failed to check API status:', error)
      setAIStats(prev => ({
        ...prev,
        openAIStatus: false,
        anthropicStatus: false,
      }))
    } finally {
      setIsLoading(false)
    }
  }

  const getAPIStatusIcon = (status: boolean | null) => {
    if (status === null) return <AlertCircle className="h-3 w-3 text-gray-400" />
    return status ? 
      <CheckCircle2 className="h-3 w-3 text-green-500" /> : 
      <XCircle className="h-3 w-3 text-red-500" />
  }

  const tokenPercentage = (aiStats.tokensUsed / aiStats.tokensLimit) * 100

  return (
    <div className="space-y-4">
      {/* AI Overview Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              <CardTitle>AI Features</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {getAPIStatusIcon(aiStats.openAIStatus)}
                <span className="text-xs text-muted-foreground">GPT-4</span>
              </div>
              <div className="flex items-center gap-1">
                {getAPIStatusIcon(aiStats.anthropicStatus)}
                <span className="text-xs text-muted-foreground">Claude</span>
              </div>
            </div>
          </div>
          <CardDescription>
            AI-powered features to enhance your outreach
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Token Usage */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Token Usage</span>
              <span className="font-medium">
                {aiStats.tokensUsed.toLocaleString()} / {aiStats.tokensLimit.toLocaleString()}
              </span>
            </div>
            <Progress value={tokenPercentage} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {(100 - tokenPercentage).toFixed(0)}% remaining this month
            </p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{aiStats.emailsGenerated.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Emails Generated</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{aiStats.repliesSuggested}</div>
              <p className="text-xs text-muted-foreground">Smart Replies</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{aiStats.sentimentAnalyzed}</div>
              <p className="text-xs text-muted-foreground">Analyzed</p>
            </div>
          </div>

          {/* AI Feature Cards */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                  <Mail className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">Email Generation</p>
                  <p className="text-xs text-muted-foreground">
                    Create personalized emails with AI
                  </p>
                </div>
              </div>
              <Link href="/campaigns/new">
                <Button size="sm" variant="ghost">
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">Smart Replies</p>
                  <p className="text-xs text-muted-foreground">
                    AI suggestions for quick responses
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="text-xs">
                <TrendingUp className="h-3 w-3 mr-1" />
                +15%
              </Badge>
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                  <Brain className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">Sentiment Analysis</p>
                  <p className="text-xs text-muted-foreground">
                    Real-time conversation insights
                  </p>
                </div>
              </div>
              <Link href="/inbox">
                <Button size="sm" variant="ghost">
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Alert for unconfigured APIs */}
          {(!aiStats.openAIStatus || !aiStats.anthropicStatus) && !isLoading && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Some AI providers are not configured.{' '}
                <Link href="/settings/ai" className="font-medium underline">
                  Configure now
                </Link>
              </AlertDescription>
            </Alert>
          )}

          {/* Quick Actions */}
          <div className="flex gap-2 pt-2">
            <Link href="/test-ai" className="flex-1">
              <Button variant="outline" size="sm" className="w-full">
                <Zap className="h-4 w-4 mr-2" />
                Test AI Features
              </Button>
            </Link>
            <Link href="/settings/ai" className="flex-1">
              <Button variant="outline" size="sm" className="w-full">
                Settings
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}