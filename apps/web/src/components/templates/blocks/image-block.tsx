import { useState } from 'react'
import { TemplateBlock } from '../types'
import { cn } from '@/lib/utils'
import { Image, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ImageBlockProps {
  block: TemplateBlock
  isEditing?: boolean
  onUpdate?: (block: TemplateBlock) => void
  className?: string
}

export function ImageBlock({ block, isEditing = false, onUpdate, className }: ImageBlockProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleImageUpload = async (file: File) => {
    if (!onUpdate) return
    
    setIsLoading(true)
    try {
      // In a real app, you'd upload to your storage service
      const imageUrl = URL.createObjectURL(file)
      
      onUpdate({
        ...block,
        settings: {
          ...block.settings,
          src: imageUrl,
          alt: file.name,
        },
      })
    } catch (error) {
      console.error('Error uploading image:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleImageUpload(file)
    }
  }

  const styles = {
    textAlign: block.styles?.textAlign || 'center',
    padding: block.styles?.padding || '16px',
    margin: block.styles?.margin || '0',
    backgroundColor: block.styles?.backgroundColor || 'transparent',
    borderRadius: block.styles?.borderRadius || '0',
    borderWidth: block.styles?.borderWidth || '0',
    borderColor: block.styles?.borderColor || 'transparent',
    borderStyle: block.styles?.borderStyle || 'solid',
  } as React.CSSProperties

  const imageStyles = {
    width: block.styles?.width || '100%',
    height: block.styles?.height || 'auto',
    borderRadius: block.styles?.borderRadius || '0',
  } as React.CSSProperties

  const imageSrc = block.settings?.src || 'https://via.placeholder.com/600x200'
  const imageAlt = block.settings?.alt || 'Placeholder image'

  return (
    <div className={cn('relative', className)} style={styles}>
      {isEditing && (
        <div className="absolute top-2 right-2 z-10">
          <label htmlFor={`image-upload-${block.id}`}>
            <Button
              variant="secondary"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={isLoading}
              asChild
            >
              <span className="cursor-pointer">
                {isLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                ) : (
                  <Upload className="h-4 w-4" />
                )}
              </span>
            </Button>
          </label>
          <input
            id={`image-upload-${block.id}`}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      )}
      
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={imageAlt}
          style={imageStyles}
          className="max-w-full h-auto"
        />
      ) : (
        <div
          className="flex items-center justify-center bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg"
          style={{ ...imageStyles, minHeight: '200px' }}
        >
          <div className="text-center">
            <Image className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">
              {isEditing ? 'Click upload to add an image' : 'No image selected'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}