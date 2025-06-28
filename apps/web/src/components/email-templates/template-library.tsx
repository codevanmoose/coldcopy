'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  Search,
  Filter,
  Star,
  Eye,
  Copy,
  Edit,
  Trash2,
  Plus,
  Download,
  Upload,
  Grid3X3,
  List,
  SortAsc,
  MoreHorizontal
} from 'lucide-react'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

interface EmailTemplate {
  id: string
  name: string
  description: string
  category: string
  thumbnail?: string
  isPublic?: boolean
  isFavorite?: boolean
  usageCount?: number
  lastModified?: string
  author?: string
  tags?: string[]
  variables?: string[]
}

interface TemplateLibraryProps {
  templates?: EmailTemplate[]
  onEdit?: (template: EmailTemplate) => void
  onPreview?: (template: EmailTemplate) => void
  onDelete?: (templateId: string) => void
  onDuplicate?: (templateId: string) => void
  isLoading?: boolean
}

const templateCategories = [
  'All Templates',
  'Cold Outreach',
  'Follow-up',
  'Meeting Request',
  'Introduction',
  'Product Demo',
  'Pricing & Sales',
  'Customer Success',
  'Partnership',
  'Event Invitation',
  'Newsletter',
  'Announcement'
]

export function TemplateLibrary({ 
  templates: propTemplates = [], 
  onEdit,
  onPreview, 
  onDelete,
  onDuplicate,
  isLoading = false 
}: TemplateLibraryProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>(propTemplates)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All Templates')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [sortBy, setSortBy] = useState<'name' | 'usage' | 'modified'>('modified')
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)

  // Update templates when props change
  React.useEffect(() => {
    setTemplates(propTemplates)
  }, [propTemplates])

  // Filter templates
  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    
    const matchesCategory = selectedCategory === 'All Templates' || 
                           template.category === selectedCategory
    
    const matchesFavorites = !showFavoritesOnly || template.isFavorite

    return matchesSearch && matchesCategory && matchesFavorites
  })

  // Sort templates
  const sortedTemplates = [...filteredTemplates].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name)
      case 'usage':
        return b.usageCount - a.usageCount
      case 'modified':
        return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
      default:
        return 0
    }
  })

  const toggleFavorite = (templateId: string) => {
    setTemplates(templates.map(template =>
      template.id === templateId
        ? { ...template, isFavorite: !template.isFavorite }
        : template
    ))
  }

  const duplicateTemplate = (templateId: string) => {
    if (onDuplicate) {
      onDuplicate(templateId)
    } else {
      // Fallback for when no callback is provided
      const template = templates.find(t => t.id === templateId)
      if (template) {
        const duplicated = {
          ...template,
          id: Date.now().toString(),
          name: `${template.name} (Copy)`,
          isPublic: false,
          author: 'You',
          lastModified: new Date().toISOString().split('T')[0],
          usageCount: 0
        }
        setTemplates([duplicated, ...templates])
      }
    }
  }

  const deleteTemplate = (templateId: string) => {
    if (onDelete) {
      onDelete(templateId)
    } else {
      // Fallback for when no callback is provided
      setTemplates(templates.filter(t => t.id !== templateId))
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Email Templates</h1>
          <p className="text-muted-foreground">
            Create, organize, and reuse email templates for your campaigns
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Template
          </Button>
        </div>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Category Filter */}
            <div className="w-full lg:w-48">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {templateCategories.map(category => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort */}
            <div className="w-full lg:w-40">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'name' | 'usage' | 'modified')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="modified">Last Modified</option>
                <option value="name">Name A-Z</option>
                <option value="usage">Most Used</option>
              </select>
            </div>

            {/* View Mode */}
            <div className="flex items-center border rounded-md">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="rounded-r-none"
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="rounded-l-none"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>

            {/* Favorites Toggle */}
            <Button
              variant={showFavoritesOnly ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            >
              <Star className={`h-4 w-4 mr-2 ${showFavoritesOnly ? 'fill-current' : ''}`} />
              Favorites
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Template Grid/List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-2 text-muted-foreground">Loading templates...</span>
        </div>
      ) : (
        <div className={
          viewMode === 'grid' 
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
            : 'space-y-4'
        }>
          {sortedTemplates.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
              viewMode={viewMode}
              onFavorite={() => toggleFavorite(template.id)}
              onDuplicate={() => duplicateTemplate(template.id)}
              onDelete={() => deleteTemplate(template.id)}
              onEdit={() => onEdit?.(template)}
              onPreview={() => onPreview?.(template)}
            />
          ))}
        </div>
      )}

      {sortedTemplates.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No templates found</h3>
            <p className="text-muted-foreground mb-4">
              Try adjusting your search or filters, or create a new template.
            </p>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create New Template
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Results Count */}
      <div className="text-sm text-muted-foreground text-center">
        Showing {sortedTemplates.length} of {templates.length} templates
      </div>
    </div>
  )
}

function TemplateCard({
  template,
  viewMode,
  onFavorite,
  onDuplicate,
  onDelete,
  onEdit,
  onPreview
}: {
  template: EmailTemplate
  viewMode: 'grid' | 'list'
  onFavorite: () => void
  onDuplicate: () => void
  onDelete: () => void
  onEdit?: () => void
  onPreview?: () => void
}) {
  if (viewMode === 'list') {
    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-6">
          <div className="flex items-center space-x-4">
            {/* Thumbnail */}
            <div className="w-16 h-16 bg-gray-200 rounded-lg flex-shrink-0 flex items-center justify-center">
              <span className="text-xs text-gray-500">Preview</span>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <h3 className="font-semibold truncate">{template.name}</h3>
                {template.isFavorite && (
                  <Star className="h-4 w-4 text-yellow-500 fill-current flex-shrink-0" />
                )}
                <Badge variant="outline" className="flex-shrink-0">
                  {template.category}
                </Badge>
                {!template.isPublic && (
                  <Badge variant="secondary" className="flex-shrink-0">
                    Private
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                {template.description}
              </p>
              <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                <span>Used {template.usageCount} times</span>
                <span>Modified {template.lastModified}</span>
                <span>By {template.author}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-2 flex-shrink-0">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => onPreview?.(template)}
              >
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
              <Button 
                size="sm"
                onClick={() => onEdit?.(template)}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onFavorite}>
                    <Star className={`h-4 w-4 mr-2 ${template.isFavorite ? 'fill-current' : ''}`} />
                    {template.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onDuplicate}>
                    <Copy className="h-4 w-4 mr-2" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onDelete} className="text-red-600">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        {/* Thumbnail */}
        <div className="aspect-video bg-gray-200 rounded-lg mb-3 flex items-center justify-center relative overflow-hidden">
          <span className="text-sm text-gray-500">Email Preview</span>
          
          {/* Overlay Actions */}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
            <Button 
              variant="secondary" 
              size="sm"
              onClick={() => onPreview?.(template)}
            >
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
            <Button 
              size="sm"
              onClick={() => onEdit?.(template)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>

          {/* Favorite Star */}
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-2 right-2 p-1 h-auto bg-white/80 hover:bg-white"
            onClick={onFavorite}
          >
            <Star className={`h-4 w-4 ${template.isFavorite ? 'text-yellow-500 fill-current' : 'text-gray-400'}`} />
          </Button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg line-clamp-1">{template.name}</CardTitle>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onDuplicate}>
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDelete} className="text-red-600">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <CardDescription className="line-clamp-2 min-h-[2.5rem]">
            {template.description}
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Tags */}
          <div className="flex flex-wrap gap-1">
            <Badge variant="outline">{template.category}</Badge>
            {!template.isPublic && (
              <Badge variant="secondary">Private</Badge>
            )}
          </div>

          {/* Variables */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Variables:</p>
            <div className="flex flex-wrap gap-1">
              {template.variables.slice(0, 3).map(variable => (
                <Badge key={variable} variant="outline" className="text-xs">
                  {`{{${variable}}}`}
                </Badge>
              ))}
              {template.variables.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{template.variables.length - 3} more
                </Badge>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Used {template.usageCount}x</span>
            <span>{template.lastModified}</span>
          </div>

          {/* Actions */}
          <div className="flex space-x-2 pt-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              onClick={() => onPreview?.(template)}
            >
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
            <Button 
              size="sm" 
              className="flex-1"
              onClick={() => onEdit?.(template)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}