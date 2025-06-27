'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Save, Loader2, AlertCircle, Zap, PlayCircle, Settings, Trash2, Edit, TestTube, CheckCircle, XCircle } from 'lucide-react';
import { WorkflowTrigger, TriggerCondition } from './types';
import { useToast } from '@/components/ui/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';

const TRIGGER_TYPES = [
  { value: 'lead_created', label: 'Lead Created', description: 'When a new lead is added to ColdCopy' },
  { value: 'email_sent', label: 'Email Sent', description: 'When an email is sent to a lead' },
  { value: 'email_opened', label: 'Email Opened', description: 'When a lead opens an email' },
  { value: 'email_clicked', label: 'Email Clicked', description: 'When a lead clicks a link in an email' },
  { value: 'email_replied', label: 'Email Replied', description: 'When a lead replies to an email' },
  { value: 'lead_enriched', label: 'Lead Enriched', description: 'When lead data is enriched' },
];

const CONDITION_OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Does Not Contain' },
  { value: 'greater_than', label: 'Greater Than' },
  { value: 'less_than', label: 'Less Than' },
];

export function WorkflowConfig() {
  const [workflows, setWorkflows] = useState<WorkflowTrigger[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowTrigger | null>(null);
  const [testingWorkflow, setTestingWorkflow] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const fetchWorkflows = async () => {
    try {
      const response = await fetch('/api/integrations/hubspot/workflows');
      if (response.ok) {
        const data = await response.json();
        setWorkflows(data);
      }
    } catch (error) {
      console.error('Error fetching workflows:', error);
      toast({
        title: 'Error',
        description: 'Failed to load workflow configurations',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateWorkflow = async (workflow: Omit<WorkflowTrigger, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      setIsSaving(true);
      const response = await fetch('/api/integrations/hubspot/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workflow),
      });

      if (response.ok) {
        const newWorkflow = await response.json();
        setWorkflows([...workflows, newWorkflow]);
        setShowCreateDialog(false);
        toast({
          title: 'Success',
          description: 'Workflow trigger created successfully',
        });
      } else {
        throw new Error('Failed to create workflow');
      }
    } catch (error) {
      console.error('Error creating workflow:', error);
      toast({
        title: 'Error',
        description: 'Failed to create workflow trigger',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateWorkflow = async (id: string, updates: Partial<WorkflowTrigger>) => {
    try {
      const response = await fetch(`/api/integrations/hubspot/workflows/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        setWorkflows(workflows.map(w => w.id === id ? { ...w, ...updates } : w));
        toast({
          title: 'Success',
          description: 'Workflow updated successfully',
        });
      } else {
        throw new Error('Failed to update workflow');
      }
    } catch (error) {
      console.error('Error updating workflow:', error);
      toast({
        title: 'Error',
        description: 'Failed to update workflow',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteWorkflow = async (id: string) => {
    if (!confirm('Are you sure you want to delete this workflow trigger?')) {
      return;
    }

    try {
      const response = await fetch(`/api/integrations/hubspot/workflows/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setWorkflows(workflows.filter(w => w.id !== id));
        toast({
          title: 'Success',
          description: 'Workflow deleted successfully',
        });
      } else {
        throw new Error('Failed to delete workflow');
      }
    } catch (error) {
      console.error('Error deleting workflow:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete workflow',
        variant: 'destructive',
      });
    }
  };

  const handleTestWorkflow = async (id: string) => {
    try {
      setTestingWorkflow(id);
      const response = await fetch(`/api/integrations/hubspot/workflows/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowId: id }),
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: 'Test Complete',
          description: result.success 
            ? 'Workflow trigger test successful' 
            : `Test failed: ${result.error}`,
          variant: result.success ? 'default' : 'destructive',
        });
      } else {
        throw new Error('Failed to test workflow');
      }
    } catch (error) {
      console.error('Error testing workflow:', error);
      toast({
        title: 'Error',
        description: 'Failed to test workflow trigger',
        variant: 'destructive',
      });
    } finally {
      setTestingWorkflow(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Workflow Triggers</CardTitle>
              <CardDescription>
                Configure triggers to sync events with HubSpot workflows
              </CardDescription>
            </div>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Trigger
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <WorkflowForm
                  workflow={editingWorkflow}
                  onSubmit={handleCreateWorkflow}
                  onCancel={() => {
                    setShowCreateDialog(false);
                    setEditingWorkflow(null);
                  }}
                  isSaving={isSaving}
                />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {workflows.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No workflow triggers configured. Create your first trigger to start syncing events with HubSpot.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              {workflows.map((workflow) => (
                <Card key={workflow.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Zap className="h-5 w-5 text-primary" />
                        <h4 className="font-medium">{workflow.name}</h4>
                        <Badge variant={workflow.enabled ? 'success' : 'secondary'}>
                          {workflow.enabled ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        {workflow.description}
                      </p>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {TRIGGER_TYPES.find(t => t.value === workflow.triggerType)?.label}
                          </Badge>
                        </div>
                        {workflow.hubspotWorkflowId && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">HubSpot ID:</span>
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {workflow.hubspotWorkflowId}
                            </code>
                          </div>
                        )}
                        {workflow.conditions && workflow.conditions.length > 0 && (
                          <Badge variant="secondary">
                            {workflow.conditions.length} condition{workflow.conditions.length > 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={workflow.enabled}
                        onCheckedChange={(checked) => 
                          handleUpdateWorkflow(workflow.id, { enabled: checked })
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleTestWorkflow(workflow.id)}
                        disabled={testingWorkflow === workflow.id}
                      >
                        {testingWorkflow === workflow.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <TestTube className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingWorkflow(workflow);
                          setShowCreateDialog(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteWorkflow(workflow.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How Workflow Triggers Work</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <PlayCircle className="h-5 w-5 text-primary" />
                </div>
                <h5 className="font-medium">1. Event Occurs</h5>
              </div>
              <p className="text-sm text-muted-foreground">
                An action happens in ColdCopy (e.g., email sent, lead created)
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Settings className="h-5 w-5 text-primary" />
                </div>
                <h5 className="font-medium">2. Conditions Check</h5>
              </div>
              <p className="text-sm text-muted-foreground">
                System checks if the event matches your configured conditions
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <h5 className="font-medium">3. Trigger Workflow</h5>
              </div>
              <p className="text-sm text-muted-foreground">
                If conditions match, the HubSpot workflow is triggered
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface WorkflowFormProps {
  workflow?: WorkflowTrigger | null;
  onSubmit: (workflow: Omit<WorkflowTrigger, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
  isSaving: boolean;
}

function WorkflowForm({ workflow, onSubmit, onCancel, isSaving }: WorkflowFormProps) {
  const [name, setName] = useState(workflow?.name || '');
  const [description, setDescription] = useState(workflow?.description || '');
  const [triggerType, setTriggerType] = useState(workflow?.triggerType || 'lead_created');
  const [hubspotWorkflowId, setHubspotWorkflowId] = useState(workflow?.hubspotWorkflowId || '');
  const [conditions, setConditions] = useState<TriggerCondition[]>(workflow?.conditions || []);

  const handleSubmit = () => {
    onSubmit({
      name,
      description,
      triggerType: triggerType as any,
      hubspotWorkflowId: hubspotWorkflowId || undefined,
      conditions: conditions.length > 0 ? conditions : undefined,
      enabled: workflow?.enabled ?? true,
    });
  };

  const addCondition = () => {
    setConditions([...conditions, { field: '', operator: 'equals', value: '' }]);
  };

  const updateCondition = (index: number, updates: Partial<TriggerCondition>) => {
    setConditions(conditions.map((c, i) => i === index ? { ...c, ...updates } : c));
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{workflow ? 'Edit' : 'Create'} Workflow Trigger</DialogTitle>
        <DialogDescription>
          Configure when to trigger HubSpot workflows based on ColdCopy events
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="name">Trigger Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., New Lead to HubSpot"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what this trigger does"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="triggerType">Trigger Event</Label>
          <Select value={triggerType} onValueChange={setTriggerType}>
            <SelectTrigger id="triggerType">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRIGGER_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  <div>
                    <p className="font-medium">{type.label}</p>
                    <p className="text-xs text-muted-foreground">{type.description}</p>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="hubspotWorkflowId">HubSpot Workflow ID (Optional)</Label>
          <Input
            id="hubspotWorkflowId"
            value={hubspotWorkflowId}
            onChange={(e) => setHubspotWorkflowId(e.target.value)}
            placeholder="e.g., 123456789"
          />
          <p className="text-xs text-muted-foreground">
            Enter the ID of the HubSpot workflow to trigger
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Conditions (Optional)</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={addCondition}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Condition
            </Button>
          </div>
          {conditions.length > 0 && (
            <ScrollArea className="h-48 border rounded-lg p-4">
              <div className="space-y-3">
                {conditions.map((condition, index) => (
                  <div key={index} className="flex items-end gap-2">
                    <div className="flex-1">
                      <Label className="text-xs">Field</Label>
                      <Input
                        value={condition.field}
                        onChange={(e) => updateCondition(index, { field: e.target.value })}
                        placeholder="e.g., lead.status"
                      />
                    </div>
                    <div className="w-32">
                      <Label className="text-xs">Operator</Label>
                      <Select
                        value={condition.operator}
                        onValueChange={(value: any) => updateCondition(index, { operator: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CONDITION_OPERATORS.map((op) => (
                            <SelectItem key={op.value} value={op.value}>
                              {op.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs">Value</Label>
                      <Input
                        value={condition.value.toString()}
                        onChange={(e) => updateCondition(index, { value: e.target.value })}
                        placeholder="e.g., qualified"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeCondition(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={!name || isSaving}>
          {isSaving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : null}
          {workflow ? 'Update' : 'Create'} Trigger
        </Button>
      </DialogFooter>
    </>
  );
}