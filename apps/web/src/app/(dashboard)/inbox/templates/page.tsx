"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { 
  Plus, FileText, Edit3, Trash2, Copy, BarChart3,
  TrendingUp, MessageSquare, Target, Users, Calendar,
  AlertCircle, CheckCircle2, XCircle, HelpCircle, Mail,
  MoreVertical, Search, Filter, Tag, Sparkles
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface ReplyTemplate {
  id: string
  name: string
  description: string
  intent: string
  tone: string
  template_text: string
  variables: string[]
  usage_count: number
  success_rate: number
  is_active: boolean
  created_at: string
}

const INTENT_OPTIONS = [
  { value: 'interested', label: 'Interested', icon: CheckCircle2 },
  { value: 'not_interested', label: 'Not Interested', icon: XCircle },
  { value: 'needs_info', label: 'Needs Information', icon: HelpCircle },
  { value: 'scheduling', label: 'Scheduling', icon: Calendar },
  { value: 'objection', label: 'Has Objections', icon: AlertCircle },
  { value: 'referral', label: 'Referral', icon: Users },
  { value: 'unsubscribe', label: 'Unsubscribe', icon: Mail },
  { value: 'other', label: 'Other', icon: MessageSquare }
]

const TONE_OPTIONS = [
  { value: 'professional', label: 'Professional' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'casual', label: 'Casual' },
  { value: 'formal', label: 'Formal' },
  { value: 'enthusiastic', label: 'Enthusiastic' },
  { value: 'empathetic', label: 'Empathetic' }
]

const VARIABLE_SUGGESTIONS = [
  '{first_name}',
  '{last_name}',
  '{company}',
  '{job_title}',
  '{industry}',
  '{campaign_name}',
  '{product_name}',
  '{meeting_link}',
  '{calendar_link}',
  '{case_study_link}'
]

export default function ReplyTemplatesPage() {
  const [templates, setTemplates] = useState<ReplyTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<ReplyTemplate | null>(null)
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterIntent, setFilterIntent] = useState("all")
  const [activeTab, setActiveTab] = useState("all")
  
  // New template form state
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    intent: 'interested',
    tone: 'professional',
    template_text: '',
    variables: [] as string[]
  })

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    try {
      // Mock data - replace with API call
      const mockTemplates: ReplyTemplate[] = [
        {
          id: '1',
          name: 'Interested - Schedule Demo',
          description: 'For leads expressing interest and ready to see a demo',
          intent: 'interested',
          tone: 'professional',
          template_text: `Hi {first_name},

Thank you for your interest in our solution! I'm excited to show you how we can help {company} improve their sales process.

I have availability for a 30-minute demo this week:
- Tuesday at 2 PM EST
- Wednesday at 10 AM EST
- Thursday at 3 PM EST

You can also book directly using my calendar link: {calendar_link}

Looking forward to connecting!

Best regards,`,
          variables: ['first_name', 'company', 'calendar_link'],
          usage_count: 156,
          success_rate: 0.82,
          is_active: true,
          created_at: new Date(Date.now() - 86400000 * 30).toISOString()
        },
        {
          id: '2',
          name: 'Not Interested - Graceful Exit',
          description: 'Professional response for uninterested leads',
          intent: 'not_interested',
          tone: 'empathetic',
          template_text: `Hi {first_name},

I completely understand and appreciate your honesty. Timing is everything in business.

If anything changes or you'd like to revisit this in the future, please don't hesitate to reach out. I'll make sure you're removed from our outreach list.

Wishing you and {company} continued success!

Best regards,`,
          variables: ['first_name', 'company'],
          usage_count: 89,
          success_rate: 0.95,
          is_active: true,
          created_at: new Date(Date.now() - 86400000 * 45).toISOString()
        },
        {
          id: '3',
          name: 'Information Request - Detailed',
          description: 'Comprehensive response for information seekers',
          intent: 'needs_info',
          tone: 'professional',
          template_text: `Hi {first_name},

Great questions! Let me provide you with the information you're looking for:

[Answer their specific questions here]

I've also attached a case study from a similar company in {industry} that shows how they achieved [specific result].

Would it be helpful to have a brief call to discuss how this would work specifically for {company}? I'm happy to answer any other questions you might have.

Best regards,`,
          variables: ['first_name', 'industry', 'company'],
          usage_count: 234,
          success_rate: 0.78,
          is_active: true,
          created_at: new Date(Date.now() - 86400000 * 20).toISOString()
        },
        {
          id: '4',
          name: 'Objection - Price Concern',
          description: 'Address pricing objections with value focus',
          intent: 'objection',
          tone: 'empathetic',
          template_text: `Hi {first_name},

I understand price is an important consideration. Many of our clients initially had the same concern.

What they found was that the ROI typically covers the investment within {timeframe}. For example, {similar_company} saw a {percentage}% increase in {metric} within the first quarter.

Would you be open to exploring a custom package that fits {company}'s budget while still delivering the results you need?

Happy to discuss options that work for you.

Best regards,`,
          variables: ['first_name', 'timeframe', 'similar_company', 'percentage', 'metric', 'company'],
          usage_count: 67,
          success_rate: 0.69,
          is_active: true,
          created_at: new Date(Date.now() - 86400000 * 60).toISOString()
        }
      ]
      
      setTemplates(mockTemplates)
    } catch (error) {
      toast.error("Failed to load templates")
    }
  }

  const createTemplate = async () => {
    try {
      // Extract variables from template text
      const detectedVariables = newTemplate.template_text.match(/\{(\w+)\}/g)?.map(v => v.slice(1, -1)) || []
      
      // API call would go here
      toast.success("Template created successfully")
      setIsCreatingTemplate(false)
      loadTemplates()
    } catch (error) {
      toast.error("Failed to create template")
    }
  }

  const updateTemplate = async (templateId: string, updates: Partial<ReplyTemplate>) => {
    try {
      // API call would go here
      toast.success("Template updated successfully")
      loadTemplates()
    } catch (error) {
      toast.error("Failed to update template")
    }
  }

  const deleteTemplate = async (templateId: string) => {
    if (confirm("Are you sure you want to delete this template?")) {
      try {
        // API call would go here
        toast.success("Template deleted successfully")
        loadTemplates()
      } catch (error) {
        toast.error("Failed to delete template")
      }
    }
  }

  const duplicateTemplate = async (template: ReplyTemplate) => {
    try {
      // API call would go here
      toast.success("Template duplicated successfully")
      loadTemplates()
    } catch (error) {
      toast.error("Failed to duplicate template")
    }
  }

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('template-text') as HTMLTextAreaElement
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = newTemplate.template_text
    const newText = text.substring(0, start) + variable + text.substring(end)
    
    setNewTemplate({ ...newTemplate, template_text: newText })
    
    // Reset cursor position
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + variable.length
      textarea.focus()
    }, 0)
  }

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesIntent = filterIntent === 'all' || template.intent === filterIntent
    const matchesTab = activeTab === 'all' || 
                      (activeTab === 'active' && template.is_active) ||
                      (activeTab === 'inactive' && !template.is_active)
    
    return matchesSearch && matchesIntent && matchesTab
  })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reply Templates</h1>
          <p className="text-muted-foreground">Pre-written responses for common scenarios</p>
        </div>
        
        <Dialog open={isCreatingTemplate} onOpenChange={setIsCreatingTemplate}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Reply Template</DialogTitle>
              <DialogDescription>
                Create reusable templates for common reply scenarios
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Template Name */}
              <div>
                <Label htmlFor="template-name">Template Name</Label>
                <Input
                  id="template-name"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                  placeholder="e.g., Interested - Schedule Demo"
                />
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newTemplate.description}
                  onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                  placeholder="Brief description of when to use this template..."
                  rows={2}
                />
              </div>

              {/* Intent & Tone */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Reply Intent</Label>
                  <Select
                    value={newTemplate.intent}
                    onValueChange={(value) => setNewTemplate({ ...newTemplate, intent: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INTENT_OPTIONS.map((intent) => (
                        <SelectItem key={intent.value} value={intent.value}>
                          <div className="flex items-center gap-2">
                            <intent.icon className="w-4 h-4" />
                            {intent.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Tone</Label>
                  <Select
                    value={newTemplate.tone}
                    onValueChange={(value) => setNewTemplate({ ...newTemplate, tone: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TONE_OPTIONS.map((tone) => (
                        <SelectItem key={tone.value} value={tone.value}>
                          {tone.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Template Text */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="template-text">Template Text</Label>
                  <div className="text-xs text-muted-foreground">
                    Use {'{variables}'} for dynamic content
                  </div>
                </div>
                <Textarea
                  id="template-text"
                  value={newTemplate.template_text}
                  onChange={(e) => setNewTemplate({ ...newTemplate, template_text: e.target.value })}
                  placeholder="Write your template here..."
                  rows={10}
                  className="font-mono text-sm"
                />
                
                {/* Variable Shortcuts */}
                <div className="mt-3">
                  <p className="text-sm font-medium mb-2">Quick Insert Variables:</p>
                  <div className="flex flex-wrap gap-2">
                    {VARIABLE_SUGGESTIONS.map((variable) => (
                      <Button
                        key={variable}
                        variant="outline"
                        size="sm"
                        onClick={() => insertVariable(variable)}
                      >
                        <Tag className="w-3 h-3 mr-1" />
                        {variable}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <Button onClick={createTemplate} className="w-full">
                Create Template
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates..."
            className="pl-10"
          />
        </div>
        
        <Select value={filterIntent} onValueChange={setFilterIntent}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Intents</SelectItem>
            {INTENT_OPTIONS.map((intent) => (
              <SelectItem key={intent.value} value={intent.value}>
                <div className="flex items-center gap-2">
                  <intent.icon className="w-4 h-4" />
                  {intent.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Templates</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{templates.length}</div>
            <p className="text-xs text-muted-foreground">
              {templates.filter(t => t.is_active).length} active
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Usage</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {templates.reduce((sum, t) => sum + t.usage_count, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Across all templates
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(templates.reduce((sum, t) => sum + t.success_rate, 0) / templates.length * 100)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Positive responses
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Most Used</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {templates.sort((a, b) => b.usage_count - a.usage_count)[0]?.name.split(' - ')[0] || 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              Template category
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All Templates</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="inactive">Inactive</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          <div className="grid grid-cols-1 gap-4">
            {filteredTemplates.map((template) => {
              const intentConfig = INTENT_OPTIONS.find(i => i.value === template.intent)
              const Icon = intentConfig?.icon || MessageSquare
              
              return (
                <Card key={template.id} className={!template.is_active ? 'opacity-60' : ''}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Icon className="w-5 h-5" />
                          <CardTitle className="text-lg">{template.name}</CardTitle>
                          <Badge variant="secondary">{template.tone}</Badge>
                          {!template.is_active && (
                            <Badge variant="outline">Inactive</Badge>
                          )}
                        </div>
                        <CardDescription>{template.description}</CardDescription>
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
                          <DropdownMenuItem onClick={() => setSelectedTemplate(template)}>
                            <Edit3 className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => duplicateTemplate(template)}>
                            <Copy className="w-4 h-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => updateTemplate(template.id, { is_active: !template.is_active })}
                          >
                            <Switch className="w-4 h-4 mr-2" />
                            {template.is_active ? 'Deactivate' : 'Activate'}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => deleteTemplate(template.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Template Preview */}
                      <div className="p-4 bg-muted rounded-lg">
                        <pre className="whitespace-pre-wrap text-sm font-mono">
                          {template.template_text.substring(0, 200)}...
                        </pre>
                      </div>
                      
                      {/* Variables */}
                      {template.variables.length > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Variables:</span>
                          <div className="flex flex-wrap gap-1">
                            {template.variables.map((variable) => (
                              <Badge key={variable} variant="outline" className="text-xs">
                                {variable}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Usage Stats */}
                      <div className="flex items-center justify-between pt-4 border-t">
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <BarChart3 className="w-4 h-4 text-muted-foreground" />
                            <span>{template.usage_count} uses</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <TrendingUp className="w-4 h-4 text-muted-foreground" />
                            <span>{Math.round(template.success_rate * 100)}% success</span>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          Created {new Date(template.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}