'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Plus,
  Library,
  Edit,
  Eye,
  Settings,
  Sparkles
} from 'lucide-react'
import { TemplateLibrary } from './template-library'
import { TemplateEditor } from './template-editor'
import { TemplatePreview } from './template-preview'

interface TemplateBlock {
  id: string
  type: 'text' | 'heading' | 'image' | 'button' | 'divider' | 'spacer' | 'variable'
  content: string
  styles: {
    fontSize?: string
    fontWeight?: string
    color?: string
    backgroundColor?: string
    textAlign?: 'left' | 'center' | 'right'
    padding?: string
    margin?: string
    borderRadius?: string
    border?: string
  }
  metadata?: {
    imageUrl?: string
    linkUrl?: string
    buttonText?: string
    variableName?: string
    alt?: string
  }
}

interface EmailTemplate {
  id: string
  name: string
  description: string
  category: string
  blocks: TemplateBlock[]
  variables: string[]
  styles: {
    backgroundColor: string
    fontFamily: string
    maxWidth: string
  }
  previewText: string
  subject: string
  isPublic?: boolean
  tags?: string[]
  thumbnail?: string
  usageCount?: number
  lastModified?: string
  author?: string
  isFavorite?: boolean
}

type ViewMode = 'library' | 'editor' | 'preview'

export function TemplatesPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('library')
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null)
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Load templates from API
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const response = await fetch('/api/templates')
        if (response.ok) {
          const data = await response.json()
          setTemplates(data.templates || [])
        }
      } catch (error) {
        console.error('Failed to load templates:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadTemplates()
  }, [])

  const handleCreateTemplate = () => {
    setSelectedTemplate(null)
    setViewMode('editor')
  }

  const handleEditTemplate = (template: EmailTemplate) => {
    setSelectedTemplate(template)
    setViewMode('editor')
  }

  const handlePreviewTemplate = (template: EmailTemplate) => {
    setSelectedTemplate(template)
    setViewMode('preview')
  }

  const handleSaveTemplate = async (template: EmailTemplate) => {
    try {
      const isUpdate = template.id && selectedTemplate
      const url = isUpdate ? `/api/templates/${template.id}` : '/api/templates'
      const method = isUpdate ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(template),
      })

      if (response.ok) {
        const savedTemplate = await response.json()
        
        if (isUpdate) {
          setTemplates(templates.map(t => 
            t.id === savedTemplate.id ? savedTemplate : t
          ))
        } else {
          setTemplates([savedTemplate, ...templates])
        }

        setViewMode('library')
        setSelectedTemplate(null)
      } else {
        console.error('Failed to save template')
      }
    } catch (error) {
      console.error('Error saving template:', error)
    }
  }

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      const response = await fetch(`/api/templates/${templateId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setTemplates(templates.filter(t => t.id !== templateId))
      } else {
        console.error('Failed to delete template')
      }
    } catch (error) {
      console.error('Error deleting template:', error)
    }
  }

  const handleDuplicateTemplate = async (templateId: string) => {
    try {
      const response = await fetch(`/api/templates/${templateId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'duplicate' }),
      })

      if (response.ok) {
        const duplicatedTemplate = await response.json()
        setTemplates([duplicatedTemplate, ...templates])
      } else {
        console.error('Failed to duplicate template')
      }
    } catch (error) {
      console.error('Error duplicating template:', error)
    }
  }

  if (viewMode === 'editor') {
    return (
      <TemplateEditor
        template={selectedTemplate}
        onSave={handleSaveTemplate}
        onCancel={() => {
          setViewMode('library')
          setSelectedTemplate(null)
        }}
      />
    )
  }

  if (viewMode === 'preview' && selectedTemplate) {
    return (
      <div>
        <TemplatePreview
          template={selectedTemplate}
          isOpen={true}
          onClose={() => {
            setViewMode('library')
            setSelectedTemplate(null)
          }}
          showCode={true}
        />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Email Templates</h1>
          <p className="text-xl text-muted-foreground mt-2">
            Create, customize, and manage email templates for your campaigns
          </p>
        </div>

        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={() => setViewMode('library')}>
            <Library className="h-4 w-4 mr-2" />
            Template Library
          </Button>
          <Button onClick={handleCreateTemplate}>
            <Plus className="h-4 w-4 mr-2" />
            Create Template
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Templates</CardTitle>
            <Library className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{templates.length}</div>
            <p className="text-xs text-muted-foreground">
              +2 from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Public Templates</CardTitle>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {templates.filter(t => t.isPublic).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Available to all users
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Most Used</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.max(...templates.map(t => t.usageCount || 0), 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Total usage count
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(templates.map(t => t.category)).size}
            </div>
            <p className="text-xs text-muted-foreground">
              Different categories
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Category Distribution */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Category Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Array.from(new Set(templates.map(t => t.category))).map(category => {
              const count = templates.filter(t => t.category === category).length
              return (
                <Badge key={category} variant="outline" className="px-3 py-1">
                  {category} ({count})
                </Badge>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Template Library */}
      <TemplateLibrary
        templates={templates}
        onEdit={handleEditTemplate}
        onPreview={handlePreviewTemplate}
        onDelete={handleDeleteTemplate}
        onDuplicate={handleDuplicateTemplate}
        isLoading={isLoading}
      />
    </div>
  )
}