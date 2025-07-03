'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { 
  Shield,
  Mail,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Eye,
  Settings,
  Download,
  Upload,
  Search,
  Filter,
  AlertCircle,
  Info,
  ExternalLink,
  RefreshCw,
  Zap
} from 'lucide-react'
import { SpamChecker } from '@/lib/deliverability/spam-checker'
import { DNSChecker } from '@/lib/deliverability/dns-checker'
import { useAuthStore } from '@/stores/auth'

interface DeliverabilityStats {
  overallScore: number
  emailsSent: number
  delivered: number
  bounced: number
  complained: number
  deliveryRate: number
  bounceRate: number
  complaintRate: number
  reputation: 'excellent' | 'good' | 'fair' | 'poor'
  domainPerformance?: Array<{
    domain: string
    sent: number
    delivered: number
    bounced: number
    rate: number
  }>
  suppressionStats?: {
    totalSuppressed: number
    hardBounces: number
    softBounces: number
    complaints: number
    unsubscribes: number
    manual: number
  }
}

export function DeliverabilityDashboard() {
  const [activeTab, setActiveTab] = useState('overview')
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [stats, setStats] = useState<DeliverabilityStats>({
    overallScore: 0,
    emailsSent: 0,
    delivered: 0,
    bounced: 0,
    complained: 0,
    deliveryRate: 0,
    bounceRate: 0,
    complaintRate: 0,
    reputation: 'fair'
  })

  // Spam Check State
  const [spamCheckEmail, setSpamCheckEmail] = useState({
    subject: 'Quick question about {{company}}',
    body: 'Hi {{first_name}},\n\nI noticed that {{company}} is expanding rapidly. I\'d love to show you how we\'ve helped similar companies reduce their operational costs by 30%.\n\nWould you be open to a quick 15-minute call this week?\n\nBest regards,\nJohn Smith',
    fromName: 'John Smith',
    fromEmail: 'john@example.com'
  })
  const [spamResult, setSpamResult] = useState<any>(null)

  // DNS Check State
  const [dnsCheckDomain, setDnsCheckDomain] = useState('example.com')
  const [dnsResult, setDnsResult] = useState<any>(null)

  // Get workspace ID from auth store
  const { selectedWorkspace } = useAuthStore()
  
  // Fetch deliverability stats
  useEffect(() => {
    const fetchStats = async () => {
      if (!selectedWorkspace?.id) return
      
      setIsLoading(true)
      try {
        const response = await fetch(`/api/deliverability/stats?workspace_id=${selectedWorkspace.id}&period=30d`)
        if (response.ok) {
          const data = await response.json()
          setStats(data)
        } else {
          console.error('Failed to fetch deliverability stats')
        }
      } catch (error) {
        console.error('Error fetching deliverability stats:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchStats()
  }, [selectedWorkspace?.id])
  
  const handleRefresh = async () => {
    if (!selectedWorkspace?.id) return
    
    setIsRefreshing(true)
    try {
      const response = await fetch(`/api/deliverability/stats?workspace_id=${selectedWorkspace.id}&period=30d`)
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Error refreshing stats:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleSpamCheck = async () => {
    setIsLoading(true)
    try {
      const result = SpamChecker.analyzeSpamScore(spamCheckEmail)
      setSpamResult(result)
    } catch (error) {
      console.error('Error checking spam score:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDNSCheck = async () => {
    setIsLoading(true)
    try {
      const result = await DNSChecker.checkDomainAuthentication(dnsCheckDomain)
      setDnsResult(result)
    } catch (error) {
      console.error('Error checking DNS:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getScoreBadge = (score: number) => {
    if (score >= 80) return <Badge className="bg-green-500">Excellent</Badge>
    if (score >= 60) return <Badge className="bg-yellow-500">Good</Badge>
    return <Badge variant="destructive">Needs Improvement</Badge>
  }

  const getReputationIcon = (reputation: string) => {
    switch (reputation) {
      case 'excellent': return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'good': return <CheckCircle className="h-5 w-5 text-blue-500" />
      case 'fair': return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      case 'poor': return <XCircle className="h-5 w-5 text-red-500" />
      default: return <AlertTriangle className="h-5 w-5 text-gray-500" />
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight flex items-center">
            <Shield className="h-8 w-8 mr-3 text-primary" />
            Email Deliverability
          </h1>
          <p className="text-xl text-muted-foreground mt-2">
            Monitor and optimize your email delivery performance
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
          <Button onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh Data
          </Button>
        </div>
      </div>

      {/* Show loading state for initial load */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-3 text-muted-foreground">Loading deliverability data...</span>
        </div>
      ) : (
        <>
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${getScoreColor(stats.overallScore)}`}>
              {stats.overallScore}%
            </div>
            <div className="mt-2">
              {getScoreBadge(stats.overallScore)}
            </div>
            <Progress value={stats.overallScore} className="mt-3" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivery Rate</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {stats.deliveryRate}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.delivered.toLocaleString()} of {stats.emailsSent.toLocaleString()} delivered
            </p>
            <Progress value={stats.deliveryRate} className="mt-3" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bounce Rate</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${stats.bounceRate > 5 ? 'text-red-600' : 'text-green-600'}`}>
              {stats.bounceRate}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.bounced.toLocaleString()} bounced emails
            </p>
            <Progress value={stats.bounceRate} className="mt-3" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sender Reputation</CardTitle>
            {getReputationIcon(stats.reputation)}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">
              {stats.reputation}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Complaint rate: {stats.complaintRate}%
            </p>
            <Badge variant="outline" className="mt-2">
              {stats.complained} complaints
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="spam-check">Spam Check</TabsTrigger>
          <TabsTrigger value="dns-auth">DNS & Auth</TabsTrigger>
          <TabsTrigger value="suppression">Suppression List</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Issues */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <AlertTriangle className="h-5 w-5 mr-2 text-yellow-500" />
                  Recent Issues
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>High Bounce Rate Detected</AlertTitle>
                  <AlertDescription>
                    Campaign "Q4 Outreach" has a 8.2% bounce rate. Consider reviewing your email list quality.
                  </AlertDescription>
                </Alert>
                
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>DKIM Configuration</AlertTitle>
                  <AlertDescription>
                    Your DKIM record expires in 30 days. Update your DNS settings to maintain authentication.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Zap className="h-5 w-5 mr-2 text-blue-500" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full justify-start" variant="outline">
                  <Shield className="h-4 w-4 mr-2" />
                  Check Email Authentication
                </Button>
                <Button className="w-full justify-start" variant="outline">
                  <Search className="h-4 w-4 mr-2" />
                  Test Email Deliverability
                </Button>
                <Button className="w-full justify-start" variant="outline">
                  <Filter className="h-4 w-4 mr-2" />
                  Review Suppression List
                </Button>
                <Button className="w-full justify-start" variant="outline">
                  <Settings className="h-4 w-4 mr-2" />
                  Configure DNS Records
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Domain Performance */}
          <Card>
            <CardHeader>
              <CardTitle>Domain Performance</CardTitle>
              <CardDescription>
                Email performance breakdown by recipient domain
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(stats.domainPerformance || []).length > 0 ? (
                  stats.domainPerformance?.map((domain, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="font-medium">{domain.domain}</div>
                      <Badge variant="outline">{domain.sent.toLocaleString()} sent</Badge>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className={`text-sm font-medium ${domain.rate >= 97 ? 'text-green-600' : domain.rate >= 95 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {domain.rate}% delivered
                      </div>
                      <Progress value={domain.rate} className="w-24" />
                    </div>
                  </div>
                ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No email data available yet</p>
                    <p className="text-sm mt-2">Start sending campaigns to see domain performance metrics</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Spam Check Tab */}
        <TabsContent value="spam-check" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Mail className="h-5 w-5 mr-2" />
                Email Spam Check
              </CardTitle>
              <CardDescription>
                Analyze your email content for spam triggers and deliverability issues
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Email Input */}
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">From Name</label>
                    <Input
                      value={spamCheckEmail.fromName}
                      onChange={(e) => setSpamCheckEmail(prev => ({ ...prev, fromName: e.target.value }))}
                      placeholder="John Smith"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">From Email</label>
                    <Input
                      value={spamCheckEmail.fromEmail}
                      onChange={(e) => setSpamCheckEmail(prev => ({ ...prev, fromEmail: e.target.value }))}
                      placeholder="john@example.com"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">Subject Line</label>
                    <Input
                      value={spamCheckEmail.subject}
                      onChange={(e) => setSpamCheckEmail(prev => ({ ...prev, subject: e.target.value }))}
                      placeholder="Email subject..."
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">Email Body</label>
                    <Textarea
                      value={spamCheckEmail.body}
                      onChange={(e) => setSpamCheckEmail(prev => ({ ...prev, body: e.target.value }))}
                      rows={10}
                      placeholder="Email content..."
                    />
                  </div>
                  
                  <Button onClick={handleSpamCheck} disabled={isLoading} className="w-full">
                    {isLoading ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Search className="h-4 w-4 mr-2" />
                        Check Spam Score
                      </>
                    )}
                  </Button>
                </div>

                {/* Results */}
                <div className="space-y-4">
                  {spamResult ? (
                    <>
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center justify-between">
                            Spam Score
                            <span className={`text-2xl font-bold ${getScoreColor(100 - spamResult.score)}`}>
                              {spamResult.score}/100
                            </span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span>Risk Level:</span>
                              <Badge variant={spamResult.level === 'low' ? 'default' : spamResult.level === 'medium' ? 'secondary' : 'destructive'}>
                                {spamResult.level.toUpperCase()}
                              </Badge>
                            </div>
                            <div className="flex justify-between">
                              <span>Word Count:</span>
                              <span>{spamResult.wordCount}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Readability:</span>
                              <span>{spamResult.readabilityScore}</span>
                            </div>
                          </div>
                          <Progress value={100 - spamResult.score} className="mt-4" />
                        </CardContent>
                      </Card>

                      {spamResult.issues.length > 0 && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-red-600">Issues Found</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              {spamResult.issues.map((issue: any, index: number) => (
                                <Alert key={index} variant={issue.severity === 'high' ? 'destructive' : 'default'}>
                                  <AlertTriangle className="h-4 w-4" />
                                  <AlertDescription>{issue.message}</AlertDescription>
                                </Alert>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {spamResult.suggestions.length > 0 && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-blue-600">Suggestions</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ul className="space-y-2">
                              {spamResult.suggestions.map((suggestion: string, index: number) => (
                                <li key={index} className="flex items-start">
                                  <CheckCircle className="h-4 w-4 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
                                  <span className="text-sm">{suggestion}</span>
                                </li>
                              ))}
                            </ul>
                          </CardContent>
                        </Card>
                      )}
                    </>
                  ) : (
                    <Card>
                      <CardContent className="py-12 text-center text-muted-foreground">
                        <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Click "Check Spam Score" to analyze your email</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DNS Authentication Tab */}
        <TabsContent value="dns-auth" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="h-5 w-5 mr-2" />
                DNS Authentication Check
              </CardTitle>
              <CardDescription>
                Verify SPF, DKIM, and DMARC records for your domain
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex space-x-4">
                <Input
                  value={dnsCheckDomain}
                  onChange={(e) => setDnsCheckDomain(e.target.value)}
                  placeholder="example.com"
                  className="flex-1"
                />
                <Button onClick={handleDNSCheck} disabled={isLoading}>
                  {isLoading ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Check DNS
                    </>
                  )}
                </Button>
              </div>

              {dnsResult && (
                <div className="space-y-6">
                  {/* Overall Score */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        Overall Authentication Score
                        <span className={`text-3xl font-bold ${getScoreColor(dnsResult.overallScore)}`}>
                          {dnsResult.overallScore}%
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Progress value={dnsResult.overallScore} className="mb-4" />
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className={`text-lg font-bold ${getScoreColor(dnsResult.spf.score)}`}>
                            {dnsResult.spf.score}%
                          </div>
                          <div className="text-sm text-muted-foreground">SPF</div>
                        </div>
                        <div>
                          <div className={`text-lg font-bold ${getScoreColor(dnsResult.dkim.score)}`}>
                            {dnsResult.dkim.score}%
                          </div>
                          <div className="text-sm text-muted-foreground">DKIM</div>
                        </div>
                        <div>
                          <div className={`text-lg font-bold ${getScoreColor(dnsResult.dmarc.score)}`}>
                            {dnsResult.dmarc.score}%
                          </div>
                          <div className="text-sm text-muted-foreground">DMARC</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Recommendations */}
                  {dnsResult.recommendations.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Recommendations</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {dnsResult.recommendations.map((rec: string, index: number) => (
                            <Alert key={index}>
                              <AlertTriangle className="h-4 w-4" />
                              <AlertDescription>{rec}</AlertDescription>
                            </Alert>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Detailed Results */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* SPF */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          SPF Record
                          {dnsResult.spf.isValid ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500" />
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {dnsResult.spf.record && (
                          <div className="bg-gray-100 p-2 rounded text-xs font-mono">
                            {dnsResult.spf.record}
                          </div>
                        )}
                        <div className="text-sm">
                          <strong>Score:</strong> {dnsResult.spf.score}%
                        </div>
                        <div className="text-sm">
                          <strong>Recommendation:</strong> {dnsResult.spf.recommendation}
                        </div>
                      </CardContent>
                    </Card>

                    {/* DKIM */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          DKIM Record
                          {dnsResult.dkim.isValid ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500" />
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {dnsResult.dkim.selector && (
                          <div className="text-sm">
                            <strong>Selector:</strong> {dnsResult.dkim.selector}
                          </div>
                        )}
                        <div className="text-sm">
                          <strong>Score:</strong> {dnsResult.dkim.score}%
                        </div>
                        <div className="text-sm">
                          <strong>Recommendation:</strong> {dnsResult.dkim.recommendation}
                        </div>
                      </CardContent>
                    </Card>

                    {/* DMARC */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          DMARC Record
                          {dnsResult.dmarc.isValid ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500" />
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {dnsResult.dmarc.policy && (
                          <div className="text-sm">
                            <strong>Policy:</strong> {dnsResult.dmarc.policy}
                          </div>
                        )}
                        <div className="text-sm">
                          <strong>Score:</strong> {dnsResult.dmarc.score}%
                        </div>
                        <div className="text-sm">
                          <strong>Recommendation:</strong> {dnsResult.dmarc.recommendation}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Suppression List Tab */}
        <TabsContent value="suppression" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Filter className="h-5 w-5 mr-2" />
                Suppression List Management
              </CardTitle>
              <CardDescription>
                Manage emails that should not receive campaigns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
                <div className="text-center">
                  <div className="text-2xl font-bold">{(stats.suppressionStats?.totalSuppressed || 0).toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">Total Suppressed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{(stats.suppressionStats?.hardBounces || 0).toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">Hard Bounces</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">{(stats.suppressionStats?.softBounces || 0).toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">Soft Bounces</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{(stats.suppressionStats?.complaints || 0).toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">Complaints</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{(stats.suppressionStats?.unsubscribes || 0).toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">Unsubscribes</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-600">{(stats.suppressionStats?.manual || 0).toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">Manual</div>
                </div>
              </div>

              <div className="flex space-x-4 mb-6">
                <Button variant="outline">
                  <Upload className="h-4 w-4 mr-2" />
                  Import Suppressions
                </Button>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export List
                </Button>
                <Button variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Clean List
                </Button>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Suppression List</AlertTitle>
                <AlertDescription>
                  Emails in this list will be automatically excluded from all campaigns to maintain sender reputation and comply with regulations.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Deliverability Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Last 7 days</span>
                    <span className="text-green-600 font-medium">↗ +2.3%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Last 30 days</span>
                    <span className="text-green-600 font-medium">↗ +5.1%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Last 90 days</span>
                    <span className="text-red-600 font-medium">↘ -1.2%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <div className="font-medium">Improve List Hygiene</div>
                      <div className="text-sm text-muted-foreground">Regular list cleaning can improve delivery rates</div>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
                    <div>
                      <div className="font-medium">Monitor Engagement</div>
                      <div className="text-sm text-muted-foreground">Focus on engaged subscribers for better reputation</div>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                    <div>
                      <div className="font-medium">Content Optimization</div>
                      <div className="text-sm text-muted-foreground">Test different content styles and formats</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
      </>
      )}
    </div>
  )
}