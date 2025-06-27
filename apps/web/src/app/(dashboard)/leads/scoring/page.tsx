"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { toast } from "sonner"
import { 
  BarChart3, TrendingUp, Users, Target, Flame, 
  Snowflake, Thermometer, Award, Settings, RefreshCw,
  Info, Download, Calculator, ChevronRight, Activity,
  Calendar, Mail, MousePointer, MessageSquare, User
} from "lucide-react"
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts"
import { format } from "date-fns"

interface LeadScore {
  lead_id: string
  engagement_score: number
  quality_score: number
  intent_score: number
  total_score: number
  grade: string
  temperature: string
  scoring_factors: any
  last_calculated_at: string
  score_history: Array<{
    date: string
    previous_score: number
    new_score: number
    change: number
    trigger: string
  }>
}

interface ScoringRule {
  email_open_weight: number
  email_click_weight: number
  email_reply_weight: number
  website_visit_weight: number
  form_submission_weight: number
  enable_time_decay: boolean
  decay_half_life_days: number
  grade_thresholds: {
    [key: string]: number
  }
}

const GRADE_COLORS = {
  'A+': '#10B981',
  'A': '#34D399',
  'B+': '#60A5FA',
  'B': '#93C5FD',
  'C': '#FDE047',
  'D': '#FB923C',
  'F': '#F87171'
}

const TEMPERATURE_ICONS = {
  'hot': { icon: Flame, color: '#EF4444' },
  'warm': { icon: Thermometer, color: '#F59E0B' },
  'cool': { icon: Snowflake, color: '#3B82F6' },
  'cold': { icon: Snowflake, color: '#6B7280' }
}

export default function LeadScoringPage() {
  const [activeTab, setActiveTab] = useState("overview")
  const [selectedLead, setSelectedLead] = useState<LeadScore | null>(null)
  const [scoringRules, setScoringRules] = useState<ScoringRule>({
    email_open_weight: 5,
    email_click_weight: 10,
    email_reply_weight: 25,
    website_visit_weight: 15,
    form_submission_weight: 30,
    enable_time_decay: true,
    decay_half_life_days: 30,
    grade_thresholds: {
      'A+': 90,
      'A': 80,
      'B+': 70,
      'B': 60,
      'C': 50,
      'D': 40,
      'F': 0
    }
  })
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isRecalculating, setIsRecalculating] = useState(false)

  // Mock data - replace with API calls
  const scoreDistribution = [
    { range: '90-100', count: 45, grade: 'A+' },
    { range: '80-89', count: 78, grade: 'A' },
    { range: '70-79', count: 123, grade: 'B+' },
    { range: '60-69', count: 156, grade: 'B' },
    { range: '50-59', count: 189, grade: 'C' },
    { range: '40-49', count: 142, grade: 'D' },
    { range: '0-39', count: 267, grade: 'F' }
  ]

  const temperatureDistribution = [
    { name: 'Hot', value: 123, color: '#EF4444' },
    { name: 'Warm', value: 234, color: '#F59E0B' },
    { name: 'Cool', value: 345, color: '#3B82F6' },
    { name: 'Cold', value: 298, color: '#6B7280' }
  ]

  const topScoringLeads = [
    {
      id: '1',
      name: 'John Smith',
      email: 'john@techcorp.com',
      company: 'TechCorp',
      total_score: 95,
      grade: 'A+',
      temperature: 'hot',
      engagement_score: 90,
      quality_score: 98,
      intent_score: 97
    },
    {
      id: '2',
      name: 'Sarah Johnson',
      email: 'sarah@innovate.io',
      company: 'Innovate.io',
      total_score: 88,
      grade: 'A',
      temperature: 'hot',
      engagement_score: 85,
      quality_score: 90,
      intent_score: 89
    },
    {
      id: '3',
      name: 'Mike Chen',
      email: 'mike@growth.co',
      company: 'Growth Co',
      total_score: 82,
      grade: 'A',
      temperature: 'warm',
      engagement_score: 80,
      quality_score: 85,
      intent_score: 81
    }
  ]

  const updateScoringRules = async () => {
    try {
      // API call would go here
      toast.success("Scoring rules updated successfully")
      setIsSettingsOpen(false)
    } catch (error) {
      toast.error("Failed to update scoring rules")
    }
  }

  const recalculateAllScores = async () => {
    setIsRecalculating(true)
    try {
      // API call would go here
      await new Promise(resolve => setTimeout(resolve, 2000)) // Simulate API call
      toast.success("All lead scores recalculated successfully")
    } catch (error) {
      toast.error("Failed to recalculate scores")
    } finally {
      setIsRecalculating(false)
    }
  }

  const exportScores = () => {
    // Export logic
    toast.success("Score data exported successfully")
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Lead Scoring</h1>
          <p className="text-muted-foreground">Automatically score and prioritize your leads</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={exportScores}
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          
          <Button
            variant="outline"
            onClick={recalculateAllScores}
            disabled={isRecalculating}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRecalculating ? 'animate-spin' : ''}`} />
            Recalculate All
          </Button>
          
          <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Scoring Rules Configuration</DialogTitle>
                <DialogDescription>
                  Customize how leads are scored based on their behavior
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6">
                {/* Activity Weights */}
                <div>
                  <h3 className="font-medium mb-4">Activity Weights</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label>Email Opens</Label>
                        <span className="text-sm text-muted-foreground">
                          {scoringRules.email_open_weight} points
                        </span>
                      </div>
                      <Slider
                        value={[scoringRules.email_open_weight]}
                        onValueChange={(value) => setScoringRules({
                          ...scoringRules,
                          email_open_weight: value[0]
                        })}
                        min={0}
                        max={50}
                        step={1}
                      />
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label>Email Clicks</Label>
                        <span className="text-sm text-muted-foreground">
                          {scoringRules.email_click_weight} points
                        </span>
                      </div>
                      <Slider
                        value={[scoringRules.email_click_weight]}
                        onValueChange={(value) => setScoringRules({
                          ...scoringRules,
                          email_click_weight: value[0]
                        })}
                        min={0}
                        max={50}
                        step={1}
                      />
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label>Email Replies</Label>
                        <span className="text-sm text-muted-foreground">
                          {scoringRules.email_reply_weight} points
                        </span>
                      </div>
                      <Slider
                        value={[scoringRules.email_reply_weight]}
                        onValueChange={(value) => setScoringRules({
                          ...scoringRules,
                          email_reply_weight: value[0]
                        })}
                        min={0}
                        max={50}
                        step={1}
                      />
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                {/* Time Decay */}
                <div>
                  <h3 className="font-medium mb-4">Time Decay</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Enable Time Decay</Label>
                        <p className="text-sm text-muted-foreground">
                          Reduce scores for older activities
                        </p>
                      </div>
                      <Switch
                        checked={scoringRules.enable_time_decay}
                        onCheckedChange={(checked) => setScoringRules({
                          ...scoringRules,
                          enable_time_decay: checked
                        })}
                      />
                    </div>
                    
                    {scoringRules.enable_time_decay && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label>Half-Life Days</Label>
                          <span className="text-sm text-muted-foreground">
                            {scoringRules.decay_half_life_days} days
                          </span>
                        </div>
                        <Slider
                          value={[scoringRules.decay_half_life_days]}
                          onValueChange={(value) => setScoringRules({
                            ...scoringRules,
                            decay_half_life_days: value[0]
                          })}
                          min={7}
                          max={90}
                          step={1}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Score reduces by 50% every {scoringRules.decay_half_life_days} days
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                
                <Button onClick={updateScoringRules} className="w-full">
                  Save Changes
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Scored Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,000</div>
            <p className="text-xs text-muted-foreground">
              +15% from last month
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hot Leads</CardTitle>
            <Flame className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">123</div>
            <p className="text-xs text-muted-foreground">
              12.3% of total
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">52.4</div>
            <p className="text-xs text-muted-foreground">
              Grade: C
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Score Trend</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+8.2%</div>
            <p className="text-xs text-muted-foreground">
              Improvement this week
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="top-leads">Top Leads</TabsTrigger>
          <TabsTrigger value="distribution">Distribution</TabsTrigger>
          <TabsTrigger value="history">Score History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Score Distribution Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Score Distribution</CardTitle>
                <CardDescription>Lead distribution across score ranges</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={scoreDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="range" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#6366F1" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Temperature Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Lead Temperature</CardTitle>
                <CardDescription>Distribution by engagement level</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={temperatureDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {temperatureDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Grade Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Grade Distribution</CardTitle>
              <CardDescription>Leads organized by letter grades</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(GRADE_COLORS).map(([grade, color]) => {
                  const gradeData = scoreDistribution.find(d => d.grade === grade)
                  const count = gradeData?.count || 0
                  const percentage = (count / 1000) * 100

                  return (
                    <div key={grade} className="flex items-center gap-4">
                      <Badge 
                        className="w-12 justify-center text-white"
                        style={{ backgroundColor: color }}
                      >
                        {grade}
                      </Badge>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{count} leads</span>
                          <span className="text-sm text-muted-foreground">{percentage.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-2">
                          <div 
                            className="h-2 rounded-full transition-all"
                            style={{ 
                              width: `${percentage}%`,
                              backgroundColor: color
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="top-leads" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Highest Scoring Leads</CardTitle>
              <CardDescription>Your most engaged and qualified prospects</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topScoringLeads.map((lead, index) => {
                  const TempIcon = TEMPERATURE_ICONS[lead.temperature as keyof typeof TEMPERATURE_ICONS].icon
                  const tempColor = TEMPERATURE_ICONS[lead.temperature as keyof typeof TEMPERATURE_ICONS].color

                  return (
                    <div
                      key={lead.id}
                      className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent transition-colors cursor-pointer"
                      onClick={() => setSelectedLead({
                        lead_id: lead.id,
                        engagement_score: lead.engagement_score,
                        quality_score: lead.quality_score,
                        intent_score: lead.intent_score,
                        total_score: lead.total_score,
                        grade: lead.grade,
                        temperature: lead.temperature,
                        scoring_factors: {},
                        last_calculated_at: new Date().toISOString(),
                        score_history: []
                      })}
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-xl font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{lead.name}</h4>
                            <Badge 
                              className="text-white"
                              style={{ backgroundColor: GRADE_COLORS[lead.grade as keyof typeof GRADE_COLORS] }}
                            >
                              {lead.grade}
                            </Badge>
                            <TempIcon className="w-4 h-4" style={{ color: tempColor }} />
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>{lead.email}</span>
                            <span>•</span>
                            <span>{lead.company}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <div className="text-2xl font-bold">{lead.total_score}</div>
                          <div className="text-xs text-muted-foreground">Total Score</div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="distribution" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Engagement Score Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Engagement Scores</CardTitle>
                <CardDescription>Based on email interactions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">Email Opens</span>
                    </div>
                    <span className="text-sm font-medium">35%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MousePointer className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">Link Clicks</span>
                    </div>
                    <span className="text-sm font-medium">28%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">Replies</span>
                    </div>
                    <span className="text-sm font-medium">12%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quality Score Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Quality Scores</CardTitle>
                <CardDescription>Based on lead profile</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">Profile Complete</span>
                    </div>
                    <span className="text-sm font-medium">78%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">Company Fit</span>
                    </div>
                    <span className="text-sm font-medium">65%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">Verified Email</span>
                    </div>
                    <span className="text-sm font-medium">92%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Intent Score Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Intent Scores</CardTitle>
                <CardDescription>Based on behavior patterns</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">Recent Activity</span>
                    </div>
                    <span className="text-sm font-medium">45%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">Engagement Trend</span>
                    </div>
                    <span className="text-sm font-medium">58%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">Frequency</span>
                    </div>
                    <span className="text-sm font-medium">32%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Score Change History</CardTitle>
              <CardDescription>Track how lead scores change over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center text-muted-foreground py-8">
                Select a lead from the Top Leads tab to view score history
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}