'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  ArrowRight,
  Plus,
  Trash2,
  Settings,
  RefreshCw,
  Save,
  AlertCircle,
  CheckCircle,
  Info,
  Loader2,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { toast } from 'sonner';
import { SalesforceFieldMapping, FieldMappingConfig } from '@/lib/integrations/salesforce/types';

interface SalesforceFieldMappingProps {
  objectType: 'Lead' | 'Contact' | 'Campaign' | 'Opportunity';
  className?: string;
}

const LOCAL_FIELDS = {
  Lead: [
    { field: 'first_name', label: 'First Name', type: 'text' },
    { field: 'last_name', label: 'Last Name', type: 'text' },
    { field: 'email', label: 'Email', type: 'email' },
    { field: 'company', label: 'Company', type: 'text' },
    { field: 'job_title', label: 'Job Title', type: 'text' },
    { field: 'phone', label: 'Phone', type: 'text' },
    { field: 'website', label: 'Website', type: 'url' },
    { field: 'industry', label: 'Industry', type: 'text' },
    { field: 'linkedin_url', label: 'LinkedIn URL', type: 'url' },
    { field: 'source', label: 'Lead Source', type: 'text' },
    { field: 'score', label: 'Lead Score', type: 'number' },
  ],
  Campaign: [
    { field: 'name', label: 'Campaign Name', type: 'text' },
    { field: 'description', label: 'Description', type: 'text' },
    { field: 'status', label: 'Status', type: 'select' },
    { field: 'created_at', label: 'Start Date', type: 'date' },
    { field: 'scheduled_at', label: 'Scheduled Date', type: 'date' },
  ],
};

const SALESFORCE_FIELDS = {
  Lead: [
    'FirstName', 'LastName', 'Email', 'Company', 'Title', 'Phone',
    'Website', 'Industry', 'LeadSource', 'Status', 'Rating',
    'NumberOfEmployees', 'AnnualRevenue', 'Description',
  ],
  Campaign: [
    'Name', 'Type', 'Status', 'StartDate', 'EndDate', 'Description',
    'IsActive', 'BudgetedCost', 'ActualCost', 'ExpectedRevenue',
  ],
};

const TRANSFORM_OPTIONS = [
  { value: 'none', label: 'No transformation' },
  { value: 'lowercase', label: 'Lowercase' },
  { value: 'uppercase', label: 'Uppercase' },
  { value: 'trim', label: 'Trim whitespace' },
  { value: 'date', label: 'Format as date' },
  { value: 'boolean', label: 'Convert to boolean' },
  { value: 'number', label: 'Convert to number' },
];

export function SalesforceFieldMapping({ objectType, className }: SalesforceFieldMappingProps) {
  const { workspace } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fieldMappings, setFieldMappings] = useState<FieldMappingConfig[]>([]);
  const [mappingName, setMappingName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [mappingId, setMappingId] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newMapping, setNewMapping] = useState<FieldMappingConfig>({
    local_field: '',
    salesforce_field: '',
    transform: 'none',
    default_value: '',
  });

  useEffect(() => {
    if (workspace?.id) {
      fetchFieldMappings();
    }
  }, [workspace?.id, objectType]);

  const fetchFieldMappings = async () => {
    if (!workspace?.id) return;

    setLoading(true);
    try {
      const response = await fetch(
        `/api/salesforce/field-mappings?workspace_id=${workspace.id}&object_type=${objectType}`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.mapping) {
          setFieldMappings(data.mapping.field_mappings);
          setMappingName(data.mapping.mapping_name);
          setIsDefault(data.mapping.is_default);
          setMappingId(data.mapping.id);
        }
      }
    } catch (error) {
      console.error('Error fetching field mappings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveFieldMappings = async () => {
    if (!workspace?.id) return;

    setSaving(true);
    try {
      const response = await fetch('/api/salesforce/field-mappings', {
        method: mappingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspace.id,
          mapping_id: mappingId,
          mapping_name: mappingName || `${objectType} Field Mapping`,
          salesforce_object: objectType,
          local_object: objectType.toLowerCase(),
          field_mappings: fieldMappings,
          is_default: isDefault,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save field mappings');
      }

      const data = await response.json();
      setMappingId(data.mapping.id);
      toast.success('Field mappings saved successfully');
    } catch (error) {
      console.error('Error saving field mappings:', error);
      toast.error('Failed to save field mappings');
    } finally {
      setSaving(false);
    }
  };

  const addFieldMapping = () => {
    if (!newMapping.local_field || !newMapping.salesforce_field) {
      toast.error('Please select both local and Salesforce fields');
      return;
    }

    // Check if mapping already exists
    if (fieldMappings.some(m => m.local_field === newMapping.local_field)) {
      toast.error('Mapping for this field already exists');
      return;
    }

    setFieldMappings([...fieldMappings, { ...newMapping }]);
    setNewMapping({
      local_field: '',
      salesforce_field: '',
      transform: 'none',
      default_value: '',
    });
    setShowAddDialog(false);
  };

  const removeFieldMapping = (index: number) => {
    setFieldMappings(fieldMappings.filter((_, i) => i !== index));
  };

  const updateFieldMapping = (index: number, updates: Partial<FieldMappingConfig>) => {
    const updated = [...fieldMappings];
    updated[index] = { ...updated[index], ...updates };
    setFieldMappings(updated);
  };

  const getTransformLabel = (transform?: string) => {
    const option = TRANSFORM_OPTIONS.find(o => o.value === (transform || 'none'));
    return option?.label || 'No transformation';
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Field Mappings - {objectType}</CardTitle>
            <CardDescription>
              Configure how fields are mapped between ColdCopy and Salesforce
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {isDefault && (
              <Badge variant="secondary">
                <CheckCircle className="mr-1 h-3 w-3" />
                Default
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Mapping Name */}
        <div className="space-y-2">
          <Label>Mapping Name</Label>
          <Input
            value={mappingName}
            onChange={(e) => setMappingName(e.target.value)}
            placeholder={`${objectType} Field Mapping`}
          />
        </div>

        {/* Field Mappings Table */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Field Mappings</Label>
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Mapping
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Field Mapping</DialogTitle>
                  <DialogDescription>
                    Map a ColdCopy field to a Salesforce field
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>ColdCopy Field</Label>
                    <Select
                      value={newMapping.local_field}
                      onValueChange={(value) =>
                        setNewMapping({ ...newMapping, local_field: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a field" />
                      </SelectTrigger>
                      <SelectContent>
                        {LOCAL_FIELDS[objectType]?.map((field) => (
                          <SelectItem
                            key={field.field}
                            value={field.field}
                            disabled={fieldMappings.some(m => m.local_field === field.field)}
                          >
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Salesforce Field</Label>
                    <Select
                      value={newMapping.salesforce_field}
                      onValueChange={(value) =>
                        setNewMapping({ ...newMapping, salesforce_field: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a field" />
                      </SelectTrigger>
                      <SelectContent>
                        {SALESFORCE_FIELDS[objectType]?.map((field) => (
                          <SelectItem key={field} value={field}>
                            {field}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Transformation</Label>
                    <Select
                      value={newMapping.transform}
                      onValueChange={(value) =>
                        setNewMapping({ ...newMapping, transform: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TRANSFORM_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Default Value (optional)</Label>
                    <Input
                      value={newMapping.default_value}
                      onChange={(e) =>
                        setNewMapping({ ...newMapping, default_value: e.target.value })
                      }
                      placeholder="Enter a default value"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setShowAddDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={addFieldMapping}>
                    Add Mapping
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {fieldMappings.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ColdCopy Field</TableHead>
                  <TableHead></TableHead>
                  <TableHead>Salesforce Field</TableHead>
                  <TableHead>Transformation</TableHead>
                  <TableHead>Default Value</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fieldMappings.map((mapping, index) => {
                  const localField = LOCAL_FIELDS[objectType]?.find(
                    f => f.field === mapping.local_field
                  );
                  
                  return (
                    <TableRow key={index}>
                      <TableCell className="font-medium">
                        {localField?.label || mapping.local_field}
                      </TableCell>
                      <TableCell>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                      <TableCell>{mapping.salesforce_field}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {getTransformLabel(mapping.transform)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {mapping.default_value || '-'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFieldMapping(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="text-muted-foreground">
                No field mappings configured. Add mappings to sync data between ColdCopy and Salesforce.
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is-default"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="rounded border-gray-300"
            />
            <Label htmlFor="is-default" className="font-normal">
              Set as default mapping for {objectType}
            </Label>
          </div>
          <Button onClick={saveFieldMappings} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Mappings
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}