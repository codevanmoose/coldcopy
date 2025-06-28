'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import {
  Share2,
  Copy,
  DollarSign,
  Users,
  TrendingUp,
  Gift,
  ExternalLink,
  Plus,
  RefreshCw,
  Link,
  Mail,
  MessageSquare,
  Star
} from 'lucide-react'
import { LoadingSpinner, ErrorState } from '@/components/ui/loading-states'
import { toast } from 'sonner'
import { referralService, type ReferralAnalytics } from '@/lib/growth/referral-service'

interface ReferralCode {
  id: string
  code: string
  clicks_count: number
  signups_count: number
  conversions_count: number
  total_revenue: number
  is_active: boolean
  created_at: string
  referral_programs?: {
    name: string
    referrer_reward_value: number
    referrer_reward_unit: string
  }
}

interface Referral {
  id: string
  referee_email: string
  referee_name?: string
  status: string
  conversion_value: number
  referrer_reward_amount: number
  referred_at: string
  signed_up_at?: string
  converted_at?: string
  referral_codes?: {
    code: string
  }
  referral_programs?: {
    name: string
    referrer_reward_value: number
    referrer_reward_unit: string
  }
}

export function ReferralDashboard() {
  const [loading, setLoading] = useState(true)
  const [referralCodes, setReferralCodes] = useState<ReferralCode[]>([])
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [analytics, setAnalytics] = useState<ReferralAnalytics | null>(null)
  const [showCreateCodeDialog, setShowCreateCodeDialog] = useState(false)
  const [selectedCode, setSelectedCode] = useState<ReferralCode | null>(null)
  const [shareUrl, setShareUrl] = useState('')

  useEffect(() => {
    loadReferralData()
  }, [])

  const loadReferralData = async () => {
    try {
      setLoading(true)
      
      const [codesResponse, referralsResponse, analyticsResponse] = await Promise.all([
        fetch('/api/growth/referrals/codes'),
        fetch('/api/growth/referrals?type=user'),
        fetch('/api/growth/analytics/referrals')
      ])

      if (codesResponse.ok) {
        const codesData = await codesResponse.json()
        setReferralCodes(codesData.referral_codes || [])
      }

      if (referralsResponse.ok) {
        const referralsData = await referralsResponse.json()
        setReferrals(referralsData.referrals || [])
      }

      if (analyticsResponse.ok) {
        const analyticsData = await analyticsResponse.json()
        setAnalytics(analyticsData.analytics)
      }
    } catch (error) {
      console.error('Error loading referral data:', error)
      toast.error('Failed to load referral data')
    } finally {
      setLoading(false)
    }
  }

  const createReferralCode = async () => {
    try {
      // Get default program (assuming first one exists)
      const programResponse = await fetch('/api/growth/referrals/programs')
      if (!programResponse.ok) {
        throw new Error('No referral programs found')
      }
      
      const programData = await programResponse.json()
      const programs = programData.programs || []
      
      if (programs.length === 0) {
        throw new Error('No active referral programs')
      }

      const response = await fetch('/api/growth/referrals/codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          program_id: programs[0].id,
          prefix: 'COLD'
        })
      })

      if (!response.ok) {
        throw new Error('Failed to create referral code')
      }

      const data = await response.json()
      toast.success('Referral code created successfully!')
      setShowCreateCodeDialog(false)
      await loadReferralData()
    } catch (error: any) {
      console.error('Error creating referral code:', error)
      toast.error(error.message || 'Failed to create referral code')
    }
  }

  const copyReferralLink = (code: string) => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
    const referralUrl = `${baseUrl}/api/growth/referrals/click?code=${code}&redirect=${baseUrl}/signup`
    
    navigator.clipboard.writeText(referralUrl)
    toast.success('Referral link copied to clipboard!')
  }

  const copyReferralCode = (code: string) => {
    navigator.clipboard.writeText(code)
    toast.success('Referral code copied to clipboard!')
  }

  const shareReferralCode = (code: ReferralCode) => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
    const referralUrl = `${baseUrl}/api/growth/referrals/click?code=${code.code}&redirect=${baseUrl}/signup`
    
    if (navigator.share) {
      navigator.share({
        title: 'Join ColdCopy with my referral code',
        text: `Get started with ColdCopy using my referral code: ${code.code}`,
        url: referralUrl
      })
    } else {
      setSelectedCode(code)
      setShareUrl(referralUrl)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'converted':
      case 'rewarded':
        return 'default'
      case 'signed_up':
        return 'secondary'
      case 'pending':
        return 'outline'
      default:
        return 'outline'
    }
  }

  const chartColors = {
    primary: '#8B5CF6',
    secondary: '#06B6D4',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const totalPendingRewards = referrals
    .filter(r => r.status === 'converted' || r.status === 'rewarded')
    .reduce((sum, r) => sum + r.referrer_reward_amount, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Referral Program</h1>
          <p className="text-muted-foreground">
            Share ColdCopy with friends and earn rewards for every successful referral
          </p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={loadReferralData} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowCreateCodeDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Code
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Codes</CardTitle>
            <Link className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{referralCodes.filter(c => c.is_active).length}</div>
            <p className="text-xs text-muted-foreground">
              {referralCodes.length} total codes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Referrals</CardTitle>
            <Users className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{referrals.length}</div>
            <p className="text-xs text-muted-foreground">
              {referrals.filter(r => r.status === 'converted' || r.status === 'rewarded').length} converted
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {referrals.length > 0 
                ? Math.round((referrals.filter(r => r.status === 'converted' || r.status === 'rewarded').length / referrals.length) * 100)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Last 30 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Rewards</CardTitle>
            <Gift className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalPendingRewards)}</div>
            <p className="text-xs text-muted-foreground">
              In credits and bonuses
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="codes" className="space-y-6">
        <TabsList>
          <TabsTrigger value="codes">
            <Link className="h-4 w-4 mr-2" />
            My Codes
          </TabsTrigger>
          <TabsTrigger value="referrals">
            <Users className="h-4 w-4 mr-2" />
            Referrals
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <TrendingUp className="h-4 w-4 mr-2" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="codes" className="space-y-6">
          {referralCodes.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Link className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No referral codes yet</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Create your first referral code to start earning rewards
                </p>
                <Button onClick={() => setShowCreateCodeDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Referral Code
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {referralCodes.map(code => (
                <Card key={code.id} className="relative">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-mono">{code.code}</CardTitle>
                      <Badge variant={code.is_active ? 'default' : 'outline'}>
                        {code.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <CardDescription>
                      {code.referral_programs?.name || 'Referral Program'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Clicks</p>
                        <p className="font-medium">{code.clicks_count}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Signups</p>
                        <p className="font-medium">{code.signups_count}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Conversions</p>
                        <p className="font-medium">{code.conversions_count}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Revenue</p>
                        <p className="font-medium">{formatCurrency(code.total_revenue)}</p>
                      </div>
                    </div>

                    {code.signups_count > 0 && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Conversion Rate</span>
                          <span>{Math.round((code.conversions_count / code.signups_count) * 100)}%</span>
                        </div>
                        <Progress 
                          value={(code.conversions_count / code.signups_count) * 100} 
                          className="h-2" 
                        />
                      </div>
                    )}

                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyReferralCode(code.code)}
                        className="flex-1"
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy Code
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyReferralLink(code.code)}
                        className="flex-1"
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Copy Link
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => shareReferralCode(code)}
                      >
                        <Share2 className="h-3 w-3" />
                      </Button>
                    </div>

                    {code.referral_programs && (
                      <Alert>
                        <Gift className="h-4 w-4" />
                        <AlertDescription>
                          Earn {formatCurrency(code.referral_programs.referrer_reward_value)} for each successful referral
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="referrals" className="space-y-6">
          {referrals.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No referrals yet</h3>
                <p className="text-muted-foreground text-center">
                  Share your referral code to start building your network
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Your Referrals</CardTitle>
                <CardDescription>
                  Track the status and performance of your referrals
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {referrals.slice(0, 10).map(referral => (
                    <div key={referral.id} className="flex items-center justify-between py-3 border-b">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <p className="font-medium">{referral.referee_email}</p>
                          <Badge variant={getStatusBadgeVariant(referral.status)}>
                            {referral.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                          <span>Code: {referral.referral_codes?.code}</span>
                          <span>Referred: {new Date(referral.referred_at).toLocaleDateString()}</span>
                          {referral.converted_at && (
                            <span>Converted: {new Date(referral.converted_at).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        {referral.conversion_value > 0 && (
                          <p className="font-medium">{formatCurrency(referral.conversion_value)}</p>
                        )}
                        {referral.referrer_reward_amount > 0 && (
                          <p className="text-sm text-green-600">
                            +{formatCurrency(referral.referrer_reward_amount)} reward
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          {analytics && (
            <>
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Monthly Referral Trends</CardTitle>
                    <CardDescription>
                      Track your referral performance over time
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={analytics.monthly_trends}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <Tooltip />
                          <Area 
                            type="monotone" 
                            dataKey="referrals" 
                            stroke={chartColors.primary} 
                            fill={chartColors.primary}
                            fillOpacity={0.3}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Referral Sources</CardTitle>
                    <CardDescription>
                      Where your referrals are coming from
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {analytics.referral_sources.map((source, index) => (
                        <div key={source.source} className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: [chartColors.primary, chartColors.secondary, chartColors.success, chartColors.warning][index % 4] }}
                            />
                            <span className="font-medium capitalize">{source.source}</span>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{source.count}</p>
                            <p className="text-sm text-muted-foreground">
                              {source.conversion_rate.toFixed(1)}% conversion
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Top Referrers</CardTitle>
                  <CardDescription>
                    Most successful referrers in your network
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {analytics.top_referrers.slice(0, 5).map((referrer, index) => (
                      <div key={referrer.user_id} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                            <span className="text-sm font-medium">#{index + 1}</span>
                          </div>
                          <div>
                            <p className="font-medium">User {referrer.user_id.slice(0, 8)}</p>
                            <p className="text-sm text-muted-foreground">
                              {referrer.referrals_count} referrals, {referrer.conversions_count} conversions
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{formatCurrency(referrer.total_revenue)}</p>
                          <p className="text-sm text-green-600">
                            {formatCurrency(referrer.total_rewards)} earned
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Code Dialog */}
      <Dialog open={showCreateCodeDialog} onOpenChange={setShowCreateCodeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Referral Code</DialogTitle>
            <DialogDescription>
              Generate a new referral code to share with your network
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Reward Structure</p>
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm">• You earn $25 in credits for each successful referral</p>
                <p className="text-sm">• Your referrals get $10 in credits when they sign up</p>
                <p className="text-sm">• Rewards are paid after the first successful payment</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateCodeDialog(false)}>
              Cancel
            </Button>
            <Button onClick={createReferralCode}>
              Create Code
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={!!selectedCode} onOpenChange={() => setSelectedCode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Referral Code</DialogTitle>
            <DialogDescription>
              Share your referral code {selectedCode?.code} with friends and colleagues
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Referral Link</label>
              <div className="flex space-x-2 mt-1">
                <Input value={shareUrl} readOnly />
                <Button variant="outline" onClick={() => copyReferralLink(selectedCode?.code || '')}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" size="sm" onClick={() => {
                const emailBody = `Join ColdCopy with my referral code: ${selectedCode?.code}\n\n${shareUrl}`
                window.open(`mailto:?subject=Join ColdCopy&body=${encodeURIComponent(emailBody)}`)
              }}>
                <Mail className="h-4 w-4 mr-2" />
                Email
              </Button>
              <Button variant="outline" size="sm" onClick={() => {
                const text = `Join ColdCopy with my referral code: ${selectedCode?.code} ${shareUrl}`
                window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`)
              }}>
                <MessageSquare className="h-4 w-4 mr-2" />
                Twitter
              </Button>
              <Button variant="outline" size="sm" onClick={() => {
                const text = `Join ColdCopy with my referral code: ${selectedCode?.code}\n\n${shareUrl}`
                window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`)
              }}>
                <Users className="h-4 w-4 mr-2" />
                LinkedIn
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setSelectedCode(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}