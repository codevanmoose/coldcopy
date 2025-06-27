import { TemplateBlock } from '../types'
import { TextBlock } from './text-block'
import { ImageBlock } from './image-block'
import { ButtonBlock } from './button-block'
import { DividerBlock } from './divider-block'
import { SpacerBlock } from './spacer-block'
import { HeadingBlock } from './heading-block'
import { LogoBlock } from './logo-block'

interface BlockRendererProps {
  block: TemplateBlock
  isEditing?: boolean
  onUpdate?: (block: TemplateBlock) => void
  className?: string
}

export function BlockRenderer({ block, isEditing = false, onUpdate, className }: BlockRendererProps) {
  switch (block.type) {
    case 'text':
      return (
        <TextBlock
          block={block}
          isEditing={isEditing}
          onUpdate={onUpdate}
          className={className}
        />
      )
    case 'heading':
      return (
        <HeadingBlock
          block={block}
          isEditing={isEditing}
          onUpdate={onUpdate}
          className={className}
        />
      )
    case 'image':
      return (
        <ImageBlock
          block={block}
          isEditing={isEditing}
          onUpdate={onUpdate}
          className={className}
        />
      )
    case 'button':
      return (
        <ButtonBlock
          block={block}
          isEditing={isEditing}
          onUpdate={onUpdate}
          className={className}
        />
      )
    case 'divider':
      return (
        <DividerBlock
          block={block}
          className={className}
        />
      )
    case 'spacer':
      return (
        <SpacerBlock
          block={block}
          isEditing={isEditing}
          className={className}
        />
      )
    case 'logo':
      return (
        <LogoBlock
          block={block}
          isEditing={isEditing}
          onUpdate={onUpdate}
          className={className}
        />
      )
    default:
      return null
  }
}

export * from './text-block'
export * from './image-block'
export * from './button-block'
export * from './divider-block'
export * from './spacer-block'
export * from './heading-block'
export * from './logo-block'