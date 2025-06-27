'use client';

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  AlertCircle,
  CheckCircle,
  XCircle,
  User,
  Building,
  Briefcase,
  Activity,
  Brain,
  Clock,
  AlertTriangle,
  FileText,
  GitBranch,
  Sparkles
} from 'lucide-react';
import { 
  ConflictDetectionResult, 
  ConflictType, 
  ConflictSeverity,
  ResolutionSuggestion,
  ConflictResolutionResult
} from '@/lib/integrations/pipedrive/conflict-resolution';
import { cn } from '@/lib/utils';

interface ConflictReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  conflict: ConflictDetectionResult;
  localData: any;
  remoteData: any;
  onResolve: (resolution: ConflictResolutionResult) => void;
  suggestions?: ResolutionSuggestion[];
  isLoading?: boolean;
}

export function ConflictReviewModal({
  isOpen,
  onClose,
  conflict,
  localData,
  remoteData,
  onResolve,
  suggestions = [],
  isLoading = false
}: ConflictReviewModalProps) {
  const [selectedStrategy, setSelectedStrategy] = useState<string>('manual');
  const [resolvedData, setResolvedData] = useState<any>({});
  const [notes, setNotes] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [fieldSelections, setFieldSelections] = useState<Record<string, 'local' | 'remote' | 'custom'>>({}); 
  const [customValues, setCustomValues] = useState<Record<string, any>>({});

  useEffect(() => {
    // Initialize resolved data with local data
    setResolvedData({ ...localData });
    
    // Initialize field selections
    const selections: Record<string, 'local' | 'remote' | 'custom'> = {};
    conflict.conflictedFields.forEach(field => {
      selections[field.fieldName] = 'local';
    });
    setFieldSelections(selections);
  }, [conflict, localData]);

  const getEntityIcon = (entityType: string) => {
    switch (entityType) {
      case 'person': return User;
      case 'organization': return Building;
      case 'deal': return Briefcase;
      case 'activity': return Activity;
      default: return FileText;
    }
  };

  const getSeverityColor = (severity: ConflictSeverity) => {
    switch (severity) {
      case ConflictSeverity.CRITICAL: return 'text-red-600';
      case ConflictSeverity.HIGH: return 'text-orange-600';
      case ConflictSeverity.MEDIUM: return 'text-yellow-600';
      case ConflictSeverity.LOW: return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  const getConflictTypeLabel = (type: ConflictType) => {
    switch (type) {
      case ConflictType.FIELD_CONFLICT: return 'Field Conflicts';
      case ConflictType.DELETION_CONFLICT: return 'Deletion Conflict';
      case ConflictType.CREATION_CONFLICT: return 'Creation Conflict';
      case ConflictType.RELATIONSHIP_CONFLICT: return 'Relationship Conflict';
      case ConflictType.MERGE_CONFLICT: return 'Merge Conflict';
      case ConflictType.SCHEMA_CONFLICT: return 'Schema Conflict';
      default: return 'Unknown Conflict';
    }
  };

  const handleFieldSelection = (fieldName: string, selection: 'local' | 'remote' | 'custom') => {
    setFieldSelections(prev => ({ ...prev, [fieldName]: selection }));
    
    // Update resolved data based on selection
    const newResolvedData = { ...resolvedData };
    
    if (selection === 'local') {
      newResolvedData[fieldName] = localData[fieldName];
    } else if (selection === 'remote') {
      newResolvedData[fieldName] = remoteData[fieldName];
    } else if (selection === 'custom' && customValues[fieldName] !== undefined) {
      newResolvedData[fieldName] = customValues[fieldName];
    }
    
    setResolvedData(newResolvedData);
  };

  const handleCustomValueChange = (fieldName: string, value: any) => {
    setCustomValues(prev => ({ ...prev, [fieldName]: value }));
    
    if (fieldSelections[fieldName] === 'custom') {
      setResolvedData(prev => ({ ...prev, [fieldName]: value }));
    }
  };

  const handleApplySuggestion = (suggestion: ResolutionSuggestion) => {
    setResolvedData(prev => ({ ...prev, [suggestion.field]: suggestion.suggestedValue }));
    setFieldSelections(prev => ({ ...prev, [suggestion.field]: 'custom' }));
    setCustomValues(prev => ({ ...prev, [suggestion.field]: suggestion.suggestedValue }));
  };

  const handleResolve = () => {
    const resolution: ConflictResolutionResult = {
      resolved: true,
      resolvedData,
      strategy: selectedStrategy,
      confidence: calculateConfidence(),
      requiresManualReview: false,
      suggestions: [],
      auditLog: [
        {
          timestamp: new Date(),
          action: 'manual_resolution',
          reason: notes || 'Manual resolution by user',
          userId: 'current-user' // This should come from auth context
        }
      ]
    };
    
    onResolve(resolution);
  };

  const calculateConfidence = () => {
    // Calculate confidence based on selections
    let confidence = 100;
    const totalFields = conflict.conflictedFields.length;
    const customFields = Object.values(fieldSelections).filter(s => s === 'custom').length;
    
    // Reduce confidence for custom values
    confidence -= (customFields / totalFields) * 20;
    
    // Reduce confidence for high severity
    if (conflict.conflictSeverity === ConflictSeverity.HIGH) confidence -= 10;
    if (conflict.conflictSeverity === ConflictSeverity.CRITICAL) confidence -= 20;
    
    return Math.max(50, Math.min(100, confidence));
  };

  const renderFieldValue = (value: any) => {
    if (value === null || value === undefined) return <span className="text-gray-400">Empty</span>;
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') return <pre className="text-xs">{JSON.stringify(value, null, 2)}</pre>;
    return String(value);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Resolve Data Conflict
          </DialogTitle>
          <DialogDescription>
            Review and resolve conflicts between local and Pipedrive data
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4 py-2">
          <Badge variant="outline" className="flex items-center gap-1">
            {React.createElement(getEntityIcon(localData.entityType || 'person'), { className: "h-3 w-3" })}
            {localData.entityType || 'Unknown'}
          </Badge>
          <Badge className={cn("flex items-center gap-1", getSeverityColor(conflict.conflictSeverity))}>
            <AlertTriangle className="h-3 w-3" />
            {conflict.conflictSeverity}
          </Badge>
          <Badge variant="secondary">
            {getConflictTypeLabel(conflict.conflictType)}
          </Badge>
          <div className="ml-auto text-sm text-gray-500 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Detected {format(new Date(), 'PPp')}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="fields">Field Conflicts ({conflict.conflictedFields.length})</TabsTrigger>
            <TabsTrigger value="suggestions">AI Suggestions ({suggestions.length})</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[400px] mt-4">
            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Version Information</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Local Version:</span>
                      <span className="font-mono text-xs">{conflict.metadata.localVersion.hash.slice(0, 8)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Remote Version:</span>
                      <span className="font-mono text-xs">{conflict.metadata.remoteVersion.hash.slice(0, 8)}</span>
                    </div>
                    {conflict.metadata.lastSyncedVersion && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Last Synced:</span>
                        <span className="font-mono text-xs">{conflict.metadata.lastSyncedVersion.hash.slice(0, 8)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Conflict Summary</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Total Fields:</span>
                      <span>{conflict.conflictedFields.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">High Priority:</span>
                      <span>{conflict.conflictedFields.filter(f => f.priority === 'high').length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Type:</span>
                      <span>{getConflictTypeLabel(conflict.conflictType)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="font-medium text-sm">Resolution Strategy</h4>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={selectedStrategy === 'manual' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedStrategy('manual')}
                  >
                    Manual Resolution
                  </Button>
                  <Button
                    variant={selectedStrategy === 'latest_wins' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedStrategy('latest_wins')}
                  >
                    Latest Wins
                  </Button>
                  <Button
                    variant={selectedStrategy === 'pipedrive_wins' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedStrategy('pipedrive_wins')}
                  >
                    Pipedrive Wins
                  </Button>
                  <Button
                    variant={selectedStrategy === 'coldcopy_wins' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedStrategy('coldcopy_wins')}
                  >
                    ColdCopy Wins
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="fields" className="space-y-4">
              {conflict.conflictedFields.map((field) => (
                <div key={field.fieldName} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium flex items-center gap-2">
                      {field.fieldName}
                      <Badge variant="outline" className="text-xs">
                        {field.fieldType}
                      </Badge>
                      <Badge
                        variant={field.priority === 'high' ? 'destructive' : field.priority === 'medium' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {field.priority}
                      </Badge>
                    </h4>
                    <Badge variant="outline" className="text-xs">
                      {field.changeType}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`field-${field.fieldName}`}
                          checked={fieldSelections[field.fieldName] === 'local'}
                          onChange={() => handleFieldSelection(field.fieldName, 'local')}
                        />
                        <label className="font-medium">Local (ColdCopy)</label>
                      </div>
                      <div className="p-2 bg-gray-50 rounded border">
                        {renderFieldValue(field.localValue)}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`field-${field.fieldName}`}
                          checked={fieldSelections[field.fieldName] === 'remote'}
                          onChange={() => handleFieldSelection(field.fieldName, 'remote')}
                        />
                        <label className="font-medium">Remote (Pipedrive)</label>
                      </div>
                      <div className="p-2 bg-gray-50 rounded border">
                        {renderFieldValue(field.remoteValue)}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`field-${field.fieldName}`}
                          checked={fieldSelections[field.fieldName] === 'custom'}
                          onChange={() => handleFieldSelection(field.fieldName, 'custom')}
                        />
                        <label className="font-medium">Custom Value</label>
                      </div>
                      <Textarea
                        className="min-h-[60px]"
                        value={customValues[field.fieldName] || ''}
                        onChange={(e) => handleCustomValueChange(field.fieldName, e.target.value)}
                        disabled={fieldSelections[field.fieldName] !== 'custom'}
                      />
                    </div>
                  </div>

                  {field.lastSyncedValue !== undefined && (
                    <div className="text-xs text-gray-500 mt-2">
                      Last synced value: {renderFieldValue(field.lastSyncedValue)}
                    </div>
                  )}
                </div>
              ))}
            </TabsContent>

            <TabsContent value="suggestions" className="space-y-4">
              {suggestions.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No AI suggestions available for this conflict.
                  </AlertDescription>
                </Alert>
              ) : (
                suggestions.map((suggestion, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-purple-500" />
                        {suggestion.field}
                      </h4>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {Math.round(suggestion.confidence * 100)}% confidence
                        </Badge>
                        <Badge variant="secondary">
                          {suggestion.source}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm text-gray-600">{suggestion.reason}</div>
                      <div className="p-3 bg-purple-50 rounded border border-purple-200">
                        <div className="text-sm font-medium mb-1">Suggested Value:</div>
                        <div className="text-sm">{renderFieldValue(suggestion.suggestedValue)}</div>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleApplySuggestion(suggestion)}
                      className="w-full"
                    >
                      Apply Suggestion
                    </Button>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="preview" className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Preview the final resolved data before confirming
                </AlertDescription>
              </Alert>

              <div className="border rounded-lg p-4">
                <h4 className="font-medium mb-3">Resolved Data</h4>
                <pre className="text-sm bg-gray-50 p-3 rounded overflow-auto max-h-[300px]">
                  {JSON.stringify(resolvedData, null, 2)}
                </pre>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Resolution Notes</label>
                <Textarea
                  placeholder="Add any notes about this resolution..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Brain className="h-4 w-4" />
                Confidence Score: {calculateConfidence()}%
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleResolve} 
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            {isLoading ? (
              <>Loading...</>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                Resolve Conflict
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}