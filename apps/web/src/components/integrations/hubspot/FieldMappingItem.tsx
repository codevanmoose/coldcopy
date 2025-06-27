'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { GripVertical, Trash2, ArrowRight, ArrowLeft, ArrowLeftRight, Code } from 'lucide-react';
import { FieldMappingItem as FieldMappingType } from './types';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';

interface FieldMappingItemProps {
  mapping: FieldMappingType;
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<FieldMappingType>) => void;
}

export function FieldMappingItem({ mapping, onRemove, onUpdate }: FieldMappingItemProps) {
  const [showTransformEditor, setShowTransformEditor] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: mapping.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getDirectionIcon = () => {
    switch (mapping.direction) {
      case 'to_hubspot':
        return <ArrowRight className="h-4 w-4" />;
      case 'from_hubspot':
        return <ArrowLeft className="h-4 w-4" />;
      case 'bidirectional':
        return <ArrowLeftRight className="h-4 w-4" />;
    }
  };

  const getTypeCompatibility = () => {
    const coldcopyType = mapping.coldcopyField.type;
    const hubspotType = mapping.hubspotProperty.fieldType;

    // Simple type compatibility check
    if (coldcopyType === hubspotType) return 'exact';
    
    const compatibleTypes = {
      string: ['text', 'textarea', 'select', 'radio'],
      number: ['number'],
      date: ['date', 'datetime'],
      email: ['text', 'email'],
      phone: ['text', 'phonenumber'],
      boolean: ['bool', 'checkbox'],
    };

    if (compatibleTypes[coldcopyType]?.includes(hubspotType)) return 'compatible';
    return 'warning';
  };

  const compatibility = getTypeCompatibility();

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`p-4 ${isDragging ? 'shadow-lg' : ''}`}
    >
      <div className="flex items-center gap-4">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab hover:cursor-grabbing"
        >
          <GripVertical className="h-5 w-5 text-muted-foreground" />
        </div>

        <div className="flex-1 grid grid-cols-3 gap-4 items-center">
          <div>
            <p className="font-medium text-sm">{mapping.coldcopyField.label}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                {mapping.coldcopyField.type}
              </Badge>
              {mapping.coldcopyField.required && (
                <Badge variant="secondary" className="text-xs">
                  Required
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center justify-center">
            <Select
              value={mapping.direction}
              onValueChange={(value: any) => onUpdate(mapping.id, { direction: value })}
            >
              <SelectTrigger className="w-36">
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

          <div>
            <p className="font-medium text-sm">{mapping.hubspotProperty.label}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                {mapping.hubspotProperty.fieldType}
              </Badge>
              {compatibility === 'warning' && (
                <Badge variant="destructive" className="text-xs">
                  Type mismatch
                </Badge>
              )}
              {compatibility === 'compatible' && (
                <Badge variant="secondary" className="text-xs">
                  Compatible
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Popover open={showTransformEditor} onOpenChange={setShowTransformEditor}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className={mapping.transformFunction ? 'text-primary' : ''}
              >
                <Code className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96" align="end">
              <div className="space-y-4">
                <div>
                  <Label>Transform Function (JavaScript)</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Write a function to transform the value. Use 'value' as the input parameter.
                  </p>
                </div>
                <Textarea
                  placeholder="// Example: Convert to uppercase
return value.toUpperCase();

// Example: Parse number
return parseInt(value) || 0;"
                  value={mapping.transformFunction || ''}
                  onChange={(e) => onUpdate(mapping.id, { transformFunction: e.target.value })}
                  className="font-mono text-sm h-32"
                />
                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onUpdate(mapping.id, { transformFunction: undefined })}
                  >
                    Clear
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setShowTransformEditor(false)}
                  >
                    Done
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRemove(mapping.id)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}