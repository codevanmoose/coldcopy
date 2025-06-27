import { useState } from 'react'
import { TemplateBlock } from '../types'
import { cn } from '@/lib/utils'

interface ButtonBlockProps {
  block: TemplateBlock
  isEditing?: boolean
  onUpdate?: (block: TemplateBlock) => void
  className?: string
}

export function ButtonBlock({ block, isEditing = false, onUpdate, className }: ButtonBlockProps) {
  const [content, setContent] = useState(block.content || 'Click Here')

  const handleContentChange = (value: string) => {
    setContent(value)
    if (onUpdate) {
      onUpdate({
        ...block,
        content: value,
      })
    }
  }

  const containerStyles = {
    textAlign: block.styles?.textAlign || 'center',
    padding: block.styles?.padding || '16px',
    margin: block.styles?.margin || '0',
  } as React.CSSProperties

  const buttonStyles = {
    backgroundColor: block.styles?.backgroundColor || '#007bff',
    color: block.styles?.textColor || '#ffffff',
    fontSize: block.styles?.fontSize || '16px',
    fontWeight: block.styles?.fontWeight || 'bold',
    padding: '12px 24px',
    borderRadius: block.styles?.borderRadius || '4px',
    border: 'none',
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-block',
    borderWidth: block.styles?.borderWidth || '0',
    borderColor: block.styles?.borderColor || 'transparent',
    borderStyle: block.styles?.borderStyle || 'solid',
  } as React.CSSProperties

  const href = block.settings?.href || '#'
  const target = block.settings?.target || '_blank'

  if (isEditing) {
    return (
      <div className={cn('relative', className)} style={containerStyles}>
        <input
          type="text"
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          className="bg-transparent border-none outline-none text-center"
          style={{
            ...buttonStyles,
            minWidth: '120px',
          }}
        />
      </div>
    )
  }

  return (
    <div className={className} style={containerStyles}>
      <a
        href={href}
        target={target}
        rel={target === '_blank' ? 'noopener noreferrer' : undefined}
        style={buttonStyles}
        className="hover:opacity-90 transition-opacity"
      >
        {content}
      </a>
    </div>
  )
}