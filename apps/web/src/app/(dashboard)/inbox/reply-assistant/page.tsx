"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { 
  Bot, Sparkles, Send, ThumbsUp, ThumbsDown, 
  Edit3, Copy, RefreshCw, Info, TrendingUp, 
  MessageSquare, Brain, Zap, BarChart3, Target,
  AlertCircle, CheckCircle2, XCircle, HelpCircle,
  Calendar, Users, Mail, Clock, Activity
} from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Progress } from "@/components/ui/progress"

interface EmailMessage {
  id: string
  from: string
  subject: string
  content: string
  received_at: string
  lead: {
    id: string
    name: string
    company: string
    email: string
  }
  campaign: {
    id: string
    name: string
  }
}

interface ReplyAnalysis {
  detected_intent: string
  intent_confidence: number
  sentiment_score: number
  questions_detected: string[]
  requires_action: boolean
  urgency_level: number
  suggested_reply_tone: string
  suggested_reply_length: string
  key_phrases: string[]
}

interface ReplySuggestion {
  id: string
  suggestion_text: string
  tone: string
  length: string
  confidence_score: number
  model_used: string
}

const INTENT_CONFIG = {
  interested: { label: 'Interested', color: 'bg-green-500', icon: CheckCircle2 },
  not_interested: { label: 'Not Interested', color: 'bg-red-500', icon: XCircle },
  needs_info: { label: 'Needs Information', color: 'bg-blue-500', icon: HelpCircle },
  scheduling: { label: 'Scheduling', color: 'bg-purple-500', icon: Calendar },
  objection: { label: 'Has Objections', color: 'bg-orange-500', icon: AlertCircle },
  referral: { label: 'Referral', color: 'bg-teal-500', icon: Users },
  unsubscribe: { label: 'Unsubscribe', color: 'bg-gray-500', icon: Mail },
  other: { label: 'Other', color: 'bg-gray-400', icon: MessageSquare }
}

const TONE_OPTIONS = [
  { value: 'professional', label: 'Professional', description: 'Business-focused and courteous' },
  { value: 'friendly', label: 'Friendly', description: 'Warm and approachable' },
  { value: 'casual', label: 'Casual', description: 'Relaxed and conversational' },
  { value: 'enthusiastic', label: 'Enthusiastic', description: 'Energetic and positive' },
  { value: 'empathetic', label: 'Empathetic', description: 'Understanding and compassionate' }
]

export default function ReplyAssistantPage() {
  const [selectedMessage, setSelectedMessage] = useState<EmailMessage | null>(null)
  const [analysis, setAnalysis] = useState<ReplyAnalysis | null>(null)
  const [suggestions, setSuggestions] = useState<ReplySuggestion[]>([])
  const [selectedSuggestion, setSelectedSuggestion] = useState<ReplySuggestion | null>(null)
  const [editedReply, setEditedReply] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [customInstructions, setCustomInstructions] = useState("")
  const [preferredTone, setPreferredTone] = useState("professional")

  // Mock inbox messages - replace with API call
  const inboxMessages: EmailMessage[] = [
    {
      id: '1',
      from: 'john@techcorp.com',
      subject: 'Re: Improve your sales process',
      content: "Hi Sarah,\n\nThanks for reaching out. Your solution sounds interesting. We've been struggling with our current CRM integration and lead tracking.\n\nCould you tell me more about:\n1. How your platform handles Salesforce integration?\n2. What's the typical implementation timeline?\n3. Do you have any case studies from SaaS companies?\n\nAlso, what would be the pricing for a team of 50 sales reps?\n\nBest,\nJohn",
      received_at: new Date(Date.now() - 3600000).toISOString(),
      lead: {
        id: '1',
        name: 'John Smith',
        company: 'TechCorp',
        email: 'john@techcorp.com'
      },
      campaign: {
        id: '1',
        name: 'Q4 Enterprise Outreach'
      }
    },
    {
      id: '2',
      from: 'sarah@innovate.io',
      subject: 'Re: Quick question about your goals',
      content: "Not interested at this time. Please remove me from your list.",
      received_at: new Date(Date.now() - 7200000).toISOString(),
      lead: {
        id: '2',
        name: 'Sarah Johnson',
        company: 'Innovate.io',
        email: 'sarah@innovate.io'
      },
      campaign: {
        id: '2',
        name: 'Startup Outreach'
      }
    },
    {
      id: '3',
      from: 'mike@growth.co',
      subject: 'Re: Boost your conversion rates',
      content: "Hey there!\n\nThis actually came at a perfect time. We're planning our Q1 initiatives and improving conversion is a top priority.\n\nI'd love to schedule a call to discuss this further. Are you available next Tuesday or Wednesday afternoon?\n\nCheers,\nMike",
      received_at: new Date(Date.now() - 10800000).toISOString(),
      lead: {
        id: '3',
        name: 'Mike Chen',
        company: 'Growth Co',
        email: 'mike@growth.co'
      },
      campaign: {
        id: '1',
        name: 'Q4 Enterprise Outreach'
      }
    }
  ]

  const analyzeReply = async (message: EmailMessage) => {
    setIsAnalyzing(true)
    setSelectedMessage(message)
    
    try {
      // Mock API call - replace with actual
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      const mockAnalysis: ReplyAnalysis = {
        detected_intent: message.id === '1' ? 'needs_info' : message.id === '2' ? 'not_interested' : 'scheduling',
        intent_confidence: 0.92,
        sentiment_score: message.id === '2' ? -0.8 : 0.6,
        questions_detected: message.id === '1' ? [
          "How your platform handles Salesforce integration?",
          "What's the typical implementation timeline?",
          "Do you have any case studies from SaaS companies?",
          "What would be the pricing for a team of 50 sales reps?"
        ] : [],
        requires_action: true,
        urgency_level: message.id === '3' ? 4 : 2,
        suggested_reply_tone: 'professional',
        suggested_reply_length: 'medium',
        key_phrases: ['CRM integration', 'lead tracking', 'implementation timeline', 'pricing']
      }
      
      setAnalysis(mockAnalysis)
      
      // Auto-generate suggestions after analysis
      await generateSuggestions(mockAnalysis)
      
    } catch (error) {
      toast.error("Failed to analyze reply")
    } finally {
      setIsAnalyzing(false)
    }
  }

  const generateSuggestions = async (replyAnalysis?: ReplyAnalysis) => {
    setIsGenerating(true)
    
    try {
      // Mock API call - replace with actual
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const mockSuggestions: ReplySuggestion[] = [
        {
          id: '1',
          suggestion_text: "Hi John,\n\nThank you for your interest! I'm happy to answer your questions:\n\n1. **Salesforce Integration**: We offer native bi-directional sync with Salesforce, including custom objects and fields. Setup takes about 30 minutes.\n\n2. **Implementation Timeline**: Most teams are fully operational within 2-3 days. We provide hands-on onboarding and training.\n\n3. **SaaS Case Studies**: Absolutely! I'll send over 3 relevant case studies showing 40%+ improvement in reply rates.\n\n4. **Pricing**: For 50 reps, it's $4,950/month with unlimited emails and full features.\n\nWould you like to see a personalized demo? I have slots available Tuesday at 2 PM or Wednesday at 10 AM EST.\n\nBest regards,\nSarah",
          tone: 'professional',
          length: 'medium',
          confidence_score: 0.95,
          model_used: 'gpt-4'
        },
        {
          id: '2',
          suggestion_text: "Hey John!\n\nGreat questions - sounds like you're really thinking this through. Here's the scoop:\n\n• Salesforce? We're best friends with it! Seamless sync, no headaches.\n• Timeline? You'll be up and running by Friday (seriously!)\n• Case studies? Got tons! Sending 3 that'll blow your mind.\n• 50 reps? $4,950/month - and worth every penny.\n\nLet's jump on a quick call and I'll show you exactly how it works. Tuesday 2 PM or Wednesday 10 AM?\n\nExcited to help you crush those sales goals!\n\nSarah",
          tone: 'friendly',
          length: 'short',
          confidence_score: 0.88,
          model_used: 'gpt-4'
        },
        {
          id: '3',
          suggestion_text: "Hi John,\n\nI appreciate you taking the time to outline your specific needs. Based on what you've shared about your CRM integration challenges, I believe we can definitely help.\n\nRegarding your questions:\n\n1. Our Salesforce integration is one of our strongest features - full bi-directional sync with real-time updates\n2. Implementation typically takes 2-3 business days with our guided setup\n3. I have several SaaS case studies that match your profile perfectly\n4. For 50 sales reps, the investment would be $4,950/month\n\nI'd love to walk you through a personalized demo where I can show you exactly how we'd solve your lead tracking challenges. Are you available for 30 minutes next Tuesday afternoon or Wednesday morning?\n\nLooking forward to connecting,\nSarah",
          tone: 'empathetic',
          length: 'medium',
          confidence_score: 0.91,
          model_used: 'gpt-4'
        }
      ]
      
      setSuggestions(mockSuggestions)
      setSelectedSuggestion(mockSuggestions[0])
      setEditedReply(mockSuggestions[0].suggestion_text)
      
    } catch (error) {
      toast.error("Failed to generate suggestions")
    } finally {
      setIsGenerating(false)
    }
  }

  const sendReply = async () => {
    if (!editedReply.trim()) {
      toast.error("Please enter a reply message")
      return
    }
    
    try {
      // API call would go here
      toast.success("Reply sent successfully!")
      
      // Clear selection
      setSelectedMessage(null)
      setAnalysis(null)
      setSuggestions([])
      setSelectedSuggestion(null)
      setEditedReply("")
      
    } catch (error) {
      toast.error("Failed to send reply")
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success("Copied to clipboard")
  }

  const provideFeedback = async (suggestionId: string, positive: boolean) => {
    try {
      // API call would go here
      toast.success(`Feedback recorded: ${positive ? 'Positive' : 'Negative'}`)
    } catch (error) {
      toast.error("Failed to record feedback")
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bot className="w-8 h-8" />
            AI Reply Assistant
          </h1>
          <p className="text-muted-foreground">Intelligent responses powered by AI</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="outline">
            <BarChart3 className="w-4 h-4 mr-2" />
            Analytics
          </Button>
          <Button variant="outline">
            <Zap className="w-4 h-4 mr-2" />
            Templates
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Inbox Messages */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Reply Inbox</CardTitle>
              <CardDescription>Messages awaiting responses</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[600px]">
                <div className="divide-y">
                  {inboxMessages.map((message) => {
                    const isSelected = selectedMessage?.id === message.id
                    
                    return (
                      <div
                        key={message.id}
                        className={`p-4 cursor-pointer hover:bg-accent transition-colors ${
                          isSelected ? 'bg-accent' : ''
                        }`}
                        onClick={() => analyzeReply(message)}
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-medium">{message.lead.name}</h4>
                              <p className="text-sm text-muted-foreground">{message.lead.company}</p>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {new Date(message.received_at).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-sm font-medium">{message.subject}</p>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {message.content}
                          </p>
                          <Badge variant="secondary" className="text-xs">
                            {message.campaign.name}
                          </Badge>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Reply Assistant */}
        <div className="lg:col-span-2 space-y-6">
          {selectedMessage ? (
            <>
              {/* Original Message */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Original Message</CardTitle>
                      <CardDescription>
                        From {selectedMessage.lead.name} at {selectedMessage.lead.company}
                      </CardDescription>
                    </div>
                    {analysis && (
                      <div className="flex items-center gap-2">
                        {(() => {
                          const config = INTENT_CONFIG[analysis.detected_intent as keyof typeof INTENT_CONFIG]
                          const Icon = config?.icon || MessageSquare
                          return (
                            <Badge className={`${config?.color || 'bg-gray-400'} text-white`}>
                              <Icon className="w-3 h-3 mr-1" />
                              {config?.label || 'Unknown'}
                            </Badge>
                          )
                        })()}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="outline">
                                {Math.round(analysis.intent_confidence * 100)}% confident
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>AI confidence in intent detection</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="whitespace-pre-wrap text-sm">
                      {selectedMessage.content}
                    </div>
                    
                    {isAnalyzing && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Brain className="w-4 h-4 animate-pulse" />
                          Analyzing message...
                        </div>
                        <Progress value={66} className="h-2" />
                      </div>
                    )}
                    
                    {analysis && !isAnalyzing && (
                      <div className="space-y-3 pt-4 border-t">
                        {/* Sentiment */}
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">Sentiment:</span>
                          <div className="flex items-center gap-1">
                            <div className={`w-3 h-3 rounded-full ${
                              analysis.sentiment_score > 0.3 ? 'bg-green-500' :
                              analysis.sentiment_score < -0.3 ? 'bg-red-500' :
                              'bg-yellow-500'
                            }`} />
                            <span className="text-sm">
                              {analysis.sentiment_score > 0.3 ? 'Positive' :
                               analysis.sentiment_score < -0.3 ? 'Negative' :
                               'Neutral'}
                            </span>
                          </div>
                        </div>
                        
                        {/* Questions Detected */}
                        {analysis.questions_detected.length > 0 && (
                          <div>
                            <span className="text-sm font-medium">Questions detected:</span>
                            <ul className="mt-1 space-y-1">
                              {analysis.questions_detected.map((question, index) => (
                                <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                                  <HelpCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                  {question}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {/* Urgency */}
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">Urgency:</span>
                          <div className="flex gap-0.5">
                            {[...Array(5)].map((_, i) => (
                              <div
                                key={i}
                                className={`w-2 h-2 rounded-full ${
                                  i < analysis.urgency_level ? 'bg-orange-500' : 'bg-gray-300'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            Level {analysis.urgency_level}/5
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* AI Suggestions */}
              {suggestions.length > 0 && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>AI-Generated Suggestions</CardTitle>
                        <CardDescription>Choose or customize a response</CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generateSuggestions(analysis || undefined)}
                        disabled={isGenerating}
                      >
                        <RefreshCw className={`w-4 h-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
                        Regenerate
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Tone Selection */}
                      <div>
                        <Label>Reply Tone</Label>
                        <RadioGroup
                          value={selectedSuggestion?.tone || preferredTone}
                          onValueChange={(value) => {
                            setPreferredTone(value)
                            const suggestion = suggestions.find(s => s.tone === value)
                            if (suggestion) {
                              setSelectedSuggestion(suggestion)
                              setEditedReply(suggestion.suggestion_text)
                            }
                          }}
                        >
                          <div className="grid grid-cols-2 gap-3 mt-2">
                            {TONE_OPTIONS.map((tone) => (
                              <div key={tone.value} className="relative">
                                <RadioGroupItem
                                  value={tone.value}
                                  id={tone.value}
                                  className="peer sr-only"
                                />
                                <Label
                                  htmlFor={tone.value}
                                  className="flex flex-col gap-1 rounded-lg border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer"
                                >
                                  <span className="font-medium">{tone.label}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {tone.description}
                                  </span>
                                </Label>
                              </div>
                            ))}
                          </div>
                        </RadioGroup>
                      </div>

                      {/* Selected Suggestion */}
                      {selectedSuggestion && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">
                                {selectedSuggestion.tone}
                              </Badge>
                              <Badge variant="outline">
                                {selectedSuggestion.model_used}
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                {Math.round(selectedSuggestion.confidence_score * 100)}% confidence
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(selectedSuggestion.suggestion_text)}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                          
                          <Textarea
                            value={editedReply}
                            onChange={(e) => setEditedReply(e.target.value)}
                            placeholder="Edit the suggestion..."
                            className="min-h-[200px] font-mono text-sm"
                          />
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => provideFeedback(selectedSuggestion.id, true)}
                              >
                                <ThumbsUp className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => provideFeedback(selectedSuggestion.id, false)}
                              >
                                <ThumbsDown className="w-4 h-4" />
                              </Button>
                            </div>
                            
                            <Button onClick={sendReply}>
                              <Send className="w-4 h-4 mr-2" />
                              Send Reply
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Custom Instructions */}
                      <div>
                        <Label htmlFor="custom-instructions">Custom Instructions (Optional)</Label>
                        <Textarea
                          id="custom-instructions"
                          value={customInstructions}
                          onChange={(e) => setCustomInstructions(e.target.value)}
                          placeholder="Add any specific instructions for the AI..."
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card className="h-[600px] flex items-center justify-center">
              <div className="text-center space-y-4">
                <Bot className="w-16 h-16 mx-auto text-muted-foreground" />
                <div>
                  <h3 className="font-medium">Select a message to get started</h3>
                  <p className="text-sm text-muted-foreground">
                    The AI will analyze the reply and generate intelligent responses
                  </p>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}