'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  GripVertical, 
  Trash2, 
  ArrowRight, 
  ArrowLeft, 
  ArrowLeftRight,
  Zap,
  AlertCircle,
  CheckCircle,
  Settings,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { PipedriveFieldMapping } from './types';
import { cn } from '@/lib/utils';

interface FieldMappingItemProps {
  mapping: PipedriveFieldMapping;
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<PipedriveFieldMapping>) => void;
  onEditTransform?: () => void;
}

export function FieldMappingItem({ 
  mapping, 
  onRemove, 
  onUpdate,
  onEditTransform 
}: FieldMappingItemProps) {
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
  };

  const getDirectionIcon = () => {
    switch (mapping.direction) {
      case 'to_pipedrive':
        return <ArrowRight className="h-4 w-4" />;
      case 'from_pipedrive':
        return <ArrowLeft className="h-4 w-4" />;
      case 'bidirectional':
        return <ArrowLeftRight className="h-4 w-4" />;
    }
  };

  const getFieldTypeIcon = (type: string) => {
    const typeColors: Record<string, string> = {
      string: 'text-blue-500',
      number: 'text-green-500',
      boolean: 'text-purple-500',
      date: 'text-orange-500',
      email: 'text-pink-500',
      phone: 'text-cyan-500',
      json: 'text-yellow-500',
      select: 'text-indigo-500',
      multiselect: 'text-violet-500',
    };

    return typeColors[type] || 'text-gray-500';
  };

  const getSyncStatus = () => {
    if (!mapping.lastSynced) {
      return { icon: AlertCircle, color: 'text-gray-500', text: 'Never synced' };
    }

    const hoursSinceSync = (Date.now() - new Date(mapping.lastSynced).getTime()) / (1000 * 60 * 60);
    
    if (mapping.syncErrors && mapping.syncErrors > 0) {
      return { icon: AlertTriangle, color: 'text-red-500', text: `${mapping.syncErrors} errors` };
    }
    
    if (hoursSinceSync < 1) {
      return { icon: CheckCircle, color: 'text-green-500', text: 'Recently synced' };
    }
    
    if (hoursSinceSync < 24) {
      return { icon: Clock, color: 'text-yellow-500', text: 'Synced today' };
    }
    
    return { icon: Clock, color: 'text-orange-500', text: `Synced ${Math.floor(hoursSinceSync / 24)}d ago` };
  };

  const syncStatus = getSyncStatus();

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "p-4 transition-all",
        isDragging && "opacity-50 shadow-lg",
        !mapping.isActive && "opacity-60 bg-muted/50"
      )}
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
          {/* ColdCopy Field */}
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={cn("text-xs", getFieldTypeIcon(mapping.coldcopyField.type))}>
                {mapping.coldcopyField.type}
              </Badge>
              <span className="font-medium">{mapping.coldcopyField.label}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {mapping.coldcopyField.name}
              {mapping.coldcopyField.required && (
                <span className="text-red-500 ml-1">*</span>
              )}
            </p>
          </div>

          {/* Direction and Transform */}
          <div className="flex flex-col items-center gap-2">
            <Select
              value={mapping.direction}
              onValueChange={(value: any) => onUpdate(mapping.id, { direction: value })}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="to_pipedrive">
                  <div className="flex items-center gap-2">
                    <ArrowRight className="h-4 w-4" />
                    To Pipedrive
                  </div>
                </SelectItem>
                <SelectItem value="from_pipedrive">
                  <div className="flex items-center gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    From Pipedrive
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

            {mapping.transformFunction && (
              <div className="flex items-center gap-1">
                <Zap className="h-3 w-3 text-yellow-500" />
                <span className="text-xs text-muted-foreground">
                  {mapping.transformFunction.name}
                </span>
              </div>
            )}
          </div>

          {/* Pipedrive Field */}
          <div className="text-right">
            <div className="flex items-center justify-end gap-2">
              <span className="font-medium">{mapping.pipedriveField.name}</span>
              <Badge variant="outline" className={cn("text-xs", getFieldTypeIcon(mapping.pipedriveField.field_type))}>
                {mapping.pipedriveField.field_type}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {mapping.pipedriveField.key}
              {mapping.pipedriveField.mandatory_flag && (
                <span className="text-red-500 ml-1">*</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Sync Status */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={cn("flex items-center", syncStatus.color)}>
                  <syncStatus.icon className="h-4 w-4" />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{syncStatus.text}</p>
                {mapping.lastSynced && (
                  <p className="text-xs text-muted-foreground">
                    {new Date(mapping.lastSynced).toLocaleString()}
                  </p>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Active Toggle */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Switch
                  checked={mapping.isActive}
                  onCheckedChange={(checked) => onUpdate(mapping.id, { isActive: checked })}
                />
              </TooltipTrigger>
              <TooltipContent>
                <p>{mapping.isActive ? 'Active' : 'Inactive'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Transform Settings */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onEditTransform}
                  className={cn(
                    mapping.transformFunction && "text-yellow-500"
                  )}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Configure transform</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Remove */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemove(mapping.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Remove mapping</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Validation Warnings */}
      {mapping.coldcopyField.type !== mapping.pipedriveField.field_type && !mapping.transformFunction && (
        <div className="mt-2 flex items-center gap-2 text-xs text-yellow-600">
          <AlertTriangle className="h-3 w-3" />
          <span>
            Type mismatch: {mapping.coldcopyField.type} → {mapping.pipedriveField.field_type}. 
            Consider adding a transform function.
          </span>
        </div>
      )}
    </Card>
  );
}