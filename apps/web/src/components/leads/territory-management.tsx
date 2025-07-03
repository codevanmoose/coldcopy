'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Globe, 
  MapPin, 
  Users, 
  Building, 
  Plus, 
  Edit, 
  Trash2,
  ChevronRight,
  AlertCircle,
  TrendingUp,
  Target
} from 'lucide-react'

interface Territory {
  id: string
  name: string
  type: 'geographic' | 'account' | 'industry' | 'custom'
  description: string
  assignedTo: string[]
  rules: TerritoryRule[]
  leadCount: number
  revenue: number
  conversionRate: number
  parent?: string
}

interface TerritoryRule {
  field: string
  operator: 'equals' | 'contains' | 'in' | 'not_in' | 'greater_than' | 'less_than'
  value: string | string[] | number
}

export function TerritoryManagement() {
  const [territories, setTerritories] = useState<Territory[]>([
    {
      id: '1',
      name: 'North America',
      type: 'geographic',
      description: 'United States and Canada',
      assignedTo: ['john.smith@company.com', 'jane.doe@company.com'],
      rules: [
        { field: 'country', operator: 'in', value: ['US', 'CA'] }
      ],
      leadCount: 1250,
      revenue: 2500000,
      conversionRate: 18.5
    },
    {
      id: '2',
      name: 'Enterprise Accounts',
      type: 'account',
      description: 'Companies with 1000+ employees',
      assignedTo: ['mike.wilson@company.com'],
      rules: [
        { field: 'company_size', operator: 'greater_than', value: 1000 }
      ],
      leadCount: 450,
      revenue: 5200000,
      conversionRate: 22.3
    },
    {
      id: '3',
      name: 'Technology Sector',
      type: 'industry',
      description: 'SaaS and Technology companies',
      assignedTo: ['sarah.jones@company.com'],
      rules: [
        { field: 'industry', operator: 'in', value: ['SaaS', 'Technology', 'Software'] }
      ],
      leadCount: 680,
      revenue: 1800000,
      conversionRate: 15.2
    }
  ])

  const [selectedTerritory, setSelectedTerritory] = useState<Territory | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newTerritory, setNewTerritory] = useState<Partial<Territory>>({
    name: '',
    type: 'geographic',
    description: '',
    assignedTo: [],
    rules: []
  })

  const handleCreateTerritory = () => {
    const territory: Territory = {
      id: Date.now().toString(),
      name: newTerritory.name!,
      type: newTerritory.type as Territory['type'],
      description: newTerritory.description!,
      assignedTo: newTerritory.assignedTo!,
      rules: newTerritory.rules!,
      leadCount: 0,
      revenue: 0,
      conversionRate: 0
    }
    
    setTerritories([...territories, territory])
    setShowCreateDialog(false)
    setNewTerritory({
      name: '',
      type: 'geographic',
      description: '',
      assignedTo: [],
      rules: []
    })
  }

  const getTerritoryIcon = (type: Territory['type']) => {
    switch (type) {
      case 'geographic':
        return <Globe className="h-4 w-4" />
      case 'account':
        return <Building className="h-4 w-4" />
      case 'industry':
        return <Target className="h-4 w-4" />
      default:
        return <MapPin className="h-4 w-4" />
    }
  }

  const getTerritoryTypeBadge = (type: Territory['type']) => {
    const colors = {
      geographic: 'bg-blue-100 text-blue-800',
      account: 'bg-green-100 text-green-800',
      industry: 'bg-purple-100 text-purple-800',
      custom: 'bg-gray-100 text-gray-800'
    }
    
    return (
      <Badge variant="secondary" className={colors[type]}>
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Territory Management</h2>
          <p className="text-muted-foreground">
            Organize and assign leads based on geographic regions, accounts, or custom rules
          </p>
        </div>
        
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Territory
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Create New Territory</DialogTitle>
              <DialogDescription>
                Define a new territory with assignment rules and team members
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Territory Name</Label>
                <Input
                  placeholder="e.g., West Coast, Enterprise Accounts"
                  value={newTerritory.name}
                  onChange={(e) => setNewTerritory({ ...newTerritory, name: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Territory Type</Label>
                <Select
                  value={newTerritory.type}
                  onValueChange={(value) => setNewTerritory({ ...newTerritory, type: value as Territory['type'] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="geographic">Geographic</SelectItem>
                    <SelectItem value="account">Account-Based</SelectItem>
                    <SelectItem value="industry">Industry</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  placeholder="Describe this territory"
                  value={newTerritory.description}
                  onChange={(e) => setNewTerritory({ ...newTerritory, description: e.target.value })}
                />
              </div>
              
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  You can configure assignment rules and add team members after creating the territory.
                </AlertDescription>
              </Alert>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateTerritory} disabled={!newTerritory.name}>
                Create Territory
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Territories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{territories.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Active territories
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {territories.reduce((sum, t) => sum + t.leadCount, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all territories
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(territories.reduce((sum, t) => sum + t.revenue, 0) / 1000000).toFixed(1)}M
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Pipeline value
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Conversion</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(territories.reduce((sum, t) => sum + t.conversionRate, 0) / territories.length).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Lead to customer
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Territory List and Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Territory List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Territories</CardTitle>
              <CardDescription>
                Click on a territory to view details
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {territories.map((territory) => (
                  <button
                    key={territory.id}
                    onClick={() => setSelectedTerritory(territory)}
                    className={`w-full p-4 text-left hover:bg-muted/50 transition-colors ${
                      selectedTerritory?.id === territory.id ? 'bg-muted' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {getTerritoryIcon(territory.type)}
                          <span className="font-medium">{territory.name}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {territory.description}
                        </p>
                        <div className="flex items-center gap-4 text-xs">
                          <span>{territory.leadCount} leads</span>
                          <span>{territory.assignedTo.length} reps</span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Territory Details */}
        <div className="lg:col-span-2">
          {selectedTerritory ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle>{selectedTerritory.name}</CardTitle>
                      {getTerritoryTypeBadge(selectedTerritory.type)}
                    </div>
                    <CardDescription>{selectedTerritory.description}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="overview" className="w-full">
                  <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="rules">Rules</TabsTrigger>
                    <TabsTrigger value="team">Team</TabsTrigger>
                    <TabsTrigger value="performance">Performance</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="overview" className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Active Leads</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {selectedTerritory.leadCount.toLocaleString()}
                          </div>
                          <div className="flex items-center text-xs text-muted-foreground mt-1">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            +12% from last month
                          </div>
                        </CardContent>
                      </Card>
                      
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Pipeline Value</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            ${(selectedTerritory.revenue / 1000000).toFixed(1)}M
                          </div>
                          <div className="flex items-center text-xs text-muted-foreground mt-1">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            +25% from last month
                          </div>
                        </CardContent>
                      </Card>
                      
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Conversion Rate</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {selectedTerritory.conversionRate}%
                          </div>
                          <div className="flex items-center text-xs text-muted-foreground mt-1">
                            Above average
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                    
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        This territory has 23 high-priority leads that haven't been contacted in the last 7 days.
                      </AlertDescription>
                    </Alert>
                  </TabsContent>
                  
                  <TabsContent value="rules" className="space-y-4">
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium">Assignment Rules</h4>
                      {selectedTerritory.rules.map((rule, index) => (
                        <div key={index} className="flex items-center gap-2 p-3 border rounded-lg">
                          <Badge variant="outline">{rule.field}</Badge>
                          <span className="text-sm text-muted-foreground">{rule.operator}</span>
                          <Badge>
                            {Array.isArray(rule.value) ? rule.value.join(', ') : rule.value}
                          </Badge>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" className="w-full">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Rule
                      </Button>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="team" className="space-y-4">
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium">Assigned Team Members</h4>
                      {selectedTerritory.assignedTo.map((member, index) => (
                        <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <Users className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">{member}</p>
                              <p className="text-xs text-muted-foreground">Sales Representative</p>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" className="w-full">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Team Member
                      </Button>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="performance" className="space-y-4">
                    <Alert>
                      <TrendingUp className="h-4 w-4" />
                      <AlertDescription>
                        This territory is performing 15% above the company average for lead conversion.
                      </AlertDescription>
                    </Alert>
                    
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-medium mb-2">Top Performing Segments</h4>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Enterprise (1000+ employees)</span>
                            <span className="text-sm font-medium">32% conversion</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Technology Industry</span>
                            <span className="text-sm font-medium">28% conversion</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Recent Funding</span>
                            <span className="text-sm font-medium">25% conversion</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Select a territory to view details</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}