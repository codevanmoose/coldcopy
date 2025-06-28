'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Play,
  Pause,
  Copy,
  Edit,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Activity,
  BarChart3,
  Users,
  Mail,
  TrendingUp,
  Calendar,
  Zap,
  Settings,
  Download,
  FileText,
  Eye,
} from 'lucide-react'
import { Workflow, WorkflowExecution, WorkflowTemplate } from '@/lib/automation/workflow-engine'
import { api } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'
import { formatDistanceToNow, format } from 'date-fns'
import Link from 'next/link'

interface WorkflowDashboardProps {
  onCreateWorkflow?: () => void
  onEditWorkflow?: (workflowId: string) => void
}

export function WorkflowDashboard({ onCreateWorkflow, onEditWorkflow }: WorkflowDashboardProps) {
  const { user } = useAuth()
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [executions, setExecutions] = useState<WorkflowExecution[]>([])
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([])
  const [analytics, setAnalytics] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    if (user?.workspaceId) {
      loadData()
    }
  }, [user?.workspaceId])

  const loadData = async () => {
    if (!user?.workspaceId) return

    setIsLoading(true)
    try {
      const [workflowsRes, executionsRes, templatesRes, analyticsRes] = await Promise.all([
        api.workflows.list(user.workspaceId),
        api.workflows.executions.list(user.workspaceId),
        api.workflows.templates.list(),
        api.workflows.analytics(user.workspaceId),
      ])

      if (workflowsRes.data) setWorkflows(workflowsRes.data.workflows || [])
      if (executionsRes.data) setExecutions(executionsRes.data.executions || [])
      if (templatesRes.data) setTemplates(templatesRes.data || [])
      if (analyticsRes.data) setAnalytics(analyticsRes.data)
    } catch (error) {
      console.error('Error loading workflow data:', error)
      toast.error('Failed to load workflow data')
    } finally {
      setIsLoading(false)
    }
  }

  const filteredWorkflows = workflows.filter(workflow => {
    const matchesSearch = workflow.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         workflow.description?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || workflow.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const handleStartWorkflow = async (workflowId: string) => {
    if (!user?.workspaceId) return

    try {
      await api.workflows.execute(user.workspaceId, workflowId, {})
      toast.success('Workflow started successfully')
      loadData()
    } catch (error) {
      console.error('Error starting workflow:', error)
      toast.error('Failed to start workflow')
    }
  }

  const handlePauseWorkflow = async (workflowId: string) => {
    if (!user?.workspaceId) return

    try {
      await api.workflows.pause(user.workspaceId, workflowId)
      toast.success('Workflow paused successfully')
      loadData()
    } catch (error) {
      console.error('Error pausing workflow:', error)
      toast.error('Failed to pause workflow')
    }
  }

  const handleResumeWorkflow = async (workflowId: string) => {
    if (!user?.workspaceId) return

    try {
      await api.workflows.resume(user.workspaceId, workflowId)
      toast.success('Workflow resumed successfully')
      loadData()
    } catch (error) {
      console.error('Error resuming workflow:', error)
      toast.error('Failed to resume workflow')
    }
  }

  const handleDuplicateWorkflow = async (workflowId: string, name: string) => {
    if (!user?.workspaceId) return

    try {
      await api.workflows.duplicate(user.workspaceId, workflowId, `${name} (Copy)`)
      toast.success('Workflow duplicated successfully')
      loadData()
    } catch (error) {
      console.error('Error duplicating workflow:', error)
      toast.error('Failed to duplicate workflow')
    }
  }

  const handleDeleteWorkflow = async (workflowId: string) => {
    if (!user?.workspaceId) return

    if (!confirm('Are you sure you want to delete this workflow?')) return

    try {
      await api.workflows.delete(user.workspaceId, workflowId)
      toast.success('Workflow deleted successfully')
      loadData()
    } catch (error) {
      console.error('Error deleting workflow:', error)
      toast.error('Failed to delete workflow')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'draft': return 'bg-gray-100 text-gray-800'
      case 'paused': return 'bg-yellow-100 text-yellow-800'
      case 'archived': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getExecutionStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />
      case 'running': return <Activity className="h-4 w-4 text-blue-500 animate-pulse" />
      case 'paused': return <Pause className="h-4 w-4 text-yellow-500" />
      default: return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Workflow Automation</h1>
          <p className="text-gray-600">Create and manage automated workflows for your campaigns</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={onCreateWorkflow}>
            <Plus className="h-4 w-4 mr-2" />
            Create Workflow
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="workflows">Workflows</TabsTrigger>
          <TabsTrigger value="executions">Executions</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Workflows</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{workflows.length}</div>
                <p className="text-xs text-muted-foreground">
                  {workflows.filter(w => w.status === 'active').length} active
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Executions</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics?.totalExecutions || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {((analytics?.successRate || 0) * 100).toFixed(1)}% success rate
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg. Execution Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(analytics?.averageExecutionTime || 0).toFixed(1)}m
                </div>
                <p className="text-xs text-muted-foreground">minutes</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {((analytics?.successRate || 0) * 100).toFixed(1)}%
                </div>
                <Progress value={(analytics?.successRate || 0) * 100} className="mt-2" />
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Recent Executions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {executions.slice(0, 5).map((execution) => (
                    <div key={execution.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getExecutionStatusIcon(execution.status)}
                        <div>
                          <div className="text-sm font-medium">
                            {workflows.find(w => w.id === execution.workflowId)?.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatDistanceToNow(new Date(execution.startedAt))} ago
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline">{execution.status}</Badge>
                    </div>
                  ))}
                  {executions.length === 0 && (
                    <div className="text-center text-gray-500 py-4">
                      No executions yet
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Top Performing Workflows
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics?.topPerformingWorkflows?.slice(0, 5).map((workflow: any) => (
                    <div key={workflow.id} className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">{workflow.name}</div>
                        <div className="text-xs text-gray-500">
                          {workflow.executions} executions
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          {(workflow.successRate * 100).toFixed(1)}%
                        </div>
                        <Progress value={workflow.successRate * 100} className="w-16 h-2" />
                      </div>
                    </div>
                  )) || (
                    <div className="text-center text-gray-500 py-4">
                      No performance data yet
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Workflows Tab */}
        <TabsContent value="workflows" className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search workflows..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Workflows Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredWorkflows.map((workflow) => (
              <Card key={workflow.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{workflow.name}</CardTitle>
                      {workflow.description && (
                        <p className="text-sm text-gray-600 mt-1">{workflow.description}</p>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEditWorkflow?.(workflow.id)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicateWorkflow(workflow.id, workflow.name)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        {workflow.status === 'active' ? (
                          <DropdownMenuItem onClick={() => handlePauseWorkflow(workflow.id)}>
                            <Pause className="h-4 w-4 mr-2" />
                            Pause
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => handleResumeWorkflow(workflow.id)}>
                            <Play className="h-4 w-4 mr-2" />
                            Resume
                          </DropdownMenuItem>
                        )}
                        <Separator />
                        <DropdownMenuItem
                          onClick={() => handleDeleteWorkflow(workflow.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge className={getStatusColor(workflow.status)}>
                        {workflow.status}
                      </Badge>
                      <div className="text-sm text-gray-500">
                        v{workflow.version}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-gray-500">Actions</div>
                        <div className="font-medium">{workflow.actions.length}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">Executions</div>
                        <div className="font-medium">{workflow.analytics.totalExecutions}</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>
                        Updated {formatDistanceToNow(new Date(workflow.updatedAt))} ago
                      </span>
                      {workflow.analytics.lastExecutedAt && (
                        <span>
                          Last run {formatDistanceToNow(new Date(workflow.analytics.lastExecutedAt))} ago
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2">
                      {workflow.status === 'draft' && (
                        <Button
                          size="sm"
                          onClick={() => handleStartWorkflow(workflow.id)}
                          className="flex-1"
                        >
                          <Play className="h-4 w-4 mr-2" />
                          Start
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEditWorkflow?.(workflow.id)}
                        className="flex-1"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredWorkflows.length === 0 && (
            <Card>
              <CardContent className="text-center py-12">
                <Zap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No workflows found</h3>
                <p className="text-gray-600 mb-4">
                  {searchTerm || statusFilter !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Create your first workflow to get started'}
                </p>
                {!searchTerm && statusFilter === 'all' && (
                  <Button onClick={onCreateWorkflow}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Workflow
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Executions Tab */}
        <TabsContent value="executions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Executions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {executions.map((execution) => (
                  <div key={execution.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      {getExecutionStatusIcon(execution.status)}
                      <div>
                        <div className="font-medium">
                          {workflows.find(w => w.id === execution.workflowId)?.name}
                        </div>
                        <div className="text-sm text-gray-600">
                          Started {format(new Date(execution.startedAt), 'MMM d, yyyy HH:mm')}
                        </div>
                        {execution.completedAt && (
                          <div className="text-xs text-gray-500">
                            Duration: {Math.round((new Date(execution.completedAt).getTime() - new Date(execution.startedAt).getTime()) / 60000)} minutes
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline">{execution.status}</Badge>
                      {execution.error && (
                        <div className="text-xs text-red-600 mt-1">
                          {execution.error.message}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {executions.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    No executions yet
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template) => (
              <Card key={template.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                  <p className="text-sm text-gray-600">{template.description}</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{template.category}</Badge>
                      <Badge variant="outline">{template.difficulty}</Badge>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Setup time</span>
                      <span>{template.estimatedSetupTime} min</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Used by</span>
                      <span>{template.usageCount} teams</span>
                    </div>

                    <Button
                      className="w-full"
                      onClick={async () => {
                        if (!user?.workspaceId) return
                        try {
                          await api.workflows.templates.create(user.workspaceId, template.id)
                          toast.success('Workflow created from template')
                          loadData()
                        } catch (error) {
                          toast.error('Failed to create workflow from template')
                        }
                      }}
                    >
                      Use Template
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {templates.length === 0 && (
            <Card>
              <CardContent className="text-center py-12">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No templates available</h3>
                <p className="text-gray-600">
                  Workflow templates will be available soon
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          {analytics && (
            <>
              {/* Execution Trends */}
              <Card>
                <CardHeader>
                  <CardTitle>Execution Trends</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {analytics.executionTrends?.map((trend: any, index: number) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="text-sm">{format(new Date(trend.date), 'MMM d')}</div>
                        <div className="flex items-center gap-4">
                          <div className="text-sm">{trend.executions} executions</div>
                          <div className="text-sm text-green-600">
                            {(trend.successRate * 100).toFixed(1)}% success
                          </div>
                        </div>
                      </div>
                    )) || (
                      <div className="text-center text-gray-500 py-4">
                        No trend data available
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Common Failure Reasons */}
              {analytics.commonFailureReasons?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Common Failure Reasons</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {analytics.commonFailureReasons.map((reason: any, index: number) => (
                        <div key={index} className="flex items-center justify-between">
                          <div className="text-sm">{reason.reason}</div>
                          <div className="flex items-center gap-2">
                            <div className="text-sm text-gray-600">{reason.count} times</div>
                            <Badge variant="destructive">{reason.percentage.toFixed(1)}%</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}