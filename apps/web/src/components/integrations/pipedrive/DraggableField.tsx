'use client';

import { useDraggable } from '@dnd-kit/core';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ColdCopyField, PipedriveField } from './types';
import { GripVertical, Check, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface DraggableFieldProps {
  field: ColdCopyField | PipedriveField;
  from: 'coldcopy' | 'pipedrive';
  isMapped: boolean;
}

export function DraggableField({ field, from, isMapped }: DraggableFieldProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `${from}-${from === 'coldcopy' ? (field as ColdCopyField).name : (field as PipedriveField).key}`,
    data: {
      field,
      from,
    },
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  const isColdCopyField = from === 'coldcopy';
  const fieldName = isColdCopyField ? (field as ColdCopyField).label : (field as PipedriveField).name;
  const fieldKey = isColdCopyField ? (field as ColdCopyField).name : (field as PipedriveField).key;
  const fieldType = isColdCopyField ? (field as ColdCopyField).type : (field as PipedriveField).field_type;
  const isRequired = isColdCopyField 
    ? (field as ColdCopyField).required 
    : (field as PipedriveField).mandatory_flag;
  const description = isColdCopyField ? (field as ColdCopyField).description : null;
  const isCustom = !isColdCopyField && (field as PipedriveField).is_custom_field;

  const getFieldTypeColor = (type: string): string => {
    const typeColors: Record<string, string> = {
      string: 'bg-blue-100 text-blue-700',
      varchar: 'bg-blue-100 text-blue-700',
      varchar_auto: 'bg-blue-100 text-blue-700',
      text: 'bg-blue-100 text-blue-700',
      number: 'bg-green-100 text-green-700',
      double: 'bg-green-100 text-green-700',
      monetary: 'bg-green-100 text-green-700',
      boolean: 'bg-purple-100 text-purple-700',
      date: 'bg-orange-100 text-orange-700',
      daterange: 'bg-orange-100 text-orange-700',
      time: 'bg-orange-100 text-orange-700',
      timerange: 'bg-orange-100 text-orange-700',
      email: 'bg-pink-100 text-pink-700',
      phone: 'bg-cyan-100 text-cyan-700',
      url: 'bg-indigo-100 text-indigo-700',
      json: 'bg-yellow-100 text-yellow-700',
      select: 'bg-violet-100 text-violet-700',
      enum: 'bg-violet-100 text-violet-700',
      multiselect: 'bg-violet-100 text-violet-700',
      set: 'bg-violet-100 text-violet-700',
      array: 'bg-amber-100 text-amber-700',
      address: 'bg-teal-100 text-teal-700',
      org: 'bg-slate-100 text-slate-700',
      people: 'bg-slate-100 text-slate-700',
      user: 'bg-gray-100 text-gray-700',
      visible_to: 'bg-gray-100 text-gray-700',
    };

    return typeColors[type] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "p-3 border rounded-lg transition-all cursor-grab",
        isDragging ? "opacity-50 shadow-lg z-50" : "hover:bg-muted/50",
        isMapped && "bg-muted/30 border-green-200"
      )}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1">
          <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm truncate">
                {fieldName}
              </p>
              {isRequired && (
                <span className="text-red-500 text-xs">*</span>
              )}
              {description && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">{description}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {fieldKey}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge 
            variant="secondary" 
            className={cn("text-xs", getFieldTypeColor(fieldType))}
          >
            {fieldType}
          </Badge>
          
          {isCustom && (
            <Badge variant="outline" className="text-xs">
              Custom
            </Badge>
          )}
          
          {isMapped && (
            <Badge variant="success" className="text-xs">
              <Check className="h-3 w-3 mr-1" />
              Mapped
            </Badge>
          )}
        </div>
      </div>

      {/* Additional field info for Pipedrive fields */}
      {!isColdCopyField && (field as PipedriveField).options && (
        <div className="mt-2 flex flex-wrap gap-1">
          {(field as PipedriveField).options?.slice(0, 3).map((option) => (
            <Badge key={option.id} variant="outline" className="text-xs">
              {option.label}
            </Badge>
          ))}
          {(field as PipedriveField).options!.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{(field as PipedriveField).options!.length - 3} more
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}