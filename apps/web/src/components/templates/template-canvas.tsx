import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { EmailTemplate, TemplateBlock } from './types'
import { DraggableBlock } from './draggable-block'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TemplateCanvasProps {
  template: EmailTemplate
  onTemplateChange: (template: EmailTemplate) => void
  selectedBlock: TemplateBlock | null
  onBlockSelect: (block: TemplateBlock | null) => void
  className?: string
}

export function TemplateCanvas({
  template,
  onTemplateChange,
  selectedBlock,
  onBlockSelect,
  className,
}: TemplateCanvasProps) {
  const [subject, setSubject] = useState(template.subject || '')

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (active.id !== over?.id) {
      const oldIndex = template.blocks.findIndex(block => block.id === active.id)
      const newIndex = template.blocks.findIndex(block => block.id === over?.id)

      const newBlocks = arrayMove(template.blocks, oldIndex, newIndex)
      onTemplateChange({
        ...template,
        blocks: newBlocks,
      })
    }
  }

  const updateBlock = (updatedBlock: TemplateBlock) => {
    const newBlocks = template.blocks.map(block =>
      block.id === updatedBlock.id ? updatedBlock : block
    )
    onTemplateChange({
      ...template,
      blocks: newBlocks,
    })
  }

  const deleteBlock = (blockId: string) => {
    const newBlocks = template.blocks.filter(block => block.id !== blockId)
    onTemplateChange({
      ...template,
      blocks: newBlocks,
    })
    if (selectedBlock?.id === blockId) {
      onBlockSelect(null)
    }
  }

  const duplicateBlock = (block: TemplateBlock) => {
    const duplicatedBlock: TemplateBlock = {
      ...block,
      id: `${block.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    }
    
    const blockIndex = template.blocks.findIndex(b => b.id === block.id)
    const newBlocks = [
      ...template.blocks.slice(0, blockIndex + 1),
      duplicatedBlock,
      ...template.blocks.slice(blockIndex + 1),
    ]
    
    onTemplateChange({
      ...template,
      blocks: newBlocks,
    })
  }

  const addBlock = (block: TemplateBlock) => {
    onTemplateChange({
      ...template,
      blocks: [...template.blocks, block],
    })
  }

  const updateSubject = (newSubject: string) => {
    setSubject(newSubject)
    onTemplateChange({
      ...template,
      subject: newSubject,
    })
  }

  return (
    <Card className={cn('flex flex-col h-full', className)}>
      <div className="p-4 border-b">
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-sm text-gray-900 mb-2">Email Template</h3>
            <div className="space-y-2">
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                value={template.name}
                onChange={(e) => onTemplateChange({ ...template, name: e.target.value })}
                placeholder="Enter template name..."
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email-subject">Email Subject</Label>
            <Input
              id="email-subject"
              value={subject}
              onChange={(e) => updateSubject(e.target.value)}
              placeholder="Enter email subject..."
            />
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 overflow-auto">
        <div className="max-w-2xl mx-auto">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={template.blocks.map(block => block.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2 min-h-[400px]">
                {template.blocks.length === 0 ? (
                  <div className="flex items-center justify-center h-64 border-2 border-dashed border-gray-300 rounded-lg">
                    <div className="text-center">
                      <Plus className="mx-auto h-12 w-12 text-gray-400" />
                      <h3 className="mt-2 text-sm font-medium text-gray-900">
                        No blocks yet
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Drag blocks from the palette or click to add them
                      </p>
                    </div>
                  </div>
                ) : (
                  template.blocks.map((block) => (
                    <div
                      key={block.id}
                      className={cn(
                        'cursor-pointer transition-all',
                        selectedBlock?.id === block.id && 'ring-2 ring-blue-500 ring-offset-2'
                      )}
                      onClick={() => onBlockSelect(block)}
                    >
                      <DraggableBlock
                        block={block}
                        isEditing={true}
                        onUpdate={updateBlock}
                        onDelete={deleteBlock}
                        onDuplicate={duplicateBlock}
                        onSettings={onBlockSelect}
                      />
                    </div>
                  ))
                )}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </div>
    </Card>
  )
}