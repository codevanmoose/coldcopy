'use client'

import React, { useState, useRef, useCallback, useMemo } from 'react'
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  NodeTypes,
  MarkerType,
  ReactFlowProvider,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Play,
  Pause,
  Save,
  Undo,
  Redo,
  ZoomIn,
  ZoomOut,
  Download,
  Upload,
  Settings,
  Mail,
  MessageSquare,
  Clock,
  GitBranch,
  Tag,
  Webhook,
  Plus,
  Trash2,
  Copy,
  Edit3,
  ChevronRight,
  AlertCircle,
  CheckCircle,
} from 'lucide-react'
import { WorkflowAction, WorkflowTrigger, WorkflowCondition, Workflow } from '@/lib/automation/workflow-engine'
import { api } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'

// Custom node types
const TriggerNode = ({ data, selected }: { data: any, selected: boolean }) => (
  <Card className={`min-w-[200px] border-2 ${selected ? 'border-blue-500' : 'border-green-500'} bg-green-50`}>
    <CardHeader className="pb-2">
      <CardTitle className="text-sm flex items-center gap-2">
        <Play className="h-4 w-4" />
        Trigger
      </CardTitle>
    </CardHeader>
    <CardContent className="pt-0">
      <div className="text-xs font-medium">{data.label}</div>
      <Badge variant="secondary" className="mt-1 text-xs">
        {data.triggerType}
      </Badge>
    </CardContent>
  </Card>
)

const ActionNode = ({ data, selected }: { data: any, selected: boolean }) => {
  const getIcon = (type: string) => {
    switch (type) {
      case 'send_email': return <Mail className="h-4 w-4" />
      case 'send_linkedin_message': return <MessageSquare className="h-4 w-4" />
      case 'wait': return <Clock className="h-4 w-4" />
      case 'add_tag': return <Tag className="h-4 w-4" />
      case 'webhook_call': return <Webhook className="h-4 w-4" />
      default: return <Settings className="h-4 w-4" />
    }
  }

  const getColor = (type: string) => {
    switch (type) {
      case 'send_email': return 'border-blue-500 bg-blue-50'
      case 'send_linkedin_message': return 'border-purple-500 bg-purple-50'
      case 'wait': return 'border-yellow-500 bg-yellow-50'
      case 'add_tag': return 'border-orange-500 bg-orange-50'
      case 'webhook_call': return 'border-red-500 bg-red-50'
      default: return 'border-gray-500 bg-gray-50'
    }
  }

  return (
    <Card className={`min-w-[200px] border-2 ${selected ? 'border-blue-500' : getColor(data.actionType)}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          {getIcon(data.actionType)}
          Action
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-xs font-medium">{data.label}</div>
        <Badge variant="secondary" className="mt-1 text-xs">
          {data.actionType.replace('_', ' ')}
        </Badge>
      </CardContent>
    </Card>
  )
}

const ConditionNode = ({ data, selected }: { data: any, selected: boolean }) => (
  <Card className={`min-w-[200px] border-2 ${selected ? 'border-blue-500' : 'border-amber-500'} bg-amber-50`}>
    <CardHeader className="pb-2">
      <CardTitle className="text-sm flex items-center gap-2">
        <GitBranch className="h-4 w-4" />
        Condition
      </CardTitle>
    </CardHeader>
    <CardContent className="pt-0">
      <div className="text-xs font-medium">{data.label}</div>
      <Badge variant="secondary" className="mt-1 text-xs">
        {data.conditionType}
      </Badge>
    </CardContent>
  </Card>
)

const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  condition: ConditionNode,
}

interface VisualWorkflowBuilderProps {
  workflow?: Workflow
  onSave?: (workflow: Partial<Workflow>) => void
  onTest?: (workflow: Partial<Workflow>) => void
  readOnly?: boolean
}

export function VisualWorkflowBuilder({
  workflow,
  onSave,
  onTest,
  readOnly = false,
}: VisualWorkflowBuilderProps) {
  const { user } = useAuth()
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [workflowName, setWorkflowName] = useState(workflow?.name || '')
  const [workflowDescription, setWorkflowDescription] = useState(workflow?.description || '')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isTestDialogOpen, setIsTestDialogOpen] = useState(false)
  const [testData, setTestData] = useState<Record<string, any>>({})
  const [testResults, setTestResults] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)

  const reactFlowInstance = useRef<any>(null)

  // Action templates for the sidebar
  const actionTemplates = [
    {
      type: 'send_email',
      label: 'Send Email',
      icon: Mail,
      description: 'Send a personalized email',
      config: {
        templateId: '',
        subject: '',
        fromName: '',
        fromEmail: '',
      },
    },
    {
      type: 'send_linkedin_message',
      label: 'LinkedIn Message',
      icon: MessageSquare,
      description: 'Send a LinkedIn message',
      config: {
        messageContent: '',
        platform: 'linkedin',
      },
    },
    {
      type: 'wait',
      label: 'Wait/Delay',
      icon: Clock,
      description: 'Wait for a specified time',
      config: {
        waitDuration: 60, // minutes
      },
    },
    {
      type: 'add_tag',
      label: 'Add Tag',
      icon: Tag,
      description: 'Add tags to the lead',
      config: {
        tags: [],
      },
    },
    {
      type: 'webhook_call',
      label: 'Webhook',
      icon: Webhook,
      description: 'Call an external webhook',
      config: {
        webhookUrl: '',
        method: 'POST',
      },
    },
  ]

  // Trigger templates
  const triggerTemplates = [
    {
      type: 'email_opened',
      label: 'Email Opened',
      description: 'When someone opens an email',
    },
    {
      type: 'email_clicked',
      label: 'Email Clicked',
      description: 'When someone clicks a link',
    },
    {
      type: 'form_submitted',
      label: 'Form Submitted',
      description: 'When a form is submitted',
    },
    {
      type: 'time_based',
      label: 'Time Based',
      description: 'At a specific time',
    },
  ]

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({
      ...params,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { strokeWidth: 2 },
    }, eds)),
    [setEdges]
  )

  const addTriggerNode = useCallback((triggerType: string) => {
    const template = triggerTemplates.find(t => t.type === triggerType)
    const newNode: Node = {
      id: `trigger-${Date.now()}`,
      type: 'trigger',
      position: { x: 100, y: 100 },
      data: {
        label: template?.label || triggerType,
        triggerType,
        ...template,
      },
    }
    setNodes((nds) => [...nds, newNode])
  }, [setNodes])

  const addActionNode = useCallback((actionType: string) => {
    const template = actionTemplates.find(t => t.type === actionType)
    const newNode: Node = {
      id: `action-${Date.now()}`,
      type: 'action',
      position: { x: 300, y: 200 + nodes.length * 100 },
      data: {
        label: template?.label || actionType,
        actionType,
        config: template?.config || {},
        ...template,
      },
    }
    setNodes((nds) => [...nds, newNode])
  }, [setNodes, nodes.length])

  const addConditionNode = useCallback(() => {
    const newNode: Node = {
      id: `condition-${Date.now()}`,
      type: 'condition',
      position: { x: 300, y: 200 + nodes.length * 100 },
      data: {
        label: 'If/Then/Else',
        conditionType: 'if_then_else',
        conditions: [],
        branches: [],
      },
    }
    setNodes((nds) => [...nds, newNode])
  }, [setNodes, nodes.length])

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node)
  }, [])

  const deleteSelectedNode = useCallback(() => {
    if (selectedNode && !readOnly) {
      setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id))
      setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id))
      setSelectedNode(null)
    }
  }, [selectedNode, setNodes, setEdges, readOnly])

  const duplicateSelectedNode = useCallback(() => {
    if (selectedNode && !readOnly) {
      const newNode: Node = {
        ...selectedNode,
        id: `${selectedNode.type}-${Date.now()}`,
        position: {
          x: selectedNode.position.x + 50,
          y: selectedNode.position.y + 50,
        },
      }
      setNodes((nds) => [...nds, newNode])
    }
  }, [selectedNode, setNodes, readOnly])

  const updateNodeData = useCallback((nodeId: string, newData: any) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...newData } } : n
      )
    )
  }, [setNodes])

  const saveWorkflow = useCallback(async () => {
    if (!user?.workspaceId || readOnly) return

    setIsLoading(true)
    try {
      const workflowData: Partial<Workflow> = {
        name: workflowName,
        description: workflowDescription,
        status: 'draft',
        version: workflow?.version || 1,
        trigger: nodes.find(n => n.type === 'trigger')?.data as WorkflowTrigger,
        actions: nodes
          .filter(n => n.type === 'action')
          .map(n => ({
            id: n.id,
            type: n.data.actionType,
            config: n.data.config || {},
            position: n.position,
            nextActionId: edges.find(e => e.source === n.id)?.target,
          })) as WorkflowAction[],
        conditions: nodes
          .filter(n => n.type === 'condition')
          .map(n => ({
            id: n.id,
            type: n.data.conditionType,
            conditions: n.data.conditions || [],
            branches: n.data.branches || [],
          })) as WorkflowCondition[],
        settings: {
          maxExecutionsPerHour: 100,
          maxExecutionsPerDay: 1000,
          timezone: 'UTC',
          enableLogging: true,
          enableRetries: true,
          maxRetries: 3,
          retryDelay: 5,
        },
        tags: [],
      }

      if (workflow?.id) {
        await api.workflows.update(user.workspaceId, workflow.id, workflowData)
      } else {
        await api.workflows.create(user.workspaceId, workflowData)
      }

      toast.success('Workflow saved successfully')
      onSave?.(workflowData)
    } catch (error) {
      console.error('Error saving workflow:', error)
      toast.error('Failed to save workflow')
    } finally {
      setIsLoading(false)
    }
  }, [
    user?.workspaceId,
    readOnly,
    workflowName,
    workflowDescription,
    workflow?.version,
    workflow?.id,
    nodes,
    edges,
    onSave,
  ])

  const testWorkflow = useCallback(async () => {
    if (!user?.workspaceId || !workflowName) return

    setIsLoading(true)
    try {
      const workflowData: Partial<Workflow> = {
        name: workflowName,
        description: workflowDescription,
        trigger: nodes.find(n => n.type === 'trigger')?.data as WorkflowTrigger,
        actions: nodes
          .filter(n => n.type === 'action')
          .map(n => ({
            id: n.id,
            type: n.data.actionType,
            config: n.data.config || {},
            position: n.position,
            nextActionId: edges.find(e => e.source === n.id)?.target,
          })) as WorkflowAction[],
        conditions: nodes
          .filter(n => n.type === 'condition')
          .map(n => ({
            id: n.id,
            type: n.data.conditionType,
            conditions: n.data.conditions || [],
            branches: n.data.branches || [],
          })) as WorkflowCondition[],
      }

      const result = await api.workflows.test(user.workspaceId, workflowData as Workflow, testData)
      setTestResults(result.data)
      toast.success('Workflow test completed')
    } catch (error) {
      console.error('Error testing workflow:', error)
      toast.error('Failed to test workflow')
    } finally {
      setIsLoading(false)
    }
  }, [user?.workspaceId, workflowName, workflowDescription, nodes, edges, testData])

  const exportWorkflow = useCallback(() => {
    const workflowData = {
      name: workflowName,
      description: workflowDescription,
      nodes,
      edges,
    }
    
    const blob = new Blob([JSON.stringify(workflowData, null, 2)], {
      type: 'application/json',
    })
    
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${workflowName || 'workflow'}.json`
    link.click()
    
    URL.revokeObjectURL(url)
  }, [workflowName, workflowDescription, nodes, edges])

  const importWorkflow = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const workflowData = JSON.parse(e.target?.result as string)
        setWorkflowName(workflowData.name || '')
        setWorkflowDescription(workflowData.description || '')
        setNodes(workflowData.nodes || [])
        setEdges(workflowData.edges || [])
        toast.success('Workflow imported successfully')
      } catch (error) {
        toast.error('Failed to import workflow')
      }
    }
    reader.readAsText(file)
  }, [setNodes, setEdges])

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="border-b bg-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <Input
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              placeholder="Workflow name"
              className="font-medium"
              disabled={readOnly}
            />
          </div>
          <Badge variant={workflow?.status === 'active' ? 'default' : 'secondary'}>
            {workflow?.status || 'draft'}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {/* Test Workflow */}
          <Dialog open={isTestDialogOpen} onOpenChange={setIsTestDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={readOnly}>
                <Play className="h-4 w-4 mr-2" />
                Test
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Test Workflow</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Test Data (JSON)</Label>
                  <Textarea
                    value={JSON.stringify(testData, null, 2)}
                    onChange={(e) => {
                      try {
                        setTestData(JSON.parse(e.target.value))
                      } catch {
                        // Invalid JSON, ignore
                      }
                    }}
                    placeholder="{ &quot;leadId&quot;: &quot;123&quot;, &quot;email&quot;: &quot;test@example.com&quot; }"
                    className="h-32"
                  />
                </div>
                {testResults && (
                  <div>
                    <Label>Test Results</Label>
                    <div className="mt-2 p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        {testResults.isValid ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        )}
                        <span className="font-medium">
                          {testResults.isValid ? 'Valid' : 'Invalid'}
                        </span>
                      </div>
                      {testResults.errors?.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-red-600">Errors:</div>
                          {testResults.errors.map((error: any, index: number) => (
                            <div key={index} className="text-sm text-red-600">
                              • {error.message}
                            </div>
                          ))}
                        </div>
                      )}
                      {testResults.warnings?.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-yellow-600">Warnings:</div>
                          {testResults.warnings.map((warning: any, index: number) => (
                            <div key={index} className="text-sm text-yellow-600">
                              • {warning.message}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="text-sm text-gray-600 mt-2">
                        Estimated execution time: {testResults.estimatedExecutionTime || 0} minutes
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button
                    onClick={testWorkflow}
                    disabled={isLoading}
                    className="w-full"
                  >
                    {isLoading ? 'Testing...' : 'Run Test'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Export/Import */}
          <Button variant="outline" size="sm" onClick={exportWorkflow}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <div className="relative">
            <input
              type="file"
              accept=".json"
              onChange={importWorkflow}
              className="absolute inset-0 opacity-0 cursor-pointer"
              disabled={readOnly}
            />
            <Button variant="outline" size="sm" disabled={readOnly}>
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
          </div>

          {/* Save */}
          <Button onClick={saveWorkflow} disabled={isLoading || readOnly}>
            <Save className="h-4 w-4 mr-2" />
            {isLoading ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Sidebar */}
        {isSidebarOpen && (
          <div className="w-80 border-r bg-gray-50 flex flex-col">
            <div className="p-4 border-b">
              <h3 className="font-medium">Workflow Elements</h3>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-6">
                {/* Triggers */}
                <div>
                  <h4 className="text-sm font-medium mb-2 text-gray-600">TRIGGERS</h4>
                  <div className="space-y-2">
                    {triggerTemplates.map((template) => (
                      <Card
                        key={template.type}
                        className="p-3 cursor-pointer hover:bg-green-50 hover:border-green-200 transition-colors"
                        onClick={() => !readOnly && addTriggerNode(template.type)}
                      >
                        <div className="flex items-center gap-2">
                          <Play className="h-4 w-4 text-green-600" />
                          <div>
                            <div className="text-sm font-medium">{template.label}</div>
                            <div className="text-xs text-gray-500">{template.description}</div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div>
                  <h4 className="text-sm font-medium mb-2 text-gray-600">ACTIONS</h4>
                  <div className="space-y-2">
                    {actionTemplates.map((template) => {
                      const Icon = template.icon
                      return (
                        <Card
                          key={template.type}
                          className="p-3 cursor-pointer hover:bg-blue-50 hover:border-blue-200 transition-colors"
                          onClick={() => !readOnly && addActionNode(template.type)}
                        >
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-blue-600" />
                            <div>
                              <div className="text-sm font-medium">{template.label}</div>
                              <div className="text-xs text-gray-500">{template.description}</div>
                            </div>
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                </div>

                {/* Conditions */}
                <div>
                  <h4 className="text-sm font-medium mb-2 text-gray-600">CONDITIONS</h4>
                  <Card
                    className="p-3 cursor-pointer hover:bg-amber-50 hover:border-amber-200 transition-colors"
                    onClick={() => !readOnly && addConditionNode()}
                  >
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-4 w-4 text-amber-600" />
                      <div>
                        <div className="text-sm font-medium">If/Then/Else</div>
                        <div className="text-xs text-gray-500">Create conditional branches</div>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Main Canvas */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            className="bg-gray-50"
          >
            <Background />
            <Controls />
          </ReactFlow>

          {/* Node Actions */}
          {selectedNode && !readOnly && (
            <div className="absolute top-4 right-4 flex gap-2">
              <Button size="sm" variant="outline" onClick={duplicateSelectedNode}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={deleteSelectedNode}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Toggle Sidebar */}
          <Button
            variant="outline"
            size="sm"
            className="absolute bottom-4 left-4"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            <ChevronRight className={`h-4 w-4 transition-transform ${isSidebarOpen ? 'rotate-180' : ''}`} />
          </Button>
        </div>

        {/* Node Properties Panel */}
        {selectedNode && (
          <Sheet open={!!selectedNode} onOpenChange={() => setSelectedNode(null)}>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>{selectedNode.data.label} Properties</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                {selectedNode.type === 'action' && (
                  <ActionPropertiesForm
                    action={selectedNode.data}
                    onChange={(data) => updateNodeData(selectedNode.id, data)}
                    readOnly={readOnly}
                  />
                )}
                {selectedNode.type === 'trigger' && (
                  <TriggerPropertiesForm
                    trigger={selectedNode.data}
                    onChange={(data) => updateNodeData(selectedNode.id, data)}
                    readOnly={readOnly}
                  />
                )}
                {selectedNode.type === 'condition' && (
                  <ConditionPropertiesForm
                    condition={selectedNode.data}
                    onChange={(data) => updateNodeData(selectedNode.id, data)}
                    readOnly={readOnly}
                  />
                )}
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>
    </div>
  )
}

// Action properties form component
function ActionPropertiesForm({
  action,
  onChange,
  readOnly,
}: {
  action: any
  onChange: (data: any) => void
  readOnly: boolean
}) {
  const updateConfig = (key: string, value: any) => {
    onChange({
      config: {
        ...action.config,
        [key]: value,
      },
    })
  }

  switch (action.actionType) {
    case 'send_email':
      return (
        <div className="space-y-4">
          <div>
            <Label>Subject</Label>
            <Input
              value={action.config.subject || ''}
              onChange={(e) => updateConfig('subject', e.target.value)}
              disabled={readOnly}
            />
          </div>
          <div>
            <Label>From Name</Label>
            <Input
              value={action.config.fromName || ''}
              onChange={(e) => updateConfig('fromName', e.target.value)}
              disabled={readOnly}
            />
          </div>
          <div>
            <Label>Email Content</Label>
            <Textarea
              value={action.config.emailContent || ''}
              onChange={(e) => updateConfig('emailContent', e.target.value)}
              className="h-32"
              disabled={readOnly}
            />
          </div>
        </div>
      )

    case 'wait':
      return (
        <div className="space-y-4">
          <div>
            <Label>Wait Duration (minutes)</Label>
            <Input
              type="number"
              value={action.config.waitDuration || 60}
              onChange={(e) => updateConfig('waitDuration', parseInt(e.target.value))}
              disabled={readOnly}
            />
          </div>
        </div>
      )

    case 'add_tag':
      return (
        <div className="space-y-4">
          <div>
            <Label>Tags (comma-separated)</Label>
            <Input
              value={action.config.tags?.join(', ') || ''}
              onChange={(e) => updateConfig('tags', e.target.value.split(',').map((t: string) => t.trim()))}
              disabled={readOnly}
            />
          </div>
        </div>
      )

    case 'webhook_call':
      return (
        <div className="space-y-4">
          <div>
            <Label>Webhook URL</Label>
            <Input
              value={action.config.webhookUrl || ''}
              onChange={(e) => updateConfig('webhookUrl', e.target.value)}
              disabled={readOnly}
            />
          </div>
          <div>
            <Label>HTTP Method</Label>
            <Select
              value={action.config.method || 'POST'}
              onValueChange={(value) => updateConfig('method', value)}
              disabled={readOnly}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GET">GET</SelectItem>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="PUT">PUT</SelectItem>
                <SelectItem value="PATCH">PATCH</SelectItem>
                <SelectItem value="DELETE">DELETE</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )

    default:
      return (
        <div className="text-sm text-gray-500">
          No configuration options available for this action type.
        </div>
      )
  }
}

// Trigger properties form component
function TriggerPropertiesForm({
  trigger,
  onChange,
  readOnly,
}: {
  trigger: any
  onChange: (data: any) => void
  readOnly: boolean
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Trigger Type</Label>
        <Select
          value={trigger.type}
          onValueChange={(value) => onChange({ type: value })}
          disabled={readOnly}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="email_opened">Email Opened</SelectItem>
            <SelectItem value="email_clicked">Email Clicked</SelectItem>
            <SelectItem value="form_submitted">Form Submitted</SelectItem>
            <SelectItem value="time_based">Time Based</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {trigger.type === 'time_based' && (
        <div>
          <Label>Time Delay (minutes)</Label>
          <Input
            type="number"
            value={trigger.conditions?.timeDelay || 0}
            onChange={(e) => onChange({
              conditions: {
                ...trigger.conditions,
                timeDelay: parseInt(e.target.value),
              },
            })}
            disabled={readOnly}
          />
        </div>
      )}
    </div>
  )
}

// Condition properties form component
function ConditionPropertiesForm({
  condition,
  onChange,
  readOnly,
}: {
  condition: any
  onChange: (data: any) => void
  readOnly: boolean
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Condition Type</Label>
        <Select
          value={condition.type}
          onValueChange={(value) => onChange({ type: value })}
          disabled={readOnly}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="if_then_else">If/Then/Else</SelectItem>
            <SelectItem value="switch">Switch</SelectItem>
            <SelectItem value="filter">Filter</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="text-sm text-gray-500">
        Advanced condition configuration will be implemented based on the selected type.
      </div>
    </div>
  )
}

// Main wrapper component with ReactFlowProvider
export function VisualWorkflowBuilderWrapper(props: VisualWorkflowBuilderProps) {
  return (
    <ReactFlowProvider>
      <VisualWorkflowBuilder {...props} />
    </ReactFlowProvider>
  )
}