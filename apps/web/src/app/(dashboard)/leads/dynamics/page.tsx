'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TerritoryManagement } from '@/components/leads/territory-management'
import { DuplicateDetection } from '@/components/leads/duplicate-detection'
import { LeadQualification } from '@/components/leads/lead-qualification'
import { 
  Globe, 
  Users, 
  Target,
  Briefcase,
  TrendingUp,
  Shield,
  Zap,
  ChevronRight
} from 'lucide-react'

export default function LeadsDynamicsPage() {
  const [activeTab, setActiveTab] = useState('overview')

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Briefcase className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Enterprise Lead Management</h1>
            <p className="text-xl text-muted-foreground mt-1">
              Advanced Dynamics-style features for enterprise sales teams
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Powered by</span>
          <Badge variant="secondary" className="gap-1">
            <Zap className="h-3 w-3" />
            ColdCopy Enterprise
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="territories">Territory Management</TabsTrigger>
          <TabsTrigger value="duplicates">Duplicate Detection</TabsTrigger>
          <TabsTrigger value="qualification">Lead Qualification</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Enterprise Features Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setActiveTab('territories')}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Globe className="h-8 w-8 text-blue-500" />
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
                <CardTitle>Territory Management</CardTitle>
                <CardDescription>
                  Organize leads by geographic regions, accounts, or custom rules
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Active Territories</span>
                    <span className="font-medium">12</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Assigned Reps</span>
                    <span className="font-medium">24</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Coverage</span>
                    <span className="font-medium">96%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setActiveTab('duplicates')}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Users className="h-8 w-8 text-green-500" />
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
                <CardTitle>Duplicate Detection</CardTitle>
                <CardDescription>
                  Find and merge duplicate leads to maintain data quality
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Duplicate Groups</span>
                    <span className="font-medium">45</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Data Quality</span>
                    <span className="font-medium">92%</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Last Scan</span>
                    <span className="font-medium">2 days ago</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setActiveTab('qualification')}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Target className="h-8 w-8 text-purple-500" />
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
                <CardTitle>Lead Qualification</CardTitle>
                <CardDescription>
                  BANT framework with automated qualification workflows
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Qualifying</span>
                    <span className="font-medium">156</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Qualified (MTD)</span>
                    <span className="font-medium">89</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Conversion Rate</span>
                    <span className="font-medium">68%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Key Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Enterprise Lead Metrics</CardTitle>
              <CardDescription>
                Real-time insights across your entire lead database
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Total Leads</p>
                  <p className="text-3xl font-bold">12,450</p>
                  <div className="flex items-center text-sm text-green-600">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    +15% from last month
                  </div>
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Qualified (YTD)</p>
                  <p className="text-3xl font-bold">1,823</p>
                  <div className="flex items-center text-sm text-green-600">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    +22% from last year
                  </div>
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Pipeline Value</p>
                  <p className="text-3xl font-bold">$18.5M</p>
                  <div className="flex items-center text-sm text-green-600">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    +35% from last quarter
                  </div>
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Win Rate</p>
                  <p className="text-3xl font-bold">24.5%</p>
                  <div className="flex items-center text-sm text-green-600">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    +3.2% improvement
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Additional Features */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Coming Soon</CardTitle>
                <CardDescription>
                  Advanced enterprise features in development
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Shield className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Compliance Management</p>
                      <p className="text-sm text-muted-foreground">GDPR, CCPA, and industry-specific compliance</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <TrendingUp className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Sales Forecasting</p>
                      <p className="text-sm text-muted-foreground">AI-powered pipeline predictions</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Users className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Account-Based Marketing</p>
                      <p className="text-sm text-muted-foreground">Coordinate multi-touch campaigns</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Integration Status</CardTitle>
                <CardDescription>
                  Connect with your existing enterprise tools
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      <span className="text-sm">Microsoft Dynamics 365</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      <span className="text-sm">Salesforce</span>
                    </div>
                    <Badge className="text-xs">Connected</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      <span className="text-sm">HubSpot</span>
                    </div>
                    <Badge className="text-xs">Connected</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-yellow-500" />
                      <span className="text-sm">Power BI</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">Beta</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="territories">
          <TerritoryManagement />
        </TabsContent>

        <TabsContent value="duplicates">
          <DuplicateDetection />
        </TabsContent>

        <TabsContent value="qualification">
          <LeadQualification />
        </TabsContent>
      </Tabs>
    </div>
  )
}