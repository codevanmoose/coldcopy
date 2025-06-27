import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { TemplateBlock } from './types'
import { BlockRenderer } from './blocks'
import { cn } from '@/lib/utils'
import { GripVertical, Trash2, Copy, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface DraggableBlockProps {
  block: TemplateBlock
  isEditing?: boolean
  onUpdate?: (block: TemplateBlock) => void
  onDelete?: (blockId: string) => void
  onDuplicate?: (block: TemplateBlock) => void
  onSettings?: (block: TemplateBlock) => void
}

export function DraggableBlock({
  block,
  isEditing = false,
  onUpdate,
  onDelete,
  onDuplicate,
  onSettings,
}: DraggableBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative border border-transparent hover:border-blue-300 rounded-lg transition-colors',
        isDragging && 'opacity-50'
      )}
    >
      {/* Block Controls */}
      {isEditing && (
        <div className="absolute -left-12 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <div className="flex flex-col gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 bg-white shadow-sm"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Block Actions */}
      {isEditing && (
        <div className="absolute -right-12 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <div className="flex flex-col gap-1">
            {onSettings && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 bg-white shadow-sm"
                onClick={() => onSettings(block)}
              >
                <Settings className="h-4 w-4" />
              </Button>
            )}
            {onDuplicate && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 bg-white shadow-sm"
                onClick={() => onDuplicate(block)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 bg-white shadow-sm hover:bg-red-50 hover:border-red-300"
                onClick={() => onDelete(block.id)}
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Block Content */}
      <div className={cn(isEditing && 'px-4')}>
        <BlockRenderer
          block={block}
          isEditing={isEditing}
          onUpdate={onUpdate}
        />
      </div>
    </div>
  )
}