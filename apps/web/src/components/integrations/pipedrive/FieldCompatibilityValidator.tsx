'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  AlertCircle, 
  CheckCircle, 
  AlertTriangle,
  ArrowRight,
  Zap,
  Info,
  Shield,
  Activity
} from 'lucide-react';
import { 
  ColdCopyField, 
  PipedriveField, 
  PipedriveFieldMapping,
  FieldCompatibility,
  MappingValidationResult,
  MappingValidationError,
  MappingValidationWarning,
  FIELD_TYPE_COMPATIBILITY,
  BUILT_IN_TRANSFORMS
} from './types';
import { cn } from '@/lib/utils';

interface FieldCompatibilityValidatorProps {
  coldcopyFields: ColdCopyField[];
  pipedriveFields: PipedriveField[];
  mappings: PipedriveFieldMapping[];
}

export function FieldCompatibilityValidator({ 
  coldcopyFields, 
  pipedriveFields, 
  mappings 
}: FieldCompatibilityValidatorProps) {
  const [validationResult, setValidationResult] = useState<MappingValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    validateMappings();
  }, [mappings]);

  const checkFieldCompatibility = (
    sourceType: string, 
    targetType: string
  ): FieldCompatibility => {
    const compatibleTypes = FIELD_TYPE_COMPATIBILITY[sourceType] || [];
    const isDirectlyCompatible = compatibleTypes.includes(targetType);
    
    // Check if types can be transformed
    const possibleTransforms = BUILT_IN_TRANSFORMS.filter(
      t => (t.inputType === sourceType || t.inputType === 'any') &&
           (t.outputType === targetType || t.outputType === 'any')
    );

    let warning: string | undefined;
    
    // Specific warnings for certain type conversions
    if (sourceType === 'number' && targetType === 'string') {
      warning = 'Number will be converted to string, formatting may be needed';
    } else if (sourceType === 'string' && targetType === 'number') {
      warning = 'String must contain valid numeric value or conversion will fail';
    } else if (sourceType === 'json' && targetType !== 'json' && targetType !== 'text') {
      warning = 'Complex data structure will be flattened, possible data loss';
    } else if ((sourceType === 'select' || sourceType === 'multiselect') && targetType === 'string') {
      warning = 'Multiple values will be concatenated';
    }

    return {
      sourceType,
      targetType,
      isCompatible: isDirectlyCompatible || possibleTransforms.length > 0,
      requiresTransform: !isDirectlyCompatible && possibleTransforms.length > 0,
      suggestedTransforms: possibleTransforms,
      warning,
    };
  };

  const validateMappings = () => {
    setIsValidating(true);
    
    const errors: MappingValidationError[] = [];
    const warnings: MappingValidationWarning[] = [];

    // Check for required fields
    const mappedColdCopyFields = new Set(mappings.map(m => m.coldcopyField.name));
    const mappedPipedriveFields = new Set(mappings.map(m => m.pipedriveField.key));

    // Check unmapped required fields
    coldcopyFields
      .filter(f => f.required && !mappedColdCopyFields.has(f.name))
      .forEach(field => {
        errors.push({
          fieldName: field.name,
          type: 'missing_required',
          message: `Required ColdCopy field "${field.label}" is not mapped`,
        });
      });

    pipedriveFields
      .filter(f => f.mandatory_flag && !mappedPipedriveFields.has(f.key))
      .forEach(field => {
        errors.push({
          fieldName: field.key,
          type: 'missing_required',
          message: `Required Pipedrive field "${field.name}" is not mapped`,
        });
      });

    // Check for duplicate mappings
    const coldCopyFieldCounts = mappings.reduce((acc, m) => {
      acc[m.coldcopyField.name] = (acc[m.coldcopyField.name] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(coldCopyFieldCounts)
      .filter(([_, count]) => count > 1)
      .forEach(([fieldName, count]) => {
        warnings.push({
          fieldName,
          type: 'data_loss',
          message: `ColdCopy field "${fieldName}" is mapped ${count} times`,
        });
      });

    // Validate each mapping
    mappings.forEach(mapping => {
      const compatibility = checkFieldCompatibility(
        mapping.coldcopyField.type,
        mapping.pipedriveField.field_type
      );

      if (!compatibility.isCompatible) {
        errors.push({
          fieldName: mapping.coldcopyField.name,
          type: 'type_mismatch',
          message: `Type mismatch: ${mapping.coldcopyField.type} → ${mapping.pipedriveField.field_type}`,
        });
      } else if (compatibility.requiresTransform && !mapping.transformFunction) {
        warnings.push({
          fieldName: mapping.coldcopyField.name,
          type: 'data_loss',
          message: `Transform recommended for ${mapping.coldcopyField.type} → ${mapping.pipedriveField.field_type}`,
        });
      }

      if (compatibility.warning) {
        warnings.push({
          fieldName: mapping.coldcopyField.name,
          type: 'data_loss',
          message: compatibility.warning,
        });
      }

      // Check for deprecated Pipedrive fields
      if (mapping.pipedriveField.active_flag === false) {
        warnings.push({
          fieldName: mapping.pipedriveField.key,
          type: 'deprecated_field',
          message: `Pipedrive field "${mapping.pipedriveField.name}" is inactive`,
        });
      }
    });

    // Performance warnings
    const jsonMappings = mappings.filter(m => 
      m.coldcopyField.type === 'json' || m.pipedriveField.field_type === 'json'
    );
    if (jsonMappings.length > 5) {
      warnings.push({
        fieldName: 'general',
        type: 'performance',
        message: `${jsonMappings.length} JSON field mappings may impact sync performance`,
      });
    }

    setValidationResult({
      isValid: errors.length === 0,
      errors,
      warnings,
    });
    
    setIsValidating(false);
  };

  const getValidationSummary = () => {
    if (!validationResult) return null;

    const { errors, warnings } = validationResult;
    const totalIssues = errors.length + warnings.length;
    
    if (totalIssues === 0) {
      return {
        icon: CheckCircle,
        color: 'text-green-500',
        bgColor: 'bg-green-50 dark:bg-green-900/20',
        borderColor: 'border-green-200 dark:border-green-800',
        title: 'All mappings are valid',
        description: 'Your field mappings are properly configured',
      };
    } else if (errors.length > 0) {
      return {
        icon: AlertCircle,
        color: 'text-red-500',
        bgColor: 'bg-red-50 dark:bg-red-900/20',
        borderColor: 'border-red-200 dark:border-red-800',
        title: `${errors.length} error${errors.length > 1 ? 's' : ''} found`,
        description: 'Fix these issues before syncing',
      };
    } else {
      return {
        icon: AlertTriangle,
        color: 'text-yellow-500',
        bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
        borderColor: 'border-yellow-200 dark:border-yellow-800',
        title: `${warnings.length} warning${warnings.length > 1 ? 's' : ''}`,
        description: 'Review these suggestions for optimal performance',
      };
    }
  };

  const summary = getValidationSummary();

  if (!summary) return null;

  const Icon = summary.icon;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Field Compatibility Check
            </CardTitle>
            <CardDescription>
              Validates type compatibility and mapping configuration
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? 'Hide' : 'Show'} Details
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className={cn(
          "p-4 rounded-lg border",
          summary.bgColor,
          summary.borderColor
        )}>
          <div className="flex items-start gap-3">
            <Icon className={cn("h-5 w-5 mt-0.5", summary.color)} />
            <div>
              <p className="font-medium">{summary.title}</p>
              <p className="text-sm text-muted-foreground">{summary.description}</p>
            </div>
          </div>
        </div>

        {/* Progress indicator */}
        {validationResult && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Validation Score</span>
              <span className="font-medium">
                {Math.round((1 - (validationResult.errors.length / mappings.length)) * 100)}%
              </span>
            </div>
            <Progress 
              value={(1 - (validationResult.errors.length / mappings.length)) * 100} 
              className="h-2"
            />
          </div>
        )}

        {/* Detailed issues */}
        {showDetails && validationResult && (
          <ScrollArea className="h-64 rounded-lg border p-4">
            <div className="space-y-4">
              {validationResult.errors.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    Errors ({validationResult.errors.length})
                  </h4>
                  <div className="space-y-2">
                    {validationResult.errors.map((error, index) => (
                      <Alert key={index} variant="destructive" className="py-2">
                        <AlertDescription className="text-xs">
                          <span className="font-medium">{error.fieldName}:</span> {error.message}
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                </div>
              )}

              {validationResult.warnings.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    Warnings ({validationResult.warnings.length})
                  </h4>
                  <div className="space-y-2">
                    {validationResult.warnings.map((warning, index) => (
                      <Alert key={index} className="py-2 border-yellow-200 dark:border-yellow-800">
                        <AlertDescription className="text-xs">
                          <span className="font-medium">{warning.fieldName}:</span> {warning.message}
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {/* Recommendations */}
        {validationResult && validationResult.warnings.length > 0 && (
          <Card className="p-4 bg-muted/50">
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-medium text-sm">
                <Info className="h-4 w-4" />
                Recommendations
              </div>
              <ul className="text-xs space-y-1 text-muted-foreground">
                {validationResult.warnings
                  .filter(w => w.type === 'data_loss')
                  .slice(0, 3)
                  .map((w, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Zap className="h-3 w-3 mt-0.5 text-yellow-500" />
                      Consider adding transform functions for type conversions
                    </li>
                  ))}
                {validationResult.warnings.some(w => w.type === 'performance') && (
                  <li className="flex items-start gap-2">
                    <Activity className="h-3 w-3 mt-0.5 text-blue-500" />
                    Optimize JSON field mappings for better performance
                  </li>
                )}
              </ul>
            </div>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}