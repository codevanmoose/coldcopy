import { blockTypes } from './block-types'
import { TemplateBlock } from './types'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

interface BlockPaletteProps {
  onAddBlock: (block: TemplateBlock) => void
  className?: string
}

export function BlockPalette({ onAddBlock, className }: BlockPaletteProps) {
  const createBlock = (typeId: string): TemplateBlock => {
    const blockType = blockTypes.find(t => t.id === typeId)
    if (!blockType) throw new Error(`Block type ${typeId} not found`)

    return {
      id: `${typeId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: typeId as TemplateBlock['type'],
      content: blockType.defaultContent,
      styles: blockType.defaultStyles,
      settings: blockType.defaultSettings,
    }
  }

  return (
    <Card className={cn('p-4', className)}>
      <div className="mb-4">
        <h3 className="font-semibold text-sm text-gray-900">Template Blocks</h3>
        <p className="text-xs text-gray-500 mt-1">
          Drag blocks into your template or click to add
        </p>
      </div>

      <ScrollArea className="h-full">
        <div className="space-y-2">
          {blockTypes.map((blockType) => {
            const IconComponent = blockType.icon
            
            return (
              <Button
                key={blockType.id}
                variant="ghost"
                className="w-full justify-start h-auto p-3 text-left hover:bg-gray-50"
                onClick={() => onAddBlock(createBlock(blockType.id))}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-gray-100 rounded-md">
                    <IconComponent className="h-4 w-4 text-gray-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900">
                      {blockType.name}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {blockType.description}
                    </div>
                  </div>
                </div>
              </Button>
            )
          })}
        </div>
      </ScrollArea>
    </Card>
  )
}