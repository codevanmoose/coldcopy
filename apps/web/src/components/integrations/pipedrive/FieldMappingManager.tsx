'use client';

import { useState, useEffect, useCallback } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragOverlay, DragStartEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus, 
  Save, 
  Loader2, 
  AlertCircle, 
  Search, 
  Filter, 
  RefreshCw,
  Download,
  Upload,
  Wand2,
  Copy,
  Eye,
  Settings2,
  Check,
  X
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { FieldMappingItem } from './FieldMappingItem';
import { TransformFunctionBuilder } from './TransformFunctionBuilder';
import { FieldPreview } from './FieldPreview';
import { MappingTemplates } from './MappingTemplates';
import { CustomFieldCreator } from './CustomFieldCreator';
import { FieldCompatibilityValidator } from './FieldCompatibilityValidator';
import { 
  PipedriveFieldMapping, 
  ColdCopyField, 
  PipedriveField,
  MappingTemplate,
  MappingImportExport,
  DragDropState,
  BUILT_IN_TRANSFORMS
} from './types';
import { DraggableField } from './DraggableField';
import { DroppableArea } from './DroppableArea';

// Predefined ColdCopy fields with enhanced categories
const COLDCOPY_FIELDS: ColdCopyField[] = [
  // Lead fields
  { name: 'email', label: 'Email', type: 'email', required: true, category: 'lead', description: 'Primary email address' },
  { name: 'firstName', label: 'First Name', type: 'string', category: 'lead' },
  { name: 'lastName', label: 'Last Name', type: 'string', category: 'lead' },
  { name: 'fullName', label: 'Full Name', type: 'string', category: 'lead' },
  { name: 'company', label: 'Company', type: 'string', category: 'lead' },
  { name: 'jobTitle', label: 'Job Title', type: 'string', category: 'lead' },
  { name: 'phone', label: 'Phone', type: 'phone', category: 'lead' },
  { name: 'mobilePhone', label: 'Mobile Phone', type: 'phone', category: 'lead' },
  { name: 'website', label: 'Website', type: 'url', category: 'lead' },
  { name: 'linkedinUrl', label: 'LinkedIn URL', type: 'url', category: 'lead' },
  { name: 'twitterHandle', label: 'Twitter Handle', type: 'string', category: 'lead' },
  { name: 'industry', label: 'Industry', type: 'string', category: 'lead' },
  { name: 'companySize', label: 'Company Size', type: 'number', category: 'lead' },
  { name: 'annualRevenue', label: 'Annual Revenue', type: 'number', category: 'lead' },
  { name: 'location', label: 'Location', type: 'string', category: 'lead' },
  { name: 'country', label: 'Country', type: 'string', category: 'lead' },
  { name: 'state', label: 'State/Province', type: 'string', category: 'lead' },
  { name: 'city', label: 'City', type: 'string', category: 'lead' },
  { name: 'timezone', label: 'Timezone', type: 'string', category: 'lead' },
  { name: 'leadSource', label: 'Lead Source', type: 'select', category: 'lead' },
  { name: 'leadStatus', label: 'Lead Status', type: 'select', category: 'lead' },
  { name: 'tags', label: 'Tags', type: 'multiselect', category: 'lead' },
  
  // Campaign fields
  { name: 'campaignName', label: 'Campaign Name', type: 'string', category: 'campaign' },
  { name: 'campaignStatus', label: 'Campaign Status', type: 'select', category: 'campaign' },
  { name: 'sequenceStep', label: 'Sequence Step', type: 'number', category: 'campaign' },
  { name: 'campaignTags', label: 'Campaign Tags', type: 'multiselect', category: 'campaign' },
  { name: 'abTestVariant', label: 'A/B Test Variant', type: 'string', category: 'campaign' },
  
  // Engagement fields
  { name: 'emailsSent', label: 'Emails Sent', type: 'number', category: 'engagement' },
  { name: 'emailsOpened', label: 'Emails Opened', type: 'number', category: 'engagement' },
  { name: 'emailsClicked', label: 'Emails Clicked', type: 'number', category: 'engagement' },
  { name: 'emailsReplied', label: 'Emails Replied', type: 'number', category: 'engagement' },
  { name: 'emailsBounced', label: 'Emails Bounced', type: 'number', category: 'engagement' },
  { name: 'lastEngagementDate', label: 'Last Engagement Date', type: 'date', category: 'engagement' },
  { name: 'firstEngagementDate', label: 'First Engagement Date', type: 'date', category: 'engagement' },
  { name: 'engagementScore', label: 'Engagement Score', type: 'number', category: 'engagement' },
  { name: 'openRate', label: 'Open Rate', type: 'number', category: 'engagement' },
  { name: 'clickRate', label: 'Click Rate', type: 'number', category: 'engagement' },
  { name: 'replyRate', label: 'Reply Rate', type: 'number', category: 'engagement' },
  
  // Enrichment fields
  { name: 'enrichmentData', label: 'Enrichment Data', type: 'json', category: 'enrichment' },
  { name: 'socialProfiles', label: 'Social Profiles', type: 'json', category: 'enrichment' },
  { name: 'technographics', label: 'Technographics', type: 'array', category: 'enrichment' },
  { name: 'companyTech', label: 'Company Technologies', type: 'multiselect', category: 'enrichment' },
  { name: 'fundingInfo', label: 'Funding Information', type: 'json', category: 'enrichment' },
];

export function FieldMappingManager() {
  const [mappings, setMappings] = useState<PipedriveFieldMapping[]>([]);
  const [pipedriveFields, setPipedriveFields] = useState<PipedriveField[]>([]);
  const [customFields, setCustomFields] = useState<ColdCopyField[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('mappings');
  const [showTransformBuilder, setShowTransformBuilder] = useState(false);
  const [selectedMapping, setSelectedMapping] = useState<PipedriveFieldMapping | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [dragState, setDragState] = useState<DragDropState>({
    isDragging: false,
    draggedField: null,
    draggedFrom: null,
    dropTarget: null
  });
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchMappings();
    fetchPipedriveFields();
    loadCustomFields();
  }, []);

  const fetchMappings = async () => {
    try {
      const response = await fetch('/api/integrations/pipedrive/field-mappings');
      if (response.ok) {
        const data = await response.json();
        setMappings(data);
      }
    } catch (error) {
      console.error('Error fetching field mappings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load field mappings',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPipedriveFields = async () => {
    try {
      const response = await fetch('/api/integrations/pipedrive/fields');
      if (response.ok) {
        const data = await response.json();
        setPipedriveFields(data);
      }
    } catch (error) {
      console.error('Error fetching Pipedrive fields:', error);
    }
  };

  const loadCustomFields = () => {
    // Load custom fields from localStorage or API
    const saved = localStorage.getItem('coldcopy_custom_fields');
    if (saved) {
      setCustomFields(JSON.parse(saved));
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const field = active.data.current?.field;
    const from = active.data.current?.from;
    
    setDragState({
      isDragging: true,
      draggedField: field,
      draggedFrom: from,
      dropTarget: null
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const activeField = active.data.current?.field;
      const overField = over.data.current?.field;
      const dropTarget = over.data.current?.dropTarget;
      
      if (activeField && dropTarget) {
        // Create new mapping from drag and drop
        if (dragState.draggedFrom === 'coldcopy' && dropTarget === 'pipedrive' && overField) {
          createMappingFromDrop(activeField as ColdCopyField, overField as PipedriveField);
        } else if (dragState.draggedFrom === 'pipedrive' && dropTarget === 'coldcopy' && overField) {
          createMappingFromDrop(overField as ColdCopyField, activeField as PipedriveField);
        }
      } else if (active.data.current?.sortable && over.data.current?.sortable) {
        // Reorder existing mappings
        setMappings((items) => {
          const oldIndex = items.findIndex((item) => item.id === active.id);
          const newIndex = items.findIndex((item) => item.id === over.id);
          return arrayMove(items, oldIndex, newIndex);
        });
      }
    }
    
    setDragState({
      isDragging: false,
      draggedField: null,
      draggedFrom: null,
      dropTarget: null
    });
  };

  const createMappingFromDrop = (coldcopyField: ColdCopyField, pipedriveField: PipedriveField) => {
    const newMapping: PipedriveFieldMapping = {
      id: Date.now().toString(),
      coldcopyField,
      pipedriveField,
      direction: 'bidirectional',
      isActive: true,
    };
    
    setMappings([...mappings, newMapping]);
    toast({
      title: 'Mapping created',
      description: `${coldcopyField.label} ↔ ${pipedriveField.name}`,
    });
  };

  const handleSaveMappings = async () => {
    try {
      setIsSaving(true);
      const response = await fetch('/api/integrations/pipedrive/field-mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings }),
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Field mappings saved successfully',
        });
      } else {
        throw new Error('Failed to save mappings');
      }
    } catch (error) {
      console.error('Error saving field mappings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save field mappings',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportMappings = () => {
    const exportData: MappingImportExport = {
      version: '1.0',
      exportDate: new Date(),
      mappings,
      transformFunctions: BUILT_IN_TRANSFORMS,
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pipedrive-mappings-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportMappings = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importData: MappingImportExport = JSON.parse(e.target?.result as string);
        setMappings(importData.mappings);
        toast({
          title: 'Success',
          description: `Imported ${importData.mappings.length} mappings`,
        });
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Invalid import file',
          variant: 'destructive',
        });
      }
    };
    reader.readAsText(file);
  };

  const handleApplyTemplate = (template: MappingTemplate) => {
    const newMappings = template.mappings.map((m, index) => ({
      ...m,
      id: `${Date.now()}-${index}`,
      isActive: true,
    }));
    
    setMappings([...mappings, ...newMappings]);
    setShowTemplates(false);
    toast({
      title: 'Template applied',
      description: `Added ${newMappings.length} mappings from ${template.name}`,
    });
  };

  const allFields = [...COLDCOPY_FIELDS, ...customFields];
  
  const filteredColdCopyFields = allFields.filter(field => {
    const matchesSearch = field.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         field.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || field.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const filteredPipedriveFields = pipedriveFields.filter(field =>
    field.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    field.key.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Pipedrive Field Mapping Configuration</CardTitle>
                <CardDescription>
                  Configure field mappings with drag-and-drop, transformations, and validation
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTemplates(true)}
                >
                  <Wand2 className="h-4 w-4 mr-2" />
                  Templates
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportMappings}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Label htmlFor="import-mappings" className="cursor-pointer">
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                  >
                    <span>
                      <Upload className="h-4 w-4 mr-2" />
                      Import
                    </span>
                  </Button>
                  <Input
                    id="import-mappings"
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleImportMappings}
                  />
                </Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchMappings()}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveMappings}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Mappings
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="mappings">
                  Active Mappings ({mappings.filter(m => m.isActive).length})
                </TabsTrigger>
                <TabsTrigger value="fields">Field Explorer</TabsTrigger>
                <TabsTrigger value="builder">Transform Builder</TabsTrigger>
                <TabsTrigger value="custom">Custom Fields</TabsTrigger>
              </TabsList>

              <TabsContent value="mappings" className="space-y-4">
                {mappings.length === 0 ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      No field mappings configured. Start by dragging fields from the Field Explorer or use a template.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex gap-2">
                        <Badge variant="secondary">
                          Active: {mappings.filter(m => m.isActive).length}
                        </Badge>
                        <Badge variant="outline">
                          With Transforms: {mappings.filter(m => m.transformFunction).length}
                        </Badge>
                        <Badge variant="outline">
                          Bidirectional: {mappings.filter(m => m.direction === 'bidirectional').length}
                        </Badge>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowPreview(true)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Preview Data Flow
                      </Button>
                    </div>

                    <SortableContext
                      items={mappings.map(m => m.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {mappings.map((mapping) => (
                          <FieldMappingItem
                            key={mapping.id}
                            mapping={mapping}
                            onRemove={(id) => setMappings(mappings.filter(m => m.id !== id))}
                            onUpdate={(id, updates) => 
                              setMappings(mappings.map(m => m.id === id ? { ...m, ...updates } : m))
                            }
                            onEditTransform={() => {
                              setSelectedMapping(mapping);
                              setShowTransformBuilder(true);
                            }}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="fields" className="space-y-4">
                <div className="flex gap-4 mb-4">
                  <div className="flex-1">
                    <Label htmlFor="search">Search Fields</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="search"
                        placeholder="Search fields..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger id="category" className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        <SelectItem value="lead">Lead</SelectItem>
                        <SelectItem value="campaign">Campaign</SelectItem>
                        <SelectItem value="engagement">Engagement</SelectItem>
                        <SelectItem value="enrichment">Enrichment</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <DroppableArea
                    id="coldcopy-fields"
                    title="ColdCopy Fields"
                    dropTarget="coldcopy"
                  >
                    <ScrollArea className="h-[500px]">
                      <div className="space-y-2 p-4">
                        {filteredColdCopyFields.map((field) => (
                          <DraggableField
                            key={field.name}
                            field={field}
                            from="coldcopy"
                            isMapped={mappings.some(m => m.coldcopyField.name === field.name)}
                          />
                        ))}
                      </div>
                    </ScrollArea>
                  </DroppableArea>

                  <DroppableArea
                    id="pipedrive-fields"
                    title="Pipedrive Fields"
                    dropTarget="pipedrive"
                  >
                    <ScrollArea className="h-[500px]">
                      <div className="space-y-2 p-4">
                        {filteredPipedriveFields.map((field) => (
                          <DraggableField
                            key={field.key}
                            field={field}
                            from="pipedrive"
                            isMapped={mappings.some(m => m.pipedriveField.key === field.key)}
                          />
                        ))}
                      </div>
                    </ScrollArea>
                  </DroppableArea>
                </div>

                <FieldCompatibilityValidator
                  coldcopyFields={filteredColdCopyFields}
                  pipedriveFields={filteredPipedriveFields}
                  mappings={mappings}
                />
              </TabsContent>

              <TabsContent value="builder" className="space-y-4">
                <TransformFunctionBuilder
                  mapping={selectedMapping}
                  onSave={(transform) => {
                    if (selectedMapping) {
                      setMappings(mappings.map(m => 
                        m.id === selectedMapping.id 
                          ? { ...m, transformFunction: transform }
                          : m
                      ));
                    }
                    setShowTransformBuilder(false);
                  }}
                />
              </TabsContent>

              <TabsContent value="custom" className="space-y-4">
                <CustomFieldCreator
                  onCreateField={(field) => {
                    setCustomFields([...customFields, field]);
                    localStorage.setItem('coldcopy_custom_fields', JSON.stringify([...customFields, field]));
                    toast({
                      title: 'Custom field created',
                      description: `${field.label} has been added`,
                    });
                  }}
                  existingFields={allFields}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {showPreview && (
          <FieldPreview
            mappings={mappings}
            onClose={() => setShowPreview(false)}
          />
        )}

        {showTemplates && (
          <MappingTemplates
            onApplyTemplate={handleApplyTemplate}
            onClose={() => setShowTemplates(false)}
          />
        )}

        <DragOverlay>
          {dragState.isDragging && dragState.draggedField && (
            <div className="p-3 bg-background border rounded-lg shadow-lg opacity-90">
              <p className="font-medium text-sm">
                {dragState.draggedFrom === 'coldcopy' 
                  ? (dragState.draggedField as ColdCopyField).label 
                  : (dragState.draggedField as PipedriveField).name}
              </p>
            </div>
          )}
        </DragOverlay>
      </div>
    </DndContext>
  );
}