'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { FileText, Plus, MoreVertical, Edit, Trash2, Copy } from 'lucide-react'

export interface EmailTemplate {
  id: string
  name: string
  description?: string
  subject: string
  body: string
  tags?: string[]
  isDefault?: boolean
  createdAt: string
  updatedAt: string
}

interface EmailTemplatesProps {
  templates: EmailTemplate[]
  onTemplateSelect?: (template: EmailTemplate) => void
  onTemplateCreate?: (template: Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt'>) => void
  onTemplateUpdate?: (id: string, template: Partial<EmailTemplate>) => void
  onTemplateDelete?: (id: string) => void
}

export function EmailTemplates({
  templates,
  onTemplateSelect,
  onTemplateCreate,
  onTemplateUpdate,
  onTemplateDelete,
}: EmailTemplatesProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    subject: '',
    body: '',
    tags: '',
  })

  const handleCreate = () => {
    if (!formData.name || !formData.subject || !formData.body) {
      toast.error('Please fill in all required fields')
      return
    }

    if (onTemplateCreate) {
      onTemplateCreate({
        name: formData.name,
        description: formData.description,
        subject: formData.subject,
        body: formData.body,
        tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
      })
    }

    setCreateDialogOpen(false)
    setFormData({
      name: '',
      description: '',
      subject: '',
      body: '',
      tags: '',
    })
    toast.success('Template created successfully')
  }

  const handleUpdate = () => {
    if (!editingTemplate || !formData.name || !formData.subject || !formData.body) {
      toast.error('Please fill in all required fields')
      return
    }

    if (onTemplateUpdate) {
      onTemplateUpdate(editingTemplate.id, {
        name: formData.name,
        description: formData.description,
        subject: formData.subject,
        body: formData.body,
        tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
      })
    }

    setEditingTemplate(null)
    toast.success('Template updated successfully')
  }

  const handleDelete = (template: EmailTemplate) => {
    if (window.confirm(`Are you sure you want to delete "${template.name}"?`)) {
      if (onTemplateDelete) {
        onTemplateDelete(template.id)
      }
      toast.success('Template deleted successfully')
    }
  }

  const startEdit = (template: EmailTemplate) => {
    setEditingTemplate(template)
    setFormData({
      name: template.name,
      description: template.description || '',
      subject: template.subject,
      body: template.body,
      tags: template.tags?.join(', ') || '',
    })
  }

  const copyTemplate = (template: EmailTemplate) => {
    navigator.clipboard.writeText(`Subject: ${template.subject}\n\n${template.body}`)
    toast.success('Template copied to clipboard')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Email Templates</h3>
          <p className="text-sm text-muted-foreground">
            Pre-written templates to speed up your outreach
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Email Template</DialogTitle>
              <DialogDescription>
                Create a reusable email template for your campaigns
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name</Label>
                <Input
                  id="name"
                  placeholder="Follow-up Template"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Input
                  id="description"
                  placeholder="Used for second follow-up emails"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Subject Line</Label>
                <Input
                  id="subject"
                  placeholder="Quick follow-up on my last email"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="body">Email Body</Label>
                <Textarea
                  id="body"
                  placeholder="Hi {{name}},&#10;&#10;I wanted to follow up on my previous email..."
                  rows={8}
                  value={formData.body}
                  onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Use {"{{name}}"}, {"{{company}}"}, {"{{title}}"} for personalization
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tags">Tags (comma-separated)</Label>
                <Input
                  id="tags"
                  placeholder="follow-up, sales, b2b"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate}>Create Template</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => (
          <Card key={template.id} className="relative">
            {template.isDefault && (
              <Badge className="absolute top-4 right-4" variant="secondary">
                Default
              </Badge>
            )}
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">{template.name}</CardTitle>
                  {template.description && (
                    <CardDescription className="mt-1">
                      {template.description}
                    </CardDescription>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onTemplateSelect?.(template)}>
                      <FileText className="mr-2 h-4 w-4" />
                      Use Template
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => copyTemplate(template)}>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => startEdit(template)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDelete(template)}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-sm">
                  <span className="font-medium">Subject:</span> {template.subject}
                </div>
                <div className="text-sm text-muted-foreground line-clamp-3">
                  {template.body}
                </div>
                {template.tags && template.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {template.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingTemplate} onOpenChange={(open) => !open && setEditingTemplate(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Email Template</DialogTitle>
            <DialogDescription>
              Update your email template
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Template Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description (Optional)</Label>
              <Input
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-subject">Subject Line</Label>
              <Input
                id="edit-subject"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-body">Email Body</Label>
              <Textarea
                id="edit-body"
                rows={8}
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-tags">Tags (comma-separated)</Label>
              <Input
                id="edit-tags"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTemplate(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate}>Update Template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}