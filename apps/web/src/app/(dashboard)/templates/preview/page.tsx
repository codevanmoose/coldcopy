"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"
import { 
  ArrowLeft, Eye, Send, Copy, Download, Smartphone, Monitor,
  RefreshCw, Settings, Mail
} from "lucide-react"
import Link from "next/link"

interface TemplateBlock {
  id: string
  type: 'text' | 'image' | 'button' | 'divider' | 'spacer'
  content: any
  styles: any
}

interface EmailTemplate {
  id?: string
  name: string
  subject: string
  blocks: TemplateBlock[]
  variables: Record<string, any>
}

const SAMPLE_DATA = {
  first_name: "John",
  last_name: "Smith",
  company: "TechCorp Inc",
  job_title: "Chief Technology Officer",
  email: "john.smith@techcorp.com",
  phone: "+1 (555) 123-4567",
  industry: "Software Technology",
  location: "San Francisco, CA",
  website: "https://techcorp.com",
  employee_count: "150-500",
  revenue: "$10M-50M"
}

const PREVIEW_DEVICES = [
  { id: 'desktop', name: 'Desktop', icon: Monitor, width: '600px' },
  { id: 'mobile', name: 'Mobile', icon: Smartphone, width: '320px' }
]

export default function TemplatePreviewPage() {
  const searchParams = useSearchParams()
  const templateId = searchParams.get('id')
  
  const [template, setTemplate] = useState<EmailTemplate | null>(null)
  const [sampleData, setSampleData] = useState(SAMPLE_DATA)
  const [previewDevice, setPreviewDevice] = useState('desktop')
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    if (templateId) {
      loadTemplate(templateId)
    } else {
      setIsLoading(false)
    }
  }, [templateId])

  const loadTemplate = async (id: string) => {
    setIsLoading(true)
    try {
      // In a real app, this would be an API call
      // For now, load from localStorage or use mock data
      const mockTemplate: EmailTemplate = {
        id: id,
        name: "Sample Cold Outreach",
        subject: "Quick question about {{company}}'s growth strategy",
        blocks: [
          {
            id: 'text-1',
            type: 'text',
            content: { text: 'Hi {{first_name}},\n\nI hope this email finds you well. I came across {{company}} and was impressed by your work in {{industry}}.\n\nI wanted to reach out because I believe we could help {{company}} achieve significant growth through our platform.' },
            styles: { 
              fontSize: '16px', 
              color: '#333333', 
              textAlign: 'left',
              lineHeight: '1.6',
              marginBottom: '16px'
            }
          },
          {
            id: 'text-2',
            type: 'text',
            content: { text: 'We\'ve helped similar companies in the {{industry}} space increase their revenue by 35% on average within 6 months.' },
            styles: { 
              fontSize: '16px', 
              color: '#333333', 
              textAlign: 'left',
              lineHeight: '1.6',
              marginBottom: '16px'
            }
          },
          {
            id: 'button-1',
            type: 'button',
            content: { text: 'Schedule a Quick Call', url: 'https://calendly.com/demo' },
            styles: { 
              backgroundColor: '#3b82f6', 
              color: '#ffffff', 
              padding: '12px 24px',
              borderRadius: '6px',
              textAlign: 'center',
              display: 'inline-block',
              textDecoration: 'none',
              fontSize: '16px',
              fontWeight: '600',
              margin: '16px auto'
            }
          },
          {
            id: 'divider-1',
            type: 'divider',
            content: {},
            styles: { 
              borderTop: '1px solid #e5e7eb', 
              margin: '24px 0',
              width: '100%'
            }
          },
          {
            id: 'text-3',
            type: 'text',
            content: { text: 'Best regards,\nAlex Johnson\nBusiness Development\nGrowthTech Solutions' },
            styles: { 
              fontSize: '14px', 
              color: '#6b7280', 
              textAlign: 'left',
              lineHeight: '1.5',
              marginBottom: '16px'
            }
          }
        ],
        variables: {}
      }
      setTemplate(mockTemplate)
    } catch (error) {
      toast.error("Failed to load template")
    } finally {
      setIsLoading(false)
    }
  }

  const processVariables = (text: string) => {
    let processedText = text
    Object.entries(sampleData).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g')
      processedText = processedText.replace(regex, value.toString())
    })
    return processedText
  }

  const renderBlock = (block: TemplateBlock) => {
    switch (block.type) {
      case 'text':
        return (
          <div 
            style={block.styles}
            dangerouslySetInnerHTML={{ 
              __html: processVariables(block.content.text).replace(/\n/g, '<br>') 
            }}
          />
        )

      case 'image':
        return (
          <div style={{ textAlign: block.styles.textAlign || 'center', margin: block.styles.margin }}>
            {block.content.src ? (
              <img 
                src={block.content.src} 
                alt={block.content.alt}
                style={block.styles}
                className="max-w-full"
              />
            ) : (
              <div 
                style={{ ...block.styles, backgroundColor: '#f3f4f6' }}
                className="flex items-center justify-center text-gray-500 border-2 border-dashed border-gray-300 p-8"
              >
                <span>Image placeholder</span>
              </div>
            )}
          </div>
        )

      case 'button':
        return (
          <div style={{ textAlign: 'center', margin: block.styles.margin }}>
            <a
              href={block.content.url || '#'}
              style={block.styles}
              className="inline-block"
            >
              {processVariables(block.content.text)}
            </a>
          </div>
        )

      case 'divider':
        return <hr style={block.styles} />

      case 'spacer':
        return <div style={{ height: block.content.height + 'px' }} />

      default:
        return null
    }
  }

  const handleRefreshPreview = () => {
    setIsRefreshing(true)
    setTimeout(() => {
      setIsRefreshing(false)
      toast.success("Preview refreshed")
    }, 500)
  }

  const handleCopyHTML = () => {
    if (!template) return
    
    const htmlContent = generateEmailHTML()
    navigator.clipboard.writeText(htmlContent)
    toast.success("HTML copied to clipboard")
  }

  const handleSendTestEmail = () => {
    toast.success("Test email sent to your address")
  }

  const generateEmailHTML = () => {
    if (!template) return ""
    
    const blocksHTML = template.blocks.map(block => {
      switch (block.type) {
        case 'text':
          return `<div style="${convertStylesToString(block.styles)}">${processVariables(block.content.text).replace(/\n/g, '<br>')}</div>`
        case 'button':
          return `<div style="text-align: center; margin: ${block.styles.margin || '16px auto'}"><a href="${block.content.url}" style="${convertStylesToString(block.styles)}">${processVariables(block.content.text)}</a></div>`
        case 'divider':
          return `<hr style="${convertStylesToString(block.styles)}" />`
        case 'spacer':
          return `<div style="height: ${block.content.height}px;"></div>`
        case 'image':
          return block.content.src ? `<div style="text-align: center;"><img src="${block.content.src}" alt="${block.content.alt}" style="${convertStylesToString(block.styles)}" /></div>` : ''
        default:
          return ''
      }
    }).join('')

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${processVariables(template.subject)}</title>
</head>
<body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
    ${blocksHTML}
  </div>
</body>
</html>`
  }

  const convertStylesToString = (styles: any) => {
    return Object.entries(styles)
      .map(([key, value]) => `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value}`)
      .join('; ')
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Loading template...
        </div>
      </div>
    )
  }

  if (!template) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <Mail className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <h2 className="text-xl font-semibold mb-2">Template not found</h2>
          <p className="text-gray-600 mb-4">The template you're looking for doesn't exist or has been deleted.</p>
          <Button asChild>
            <Link href="/templates">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Templates
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  const currentDevice = PREVIEW_DEVICES.find(d => d.id === previewDevice)

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Sidebar - Sample Data */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Sample Data</h2>
            <Button size="sm" variant="outline" onClick={handleRefreshPreview} disabled={isRefreshing}>
              <RefreshCw className={`w-3 h-3 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
          <Badge variant="secondary" className="text-xs">
            Variables will be replaced with this data
          </Badge>
        </div>
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-3">
            {Object.entries(sampleData).map(([key, value]) => (
              <div key={key}>
                <Label htmlFor={key} className="text-xs font-medium text-gray-600 uppercase">
                  {key.replace('_', ' ')}
                </Label>
                <Input
                  id={key}
                  value={value}
                  onChange={(e) => setSampleData(prev => ({ ...prev, [key]: e.target.value }))}
                  className="mt-1 text-sm"
                />
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main Preview Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Toolbar */}
        <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" asChild>
              <Link href="/templates">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Link>
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div>
              <h1 className="font-semibold">{template.name}</h1>
              <p className="text-sm text-gray-600">Preview Mode</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {PREVIEW_DEVICES.map((device) => {
              const Icon = device.icon
              return (
                <Button
                  key={device.id}
                  variant={previewDevice === device.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPreviewDevice(device.id)}
                >
                  <Icon className="w-4 h-4 mr-1" />
                  {device.name}
                </Button>
              )
            })}
            <Separator orientation="vertical" className="h-6" />
            <Button variant="outline" size="sm" onClick={handleCopyHTML}>
              <Copy className="w-4 h-4 mr-2" />
              Copy HTML
            </Button>
            <Button variant="outline" size="sm" onClick={handleSendTestEmail}>
              <Send className="w-4 h-4 mr-2" />
              Send Test
            </Button>
            <Button size="sm" asChild>
              <Link href={`/templates/editor?id=${template.id}`}>
                <Settings className="w-4 h-4 mr-2" />
                Edit Template
              </Link>
            </Button>
          </div>
        </div>

        {/* Preview Content */}
        <div className="flex-1 p-8 overflow-auto">
          <div className="max-w-4xl mx-auto">
            {/* Subject Preview */}
            <Card className="mb-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email Subject
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 p-3 rounded border font-medium">
                  {processVariables(template.subject)}
                </div>
              </CardContent>
            </Card>

            {/* Email Preview */}
            <div className="flex justify-center">
              <div 
                className="bg-white border shadow-lg rounded-lg overflow-hidden transition-all duration-300"
                style={{ 
                  width: currentDevice?.width,
                  maxWidth: '100%'
                }}
              >
                <div className="p-6">
                  {template.blocks.map((block) => (
                    <div key={block.id} className="mb-2">
                      {renderBlock(block)}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Device Info */}
            <div className="text-center mt-6">
              <Badge variant="outline" className="text-xs">
                {currentDevice?.name} Preview ({currentDevice?.width})
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}