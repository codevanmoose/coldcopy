'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Brain,
  Activity,
  Target,
  Users,
  Building2,
  Mail,
  MessageSquare,
  Phone,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  Info,
  Zap,
  Star,
  BarChart3,
  PieChart,
  ArrowUp,
  ArrowDown,
  ChevronRight,
  Filter,
  Download,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart as RePieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts'
import { leadScoringService, LeadScore, LeadInsight, NextBestAction, BuyingSignal } from '@/lib/intelligence/lead-scoring-service'
import { api } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'
import { formatDistanceToNow, format } from 'date-fns'

interface LeadIntelligenceDashboardProps {
  leadId?: string
  onSelectLead?: (leadId: string) => void
}

export function LeadIntelligenceDashboard({ leadId, onSelectLead }: LeadIntelligenceDashboardProps) {
  const { user } = useAuth()
  const [leads, setLeads] = useState<any[]>([])
  const [selectedLead, setSelectedLead] = useState<any>(null)
  const [leadScore, setLeadScore] = useState<LeadScore | null>(null)
  const [insights, setInsights] = useState<LeadInsight[]>([])
  const [nextBestActions, setNextBestActions] = useState<NextBestAction[]>([])
  const [buyingSignals, setBuyingSignals] = useState<BuyingSignal[]>([])
  const [scoreHistory, setScoreHistory] = useState<any[]>([])
  const [prioritizedLeads, setPrioritizedLeads] = useState<any[]>([])
  const [companyIntelligence, setCompanyIntelligence] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [searchTerm, setSearchTerm] = useState('')
  const [scoreFilter, setScoreFilter] = useState('all')

  useEffect(() => {
    if (user?.workspaceId) {
      loadData()
    }
  }, [user?.workspaceId, leadId])

  const loadData = async () => {
    if (!user?.workspaceId) return

    setIsLoading(true)
    try {
      // Load prioritized leads
      const prioritizedRes = await leadScoringService.prioritizeLeads(user.workspaceId, {
        limit: 100,
        includeReasons: true,
      })
      setPrioritizedLeads(prioritizedRes.prioritizedLeads)

      // Load leads list
      const leadsRes = await api.leads.list(user.workspaceId, { limit: 100 })
      if (leadsRes.data?.leads) {
        setLeads(leadsRes.data.leads)
      }

      // If leadId is provided or select first lead
      const targetLeadId = leadId || prioritizedRes.prioritizedLeads[0]?.leadId
      if (targetLeadId) {
        await loadLeadIntelligence(targetLeadId)
      }
    } catch (error) {
      console.error('Error loading intelligence data:', error)
      toast.error('Failed to load intelligence data')
    } finally {
      setIsLoading(false)
    }
  }

  const loadLeadIntelligence = async (leadId: string) => {
    if (!user?.workspaceId) return

    setIsRefreshing(true)
    try {
      // Load lead details
      const leadRes = await api.leads.get(user.workspaceId, leadId)
      if (leadRes.data) {
        setSelectedLead(leadRes.data)
      }

      // Load lead score
      const score = await leadScoringService.calculateLeadScore(user.workspaceId, leadId, {
        includeHistory: true,
        includePredictive: true,
        includeInsights: true,
      })
      setLeadScore(score)

      // Load insights and recommendations
      const insightsRes = await leadScoringService.generateLeadInsights(user.workspaceId, leadId, {
        includeRecommendations: true,
        includeNextBestActions: true,
      })
      setInsights(insightsRes.insights)
      setNextBestActions(insightsRes.nextBestActions)

      // Load buying signals
      const signals = await leadScoringService.detectBuyingSignals(user.workspaceId, leadId)
      setBuyingSignals(signals)

      // Load score history
      const history = await leadScoringService.getScoreHistory(user.workspaceId, leadId, {
        interval: 'daily',
      })
      setScoreHistory(history.history.map(h => ({
        date: format(new Date(h.timestamp), 'MMM d'),
        score: h.score,
        change: h.change,
      })))

      // Load company intelligence if available
      if (selectedLead?.company) {
        const companyData = await leadScoringService.getCompanyIntelligence(
          user.workspaceId,
          selectedLead.company,
          {
            includeNews: true,
            includeFunding: true,
            includeDecisionMakers: true,
            includeTechnologies: true,
          }
        )
        setCompanyIntelligence(companyData)
      }

      onSelectLead?.(leadId)
    } catch (error) {
      console.error('Error loading lead intelligence:', error)
      toast.error('Failed to load lead intelligence')
    } finally {
      setIsRefreshing(false)
    }
  }

  const refreshScore = async () => {
    if (!selectedLead || !user?.workspaceId) return
    await loadLeadIntelligence(selectedLead.id)
    toast.success('Lead score refreshed')
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-blue-600'
    if (score >= 40) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getScoreTrend = (score: LeadScore) => {
    if (!score.scoreHistory || score.scoreHistory.length < 2) return null
    
    const recent = score.scoreHistory[score.scoreHistory.length - 1]
    const previous = score.scoreHistory[score.scoreHistory.length - 2]
    const change = recent.score - previous.score
    
    if (change > 5) return { icon: TrendingUp, color: 'text-green-600', text: `+${change}` }
    if (change < -5) return { icon: TrendingDown, color: 'text-red-600', text: `${change}` }
    return { icon: Minus, color: 'text-gray-600', text: '0' }
  }

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'positive': return CheckCircle
      case 'negative': return XCircle
      case 'warning': return AlertCircle
      case 'opportunity': return Zap
      default: return Info
    }
  }

  const getActionIcon = (channel: string) => {
    switch (channel) {
      case 'email': return Mail
      case 'linkedin': return MessageSquare
      case 'phone': return Phone
      case 'meeting': return Calendar
      default: return Zap
    }
  }

  const filteredPrioritizedLeads = prioritizedLeads.filter(lead => {
    const matchesSearch = lead.leadName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         lead.company.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesScore = scoreFilter === 'all' ||
                        (scoreFilter === 'hot' && lead.score >= 80) ||
                        (scoreFilter === 'warm' && lead.score >= 60 && lead.score < 80) ||
                        (scoreFilter === 'cold' && lead.score < 60)
    return matchesSearch && matchesScore
  })

  // Chart data preparation
  const scoreBreakdownData = leadScore ? [
    { name: 'Demographic', value: leadScore.scoreBreakdown.demographic, color: '#3B82F6' },
    { name: 'Firmographic', value: leadScore.scoreBreakdown.firmographic, color: '#8B5CF6' },
    { name: 'Behavioral', value: leadScore.scoreBreakdown.behavioral, color: '#10B981' },
    { name: 'Engagement', value: leadScore.scoreBreakdown.engagement, color: '#F59E0B' },
    { name: 'Intent', value: leadScore.scoreBreakdown.intent, color: '#EF4444' },
  ] : []

  const radarData = leadScore ? [
    {
      category: 'Profile',
      score: leadScore.profileScore,
      fullMark: 100,
    },
    {
      category: 'Engagement',
      score: leadScore.engagementScore,
      fullMark: 100,
    },
    {
      category: 'Behavior',
      score: leadScore.behaviorScore,
      fullMark: 100,
    },
    {
      category: 'Intent',
      score: leadScore.intentScore,
      fullMark: 100,
    },
    {
      category: 'Fit',
      score: leadScore.fitScore,
      fullMark: 100,
    },
  ] : []

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Lead Intelligence</h1>
          <p className="text-gray-600">AI-powered lead scoring and insights</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={refreshScore}
            disabled={isRefreshing || !selectedLead}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lead List */}
        <div className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg">Prioritized Leads</CardTitle>
              <div className="flex gap-2 mt-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search leads..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={scoreFilter} onValueChange={setScoreFilter}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="hot">Hot</SelectItem>
                    <SelectItem value="warm">Warm</SelectItem>
                    <SelectItem value="cold">Cold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[600px]">
                <div className="space-y-1 p-4">
                  {filteredPrioritizedLeads.map((lead) => (
                    <div
                      key={lead.leadId}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedLead?.id === lead.leadId
                          ? 'bg-blue-50 border border-blue-200'
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => loadLeadIntelligence(lead.leadId)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-medium text-sm">{lead.leadName}</div>
                        <div className={`text-2xl font-bold ${getScoreColor(lead.score)}`}>
                          {lead.score}
                        </div>
                      </div>
                      <div className="text-xs text-gray-600">{lead.company}</div>
                      <div className="flex items-center justify-between mt-2">
                        <Badge
                          variant={
                            lead.priority === 'critical' ? 'destructive' :
                            lead.priority === 'high' ? 'default' :
                            lead.priority === 'medium' ? 'secondary' :
                            'outline'
                          }
                          className="text-xs"
                        >
                          {lead.priority}
                        </Badge>
                        <div className="text-xs text-gray-500">
                          {formatDistanceToNow(new Date(lead.lastActivity))} ago
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Lead Intelligence */}
        <div className="lg:col-span-2">
          {selectedLead && leadScore ? (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="insights">Insights</TabsTrigger>
                <TabsTrigger value="signals">Buying Signals</TabsTrigger>
                <TabsTrigger value="history">Score History</TabsTrigger>
                <TabsTrigger value="company">Company Intel</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-6">
                {/* Lead Header */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-16 w-16">
                          <AvatarImage src={`https://ui-avatars.com/api/?name=${selectedLead.first_name}+${selectedLead.last_name}`} />
                          <AvatarFallback>
                            {selectedLead.first_name?.[0]}{selectedLead.last_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h2 className="text-xl font-bold">
                            {selectedLead.first_name} {selectedLead.last_name}
                          </h2>
                          <p className="text-gray-600">{selectedLead.title}</p>
                          <p className="text-sm text-gray-500">{selectedLead.company}</p>
                        </div>
                      </div>
                      <div className="text-center">
                        <div className={`text-4xl font-bold ${getScoreColor(leadScore.totalScore)}`}>
                          {leadScore.totalScore}
                        </div>
                        <div className="text-sm text-gray-500">Lead Score</div>
                        {getScoreTrend(leadScore) && (
                          <div className={`flex items-center gap-1 mt-1 ${getScoreTrend(leadScore)!.color}`}>
                            {React.createElement(getScoreTrend(leadScore)!.icon, { className: 'h-4 w-4' })}
                            <span className="text-sm">{getScoreTrend(leadScore)!.text}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4 mt-6">
                      <div className="text-center">
                        <Badge variant={leadScore.isHot ? 'destructive' : 'outline'}>
                          {leadScore.isHot ? 'Hot Lead' : 'Not Hot'}
                        </Badge>
                      </div>
                      <div className="text-center">
                        <Badge variant={leadScore.isQualified ? 'default' : 'outline'}>
                          {leadScore.isQualified ? 'Qualified' : 'Not Qualified'}
                        </Badge>
                      </div>
                      <div className="text-center">
                        <Badge variant={leadScore.isEngaged ? 'secondary' : 'outline'}>
                          {leadScore.isEngaged ? 'Engaged' : 'Not Engaged'}
                        </Badge>
                      </div>
                      <div className="text-center">
                        <Badge variant={leadScore.requiresNurturing ? 'outline' : 'secondary'}>
                          {leadScore.requiresNurturing ? 'Needs Nurturing' : 'Sales Ready'}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Score Components */}
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Score Components</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={200}>
                        <RadarChart data={radarData}>
                          <PolarGrid />
                          <PolarAngleAxis dataKey="category" />
                          <PolarRadiusAxis angle={90} domain={[0, 100]} />
                          <Radar
                            name="Score"
                            dataKey="score"
                            stroke="#3B82F6"
                            fill="#3B82F6"
                            fillOpacity={0.6}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Score Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={200}>
                        <RePieChart>
                          <Pie
                            data={scoreBreakdownData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {scoreBreakdownData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </RePieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>

                {/* Predictive Analytics */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      Predictive Analytics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div>
                        <div className="text-2xl font-bold text-green-600">
                          {(leadScore.predictiveScores.conversionProbability * 100).toFixed(1)}%
                        </div>
                        <div className="text-xs text-gray-500">Conversion Probability</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-blue-600">
                          ${(leadScore.predictiveScores.dealSize / 1000).toFixed(0)}k
                        </div>
                        <div className="text-xs text-gray-500">Expected Deal Size</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-purple-600">
                          {leadScore.predictiveScores.timeToClose} days
                        </div>
                        <div className="text-xs text-gray-500">Time to Close</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-yellow-600">
                          {(leadScore.predictiveScores.churnRisk * 100).toFixed(1)}%
                        </div>
                        <div className="text-xs text-gray-500">Churn Risk</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-indigo-600">
                          ${(leadScore.predictiveScores.lifetimeValue / 1000).toFixed(0)}k
                        </div>
                        <div className="text-xs text-gray-500">Lifetime Value</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Next Best Actions */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Recommended Actions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {nextBestActions.slice(0, 3).map((action) => {
                        const ActionIcon = getActionIcon(action.channel)
                        return (
                          <div key={action.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${
                                action.priority === 'high' ? 'bg-red-100' :
                                action.priority === 'medium' ? 'bg-yellow-100' :
                                'bg-green-100'
                              }`}>
                                <ActionIcon className="h-4 w-4" />
                              </div>
                              <div>
                                <div className="font-medium text-sm">{action.action}</div>
                                <div className="text-xs text-gray-600">{action.reason}</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge variant={
                                action.timing === 'immediate' ? 'destructive' :
                                action.timing === 'today' ? 'default' :
                                'secondary'
                              }>
                                {action.timing}
                              </Badge>
                              <div className="text-xs text-gray-500 mt-1">
                                {(action.confidence * 100).toFixed(0)}% confidence
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Insights Tab */}
              <TabsContent value="insights" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Lead Insights & Recommendations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {insights.map((insight) => {
                        const InsightIcon = getInsightIcon(insight.type)
                        return (
                          <div key={insight.id} className="border rounded-lg p-4">
                            <div className="flex items-start gap-3">
                              <div className={`mt-1 ${
                                insight.type === 'positive' ? 'text-green-600' :
                                insight.type === 'negative' ? 'text-red-600' :
                                insight.type === 'warning' ? 'text-yellow-600' :
                                insight.type === 'opportunity' ? 'text-purple-600' :
                                'text-gray-600'
                              }`}>
                                <InsightIcon className="h-5 w-5" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <h4 className="font-medium">{insight.title}</h4>
                                  <Badge variant={
                                    insight.importance === 'high' ? 'destructive' :
                                    insight.importance === 'medium' ? 'default' :
                                    'secondary'
                                  }>
                                    {insight.importance}
                                  </Badge>
                                </div>
                                <p className="text-sm text-gray-600 mb-2">{insight.description}</p>
                                {insight.actionable && insight.suggestedAction && (
                                  <Alert className="mt-3">
                                    <AlertDescription className="text-sm">
                                      <strong>Suggested Action:</strong> {insight.suggestedAction}
                                    </AlertDescription>
                                  </Alert>
                                )}
                                <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                                  <span>{insight.category}</span>
                                  <span>•</span>
                                  <span>{formatDistanceToNow(new Date(insight.timestamp))} ago</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {leadScore.recommendations.length > 0 && (
                      <>
                        <Separator className="my-6" />
                        <div>
                          <h4 className="font-medium mb-3">General Recommendations</h4>
                          <div className="space-y-2">
                            {leadScore.recommendations.map((rec, index) => (
                              <div key={index} className="flex items-start gap-2">
                                <ChevronRight className="h-4 w-4 text-gray-400 mt-0.5" />
                                <p className="text-sm text-gray-600">{rec}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Buying Signals Tab */}
              <TabsContent value="signals" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Buying Signals & Intent Data</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {buyingSignals.map((signal) => (
                        <div key={signal.id} className="border rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant={
                                  signal.signalType === 'high_intent' ? 'destructive' :
                                  signal.signalType === 'medium_intent' ? 'default' :
                                  signal.signalType === 'low_intent' ? 'secondary' :
                                  'outline'
                                }>
                                  {signal.signalType.replace('_', ' ')}
                                </Badge>
                                <h4 className="font-medium">{signal.signalName}</h4>
                              </div>
                              <p className="text-sm text-gray-600">{signal.description}</p>
                              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                <span>Source: {signal.source}</span>
                                <span>•</span>
                                <span>{(signal.confidence * 100).toFixed(0)}% confidence</span>
                                <span>•</span>
                                <span>{formatDistanceToNow(new Date(signal.timestamp))} ago</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}

                      {buyingSignals.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                          No buying signals detected yet
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Score History Tab */}
              <TabsContent value="history" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Score History & Trends</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={scoreHistory}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis domain={[0, 100]} />
                        <Tooltip />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="score"
                          stroke="#3B82F6"
                          strokeWidth={2}
                          dot={{ fill: '#3B82F6' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>

                    <div className="mt-6 space-y-4">
                      <h4 className="font-medium">Key Score Changes</h4>
                      {leadScore.positiveFactors.length > 0 && (
                        <div>
                          <h5 className="text-sm font-medium text-green-600 mb-2">Positive Factors</h5>
                          <div className="space-y-2">
                            {leadScore.positiveFactors.map((factor, index) => (
                              <div key={index} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                  <ArrowUp className="h-4 w-4 text-green-600" />
                                  <span>{factor.factor}</span>
                                </div>
                                <span className="text-green-600 font-medium">+{factor.impact}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {leadScore.negativeFactors.length > 0 && (
                        <div>
                          <h5 className="text-sm font-medium text-red-600 mb-2">Negative Factors</h5>
                          <div className="space-y-2">
                            {leadScore.negativeFactors.map((factor, index) => (
                              <div key={index} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                  <ArrowDown className="h-4 w-4 text-red-600" />
                                  <span>{factor.factor}</span>
                                </div>
                                <span className="text-red-600 font-medium">{factor.impact}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Company Intelligence Tab */}
              <TabsContent value="company" className="space-y-4">
                {companyIntelligence ? (
                  <>
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Building2 className="h-5 w-5" />
                          {companyIntelligence.companyName}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="text-sm text-gray-500">Industry</div>
                            <div className="font-medium">{companyIntelligence.industry}</div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-500">Company Size</div>
                            <div className="font-medium">{companyIntelligence.size}</div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-500">Revenue</div>
                            <div className="font-medium">
                              ${(companyIntelligence.revenue / 1000000).toFixed(1)}M
                            </div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-500">Growth Rate</div>
                            <div className="font-medium">{companyIntelligence.growthRate}%</div>
                          </div>
                        </div>

                        <Separator className="my-4" />

                        <div>
                          <h4 className="font-medium mb-2">Technologies Used</h4>
                          <div className="flex flex-wrap gap-2">
                            {companyIntelligence.technologies.map((tech: string) => (
                              <Badge key={tech} variant="secondary">{tech}</Badge>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {companyIntelligence.decisionMakers?.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Decision Makers</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {companyIntelligence.decisionMakers.map((person: any, index: number) => (
                              <div key={index} className="flex items-center justify-between">
                                <div>
                                  <div className="font-medium">{person.name}</div>
                                  <div className="text-sm text-gray-600">{person.title}</div>
                                  <div className="text-xs text-gray-500">{person.department}</div>
                                </div>
                                <Badge variant="outline">
                                  Influence: {person.influence}/10
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {companyIntelligence.recentNews?.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Recent News</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {companyIntelligence.recentNews.map((news: any, index: number) => (
                              <div key={index} className="border-b last:border-0 pb-3 last:pb-0">
                                <h5 className="font-medium text-sm">{news.title}</h5>
                                <p className="text-xs text-gray-600 mt-1">{news.description}</p>
                                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                  <Badge variant={
                                    news.sentiment === 'positive' ? 'default' :
                                    news.sentiment === 'negative' ? 'destructive' :
                                    'secondary'
                                  }>
                                    {news.sentiment}
                                  </Badge>
                                  <span>{format(new Date(news.publishedAt), 'MMM d, yyyy')}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </>
                ) : (
                  <Card>
                    <CardContent className="text-center py-12">
                      <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2">No Company Intelligence</h3>
                      <p className="text-gray-600">
                        Company information not available for this lead
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Select a Lead</h3>
                <p className="text-gray-600">
                  Choose a lead from the list to view intelligence data
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}