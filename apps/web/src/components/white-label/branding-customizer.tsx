'use client'

import React, { useState, useEffect } from 'react'
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { ColorPicker, getContrastingColor } from '@/components/ui/color-picker'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Palette, 
  Upload, 
  Eye, 
  Download, 
  RefreshCw, 
  Save,
  Monitor,
  Smartphone,
  Image as ImageIcon,
  Type,
  Code,
  Globe
} from 'lucide-react'
import { useWhiteLabel } from './white-label-provider'
import { WhiteLabelBranding, BrandTheme, SocialLinks } from '@/lib/white-label/types'
import { toast } from 'sonner'

interface BrandingCustomizerProps {
  className?: string
}

const googleFonts = [
  { name: 'Inter', value: 'Inter, system-ui, sans-serif', url: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap' },
  { name: 'Roboto', value: 'Roboto, sans-serif', url: 'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap' },
  { name: 'Open Sans', value: 'Open Sans, sans-serif', url: 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;500;600;700&display=swap' },
  { name: 'Lato', value: 'Lato, sans-serif', url: 'https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700&display=swap' },
  { name: 'Montserrat', value: 'Montserrat, sans-serif', url: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap' },
  { name: 'Poppins', value: 'Poppins, sans-serif', url: 'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap' },
  { name: 'Source Sans Pro', value: 'Source Sans Pro, sans-serif', url: 'https://fonts.googleapis.com/css2?family=Source+Sans+Pro:wght@300;400;600;700&display=swap' },
  { name: 'Nunito', value: 'Nunito, sans-serif', url: 'https://fonts.googleapis.com/css2?family=Nunito:wght@300;400;500;600;700&display=swap' },
]

export function BrandingCustomizer({ className }: BrandingCustomizerProps) {
  const { branding, updateBranding, isUpdating, applyTheme } = useWhiteLabel()
  const [formData, setFormData] = useState<Partial<WhiteLabelBranding>>({})
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop')
  const [isDirty, setIsDirty] = useState(false)

  // Initialize form data from branding
  useEffect(() => {
    if (branding) {
      setFormData(branding)
    } else {
      // Set default values
      setFormData({
        company_name: '',
        primary_color: '#3b82f6',
        secondary_color: '#1e40af',
        accent_color: '#f59e0b',
        background_color: '#ffffff',
        text_color: '#1f2937',
        font_family: 'Inter, system-ui, sans-serif',
        theme_config: {
          borderRadius: '0.5rem',
          spacing: '1rem',
          shadows: true,
          animations: true,
        },
        social_links: {},
      })
    }
  }, [branding])

  // Generate preview theme
  const previewTheme: BrandTheme = {
    colors: {
      primary: formData.primary_color || '#3b82f6',
      secondary: formData.secondary_color || '#1e40af',
      accent: formData.accent_color || '#f59e0b',
      background: formData.background_color || '#ffffff',
      text: formData.text_color || '#1f2937',
    },
    fonts: {
      family: formData.font_family || 'Inter, system-ui, sans-serif',
      url: formData.font_url,
    },
    config: formData.theme_config || {
      borderRadius: '0.5rem',
      spacing: '1rem',
      shadows: true,
      animations: true,
    },
    customCSS: formData.custom_css,
  }

  const handleFieldChange = (field: keyof WhiteLabelBranding, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setIsDirty(true)
  }

  const handleSocialLinkChange = (platform: keyof SocialLinks, value: string) => {
    setFormData(prev => ({
      ...prev,
      social_links: {
        ...prev.social_links,
        [platform]: value || undefined,
      }
    }))
    setIsDirty(true)
  }

  const handleThemeConfigChange = (key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      theme_config: {
        ...prev.theme_config,
        [key]: value,
      }
    }))
    setIsDirty(true)
  }

  const handleSave = async () => {
    if (!formData.company_name?.trim()) {
      toast.error('Company name is required')
      return
    }

    try {
      await updateBranding(formData)
      setIsDirty(false)
      toast.success('Branding updated successfully')
    } catch (error) {
      toast.error('Failed to update branding')
    }
  }

  const handlePreview = () => {
    applyTheme(previewTheme)
    toast.success('Preview applied - refresh to see original theme')
  }

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // In a real app, you'd upload to a file storage service
      const url = URL.createObjectURL(file)
      handleFieldChange('logo_url', url)
      toast.success('Logo uploaded successfully')
    }
  }

  const handleFaviconUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const url = URL.createObjectURL(file)
      handleFieldChange('favicon_url', url)
      toast.success('Favicon uploaded successfully')
    }
  }

  const resetToDefaults = () => {
    setFormData({
      ...formData,
      primary_color: '#3b82f6',
      secondary_color: '#1e40af',
      accent_color: '#f59e0b',
      background_color: '#ffffff',
      text_color: '#1f2937',
      font_family: 'Inter, system-ui, sans-serif',
      theme_config: {
        borderRadius: '0.5rem',
        spacing: '1rem',
        shadows: true,
        animations: true,
      },
    })
    setIsDirty(true)
    toast.success('Reset to default values')
  }

  return (
    <div className={className}>
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Configuration Panel */}
        <Card className="lg:w-2/3">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Brand Customization
                </CardTitle>
                <CardDescription>
                  Customize your brand colors, fonts, and styling
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetToDefaults}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reset
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreview}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={!isDirty || isUpdating || !formData.company_name}
                  size="sm"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isUpdating ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="basic">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="basic">Basic</TabsTrigger>
                <TabsTrigger value="colors">Colors</TabsTrigger>
                <TabsTrigger value="typography">Typography</TabsTrigger>
                <TabsTrigger value="assets">Assets</TabsTrigger>
                <TabsTrigger value="advanced">Advanced</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="company_name">Company Name *</Label>
                    <Input
                      id="company_name"
                      value={formData.company_name || ''}
                      onChange={(e) => handleFieldChange('company_name', e.target.value)}
                      placeholder="Your Company Name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company_website">Website</Label>
                    <Input
                      id="company_website" 
                      value={formData.company_website || ''}
                      onChange={(e) => handleFieldChange('company_website', e.target.value)}
                      placeholder="https://yourcompany.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company_description">Description</Label>
                  <Textarea
                    id="company_description"
                    value={formData.company_description || ''}
                    onChange={(e) => handleFieldChange('company_description', e.target.value)}
                    placeholder="Brief description of your company"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="support_email">Support Email</Label>
                    <Input
                      id="support_email"
                      type="email"
                      value={formData.support_email || ''}
                      onChange={(e) => handleFieldChange('support_email', e.target.value)}
                      placeholder="support@yourcompany.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company_phone">Phone</Label>
                    <Input
                      id="company_phone"
                      value={formData.company_phone || ''}
                      onChange={(e) => handleFieldChange('company_phone', e.target.value)}
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <Label>Social Links</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(['twitter', 'linkedin', 'facebook', 'instagram'] as const).map((platform) => (
                      <div key={platform} className="space-y-2">
                        <Label htmlFor={platform} className="capitalize">{platform}</Label>
                        <Input
                          id={platform}
                          value={formData.social_links?.[platform] || ''}
                          onChange={(e) => handleSocialLinkChange(platform, e.target.value)}
                          placeholder={`https://${platform}.com/yourcompany`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="colors" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <ColorPicker
                    label="Primary Color"
                    value={formData.primary_color || '#3b82f6'}
                    onChange={(color) => handleFieldChange('primary_color', color)}
                  />
                  <ColorPicker
                    label="Secondary Color"
                    value={formData.secondary_color || '#1e40af'}
                    onChange={(color) => handleFieldChange('secondary_color', color)}
                  />
                  <ColorPicker
                    label="Accent Color"
                    value={formData.accent_color || '#f59e0b'}
                    onChange={(color) => handleFieldChange('accent_color', color)}
                  />
                  <ColorPicker
                    label="Background Color"
                    value={formData.background_color || '#ffffff'}
                    onChange={(color) => handleFieldChange('background_color', color)}
                  />
                  <ColorPicker
                    label="Text Color"
                    value={formData.text_color || '#1f2937'}
                    onChange={(color) => handleFieldChange('text_color', color)}
                  />
                </div>

                <Alert>
                  <Palette className="h-4 w-4" />
                  <AlertDescription>
                    Primary color is used for buttons and links. Secondary for accents. 
                    Make sure text color has good contrast with background.
                  </AlertDescription>
                </Alert>
              </TabsContent>

              <TabsContent value="typography" className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Font Family</Label>
                    <Select
                      value={formData.font_family || 'Inter, system-ui, sans-serif'}
                      onValueChange={(value) => {
                        const font = googleFonts.find(f => f.value === value)
                        handleFieldChange('font_family', value)
                        if (font?.url) {
                          handleFieldChange('font_url', font.url)
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {googleFonts.map((font) => (
                          <SelectItem key={font.value} value={font.value}>
                            <span style={{ fontFamily: font.value }}>{font.name}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="custom_font_url">Custom Font URL (optional)</Label>
                    <Input
                      id="custom_font_url"
                      value={formData.font_url || ''}
                      onChange={(e) => handleFieldChange('font_url', e.target.value)}
                      placeholder="https://fonts.googleapis.com/css2?family=..."
                    />
                  </div>
                </div>

                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">Font Preview</h4>
                  <div style={{ fontFamily: formData.font_family }}>
                    <p className="text-2xl font-bold mb-2">The quick brown fox</p>
                    <p className="text-lg mb-2">jumps over the lazy dog</p>
                    <p className="text-sm text-muted-foreground">
                      ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 1234567890
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="assets" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <Label>Logo</Label>
                    <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                      {formData.logo_url ? (
                        <div className="space-y-4">
                          <img
                            src={formData.logo_url}
                            alt="Logo"
                            className="mx-auto max-h-16 w-auto"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleFieldChange('logo_url', '')}
                          >
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground" />
                          <div>
                            <Label htmlFor="logo-upload" className="cursor-pointer">
                              <Button variant="outline" size="sm" asChild>
                                <span>
                                  <Upload className="h-4 w-4 mr-2" />
                                  Upload Logo
                                </span>
                              </Button>
                            </Label>
                            <Input
                              id="logo-upload"
                              type="file"
                              accept="image/*"
                              onChange={handleLogoUpload}
                              className="hidden"
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            PNG, JPG up to 2MB
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label>Favicon</Label>
                    <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                      {formData.favicon_url ? (
                        <div className="space-y-4">
                          <img
                            src={formData.favicon_url}
                            alt="Favicon"
                            className="mx-auto h-8 w-8"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleFieldChange('favicon_url', '')}
                          >
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Globe className="mx-auto h-8 w-8 text-muted-foreground" />
                          <div>
                            <Label htmlFor="favicon-upload" className="cursor-pointer">
                              <Button variant="outline" size="sm" asChild>
                                <span>
                                  <Upload className="h-4 w-4 mr-2" />
                                  Upload Favicon
                                </span>
                              </Button>
                            </Label>
                            <Input
                              id="favicon-upload"
                              type="file"
                              accept="image/x-icon,image/png"
                              onChange={handleFaviconUpload}
                              className="hidden"
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            ICO or PNG, 32x32px
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="advanced" className="space-y-6">
                <div className="space-y-4">
                  <Label>Theme Configuration</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="border_radius">Border Radius</Label>
                      <Input
                        id="border_radius"
                        value={formData.theme_config?.borderRadius || '0.5rem'}
                        onChange={(e) => handleThemeConfigChange('borderRadius', e.target.value)}
                        placeholder="0.5rem"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="spacing">Base Spacing</Label>
                      <Input
                        id="spacing"
                        value={formData.theme_config?.spacing || '1rem'}
                        onChange={(e) => handleThemeConfigChange('spacing', e.target.value)}
                        placeholder="1rem"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Shadows</Label>
                      <p className="text-sm text-muted-foreground">Enable drop shadows</p>
                    </div>
                    <Switch
                      checked={formData.theme_config?.shadows ?? true}
                      onCheckedChange={(checked) => handleThemeConfigChange('shadows', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Animations</Label>
                      <p className="text-sm text-muted-foreground">Enable UI animations</p>
                    </div>
                    <Switch
                      checked={formData.theme_config?.animations ?? true}
                      onCheckedChange={(checked) => handleThemeConfigChange('animations', checked)}
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="custom_css">Custom CSS</Label>
                  <Textarea
                    id="custom_css"
                    value={formData.custom_css || ''}
                    onChange={(e) => handleFieldChange('custom_css', e.target.value)}
                    placeholder="/* Custom styles */"
                    rows={8}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Advanced: Add custom CSS to override default styles
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Live Preview Panel */}
        <Card className="lg:w-1/3">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Live Preview
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewMode('desktop')}
                  className={previewMode === 'desktop' ? 'bg-accent' : ''}
                >
                  <Monitor className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewMode('mobile')}
                  className={previewMode === 'mobile' ? 'bg-accent' : ''}
                >
                  <Smartphone className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <BrandPreview
              theme={previewTheme}
              companyName={formData.company_name || 'Your Company'}
              logoUrl={formData.logo_url}
              mode={previewMode}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

interface BrandPreviewProps {
  theme: BrandTheme
  companyName: string
  logoUrl?: string
  mode: 'desktop' | 'mobile'
}

function BrandPreview({ theme, companyName, logoUrl, mode }: BrandPreviewProps) {
  const containerStyle = {
    '--preview-primary': theme.colors.primary,
    '--preview-secondary': theme.colors.secondary,
    '--preview-accent': theme.colors.accent,
    '--preview-background': theme.colors.background,
    '--preview-text': theme.colors.text,
    '--preview-font': theme.fonts.family,
    '--preview-border-radius': theme.config.borderRadius,
    '--preview-spacing': theme.config.spacing,
  } as React.CSSProperties

  return (
    <div 
      className={`
        border rounded-lg overflow-hidden
        ${mode === 'mobile' ? 'max-w-sm mx-auto' : 'w-full'}
      `}
      style={containerStyle}
    >
      {/* Preview Header */}
      <div 
        className="p-4 border-b"
        style={{ 
          backgroundColor: theme.colors.background,
          color: theme.colors.text,
          fontFamily: theme.fonts.family,
        }}
      >
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-8 w-auto" />
          ) : (
            <div 
              className="h-8 w-8 rounded"
              style={{ backgroundColor: theme.colors.primary }}
            />
          )}
          <h3 className="font-semibold">{companyName}</h3>
        </div>
      </div>

      {/* Preview Content */}
      <div 
        className="p-4 space-y-4"
        style={{ 
          backgroundColor: theme.colors.background,
          color: theme.colors.text,
          fontFamily: theme.fonts.family,
        }}
      >
        <div className="space-y-2">
          <h4 className="font-bold text-lg">Welcome to {companyName}</h4>
          <p className="text-sm opacity-75">
            This is how your brand will look to customers
          </p>
        </div>

        <div className="space-y-2">
          <button
            className="w-full px-4 py-2 rounded text-white font-medium transition-opacity hover:opacity-90"
            style={{ 
              backgroundColor: theme.colors.primary,
              borderRadius: theme.config.borderRadius,
            }}
          >
            Primary Button
          </button>
          <button
            className="w-full px-4 py-2 rounded border font-medium transition-opacity hover:opacity-90"
            style={{ 
              borderColor: theme.colors.primary,
              color: theme.colors.primary,
              borderRadius: theme.config.borderRadius,
            }}
          >
            Secondary Button
          </button>
        </div>

        <div 
          className="p-3 rounded"
          style={{ 
            backgroundColor: theme.colors.accent + '20', // 20% opacity
            borderRadius: theme.config.borderRadius,
          }}
        >
          <p className="text-sm font-medium" style={{ color: theme.colors.accent }}>
            Accent Color Example
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[theme.colors.primary, theme.colors.secondary, theme.colors.accent].map((color, i) => (
            <div
              key={i}
              className="h-8 rounded"
              style={{ 
                backgroundColor: color,
                borderRadius: theme.config.borderRadius,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}