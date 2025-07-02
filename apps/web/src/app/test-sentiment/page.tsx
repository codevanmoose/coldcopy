'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { useWorkspace } from '@/hooks/use-workspace'
import { Loader2, TrendingUp, TrendingDown, Minus, Brain } from 'lucide-react'

interface SentimentResult {
  overall_sentiment: 'positive' | 'negative' | 'neutral' | 'mixed'
  sentiment_score: number // -1 to 1
  emotions: {
    joy: number
    anger: number
    fear: number
    sadness: number
    surprise: number
    trust: number
    anticipation: number
    disgust: number
  }
  key_phrases: string[]
  action_items: string[]
  urgency_level: 'low' | 'medium' | 'high' | 'critical'
  engagement_level: 'very_low' | 'low' | 'medium' | 'high' | 'very_high'
  recommendations: string[]
}

const SAMPLE_CONVERSATIONS = [
  {
    title: 'Frustrated Customer',
    content: `I've been trying to get this issue resolved for over a week now, and I'm extremely frustrated with the lack of response from your team. This is causing significant problems for our business operations.

We were promised 24/7 support when we signed up for the Enterprise plan, but every time I reach out, I either get no response or a generic reply that doesn't address our specific issue.

If this isn't resolved by end of day tomorrow, we'll have no choice but to look for alternative solutions. This is unacceptable for a service we're paying $5000/month for.`,
  },
  {
    title: 'Interested Prospect',
    content: `Hi team,

I just watched your demo video and I'm really impressed with what ColdCopy can do! Our sales team has been struggling with personalization at scale, and your AI features seem like they could be a game-changer for us.

I'm particularly interested in the LinkedIn integration and the smart reply suggestions. Could we schedule a call this week to discuss pricing and implementation? We're looking to make a decision by end of quarter.

Looking forward to hearing from you!`,
  },
  {
    title: 'Happy Customer',
    content: `Just wanted to drop a quick note to say how much ColdCopy has transformed our outreach process! 

We've seen a 3x increase in response rates since implementing your platform 2 months ago. The AI email generation is incredible - it saves our team hours every day while maintaining that personal touch.

Already recommended you to two other companies in our network. Keep up the great work!`,
  },
]

export default function TestSentimentPage() {
  const { workspace } = useWorkspace()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [conversation, setConversation] = useState(SAMPLE_CONVERSATIONS[0].content)
  const [result, setResult] = useState<SentimentResult | null>(null)

  const handleAnalyzeSentiment = async () => {
    if (!workspace?.id) {
      toast({
        title: 'Error',
        description: 'Please select a workspace first',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/sentiment/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspace_id: workspace.id,
          conversation_id: 'test-' + Date.now(),
          messages: [
            {
              content: conversation,
              sender_type: 'lead',
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to analyze sentiment')
      }

      const data = await response.json()
      setResult(data)
      
      toast({
        title: 'Analysis Complete',
        description: `Sentiment: ${data.overall_sentiment} (${data.urgency_level} urgency)`,
      })
    } catch (error) {
      console.error('Sentiment analysis error:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to analyze sentiment',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return <TrendingUp className="h-5 w-5 text-green-500" />
      case 'negative':
        return <TrendingDown className="h-5 w-5 text-red-500" />
      case 'mixed':
        return <Minus className="h-5 w-5 text-yellow-500" />
      default:
        return <Minus className="h-5 w-5 text-gray-500" />
    }
  }

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return 'bg-green-100 text-green-800'
      case 'negative':
        return 'bg-red-100 text-red-800'
      case 'mixed':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical':
        return 'bg-red-500 text-white'
      case 'high':
        return 'bg-orange-500 text-white'
      case 'medium':
        return 'bg-yellow-500 text-white'
      default:
        return 'bg-gray-500 text-white'
    }
  }

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Test Sentiment Analysis</h1>
        <p className="text-gray-600">AI-powered conversation sentiment and emotion detection</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Conversation Input</CardTitle>
          <CardDescription>
            Enter a conversation or email to analyze sentiment
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {SAMPLE_CONVERSATIONS.map((sample, idx) => (
              <Button
                key={idx}
                variant="outline"
                size="sm"
                onClick={() => setConversation(sample.content)}
              >
                {sample.title}
              </Button>
            ))}
          </div>

          <Textarea
            value={conversation}
            onChange={(e) => setConversation(e.target.value)}
            rows={8}
            placeholder="Enter conversation or email content..."
          />

          <Button 
            onClick={handleAnalyzeSentiment} 
            disabled={loading || !workspace?.id || !conversation}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing Sentiment...
              </>
            ) : (
              <>
                <Brain className="mr-2 h-4 w-4" />
                Analyze Sentiment
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <div className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Overall Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    {getSentimentIcon(result.overall_sentiment)}
                    <span className="text-lg font-semibold capitalize">
                      {result.overall_sentiment}
                    </span>
                  </div>
                  <Badge className={getSentimentColor(result.overall_sentiment)}>
                    Score: {(result.sentiment_score * 100).toFixed(0)}%
                  </Badge>
                </div>

                <div className="text-center p-4 border rounded-lg">
                  <div className="text-lg font-semibold mb-2">Urgency Level</div>
                  <Badge className={getUrgencyColor(result.urgency_level)}>
                    {result.urgency_level.toUpperCase()}
                  </Badge>
                </div>

                <div className="text-center p-4 border rounded-lg">
                  <div className="text-lg font-semibold mb-2">Engagement</div>
                  <Badge variant="outline">
                    {result.engagement_level.replace('_', ' ').toUpperCase()}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Emotion Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(result.emotions).map(([emotion, score]) => (
                  <div key={emotion} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="capitalize">{emotion}</span>
                      <span>{(score * 100).toFixed(0)}%</span>
                    </div>
                    <Progress value={score * 100} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {result.key_phrases.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Key Phrases</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {result.key_phrases.map((phrase, idx) => (
                    <Badge key={idx} variant="secondary">
                      {phrase}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {result.action_items.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Action Items</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {result.action_items.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {result.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {result.recommendations.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">✓</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}