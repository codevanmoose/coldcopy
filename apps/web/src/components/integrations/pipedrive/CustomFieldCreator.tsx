'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, 
  Save, 
  AlertCircle, 
  Code,
  Hash,
  Type,
  Calendar,
  Mail,
  Phone,
  Link,
  FileJson,
  List,
  ToggleLeft,
  Trash2,
  Copy,
  CheckCircle
} from 'lucide-react';
import { ColdCopyField, FieldValidation } from './types';
import { useToast } from '@/components/ui/use-toast';

interface CustomFieldCreatorProps {
  onCreateField: (field: ColdCopyField) => void;
  existingFields: ColdCopyField[];
}

export function CustomFieldCreator({ onCreateField, existingFields }: CustomFieldCreatorProps) {
  const [fieldData, setFieldData] = useState<Partial<ColdCopyField>>({
    name: '',
    label: '',
    type: 'string',
    category: 'custom',
    required: false,
    description: '',
  });
  const [validation, setValidation] = useState<Partial<FieldValidation>>({
    type: 'regex',
    pattern: '',
    errorMessage: '',
  });
  const [showValidation, setShowValidation] = useState(false);
  const [testValue, setTestValue] = useState('');
  const [validationResult, setValidationResult] = useState<{ valid: boolean; message: string } | null>(null);
  const { toast } = useToast();

  const fieldTypes = [
    { value: 'string', label: 'Text', icon: Type },
    { value: 'number', label: 'Number', icon: Hash },
    { value: 'boolean', label: 'Boolean', icon: ToggleLeft },
    { value: 'date', label: 'Date', icon: Calendar },
    { value: 'email', label: 'Email', icon: Mail },
    { value: 'phone', label: 'Phone', icon: Phone },
    { value: 'url', label: 'URL', icon: Link },
    { value: 'text', label: 'Long Text', icon: Type },
    { value: 'select', label: 'Select', icon: List },
    { value: 'multiselect', label: 'Multi-Select', icon: List },
    { value: 'json', label: 'JSON', icon: FileJson },
    { value: 'array', label: 'Array', icon: List },
  ];

  const generateFieldName = (label: string) => {
    return label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
  };

  const validateField = (): string[] => {
    const errors: string[] = [];
    
    if (!fieldData.label) errors.push('Field label is required');
    if (!fieldData.name) errors.push('Field name is required');
    
    if (fieldData.name && !/^[a-z][a-z0-9_]*$/i.test(fieldData.name)) {
      errors.push('Field name must start with a letter and contain only letters, numbers, and underscores');
    }
    
    if (existingFields.some(f => f.name === fieldData.name)) {
      errors.push('A field with this name already exists');
    }
    
    if (showValidation && validation.type === 'regex' && validation.pattern) {
      try {
        new RegExp(validation.pattern);
      } catch {
        errors.push('Invalid regular expression pattern');
      }
    }
    
    return errors;
  };

  const testValidation = () => {
    if (!validation.pattern || !testValue) return;
    
    try {
      let isValid = false;
      
      switch (validation.type) {
        case 'regex':
          const regex = new RegExp(validation.pattern);
          isValid = regex.test(testValue);
          break;
        case 'length':
          const length = testValue.length;
          isValid = (!validation.min || length >= validation.min) && 
                   (!validation.max || length <= validation.max);
          break;
        case 'range':
          const num = parseFloat(testValue);
          isValid = !isNaN(num) &&
                   (!validation.min || num >= validation.min) && 
                   (!validation.max || num <= validation.max);
          break;
      }
      
      setValidationResult({
        valid: isValid,
        message: isValid ? 'Value is valid' : validation.errorMessage || 'Value is invalid',
      });
    } catch (error) {
      setValidationResult({
        valid: false,
        message: 'Error testing validation',
      });
    }
  };

  const handleCreate = () => {
    const errors = validateField();
    if (errors.length > 0) {
      toast({
        title: 'Validation errors',
        description: errors.join(', '),
        variant: 'destructive',
      });
      return;
    }

    const newField: ColdCopyField = {
      name: fieldData.name!,
      label: fieldData.label!,
      type: fieldData.type as any,
      category: 'custom',
      required: fieldData.required,
      description: fieldData.description,
      validation: showValidation ? validation as FieldValidation : undefined,
    };

    onCreateField(newField);
    
    // Reset form
    setFieldData({
      name: '',
      label: '',
      type: 'string',
      category: 'custom',
      required: false,
      description: '',
    });
    setValidation({
      type: 'regex',
      pattern: '',
      errorMessage: '',
    });
    setShowValidation(false);
    setTestValue('');
    setValidationResult(null);
  };

  const duplicateExistingField = (field: ColdCopyField) => {
    setFieldData({
      ...field,
      name: `${field.name}_copy`,
      label: `${field.label} (Copy)`,
      category: 'custom',
    });
    if (field.validation) {
      setValidation(field.validation);
      setShowValidation(true);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create Custom Field</CardTitle>
          <CardDescription>
            Define custom fields to extend ColdCopy's data model
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="create" className="space-y-4">
            <TabsList>
              <TabsTrigger value="create">Create New</TabsTrigger>
              <TabsTrigger value="duplicate">Duplicate Existing</TabsTrigger>
            </TabsList>

            <TabsContent value="create" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="label">Field Label</Label>
                  <Input
                    id="label"
                    value={fieldData.label}
                    onChange={(e) => {
                      setFieldData({
                        ...fieldData,
                        label: e.target.value,
                        name: generateFieldName(e.target.value),
                      });
                    }}
                    placeholder="e.g., Customer ID"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Display name for the field
                  </p>
                </div>

                <div>
                  <Label htmlFor="name">Field Name</Label>
                  <Input
                    id="name"
                    value={fieldData.name}
                    onChange={(e) => setFieldData({ ...fieldData, name: e.target.value })}
                    placeholder="e.g., customer_id"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Technical identifier (auto-generated)
                  </p>
                </div>
              </div>

              <div>
                <Label>Field Type</Label>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {fieldTypes.map((type) => {
                    const Icon = type.icon;
                    return (
                      <Button
                        key={type.value}
                        variant={fieldData.type === type.value ? 'default' : 'outline'}
                        size="sm"
                        className="justify-start"
                        onClick={() => setFieldData({ ...fieldData, type: type.value as any })}
                      >
                        <Icon className="h-4 w-4 mr-2" />
                        {type.label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={fieldData.description}
                  onChange={(e) => setFieldData({ ...fieldData, description: e.target.value })}
                  placeholder="Describe what this field is used for..."
                  rows={3}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="required"
                    checked={fieldData.required}
                    onCheckedChange={(checked) => setFieldData({ ...fieldData, required: checked })}
                  />
                  <Label htmlFor="required">Required field</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="validation"
                    checked={showValidation}
                    onCheckedChange={setShowValidation}
                  />
                  <Label htmlFor="validation">Add validation</Label>
                </div>
              </div>

              {showValidation && (
                <Card className="p-4 border-dashed">
                  <div className="space-y-4">
                    <div>
                      <Label>Validation Type</Label>
                      <Select
                        value={validation.type}
                        onValueChange={(value: any) => setValidation({ ...validation, type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="regex">Regular Expression</SelectItem>
                          <SelectItem value="length">Length</SelectItem>
                          <SelectItem value="range">Numeric Range</SelectItem>
                          <SelectItem value="custom">Custom Function</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {validation.type === 'regex' && (
                      <div>
                        <Label>Pattern</Label>
                        <Input
                          value={validation.pattern}
                          onChange={(e) => setValidation({ ...validation, pattern: e.target.value })}
                          placeholder="e.g., ^[A-Z]{2}\d{6}$"
                          className="font-mono"
                        />
                      </div>
                    )}

                    {(validation.type === 'length' || validation.type === 'range') && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Minimum</Label>
                          <Input
                            type="number"
                            value={validation.min || ''}
                            onChange={(e) => setValidation({ ...validation, min: parseInt(e.target.value) })}
                          />
                        </div>
                        <div>
                          <Label>Maximum</Label>
                          <Input
                            type="number"
                            value={validation.max || ''}
                            onChange={(e) => setValidation({ ...validation, max: parseInt(e.target.value) })}
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <Label>Error Message</Label>
                      <Input
                        value={validation.errorMessage}
                        onChange={(e) => setValidation({ ...validation, errorMessage: e.target.value })}
                        placeholder="Value must match the required format"
                      />
                    </div>

                    <div>
                      <Label>Test Validation</Label>
                      <div className="flex gap-2 mt-2">
                        <Input
                          value={testValue}
                          onChange={(e) => setTestValue(e.target.value)}
                          placeholder="Enter a test value"
                        />
                        <Button
                          variant="outline"
                          onClick={testValidation}
                          disabled={!validation.pattern && validation.type === 'regex'}
                        >
                          Test
                        </Button>
                      </div>
                      {validationResult && (
                        <div className={`flex items-center gap-2 mt-2 text-sm ${
                          validationResult.valid ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {validationResult.valid ? (
                            <CheckCircle className="h-4 w-4" />
                          ) : (
                            <AlertCircle className="h-4 w-4" />
                          )}
                          {validationResult.message}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => {
                  setFieldData({
                    name: '',
                    label: '',
                    type: 'string',
                    category: 'custom',
                    required: false,
                    description: '',
                  });
                  setValidation({
                    type: 'regex',
                    pattern: '',
                    errorMessage: '',
                  });
                  setShowValidation(false);
                }}>
                  Reset
                </Button>
                <Button onClick={handleCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Field
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="duplicate" className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Select an existing field to duplicate and customize
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-2 gap-4">
                {existingFields.slice(0, 10).map((field) => (
                  <Card
                    key={field.name}
                    className="p-4 cursor-pointer hover:border-primary transition-colors"
                    onClick={() => duplicateExistingField(field)}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{field.label}</p>
                        <p className="text-xs text-muted-foreground">{field.name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {field.type}
                        </Badge>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Preview of created fields */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Custom Fields Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {existingFields.filter(f => f.category === 'custom').map((field) => (
              <div key={field.name} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="font-medium text-sm">{field.label}</p>
                  <p className="text-xs text-muted-foreground">{field.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {field.type}
                  </Badge>
                  {field.required && (
                    <Badge variant="destructive" className="text-xs">
                      Required
                    </Badge>
                  )}
                  {field.validation && (
                    <Badge variant="outline" className="text-xs">
                      Validated
                    </Badge>
                  )}
                </div>
              </div>
            ))}
            {existingFields.filter(f => f.category === 'custom').length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No custom fields created yet
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}