import { useState } from 'react'
import { EmailTemplate, DevicePreview } from './types'
import { BlockRenderer } from './blocks'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Monitor, Smartphone } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TemplatePreviewProps {
  template: EmailTemplate
  devicePreview: DevicePreview
  onDeviceChange: (device: DevicePreview) => void
  className?: string
}

export function TemplatePreview({
  template,
  devicePreview,
  onDeviceChange,
  className,
}: TemplatePreviewProps) {
  const [previewMode, setPreviewMode] = useState<'preview' | 'html'>('preview')

  const generateHTML = () => {
    const globalStyles = template.globalStyles || {}
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${template.name}</title>
    <style>
        body {
            margin: 0;
            padding: 20px;
            font-family: ${globalStyles.fontFamily || 'Arial, sans-serif'};
            background-color: ${globalStyles.backgroundColor || '#f5f5f5'};
        }
        .email-container {
            max-width: ${globalStyles.maxWidth || '600px'};
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        img {
            max-width: 100%;
            height: auto;
        }
        a {
            color: inherit;
            text-decoration: none;
        }
        .button {
            display: inline-block;
            text-decoration: none;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <table>
            <tbody>
                ${template.blocks.map(block => {
                  switch (block.type) {
                    case 'text':
                    case 'heading':
                      return `
                        <tr>
                            <td style="
                                color: ${block.styles?.textColor || '#000000'};
                                font-size: ${block.styles?.fontSize || '16px'};
                                font-weight: ${block.styles?.fontWeight || 'normal'};
                                text-align: ${block.styles?.textAlign || 'left'};
                                padding: ${block.styles?.padding || '16px'};
                                margin: ${block.styles?.margin || '0'};
                                background-color: ${block.styles?.backgroundColor || 'transparent'};
                                border-radius: ${block.styles?.borderRadius || '0'};
                                border: ${block.styles?.borderWidth || '0'} ${block.styles?.borderStyle || 'solid'} ${block.styles?.borderColor || 'transparent'};
                            ">
                                ${block.content || ''}
                            </td>
                        </tr>
                      `
                    case 'image':
                    case 'logo':
                      return `
                        <tr>
                            <td style="
                                text-align: ${block.styles?.textAlign || 'center'};
                                padding: ${block.styles?.padding || '16px'};
                                background-color: ${block.styles?.backgroundColor || 'transparent'};
                            ">
                                <img src="${block.settings?.src || ''}" 
                                     alt="${block.settings?.alt || ''}"
                                     style="
                                        width: ${block.styles?.width || '100%'};
                                        height: ${block.styles?.height || 'auto'};
                                        border-radius: ${block.styles?.borderRadius || '0'};
                                     "
                                />
                            </td>
                        </tr>
                      `
                    case 'button':
                      return `
                        <tr>
                            <td style="
                                text-align: ${block.styles?.textAlign || 'center'};
                                padding: ${block.styles?.padding || '16px'};
                                background-color: ${block.styles?.backgroundColor || 'transparent'};
                            ">
                                <a href="${block.settings?.href || '#'}" 
                                   target="${block.settings?.target || '_blank'}"
                                   class="button"
                                   style="
                                        background-color: ${block.styles?.backgroundColor || '#007bff'};
                                        color: ${block.styles?.textColor || '#ffffff'};
                                        font-size: ${block.styles?.fontSize || '16px'};
                                        font-weight: ${block.styles?.fontWeight || 'bold'};
                                        padding: 12px 24px;
                                        border-radius: ${block.styles?.borderRadius || '4px'};
                                        text-decoration: none;
                                        display: inline-block;
                                   ">
                                    ${block.content || 'Click Here'}
                                </a>
                            </td>
                        </tr>
                      `
                    case 'divider':
                      return `
                        <tr>
                            <td style="
                                padding: ${block.styles?.padding || '0'};
                                margin: ${block.styles?.margin || '16px 0'};
                            ">
                                <hr style="
                                    border: none;
                                    border-top: ${block.styles?.borderWidth || '1px'} ${block.styles?.borderStyle || 'solid'} ${block.styles?.borderColor || '#e0e0e0'};
                                    margin: 0;
                                " />
                            </td>
                        </tr>
                      `
                    case 'spacer':
                      return `
                        <tr>
                            <td style="
                                height: ${block.styles?.height || block.settings?.spacing || '20px'};
                                line-height: ${block.styles?.height || block.settings?.spacing || '20px'};
                                font-size: 1px;
                            ">
                                &nbsp;
                            </td>
                        </tr>
                      `
                    default:
                      return ''
                  }
                }).join('')}
            </tbody>
        </table>
    </div>
</body>
</html>
    `.trim()
  }

  const copyHTMLToClipboard = () => {
    navigator.clipboard.writeText(generateHTML())
  }

  const previewStyles = {
    width: devicePreview.width,
    height: devicePreview.height,
    maxWidth: '100%',
    maxHeight: '100%',
  }

  return (
    <Card className={cn('flex flex-col h-full', className)}>
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm text-gray-900">Preview</h3>
          <div className="flex items-center gap-2">
            <Button
              variant={devicePreview.type === 'desktop' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onDeviceChange({ type: 'desktop', width: '600px', height: 'auto' })}
            >
              <Monitor className="h-4 w-4 mr-1" />
              Desktop
            </Button>
            <Button
              variant={devicePreview.type === 'mobile' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onDeviceChange({ type: 'mobile', width: '375px', height: 'auto' })}
            >
              <Smartphone className="h-4 w-4 mr-1" />
              Mobile
            </Button>
          </div>
        </div>

        <Tabs value={previewMode} onValueChange={(value) => setPreviewMode(value as 'preview' | 'html')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="preview">Visual Preview</TabsTrigger>
            <TabsTrigger value="html">HTML Code</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 p-4 overflow-auto">
        <Tabs value={previewMode}>
          <TabsContent value="preview" className="m-0">
            <div className="flex justify-center">
              <div
                className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm"
                style={previewStyles}
              >
                <div
                  className="email-preview"
                  style={{
                    fontFamily: template.globalStyles?.fontFamily || 'Arial, sans-serif',
                    backgroundColor: template.globalStyles?.backgroundColor || '#ffffff',
                    minHeight: '200px',
                  }}
                >
                  {template.blocks.map((block) => (
                    <BlockRenderer
                      key={block.id}
                      block={block}
                      isEditing={false}
                    />
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="html" className="m-0">
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={copyHTMLToClipboard}>
                  Copy HTML
                </Button>
              </div>
              <pre className="bg-gray-100 p-4 rounded-lg text-xs overflow-auto max-h-96 border">
                <code>{generateHTML()}</code>
              </pre>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Card>
  )
}