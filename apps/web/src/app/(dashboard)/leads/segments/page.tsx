"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { 
  Plus, Users, Filter, Target, Zap, Settings, 
  MoreVertical, Edit, Trash2, RefreshCw, Download,
  Copy, Archive, Play, Pause, ChevronRight, Info,
  Tag, Sparkles, CircuitBoard, Mail, UserPlus,
  Activity, Calendar, TrendingUp, BarChart3
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface Segment {
  id: string
  name: string
  description: string
  type: 'static' | 'dynamic' | 'smart'
  status: 'active' | 'paused' | 'archived'
  color: string
  icon: string
  member_count: number
  rules: any[]
  rule_match_type: 'all' | 'any'
  auto_add_to_campaigns: boolean
  created_at: string
  last_calculated_at: string
}

interface SegmentRule {
  field_name: string
  field_type: string
  operator: string
  value: any
}

const SEGMENT_TYPES = [
  {
    value: 'dynamic',
    label: 'Dynamic Segment',
    description: 'Automatically updates based on rules',
    icon: CircuitBoard
  },
  {
    value: 'static',
    label: 'Static Segment',
    description: 'Manually add and remove leads',
    icon: Users
  },
  {
    value: 'smart',
    label: 'Smart Segment',
    description: 'AI-powered lead grouping',
    icon: Sparkles
  }
]

const FIELD_OPTIONS = [
  { value: 'lead_score', label: 'Lead Score', type: 'number' },
  { value: 'grade', label: 'Grade', type: 'string' },
  { value: 'temperature', label: 'Temperature', type: 'string' },
  { value: 'email', label: 'Email', type: 'string' },
  { value: 'company', label: 'Company', type: 'string' },
  { value: 'job_title', label: 'Job Title', type: 'string' },
  { value: 'industry', label: 'Industry', type: 'string' },
  { value: 'company_size', label: 'Company Size', type: 'number' },
  { value: 'created_at', label: 'Created Date', type: 'date' },
  { value: 'last_activity', label: 'Last Activity', type: 'date' }
]

const OPERATORS = {
  string: [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Not equals' },
    { value: 'contains', label: 'Contains' },
    { value: 'not_contains', label: 'Does not contain' },
    { value: 'starts_with', label: 'Starts with' },
    { value: 'ends_with', label: 'Ends with' },
    { value: 'is_empty', label: 'Is empty' },
    { value: 'is_not_empty', label: 'Is not empty' }
  ],
  number: [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Not equals' },
    { value: 'greater_than', label: 'Greater than' },
    { value: 'less_than', label: 'Less than' },
    { value: 'greater_equal', label: 'Greater than or equal' },
    { value: 'less_equal', label: 'Less than or equal' }
  ],
  date: [
    { value: 'date_before', label: 'Before' },
    { value: 'date_after', label: 'After' },
    { value: 'date_between', label: 'Between' }
  ]
}

const SEGMENT_COLORS = [
  '#6366F1', '#EC4899', '#10B981', '#F59E0B', 
  '#EF4444', '#8B5CF6', '#3B82F6', '#14B8A6'
]

export default function SegmentsPage() {
  const [segments, setSegments] = useState<Segment[]>([])
  const [selectedSegment, setSelectedSegment] = useState<Segment | null>(null)
  const [isCreatingSegment, setIsCreatingSegment] = useState(false)
  const [activeTab, setActiveTab] = useState("all")
  const [isLoading, setIsLoading] = useState(true)
  
  // New segment form state
  const [newSegment, setNewSegment] = useState({
    name: '',
    description: '',
    type: 'dynamic',
    color: SEGMENT_COLORS[0],
    rules: [{ field_name: 'lead_score', operator: 'greater_than', value: 50 }],
    rule_match_type: 'all' as 'all' | 'any',
    auto_add_to_campaigns: false
  })

  useEffect(() => {
    loadSegments()
  }, [])

  const loadSegments = async () => {
    setIsLoading(true)
    try {
      // Mock data - replace with API call
      const mockSegments: Segment[] = [
        {
          id: '1',
          name: 'High Value Leads',
          description: 'Leads with score above 80 and from target companies',
          type: 'dynamic',
          status: 'active',
          color: '#6366F1',
          icon: 'star',
          member_count: 156,
          rules: [
            { field_name: 'lead_score', operator: 'greater_than', value: 80 },
            { field_name: 'company_size', operator: 'greater_than', value: 100 }
          ],
          rule_match_type: 'all',
          auto_add_to_campaigns: true,
          created_at: new Date(Date.now() - 86400000 * 30).toISOString(),
          last_calculated_at: new Date(Date.now() - 3600000).toISOString()
        },
        {
          id: '2',
          name: 'Engaged Prospects',
          description: 'Leads who opened multiple emails and clicked links',
          type: 'dynamic',
          status: 'active',
          color: '#10B981',
          icon: 'activity',
          member_count: 234,
          rules: [
            { field_name: 'email_opens', operator: 'greater_than', value: 3 },
            { field_name: 'link_clicks', operator: 'greater_than', value: 1 }
          ],
          rule_match_type: 'all',
          auto_add_to_campaigns: false,
          created_at: new Date(Date.now() - 86400000 * 15).toISOString(),
          last_calculated_at: new Date(Date.now() - 7200000).toISOString()
        },
        {
          id: '3',
          name: 'Cold Leads',
          description: 'Leads with no engagement in the last 30 days',
          type: 'dynamic',
          status: 'paused',
          color: '#6B7280',
          icon: 'snowflake',
          member_count: 412,
          rules: [
            { field_name: 'last_activity', operator: 'date_before', value: 30 },
            { field_name: 'temperature', operator: 'equals', value: 'cold' }
          ],
          rule_match_type: 'any',
          auto_add_to_campaigns: false,
          created_at: new Date(Date.now() - 86400000 * 60).toISOString(),
          last_calculated_at: new Date(Date.now() - 86400000).toISOString()
        },
        {
          id: '4',
          name: 'VIP Contacts',
          description: 'Manually curated list of important contacts',
          type: 'static',
          status: 'active',
          color: '#F59E0B',
          icon: 'crown',
          member_count: 45,
          rules: [],
          rule_match_type: 'all',
          auto_add_to_campaigns: false,
          created_at: new Date(Date.now() - 86400000 * 90).toISOString(),
          last_calculated_at: new Date(Date.now() - 86400000 * 5).toISOString()
        }
      ]
      
      setSegments(mockSegments)
    } catch (error) {
      toast.error("Failed to load segments")
    } finally {
      setIsLoading(false)
    }
  }

  const createSegment = async () => {
    try {
      // API call would go here
      toast.success("Segment created successfully")
      setIsCreatingSegment(false)
      loadSegments()
    } catch (error) {
      toast.error("Failed to create segment")
    }
  }

  const updateSegmentStatus = async (segmentId: string, status: string) => {
    try {
      // API call would go here
      toast.success(`Segment ${status === 'active' ? 'activated' : 'paused'}`)
      loadSegments()
    } catch (error) {
      toast.error("Failed to update segment status")
    }
  }

  const deleteSegment = async (segmentId: string) => {
    if (confirm("Are you sure you want to delete this segment?")) {
      try {
        // API call would go here
        toast.success("Segment deleted successfully")
        loadSegments()
      } catch (error) {
        toast.error("Failed to delete segment")
      }
    }
  }

  const duplicateSegment = async (segment: Segment) => {
    try {
      // API call would go here
      toast.success("Segment duplicated successfully")
      loadSegments()
    } catch (error) {
      toast.error("Failed to duplicate segment")
    }
  }

  const recalculateSegment = async (segmentId: string) => {
    try {
      // API call would go here
      toast.success("Segment recalculated successfully")
      loadSegments()
    } catch (error) {
      toast.error("Failed to recalculate segment")
    }
  }

  const addRule = () => {
    setNewSegment({
      ...newSegment,
      rules: [...newSegment.rules, { field_name: 'email', operator: 'contains', value: '' }]
    })
  }

  const removeRule = (index: number) => {
    setNewSegment({
      ...newSegment,
      rules: newSegment.rules.filter((_, i) => i !== index)
    })
  }

  const updateRule = (index: number, field: string, value: any) => {
    const updatedRules = [...newSegment.rules]
    updatedRules[index] = { ...updatedRules[index], [field]: value }
    setNewSegment({ ...newSegment, rules: updatedRules })
  }

  const getSegmentIcon = (iconName: string) => {
    const icons: { [key: string]: any } = {
      star: Target,
      activity: Activity,
      snowflake: Filter,
      crown: Users
    }
    const Icon = icons[iconName] || Users
    return <Icon className="w-4 h-4" />
  }

  const filteredSegments = segments.filter(segment => {
    if (activeTab === 'all') return true
    if (activeTab === 'active') return segment.status === 'active'
    if (activeTab === 'dynamic') return segment.type === 'dynamic'
    if (activeTab === 'static') return segment.type === 'static'
    return true
  })

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
          <h1 className="text-3xl font-bold">Lead Segments</h1>
          <p className="text-muted-foreground">Organize leads into targeted groups</p>
        </div>
        
        <Dialog open={isCreatingSegment} onOpenChange={setIsCreatingSegment}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Segment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Segment</DialogTitle>
              <DialogDescription>
                Define rules to automatically group your leads
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Segment Name */}
              <div>
                <Label htmlFor="segment-name">Segment Name</Label>
                <Input
                  id="segment-name"
                  value={newSegment.name}
                  onChange={(e) => setNewSegment({ ...newSegment, name: e.target.value })}
                  placeholder="e.g., High Value Leads"
                />
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newSegment.description}
                  onChange={(e) => setNewSegment({ ...newSegment, description: e.target.value })}
                  placeholder="Describe the purpose of this segment..."
                />
              </div>

              {/* Segment Type */}
              <div>
                <Label>Segment Type</Label>
                <RadioGroup
                  value={newSegment.type}
                  onValueChange={(value) => setNewSegment({ ...newSegment, type: value })}
                >
                  <div className="grid grid-cols-1 gap-3 mt-2">
                    {SEGMENT_TYPES.map((type) => {
                      const Icon = type.icon
                      return (
                        <div key={type.value} className="relative">
                          <RadioGroupItem
                            value={type.value}
                            id={type.value}
                            className="peer sr-only"
                          />
                          <Label
                            htmlFor={type.value}
                            className="flex items-start gap-3 rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer"
                          >
                            <Icon className="w-5 h-5 mt-0.5" />
                            <div className="space-y-1">
                              <div className="font-medium">{type.label}</div>
                              <div className="text-sm text-muted-foreground">
                                {type.description}
                              </div>
                            </div>
                          </Label>
                        </div>
                      )
                    })}
                  </div>
                </RadioGroup>
              </div>

              {/* Color Selection */}
              <div>
                <Label>Segment Color</Label>
                <div className="flex items-center gap-2 mt-2">
                  {SEGMENT_COLORS.map((color) => (
                    <button
                      key={color}
                      className={`w-8 h-8 rounded-full border-2 ${
                        newSegment.color === color ? 'border-primary' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setNewSegment({ ...newSegment, color })}
                    />
                  ))}
                </div>
              </div>

              {/* Rules (for dynamic segments) */}
              {newSegment.type === 'dynamic' && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <Label>Segment Rules</Label>
                    <Select
                      value={newSegment.rule_match_type}
                      onValueChange={(value: 'all' | 'any') => 
                        setNewSegment({ ...newSegment, rule_match_type: value })
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Match all</SelectItem>
                        <SelectItem value="any">Match any</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    {newSegment.rules.map((rule, index) => {
                      const field = FIELD_OPTIONS.find(f => f.value === rule.field_name)
                      const operators = OPERATORS[field?.type as keyof typeof OPERATORS] || OPERATORS.string

                      return (
                        <div key={index} className="flex items-center gap-2">
                          <Select
                            value={rule.field_name}
                            onValueChange={(value) => updateRule(index, 'field_name', value)}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FIELD_OPTIONS.map((field) => (
                                <SelectItem key={field.value} value={field.value}>
                                  {field.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Select
                            value={rule.operator}
                            onValueChange={(value) => updateRule(index, 'operator', value)}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {operators.map((op) => (
                                <SelectItem key={op.value} value={op.value}>
                                  {op.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {!['is_empty', 'is_not_empty'].includes(rule.operator) && (
                            <Input
                              value={rule.value}
                              onChange={(e) => updateRule(index, 'value', e.target.value)}
                              placeholder="Value"
                              className="flex-1"
                            />
                          )}

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeRule(index)}
                            disabled={newSegment.rules.length === 1}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )
                    })}
                  </div>

                  <Button
                    variant="outline"
                    onClick={addRule}
                    className="mt-3"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Rule
                  </Button>
                </div>
              )}

              {/* Automation Settings */}
              <div className="space-y-4">
                <h3 className="font-medium">Automation Settings</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto-add to Campaigns</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically include segment members in new campaigns
                    </p>
                  </div>
                  <Switch
                    checked={newSegment.auto_add_to_campaigns}
                    onCheckedChange={(checked) => 
                      setNewSegment({ ...newSegment, auto_add_to_campaigns: checked })
                    }
                  />
                </div>
              </div>

              <Button onClick={createSegment} className="w-full">
                Create Segment
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Segments</CardTitle>
            <Filter className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{segments.length}</div>
            <p className="text-xs text-muted-foreground">
              {segments.filter(s => s.type === 'dynamic').length} dynamic
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Segments</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {segments.filter(s => s.status === 'active').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Processing leads
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Segmented</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {segments.reduce((acc, s) => acc + s.member_count, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Unique leads
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Segment Size</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(segments.reduce((acc, s) => acc + s.member_count, 0) / segments.length)}
            </div>
            <p className="text-xs text-muted-foreground">
              Leads per segment
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All Segments</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="dynamic">Dynamic</TabsTrigger>
          <TabsTrigger value="static">Static</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSegments.map((segment) => (
              <Card key={segment.id} className="relative overflow-hidden">
                <div 
                  className="absolute top-0 left-0 w-full h-1"
                  style={{ backgroundColor: segment.color }}
                />
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div 
                        className="p-2 rounded-lg"
                        style={{ backgroundColor: `${segment.color}20` }}
                      >
                        {getSegmentIcon(segment.icon)}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{segment.name}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">
                            {segment.type}
                          </Badge>
                          <Badge 
                            variant={segment.status === 'active' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {segment.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setSelectedSegment(segment)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => duplicateSegment(segment)}>
                          <Copy className="w-4 h-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        {segment.type === 'dynamic' && (
                          <DropdownMenuItem onClick={() => recalculateSegment(segment.id)}>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Recalculate
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        {segment.status === 'active' ? (
                          <DropdownMenuItem onClick={() => updateSegmentStatus(segment.id, 'paused')}>
                            <Pause className="w-4 h-4 mr-2" />
                            Pause
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => updateSegmentStatus(segment.id, 'active')}>
                            <Play className="w-4 h-4 mr-2" />
                            Activate
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem 
                          onClick={() => deleteSegment(segment.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <CardDescription className="mt-2">
                    {segment.description}
                  </CardDescription>
                </CardHeader>
                
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-muted-foreground">Members</span>
                        <span className="text-2xl font-bold">{segment.member_count}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Last updated {new Date(segment.last_calculated_at).toLocaleDateString()}
                      </div>
                    </div>
                    
                    {segment.type === 'dynamic' && segment.rules.length > 0 && (
                      <div>
                        <div className="text-sm font-medium mb-2">Rules ({segment.rule_match_type})</div>
                        <div className="space-y-1">
                          {segment.rules.slice(0, 2).map((rule, index) => (
                            <div key={index} className="text-xs text-muted-foreground">
                              {rule.field_name} {rule.operator} {rule.value}
                            </div>
                          ))}
                          {segment.rules.length > 2 && (
                            <div className="text-xs text-muted-foreground">
                              +{segment.rules.length - 2} more rules
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => setSelectedSegment(segment)}
                    >
                      View Details
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}