"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"
import { 
  Zap, Plus, Play, Pause, TrendingUp, Users, 
  Mail, Activity, CheckCircle2, AlertCircle, Clock,
  BarChart3, Shield, Globe, Settings, RefreshCw,
  ArrowUp, ArrowDown, Gauge, Target, Calendar
} from "lucide-react"
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, RadialBarChart, RadialBar, Legend
} from "recharts"
import { format } from "date-fns"
import Link from "next/link"

interface WarmupPool {
  id: string
  name: string
  current_size: number
  target_size: number
  min_engagement_rate: number
  max_engagement_rate: number
  is_active: boolean
}

interface WarmupCampaign {
  id: string
  name: string
  email_address: string
  domain: string
  strategy: string
  status: string
  day_number: number
  total_days_planned: number
  current_daily_limit: number
  target_daily_volume: number
  average_open_rate: number
  average_click_rate: number
  bounce_rate: number
  spam_rate: number
  spf_valid: boolean
  dkim_valid: boolean
  dmarc_valid: boolean
  started_at: string
}

const STATUS_COLORS = {
  pending: { bg: 'bg-yellow-500', text: 'text-yellow-500' },
  warming: { bg: 'bg-blue-500', text: 'text-blue-500' },
  active: { bg: 'bg-green-500', text: 'text-green-500' },
  paused: { bg: 'bg-orange-500', text: 'text-orange-500' },
  completed: { bg: 'bg-purple-500', text: 'text-purple-500' },
  failed: { bg: 'bg-red-500', text: 'text-red-500' }
}

const STRATEGY_LABELS = {
  conservative: 'Conservative',
  moderate: 'Moderate',
  aggressive: 'Aggressive',
  custom: 'Custom'
}

export default function WarmupDashboard() {
  const [activeTab, setActiveTab] = useState("overview")
  const [pools, setPools] = useState<WarmupPool[]>([])
  const [campaigns, setCampaigns] = useState<WarmupCampaign[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedCampaign, setSelectedCampaign] = useState<WarmupCampaign | null>(null)

  // Mock data - replace with API calls
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setIsLoading(true)
    try {
      // Mock data
      const mockPools: WarmupPool[] = [
        {
          id: '1',
          name: 'Primary Warm-up Pool',
          current_size: 45,
          target_size: 50,
          min_engagement_rate: 0.3,
          max_engagement_rate: 0.7,
          is_active: true
        },
        {
          id: '2',
          name: 'Secondary Pool',
          current_size: 28,
          target_size: 30,
          min_engagement_rate: 0.4,
          max_engagement_rate: 0.6,
          is_active: true
        }
      ]

      const mockCampaigns: WarmupCampaign[] = [
        {
          id: '1',
          name: 'sales@coldcopy.cc',
          email_address: 'sales@coldcopy.cc',
          domain: 'coldcopy.cc',
          strategy: 'moderate',
          status: 'warming',
          day_number: 15,
          total_days_planned: 30,
          current_daily_limit: 250,
          target_daily_volume: 1000,
          average_open_rate: 0.42,
          average_click_rate: 0.18,
          bounce_rate: 0.02,
          spam_rate: 0.001,
          spf_valid: true,
          dkim_valid: true,
          dmarc_valid: true,
          started_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: '2',
          name: 'support@coldcopy.cc',
          email_address: 'support@coldcopy.cc',
          domain: 'coldcopy.cc',
          strategy: 'conservative',
          status: 'completed',
          day_number: 45,
          total_days_planned: 45,
          current_daily_limit: 500,
          target_daily_volume: 500,
          average_open_rate: 0.38,
          average_click_rate: 0.15,
          bounce_rate: 0.01,
          spam_rate: 0,
          spf_valid: true,
          dkim_valid: true,
          dmarc_valid: false,
          started_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString()
        }
      ]

      setPools(mockPools)
      setCampaigns(mockCampaigns)
      if (mockCampaigns.length > 0) {
        setSelectedCampaign(mockCampaigns[0])
      }
    } catch (error) {
      toast.error("Failed to load warm-up data")
    } finally {
      setIsLoading(false)
    }
  }

  const startCampaign = async (campaignId: string) => {
    try {
      // API call would go here
      toast.success("Campaign started successfully")
      loadData()
    } catch (error) {
      toast.error("Failed to start campaign")
    }
  }

  const pauseCampaign = async (campaignId: string) => {
    try {
      // API call would go here
      toast.success("Campaign paused successfully")
      loadData()
    } catch (error) {
      toast.error("Failed to pause campaign")
    }
  }

  // Mock daily stats data
  const dailyStats = selectedCampaign ? Array.from({ length: selectedCampaign.day_number }, (_, i) => ({
    day: i + 1,
    sent: Math.min((i + 1) * 10, selectedCampaign.current_daily_limit),
    opened: Math.floor(Math.min((i + 1) * 10, selectedCampaign.current_daily_limit) * 0.4),
    clicked: Math.floor(Math.min((i + 1) * 10, selectedCampaign.current_daily_limit) * 0.15),
    reputation: 50 + (i * 2)
  })) : []

  const getStatusBadge = (status: string) => {
    const config = STATUS_COLORS[status as keyof typeof STATUS_COLORS] || STATUS_COLORS.pending
    return (
      <Badge className={`${config.bg} text-white`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }

  const getDNSStatus = (campaign: WarmupCampaign) => {
    const allValid = campaign.spf_valid && campaign.dkim_valid && campaign.dmarc_valid
    
    return (
      <div className="flex items-center gap-2">
        <Shield className={`w-4 h-4 ${allValid ? 'text-green-500' : 'text-orange-500'}`} />
        <span className="text-sm">
          {allValid ? 'All DNS records valid' : 'DNS configuration incomplete'}
        </span>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Zap className="w-8 h-8" />
            Email Warm-up System
          </h1>
          <p className="text-muted-foreground">Build and maintain sender reputation</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Link href="/warmup/pools">
            <Button variant="outline">
              <Users className="w-4 h-4 mr-2" />
              Manage Pools
            </Button>
          </Link>
          <Link href="/warmup/campaigns/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Campaign
            </Button>
          </Link>
        </div>
      </div>

      {/* Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {campaigns.filter(c => c.status === 'warming').length}
            </div>
            <p className="text-xs text-muted-foreground">
              of {campaigns.length} total campaigns
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pool Capacity</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pools.reduce((sum, p) => sum + p.current_size, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              accounts across {pools.length} pools
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Volume</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {campaigns
                .filter(c => c.status === 'warming')
                .reduce((sum, c) => sum + c.current_daily_limit, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              emails warming today
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Reputation</CardTitle>
            <Gauge className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">85</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-500">+5</span> this week
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Active Campaigns */}
            <Card>
              <CardHeader>
                <CardTitle>Active Campaigns</CardTitle>
                <CardDescription>Currently warming email addresses</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {campaigns.filter(c => c.status === 'warming').map((campaign) => (
                    <div key={campaign.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{campaign.email_address}</p>
                          <p className="text-sm text-muted-foreground">
                            Day {campaign.day_number} of {campaign.total_days_planned}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => pauseCampaign(campaign.id)}
                        >
                          <Pause className="w-4 h-4" />
                        </Button>
                      </div>
                      <Progress 
                        value={(campaign.day_number / campaign.total_days_planned) * 100} 
                        className="h-2"
                      />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{campaign.current_daily_limit} emails/day</span>
                        <span>Target: {campaign.target_daily_volume}</span>
                      </div>
                    </div>
                  ))}
                  
                  {campaigns.filter(c => c.status === 'warming').length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Mail className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No active warm-up campaigns</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Warm-up Pools */}
            <Card>
              <CardHeader>
                <CardTitle>Warm-up Pools</CardTitle>
                <CardDescription>Email account networks for warming</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {pools.map((pool) => (
                    <div key={pool.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{pool.name}</span>
                        </div>
                        <Badge variant={pool.is_active ? "default" : "secondary"}>
                          {pool.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span>{pool.current_size}/{pool.target_size} accounts</span>
                        <span className="text-muted-foreground">•</span>
                        <span>{Math.round(pool.min_engagement_rate * 100)}-{Math.round(pool.max_engagement_rate * 100)}% engagement</span>
                      </div>
                      <Progress 
                        value={(pool.current_size / pool.target_size) * 100} 
                        className="h-2"
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Campaign Performance Chart */}
          {selectedCampaign && selectedCampaign.status === 'warming' && (
            <Card>
              <CardHeader>
                <CardTitle>Campaign Progress - {selectedCampaign.email_address}</CardTitle>
                <CardDescription>Daily volume and engagement metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={dailyStats}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Area 
                      type="monotone" 
                      dataKey="sent" 
                      stackId="1"
                      stroke="#6366F1" 
                      fill="#6366F1" 
                      fillOpacity={0.6}
                      name="Sent"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="opened" 
                      stackId="1"
                      stroke="#10B981" 
                      fill="#10B981" 
                      fillOpacity={0.6}
                      name="Opened"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="clicked" 
                      stackId="1"
                      stroke="#F59E0B" 
                      fill="#F59E0B" 
                      fillOpacity={0.6}
                      name="Clicked"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-6">
          <div className="grid grid-cols-1 gap-4">
            {campaigns.map((campaign) => (
              <Card key={campaign.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{campaign.name}</CardTitle>
                      <CardDescription>{campaign.email_address}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(campaign.status)}
                      <Badge variant="outline">
                        {STRATEGY_LABELS[campaign.strategy as keyof typeof STRATEGY_LABELS]}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Progress */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Progress</span>
                        <span className="text-sm text-muted-foreground">
                          Day {campaign.day_number} of {campaign.total_days_planned}
                        </span>
                      </div>
                      <Progress 
                        value={(campaign.day_number / campaign.total_days_planned) * 100} 
                        className="h-2"
                      />
                    </div>

                    {/* Volume */}
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Current Daily</p>
                        <p className="text-xl font-bold">{campaign.current_daily_limit}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Target Daily</p>
                        <p className="text-xl font-bold">{campaign.target_daily_volume}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Progress</p>
                        <p className="text-xl font-bold">
                          {Math.round((campaign.current_daily_limit / campaign.target_daily_volume) * 100)}%
                        </p>
                      </div>
                    </div>

                    {/* Metrics */}
                    <div className="grid grid-cols-4 gap-4 pt-4 border-t">
                      <div>
                        <p className="text-sm text-muted-foreground">Open Rate</p>
                        <p className="text-lg font-medium">
                          {Math.round(campaign.average_open_rate * 100)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Click Rate</p>
                        <p className="text-lg font-medium">
                          {Math.round(campaign.average_click_rate * 100)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Bounce Rate</p>
                        <p className="text-lg font-medium">
                          {(campaign.bounce_rate * 100).toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Spam Rate</p>
                        <p className="text-lg font-medium">
                          {(campaign.spam_rate * 100).toFixed(2)}%
                        </p>
                      </div>
                    </div>

                    {/* DNS Status */}
                    <div className="pt-4 border-t">
                      {getDNSStatus(campaign)}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-4">
                      {campaign.status === 'pending' && (
                        <Button 
                          size="sm"
                          onClick={() => startCampaign(campaign.id)}
                        >
                          <Play className="w-4 h-4 mr-2" />
                          Start Campaign
                        </Button>
                      )}
                      {campaign.status === 'warming' && (
                        <Button 
                          size="sm"
                          variant="outline"
                          onClick={() => pauseCampaign(campaign.id)}
                        >
                          <Pause className="w-4 h-4 mr-2" />
                          Pause
                        </Button>
                      )}
                      <Button size="sm" variant="outline">
                        <BarChart3 className="w-4 h-4 mr-2" />
                        View Details
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Reputation Trend */}
            <Card>
              <CardHeader>
                <CardTitle>Reputation Score Trend</CardTitle>
                <CardDescription>Overall sender reputation over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={dailyStats}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="reputation" 
                      stroke="#6366F1" 
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Domain Health */}
            <Card>
              <CardHeader>
                <CardTitle>Domain Health</CardTitle>
                <CardDescription>Authentication and deliverability status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {campaigns.map((campaign) => (
                    <div key={campaign.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{campaign.domain}</span>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={campaign.spf_valid ? "default" : "destructive"}
                            className="text-xs"
                          >
                            SPF
                          </Badge>
                          <Badge 
                            variant={campaign.dkim_valid ? "default" : "destructive"}
                            className="text-xs"
                          >
                            DKIM
                          </Badge>
                          <Badge 
                            variant={campaign.dmarc_valid ? "default" : "destructive"}
                            className="text-xs"
                          >
                            DMARC
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Shield className="w-3 h-3" />
                        <span>
                          {[campaign.spf_valid, campaign.dkim_valid, campaign.dmarc_valid]
                            .filter(Boolean).length}/3 authenticated
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Engagement Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Engagement Metrics by Campaign</CardTitle>
              <CardDescription>Performance comparison across campaigns</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={campaigns}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="email_address" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="average_open_rate" fill="#6366F1" name="Open Rate" />
                  <Bar dataKey="average_click_rate" fill="#10B981" name="Click Rate" />
                  <Bar dataKey="bounce_rate" fill="#EF4444" name="Bounce Rate" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}