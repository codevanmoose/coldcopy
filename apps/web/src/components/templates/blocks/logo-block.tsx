import { useState } from 'react'
import { TemplateBlock } from '../types'
import { cn } from '@/lib/utils'
import { Building2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface LogoBlockProps {
  block: TemplateBlock
  isEditing?: boolean
  onUpdate?: (block: TemplateBlock) => void
  className?: string
}

export function LogoBlock({ block, isEditing = false, onUpdate, className }: LogoBlockProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleLogoUpload = async (file: File) => {
    if (!onUpdate) return
    
    setIsLoading(true)
    try {
      // In a real app, you'd upload to your storage service
      const logoUrl = URL.createObjectURL(file)
      
      onUpdate({
        ...block,
        settings: {
          ...block.settings,
          src: logoUrl,
          alt: 'Company logo',
        },
      })
    } catch (error) {
      console.error('Error uploading logo:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleLogoUpload(file)
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

  const logoStyles = {
    width: block.styles?.width || '200px',
    height: block.styles?.height || 'auto',
    borderRadius: block.styles?.borderRadius || '0',
  } as React.CSSProperties

  const logoSrc = block.settings?.src
  const logoAlt = block.settings?.alt || 'Company logo'

  return (
    <div className={cn('relative', className)} style={styles}>
      {isEditing && (
        <div className="absolute top-2 right-2 z-10">
          <label htmlFor={`logo-upload-${block.id}`}>
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
            id={`logo-upload-${block.id}`}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      )}
      
      {logoSrc ? (
        <img
          src={logoSrc}
          alt={logoAlt}
          style={logoStyles}
          className="max-w-full h-auto"
        />
      ) : (
        <div
          className="flex items-center justify-center bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg"
          style={{ ...logoStyles, minHeight: '60px' }}
        >
          <div className="text-center">
            <Building2 className="mx-auto h-8 w-8 text-gray-400" />
            <p className="mt-1 text-xs text-gray-600">
              {isEditing ? 'Upload logo' : 'Logo'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}