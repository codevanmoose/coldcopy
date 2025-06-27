import { TemplateBlock } from '../types'
import { cn } from '@/lib/utils'

interface DividerBlockProps {
  block: TemplateBlock
  className?: string
}

export function DividerBlock({ block, className }: DividerBlockProps) {
  const styles = {
    borderTopWidth: block.styles?.borderWidth || '1px',
    borderTopColor: block.styles?.borderColor || '#e0e0e0',
    borderTopStyle: block.styles?.borderStyle || 'solid',
    margin: block.styles?.margin || '16px 0',
    padding: block.styles?.padding || '0',
    backgroundColor: block.styles?.backgroundColor || 'transparent',
  } as React.CSSProperties

  return (
    <hr
      className={cn('border-0', className)}
      style={styles}
    />
  )
}