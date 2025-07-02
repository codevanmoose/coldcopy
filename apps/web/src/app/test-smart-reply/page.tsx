'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { useWorkspace } from '@/hooks/use-workspace'
import { Loader2, MessageSquare, Sparkles } from 'lucide-react'

interface SmartReply {
  id: string
  content: string
  tone: string
  intent: string
  confidence: number
}

export default function TestSmartReplyPage() {
  const { workspace } = useWorkspace()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [incomingEmail, setIncomingEmail] = useState(`Hi there,

I came across your product and I'm quite interested. We're currently evaluating solutions for our sales team of about 50 people.

Could you tell me more about:
1. Your pricing for teams
2. Integration with Salesforce
3. Training and onboarding support

Also, do you offer a trial period?

Best regards,
Mike Thompson
Sales Director at TechCorp`)
  
  const [conversationContext, setConversationContext] = useState('')
  const [replies, setReplies] = useState<SmartReply[]>([])
  const [selectedReply, setSelectedReply] = useState<string>('')

  const handleGenerateReplies = async () => {
    if (!workspace?.id) {
      toast({
        title: 'Error',
        description: 'Please select a workspace first',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    setReplies([])
    setSelectedReply('')

    try {
      const response = await fetch('/api/smart-reply/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspace_id: workspace.id,
          email_content: incomingEmail,
          conversation_history: conversationContext,
          sender_info: {
            name: 'Mike Thompson',
            company: 'TechCorp',
            role: 'Sales Director',
          },
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate replies')
      }

      const data = await response.json()
      setReplies(data.suggestions || [])
      
      toast({
        title: 'Success!',
        description: `Generated ${data.suggestions?.length || 0} smart reply suggestions`,
      })
    } catch (error) {
      console.error('Smart reply error:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to generate replies',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const getToneColor = (tone: string) => {
    const toneColors: Record<string, string> = {
      professional: 'bg-blue-100 text-blue-800',
      friendly: 'bg-green-100 text-green-800',
      enthusiastic: 'bg-purple-100 text-purple-800',
      consultative: 'bg-indigo-100 text-indigo-800',
      direct: 'bg-gray-100 text-gray-800',
    }
    return toneColors[tone.toLowerCase()] || 'bg-gray-100 text-gray-800'
  }

  const getIntentIcon = (intent: string) => {
    const intentIcons: Record<string, string> = {
      informative: '📚',
      sales: '💰',
      supportive: '🤝',
      scheduling: '📅',
      closing: '✅',
    }
    return intentIcons[intent.toLowerCase()] || '💬'
  }

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Test Smart Reply Suggestions</h1>
        <p className="text-gray-600">AI-powered reply suggestions that match tone and context</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Incoming Email</CardTitle>
          <CardDescription>
            Paste or edit the email you want to reply to
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="incomingEmail">Email Content</Label>
            <Textarea
              id="incomingEmail"
              value={incomingEmail}
              onChange={(e) => setIncomingEmail(e.target.value)}
              rows={8}
              placeholder="Paste the email you received..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="context">Previous Conversation (Optional)</Label>
            <Textarea
              id="context"
              value={conversationContext}
              onChange={(e) => setConversationContext(e.target.value)}
              rows={4}
              placeholder="Add any previous emails in this thread for context..."
            />
          </div>

          <Button 
            onClick={handleGenerateReplies} 
            disabled={loading || !workspace?.id || !incomingEmail}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing and Generating Replies...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Smart Replies
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {replies.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Smart Reply Suggestions</CardTitle>
            <CardDescription>
              Click on a reply to select it, then customize as needed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {replies.map((reply) => (
                <div
                  key={reply.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${
                    selectedReply === reply.id ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedReply(reply.id)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getIntentIcon(reply.intent)}</span>
                      <Badge className={getToneColor(reply.tone)}>
                        {reply.tone}
                      </Badge>
                      <Badge variant="outline">
                        {reply.intent}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-500">
                      {Math.round(reply.confidence * 100)}% match
                    </div>
                  </div>
                  <div className="prose prose-sm max-w-none">
                    <p className="whitespace-pre-wrap">{reply.content}</p>
                  </div>
                </div>
              ))}
            </div>

            {selectedReply && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Selected Reply
                </h4>
                <Textarea
                  value={replies.find(r => r.id === selectedReply)?.content || ''}
                  onChange={(e) => {
                    const newReplies = replies.map(r => 
                      r.id === selectedReply ? { ...r, content: e.target.value } : r
                    )
                    setReplies(newReplies)
                  }}
                  rows={6}
                  className="bg-white"
                />
                <div className="mt-4 flex gap-2">
                  <Button>
                    Send Email
                  </Button>
                  <Button variant="outline">
                    Copy to Clipboard
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}