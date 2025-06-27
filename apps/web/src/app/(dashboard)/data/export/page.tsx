"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { toast } from "sonner"
import { 
  Download, FileText, FileSpreadsheet, FilePlus, 
  Calendar as CalendarIcon, Clock, CheckCircle,
  AlertCircle, Loader2, Filter, Database,
  Users, Mail, Target, BarChart3, Shield,
  FileJson, FileCode, HardDrive, Zap
} from "lucide-react"
import { format, subDays, startOfMonth, endOfMonth } from "date-fns"
import { cn } from "@/lib/utils"

interface ExportJob {
  id: string
  type: string
  format: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  created_at: string
  completed_at?: string
  file_size?: number
  download_url?: string
  error?: string
  filters: any
}

const EXPORT_TYPES = [
  {
    id: 'leads',
    name: 'Leads',
    description: 'Export lead data with enrichment information',
    icon: Users,
    fields: [
      { id: 'email', label: 'Email', required: true },
      { id: 'first_name', label: 'First Name' },
      { id: 'last_name', label: 'Last Name' },
      { id: 'company', label: 'Company' },
      { id: 'job_title', label: 'Job Title' },
      { id: 'industry', label: 'Industry' },
      { id: 'location', label: 'Location' },
      { id: 'enrichment_data', label: 'Enrichment Data' },
      { id: 'tags', label: 'Tags' },
      { id: 'created_at', label: 'Created Date' },
      { id: 'last_activity', label: 'Last Activity' }
    ]
  },
  {
    id: 'campaigns',
    name: 'Campaigns',
    description: 'Export campaign performance data',
    icon: Target,
    fields: [
      { id: 'name', label: 'Campaign Name', required: true },
      { id: 'status', label: 'Status' },
      { id: 'emails_sent', label: 'Emails Sent' },
      { id: 'open_rate', label: 'Open Rate' },
      { id: 'click_rate', label: 'Click Rate' },
      { id: 'reply_rate', label: 'Reply Rate' },
      { id: 'bounce_rate', label: 'Bounce Rate' },
      { id: 'created_at', label: 'Created Date' },
      { id: 'last_sent', label: 'Last Email Sent' }
    ]
  },
  {
    id: 'email_events',
    name: 'Email Events',
    description: 'Export detailed email tracking events',
    icon: Mail,
    fields: [
      { id: 'campaign_name', label: 'Campaign', required: true },
      { id: 'lead_email', label: 'Lead Email', required: true },
      { id: 'subject', label: 'Subject Line' },
      { id: 'sent_at', label: 'Sent Date' },
      { id: 'delivered', label: 'Delivered' },
      { id: 'opened', label: 'Opened' },
      { id: 'clicked', label: 'Clicked' },
      { id: 'replied', label: 'Replied' },
      { id: 'bounced', label: 'Bounced' },
      { id: 'unsubscribed', label: 'Unsubscribed' }
    ]
  },
  {
    id: 'analytics',
    name: 'Analytics',
    description: 'Export aggregated analytics data',
    icon: BarChart3,
    fields: [
      { id: 'date', label: 'Date', required: true },
      { id: 'campaigns_sent', label: 'Campaigns Sent' },
      { id: 'total_emails', label: 'Total Emails' },
      { id: 'unique_opens', label: 'Unique Opens' },
      { id: 'unique_clicks', label: 'Unique Clicks' },
      { id: 'replies', label: 'Replies' },
      { id: 'conversions', label: 'Conversions' },
      { id: 'revenue', label: 'Revenue' }
    ]
  },
  {
    id: 'gdpr',
    name: 'GDPR Data',
    description: 'Export personal data for GDPR compliance',
    icon: Shield,
    fields: [
      { id: 'personal_info', label: 'Personal Information', required: true },
      { id: 'communication_history', label: 'Communication History' },
      { id: 'consent_records', label: 'Consent Records' },
      { id: 'data_sources', label: 'Data Sources' },
      { id: 'processing_activities', label: 'Processing Activities' }
    ]
  }
]

const EXPORT_FORMATS = [
  { id: 'csv', name: 'CSV', icon: FileText, description: 'Comma-separated values' },
  { id: 'xlsx', name: 'Excel', icon: FileSpreadsheet, description: 'Microsoft Excel format' },
  { id: 'json', name: 'JSON', icon: FileJson, description: 'JavaScript Object Notation' },
  { id: 'pdf', name: 'PDF', icon: FileCode, description: 'Portable Document Format' }
]

const DATE_RANGES = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_7_days', label: 'Last 7 days' },
  { value: 'last_30_days', label: 'Last 30 days' },
  { value: 'last_90_days', label: 'Last 90 days' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'custom', label: 'Custom range' }
]

export default function DataExportPage() {
  const [selectedType, setSelectedType] = useState<string>('leads')
  const [selectedFormat, setSelectedFormat] = useState<string>('csv')
  const [selectedFields, setSelectedFields] = useState<string[]>([])
  const [dateRange, setDateRange] = useState<string>('last_30_days')
  const [customDateRange, setCustomDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined
  })
  const [exportJobs, setExportJobs] = useState<ExportJob[]>([])
  const [isExporting, setIsExporting] = useState(false)

  const exportType = EXPORT_TYPES.find(t => t.id === selectedType)

  const handleFieldToggle = (fieldId: string) => {
    setSelectedFields(prev =>
      prev.includes(fieldId)
        ? prev.filter(f => f !== fieldId)
        : [...prev, fieldId]
    )
  }

  const handleSelectAllFields = () => {
    if (exportType) {
      setSelectedFields(exportType.fields.map(f => f.id))
    }
  }

  const handleDeselectAllFields = () => {
    if (exportType) {
      setSelectedFields(exportType.fields.filter(f => f.required).map(f => f.id))
    }
  }

  const startExport = async () => {
    if (!exportType) return

    // Validate fields
    const requiredFields = exportType.fields.filter(f => f.required).map(f => f.id)
    const missingRequired = requiredFields.filter(f => !selectedFields.includes(f))
    
    if (missingRequired.length > 0) {
      toast.error("Please select all required fields")
      return
    }

    setIsExporting(true)

    // Create export job
    const job: ExportJob = {
      id: Date.now().toString(),
      type: selectedType,
      format: selectedFormat,
      status: 'processing',
      progress: 0,
      created_at: new Date().toISOString(),
      filters: {
        fields: selectedFields,
        date_range: dateRange,
        custom_dates: dateRange === 'custom' ? customDateRange : null
      }
    }

    setExportJobs([job, ...exportJobs])

    // Simulate export progress
    let progress = 0
    const interval = setInterval(() => {
      progress += Math.random() * 30
      if (progress >= 100) {
        progress = 100
        clearInterval(interval)
        
        // Update job status
        setExportJobs(prev => prev.map(j => 
          j.id === job.id 
            ? {
                ...j,
                status: 'completed',
                progress: 100,
                completed_at: new Date().toISOString(),
                file_size: Math.floor(Math.random() * 10000000) + 100000,
                download_url: `/api/export/download/${job.id}`
              }
            : j
        ))
        
        setIsExporting(false)
        toast.success("Export completed successfully")
      } else {
        // Update progress
        setExportJobs(prev => prev.map(j => 
          j.id === job.id ? { ...j, progress } : j
        ))
      }
    }, 500)
  }

  const downloadExport = (job: ExportJob) => {
    if (job.download_url) {
      // In a real app, this would trigger a download
      toast.success("Download started")
    }
  }

  const getDateRangeText = () => {
    if (dateRange === 'custom' && customDateRange.from && customDateRange.to) {
      return `${format(customDateRange.from, 'PP')} - ${format(customDateRange.to, 'PP')}`
    }
    return DATE_RANGES.find(r => r.value === dateRange)?.label || ''
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Data Export</h1>
        <p className="text-muted-foreground">Export your data in various formats for analysis or compliance</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Export Configuration */}
        <div className="lg:col-span-2 space-y-6">
          {/* Export Type Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Select Data Type</CardTitle>
              <CardDescription>Choose what type of data you want to export</CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup value={selectedType} onValueChange={setSelectedType}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {EXPORT_TYPES.map((type) => {
                    const Icon = type.icon
                    return (
                      <div key={type.id} className="relative">
                        <RadioGroupItem
                          value={type.id}
                          id={type.id}
                          className="peer sr-only"
                        />
                        <Label
                          htmlFor={type.id}
                          className="flex items-start gap-3 rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer"
                        >
                          <Icon className="w-5 h-5 mt-0.5" />
                          <div className="space-y-1">
                            <div className="font-medium">{type.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {type.description}
                            </div>
                          </div>
                        </Label>
                      </div>
                    )
                  })}
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Field Selection */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Select Fields</CardTitle>
                  <CardDescription>Choose which fields to include in your export</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleSelectAllFields}>
                    Select All
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDeselectAllFields}>
                    Deselect All
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <div className="space-y-3">
                  {exportType?.fields.map((field) => (
                    <div key={field.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={field.id}
                        checked={selectedFields.includes(field.id)}
                        onCheckedChange={() => handleFieldToggle(field.id)}
                        disabled={field.required}
                      />
                      <Label
                        htmlFor={field.id}
                        className="flex-1 cursor-pointer"
                      >
                        {field.label}
                        {field.required && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            Required
                          </Badge>
                        )}
                      </Label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Date Range Filter */}
          <Card>
            <CardHeader>
              <CardTitle>Date Range</CardTitle>
              <CardDescription>Filter data by date range</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_RANGES.map((range) => (
                    <SelectItem key={range.value} value={range.value}>
                      {range.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {dateRange === 'custom' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>From</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !customDateRange.from && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {customDateRange.from ? format(customDateRange.from, "PP") : "Select date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={customDateRange.from}
                          onSelect={(date) => setCustomDateRange(prev => ({ ...prev, from: date }))}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label>To</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !customDateRange.to && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {customDateRange.to ? format(customDateRange.to, "PP") : "Select date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={customDateRange.to}
                          onSelect={(date) => setCustomDateRange(prev => ({ ...prev, to: date }))}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Export Format */}
          <Card>
            <CardHeader>
              <CardTitle>Export Format</CardTitle>
              <CardDescription>Choose the file format for your export</CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup value={selectedFormat} onValueChange={setSelectedFormat}>
                <div className="grid grid-cols-2 gap-4">
                  {EXPORT_FORMATS.map((format) => {
                    const Icon = format.icon
                    return (
                      <div key={format.id} className="relative">
                        <RadioGroupItem
                          value={format.id}
                          id={`format-${format.id}`}
                          className="peer sr-only"
                        />
                        <Label
                          htmlFor={`format-${format.id}`}
                          className="flex items-center gap-3 rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer"
                        >
                          <Icon className="w-5 h-5" />
                          <div>
                            <div className="font-medium">{format.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {format.description}
                            </div>
                          </div>
                        </Label>
                      </div>
                    )
                  })}
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Export Button */}
          <Button 
            onClick={startExport} 
            disabled={isExporting || selectedFields.length === 0}
            className="w-full"
            size="lg"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing Export...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Start Export
              </>
            )}
          </Button>
        </div>

        {/* Export History */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Export Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm text-muted-foreground">Data Type</div>
                <div className="font-medium">
                  {EXPORT_TYPES.find(t => t.id === selectedType)?.name}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Format</div>
                <div className="font-medium">
                  {EXPORT_FORMATS.find(f => f.id === selectedFormat)?.name}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Fields Selected</div>
                <div className="font-medium">{selectedFields.length} fields</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Date Range</div>
                <div className="font-medium">{getDateRangeText()}</div>
              </div>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <HardDrive className="w-4 h-4" />
                  <span>Estimated size: ~2.5 MB</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4" />
                  <span>Processing time: ~30 seconds</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Exports</CardTitle>
              <CardDescription>Your export history</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {exportJobs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No exports yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {exportJobs.map((job) => (
                      <div key={job.id} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-medium text-sm">
                              {EXPORT_TYPES.find(t => t.id === job.type)?.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(job.created_at), 'MMM dd, HH:mm')}
                            </div>
                          </div>
                          <Badge variant={
                            job.status === 'completed' ? 'default' :
                            job.status === 'processing' ? 'secondary' :
                            job.status === 'failed' ? 'destructive' : 'outline'
                          }>
                            {job.status}
                          </Badge>
                        </div>
                        
                        {job.status === 'processing' && (
                          <Progress value={job.progress} className="h-2" />
                        )}
                        
                        {job.status === 'completed' && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              {formatFileSize(job.file_size || 0)} • {job.format.toUpperCase()}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => downloadExport(job)}
                            >
                              <Download className="w-3 h-3 mr-1" />
                              Download
                            </Button>
                          </div>
                        )}
                        
                        {job.status === 'failed' && (
                          <div className="text-sm text-red-600">
                            {job.error || 'Export failed'}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}