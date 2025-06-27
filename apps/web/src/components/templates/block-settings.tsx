import { useState } from 'react'
import { TemplateBlock, BlockStyles } from './types'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

interface BlockSettingsProps {
  block: TemplateBlock | null
  onUpdate: (block: TemplateBlock) => void
  className?: string
}

export function BlockSettings({ block, onUpdate, className }: BlockSettingsProps) {
  const [activeTab, setActiveTab] = useState('style')

  if (!block) {
    return (
      <Card className={cn('p-4', className)}>
        <div className="text-center text-gray-500">
          <p className="text-sm">Select a block to edit its settings</p>
        </div>
      </Card>
    )
  }

  const updateStyles = (newStyles: Partial<BlockStyles>) => {
    onUpdate({
      ...block,
      styles: {
        ...block.styles,
        ...newStyles,
      },
    })
  }

  const updateSettings = (newSettings: any) => {
    onUpdate({
      ...block,
      settings: {
        ...block.settings,
        ...newSettings,
      },
    })
  }

  return (
    <Card className={cn('p-4', className)}>
      <div className="mb-4">
        <h3 className="font-semibold text-sm text-gray-900 capitalize">
          {block.type} Block Settings
        </h3>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="style">Style</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
        </TabsList>

        <ScrollArea className="h-[600px] mt-4">
          <TabsContent value="style" className="space-y-4">
            {/* Text Styling */}
            {(block.type === 'text' || block.type === 'heading' || block.type === 'button') && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="textColor">Text Color</Label>
                  <Input
                    id="textColor"
                    type="color"
                    value={block.styles?.textColor || '#000000'}
                    onChange={(e) => updateStyles({ textColor: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fontSize">Font Size</Label>
                  <Input
                    id="fontSize"
                    value={block.styles?.fontSize || '16px'}
                    onChange={(e) => updateStyles({ fontSize: e.target.value })}
                    placeholder="16px"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fontWeight">Font Weight</Label>
                  <Select
                    value={block.styles?.fontWeight || 'normal'}
                    onValueChange={(value) => updateStyles({ fontWeight: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="bold">Bold</SelectItem>
                      <SelectItem value="lighter">Light</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="textAlign">Text Alignment</Label>
                  <Select
                    value={block.styles?.textAlign || 'left'}
                    onValueChange={(value) => updateStyles({ textAlign: value as 'left' | 'center' | 'right' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Left</SelectItem>
                      <SelectItem value="center">Center</SelectItem>
                      <SelectItem value="right">Right</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Background */}
            <div className="space-y-2">
              <Label htmlFor="backgroundColor">Background Color</Label>
              <Input
                id="backgroundColor"
                type="color"
                value={block.styles?.backgroundColor || '#ffffff'}
                onChange={(e) => updateStyles({ backgroundColor: e.target.value })}
              />
            </div>

            {/* Spacing */}
            <div className="space-y-2">
              <Label htmlFor="padding">Padding</Label>
              <Input
                id="padding"
                value={block.styles?.padding || '16px'}
                onChange={(e) => updateStyles({ padding: e.target.value })}
                placeholder="16px"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="margin">Margin</Label>
              <Input
                id="margin"
                value={block.styles?.margin || '0'}
                onChange={(e) => updateStyles({ margin: e.target.value })}
                placeholder="0"
              />
            </div>

            {/* Dimensions */}
            {(block.type === 'image' || block.type === 'logo' || block.type === 'spacer') && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="width">Width</Label>
                  <Input
                    id="width"
                    value={block.styles?.width || ''}
                    onChange={(e) => updateStyles({ width: e.target.value })}
                    placeholder="100%"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="height">Height</Label>
                  <Input
                    id="height"
                    value={block.styles?.height || ''}
                    onChange={(e) => updateStyles({ height: e.target.value })}
                    placeholder="auto"
                  />
                </div>
              </>
            )}

            {/* Border */}
            <div className="space-y-2">
              <Label htmlFor="borderWidth">Border Width</Label>
              <Input
                id="borderWidth"
                value={block.styles?.borderWidth || '0'}
                onChange={(e) => updateStyles({ borderWidth: e.target.value })}
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="borderColor">Border Color</Label>
              <Input
                id="borderColor"
                type="color"
                value={block.styles?.borderColor || '#000000'}
                onChange={(e) => updateStyles({ borderColor: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="borderRadius">Border Radius</Label>
              <Input
                id="borderRadius"
                value={block.styles?.borderRadius || '0'}
                onChange={(e) => updateStyles({ borderRadius: e.target.value })}
                placeholder="0"
              />
            </div>
          </TabsContent>

          <TabsContent value="content" className="space-y-4">
            {/* Button Settings */}
            {block.type === 'button' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="buttonHref">Link URL</Label>
                  <Input
                    id="buttonHref"
                    value={block.settings?.href || ''}
                    onChange={(e) => updateSettings({ href: e.target.value })}
                    placeholder="https://example.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="buttonTarget">Link Target</Label>
                  <Select
                    value={block.settings?.target || '_blank'}
                    onValueChange={(value) => updateSettings({ target: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_blank">New Window</SelectItem>
                      <SelectItem value="_self">Same Window</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Image Settings */}
            {(block.type === 'image' || block.type === 'logo') && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="imageSrc">Image URL</Label>
                  <Input
                    id="imageSrc"
                    value={block.settings?.src || ''}
                    onChange={(e) => updateSettings({ src: e.target.value })}
                    placeholder="https://example.com/image.jpg"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="imageAlt">Alt Text</Label>
                  <Input
                    id="imageAlt"
                    value={block.settings?.alt || ''}
                    onChange={(e) => updateSettings({ alt: e.target.value })}
                    placeholder="Image description"
                  />
                </div>
              </>
            )}

            {/* Spacer Settings */}
            {block.type === 'spacer' && (
              <div className="space-y-2">
                <Label htmlFor="spacing">Spacing</Label>
                <Input
                  id="spacing"
                  value={block.settings?.spacing || '20px'}
                  onChange={(e) => updateSettings({ spacing: e.target.value })}
                  placeholder="20px"
                />
              </div>
            )}
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </Card>
  )
}