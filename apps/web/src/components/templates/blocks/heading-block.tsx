import { useState } from 'react'
import { TemplateBlock } from '../types'
import { cn } from '@/lib/utils'

interface HeadingBlockProps {
  block: TemplateBlock
  isEditing?: boolean
  onUpdate?: (block: TemplateBlock) => void
  className?: string
}

export function HeadingBlock({ block, isEditing = false, onUpdate, className }: HeadingBlockProps) {
  const [content, setContent] = useState(block.content || '')

  const handleContentChange = (value: string) => {
    setContent(value)
    if (onUpdate) {
      onUpdate({
        ...block,
        content: value,
      })
    }
  }

  const styles = {
    color: block.styles?.textColor || '#000000',
    fontSize: block.styles?.fontSize || '24px',
    fontWeight: block.styles?.fontWeight || 'bold',
    textAlign: block.styles?.textAlign || 'left',
    padding: block.styles?.padding || '16px',
    margin: block.styles?.margin || '0',
    backgroundColor: block.styles?.backgroundColor || 'transparent',
    borderRadius: block.styles?.borderRadius || '0',
    borderWidth: block.styles?.borderWidth || '0',
    borderColor: block.styles?.borderColor || 'transparent',
    borderStyle: block.styles?.borderStyle || 'solid',
  } as React.CSSProperties

  if (isEditing) {
    return (
      <div className={cn('relative', className)} style={styles}>
        <input
          type="text"
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder={block.settings?.placeholder || 'Enter your heading...'}
          className="w-full border-none outline-none bg-transparent"
          style={{
            color: styles.color,
            fontSize: styles.fontSize,
            fontWeight: styles.fontWeight,
            textAlign: styles.textAlign,
            fontFamily: 'inherit',
          }}
        />
      </div>
    )
  }

  return (
    <h2 className={className} style={styles}>
      {content || block.settings?.placeholder || 'Your heading here'}
    </h2>
  )
}