"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"
import { 
  Save, Eye, Smartphone, Monitor, Plus, Trash2, 
  Type, Image, MousePointer, Minus, Settings,
  ArrowUp, ArrowDown, Copy, AlignLeft, AlignCenter, AlignRight
} from "lucide-react"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"

interface TemplateBlock {
  id: string
  type: 'text' | 'image' | 'button' | 'divider' | 'spacer'
  content: any
  styles: any
}

interface EmailTemplate {
  id?: string
  name: string
  subject: string
  blocks: TemplateBlock[]
  variables: Record<string, any>
}

const BLOCK_TYPES = [
  { type: 'text', icon: Type, label: 'Text', description: 'Add text content' },
  { type: 'image', icon: Image, label: 'Image', description: 'Insert an image' },
  { type: 'button', icon: MousePointer, label: 'Button', description: 'Call-to-action button' },
  { type: 'divider', icon: Minus, label: 'Divider', description: 'Visual separator' },
  { type: 'spacer', icon: Plus, label: 'Spacer', description: 'Add vertical space' }
]

const TEMPLATE_VARIABLES = [
  { name: 'first_name', label: 'First Name', category: 'Personal' },
  { name: 'last_name', label: 'Last Name', category: 'Personal' },
  { name: 'company', label: 'Company', category: 'Company' },
  { name: 'job_title', label: 'Job Title', category: 'Personal' },
  { name: 'email', label: 'Email', category: 'Personal' },
  { name: 'phone', label: 'Phone', category: 'Personal' }
]

export default function EmailTemplateEditor() {
  const [template, setTemplate] = useState<EmailTemplate>({
    name: "",
    subject: "",
    blocks: [],
    variables: {}
  })
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null)
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop')
  const [isLoading, setIsLoading] = useState(false)

  const generateBlockId = () => `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  const addBlock = (type: TemplateBlock['type']) => {
    const newBlock: TemplateBlock = {
      id: generateBlockId(),
      type,
      content: getDefaultContent(type),
      styles: getDefaultStyles(type)
    }

    setTemplate(prev => ({
      ...prev,
      blocks: [...prev.blocks, newBlock]
    }))
    setSelectedBlock(newBlock.id)
  }

  const getDefaultContent = (type: TemplateBlock['type']) => {
    switch (type) {
      case 'text':
        return { text: 'Your text here...', tag: 'p' }
      case 'image':
        return { src: '', alt: '', width: 300, height: 200 }
      case 'button':
        return { text: 'Click Here', url: '', target: '_blank' }
      case 'divider':
        return { style: 'solid' }
      case 'spacer':
        return { height: 20 }
      default:
        return {}
    }
  }

  const getDefaultStyles = (type: TemplateBlock['type']) => {
    switch (type) {
      case 'text':
        return { 
          fontSize: '16px', 
          color: '#333333', 
          textAlign: 'left',
          fontWeight: 'normal',
          lineHeight: '1.5',
          marginBottom: '16px'
        }
      case 'image':
        return { 
          display: 'block', 
          margin: '0 auto 16px',
          borderRadius: '4px'
        }
      case 'button':
        return { 
          backgroundColor: '#3b82f6', 
          color: '#ffffff', 
          padding: '12px 24px',
          borderRadius: '6px',
          textAlign: 'center',
          display: 'inline-block',
          textDecoration: 'none',
          fontSize: '16px',
          fontWeight: '600',
          margin: '16px auto'
        }
      case 'divider':
        return { 
          borderTop: '1px solid #e5e7eb', 
          margin: '24px 0',
          width: '100%'
        }
      case 'spacer':
        return { height: '20px' }
      default:
        return {}
    }
  }

  const updateBlock = (blockId: string, updates: Partial<TemplateBlock>) => {
    setTemplate(prev => ({
      ...prev,
      blocks: prev.blocks.map(block => 
        block.id === blockId ? { ...block, ...updates } : block
      )
    }))
  }

  const deleteBlock = (blockId: string) => {
    setTemplate(prev => ({
      ...prev,
      blocks: prev.blocks.filter(block => block.id !== blockId)
    }))
    setSelectedBlock(null)
  }

  const duplicateBlock = (blockId: string) => {
    const blockToDuplicate = template.blocks.find(b => b.id === blockId)
    if (blockToDuplicate) {
      const newBlock = {
        ...blockToDuplicate,
        id: generateBlockId()
      }
      const blockIndex = template.blocks.findIndex(b => b.id === blockId)
      setTemplate(prev => ({
        ...prev,
        blocks: [
          ...prev.blocks.slice(0, blockIndex + 1),
          newBlock,
          ...prev.blocks.slice(blockIndex + 1)
        ]
      }))
    }
  }

  const moveBlock = (blockId: string, direction: 'up' | 'down') => {
    const blockIndex = template.blocks.findIndex(b => b.id === blockId)
    if (blockIndex === -1) return

    const newIndex = direction === 'up' ? blockIndex - 1 : blockIndex + 1
    if (newIndex < 0 || newIndex >= template.blocks.length) return

    const newBlocks = [...template.blocks]
    const [movedBlock] = newBlocks.splice(blockIndex, 1)
    newBlocks.splice(newIndex, 0, movedBlock)

    setTemplate(prev => ({ ...prev, blocks: newBlocks }))
  }

  const onDragEnd = (result: any) => {
    if (!result.destination) return

    const newBlocks = Array.from(template.blocks)
    const [reorderedItem] = newBlocks.splice(result.source.index, 1)
    newBlocks.splice(result.destination.index, 0, reorderedItem)

    setTemplate(prev => ({ ...prev, blocks: newBlocks }))
  }

  const insertVariable = (variableName: string, blockId?: string) => {
    const variable = `{{${variableName}}}`
    
    if (blockId) {
      const block = template.blocks.find(b => b.id === blockId)
      if (block && block.type === 'text') {
        updateBlock(blockId, {
          content: {
            ...block.content,
            text: block.content.text + variable
          }
        })
      }
    } else {
      // Insert into subject or selected text block
      const textBlock = template.blocks.find(b => b.id === selectedBlock && b.type === 'text')
      if (textBlock) {
        updateBlock(textBlock.id, {
          content: {
            ...textBlock.content,
            text: textBlock.content.text + variable
          }
        })
      }
    }
  }

  const renderBlock = (block: TemplateBlock, isSelected: boolean) => {
    const isEditing = selectedBlock === block.id

    switch (block.type) {
      case 'text':
        return (
          <div 
            style={block.styles}
            className={`${isSelected ? 'ring-2 ring-blue-500' : ''} cursor-pointer p-2 rounded`}
            onClick={() => setSelectedBlock(block.id)}
          >
            {isEditing ? (
              <Textarea
                value={block.content.text}
                onChange={(e) => updateBlock(block.id, {
                  content: { ...block.content, text: e.target.value }
                })}
                className="min-h-[60px] border-0 p-0 resize-none"
                style={{ fontSize: block.styles.fontSize, color: block.styles.color }}
              />
            ) : (
              <div dangerouslySetInnerHTML={{ __html: block.content.text.replace(/\n/g, '<br>') }} />
            )}
          </div>
        )

      case 'image':
        return (
          <div 
            className={`${isSelected ? 'ring-2 ring-blue-500' : ''} cursor-pointer p-2 rounded`}
            onClick={() => setSelectedBlock(block.id)}
          >
            {block.content.src ? (
              <img 
                src={block.content.src} 
                alt={block.content.alt}
                style={block.styles}
                className="max-w-full"
              />
            ) : (
              <div 
                style={{ ...block.styles, backgroundColor: '#f3f4f6' }}
                className="flex items-center justify-center text-gray-500 border-2 border-dashed border-gray-300"
              >
                <Image className="w-8 h-8" />
              </div>
            )}
          </div>
        )

      case 'button':
        return (
          <div className={`${isSelected ? 'ring-2 ring-blue-500' : ''} cursor-pointer p-2 rounded text-center`}>
            <a
              href={block.content.url || '#'}
              style={block.styles}
              className="inline-block"
              onClick={(e) => {
                e.preventDefault()
                setSelectedBlock(block.id)
              }}
            >
              {block.content.text}
            </a>
          </div>
        )

      case 'divider':
        return (
          <div 
            className={`${isSelected ? 'ring-2 ring-blue-500' : ''} cursor-pointer p-2 rounded`}
            onClick={() => setSelectedBlock(block.id)}
          >
            <hr style={block.styles} />
          </div>
        )

      case 'spacer':
        return (
          <div 
            className={`${isSelected ? 'ring-2 ring-blue-500 bg-gray-100' : ''} cursor-pointer rounded`}
            style={{ height: block.content.height + 'px' }}
            onClick={() => setSelectedBlock(block.id)}
          >
            {isSelected && (
              <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                Spacer ({block.content.height}px)
              </div>
            )}
          </div>
        )

      default:
        return null
    }
  }

  const renderBlockEditor = () => {
    if (!selectedBlock) return null

    const block = template.blocks.find(b => b.id === selectedBlock)
    if (!block) return null

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold capitalize">{block.type} Settings</h3>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => moveBlock(block.id, 'up')}
              disabled={template.blocks.findIndex(b => b.id === block.id) === 0}
            >
              <ArrowUp className="w-3 h-3" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => moveBlock(block.id, 'down')}
              disabled={template.blocks.findIndex(b => b.id === block.id) === template.blocks.length - 1}
            >
              <ArrowDown className="w-3 h-3" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => duplicateBlock(block.id)}
            >
              <Copy className="w-3 h-3" />
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => deleteBlock(block.id)}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {block.type === 'text' && (
          <div className="space-y-3">
            <div>
              <Label>Text Content</Label>
              <Textarea
                value={block.content.text}
                onChange={(e) => updateBlock(block.id, {
                  content: { ...block.content, text: e.target.value }
                })}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Font Size</Label>
                <Select
                  value={block.styles.fontSize}
                  onValueChange={(value) => updateBlock(block.id, {
                    styles: { ...block.styles, fontSize: value }
                  })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="12px">12px</SelectItem>
                    <SelectItem value="14px">14px</SelectItem>
                    <SelectItem value="16px">16px</SelectItem>
                    <SelectItem value="18px">18px</SelectItem>
                    <SelectItem value="20px">20px</SelectItem>
                    <SelectItem value="24px">24px</SelectItem>
                    <SelectItem value="32px">32px</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Text Color</Label>
                <Input
                  type="color"
                  value={block.styles.color}
                  onChange={(e) => updateBlock(block.id, {
                    styles: { ...block.styles, color: e.target.value }
                  })}
                  className="mt-1 h-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={block.styles.textAlign === 'left' ? 'default' : 'outline'}
                onClick={() => updateBlock(block.id, {
                  styles: { ...block.styles, textAlign: 'left' }
                })}
              >
                <AlignLeft className="w-3 h-3" />
              </Button>
              <Button
                size="sm"
                variant={block.styles.textAlign === 'center' ? 'default' : 'outline'}
                onClick={() => updateBlock(block.id, {
                  styles: { ...block.styles, textAlign: 'center' }
                })}
              >
                <AlignCenter className="w-3 h-3" />
              </Button>
              <Button
                size="sm"
                variant={block.styles.textAlign === 'right' ? 'default' : 'outline'}
                onClick={() => updateBlock(block.id, {
                  styles: { ...block.styles, textAlign: 'right' }
                })}
              >
                <AlignRight className="w-3 h-3" />
              </Button>
            </div>
          </div>
        )}

        {block.type === 'image' && (
          <div className="space-y-3">
            <div>
              <Label>Image URL</Label>
              <Input
                value={block.content.src}
                onChange={(e) => updateBlock(block.id, {
                  content: { ...block.content, src: e.target.value }
                })}
                placeholder="https://example.com/image.jpg"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Alt Text</Label>
              <Input
                value={block.content.alt}
                onChange={(e) => updateBlock(block.id, {
                  content: { ...block.content, alt: e.target.value }
                })}
                placeholder="Describe the image"
                className="mt-1"
              />
            </div>
          </div>
        )}

        {block.type === 'button' && (
          <div className="space-y-3">
            <div>
              <Label>Button Text</Label>
              <Input
                value={block.content.text}
                onChange={(e) => updateBlock(block.id, {
                  content: { ...block.content, text: e.target.value }
                })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Button URL</Label>
              <Input
                value={block.content.url}
                onChange={(e) => updateBlock(block.id, {
                  content: { ...block.content, url: e.target.value }
                })}
                placeholder="https://example.com"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Background Color</Label>
              <Input
                type="color"
                value={block.styles.backgroundColor}
                onChange={(e) => updateBlock(block.id, {
                  styles: { ...block.styles, backgroundColor: e.target.value }
                })}
                className="mt-1 h-10"
              />
            </div>
          </div>
        )}

        {block.type === 'spacer' && (
          <div>
            <Label>Height (px)</Label>
            <Input
              type="number"
              value={block.content.height}
              onChange={(e) => updateBlock(block.id, {
                content: { ...block.content, height: parseInt(e.target.value) || 20 }
              })}
              className="mt-1"
              min="10"
              max="200"
            />
          </div>
        )}
      </div>
    )
  }

  const saveTemplate = async () => {
    setIsLoading(true)
    try {
      // API call would go here
      toast.success("Template saved successfully")
    } catch (error) {
      toast.error("Failed to save template")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Sidebar - Blocks */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-semibold">Template Blocks</h2>
        </div>
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-2">
            {BLOCK_TYPES.map((blockType) => {
              const Icon = blockType.icon
              return (
                <Button
                  key={blockType.type}
                  variant="outline"
                  className="w-full justify-start h-auto p-3"
                  onClick={() => addBlock(blockType.type as TemplateBlock['type'])}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  <div className="text-left">
                    <div className="font-medium">{blockType.label}</div>
                    <div className="text-xs text-muted-foreground">{blockType.description}</div>
                  </div>
                </Button>
              )
            })}
          </div>

          <Separator className="my-4" />

          <div>
            <h3 className="font-medium mb-2">Variables</h3>
            <div className="space-y-1">
              {TEMPLATE_VARIABLES.map((variable) => (
                <Button
                  key={variable.name}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs"
                  onClick={() => insertVariable(variable.name)}
                >
                  {variable.label}
                </Button>
              ))}
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Main Editor */}
      <div className="flex-1 flex flex-col">
        {/* Top Toolbar */}
        <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Input
              value={template.name}
              onChange={(e) => setTemplate(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Template name"
              className="w-48"
            />
            <Separator orientation="vertical" className="h-6" />
            <div className="flex gap-2">
              <Button
                variant={previewMode === 'desktop' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPreviewMode('desktop')}
              >
                <Monitor className="w-4 h-4" />
              </Button>
              <Button
                variant={previewMode === 'mobile' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPreviewMode('mobile')}
              >
                <Smartphone className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <Eye className="w-4 h-4 mr-2" />
              Preview
            </Button>
            <Button onClick={saveTemplate} disabled={isLoading}>
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
          </div>
        </div>

        {/* Editor Content */}
        <div className="flex-1 flex">
          {/* Canvas */}
          <div className="flex-1 p-4 overflow-auto">
            <div className="max-w-2xl mx-auto">
              {/* Subject Line */}
              <Card className="mb-4">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Subject Line</CardTitle>
                </CardHeader>
                <CardContent>
                  <Input
                    value={template.subject}
                    onChange={(e) => setTemplate(prev => ({ ...prev, subject: e.target.value }))}
                    placeholder="Enter email subject..."
                    className="font-medium"
                  />
                </CardContent>
              </Card>

              {/* Email Body */}
              <Card className={`${previewMode === 'mobile' ? 'max-w-sm mx-auto' : ''}`}>
                <CardContent className="p-6">
                  <DragDropContext onDragEnd={onDragEnd}>
                    <Droppable droppableId="email-blocks">
                      {(provided) => (
                        <div {...provided.droppableProps} ref={provided.innerRef}>
                          {template.blocks.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">
                              <Type className="w-12 h-12 mx-auto mb-4 opacity-50" />
                              <p>Start building your email by adding blocks from the sidebar</p>
                            </div>
                          ) : (
                            template.blocks.map((block, index) => (
                              <Draggable key={block.id} draggableId={block.id} index={index}>
                                {(provided) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className="mb-2"
                                  >
                                    {renderBlock(block, selectedBlock === block.id)}
                                  </div>
                                )}
                              </Draggable>
                            ))
                          )}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Right Sidebar - Block Settings */}
          <div className="w-80 bg-white border-l border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-semibold flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Block Settings
              </h2>
            </div>
            <ScrollArea className="flex-1 p-4">
              {selectedBlock ? (
                renderBlockEditor()
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Settings className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Select a block to edit its settings</p>
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  )
}