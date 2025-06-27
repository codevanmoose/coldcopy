'use client';

import { useState, useEffect } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Save, Loader2, AlertCircle, ArrowRight, ArrowLeft, ArrowLeftRight, Search, Filter, RefreshCw } from 'lucide-react';
import { FieldMappingItem } from './FieldMappingItem';
import { FieldMappingItem as FieldMappingType, ColdCopyField, HubSpotPropertyField } from './types';
import { useToast } from '@/components/ui/use-toast';

// Predefined ColdCopy fields
const COLDCOPY_FIELDS: ColdCopyField[] = [
  // Lead fields
  { name: 'email', label: 'Email', type: 'email', required: true, category: 'lead' },
  { name: 'firstName', label: 'First Name', type: 'string', category: 'lead' },
  { name: 'lastName', label: 'Last Name', type: 'string', category: 'lead' },
  { name: 'company', label: 'Company', type: 'string', category: 'lead' },
  { name: 'jobTitle', label: 'Job Title', type: 'string', category: 'lead' },
  { name: 'phone', label: 'Phone', type: 'phone', category: 'lead' },
  { name: 'website', label: 'Website', type: 'string', category: 'lead' },
  { name: 'linkedinUrl', label: 'LinkedIn URL', type: 'string', category: 'lead' },
  { name: 'industry', label: 'Industry', type: 'string', category: 'lead' },
  { name: 'companySize', label: 'Company Size', type: 'number', category: 'lead' },
  { name: 'annualRevenue', label: 'Annual Revenue', type: 'number', category: 'lead' },
  { name: 'location', label: 'Location', type: 'string', category: 'lead' },
  
  // Campaign fields
  { name: 'campaignName', label: 'Campaign Name', type: 'string', category: 'campaign' },
  { name: 'campaignStatus', label: 'Campaign Status', type: 'string', category: 'campaign' },
  { name: 'sequenceStep', label: 'Sequence Step', type: 'number', category: 'campaign' },
  
  // Engagement fields
  { name: 'emailsSent', label: 'Emails Sent', type: 'number', category: 'engagement' },
  { name: 'emailsOpened', label: 'Emails Opened', type: 'number', category: 'engagement' },
  { name: 'emailsClicked', label: 'Emails Clicked', type: 'number', category: 'engagement' },
  { name: 'emailsReplied', label: 'Emails Replied', type: 'number', category: 'engagement' },
  { name: 'lastEngagementDate', label: 'Last Engagement Date', type: 'date', category: 'engagement' },
  { name: 'engagementScore', label: 'Engagement Score', type: 'number', category: 'engagement' },
];

export function FieldMappingManager() {
  const [mappings, setMappings] = useState<FieldMappingType[]>([]);
  const [hubspotProperties, setHubspotProperties] = useState<HubSpotPropertyField[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showAddMapping, setShowAddMapping] = useState(false);
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchMappings();
    fetchHubSpotProperties();
  }, []);

  const fetchMappings = async () => {
    try {
      const response = await fetch('/api/integrations/hubspot/field-mappings');
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

  const fetchHubSpotProperties = async () => {
    try {
      const response = await fetch('/api/integrations/hubspot/properties');
      if (response.ok) {
        const data = await response.json();
        setHubspotProperties(data);
      }
    } catch (error) {
      console.error('Error fetching HubSpot properties:', error);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setMappings((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over?.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleAddMapping = (mapping: Omit<FieldMappingType, 'id'>) => {
    const newMapping: FieldMappingType = {
      ...mapping,
      id: Date.now().toString(),
    };
    setMappings([...mappings, newMapping]);
    setShowAddMapping(false);
  };

  const handleRemoveMapping = (id: string) => {
    setMappings(mappings.filter(m => m.id !== id));
  };

  const handleUpdateMapping = (id: string, updates: Partial<FieldMappingType>) => {
    setMappings(mappings.map(m => m.id === id ? { ...m, ...updates } : m));
  };

  const handleSaveMappings = async () => {
    try {
      setIsSaving(true);
      const response = await fetch('/api/integrations/hubspot/field-mappings', {
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

  const filteredColdCopyFields = COLDCOPY_FIELDS.filter(field => {
    const matchesSearch = field.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         field.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || field.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const filteredHubSpotProperties = hubspotProperties.filter(prop =>
    prop.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    prop.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getDirectionIcon = (direction: string) => {
    switch (direction) {
      case 'to_hubspot':
        return <ArrowRight className="h-4 w-4" />;
      case 'from_hubspot':
        return <ArrowLeft className="h-4 w-4" />;
      case 'bidirectional':
        return <ArrowLeftRight className="h-4 w-4" />;
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
              <CardTitle>Field Mapping Configuration</CardTitle>
              <CardDescription>
                Map ColdCopy fields to HubSpot properties for seamless data synchronization
              </CardDescription>
            </div>
            <div className="flex gap-2">
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
          <Tabs defaultValue="active" className="space-y-4">
            <TabsList>
              <TabsTrigger value="active">Active Mappings ({mappings.length})</TabsTrigger>
              <TabsTrigger value="available">Available Fields</TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="space-y-4">
              {mappings.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No field mappings configured. Click "Add Mapping" or switch to "Available Fields" to get started.
                  </AlertDescription>
                </Alert>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={mappings.map(m => m.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {mappings.map((mapping) => (
                        <FieldMappingItem
                          key={mapping.id}
                          mapping={mapping}
                          onRemove={handleRemoveMapping}
                          onUpdate={handleUpdateMapping}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}

              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowAddMapping(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Field Mapping
              </Button>
            </TabsContent>

            <TabsContent value="available" className="space-y-4">
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
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">ColdCopy Fields</h4>
                  <ScrollArea className="h-96 border rounded-lg p-4">
                    <div className="space-y-2">
                      {filteredColdCopyFields.map((field) => {
                        const isMapped = mappings.some(m => m.coldcopyField.name === field.name);
                        return (
                          <div
                            key={field.name}
                            className={`p-3 border rounded-lg ${isMapped ? 'bg-muted' : 'hover:bg-muted/50'} transition-colors`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-sm">{field.label}</p>
                                <p className="text-xs text-muted-foreground">{field.name}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-xs">
                                  {field.type}
                                </Badge>
                                {isMapped && (
                                  <Badge variant="success" className="text-xs">
                                    Mapped
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>

                <div>
                  <h4 className="font-medium mb-2">HubSpot Properties</h4>
                  <ScrollArea className="h-96 border rounded-lg p-4">
                    <div className="space-y-2">
                      {filteredHubSpotProperties.map((prop) => {
                        const isMapped = mappings.some(m => m.hubspotProperty.name === prop.name);
                        return (
                          <div
                            key={prop.name}
                            className={`p-3 border rounded-lg ${isMapped ? 'bg-muted' : 'hover:bg-muted/50'} transition-colors`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-sm">{prop.label}</p>
                                <p className="text-xs text-muted-foreground">{prop.name}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-xs">
                                  {prop.fieldType}
                                </Badge>
                                {isMapped && (
                                  <Badge variant="success" className="text-xs">
                                    Mapped
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Add Mapping Dialog */}
      {showAddMapping && (
        <AddMappingDialog
          coldcopyFields={COLDCOPY_FIELDS.filter(f => !mappings.some(m => m.coldcopyField.name === f.name))}
          hubspotProperties={hubspotProperties.filter(p => !mappings.some(m => m.hubspotProperty.name === p.name))}
          onAdd={handleAddMapping}
          onClose={() => setShowAddMapping(false)}
        />
      )}
    </div>
  );
}

interface AddMappingDialogProps {
  coldcopyFields: ColdCopyField[];
  hubspotProperties: HubSpotPropertyField[];
  onAdd: (mapping: Omit<FieldMappingType, 'id'>) => void;
  onClose: () => void;
}

function AddMappingDialog({ coldcopyFields, hubspotProperties, onAdd, onClose }: AddMappingDialogProps) {
  const [selectedColdCopyField, setSelectedColdCopyField] = useState<ColdCopyField | null>(null);
  const [selectedHubSpotProperty, setSelectedHubSpotProperty] = useState<HubSpotPropertyField | null>(null);
  const [direction, setDirection] = useState<'to_hubspot' | 'from_hubspot' | 'bidirectional'>('bidirectional');

  const handleSubmit = () => {
    if (selectedColdCopyField && selectedHubSpotProperty) {
      onAdd({
        coldcopyField: selectedColdCopyField,
        hubspotProperty: selectedHubSpotProperty,
        direction,
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Add Field Mapping</CardTitle>
          <CardDescription>
            Select fields to map between ColdCopy and HubSpot
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>ColdCopy Field</Label>
              <Select
                value={selectedColdCopyField?.name}
                onValueChange={(value) => {
                  const field = coldcopyFields.find(f => f.name === value);
                  setSelectedColdCopyField(field || null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a field" />
                </SelectTrigger>
                <SelectContent>
                  {coldcopyFields.map((field) => (
                    <SelectItem key={field.name} value={field.name}>
                      {field.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>HubSpot Property</Label>
              <Select
                value={selectedHubSpotProperty?.name}
                onValueChange={(value) => {
                  const prop = hubspotProperties.find(p => p.name === value);
                  setSelectedHubSpotProperty(prop || null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a property" />
                </SelectTrigger>
                <SelectContent>
                  {hubspotProperties.map((prop) => (
                    <SelectItem key={prop.name} value={prop.name}>
                      {prop.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Sync Direction</Label>
            <Select value={direction} onValueChange={(value: any) => setDirection(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="to_hubspot">
                  <div className="flex items-center gap-2">
                    <ArrowRight className="h-4 w-4" />
                    To HubSpot
                  </div>
                </SelectItem>
                <SelectItem value="from_hubspot">
                  <div className="flex items-center gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    From HubSpot
                  </div>
                </SelectItem>
                <SelectItem value="bidirectional">
                  <div className="flex items-center gap-2">
                    <ArrowLeftRight className="h-4 w-4" />
                    Bidirectional
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!selectedColdCopyField || !selectedHubSpotProperty}
            >
              Add Mapping
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}