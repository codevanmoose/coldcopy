'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  Type,
  Image,
  Link2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Underline,
  List,
  Hash,
  Quote,
  Save,
  Eye,
  Undo,
  Redo,
  Palette,
  Settings,
  Download,
  Upload,
  Sparkles
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

const defaultTemplate: EmailTemplate = {
  id: 'new-template',
  name: 'New Template',
  description: 'A blank email template',
  category: 'Custom',
  blocks: [
    {
      id: '1',
      type: 'heading',
      content: 'Hi {{first_name}},',
      styles: {
        fontSize: '24px',
        fontWeight: 'bold',
        color: '#333333',
        textAlign: 'left',
        margin: '0 0 20px 0'
      }
    },
    {
      id: '2', 
      type: 'text',
      content: 'I hope this email finds you well. I wanted to reach out because...',
      styles: {
        fontSize: '16px',
        color: '#555555',
        textAlign: 'left',
        margin: '0 0 20px 0',
        lineHeight: '1.6'
      }
    }
  ],
  variables: ['first_name', 'company'],
  styles: {
    backgroundColor: '#ffffff',
    fontFamily: 'Arial, sans-serif',
    maxWidth: '600px'
  },
  previewText: 'Quick question about {{company}}...',
  subject: 'Quick question about {{company}}'
}

const blockTypes = [
  { type: 'text', label: 'Text', icon: Type, description: 'Add paragraph text' },
  { type: 'heading', label: 'Heading', icon: Hash, description: 'Add a heading' },
  { type: 'image', label: 'Image', icon: Image, description: 'Insert an image' },
  { type: 'button', label: 'Button', icon: Link2, description: 'Add a call-to-action button' },
  { type: 'divider', label: 'Divider', icon: Quote, description: 'Add a horizontal line' },
  { type: 'spacer', label: 'Spacer', icon: List, description: 'Add vertical space' },
  { type: 'variable', label: 'Variable', icon: Sparkles, description: 'Insert personalization variable' }
]

const availableVariables = [
  { name: 'first_name', label: 'First Name', example: 'John' },
  { name: 'last_name', label: 'Last Name', example: 'Doe' },
  { name: 'company', label: 'Company', example: 'Acme Inc' },
  { name: 'title', label: 'Job Title', example: 'CEO' },
  { name: 'industry', label: 'Industry', example: 'Technology' },
  { name: 'city', label: 'City', example: 'San Francisco' },
  { name: 'website', label: 'Website', example: 'acme.com' }
]

interface TemplateEditorProps {
  template?: EmailTemplate | null
  onSave?: (template: EmailTemplate) => void
  onCancel?: () => void
}

export function TemplateEditor({ template: propTemplate, onSave, onCancel }: TemplateEditorProps) {
  const [template, setTemplate] = useState<EmailTemplate>(propTemplate || defaultTemplate)
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [history, setHistory] = useState<EmailTemplate[]>([propTemplate || defaultTemplate])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [previewMode, setPreviewMode] = useState(false)

  // Update template when prop changes
  React.useEffect(() => {
    if (propTemplate) {
      setTemplate(propTemplate)
      setHistory([propTemplate])
      setHistoryIndex(0)
    }
  }, [propTemplate])

  const editorRef = useRef<HTMLDivElement>(null)

  // Save to history for undo/redo
  const saveToHistory = useCallback((newTemplate: EmailTemplate) => {
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(newTemplate)
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
  }, [history, historyIndex])

  // Update template and save to history
  const updateTemplate = useCallback((updates: Partial<EmailTemplate>) => {
    const newTemplate = { ...template, ...updates }
    setTemplate(newTemplate)
    saveToHistory(newTemplate)
  }, [template, saveToHistory])

  // Add new block
  const addBlock = (type: TemplateBlock['type'], index?: number) => {
    const newBlock: TemplateBlock = {
      id: Date.now().toString(),
      type,
      content: getDefaultContent(type),
      styles: getDefaultStyles(type),
      metadata: getDefaultMetadata(type)
    }

    const newBlocks = [...template.blocks]
    const insertIndex = index !== undefined ? index : newBlocks.length
    newBlocks.splice(insertIndex, 0, newBlock)

    updateTemplate({ blocks: newBlocks })
    setSelectedBlockId(newBlock.id)
  }

  // Update block
  const updateBlock = (blockId: string, updates: Partial<TemplateBlock>) => {
    const newBlocks = template.blocks.map(block =>
      block.id === blockId ? { ...block, ...updates } : block
    )
    updateTemplate({ blocks: newBlocks })
  }

  // Delete block
  const deleteBlock = (blockId: string) => {
    const newBlocks = template.blocks.filter(block => block.id !== blockId)
    updateTemplate({ blocks: newBlocks })
    setSelectedBlockId(null)
  }

  // Duplicate block
  const duplicateBlock = (blockId: string) => {
    const block = template.blocks.find(b => b.id === blockId)
    if (!block) return

    const duplicatedBlock = {
      ...block,
      id: Date.now().toString()
    }

    const blockIndex = template.blocks.findIndex(b => b.id === blockId)
    const newBlocks = [...template.blocks]
    newBlocks.splice(blockIndex + 1, 0, duplicatedBlock)

    updateTemplate({ blocks: newBlocks })
  }

  // Move block
  const moveBlock = (fromIndex: number, toIndex: number) => {
    const newBlocks = [...template.blocks]
    const [movedBlock] = newBlocks.splice(fromIndex, 1)
    newBlocks.splice(toIndex, 0, movedBlock)
    updateTemplate({ blocks: newBlocks })
  }

  // Undo/Redo
  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1)
      setTemplate(history[historyIndex - 1])
    }
  }

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1)
      setTemplate(history[historyIndex + 1])
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'z':
            e.preventDefault()
            if (e.shiftKey) {
              redo()
            } else {
              undo()
            }
            break
          case 's':
            e.preventDefault()
            handleSave()
            break
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [historyIndex, history])

  // Handle save
  const handleSave = () => {
    if (onSave) {
      onSave(template)
    }
  }

  // Get selected block
  const selectedBlock = selectedBlockId 
    ? template.blocks.find(b => b.id === selectedBlockId)
    : null

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar - Block Library */}
      <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto">
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">Email Blocks</h2>
          <div className="space-y-2">
            {blockTypes.map((blockType) => (
              <Card
                key={blockType.type}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => addBlock(blockType.type)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <blockType.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium">{blockType.label}</h3>
                      <p className="text-sm text-muted-foreground">
                        {blockType.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Separator className="my-6" />

          <h3 className="text-md font-semibold mb-4">Variables</h3>
          <div className="space-y-2">
            {availableVariables.map((variable) => (
              <div
                key={variable.name}
                className="p-2 border rounded cursor-pointer hover:bg-gray-50"
                onClick={() => {
                  if (selectedBlockId) {
                    const block = template.blocks.find(b => b.id === selectedBlockId)
                    if (block && (block.type === 'text' || block.type === 'heading')) {
                      updateBlock(selectedBlockId, {
                        content: block.content + ` {{${variable.name}}}`
                      })
                    }
                  }
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{variable.label}</span>
                  <Badge variant="outline" className="text-xs">
                    {variable.example}
                  </Badge>
                </div>
                <code className="text-xs text-muted-foreground">
                  {`{{${variable.name}}}`}
                </code>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Editor */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Input
                value={template.name}
                onChange={(e) => updateTemplate({ name: e.target.value })}
                className="font-semibold text-lg border-none p-0 focus:ring-0"
                placeholder="Template Name"
              />
              <Badge variant="secondary">{template.category}</Badge>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={undo}
                disabled={historyIndex === 0}
              >
                <Undo className="h-4 w-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={redo}
                disabled={historyIndex === history.length - 1}
              >
                <Redo className="h-4 w-4" />
              </Button>

              <Separator orientation="vertical" className="h-6" />

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPreviewMode(!previewMode)}
              >
                <Eye className="h-4 w-4 mr-2" />
                {previewMode ? 'Edit' : 'Preview'}
              </Button>

              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>

              <Button size="sm" onClick={handleSave}>
                <Save className="h-4 w-4 mr-2" />
                Save Template
              </Button>
              {onCancel && (
                <Button variant="outline" size="sm" onClick={onCancel}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 flex">
          {/* Email Canvas */}
          <div className="flex-1 p-8 overflow-y-auto bg-gray-50">
            <div className="max-w-3xl mx-auto">
              {/* Email Container */}
              <div
                className="bg-white shadow-lg rounded-lg overflow-hidden"
                style={{
                  maxWidth: template.styles.maxWidth,
                  fontFamily: template.styles.fontFamily,
                  backgroundColor: template.styles.backgroundColor
                }}
              >
                {/* Email Header Info */}
                {!previewMode && (
                  <div className="bg-gray-100 p-4 border-b">
                    <div className="space-y-2">
                      <div>
                        <Label className="text-xs text-gray-600">Subject Line</Label>
                        <Input
                          value={template.subject}
                          onChange={(e) => updateTemplate({ subject: e.target.value })}
                          placeholder="Email subject..."
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-600">Preview Text</Label>
                        <Input
                          value={template.previewText}
                          onChange={(e) => updateTemplate({ previewText: e.target.value })}
                          placeholder="Preview text..."
                          className="text-sm"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Email Body */}
                <div className="p-6" ref={editorRef}>
                  {template.blocks.map((block, index) => (
                    <EmailBlock
                      key={block.id}
                      block={block}
                      isSelected={selectedBlockId === block.id}
                      isPreview={previewMode}
                      onSelect={() => setSelectedBlockId(block.id)}
                      onUpdate={(updates) => updateBlock(block.id, updates)}
                      onDelete={() => deleteBlock(block.id)}
                      onDuplicate={() => duplicateBlock(block.id)}
                      onMoveUp={() => index > 0 && moveBlock(index, index - 1)}
                      onMoveDown={() => index < template.blocks.length - 1 && moveBlock(index, index + 1)}
                    />
                  ))}

                  {template.blocks.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      <Type className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <p className="text-lg font-medium mb-2">Start Building Your Email</p>
                      <p className="text-sm">
                        Add blocks from the sidebar to create your email template
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Properties Panel */}
          {selectedBlock && !previewMode && (
            <div className="w-80 bg-white border-l border-gray-200 p-6 overflow-y-auto">
              <BlockPropertiesPanel
                block={selectedBlock}
                onUpdate={(updates) => updateBlock(selectedBlock.id, updates)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Block component
function EmailBlock({
  block,
  isSelected,
  isPreview,
  onSelect,
  onUpdate,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown
}: {
  block: TemplateBlock
  isSelected: boolean
  isPreview: boolean
  onSelect: () => void
  onUpdate: (updates: Partial<TemplateBlock>) => void
  onDelete: () => void
  onDuplicate: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const renderContent = () => {
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
          <div
            style={style}
            contentEditable={!isPreview}
            onBlur={(e) => onUpdate({ content: e.currentTarget.textContent || '' })}
            suppressContentEditableWarning={true}
            className="outline-none"
          >
            {block.content}
          </div>
        )

      case 'image':
        return (
          <div style={style}>
            {block.metadata?.imageUrl ? (
              <img
                src={block.metadata.imageUrl}
                alt={block.metadata?.alt || ''}
                className="max-w-full h-auto"
              />
            ) : (
              <div className="bg-gray-200 p-8 text-center text-gray-500">
                <Image className="h-8 w-8 mx-auto mb-2" />
                <p>Click to add image</p>
              </div>
            )}
          </div>
        )

      case 'button':
        return (
          <div style={{ textAlign: block.styles.textAlign, ...style }}>
            <button
              style={{
                backgroundColor: block.styles.backgroundColor || '#007bff',
                color: block.styles.color || '#ffffff',
                padding: '12px 24px',
                borderRadius: block.styles.borderRadius || '4px',
                border: 'none',
                fontSize: block.styles.fontSize || '16px',
                fontWeight: block.styles.fontWeight || 'bold',
                cursor: 'pointer'
              }}
            >
              {block.metadata?.buttonText || 'Click Here'}
            </button>
          </div>
        )

      case 'divider':
        return (
          <div style={style}>
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
            style={{
              height: block.styles.padding || '20px',
              ...style
            }}
          />
        )

      case 'variable':
        return (
          <span
            style={style}
            className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm"
          >
            {`{{${block.metadata?.variableName || 'variable'}}}`}
          </span>
        )

      default:
        return <div style={style}>{block.content}</div>
    }
  }

  if (isPreview) {
    return <div>{renderContent()}</div>
  }

  return (
    <div
      className={`relative group ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
      onClick={onSelect}
    >
      {renderContent()}
      
      {/* Block Controls */}
      {isSelected && (
        <div className="absolute top-0 right-0 transform translate-x-2 -translate-y-2">
          <div className="bg-white border rounded-lg shadow-lg p-1 flex space-x-1">
            <Button size="sm" variant="ghost" onClick={onDuplicate}>
              <span className="text-xs">Duplicate</span>
            </Button>
            <Button size="sm" variant="ghost" onClick={onMoveUp}>
              ↑
            </Button>
            <Button size="sm" variant="ghost" onClick={onMoveDown}>
              ↓
            </Button>
            <Button size="sm" variant="ghost" onClick={onDelete} className="text-red-600">
              ×
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// Properties panel component
function BlockPropertiesPanel({
  block,
  onUpdate
}: {
  block: TemplateBlock
  onUpdate: (updates: Partial<TemplateBlock>) => void
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Block Properties</h3>
        <Badge variant="outline">{block.type}</Badge>
      </div>

      {/* Content */}
      {(block.type === 'text' || block.type === 'heading') && (
        <div>
          <Label>Content</Label>
          <Textarea
            value={block.content}
            onChange={(e) => onUpdate({ content: e.target.value })}
            rows={3}
          />
        </div>
      )}

      {/* Button Properties */}
      {block.type === 'button' && (
        <div className="space-y-4">
          <div>
            <Label>Button Text</Label>
            <Input
              value={block.metadata?.buttonText || ''}
              onChange={(e) => onUpdate({
                metadata: { ...block.metadata, buttonText: e.target.value }
              })}
            />
          </div>
          <div>
            <Label>Link URL</Label>
            <Input
              value={block.metadata?.linkUrl || ''}
              onChange={(e) => onUpdate({
                metadata: { ...block.metadata, linkUrl: e.target.value }
              })}
            />
          </div>
        </div>
      )}

      {/* Image Properties */}
      {block.type === 'image' && (
        <div className="space-y-4">
          <div>
            <Label>Image URL</Label>
            <Input
              value={block.metadata?.imageUrl || ''}
              onChange={(e) => onUpdate({
                metadata: { ...block.metadata, imageUrl: e.target.value }
              })}
            />
          </div>
          <div>
            <Label>Alt Text</Label>
            <Input
              value={block.metadata?.alt || ''}
              onChange={(e) => onUpdate({
                metadata: { ...block.metadata, alt: e.target.value }
              })}
            />
          </div>
        </div>
      )}

      {/* Styling */}
      <div className="space-y-4">
        <h4 className="font-medium">Styling</h4>
        
        <div>
          <Label>Text Color</Label>
          <Input
            type="color"
            value={block.styles.color || '#000000'}
            onChange={(e) => onUpdate({
              styles: { ...block.styles, color: e.target.value }
            })}
          />
        </div>

        <div>
          <Label>Background Color</Label>
          <Input
            type="color"
            value={block.styles.backgroundColor || '#ffffff'}
            onChange={(e) => onUpdate({
              styles: { ...block.styles, backgroundColor: e.target.value }
            })}
          />
        </div>

        <div>
          <Label>Font Size</Label>
          <Input
            value={block.styles.fontSize || '16px'}
            onChange={(e) => onUpdate({
              styles: { ...block.styles, fontSize: e.target.value }
            })}
          />
        </div>

        <div>
          <Label>Text Align</Label>
          <div className="flex space-x-2">
            {['left', 'center', 'right'].map((align) => (
              <Button
                key={align}
                variant={block.styles.textAlign === align ? 'default' : 'outline'}
                size="sm"
                onClick={() => onUpdate({
                  styles: { ...block.styles, textAlign: align as 'left' | 'center' | 'right' }
                })}
              >
                {align === 'left' && <AlignLeft className="h-4 w-4" />}
                {align === 'center' && <AlignCenter className="h-4 w-4" />}
                {align === 'right' && <AlignRight className="h-4 w-4" />}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper functions
function getDefaultContent(type: TemplateBlock['type']): string {
  switch (type) {
    case 'heading':
      return 'New Heading'
    case 'text':
      return 'Enter your text here...'
    case 'button':
      return 'Click Here'
    case 'variable':
      return '{{variable}}'
    default:
      return ''
  }
}

function getDefaultStyles(type: TemplateBlock['type']) {
  const baseStyles = {
    fontSize: '16px',
    color: '#333333',
    textAlign: 'left' as const,
    margin: '0 0 16px 0'
  }

  switch (type) {
    case 'heading':
      return {
        ...baseStyles,
        fontSize: '24px',
        fontWeight: 'bold',
        margin: '0 0 20px 0'
      }
    case 'button':
      return {
        ...baseStyles,
        backgroundColor: '#007bff',
        color: '#ffffff',
        padding: '12px 24px',
        borderRadius: '4px',
        textAlign: 'center' as const
      }
    case 'divider':
      return {
        margin: '20px 0',
        border: '1px solid #e0e0e0'
      }
    case 'spacer':
      return {
        padding: '20px'
      }
    default:
      return baseStyles
  }
}

function getDefaultMetadata(type: TemplateBlock['type']) {
  switch (type) {
    case 'button':
      return { buttonText: 'Click Here', linkUrl: '#' }
    case 'image':
      return { imageUrl: '', alt: '' }
    case 'variable':
      return { variableName: 'first_name' }
    default:
      return {}
  }
}