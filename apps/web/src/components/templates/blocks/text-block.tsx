import { useState } from 'react'
import { TemplateBlock } from '../types'
import { cn } from '@/lib/utils'

interface TextBlockProps {
  block: TemplateBlock
  isEditing?: boolean
  onUpdate?: (block: TemplateBlock) => void
  className?: string
}

export function TextBlock({ block, isEditing = false, onUpdate, className }: TextBlockProps) {
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
    fontSize: block.styles?.fontSize || '16px',
    fontWeight: block.styles?.fontWeight || 'normal',
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
        <textarea
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder={block.settings?.placeholder || 'Enter your text...'}
          className="w-full min-h-[100px] resize-none border-none outline-none bg-transparent"
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
    <div className={cn('whitespace-pre-wrap', className)} style={styles}>
      {content || block.settings?.placeholder || 'Your text content here...'}
    </div>
  )
}