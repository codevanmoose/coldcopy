"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { 
  Plus, Save, Download, Share2, Settings, Trash2, 
  BarChart3, PieChart, TrendingUp, Calendar, Users,
  Mail, MousePointer, Target, Activity, Clock,
  GripVertical, X, Copy, RefreshCw, Filter,
  LineChart, AreaChart, Layers, FileText
} from "lucide-react"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"
import {
  LineChart as RechartsLineChart, Line,
  AreaChart as RechartsAreaChart, Area,
  BarChart as RechartsBarChart, Bar,
  PieChart as RechartsPieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts"
import { format, subDays } from "date-fns"

interface ReportWidget {
  id: string
  type: 'line_chart' | 'bar_chart' | 'area_chart' | 'pie_chart' | 'metric_card' | 'table' | 'funnel'
  title: string
  dataSource: string
  config: any
  size: 'small' | 'medium' | 'large' | 'full'
  data?: any
}

interface Report {
  id: string
  name: string
  description: string
  widgets: ReportWidget[]
  filters: any
  created_at: string
  updated_at: string
  is_public: boolean
  schedule?: {
    frequency: 'daily' | 'weekly' | 'monthly'
    recipients: string[]
  }
}

const WIDGET_TYPES = [
  {
    type: 'line_chart',
    icon: LineChart,
    label: 'Line Chart',
    description: 'Show trends over time',
    defaultSize: 'medium'
  },
  {
    type: 'bar_chart',
    icon: BarChart3,
    label: 'Bar Chart',
    description: 'Compare values across categories',
    defaultSize: 'medium'
  },
  {
    type: 'area_chart',
    icon: AreaChart,
    label: 'Area Chart',
    description: 'Show cumulative trends',
    defaultSize: 'medium'
  },
  {
    type: 'pie_chart',
    icon: PieChart,
    label: 'Pie Chart',
    description: 'Show distribution of values',
    defaultSize: 'small'
  },
  {
    type: 'metric_card',
    icon: Activity,
    label: 'Metric Card',
    description: 'Display key metrics',
    defaultSize: 'small'
  },
  {
    type: 'table',
    icon: FileText,
    label: 'Data Table',
    description: 'Show detailed data in rows',
    defaultSize: 'large'
  },
  {
    type: 'funnel',
    icon: Filter,
    label: 'Funnel Chart',
    description: 'Show conversion funnel',
    defaultSize: 'medium'
  }
]

const DATA_SOURCES = [
  { value: 'campaign_performance', label: 'Campaign Performance' },
  { value: 'email_engagement', label: 'Email Engagement' },
  { value: 'lead_activity', label: 'Lead Activity' },
  { value: 'conversion_funnel', label: 'Conversion Funnel' },
  { value: 'send_times', label: 'Send Time Analysis' },
  { value: 'content_performance', label: 'Content Performance' },
  { value: 'workspace_overview', label: 'Workspace Overview' }
]

// Mock data generators
const generateMockData = (dataSource: string, days: number = 30) => {
  switch (dataSource) {
    case 'campaign_performance':
      return Array.from({ length: days }, (_, i) => ({
        date: format(subDays(new Date(), days - i - 1), 'MMM dd'),
        sent: Math.floor(Math.random() * 1000 + 500),
        opened: Math.floor(Math.random() * 600 + 200),
        clicked: Math.floor(Math.random() * 200 + 50),
        replied: Math.floor(Math.random() * 50 + 10)
      }))
    
    case 'email_engagement':
      return Array.from({ length: days }, (_, i) => ({
        date: format(subDays(new Date(), days - i - 1), 'MMM dd'),
        open_rate: Math.random() * 30 + 20,
        click_rate: Math.random() * 10 + 5,
        reply_rate: Math.random() * 5 + 2
      }))
    
    case 'lead_activity':
      return [
        { segment: 'Hot', value: 245, percentage: 15 },
        { segment: 'Warm', value: 412, percentage: 25 },
        { segment: 'Lukewarm', value: 523, percentage: 32 },
        { segment: 'Cold', value: 458, percentage: 28 }
      ]
    
    case 'conversion_funnel':
      return [
        { stage: 'Sent', value: 10000, percentage: 100 },
        { stage: 'Delivered', value: 9500, percentage: 95 },
        { stage: 'Opened', value: 3800, percentage: 38 },
        { stage: 'Clicked', value: 950, percentage: 9.5 },
        { stage: 'Replied', value: 285, percentage: 2.85 }
      ]
    
    default:
      return []
  }
}

export default function ReportBuilderPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [isCreatingReport, setIsCreatingReport] = useState(false)
  const [newReport, setNewReport] = useState({
    name: '',
    description: ''
  })
  const [selectedWidgetType, setSelectedWidgetType] = useState<string | null>(null)
  const [isAddingWidget, setIsAddingWidget] = useState(false)

  useEffect(() => {
    loadReports()
  }, [])

  const loadReports = async () => {
    // Mock data - replace with API call
    const mockReports: Report[] = [
      {
        id: '1',
        name: 'Weekly Campaign Performance',
        description: 'Overview of all campaign metrics for the past week',
        widgets: [
          {
            id: 'w1',
            type: 'line_chart',
            title: 'Email Engagement Trends',
            dataSource: 'campaign_performance',
            config: { period: 7 },
            size: 'large',
            data: generateMockData('campaign_performance', 7)
          },
          {
            id: 'w2',
            type: 'metric_card',
            title: 'Total Emails Sent',
            dataSource: 'workspace_overview',
            config: {},
            size: 'small'
          }
        ],
        filters: { period: '7d' },
        created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
        updated_at: new Date(Date.now() - 86400000).toISOString(),
        is_public: false
      }
    ]
    setReports(mockReports)
  }

  const createReport = async () => {
    if (!newReport.name) {
      toast.error("Please enter a report name")
      return
    }

    const report: Report = {
      id: Date.now().toString(),
      name: newReport.name,
      description: newReport.description,
      widgets: [],
      filters: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_public: false
    }

    setReports([...reports, report])
    setSelectedReport(report)
    setIsCreatingReport(false)
    setNewReport({ name: '', description: '' })
    toast.success("Report created successfully")
  }

  const addWidget = (type: string) => {
    if (!selectedReport) return

    const widgetType = WIDGET_TYPES.find(w => w.type === type)
    if (!widgetType) return

    const newWidget: ReportWidget = {
      id: `widget_${Date.now()}`,
      type: type as any,
      title: `New ${widgetType.label}`,
      dataSource: DATA_SOURCES[0].value,
      config: {},
      size: widgetType.defaultSize as any,
      data: generateMockData(DATA_SOURCES[0].value)
    }

    const updatedReport = {
      ...selectedReport,
      widgets: [...selectedReport.widgets, newWidget]
    }
    
    setSelectedReport(updatedReport)
    setReports(reports.map(r => r.id === updatedReport.id ? updatedReport : r))
    setIsAddingWidget(false)
    setSelectedWidgetType(null)
  }

  const updateWidget = (widgetId: string, updates: Partial<ReportWidget>) => {
    if (!selectedReport) return

    const updatedWidgets = selectedReport.widgets.map(w =>
      w.id === widgetId ? { ...w, ...updates } : w
    )

    const updatedReport = {
      ...selectedReport,
      widgets: updatedWidgets
    }

    setSelectedReport(updatedReport)
    setReports(reports.map(r => r.id === updatedReport.id ? updatedReport : r))
  }

  const removeWidget = (widgetId: string) => {
    if (!selectedReport) return

    const updatedReport = {
      ...selectedReport,
      widgets: selectedReport.widgets.filter(w => w.id !== widgetId)
    }

    setSelectedReport(updatedReport)
    setReports(reports.map(r => r.id === updatedReport.id ? updatedReport : r))
  }

  const onDragEnd = (result: any) => {
    if (!result.destination || !selectedReport) return

    const widgets = Array.from(selectedReport.widgets)
    const [reorderedWidget] = widgets.splice(result.source.index, 1)
    widgets.splice(result.destination.index, 0, reorderedWidget)

    const updatedReport = {
      ...selectedReport,
      widgets
    }

    setSelectedReport(updatedReport)
    setReports(reports.map(r => r.id === updatedReport.id ? updatedReport : r))
  }

  const renderWidget = (widget: ReportWidget) => {
    switch (widget.type) {
      case 'line_chart':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <RechartsLineChart data={widget.data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="sent" stroke="#8884d8" name="Sent" />
              <Line type="monotone" dataKey="opened" stroke="#82ca9d" name="Opened" />
              <Line type="monotone" dataKey="clicked" stroke="#ffc658" name="Clicked" />
            </RechartsLineChart>
          </ResponsiveContainer>
        )

      case 'bar_chart':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <RechartsBarChart data={widget.data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="sent" fill="#8884d8" />
              <Bar dataKey="opened" fill="#82ca9d" />
              <Bar dataKey="clicked" fill="#ffc658" />
            </RechartsBarChart>
          </ResponsiveContainer>
        )

      case 'area_chart':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <RechartsAreaChart data={widget.data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="open_rate" stackId="1" stroke="#8884d8" fill="#8884d8" />
              <Area type="monotone" dataKey="click_rate" stackId="1" stroke="#82ca9d" fill="#82ca9d" />
              <Area type="monotone" dataKey="reply_rate" stackId="1" stroke="#ffc658" fill="#ffc658" />
            </RechartsAreaChart>
          </ResponsiveContainer>
        )

      case 'pie_chart':
        const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042']
        return (
          <ResponsiveContainer width="100%" height={300}>
            <RechartsPieChart>
              <Pie
                data={widget.data || generateMockData('lead_activity')}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.segment}: ${entry.percentage}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {(widget.data || []).map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </RechartsPieChart>
          </ResponsiveContainer>
        )

      case 'metric_card':
        return (
          <div className="text-center p-6">
            <div className="text-4xl font-bold text-primary">12,543</div>
            <div className="text-sm text-muted-foreground mt-2">Total Emails Sent</div>
            <div className="flex items-center justify-center mt-4 text-green-600">
              <TrendingUp className="w-4 h-4 mr-1" />
              <span className="text-sm">+23.5% from last period</span>
            </div>
          </div>
        )

      case 'table':
        return (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Campaign</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sent</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Open Rate</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Click Rate</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reply Rate</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap">Q4 Outreach</td>
                  <td className="px-6 py-4 whitespace-nowrap">2,543</td>
                  <td className="px-6 py-4 whitespace-nowrap">32.5%</td>
                  <td className="px-6 py-4 whitespace-nowrap">8.2%</td>
                  <td className="px-6 py-4 whitespace-nowrap">3.1%</td>
                </tr>
              </tbody>
            </table>
          </div>
        )

      case 'funnel':
        const funnelData = widget.data || generateMockData('conversion_funnel')
        return (
          <div className="space-y-4 p-6">
            {funnelData.map((stage: any, index: number) => (
              <div key={stage.stage} className="relative">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 rounded"
                  style={{ width: `${stage.percentage}%`, minWidth: '150px' }}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{stage.stage}</span>
                    <span>{stage.value.toLocaleString()}</span>
                  </div>
                </div>
                {index < funnelData.length - 1 && (
                  <div className="ml-4 mt-1 text-sm text-gray-500">
                    {Math.round(((funnelData[index].value - funnelData[index + 1].value) / funnelData[index].value) * 100)}% drop-off
                  </div>
                )}
              </div>
            ))}
          </div>
        )

      default:
        return <div>Widget type not supported</div>
    }
  }

  const getWidgetSizeClass = (size: string) => {
    switch (size) {
      case 'small':
        return 'md:col-span-1'
      case 'medium':
        return 'md:col-span-2'
      case 'large':
        return 'md:col-span-3'
      case 'full':
        return 'md:col-span-4'
      default:
        return 'md:col-span-2'
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Report Builder</h1>
          <p className="text-muted-foreground">Create custom analytics reports with drag-and-drop widgets</p>
        </div>
        <Dialog open={isCreatingReport} onOpenChange={setIsCreatingReport}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Report
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Report</DialogTitle>
              <DialogDescription>
                Build a custom report to track your key metrics
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="report-name">Report Name</Label>
                <Input
                  id="report-name"
                  value={newReport.name}
                  onChange={(e) => setNewReport({ ...newReport, name: e.target.value })}
                  placeholder="e.g., Weekly Performance Dashboard"
                />
              </div>
              <div>
                <Label htmlFor="report-description">Description</Label>
                <Input
                  id="report-description"
                  value={newReport.description}
                  onChange={(e) => setNewReport({ ...newReport, description: e.target.value })}
                  placeholder="Brief description of the report"
                />
              </div>
              <Button onClick={createReport} className="w-full">
                Create Report
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Report Tabs */}
      {reports.length > 0 && (
        <Tabs value={selectedReport?.id || reports[0]?.id} onValueChange={(id) => setSelectedReport(reports.find(r => r.id === id) || null)}>
          <div className="flex items-center justify-between">
            <TabsList>
              {reports.map((report) => (
                <TabsTrigger key={report.id} value={report.id}>
                  {report.name}
                </TabsTrigger>
              ))}
            </TabsList>
            
            {selectedReport && (
              <div className="flex gap-2">
                <Dialog open={isAddingWidget} onOpenChange={setIsAddingWidget}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Widget
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Add Widget</DialogTitle>
                      <DialogDescription>
                        Choose a widget type to add to your report
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4">
                      {WIDGET_TYPES.map((widget) => {
                        const Icon = widget.icon
                        return (
                          <Card
                            key={widget.type}
                            className={`cursor-pointer transition-colors ${
                              selectedWidgetType === widget.type ? 'border-primary' : ''
                            }`}
                            onClick={() => setSelectedWidgetType(widget.type)}
                          >
                            <CardHeader className="pb-3">
                              <div className="flex items-center gap-2">
                                <Icon className="w-5 h-5" />
                                <CardTitle className="text-sm">{widget.label}</CardTitle>
                              </div>
                              <CardDescription className="text-xs">
                                {widget.description}
                              </CardDescription>
                            </CardHeader>
                          </Card>
                        )
                      })}
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                      <Button variant="outline" onClick={() => setIsAddingWidget(false)}>
                        Cancel
                      </Button>
                      <Button onClick={() => selectedWidgetType && addWidget(selectedWidgetType)}>
                        Add Widget
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                
                <Button variant="outline" size="sm">
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
                <Button variant="outline" size="sm">
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </Button>
              </div>
            )}
          </div>

          {reports.map((report) => (
            <TabsContent key={report.id} value={report.id} className="mt-6">
              {report.widgets.length === 0 ? (
                <Card className="p-12 text-center">
                  <Layers className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-semibold mb-2">No widgets yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Add widgets to start building your custom report
                  </p>
                  <Button onClick={() => setIsAddingWidget(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Your First Widget
                  </Button>
                </Card>
              ) : (
                <DragDropContext onDragEnd={onDragEnd}>
                  <Droppable droppableId="widgets">
                    {(provided) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className="grid grid-cols-1 md:grid-cols-4 gap-4"
                      >
                        {report.widgets.map((widget, index) => (
                          <Draggable key={widget.id} draggableId={widget.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`${getWidgetSizeClass(widget.size)}`}
                              >
                                <Card className={`${snapshot.isDragging ? 'shadow-lg' : ''}`}>
                                  <CardHeader className="pb-3">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <div {...provided.dragHandleProps}>
                                          <GripVertical className="w-4 h-4 text-gray-400 cursor-move" />
                                        </div>
                                        <CardTitle className="text-sm">{widget.title}</CardTitle>
                                      </div>
                                      <div className="flex gap-1">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            // Open widget settings
                                          }}
                                        >
                                          <Settings className="w-3 h-3" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => removeWidget(widget.id)}
                                        >
                                          <X className="w-3 h-3" />
                                        </Button>
                                      </div>
                                    </div>
                                    <Select
                                      value={widget.dataSource}
                                      onValueChange={(value) => {
                                        updateWidget(widget.id, { 
                                          dataSource: value,
                                          data: generateMockData(value)
                                        })
                                      }}
                                    >
                                      <SelectTrigger className="h-7 text-xs mt-2">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {DATA_SOURCES.map((source) => (
                                          <SelectItem key={source.value} value={source.value}>
                                            {source.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </CardHeader>
                                  <CardContent>
                                    {renderWidget(widget)}
                                  </CardContent>
                                </Card>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* Empty State */}
      {reports.length === 0 && (
        <Card className="p-12 text-center">
          <BarChart3 className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-semibold mb-2">No reports yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first custom report to visualize your analytics data
          </p>
          <Button onClick={() => setIsCreatingReport(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Your First Report
          </Button>
        </Card>
      )}
    </div>
  )
}