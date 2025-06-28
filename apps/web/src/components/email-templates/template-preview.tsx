'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  Eye,
  Code,
  Download,
  Share,
  Copy,
  Monitor,
  Smartphone,
  Tablet,
  X
} from 'lucide-react'

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
}

interface TemplatePreviewProps {
  template: EmailTemplate
  isOpen: boolean
  onClose: () => void
  sampleData?: Record<string, string>
  showCode?: boolean
}

type ViewportMode = 'desktop' | 'tablet' | 'mobile'

const defaultSampleData = {
  first_name: 'John',
  last_name: 'Doe',
  company: 'Acme Inc',
  title: 'CEO',
  industry: 'Technology',
  city: 'San Francisco',
  website: 'acme.com'
}

export function TemplatePreview({ 
  template, 
  isOpen, 
  onClose, 
  sampleData = defaultSampleData,
  showCode = false 
}: TemplatePreviewProps) {
  const [viewMode, setViewMode] = useState<'preview' | 'html'>('preview')
  const [viewportMode, setViewportMode] = useState<ViewportMode>('desktop')

  if (!isOpen) return null

  // Replace variables in content
  const replaceVariables = (content: string) => {
    let processedContent = content
    Object.entries(sampleData).forEach(([key, value]) => {
      const variablePattern = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
      processedContent = processedContent.replace(variablePattern, value)
    })
    return processedContent
  }

  // Render email block with variable replacement
  const renderBlock = (block: TemplateBlock) => {
    const style = {
      fontSize: block.styles.fontSize,
      fontWeight: block.styles.fontWeight,
      color: block.styles.color,
      backgroundColor: block.styles.backgroundColor,
      textAlign: block.styles.textAlign,
      padding: block.styles.padding,
      margin: block.styles.margin,
      borderRadius: block.styles.borderRadius,
      border: block.styles.border
    }

    switch (block.type) {
      case 'heading':
      case 'text':
        return (
          <div key={block.id} style={style}>
            {replaceVariables(block.content)}
          </div>
        )

      case 'image':
        return (
          <div key={block.id} style={style}>
            {block.metadata?.imageUrl ? (
              <img
                src={block.metadata.imageUrl}
                alt={block.metadata?.alt || ''}
                style={{ maxWidth: '100%', height: 'auto' }}
              />
            ) : (
              <div style={{
                backgroundColor: '#f3f4f6',
                padding: '2rem',
                textAlign: 'center',
                color: '#6b7280',
                borderRadius: '0.5rem'
              }}>
                Image placeholder
              </div>
            )}
          </div>
        )

      case 'button':
        return (
          <div key={block.id} style={{ textAlign: block.styles.textAlign, ...style }}>
            <a
              href={block.metadata?.linkUrl || '#'}
              style={{
                display: 'inline-block',
                backgroundColor: block.styles.backgroundColor || '#007bff',
                color: block.styles.color || '#ffffff',
                padding: '12px 24px',
                borderRadius: block.styles.borderRadius || '4px',
                textDecoration: 'none',
                fontSize: block.styles.fontSize || '16px',
                fontWeight: block.styles.fontWeight || 'bold'
              }}
            >
              {replaceVariables(block.metadata?.buttonText || 'Click Here')}
            </a>
          </div>
        )

      case 'divider':
        return (
          <div key={block.id} style={style}>
            <hr
              style={{
                border: 'none',
                borderTop: block.styles.border || '1px solid #e0e0e0',
                margin: block.styles.margin || '20px 0'
              }}
            />
          </div>
        )

      case 'spacer':
        return (
          <div
            key={block.id}
            style={{
              height: block.styles.padding || '20px',
              ...style
            }}
          />
        )

      case 'variable':
        return (
          <span key={block.id} style={style}>
            {replaceVariables(`{{${block.metadata?.variableName || 'variable'}}}`)}
          </span>
        )

      default:
        return <div key={block.id} style={style}>{replaceVariables(block.content)}</div>
    }
  }

  // Generate HTML code
  const generateHTML = () => {
    const htmlBlocks = template.blocks.map(block => {
      const style = Object.entries(block.styles)
        .filter(([_, value]) => value)
        .map(([key, value]) => `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value}`)
        .join('; ')

      switch (block.type) {
        case 'heading':
        case 'text':
          const tag = block.type === 'heading' ? 'h2' : 'p'
          return `<${tag} style="${style}">${replaceVariables(block.content)}</${tag}>`

        case 'image':
          return block.metadata?.imageUrl
            ? `<img src="${block.metadata.imageUrl}" alt="${block.metadata?.alt || ''}" style="${style} max-width: 100%; height: auto;" />`
            : `<div style="${style} background-color: #f3f4f6; padding: 2rem; text-align: center; color: #6b7280; border-radius: 0.5rem;">Image placeholder</div>`

        case 'button':
          return `<div style="text-align: ${block.styles.textAlign || 'left'}; ${style}">
            <a href="${block.metadata?.linkUrl || '#'}" style="display: inline-block; background-color: ${block.styles.backgroundColor || '#007bff'}; color: ${block.styles.color || '#ffffff'}; padding: 12px 24px; border-radius: ${block.styles.borderRadius || '4px'}; text-decoration: none; font-size: ${block.styles.fontSize || '16px'}; font-weight: ${block.styles.fontWeight || 'bold'};">
              ${replaceVariables(block.metadata?.buttonText || 'Click Here')}
            </a>
          </div>`

        case 'divider':
          return `<hr style="border: none; border-top: ${block.styles.border || '1px solid #e0e0e0'}; margin: ${block.styles.margin || '20px 0'};" />`

        case 'spacer':
          return `<div style="height: ${block.styles.padding || '20px'};"></div>`

        default:
          return `<div style="${style}">${replaceVariables(block.content)}</div>`
      }
    }).join('\n    ')

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${replaceVariables(template.subject)}</title>
</head>
<body style="margin: 0; padding: 20px; background-color: #f5f5f5; font-family: ${template.styles.fontFamily};">
  <div style="max-width: ${template.styles.maxWidth}; margin: 0 auto; background-color: ${template.styles.backgroundColor}; padding: 24px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
    ${htmlBlocks}
  </div>
</body>
</html>`
  }

  const getViewportStyles = () => {
    switch (viewportMode) {
      case 'mobile':
        return { maxWidth: '375px', minHeight: '667px' }
      case 'tablet':
        return { maxWidth: '768px', minHeight: '1024px' }
      default:
        return { maxWidth: '1200px', minHeight: '800px' }
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      // You could add a toast notification here
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold">{template.name}</h2>
            <p className="text-muted-foreground">{template.description}</p>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline">{template.category}</Badge>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <div className="flex items-center space-x-2">
            {/* View Mode Toggle */}
            <div className="flex border rounded-md">
              <Button
                variant={viewMode === 'preview' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('preview')}
                className="rounded-r-none"
              >
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
              {showCode && (
                <Button
                  variant={viewMode === 'html' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('html')}
                  className="rounded-l-none"
                >
                  <Code className="h-4 w-4 mr-2" />
                  HTML
                </Button>
              )}
            </div>

            {/* Viewport Mode Toggle */}
            {viewMode === 'preview' && (
              <div className="flex border rounded-md">
                <Button
                  variant={viewportMode === 'desktop' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewportMode('desktop')}
                  className="rounded-r-none rounded-l-md"
                >
                  <Monitor className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewportMode === 'tablet' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewportMode('tablet')}
                  className="rounded-none"
                >
                  <Tablet className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewportMode === 'mobile' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewportMode('mobile')}
                  className="rounded-l-none rounded-r-md"
                >
                  <Smartphone className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(viewMode === 'html' ? generateHTML() : template.subject)}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy {viewMode === 'html' ? 'HTML' : 'Subject'}
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" size="sm">
              <Share className="h-4 w-4 mr-2" />
              Share
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {viewMode === 'preview' ? (
            <div className="flex justify-center">
              <div
                className="bg-gray-100 p-4 rounded-lg transition-all duration-300"
                style={getViewportStyles()}
              >
                {/* Email Subject Preview */}
                <div className="bg-white p-3 mb-4 rounded border">
                  <div className="text-sm text-gray-600 mb-1">Subject:</div>
                  <div className="font-medium">{replaceVariables(template.subject)}</div>
                  {template.previewText && (
                    <>
                      <div className="text-sm text-gray-600 mt-2 mb-1">Preview:</div>
                      <div className="text-sm text-gray-700">{replaceVariables(template.previewText)}</div>
                    </>
                  )}
                </div>

                {/* Email Body */}
                <div
                  className="shadow-lg rounded-lg overflow-hidden"
                  style={{
                    maxWidth: template.styles.maxWidth,
                    fontFamily: template.styles.fontFamily,
                    backgroundColor: template.styles.backgroundColor,
                    margin: '0 auto'
                  }}
                >
                  <div className="p-6">
                    {template.blocks.map(block => renderBlock(block))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm overflow-auto">
              <pre>{generateHTML()}</pre>
            </div>
          )}
        </div>

        {/* Variables Info */}
        {template.variables.length > 0 && (
          <div className="border-t p-4 bg-gray-50">
            <h4 className="text-sm font-medium mb-2">Template Variables:</h4>
            <div className="flex flex-wrap gap-2">
              {template.variables.map(variable => (
                <Badge key={variable} variant="outline" className="text-xs">
                  {`{{${variable}}}`} → {sampleData[variable] || 'Not set'}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}