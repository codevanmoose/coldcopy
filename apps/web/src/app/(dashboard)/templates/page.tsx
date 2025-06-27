"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { 
  Search, Plus, MoreVertical, Edit, Copy, Trash2, Eye, 
  Star, Download, Filter, Mail, Calendar, BarChart3
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import Link from "next/link"

interface EmailTemplate {
  id: string
  name: string
  subject: string
  template_type: string
  category: string
  description?: string
  tags: string[]
  usage_count: number
  is_public: boolean
  is_system: boolean
  created_at: string
  updated_at: string
  performance_stats?: {
    open_rate?: number
    click_rate?: number
    reply_rate?: number
  }
}

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    subject: "",
    description: "",
    template_type: "custom",
    category: "sales"
  })

  // Mock data - replace with API calls
  useEffect(() => {
    const mockTemplates: EmailTemplate[] = [
      {
        id: "1",
        name: "Cold Outreach - SaaS",
        subject: "Quick question about {{company}}'s growth strategy",
        template_type: "cold_outreach",
        category: "sales",
        description: "High-converting cold email template for SaaS prospects",
        tags: ["saas", "cold", "b2b"],
        usage_count: 156,
        is_public: false,
        is_system: false,
        created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
        updated_at: new Date(Date.now() - 86400000 * 2).toISOString(),
        performance_stats: {
          open_rate: 45.2,
          click_rate: 12.8,
          reply_rate: 8.5
        }
      },
      {
        id: "2",
        name: "Follow-up #1",
        subject: "Re: {{subject}} - Following up",
        template_type: "follow_up",
        category: "sales",
        description: "First follow-up template for cold outreach",
        tags: ["follow-up", "sequence"],
        usage_count: 89,
        is_public: false,
        is_system: false,
        created_at: new Date(Date.now() - 86400000 * 14).toISOString(),
        updated_at: new Date(Date.now() - 86400000 * 5).toISOString(),
        performance_stats: {
          open_rate: 38.7,
          click_rate: 9.2,
          reply_rate: 6.1
        }
      },
      {
        id: "3",
        name: "Meeting Request",
        subject: "15-minute chat about {{company}}'s {{pain_point}}?",
        template_type: "meeting_request",
        category: "sales",
        description: "Template for requesting meetings with prospects",
        tags: ["meeting", "calendar"],
        usage_count: 67,
        is_public: false,
        is_system: false,
        created_at: new Date(Date.now() - 86400000 * 21).toISOString(),
        updated_at: new Date(Date.now() - 86400000 * 1).toISOString(),
        performance_stats: {
          open_rate: 52.1,
          click_rate: 18.3,
          reply_rate: 11.2
        }
      },
      {
        id: "4",
        name: "Thank You - Demo",
        subject: "Thanks for the demo, {{first_name}}!",
        template_type: "thank_you",
        category: "marketing",
        description: "Post-demo thank you email with next steps",
        tags: ["demo", "nurture"],
        usage_count: 34,
        is_public: false,
        is_system: false,
        created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
        updated_at: new Date(Date.now() - 86400000 * 3).toISOString(),
        performance_stats: {
          open_rate: 67.3,
          click_rate: 25.1,
          reply_rate: 15.8
        }
      },
      {
        id: "5",
        name: "Welcome Email",
        subject: "Welcome to ColdCopy, {{first_name}}! 🎉",
        template_type: "nurture",
        category: "marketing",
        description: "Welcome email for new users",
        tags: ["welcome", "onboarding"],
        usage_count: 245,
        is_public: true,
        is_system: true,
        created_at: new Date(Date.now() - 86400000 * 30).toISOString(),
        updated_at: new Date(Date.now() - 86400000 * 15).toISOString(),
        performance_stats: {
          open_rate: 78.9,
          click_rate: 34.2,
          reply_rate: 5.3
        }
      }
    ]

    setTemplates(mockTemplates)
    setIsLoading(false)
  }, [])

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesCategory = categoryFilter === "all" || template.category === categoryFilter
    const matchesType = typeFilter === "all" || template.template_type === typeFilter

    return matchesSearch && matchesCategory && matchesType
  })

  const getTypeBadge = (type: string) => {
    const badges = {
      'cold_outreach': <Badge variant="default">Cold Outreach</Badge>,
      'follow_up': <Badge variant="secondary">Follow-up</Badge>,
      'meeting_request': <Badge className="bg-purple-500">Meeting</Badge>,
      'nurture': <Badge className="bg-green-500">Nurture</Badge>,
      'thank_you': <Badge className="bg-blue-500">Thank You</Badge>,
      'reactivation': <Badge className="bg-orange-500">Reactivation</Badge>,
      'custom': <Badge variant="outline">Custom</Badge>
    }
    return badges[type as keyof typeof badges] || <Badge variant="outline">{type}</Badge>
  }

  const getCategoryBadge = (category: string) => {
    const badges = {
      'sales': <Badge variant="default">Sales</Badge>,
      'marketing': <Badge className="bg-indigo-500">Marketing</Badge>,
      'support': <Badge className="bg-yellow-500">Support</Badge>,
      'personal': <Badge variant="outline">Personal</Badge>
    }
    return badges[category as keyof typeof badges] || <Badge variant="outline">{category}</Badge>
  }

  const handleCreateTemplate = async () => {
    try {
      // API call would go here
      toast.success("Template created successfully")
      setShowCreateDialog(false)
      setNewTemplate({
        name: "",
        subject: "",
        description: "",
        template_type: "custom",
        category: "sales"
      })
    } catch (error) {
      toast.error("Failed to create template")
    }
  }

  const handleDuplicateTemplate = async (templateId: string) => {
    try {
      // API call would go here
      toast.success("Template duplicated successfully")
    } catch (error) {
      toast.error("Failed to duplicate template")
    }
  }

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      // API call would go here
      setTemplates(prev => prev.filter(t => t.id !== templateId))
      toast.success("Template deleted successfully")
    } catch (error) {
      toast.error("Failed to delete template")
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Email Templates</h1>
          <p className="text-muted-foreground">Create and manage email templates for your campaigns</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/templates/library">
              <Star className="w-4 h-4 mr-2" />
              Browse Library
            </Link>
          </Button>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Create Template
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Template</DialogTitle>
                <DialogDescription>
                  Start with a blank template or choose from our library
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Template Name</Label>
                  <Input
                    id="name"
                    value={newTemplate.name}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Cold Outreach - Tech Startups"
                  />
                </div>
                <div>
                  <Label htmlFor="subject">Email Subject</Label>
                  <Input
                    id="subject"
                    value={newTemplate.subject}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, subject: e.target.value }))}
                    placeholder="e.g., Quick question about {{company}}"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newTemplate.description}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description of when to use this template"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="type">Template Type</Label>
                    <Select value={newTemplate.template_type} onValueChange={(value) => setNewTemplate(prev => ({ ...prev, template_type: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cold_outreach">Cold Outreach</SelectItem>
                        <SelectItem value="follow_up">Follow-up</SelectItem>
                        <SelectItem value="meeting_request">Meeting Request</SelectItem>
                        <SelectItem value="nurture">Nurture</SelectItem>
                        <SelectItem value="thank_you">Thank You</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Select value={newTemplate.category} onValueChange={(value) => setNewTemplate(prev => ({ ...prev, category: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sales">Sales</SelectItem>
                        <SelectItem value="marketing">Marketing</SelectItem>
                        <SelectItem value="support">Support</SelectItem>
                        <SelectItem value="personal">Personal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCreateTemplate} className="flex-1">
                    Create & Edit
                  </Button>
                  <Button variant="outline" asChild className="flex-1">
                    <Link href="/templates/library">
                      Browse Library
                    </Link>
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Templates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{templates.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Most Used</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.max(...templates.map(t => t.usage_count))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Open Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {(templates.reduce((acc, t) => acc + (t.performance_stats?.open_rate || 0), 0) / templates.length).toFixed(1)}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Reply Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {(templates.reduce((acc, t) => acc + (t.performance_stats?.reply_rate || 0), 0) / templates.length).toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search templates..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="cold_outreach">Cold Outreach</SelectItem>
                <SelectItem value="follow_up">Follow-up</SelectItem>
                <SelectItem value="meeting_request">Meeting Request</SelectItem>
                <SelectItem value="nurture">Nurture</SelectItem>
                <SelectItem value="thank_you">Thank You</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="sales">Sales</SelectItem>
                <SelectItem value="marketing">Marketing</SelectItem>
                <SelectItem value="support">Support</SelectItem>
                <SelectItem value="personal">Personal</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Templates Table */}
      <Card>
        <CardHeader>
          <CardTitle>Templates ({filteredTemplates.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Performance</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTemplates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {template.name}
                        {template.is_system && <Badge variant="outline" className="text-xs">System</Badge>}
                        {template.is_public && <Badge variant="outline" className="text-xs">Public</Badge>}
                      </div>
                      <div className="text-sm text-muted-foreground">{template.subject}</div>
                      <div className="flex gap-1 mt-1">
                        {template.tags.map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{getTypeBadge(template.template_type)}</TableCell>
                  <TableCell>{getCategoryBadge(template.category)}</TableCell>
                  <TableCell>
                    {template.performance_stats ? (
                      <div className="text-sm">
                        <div className="flex items-center gap-2">
                          <Mail className="w-3 h-3" />
                          {template.performance_stats.open_rate?.toFixed(1)}% open
                        </div>
                        <div className="flex items-center gap-2">
                          <BarChart3 className="w-3 h-3" />
                          {template.performance_stats.reply_rate?.toFixed(1)}% reply
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">No data</span>
                    )}
                  </TableCell>
                  <TableCell>{template.usage_count}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {formatDistanceToNow(new Date(template.updated_at), { addSuffix: true })}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/templates/editor?id=${template.id}`}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/templates/preview?id=${template.id}`}>
                            <Eye className="w-4 h-4 mr-2" />
                            Preview
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicateTemplate(template.id)}>
                          <Copy className="w-4 h-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        {!template.is_system && (
                          <DropdownMenuItem 
                            onClick={() => handleDeleteTemplate(template.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}