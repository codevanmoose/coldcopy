import { TemplateBlock } from '../types'
import { cn } from '@/lib/utils'

interface SpacerBlockProps {
  block: TemplateBlock
  isEditing?: boolean
  className?: string
}

export function SpacerBlock({ block, isEditing = false, className }: SpacerBlockProps) {
  const height = block.styles?.height || block.settings?.spacing || '20px'

  const styles = {
    height,
    backgroundColor: block.styles?.backgroundColor || 'transparent',
    minHeight: isEditing ? '20px' : height,
  } as React.CSSProperties

  return (
    <div
      className={cn(
        'w-full',
        isEditing && 'border border-dashed border-gray-300 bg-gray-50/50',
        className
      )}
      style={styles}
    >
      {isEditing && (
        <div className="flex items-center justify-center h-full text-xs text-gray-500">
          Spacer ({height})
        </div>
      )}
    </div>
  )
}